import { prisma } from '../config/database.js';
import { emailService } from './emailService.js';
import { gestaoClickService } from './gestaoClickService.js';
import { efiService } from './efiService.js';
import { logger } from '../utils/logger.js';

export class ChargeService {
  /**
   * Processa cobranças automáticas baseado nas regras
   */
  async processAutomaticCharges(): Promise<{ sent: number; failed: number }> {
    const stats = { sent: 0, failed: 0 };

    try {
      // Busca regras de cobrança ativas
      const rules = await prisma.chargeRule.findMany({
        where: { isActive: true },
        include: { template: true },
        orderBy: { daysOverdue: 'asc' },
      });

      if (rules.length === 0) {
        logger.info('Nenhuma regra de cobrança ativa encontrada');
        return stats;
      }

      // Busca inadimplentes
      const receivables = await prisma.receivable.findMany({
        where: {
          status: 'OVERDUE',
          daysOverdue: { gt: 0 },
        },
        include: {
          client: {
            include: { additionalEmails: true },
          },
        },
      });

      logger.info(`Processando ${receivables.length} contas inadimplentes`);

      for (const receivable of receivables) {
        // Encontra a regra aplicável (maior dias que ainda se aplica)
        const applicableRule = rules
          .filter((r) => r.daysOverdue <= receivable.daysOverdue)
          .pop();

        if (!applicableRule || !applicableRule.template) {
          continue; // Nenhuma regra se aplica ainda ou template não encontrado
        }

        // Verifica se já foi enviado email para esta regra
        const alreadySent = await prisma.sentEmail.findFirst({
          where: {
            receivableId: receivable.id,
            ruleId: applicableRule.id,
            status: 'SENT',
          },
        });

        if (alreadySent) {
          continue; // Já foi enviado para esta regra
        }

        // Prepara lista de emails
        const emails: string[] = [];
        if (receivable.client.primaryEmail) {
          emails.push(receivable.client.primaryEmail);
        }
        receivable.client.additionalEmails
          .filter((e) => e.active)
          .forEach((e) => emails.push(e.email));

        if (emails.length === 0) {
          logger.warn(`Cliente ${receivable.clientId} sem email para envio`);
          continue;
        }

        try {
          // Busca PDFs
          let boletoPdf: Buffer | null = null;
          let invoicePdf: Buffer | null = null;

          if (applicableRule.sendBoleto && receivable.efiChargeId) {
            boletoPdf = await efiService.getBoletoPdf(
              parseInt(receivable.efiChargeId)
            );
          }

          if (applicableRule.sendInvoice && receivable.gestaoClickId) {
            invoicePdf = await gestaoClickService.getInvoicePdf(
              receivable.gestaoClickId
            );
          }

          // Envia email
          const sent = await emailService.sendChargeEmail({
            to: emails,
            clientName: receivable.client.name,
            value: Number(receivable.value),
            dueDate: receivable.dueDate.toISOString(),
            daysOverdue: receivable.daysOverdue,
            description: receivable.description,
            template: applicableRule.template.htmlContent,
            subject: applicableRule.template.subject,
            boletoPdf: boletoPdf || undefined,
            invoicePdf: invoicePdf || undefined,
          });

          // Registra envio
          await prisma.sentEmail.create({
            data: {
              clientId: receivable.clientId,
              receivableId: receivable.id,
              templateId: applicableRule.templateId,
              ruleId: applicableRule.id,
              toEmails: emails,
              subject: applicableRule.template.subject,
              body: applicableRule.template.htmlContent,
              attachments: [
                boletoPdf ? 'boleto.pdf' : null,
                invoicePdf ? 'fatura.pdf' : null,
              ].filter(Boolean) as string[],
              status: sent ? 'SENT' : 'FAILED',
              sentAt: sent ? new Date() : null,
              errorMessage: sent ? null : 'Falha no envio do email',
            },
          });

          if (sent) {
            stats.sent++;
            logger.info(
              `Email de cobrança enviado: Cliente ${receivable.client.name}, Regra ${applicableRule.name}`
            );
          } else {
            stats.failed++;
          }
        } catch (error) {
          stats.failed++;
          logger.error(`Erro ao enviar cobrança ${receivable.id}:`, error);
        }
      }

      logger.info('Processamento de cobranças concluído:', stats);
      return stats;
    } catch (error) {
      logger.error('Erro no processamento de cobranças:', error);
      throw error;
    }
  }

