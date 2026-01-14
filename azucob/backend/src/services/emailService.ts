import { Resend } from 'resend';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
}

export class EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(config.resend.apiKey);
  }

  /**
   * Envia um email via Resend
   */
  async send(options: SendEmailOptions): Promise<boolean> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    try {
      const { data, error } = await this.resend.emails.send({
        from: `${config.resend.fromName} <${config.resend.fromEmail}>`,
        to: recipients,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map((att) => ({
          filename: att.filename,
          content: typeof att.content === 'string' 
            ? Buffer.from(att.content, 'base64') 
            : att.content,
        })),
        reply_to: options.replyTo,
      });

      if (error) {
        logger.error('Erro ao enviar email via Resend:', error);
        return false;
      }

      logger.info('Email enviado com sucesso via Resend:', {
        id: data?.id,
        to: recipients,
        subject: options.subject,
      });

      return true;
    } catch (error) {
      logger.error('Erro ao enviar email:', error);
      return false;
    }
  }

  /**
   * Envia email de cobrança
   */
  async sendChargeEmail(params: {
    to: string[];
    clientName: string;
    value: number;
    dueDate: string;
    daysOverdue: number;
    description: string;
    template: string;
    subject: string;
    boletoPdf?: Buffer;
    invoicePdf?: Buffer;
  }): Promise<boolean> {
    // Substituir variáveis no template
    const html = this.replaceTemplateVariables(params.template, {
      nome: params.clientName,
      valor: this.formatCurrency(params.value),
      vencimento: this.formatDate(params.dueDate),
      dias_atraso: params.daysOverdue.toString(),
      descricao: params.description,
    });

    const subject = this.replaceTemplateVariables(params.subject, {
      nome: params.clientName,
      valor: this.formatCurrency(params.value),
      dias_atraso: params.daysOverdue.toString(),
    });

    const attachments: EmailAttachment[] = [];

    if (params.boletoPdf) {
      attachments.push({
        filename: 'boleto.pdf',
        content: params.boletoPdf,
        contentType: 'application/pdf',
      });
    }

    if (params.invoicePdf) {
      attachments.push({
        filename: 'fatura.pdf',
        content: params.invoicePdf,
        contentType: 'application/pdf',
      });
    }

    return this.send({
      to: params.to,
      subject,
      html,
      attachments,
    });
  }

  /**
   * Substitui variáveis no template {{variavel}}
   */
  private replaceTemplateVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      result = result.replace(regex, value);
    }

    return result;
  }

  /**
   * Formata valor para moeda brasileira
   */
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  /**
   * Formata data para formato brasileiro
   */
  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR').format(date);
  }

  /**
   * Verifica conexão com Resend
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!config.resend.apiKey) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const emailService = new EmailService();
