import axios, { AxiosInstance } from 'axios';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

interface GestaoClickClient {
  id: number;
  nome: string;
  cpf_cnpj: string;
  tipo_pessoa: 'F' | 'J';
  email: string;
  telefone?: string;
  celular?: string;
  cidade?: string;
  uf?: string;
  situacao: 'A' | 'I';
}

interface GestaoClickReceivable {
  id: number;
  cliente_id: number;
  descricao: string;
  valor: number;
  data_vencimento: string;
  situacao: 'A' | 'R' | 'C'; // A=Aberto, R=Recebido, C=Cancelado
  data_recebimento?: string;
  valor_recebido?: number;
  boleto_url?: string;
  fatura_url?: string;
}

export class GestaoClickService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: config.gestaoClick.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': config.gestaoClick.accessToken,
        'Secret-Access-Token': config.gestaoClick.secretAccess,
      },
    });

    // Interceptor para logs
    this.api.interceptors.response.use(
      (response) => response,
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
  async getClientById(id: number): Promise<GestaoClickClient | null> {
    try {
      const response = await this.api.get(`/clientes/${id}`);
      return response.data.data;
    } catch (error) {
      logger.error(`Erro ao buscar cliente ${id}:`, error);
      return null;
    }
  }

  /**
   * Busca contas a receber (com filtro de inadimplentes)
   */
  async getReceivables(params?: {
    situacao?: 'A' | 'R' | 'C';
    dataInicio?: string;
    dataFim?: string;
    clienteId?: number;
    page?: number;
  }): Promise<GestaoClickReceivable[]> {
    try {
      const response = await this.api.get('/contas_receber', {
        params: {
          pagina: params?.page || 1,
          limite: 100,
          situacao: params?.situacao,
          data_vencimento_inicio: params?.dataInicio,
          data_vencimento_fim: params?.dataFim,
          cliente_id: params?.clienteId,
        },
      });
      return response.data.data || [];
    } catch (error) {
      logger.error('Erro ao buscar contas a receber:', error);
      throw error;
    }
  }

  /**
   * Busca contas em aberto (inadimplentes)
   */
  async getOverdueReceivables(): Promise<GestaoClickReceivable[]> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const response = await this.api.get('/contas_receber', {
        params: {
          situacao: 'A', // Aberto
          data_vencimento_fim: today, // Vencidas até hoje
          limite: 500,
        },
      });
      return response.data.data || [];
    } catch (error) {
      logger.error('Erro ao buscar inadimplentes:', error);
      throw error;
    }
  }

  /**
   * Dá baixa em uma conta a receber
   */
  async settleReceivable(id: number, data: {
    dataRecebimento: string;
    valorRecebido: number;
  }): Promise<boolean> {
    try {
      await this.api.put(`/contas_receber/${id}`, {
        situacao: 'R',
        data_recebimento: data.dataRecebimento,
        valor_recebido: data.valorRecebido,
      });
      return true;
    } catch (error) {
      logger.error(`Erro ao dar baixa na conta ${id}:`, error);
      return false;
    }
  }

  /**
   * Busca a fatura PDF de uma conta
   */
  async getInvoicePdf(receivableId: number): Promise<Buffer | null> {
    try {
      const response = await this.api.get(`/contas_receber/${receivableId}/fatura`, {
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
