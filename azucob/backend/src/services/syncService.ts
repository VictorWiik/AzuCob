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
          // Tenta pegar o documento de várias formas possíveis
          const gcAny = gc as any;
          const cnpj = (gcAny.cnpj || gcAny.CNPJ || '') as string;
          const cpf = (gcAny.cpf || gcAny.CPF || '') as string;
          const cpfCnpj = (gcAny.cpf_cnpj || gcAny.CPF_CNPJ || '') as string;
          
          // Remove caracteres não numéricos
          const document = cnpj?.replace(/\D/g, '') || cpf?.replace(/\D/g, '') || cpfCnpj?.replace(/\D/g, '') || '';
          
          if (!document) {
            logger.warn(`Cliente ${gc.id} (${gc.nome}) não tem CPF/CNPJ, pulando...`);
            stats.errors++;
            continue;
          }

          const documentType = gc.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF';

          // Pega cidade e estado do primeiro endereço
          const endereco = gc.enderecos?.[0]?.endereco;
          const city = endereco?.nome_cidade || null;
          const state = endereco?.estado || null;

          const existingClient = await prisma.client.findUnique({
            where: { gestaoClickId: gc.id.toString() },
          });

          const clientData = {
            gestaoClickId: gc.id.toString(),
            name: gc.nome,
            document: document,
            documentType: documentType,
            primaryEmail: gc.email || null,
            phone: gc.telefone || gc.celular || null,
            city: city,
            state: state,
            active: gc.ativo === '1',
            syncedAt: new Date(),
          };

          let clientId: string;

          if (existingClient) {
            await prisma.client.update({
              where: { id: existingClient.id },
              data: clientData,
            });
            clientId = existingClient.id;
            stats.updated++;
          } else {
            const newClient = await prisma.client.create({ data: clientData });
            clientId = newClient.id;
            stats.created++;
          }

          // Sincroniza emails de contato
          if (gc.contatos && gc.contatos.length > 0) {
            // Remove emails antigos sincronizados
            await prisma.clientEmail.deleteMany({
              where: { 
                clientId: clientId,
                gestaoClickContactId: { not: null }
              },
            });

            // Adiciona emails de contato do GestãoClick
            for (const contato of gc.contatos) {
              const email = contato.contato?.contato;
              const nome = contato.contato?.nome;
              
              // Verifica se é um email válido
              if (email && email.includes('@')) {
                await prisma.clientEmail.create({
                  data: {
                    clientId: clientId,
                    email: email,
                    name: nome || null,
                    gestaoClickContactId: contato.contato?.tipo_id || null,
                  },
                });
              }
            }
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
   * Sincroniza recebimentos em atraso (inadimplentes) do GestãoClick
   */
  async syncReceivables(): Promise<{ created: number; updated: number; errors: number }> {
    const stats = { created: 0, updated: 0, errors: 0 };

    try {
      const receivables = await gestaoClickService.getOverdueReceivables();
      logger.info(`Sincronizando ${receivables.length} recebimentos em atraso`);

      const today = new Date();

      for (const rec of receivables) {
        try {
          // Busca cliente local pelo ID do GestãoClick
          const client = await prisma.client.findUnique({
            where: { gestaoClickId: rec.cliente_id?.toString() },
          });

          if (!client) {
            logger.warn(`Cliente ${rec.cliente_id} (${rec.nome_cliente}) não encontrado localmente`);
            stats.errors++;
            continue;
          }

          const dueDate = new Date(rec.data_vencimento);
          const daysOverdue = differenceInDays(today, dueDate);
          const valor = parseFloat(rec.valor || '0');
          const valorTotal = parseFloat(rec.valor_total || rec.valor || '0');

          const existing = await prisma.receivable.findUnique({
            where: { gestaoClickId: rec.id.toString() },
          });

          const receivableData = {
            gestaoClickId: rec.id.toString(),
            clientId: client.id,
            description: rec.descricao || `Recebimento #${rec.codigo}`,
            value: valor,
            dueDate: dueDate,
            status: rec.liquidado === '1' ? 'PAID' as const : 
                   daysOverdue > 0 ? 'OVERDUE' as const : 'PENDING' as const,
            daysOverdue: Math.max(0, daysOverdue),
            paidAt: rec.data_liquidacao ? new Date(rec.data_liquidacao) : null,
            paidValue: rec.liquidado === '1' ? valorTotal : null,
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
          logger.error(`Erro ao sincronizar recebimento ${rec.id}:`, error);
          stats.errors++;
        }
      }

      logger.info('Sincronização de recebimentos concluída:', stats);
      return stats;
    } catch (error) {
      logger.error('Erro na sincronização de recebimentos:', error);
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
