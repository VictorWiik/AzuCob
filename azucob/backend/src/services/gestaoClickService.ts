import axios, { AxiosInstance } from 'axios';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

interface GestaoClickContato {
  contato: {
    tipo_id?: string;
    nome_tipo?: string;
    nome: string;
    contato: string;
    cargo?: string;
    observacao?: string;
  };
}

interface GestaoClickClient {
  id: string;
  nome: string;
  tipo_pessoa: 'PF' | 'PJ' | 'ES';
  cpf?: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  celular?: string;
  ativo: '0' | '1';
  contatos?: GestaoClickContato[];
  enderecos?: Array<{
    endereco: {
      cidade_id?: string;
      nome_cidade?: string;
      estado?: string;
    };
  }>;
}

interface GestaoClickReceivable {
  id: string;
  codigo: string;
  descricao: string;
  valor: string;
  valor_total: string;
  data_vencimento: string;
  data_liquidacao?: string;
  liquidado: '0' | '1';
  cliente_id: string;
  nome_cliente: string;
}

export class GestaoClickService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: config.gestaoClick.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'access-token': config.gestaoClick.accessToken,
        'secret-access-token': config.gestaoClick.secretAccess,
      },
    });

    // Interceptor para logs
    this.api.interceptors.response.use(
      (response) => {
        logger.info('GestaoClick API Response:', {
          url: response.config?.url,
          status: response.status,
        });
        return response;
      },
      (error) => {
        logger.error('GestaoClick API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
        });
        throw error;
      }
    );
  }

  /**
   * Busca todos os clientes do GestãoClick
   */
  async getClients(page = 1, limit = 100): Promise<GestaoClickClient[]> {
    try {
      const response = await this.api.get('/clientes', {
        params: {
          pagina: page,
          limite: limit,
        },
      });
      return response.data.data || [];
    } catch (error) {
      logger.error('Erro ao buscar clientes do GestãoClick:', error);
      throw error;
    }
  }

  /**
   * Busca todas as páginas de clientes
   */
  async getAllClients(): Promise<GestaoClickClient[]> {
    const allClients: GestaoClickClient[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const clients = await this.getClients(page);
      allClients.push(...clients);
      
      if (clients.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return allClients;
  }

  /**
   * Busca um cliente específico
   */
  async getClientById(id: string): Promise<GestaoClickClient | null> {
    try {
      const response = await this.api.get(`/clientes/${id}`);
      return response.data.data;
    } catch (error) {
      logger.error(`Erro ao buscar cliente ${id}:`, error);
      return null;
    }
  }

  /**
   * Busca recebimentos (contas a receber)
   */
  async getReceivables(params?: {
    liquidado?: 'ab' | 'at' | 'pg'; // ab=Em aberto, at=Em atraso, pg=Confirmado
    dataInicio?: string;
    dataFim?: string;
    clienteId?: string;
    page?: number;
  }): Promise<GestaoClickReceivable[]> {
    try {
      const response = await this.api.get('/recebimentos', {
        params: {
          pagina: params?.page || 1,
          limite: 100,
          liquidado: params?.liquidado,
          data_inicio: params?.dataInicio,
          data_fim: params?.dataFim,
          cliente_id: params?.clienteId,
        },
      });
      return response.data.data || [];
    } catch (error) {
      logger.error('Erro ao buscar recebimentos:', error);
      throw error;
    }
  }

  /**
   * Busca recebimentos em atraso (inadimplentes)
   * @param dataInicio - Data inicial (formato YYYY-MM-DD)
   * @param dataFim - Data final (formato YYYY-MM-DD)
   */
  async getOverdueReceivables(dataInicio?: string, dataFim?: string): Promise<GestaoClickReceivable[]> {
    try {
      const allOverdue: GestaoClickReceivable[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.api.get('/recebimentos', {
          params: {
            liquidado: 'at', // at = Em atraso
            pagina: page,
            limite: 100,
            data_inicio: dataInicio,
            data_fim: dataFim,
          },
        });
        
        const receivables = response.data.data || [];
        allOverdue.push(...receivables);
        
        if (receivables.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }

      return allOverdue;
    } catch (error) {
      logger.error('Erro ao buscar inadimplentes:', error);
      throw error;
    }
  }

  /**
   * Dá baixa em um recebimento
   */
  async settleReceivable(id: string, data: {
    dataRecebimento: string;
    valorRecebido: number;
  }): Promise<boolean> {
    try {
      await this.api.put(`/recebimentos/${id}`, {
        liquidado: '1',
        data_liquidacao: data.dataRecebimento,
        valor_total: data.valorRecebido,
      });
      return true;
    } catch (error) {
      logger.error(`Erro ao dar baixa no recebimento ${id}:`, error);
      return false;
    }
  }

  /**
   * Busca a fatura PDF de um recebimento (se disponível)
   */
  async getInvoicePdf(receivableId: string): Promise<Buffer | null> {
    try {
      // Nota: verificar se o GestãoClick tem endpoint para PDF de fatura
      const response = await this.api.get(`/recebimentos/${receivableId}/pdf`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      logger.error(`Erro ao buscar fatura PDF ${receivableId}:`, error);
      return null;
    }
  }

  /**
   * Testa a conexão com a API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.api.get('/clientes', { params: { limite: 1 } });
      return true;
    } catch {
      return false;
    }
  }
}

export const gestaoClickService = new GestaoClickService();
