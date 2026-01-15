export interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'USER'
}

export interface Client {
  id: string
  gestaoClickId: string
  name: string
  document: string
  documentType?: string
  primaryEmail: string | null
  phone: string | null
  city: string | null
  state: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  additionalEmails?: ClientEmail[]
  receivables?: Receivable[]
}

export interface ClientEmail {
  id: string
  clientId: string
  email: string
  name: string | null
  createdAt: string
}

export interface Receivable {
  id: string
  gestaoClickId: string
  efiChargeId: string | null
  clientId: string
  description: string
  value: string | number // Pode vir como string da API
  dueDate: string
  status: 'PENDING' | 'OVERDUE' | 'PAID' | 'CANCELLED'
  invoicePdfUrl: string | null
  boletoUrl: string | null
  boletoBarcode: string | null
  boletoLine: string | null
  daysOverdue: number
  paidAt: string | null
  paidValue: string | number | null
  syncedAt: string
  createdAt: string
  updatedAt: string
  client?: {
    id: string
    name: string
    document: string
    primaryEmail: string | null
  }
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  htmlContent: string
  isActive?: boolean
  active?: boolean
  createdAt: string
  updatedAt: string
}

export interface ChargeRule {
  id: string
  name: string
  daysOverdue: number
  templateId: string
  isActive: boolean
  sendBoleto: boolean
  sendInvoice: boolean
  createdAt: string
  updatedAt: string
  template?: EmailTemplate
}

export interface SentEmail {
  id: string
  clientId: string
  receivableId: string | null
  templateId: string | null
  toEmails: string[]
  subject: string
  body: string
  attachments: string[]
  status: 'SENT' | 'FAILED' | 'PENDING'
  errorMessage: string | null
  sentAt: string | null
  createdAt: string
  receivable?: Receivable
  template?: EmailTemplate
  client?: Client
}

export interface DashboardSummary {
  totalClients: number
  totalOverdue: number
  totalOverdueAmount: number
  overdueLastWeek: number
  overdueLastMonth: number
  emailsSentToday: number
  emailsSentThisWeek: number
  paidThisMonth: number
  paidAmountThisMonth: number
}

export interface TopDebtor {
  clientId: string
  clientName: string
  totalAmount: number
  receivablesCount: number
  oldestDueDate: string
}

export interface RecentCharge {
  id: string
  clientName: string
  amount: number
  sentAt: string
  status: string
}

export interface IntegrationStatus {
  gestaoClick: {
    connected: boolean
    lastSync: string | null
  }
  efiBanco: {
    connected: boolean
    lastSync: string | null
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  meta?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  pagination?: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface ApiError {
  message: string
  error?: string
}
