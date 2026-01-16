import axios, { AxiosInstance } from 'axios';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

interface EfiCharge {
  id: number;
  charge_id?: number;
  total: number;
  status: 'new' | 'waiting' | 'paid' | 'unpaid' | 'canceled' | 'identified' | 'settled' | 'link' | 'expired';
  custom_id?: string | null;
  created_at: string;
  customer?: {
    name: string;
    cpf?: string;
    cnpj?: string;
    email?: string;
    phone_number?: string;
  };
  payment?: {
    payment_method?: string;
    banking_billet?: {
      barcode: string;
      link: string;
      expire_at: string;
      configurations?: {
        days_to_write_off?: number;
        interest_type?: string;
        interest?: number;
        fine?: number;
      };
      pdf?: {
        charge: string;
      };
    };
    pix?: {
      qrcode?: string;
      qrcode_image?: string;
    };
  };
  items?: Array<{
    name: string;
    value: number;
    amount: number;
  }>;
}

interface EfiChargesListResponse {
  code: number;
  data: EfiCharge[];
  params?: {
    begin_date: string;
    end_date: string;
    pagination?: {
      limit: number;
      offset: number;
      page: number;
    };
  };
}

interface EfiChargeDetailResponse {
  code: number;
  data: EfiCharge;
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
   * Endpoint: GET /v1/charges
   * Parâmetros obrigatórios: charge_type, begin_date, end_date
   */
  async getCharges(params: {
    chargeType?: string;       // 'billet', 'card', 'carnet', 'subscription', 'link'
    status?: string;           // 'new', 'waiting', 'paid', 'unpaid', 'canceled', etc
    dateFrom: string;          // YYYY-MM-DD (obrigatório)
    dateTo: string;            // YYYY-MM-DD (obrigatório)
    customerDocument?: string; // CPF ou CNPJ (somente números)
    customId?: string;
    limit?: number;
    page?: number;
  }): Promise<EfiCharge[]> {
    const queryParams = new URLSearchParams();
    
    // Parâmetros obrigatórios
    queryParams.set('charge_type', params.chargeType || 'billet');
    queryParams.set('begin_date', params.dateFrom);
    queryParams.set('end_date', params.dateTo);
    
    // Parâmetros opcionais
    if (params.status) queryParams.set('status', params.status);
    if (params.customerDocument) queryParams.set('customer_document', params.customerDocument.replace(/\D/g, ''));
    if (params.customId) queryParams.set('custom_id', params.customId);
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.page) queryParams.set('page', params.page.toString());

    // Endpoint correto: /v1/charges (plural)
    const url = `/v1/charges?${queryParams.toString()}`;
    
    try {
      const response = await this.request<EfiChargesListResponse>('get', url);
      logger.info(`Efí: Encontrados ${response.data?.length || 0} boletos`);
      return response.data || [];
    } catch (error: any) {
      // Se retornar 404, significa que não encontrou nada
      if (error.response?.status === 404) {
        logger.info('Efí: Nenhum boleto encontrado com os filtros');
        return [];
      }
      throw error;
    }
  }

  /**
   * Busca boletos por CPF/CNPJ do cliente
   * Retorna boletos em aberto (waiting e unpaid)
   */
  async getChargesByDocument(
    document: string,
    dateFrom: string,
    dateTo: string
  ): Promise<EfiCharge[]> {
    const cleanDoc = document.replace(/\D/g, '');
    const allCharges: EfiCharge[] = [];

    // Busca boletos waiting
    try {
      const waitingCharges = await this.getCharges({
        chargeType: 'billet',
        status: 'waiting',
        customerDocument: cleanDoc,
        dateFrom,
        dateTo,
        limit: 100,
      });
      allCharges.push(...waitingCharges);
    } catch (error) {
      logger.warn(`Efí: Erro ao buscar boletos waiting para ${cleanDoc}:`, error);
    }

    // Busca boletos unpaid
    try {
      const unpaidCharges = await this.getCharges({
        chargeType: 'billet',
        status: 'unpaid',
        customerDocument: cleanDoc,
        dateFrom,
        dateTo,
        limit: 100,
      });
      allCharges.push(...unpaidCharges);
    } catch (error) {
      logger.warn(`Efí: Erro ao buscar boletos unpaid para ${cleanDoc}:`, error);
    }

    return allCharges;
  }

  /**
   * Busca detalhes de uma cobrança específica
   */
  async getChargeById(chargeId: number): Promise<EfiCharge | null> {
    try {
      const response = await this.request<EfiChargeDetailResponse>(
        'get',
        `/v1/charge/${chargeId}`
      );
      return response.data;
    } catch (error) {
      logger.warn(`Efí: Boleto ${chargeId} não encontrado`);
      return null;
    }
  }

  /**
   * Baixa/liquida uma cobrança paga
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
   * Reenvia boleto por email
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
