import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middlewares/auth.js';
import { z } from 'zod';

const templateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  subject: z.string().min(5, 'Assunto deve ter no mínimo 5 caracteres'),
  htmlContent: z.string().min(50, 'Corpo do email deve ter no mínimo 50 caracteres'),
  isActive: z.boolean().optional().default(true),
});

export class TemplateController {
  /**
   * Lista todos os templates
   */
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const templates = await prisma.emailTemplate.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { chargeRules: true, sentEmails: true },
          },
        },
      });

      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar templates' });
    }
  }

  /**
   * Busca template por ID
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const template = await prisma.emailTemplate.findUnique({
        where: { id },
        include: {
          chargeRules: true,
        },
      });

      if (!template) {
        res.status(404).json({ error: 'Template não encontrado' });
        return;
      }

      res.json(template);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar template' });
    }
  }

  /**
   * Cria novo template
   */
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = templateSchema.parse(req.body);

      const template = await prisma.emailTemplate.create({
        data: {
          name: data.name,
          subject: data.subject,
          htmlContent: data.htmlContent,
          isActive: data.isActive,
        },
      });

      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      res.status(500).json({ error: 'Erro ao criar template' });
    }
  }

  /**
   * Atualiza template
   */
  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = templateSchema.partial().parse(req.body);

      const existing = await prisma.emailTemplate.findUnique({ where: { id } });

      if (!existing) {
        res.status(404).json({ error: 'Template não encontrado' });
        return;
      }

      const template = await prisma.emailTemplate.update({
        where: { id },
        data,
      });

      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      res.status(500).json({ error: 'Erro ao atualizar template' });
    }
  }

  /**
   * Deleta template
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Verifica se está em uso
      const rulesCount = await prisma.chargeRule.count({
        where: { templateId: id },
      });

      if (rulesCount > 0) {
        res.status(400).json({
          error: 'Template está em uso por regras de cobrança. Remova as regras primeiro.',
        });
        return;
      }

      await prisma.emailTemplate.delete({ where: { id } });

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Erro ao deletar template' });
    }
  }

  /**
   * Lista variáveis disponíveis
   */
  async getAvailableVariables(req: AuthRequest, res: Response): Promise<void> {
    res.json([
      'nome',
      'valor',
      'vencimento',
      'dias_atraso',
      'descricao',
      'documento',
    ]);
  }
}

export const templateController = new TemplateController();
