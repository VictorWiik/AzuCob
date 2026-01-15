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
   * @param filterDays - Filtrar por últimos X dias (30, 60, 90) ou null para data específica
   * @param startDate - Data inicial específica (formato YYYY-MM-DD)
   */
  async syncReceivables(filterDays?: number, startDate?: string): Promise<{ created: number; updated: number; errors: number }> {
    const stats = { created: 0, updated: 0, errors: 0 };

    try {
      // Calcula a data inicial baseado no filtro
      let dataInicio: string;
      const today = new Date();
      
      if (startDate) {
        // Data específica fornecida
        dataInicio = startDate;
      } else if (filterDays) {
        // Últimos X dias
        dataInicio = format(subDays(today, filterDays), 'yyyy-MM-dd');
      } else {
        // Padrão: últimos 90 dias
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
   * Tenta vincular por múltiplos critérios:
   * 1. custom_id (ID do GestãoClick)
   * 2. Descrição + Valor + Data de vencimento
   * 3. CPF/CNPJ do cliente + Valor + Data de vencimento
   */
  async syncEfiBoletos(): Promise<{ updated: number; errors: number; notFound: number }> {
    const stats = { updated: 0, errors: 0, notFound: 0 };

    try {
      // Busca recebimentos que precisam de atualização de boleto
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
        logger.info('Nenhum recebimento precisando de atualização de boleto');
        return stats;
      }

      logger.info(`Buscando boletos para ${receivables.length} recebimentos`);

      // Busca todos os boletos em aberto do Efí (últimos 120 dias)
      const dateFrom = format(subDays(new Date(), 120), 'yyyy-MM-dd');
      const dateTo = format(new Date(), 'yyyy-MM-dd');
      
      let allCharges: any[] = [];
      try {
        // Busca boletos waiting e unpaid
        const waitingCharges = await efiService.getCharges({
          status: 'waiting',
          dateFrom,
          dateTo,
          limit: 500,
        });
        const unpaidCharges = await efiService.getCharges({
          status: 'unpaid',
          dateFrom,
          dateTo,
          limit: 500,
        });
        allCharges = [...waitingCharges, ...unpaidCharges];
        logger.info(`Encontrados ${allCharges.length} boletos no Efí`);
      } catch (error) {
        logger.error('Erro ao buscar boletos do Efí:', error);
        throw error;
      }

      // Para cada recebimento, tenta encontrar o boleto correspondente
      for (const rec of receivables) {
        try {
          let matchedCharge: any = null;

          // Estratégia 1: Busca por custom_id (ID do GestãoClick)
          matchedCharge = allCharges.find(
            (charge) => charge.custom_id === rec.gestaoClickId
          );

          // Estratégia 2: Busca por descrição (ex: "Locação nº 2648")
          if (!matchedCharge && rec.description) {
            matchedCharge = allCharges.find((charge) => {
              const itemName = charge.items?.[0]?.name || '';
              return itemName.toLowerCase().includes(rec.description.toLowerCase()) ||
                     rec.description.toLowerCase().includes(itemName.toLowerCase());
            });
          }

          // Estratégia 3: Busca por valor + data de vencimento aproximada
          if (!matchedCharge) {
            const recValue = Number(rec.value);
            const recDueDate = new Date(rec.dueDate);
            
            matchedCharge = allCharges.find((charge) => {
              // Calcula valor total do boleto (em centavos para reais)
              const chargeValue = charge.total / 100;
              const chargeDueDate = charge.payment?.banking_billet?.expire_at 
                ? new Date(charge.payment.banking_billet.expire_at)
                : null;
              
              // Verifica se valor é igual (com tolerância de R$ 0.10)
              const valueMatch = Math.abs(chargeValue - recValue) < 0.10;
              
              // Verifica se data de vencimento é igual (com tolerância de 2 dias)
              let dateMatch = false;
              if (chargeDueDate) {
                const daysDiff = Math.abs(differenceInDays(chargeDueDate, recDueDate));
                dateMatch = daysDiff <= 2;
              }
              
              return valueMatch && dateMatch;
            });
          }

          // Estratégia 4: Busca por CPF/CNPJ do cliente + valor
          if (!matchedCharge && rec.client?.document) {
            const clientDoc = rec.client.document.replace(/\D/g, '');
            const recValue = Number(rec.value);
            
            matchedCharge = allCharges.find((charge) => {
              const chargeDoc = (charge.customer?.cpf || charge.customer?.cnpj || '').replace(/\D/g, '');
              const chargeValue = charge.total / 100;
              
              const docMatch = chargeDoc === clientDoc;
              const valueMatch = Math.abs(chargeValue - recValue) < 0.10;
              
              return docMatch && valueMatch;
            });
          }

          // Se encontrou o boleto, atualiza o recebimento
          if (matchedCharge) {
            const boletoData = matchedCharge.payment?.banking_billet;
            
            await prisma.receivable.update({
              where: { id: rec.id },
              data: {
                efiChargeId: matchedCharge.charge_id.toString(),
                boletoUrl: boletoData?.link || null,
                boletoBarcode: boletoData?.barcode || null,
                boletoLine: boletoData?.pix_qrcode || null, // Linha digitável ou PIX
              },
            });
            
            logger.info(`Boleto vinculado: Recebimento ${rec.gestaoClickId} -> Charge ${matchedCharge.charge_id}`);
            stats.updated++;
            
            // Remove da lista para não vincular de novo
            allCharges = allCharges.filter(c => c.charge_id !== matchedCharge.charge_id);
          } else {
            logger.debug(`Boleto não encontrado para recebimento ${rec.gestaoClickId} (${rec.description})`);
            stats.notFound++;
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
   * Busca detalhes de um boleto específico pelo charge_id
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
        status: billet?.status || charge.status,
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
