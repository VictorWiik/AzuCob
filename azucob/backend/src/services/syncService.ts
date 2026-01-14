import { prisma } from '../config/database.js';
import { gestaoClickService } from './gestaoClickService.js';
import { efiService } from './efiService.js';
import { logger } from '../utils/logger.js';
import { differenceInDays } from 'date-fns';

export class SyncService {
  /**
   * Sincroniza clientes do GestãoClick
   */
  async syncClients(): Promise<{ created: number; updated: number; errors: number }> {
    const stats = { created: 0, updated: 0, errors: 0 };

    try {
      const gestaoClients = await gestaoClickService.getAllClients();
      logger.info(`Sincronizando ${gestaoClients.length} clientes do GestãoClick`);

      for (const gc of gestaoClients) {
        try {
          const existingClient = await prisma.client.findUnique({
            where: { gestaoClickId: gc.id.toString() },
          });

          const clientData = {
            gestaoClickId: gc.id.toString(),
            name: gc.nome,
            document: gc.cpf_cnpj,
            documentType: gc.tipo_pessoa === 'F' ? 'CPF' : 'CNPJ',
            primaryEmail: gc.email || null,
            phone: gc.telefone || gc.celular || null,
            city: gc.cidade || null,
            state: gc.uf || null,
            active: gc.situacao === 'A',
            syncedAt: new Date(),
          };

          if (existingClient) {
            await prisma.client.update({
              where: { id: existingClient.id },
              data: clientData,
            });
            stats.updated++;
          } else {
            await prisma.client.create({ data: clientData });
            stats.created++;
          }
        } catch (error) {
          logger.error(`Erro ao sincronizar cliente ${gc.id}:`, error);
          stats.errors++;
        }
      }

      logger.info('Sincronização de clientes concluída:', stats);
      return stats;
    } catch (error) {
      logger.error('Erro na sincronização de clientes:', error);
      throw error;
    }
  }

  /**
   * Sincroniza contas a receber (inadimplentes) do GestãoClick
   */
  async syncReceivables(): Promise<{ created: number; updated: number; errors: number }> {
    const stats = { created: 0, updated: 0, errors: 0 };

    try {
      const receivables = await gestaoClickService.getOverdueReceivables();
      logger.info(`Sincronizando ${receivables.length} contas a receber`);

      const today = new Date();

      for (const rec of receivables) {
        try {
          // Busca cliente local pelo ID do GestãoClick
          const client = await prisma.client.findUnique({
            where: { gestaoClickId: rec.cliente_id.toString() },
          });

          if (!client) {
            logger.warn(`Cliente ${rec.cliente_id} não encontrado localmente`);
            stats.errors++;
            continue;
          }

          const dueDate = new Date(rec.data_vencimento);
          const daysOverdue = differenceInDays(today, dueDate);

          const existing = await prisma.receivable.findUnique({
            where: { gestaoClickId: rec.id.toString() },
          });

          const receivableData = {
            gestaoClickId: rec.id.toString(),
            clientId: client.id,
            description: rec.descricao,
            value: rec.valor,
            dueDate: dueDate,
            status: rec.situacao === 'R' ? 'PAID' as const : 
                   rec.situacao === 'C' ? 'CANCELLED' as const :
                   daysOverdue > 0 ? 'OVERDUE' as const : 'PENDING' as const,
            daysOverdue: Math.max(0, daysOverdue),
            invoicePdfUrl: rec.fatura_url || null,
            boletoUrl: rec.boleto_url || null,
            paidAt: rec.data_recebimento ? new Date(rec.data_recebimento) : null,
            paidValue: rec.valor_recebido || null,
            syncedAt: new Date(),
          };

          if (existing) {
            await prisma.receivable.update({
              where: { id: existing.id },
              data: receivableData,
            });
            stats.updated++;
          } else {
            await prisma.receivable.create({ data: receivableData });
            stats.created++;
          }
        } catch (error) {
          logger.error(`Erro ao sincronizar conta ${rec.id}:`, error);
          stats.errors++;
        }
      }

      logger.info('Sincronização de contas concluída:', stats);
      return stats;
    } catch (error) {
      logger.error('Erro na sincronização de contas:', error);
      throw error;
    }
  }

  /**
   * Atualiza informações de boletos do Efí Bank
   */
  async syncEfiBoletos(): Promise<{ updated: number; errors: number }> {
    const stats = { updated: 0, errors: 0 };

    try {
      // Busca contas que não têm boleto ainda
      const receivables = await prisma.receivable.findMany({
        where: {
          status: { in: ['PENDING', 'OVERDUE'] },
          OR: [
            { efiChargeId: null },
            { boletoUrl: null },
          ],
        },
        include: { client: true },
      });

      for (const rec of receivables) {
        try {
          // Busca cobranças no Efí pelo custom_id (pode ser o ID do GestãoClick)
          const charges = await efiService.getChargesByCustomId(rec.gestaoClickId);

          if (charges.length > 0) {
            const charge = charges[0]; // Pega a mais recente
            
            await prisma.receivable.update({
              where: { id: rec.id },
              data: {
                efiChargeId: charge.charge_id.toString(),
                boletoUrl: charge.payment?.banking_billet?.link || null,
                boletoBarcode: charge.payment?.banking_billet?.barcode || null,
              },
            });
            stats.updated++;
          }
        } catch (error) {
          logger.error(`Erro ao sincronizar boleto ${rec.id}:`, error);
          stats.errors++;
        }
      }

      logger.info('Sincronização de boletos Efí concluída:', stats);
      return stats;
    } catch (error) {
      logger.error('Erro na sincronização de boletos:', error);
      throw error;
    }
  }

  /**
   * Executa sincronização completa
   */
  async fullSync(): Promise<void> {
    logger.info('Iniciando sincronização completa...');
    
    await this.syncClients();
    await this.syncReceivables();
    await this.syncEfiBoletos();
    
    logger.info('Sincronização completa finalizada');
  }
}

export const syncService = new SyncService();
