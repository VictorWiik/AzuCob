import { useAuthStore } from '../hooks/useAuth'
import type {
  User,
  Client,
  ClientEmail,
  Receivable,
  EmailTemplate,
  ChargeRule,
  DashboardSummary,
  TopDebtor,
  RecentCharge,
  IntegrationStatus,
  PaginatedResponse,
} from '../types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

class ApiService {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    
    const token = useAuthStore.getState().token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    return headers
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    })

    if (response.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }))
      throw new Error(error.message || 'Erro na requisição')
    }

    return response.json()
  }

  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async register(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
  }

  // Dashboard
  async getDashboardSummary(): Promise<DashboardSummary> {
    return this.request('/dashboard/summary')
  }

  async getTopDebtors(): Promise<TopDebtor[]> {
    return this.request('/dashboard/top-debtors')
  }

  async getRecentCharges(): Promise<RecentCharge[]> {
    return this.request('/dashboard/recent-charges')
  }

  async getIntegrationStatus(): Promise<IntegrationStatus> {
    return this.request('/dashboard/integration-status')
  }

  // Clients
  async getClients(params?: {
    page?: number
    limit?: number
    search?: string
  }): Promise<PaginatedResponse<Client>> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.search) searchParams.set('search', params.search)
    
    return this.request(`/clients?${searchParams.toString()}`)
  }

  async getOverdueClients(): Promise<Client[]> {
    return this.request('/clients/overdue')
  }

  async getClient(id: string): Promise<Client> {
    return this.request(`/clients/${id}`)
  }

  async addClientEmail(clientId: string, email: string, name?: string): Promise<ClientEmail> {
    return this.request(`/clients/${clientId}/emails`, {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    })
  }

  async removeClientEmail(clientId: string, emailId: string): Promise<void> {
    return this.request(`/clients/${clientId}/emails/${emailId}`, {
      method: 'DELETE',
    })
  }

  // Receivables
  async getReceivables(params?: {
    page?: number
    limit?: number
    status?: string
    clientId?: string
  }): Promise<PaginatedResponse<Receivable>> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.status) searchParams.set('status', params.status)
    if (params?.clientId) searchParams.set('clientId', params.clientId)
    
    return this.request(`/receivables?${searchParams.toString()}`)
  }

  async getOverdueReceivables(): Promise<Receivable[]> {
    return this.request('/receivables/overdue')
  }

  async getReceivable(id: string): Promise<Receivable> {
    return this.request(`/receivables/${id}`)
  }

  async settleReceivable(id: string, paymentDate: string, paymentMethod?: string): Promise<Receivable> {
    return this.request(`/receivables/${id}/settle`, {
      method: 'POST',
      body: JSON.stringify({ paymentDate, paymentMethod }),
    })
  }

  async sendCharge(id: string, templateId?: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/receivables/${id}/charge`, {
      method: 'POST',
      body: JSON.stringify({ templateId }),
    })
  }

  // Templates
  async getTemplates(): Promise<EmailTemplate[]> {
    return this.request('/templates')
  }

  async getTemplate(id: string): Promise<EmailTemplate> {
    return this.request(`/templates/${id}`)
  }

  async createTemplate(data: Partial<EmailTemplate>): Promise<EmailTemplate> {
    return this.request('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateTemplate(id: string, data: Partial<EmailTemplate>): Promise<EmailTemplate> {
    return this.request(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteTemplate(id: string): Promise<void> {
    return this.request(`/templates/${id}`, {
      method: 'DELETE',
    })
  }

  async getTemplateVariables(): Promise<string[]> {
    return this.request('/templates/variables')
  }

  // Rules
  async getRules(): Promise<ChargeRule[]> {
    return this.request('/rules')
  }

  async getRule(id: string): Promise<ChargeRule> {
    return this.request(`/rules/${id}`)
  }

  async createRule(data: Partial<ChargeRule>): Promise<ChargeRule> {
    return this.request('/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateRule(id: string, data: Partial<ChargeRule>): Promise<ChargeRule> {
    return this.request(`/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteRule(id: string): Promise<void> {
    return this.request(`/rules/${id}`, {
      method: 'DELETE',
    })
  }

  async toggleRule(id: string): Promise<ChargeRule> {
    return this.request(`/rules/${id}/toggle`, {
      method: 'POST',
    })
  }

  // Sync (Admin)
  async syncClients(): Promise<{ message: string; synced: number }> {
    return this.request('/sync/clients', { method: 'POST' })
  }

  async syncReceivables(): Promise<{ message: string; synced: number }> {
    return this.request('/sync/receivables', { method: 'POST' })
  }

  async syncEfi(): Promise<{ message: string }> {
    return this.request('/sync/efi', { method: 'POST' })
  }

  async fullSync(): Promise<{ message: string }> {
    return this.request('/sync/full', { method: 'POST' })
  }

  async processCharges(): Promise<{ message: string; processed: number }> {
    return this.request('/charges/process', { method: 'POST' })
  }
}

export const api = new ApiService()
