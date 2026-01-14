import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middlewares/auth.js';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export class DashboardController {
  /**
   * Retorna resumo geral do dashboard
   */
  async getSummary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const today = new Date();
      const weekAgo = subDays(today, 7);
      const monthAgo = subDays(today, 30);

      // Totais de inadimplentes
      const [
        totalOverdue,
        totalOverdueValue,
        weekOverdue,
        monthOverdue,
        totalClients,
        totalClientsWithOverdue,
        emailsSentToday,
        emailsSentWeek,
      ] = await Promise.all([
        // Total de contas inadimplentes
        prisma.receivable.count({
          where: { status: 'OVERDUE' },
        }),
        // Valor total em atraso
        prisma.receivable.aggregate({
          where: { status: 'OVERDUE' },
          _sum: { value: true },
        }),
        // Inadimplentes na última semana
        prisma.receivable.count({
          where: {
            status: 'OVERDUE',
            daysOverdue: { lte: 7 },
          },
        }),
        // Inadimplentes no último mês
        prisma.receivable.count({
          where: {
            status: 'OVERDUE',
            daysOverdue: { lte: 30 },
          },
        }),
        // Total de clientes
        prisma.client.count({ where: { active: true } }),
        // Clientes com inadimplência
        prisma.client.count({
          where: {
            receivables: {
              some: { status: 'OVERDUE' },
            },
          },
        }),
        // Emails enviados hoje
        prisma.sentEmail.count({
          where: {
            status: 'SENT',
            sentAt: {
              gte: startOfDay(today),
              lte: endOfDay(today),
            },
          },
        }),
        // Emails enviados na semana
        prisma.sentEmail.count({
          where: {
            status: 'SENT',
            sentAt: {
              gte: startOfDay(weekAgo),
              lte: endOfDay(today),
            },
          },
        }),
      ]);

      // Distribuição por faixa de atraso
      const overdueByRange = await prisma.receivable.groupBy({
        by: ['status'],
        where: { status: 'OVERDUE' },
        _count: true,
      });

      const rangeDistribution = {
        '1-7': await prisma.receivable.count({
          where: { status: 'OVERDUE', daysOverdue: { gte: 1, lte: 7 } },
        }),
        '8-15': await prisma.receivable.count({
          where: { status: 'OVERDUE', daysOverdue: { gte: 8, lte: 15 } },
        }),
        '16-30': await prisma.receivable.count({
          where: { status: 'OVERDUE', daysOverdue: { gte: 16, lte: 30 } },
        }),
        '31-60': await prisma.receivable.count({
          where: { status: 'OVERDUE', daysOverdue: { gte: 31, lte: 60 } },
        }),
        '60+': await prisma.receivable.count({
          where: { status: 'OVERDUE', daysOverdue: { gt: 60 } },
        }),
      };

      res.json({
        overview: {
          totalOverdue,
          totalOverdueValue: Number(totalOverdueValue._sum.value || 0),
          weekOverdue,
          monthOverdue,
          totalClients,
          totalClientsWithOverdue,
          overduePercentage: totalClients > 0 
            ? ((totalClientsWithOverdue / totalClients) * 100).toFixed(1) 
            : 0,
        },
        emails: {
          sentToday: emailsSentToday,
          sentWeek: emailsSentWeek,
        },
        distribution: rangeDistribution,
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
    }
  }

  /**
   * Top 10 maiores devedores
   */
  async getTopDebtors(req: AuthRequest, res: Response): Promise<void> {
    try {
      const debtors = await prisma.client.findMany({
        where: {
          receivables: {
            some: { status: 'OVERDUE' },
          },
        },
        include: {
          receivables: {
            where: { status: 'OVERDUE' },
          },
        },
      });

      const ranked = debtors
        .map((client) => ({
          id: client.id,
          name: client.name,
          document: client.document,
          totalDebt: client.receivables.reduce((sum, r) => sum + Number(r.value), 0),
          overdueCount: client.receivables.length,
          maxDaysOverdue: Math.max(...client.receivables.map((r) => r.daysOverdue)),
        }))
        .sort((a, b) => b.totalDebt - a.totalDebt)
        .slice(0, 10);

      res.json(ranked);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar maiores devedores' });
    }
  }

  /**
   * Cobranças recentes (últimas 10)
   */
  async getRecentCharges(req: AuthRequest, res: Response): Promise<void> {
    try {
      const charges = await prisma.sentEmail.findMany({
        where: { status: 'SENT' },
        include: {
          client: {
            select: { name: true },
          },
          receivable: {
            select: { value: true, daysOverdue: true },
          },
          template: {
            select: { name: true },
          },
        },
        orderBy: { sentAt: 'desc' },
        take: 10,
      });

      res.json(charges);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar cobranças recentes' });
    }
  }

  /**
   * Status das integrações
   */
  async getIntegrationStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const [lastClientSync, lastReceivableSync, lastEfiSync] = await Promise.all([
        prisma.client.findFirst({
          orderBy: { syncedAt: 'desc' },
          select: { syncedAt: true },
        }),
        prisma.receivable.findFirst({
          orderBy: { syncedAt: 'desc' },
          select: { syncedAt: true },
        }),
        prisma.receivable.findFirst({
          where: { efiChargeId: { not: null } },
          orderBy: { syncedAt: 'desc' },
          select: { syncedAt: true },
        }),
      ]);

      // Check if integration configs are present
      const { config } = await import('../config/env.js');
      
      res.json({
        integrations: {
          gestaoClick: !!(config.gestaoClick.accessToken && config.gestaoClick.secretAccess),
          efi: !!(config.efi.clientId && config.efi.clientSecret),
          resend: !!config.resend.apiKey,
        },
        sync: {
          lastClientSync: lastClientSync?.syncedAt || null,
          lastReceivableSync: lastReceivableSync?.syncedAt || null,
          lastEfiSync: lastEfiSync?.syncedAt || null,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar status das integrações' });
    }
  }
}

export const dashboardController = new DashboardController();
