import axios from 'axios'
import type {
  Client,
  Receivable,
  EmailTemplate,
  ChargeRule,
  DashboardSummary,
  PaginatedResponse,
  User,
} from '../types'

// Detecta automaticamente a URL da API baseado no ambiente
const getApiUrl = () => {
  // Em produção (Railway), usa a URL do backend
  if (window.location.hostname.includes('railway.app')) {
    return 'https://azucob-production.up.railway.app/api'
  }
  
  // Em desenvolvimento local
  return 'http://localhost:3000/api'
}

const API_URL = getApiUrl()

console.log('API URL:', API_URL) // Debug temporário

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor para adicionar token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('azucob_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor para tratar erros
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('azucob_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const api = {
  // Auth
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password })
    return response.data
  },

  register: async (name: string, email: string, password: string) => {
    const response = await apiClient.post('/auth/register', { name, email, password })
    return response.data
  },

  me: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me')
    return response.data
  },

  // Dashboard
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const response = await apiClient.get('/dashboard/summary')
    return response.data
  },

  getTopDebtors: async () => {
    const response = await apiClient.get('/dashboard/top-debtors')
    return response.data
  },

  getRecentCharges: async () => {
    const response = await apiClient.get('/dashboard/recent-charges')
    return response.data
  },

  getIntegrationStatus: async () => {
    const response = await apiClient.get('/dashboard/integration-status')
    return response.data
  },

  // Clients
  getClients: async (params?: {
    page?: number
    limit?: number
    search?: string
  }): Promise<PaginatedResponse<Client>> => {
    const response = await apiClient.get('/clients', { params })
    return response.data
  },

  getOverdueClients: async (): Promise<Client[]> => {
    const response = await apiClient.get('/clients/overdue')
    return response.data
  },

  getClientById: async (id: string): Promise<Client> => {
    const response = await apiClient.get(`/clients/${id}`)
    return response.data
  },

  addClientEmail: async (clientId: string, email: string, name?: string) => {
    const response = await apiClient.post(`/clients/${clientId}/emails`, {
      email,
      name,
    })
    return response.data
  },

  removeClientEmail: async (clientId: string, emailId: string) => {
    await apiClient.delete(`/clients/${clientId}/emails/${emailId}`)
  },

  // Receivables
  getReceivables: async (params?: {
    page?: number
    limit?: number
    status?: string
  }): Promise<PaginatedResponse<Receivable>> => {
    const response = await apiClient.get('/receivables', { params })
    return response.data
  },

  getOverdueReceivables: async (): Promise<Receivable[]> => {
    const response = await apiClient.get('/receivables/overdue')
    return response.data
  },

  getReceivableById: async (id: string): Promise<Receivable> => {
    const response = await apiClient.get(`/receivables/${id}`)
    return response.data
  },

  settleReceivable: async (
    id: string,
    data: { paidValue: number; paidAt: string }
  ) => {
    const response = await apiClient.post(`/receivables/${id}/settle`, data)
    return response.data
  },

  sendCharge: async (id: string, templateId: string) => {
    const response = await apiClient.post(`/receivables/${id}/charge`, {
      templateId,
    })
    return response.data
  },

  // Templates
  getTemplates: async (): Promise<EmailTemplate[]> => {
    const response = await apiClient.get('/templates')
    return response.data
  },

  getTemplateById: async (id: string): Promise<EmailTemplate> => {
    const response = await apiClient.get(`/templates/${id}`)
    return response.data
  },

  createTemplate: async (data: Partial<EmailTemplate>) => {
    const response = await apiClient.post('/templates', data)
    return response.data
  },

  updateTemplate: async (id: string, data: Partial<EmailTemplate>) => {
    const response = await apiClient.put(`/templates/${id}`, data)
    return response.data
  },

  deleteTemplate: async (id: string) => {
    await apiClient.delete(`/templates/${id}`)
  },

  getAvailableVariables: async () => {
    const response = await apiClient.get('/templates/variables')
    return response.data
  },

  // Rules
  getRules: async (): Promise<ChargeRule[]> => {
    const response = await apiClient.get('/rules')
    return response.data
  },

  getRuleById: async (id: string): Promise<ChargeRule> => {
    const response = await apiClient.get(`/rules/${id}`)
    return response.data
  },

  createRule: async (data: Partial<ChargeRule>) => {
    const response = await apiClient.post('/rules', data)
    return response.data
  },

  updateRule: async (id: string, data: Partial<ChargeRule>) => {
    const response = await apiClient.put(`/rules/${id}`, data)
    return response.data
  },

  deleteRule: async (id: string) => {
    await apiClient.delete(`/rules/${id}`)
  },

  toggleRuleActive: async (id: string) => {
    const response = await apiClient.post(`/rules/${id}/toggle`)
    return response.data
  },

  // Sync
  syncClients: async () => {
    const response = await apiClient.post('/sync/clients')
    return response.data
  },

  syncReceivables: async (params?: { filterDays?: string; startDate?: string }) => {
    const response = await apiClient.post('/sync/receivables', params)
    return response.data
  },

  syncEfi: async () => {
    const response = await apiClient.post('/sync/efi')
    return response.data
  },

  fullSync: async (params?: { filterDays?: string; startDate?: string }) => {
    const response = await apiClient.post('/sync/full', params)
    return response.data
  },

  // Charges
  processCharges: async () => {
    const response = await apiClient.post('/charges/process')
    return response.data
  },
}
