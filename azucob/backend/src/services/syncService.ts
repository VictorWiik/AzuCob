import { prisma } from '../config/database.js';
import { gestaoClickService } from './gestaoClickService.js';
import { efiService } from './efiService.js';
import { logger } from '../utils/logger.js';
import { differenceInDays, subDays, format } from 'date-fns';

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
          const gcAny = gc as any;
          const cnpj = (gcAny.cnpj || gcAny.CNPJ || '') as string;
          const cpf = (gcAny.cpf || gcAny.CPF || '') as string;
          const cpfCnpj = (gcAny.cpf_cnpj || gcAny.CPF_CNPJ || '') as string;
          
          const document = cnpj?.replace(/\D/g, '') || cpf?.replace(/\D/g, '') || cpfCnpj?.replace(/\D/g, '') || '';
          
          if (!document) {
            logger.warn(`Cliente ${gc.id} (${gc.nome}) não tem CPF/CNPJ, pulando...`);
            stats.errors++;
            continue;
          }

          const documentType = gc.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF';

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

          if (gc.contatos && gc.contatos.length > 0) {
            await prisma.clientEmail.deleteMany({
              where: { 
                clientId: clientId,
                gestaoClickContactId: { not: null }
              },
            });

            for (const contato of gc.contatos) {
              const email = contato.contato?.contato;
              const nome = contato.contato?.nome;
              
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
  async syncReceivables(filterDays?: number, startDate?: string): Promise<{ created: number; updated: number; errors: number }> {
    const stats = { created: 0, updated: 0, errors: 0 };

    try {
      let dataInicio: string;
      const today = new Date();
      
      if (startDate) {
        dataInicio = startDate;
      } else if (filterDays) {
        dataInicio = format(subDays(today, filterDays), 'yyyy-MM-dd');
      } else {
        dataInicio = format(subDays(today, 90), 'yyyy-MM-dd');
      }

      const dataFim = format(today, 'yyyy-MM-dd');

      logger.info(`Buscando recebimentos em atraso de ${dataInicio} até ${dataFim}`);

      const receivables = await gestaoClickService.getOverdueReceivables(dataInicio, dataFim);
      logger.info(`Sincronizando ${receivables.length} recebimentos em atraso`);

      for (const rec of receivables) {
        try {
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
   * Estratégia: Busca por CPF/CNPJ + cruza por valor e data de vencimento
   */
  async syncEfiBoletos(): Promise<{ updated: number; errors: number; notFound: number }> {
    const stats = { updated: 0, errors: 0, notFound: 0 };

    try {
      // Busca recebimentos que precisam de boleto
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

      if (receivables.length === 0) {
        logger.info('Nenhum recebimento precisando de boleto');
        return stats;
      }

      logger.info(`Buscando boletos para ${receivables.length} recebimentos`);

      // Período de busca: últimos 120 dias
      const dateFrom = format(subDays(new Date(), 120), 'yyyy-MM-dd');
      const dateTo = format(new Date(), 'yyyy-MM-dd');

      // Agrupa recebimentos por cliente (CNPJ/CPF)
      const receivablesByClient = new Map<string, typeof receivables>();
      
      for (const rec of receivables) {
        if (!rec.client?.document) continue;
        
        const doc = rec.client.document;
        if (!receivablesByClient.has(doc)) {
          receivablesByClient.set(doc, []);
        }
        receivablesByClient.get(doc)!.push(rec);
      }

      logger.info(`Processando ${receivablesByClient.size} clientes únicos`);

      // Para cada cliente, busca boletos no Efí
      for (const [document, clientReceivables] of receivablesByClient) {
        try {
          // Busca boletos desse cliente no Efí
          const charges = await efiService.getChargesByDocument(document, dateFrom, dateTo);
          
          if (charges.length === 0) {
            logger.debug(`Nenhum boleto encontrado para documento ${document}`);
            stats.notFound += clientReceivables.length;
            continue;
          }

          logger.info(`Encontrados ${charges.length} boletos para documento ${document}`);

          // Para cada recebimento do cliente, tenta encontrar o boleto correspondente
          for (const rec of clientReceivables) {
            try {
              const recValue = Number(rec.value);
              const recDueDate = new Date(rec.dueDate);

              // Busca boleto pelo valor + data de vencimento
              const matchedCharge = charges.find((charge) => {
                // Valor do boleto (Efí retorna em centavos)
                const chargeValue = charge.total / 100;
                const valueMatch = Math.abs(chargeValue - recValue) < 0.10; // Tolerância de 10 centavos
                
                if (!valueMatch) return false;

                // Data de vencimento
                const expireAt = charge.payment?.banking_billet?.expire_at;
                if (expireAt) {
                  const chargeDueDate = new Date(expireAt);
                  const daysDiff = Math.abs(differenceInDays(chargeDueDate, recDueDate));
                  return daysDiff <= 3; // Tolerância de 3 dias
                }

                return valueMatch;
              });

              if (matchedCharge) {
                const chargeId = matchedCharge.id || matchedCharge.charge_id;
                const boletoData = matchedCharge.payment?.banking_billet;
                const pixData = matchedCharge.payment?.pix;

                await prisma.receivable.update({
                  where: { id: rec.id },
                  data: {
                    efiChargeId: chargeId?.toString(),
                    boletoUrl: boletoData?.link || null,
                    boletoBarcode: boletoData?.barcode || null,
                    boletoLine: pixData?.qrcode || null,
                  },
                });

                logger.info(`✓ Vinculado: ${rec.description} (R$ ${recValue}) -> Charge ${chargeId}`);
                stats.updated++;

                // Remove da lista para não usar novamente
                const idx = charges.findIndex(c => (c.id || c.charge_id) === chargeId);
                if (idx > -1) charges.splice(idx, 1);
              } else {
                logger.debug(`✗ Não encontrado: ${rec.description} (R$ ${recValue})`);
                stats.notFound++;
              }
            } catch (error) {
              logger.error(`Erro ao processar recebimento ${rec.id}:`, error);
              stats.errors++;
            }
          }
        } catch (error) {
          logger.error(`Erro ao buscar boletos para documento ${document}:`, error);
          stats.errors += clientReceivables.length;
        }
      }

      logger.info('Sincronização de boletos concluída:', stats);
      return stats;
    } catch (error) {
      logger.error('Erro na sincronização de boletos:', error);
      throw error;
    }
  }

  /**
   * Busca detalhes de um boleto específico
   */
  async getBoletoDetails(chargeId: string): Promise<{
    url: string | null;
    barcode: string | null;
    pdfUrl: string | null;
    status: string | null;
  } | null> {
    try {
      const charge = await efiService.getChargeById(parseInt(chargeId));
      if (!charge) return null;

      const billet = charge.payment?.banking_billet;
      return {
        url: billet?.link || null,
        barcode: billet?.barcode || null,
        pdfUrl: billet?.pdf?.charge || null,
        status: charge.status,
      };
    } catch (error) {
      logger.error(`Erro ao buscar detalhes do boleto ${chargeId}:`, error);
      return null;
    }
  }

  /**
   * Executa sincronização completa
   */
  async fullSync(filterDays?: number, startDate?: string): Promise<{
    clients: { created: number; updated: number; errors: number };
    receivables: { created: number; updated: number; errors: number };
    boletos: { updated: number; errors: number; notFound: number };
  }> {
    logger.info('Iniciando sincronização completa...');
    
    const clientsResult = await this.syncClients();
    const receivablesResult = await this.syncReceivables(filterDays, startDate);
    const boletosResult = await this.syncEfiBoletos();
    
    logger.info('Sincronização completa finalizada');
    
    return {
      clients: clientsResult,
      receivables: receivablesResult,
      boletos: boletosResult,
    };
  }
}

export const syncService = new SyncService();