  /**
   * Envia cobrança manual para um cliente/conta específica
   */
  async sendManualCharge(params: {
    receivableId: string;
    templateId: string;
    userId: string;
    additionalEmails?: string[];
  }): Promise<boolean> {
    const receivable = await prisma.receivable.findUnique({
      where: { id: params.receivableId },
      include: {
        client: {
          include: { additionalEmails: true },
        },
      },
    });

    if (!receivable) {
      throw new Error('Conta não encontrada');
    }

    const template = await prisma.emailTemplate.findUnique({
      where: { id: params.templateId },
    });

    if (!template) {
      throw new Error('Template não encontrado');
    }

    // Prepara lista de emails
    const emails: string[] = params.additionalEmails || [];
    if (receivable.client.primaryEmail) {
      emails.push(receivable.client.primaryEmail);
    }
    receivable.client.additionalEmails
      .filter((e) => e.active)
      .forEach((e) => emails.push(e.email));

    // Remove duplicatas
    const uniqueEmails = [...new Set(emails)];

    if (uniqueEmails.length === 0) {
      throw new Error('Nenhum email disponível para envio');
    }

    // Busca PDFs
    let boletoPdf: Buffer | null = null;
    let invoicePdf: Buffer | null = null;

    if (receivable.efiChargeId) {
      boletoPdf = await efiService.getBoletoPdf(parseInt(receivable.efiChargeId));
    }

    if (receivable.gestaoClickId) {
      invoicePdf = await gestaoClickService.getInvoicePdf(
        receivable.gestaoClickId
      );
    }

    // Envia email
    const sent = await emailService.sendChargeEmail({
      to: uniqueEmails,
      clientName: receivable.client.name,
      value: Number(receivable.value),
      dueDate: receivable.dueDate.toISOString(),
      daysOverdue: receivable.daysOverdue,
      description: receivable.description,
      template: template.htmlContent,
      subject: template.subject,
      boletoPdf: boletoPdf || undefined,
      invoicePdf: invoicePdf || undefined,
    });

    // Registra envio
    await prisma.sentEmail.create({
      data: {
        clientId: receivable.clientId,
        receivableId: receivable.id,
        templateId: template.id,
        sentById: params.userId,
        toEmails: uniqueEmails,
        subject: template.subject,
        body: template.htmlContent,
        attachments: [
          boletoPdf ? 'boleto.pdf' : null,
          invoicePdf ? 'fatura.pdf' : null,
        ].filter(Boolean) as string[],
        status: sent ? 'SENT' : 'FAILED',
        sentAt: sent ? new Date() : null,
        errorMessage: sent ? null : 'Falha no envio do email',
      },
    });

    return sent;
  }

  /**
   * Dá baixa em uma conta (sincroniza com GestãoClick e Efí)
   */
  async settleReceivable(params: {
    receivableId: string;
    paidValue: number;
    paidAt: Date;
    userId: string;
  }): Promise<boolean> {
    const receivable = await prisma.receivable.findUnique({
      where: { id: params.receivableId },
    });

    if (!receivable) {
      throw new Error('Conta não encontrada');
    }

    try {
      // Baixa no GestãoClick
      if (receivable.gestaoClickId) {
        await gestaoClickService.settleReceivable(
          receivable.gestaoClickId,
          {
            dataRecebimento: params.paidAt.toISOString().split('T')[0],
            valorRecebido: params.paidValue,
          }
        );
      }

      // Baixa no Efí
      if (receivable.efiChargeId) {
        await efiService.settleCharge(parseInt(receivable.efiChargeId));
      }

      // Atualiza local
      await prisma.receivable.update({
        where: { id: params.receivableId },
        data: {
          status: 'PAID',
          paidAt: params.paidAt,
          paidValue: params.paidValue,
        },
      });

      // Log de auditoria
      await prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: 'SETTLE_RECEIVABLE',
          entity: 'Receivable',
          entityId: params.receivableId,
          newData: { paidValue: params.paidValue, paidAt: params.paidAt },
        },
      });

      return true;
    } catch (error) {
      logger.error('Erro ao dar baixa:', error);
      throw error;
    }
  }
}

export const chargeService = new ChargeService();
