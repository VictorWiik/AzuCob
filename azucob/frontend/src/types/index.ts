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
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  emails: ClientEmail[]
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
  clientId: string
  description: string
  amount: number
  dueDate: string
  status: 'PENDING' | 'OVERDUE' | 'PAID' | 'CANCELLED'
  efiChargeId: string | null
  efiBoletoUrl: string | null
  invoiceUrl: string | null
  daysOverdue: number
  createdAt: string
  updatedAt: string
  client?: Client
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  htmlContent: string
  isDefault: boolean
  active: boolean
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
  template?: Template
}

export interface Template {
  id: string
  name: string
  subject: string
  htmlContent: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface SentEmail {
  id: string
  receivableId: string
  templateId: string
  recipients: string[]
  subject: string
  sentAt: string
  status: 'SENT' | 'FAILED' | 'PENDING'
  errorMessage: string | null
  receivable?: Receivable
  template?: EmailTemplate
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
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface ApiError {
  message: string
  error?: string
}
