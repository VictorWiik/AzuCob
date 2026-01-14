import axios, { AxiosInstance } from 'axios';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

interface EfiCharge {
  charge_id: number;
  total: number;
  status: 'new' | 'waiting' | 'paid' | 'unpaid' | 'canceled' | 'identified';
  custom_id?: string;
  created_at: string;
  expire_at?: string;
  payment?: {
    banking_billet?: {
      barcode: string;
      pix_qrcode?: string;
      link: string;
      pdf?: {
        charge: string;
      };
      expire_at: string;
      status: string;
    };
  };
  items?: Array<{
    name: string;
    value: number;
    amount: number;
  }>;
  customer?: {
    name: string;
    cpf?: string;
    cnpj?: string;
    email?: string;
  };
}

export class EfiService {
  private api: AxiosInstance;
  private accessToken: string = '';
  private tokenExpiresAt: Date = new Date(0);

  constructor() {
    this.api = axios.create({
      baseURL: config.efi.apiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Obtém access token OAuth2
   */
  private async authenticate(): Promise<void> {
    // Se token ainda é válido, não precisa renovar
    if (this.accessToken && this.tokenExpiresAt > new Date()) {
      return;
    }

    try {
      const credentials = Buffer.from(
        `${config.efi.clientId}:${config.efi.clientSecret}`
      ).toString('base64');

      const response = await axios.post(
        `${config.efi.apiUrl}/v1/authorize`,
        { grant_type: 'client_credentials' },
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Token expira em (expires_in - 60) segundos para dar margem
      this.tokenExpiresAt = new Date(
        Date.now() + (response.data.expires_in - 60) * 1000
      );

      logger.info('Efí: Token obtido com sucesso');
    } catch (error) {
      logger.error('Erro ao autenticar no Efí:', error);
      throw error;
    }
  }

  /**
   * Faz uma requisição autenticada
   */
  private async request<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: unknown
  ): Promise<T> {
    await this.authenticate();

    try {
      const response = await this.api.request({
        method,
        url,
        data,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`Efí API Error [${method.toUpperCase()} ${url}]:`, error);
      throw error;
    }
  }

  /**
   * Lista cobranças com filtros
   */
  async getCharges(params?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    customId?: string;
    limit?: number;
    offset?: number;
  }): Promise<EfiCharge[]> {
    const queryParams = new URLSearchParams();
    
    if (params?.status) queryParams.set('status', params.status);
    if (params?.dateFrom) queryParams.set('begin_date', params.dateFrom);
    if (params?.dateTo) queryParams.set('end_date', params.dateTo);
    if (params?.customId) queryParams.set('custom_id', params.customId);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());

    const url = `/v1/charge?${queryParams.toString()}`;
    const response = await this.request<{ data: EfiCharge[] }>('get', url);
    return response.data || [];
  }

  /**
   * Busca detalhes de uma cobrança específica
   */
  async getChargeById(chargeId: number): Promise<EfiCharge | null> {
    try {
      const response = await this.request<{ data: EfiCharge }>(
        'get',
        `/v1/charge/${chargeId}`
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /**
   * Busca cobranças por custom_id (ID do cliente/conta no seu sistema)
   */
  async getChargesByCustomId(customId: string): Promise<EfiCharge[]> {
    return this.getCharges({ customId });
  }

  /**
   * Busca cobranças em aberto (aguardando pagamento)
   */
  async getOpenCharges(): Promise<EfiCharge[]> {
    const waitingCharges = await this.getCharges({ status: 'waiting' });
    const unpaidCharges = await this.getCharges({ status: 'unpaid' });
    return [...waitingCharges, ...unpaidCharges];
  }

  /**
   * Baixa de cobrança paga
   */
  async settleCharge(chargeId: number): Promise<boolean> {
    try {
      await this.request('put', `/v1/charge/${chargeId}/settle`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cancela uma cobrança
   */
  async cancelCharge(chargeId: number): Promise<boolean> {
    try {
      await this.request('put', `/v1/charge/${chargeId}/cancel`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Busca PDF do boleto
   */
  async getBoletoPdf(chargeId: number): Promise<Buffer | null> {
    try {
      const charge = await this.getChargeById(chargeId);
      if (!charge?.payment?.banking_billet?.pdf?.charge) {
        return null;
      }

      const pdfUrl = charge.payment.banking_billet.pdf.charge;
      const response = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      logger.error(`Erro ao buscar PDF do boleto ${chargeId}:`, error);
      return null;
    }
  }

  /**
   * Busca URL do boleto
   */
  async getBoletoUrl(chargeId: number): Promise<string | null> {
    try {
      const charge = await this.getChargeById(chargeId);
      return charge?.payment?.banking_billet?.link || null;
    } catch {
      return null;
    }
  }

  /**
   * Reenvia boleto por email (usando API do Efí)
   */
  async resendBoletoEmail(chargeId: number, email: string): Promise<boolean> {
    try {
      await this.request('post', `/v1/charge/${chargeId}/billet/resend`, {
        email,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Testa conexão com a API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      return true;
    } catch {
      return false;
    }
  }
}

export const efiService = new EfiService();
