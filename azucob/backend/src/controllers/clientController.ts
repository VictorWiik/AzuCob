import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middlewares/auth.js';
import { z } from 'zod';

const addEmailSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().optional(),
});

export class ClientController {
  /**
   * Lista todos os clientes
   */
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { search, page = '1', limit = '20' } = req.query;

      const where = search
        ? {
            OR: [
              { name: { contains: search as string, mode: 'insensitive' as const } },
              { document: { contains: search as string } },
              { primaryEmail: { contains: search as string, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      const [clients, total] = await Promise.all([
        prisma.client.findMany({
          where,
          include: {
            additionalEmails: true,
            _count: {
              select: { receivables: true },
            },
          },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
          orderBy: { name: 'asc' },
        }),
        prisma.client.count({ where }),
      ]);

      res.json({
        data: clients,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar clientes' });
    }
  }

  /**
   * Busca cliente por ID
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const client = await prisma.client.findUnique({
        where: { id },
        include: {
          additionalEmails: true,
          receivables: {
            orderBy: { dueDate: 'desc' },
            take: 10,
          },
          sentEmails: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!client) {
        res.status(404).json({ error: 'Cliente não encontrado' });
        return;
      }

      res.json(client);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar cliente' });
    }
  }

  /**
   * Adiciona email adicional ao cliente
   */
  async addEmail(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { email, name } = addEmailSchema.parse(req.body);

      const client = await prisma.client.findUnique({ where: { id } });

      if (!client) {
        res.status(404).json({ error: 'Cliente não encontrado' });
        return;
      }

      const clientEmail = await prisma.clientEmail.create({
        data: {
          clientId: id,
          email,
          name,
        },
      });

      res.status(201).json(clientEmail);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      res.status(500).json({ error: 'Erro ao adicionar email' });
    }
  }

  /**
   * Remove email adicional
   */
  async removeEmail(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id, emailId } = req.params;

      await prisma.clientEmail.delete({
        where: {
          id: emailId,
          clientId: id,
        },
      });

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Erro ao remover email' });
    }
  }

  /**
   * Lista clientes inadimplentes
   */
  async listOverdue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { minDays = '1', maxDays } = req.query;

      const where: any = {
        receivables: {
          some: {
            status: 'OVERDUE',
            daysOverdue: {
              gte: parseInt(minDays as string),
              ...(maxDays ? { lte: parseInt(maxDays as string) } : {}),
            },
          },
        },
      };

      const clients = await prisma.client.findMany({
        where,
        include: {
          additionalEmails: true,
          receivables: {
            where: {
              status: 'OVERDUE',
            },
            orderBy: { daysOverdue: 'desc' },
          },
        },
        orderBy: { name: 'asc' },
      });

      // Calcula totais por cliente
      const clientsWithTotals = clients.map((client) => ({
        ...client,
        totalOverdue: client.receivables.reduce(
          (sum, r) => sum + Number(r.value),
          0
        ),
        maxDaysOverdue: Math.max(
          ...client.receivables.map((r) => r.daysOverdue)
        ),
        overdueCount: client.receivables.length,
      }));

      res.json(clientsWithTotals);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar inadimplentes' });
    }
  }
}

export const clientController = new ClientController();
