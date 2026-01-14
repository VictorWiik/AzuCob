import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middlewares/auth.js';
import { chargeService } from '../services/chargeService.js';
import { z } from 'zod';

const settleSchema = z.object({
  paidValue: z.number().positive('Valor deve ser positivo'),
  paidAt: z.string().transform((str) => new Date(str)),
});

const sendChargeSchema = z.object({
  templateId: z.string().uuid('Template inválido'),
  additionalEmails: z.array(z.string().email()).optional(),
});

export class ReceivableController {
  /**
   * Lista contas a receber
   */
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { 
        status, 
        clientId, 
        minDaysOverdue, 
        maxDaysOverdue,
        page = '1', 
        limit = '20' 
      } = req.query;

      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (clientId) {
        where.clientId = clientId;
      }

      if (minDaysOverdue || maxDaysOverdue) {
        where.daysOverdue = {};
        if (minDaysOverdue) where.daysOverdue.gte = parseInt(minDaysOverdue as string);
        if (maxDaysOverdue) where.daysOverdue.lte = parseInt(maxDaysOverdue as string);
      }

      const [receivables, total] = await Promise.all([
        prisma.receivable.findMany({
          where,
          include: {
            client: {
              select: { id: true, name: true, document: true, primaryEmail: true },
            },
          },
          skip: (parseInt(page as string) - 1) * parseInt(limit as string),
          take: parseInt(limit as string),
          orderBy: [{ status: 'asc' }, { daysOverdue: 'desc' }],
        }),
        prisma.receivable.count({ where }),
      ]);

      res.json({
        data: receivables,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar contas' });
    }
  }

  /**
   * Busca conta por ID
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const receivable = await prisma.receivable.findUnique({
        where: { id },
        include: {
          client: {
            include: { additionalEmails: true },
          },
          sentEmails: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!receivable) {
        res.status(404).json({ error: 'Conta não encontrada' });
        return;
      }

      res.json(receivable);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar conta' });
    }
  }

  /**
   * Lista inadimplentes
   */
  async listOverdue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { period } = req.query; // 'week', 'month', 'all'

      let minDaysOverdue = 1;
      let maxDaysOverdue: number | undefined;

      if (period === 'week') {
        maxDaysOverdue = 7;
      } else if (period === 'month') {
        maxDaysOverdue = 30;
      }

      const receivables = await prisma.receivable.findMany({
        where: {
          status: 'OVERDUE',
          daysOverdue: {
            gte: minDaysOverdue,
            ...(maxDaysOverdue ? { lte: maxDaysOverdue } : {}),
          },
        },
        include: {
          client: {
            select: { id: true, name: true, document: true, primaryEmail: true },
          },
        },
        orderBy: { daysOverdue: 'desc' },
      });

      const summary = {
        total: receivables.length,
        totalValue: receivables.reduce((sum, r) => sum + Number(r.value), 0),
        byDaysRange: {
          '1-7': receivables.filter((r) => r.daysOverdue <= 7).length,
          '8-15': receivables.filter((r) => r.daysOverdue > 7 && r.daysOverdue <= 15).length,
          '16-30': receivables.filter((r) => r.daysOverdue > 15 && r.daysOverdue <= 30).length,
          '30+': receivables.filter((r) => r.daysOverdue > 30).length,
        },
      };

      res.json({ data: receivables, summary });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar inadimplentes' });
    }
  }

  /**
   * Dá baixa em uma conta
   */
  async settle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { paidValue, paidAt } = settleSchema.parse(req.body);

      await chargeService.settleReceivable({
        receivableId: id,
        paidValue,
        paidAt,
        userId: req.user!.id,
      });

      res.json({ message: 'Baixa realizada com sucesso' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao dar baixa' });
    }
  }

  /**
   * Envia cobrança manual
   */
  async sendCharge(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { templateId, additionalEmails } = sendChargeSchema.parse(req.body);

      const sent = await chargeService.sendManualCharge({
        receivableId: id,
        templateId,
        userId: req.user!.id,
        additionalEmails,
      });

      if (sent) {
        res.json({ message: 'Cobrança enviada com sucesso' });
      } else {
        res.status(500).json({ error: 'Falha ao enviar cobrança' });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao enviar cobrança' });
    }
  }
}

export const receivableController = new ReceivableController();
