import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middlewares/auth.js';
import { z } from 'zod';

const ruleSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  daysOverdue: z.number().int().min(1, 'Dias de atraso deve ser no mínimo 1'),
  templateId: z.string().uuid('Template inválido'),
  isActive: z.boolean().optional().default(true),
  sendBoleto: z.boolean().optional().default(true),
  sendInvoice: z.boolean().optional().default(true),
});

export class RuleController {
  /**
   * Lista todas as regras
   */
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rules = await prisma.chargeRule.findMany({
        include: {
          template: {
            select: { id: true, name: true, subject: true },
          },
          _count: {
            select: { sentEmails: true },
          },
        },
        orderBy: { daysOverdue: 'asc' },
      });

      res.json(rules);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar regras' });
    }
  }

  /**
   * Busca regra por ID
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const rule = await prisma.chargeRule.findUnique({
        where: { id },
        include: {
          template: true,
          sentEmails: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
              client: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (!rule) {
        res.status(404).json({ error: 'Regra não encontrada' });
        return;
      }

      res.json(rule);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar regra' });
    }
  }

  /**
   * Cria nova regra
   */
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = ruleSchema.parse(req.body);

      // Verifica se template existe
      const template = await prisma.emailTemplate.findUnique({
        where: { id: data.templateId },
      });

      if (!template) {
        res.status(400).json({ error: 'Template não encontrado' });
        return;
      }

      // Verifica se já existe regra para esses dias
      const existingRule = await prisma.chargeRule.findFirst({
        where: { daysOverdue: data.daysOverdue, isActive: true },
      });

      if (existingRule) {
        res.status(400).json({
          error: `Já existe uma regra ativa para ${data.daysOverdue} dias de atraso`,
        });
        return;
      }

      const rule = await prisma.chargeRule.create({
        data: {
          name: data.name,
          daysOverdue: data.daysOverdue,
          templateId: data.templateId,
          isActive: data.isActive,
          sendBoleto: data.sendBoleto,
          sendInvoice: data.sendInvoice,
        },
        include: {
          template: {
            select: { id: true, name: true },
          },
        },
      });

      res.status(201).json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      res.status(500).json({ error: 'Erro ao criar regra' });
    }
  }

  /**
   * Atualiza regra
   */
  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = ruleSchema.partial().parse(req.body);

      const existing = await prisma.chargeRule.findUnique({ where: { id } });

      if (!existing) {
        res.status(404).json({ error: 'Regra não encontrada' });
        return;
      }

      // Se está mudando dias de atraso, verifica conflito
      if (data.daysOverdue && data.daysOverdue !== existing.daysOverdue) {
        const conflict = await prisma.chargeRule.findFirst({
          where: {
            daysOverdue: data.daysOverdue,
            isActive: true,
            id: { not: id },
          },
        });

        if (conflict) {
          res.status(400).json({
            error: `Já existe uma regra ativa para ${data.daysOverdue} dias de atraso`,
          });
          return;
        }
      }

      const rule = await prisma.chargeRule.update({
        where: { id },
        data,
        include: {
          template: {
            select: { id: true, name: true },
          },
        },
      });

      res.json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      res.status(500).json({ error: 'Erro ao atualizar regra' });
    }
  }

  /**
   * Deleta regra
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await prisma.chargeRule.delete({ where: { id } });

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Erro ao deletar regra' });
    }
  }

  /**
   * Ativa/desativa regra
   */
  async toggleActive(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const existing = await prisma.chargeRule.findUnique({ where: { id } });

      if (!existing) {
        res.status(404).json({ error: 'Regra não encontrada' });
        return;
      }

      const rule = await prisma.chargeRule.update({
        where: { id },
        data: { isActive: !existing.isActive },
      });

      res.json(rule);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao alterar status da regra' });
    }
  }
}

export const ruleController = new RuleController();
