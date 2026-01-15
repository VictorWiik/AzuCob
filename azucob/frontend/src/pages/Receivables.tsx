import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Send,
  CheckCircle,
  Filter,
  Calendar,
  FileBarChart,
  Receipt,
} from 'lucide-react'
import { api } from '../services/api'
import type { Receivable, EmailTemplate } from '../types'
import { useAuthStore } from '../hooks/useAuth'

const formatCurrency = (value: string | number | null | undefined) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (numValue === null || numValue === undefined || isNaN(numValue)) {
    return 'R$ 0,00'
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue)
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR')
}

interface ApiResponse {
  data: Receivable[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export default function Receivables() {
  const [receivables, setReceivables] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [sendingCharge, setSendingCharge] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  
  // Template modal state
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [showTemplateModal, setShowTemplateModal] = useState<string | null>(null)
  
  // Date filter state
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const status = searchParams.get('status') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const dateStart = searchParams.get('dateStart') || ''
  const dateEnd = searchParams.get('dateEnd') || ''

  const loadReceivables = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, limit: 20 }
      if (status) params.status = status
      if (dateStart) params.dateStart = dateStart
      if (dateEnd) params.dateEnd = dateEnd
      
      const data = await api.getReceivables(params as { page?: number; limit?: number; status?: string })
      
      // Normaliza a resposta da API
      if (data && typeof data === 'object') {
        const response = data as unknown as ApiResponse
        setReceivables({
          data: response.data || [],
          pagination: response.pagination || { page: 1, limit: 20, total: 0, pages: 1 }
        })
      } else {
        setReceivables({ data: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 } })
      }
    } catch (error) {
      toast.error('Erro ao carregar contas a receber')
      setReceivables({ data: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 } })
    } finally {
      setLoading(false)
    }
  }, [page, status, dateStart, dateEnd])

  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates()
      setTemplates((data || []).filter((t: EmailTemplate) => t.active || t.isActive))
    } catch (error) {
      console.error('Erro ao carregar templates')
    }
  }

  useEffect(() => {
    loadReceivables()
    loadTemplates()
  }, [loadReceivables])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await api.syncReceivables()
      toast.success(result.message || 'Sincronização concluída')
      loadReceivables()
    } catch (error) {
      toast.error('Erro ao sincronizar contas')
    } finally {
      setSyncing(false)
    }
  }

  const openSendChargeModal = (receivableId: string) => {
    if (templates.length === 0) {
      toast.error('Nenhum template disponível. Crie um template primeiro.')
      return
    }
    setSelectedTemplate(templates[0]?.id || '')
    setShowTemplateModal(receivableId)
  }

  const handleSendCharge = async () => {
    if (!showTemplateModal || !selectedTemplate) return
    
    setSendingCharge(showTemplateModal)
    try {
      const result = await api.sendCharge(showTemplateModal, selectedTemplate)
      toast.success(result.message || 'Cobrança enviada com sucesso!')
      setShowTemplateModal(null)
    } catch (error) {
      toast.error('Erro ao enviar cobrança')
    } finally {
      setSendingCharge(null)
    }
  }

  const handleSettleReceivable = async (id: string, value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    const paymentDate = prompt('Data do pagamento (AAAA-MM-DD):', new Date().toISOString().split('T')[0])
    if (!paymentDate) return

    const paidValue = prompt('Valor pago:', numValue.toString())
    if (!paidValue) return

    try {
      await api.settleReceivable(id, {
        paidValue: parseFloat(paidValue),
        paidAt: paymentDate
      })
      toast.success('Pagamento registrado com sucesso!')
      loadReceivables()
    } catch (error) {
      toast.error('Erro ao registrar pagamento')
    }
  }

  const setFilter = (newStatus: string) => {
    const params = new URLSearchParams(searchParams)
    if (newStatus) {
      params.set('status', newStatus)
    } else {
      params.delete('status')
    }
    params.set('page', '1')
    setSearchParams(params)
  }

  const applyDateFilter = () => {
    const params = new URLSearchParams(searchParams)
    if (startDate) {
      params.set('dateStart', startDate)
    } else {
      params.delete('dateStart')
    }
    if (endDate) {
      params.set('dateEnd', endDate)
    } else {
      params.delete('dateEnd')
    }
    params.set('page', '1')
    setSearchParams(params)
    setShowDateFilter(false)
  }

  const clearDateFilter = () => {
    setStartDate('')
    setEndDate('')
    const params = new URLSearchParams(searchParams)
    params.delete('dateStart')
    params.delete('dateEnd')
    params.set('page', '1')
    setSearchParams(params)
    setShowDateFilter(false)
  }

  const openBoleto = (url: string | null) => {
    if (url) {
      window.open(url, '_blank')
    } else {
      toast.error('Boleto não disponível. Sincronize com o Efí.')
    }
  }

  const openInvoice = (url: string | null) => {
    if (url) {
      window.open(url, '_blank')
    } else {
      toast.error('Fatura não disponível.')
    }
  }

  const statusOptions = [
    { value: '', label: 'Todos', color: 'bg-gray-100 text-gray-600' },
    { value: 'OVERDUE', label: 'Em Atraso', color: 'bg-red-100 text-red-600' },
    { value: 'PENDING', label: 'Pendente', color: 'bg-amber-100 text-amber-600' },
    { value: 'PAID', label: 'Pago', color: 'bg-green-100 text-green-600' },
  ]

  const pagination = receivables?.pagination || { page: 1, limit: 20, total: 0, pages: 1 }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Contas a Receber</h1>
          <p className="text-gray-500 mt-1">Gerenciar cobranças e pagamentos</p>
        </div>
        {user?.role === 'ADMIN' && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar GestãoClick
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-5 h-5 text-gray-400" />
        {statusOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
              status === option.value
                ? option.value === 'OVERDUE'
                  ? 'bg-red-500 text-white'
                  : option.value === 'PENDING'
                  ? 'bg-amber-500 text-white'
                  : option.value === 'PAID'
                  ? 'bg-green-500 text-white'
                  : 'bg-primary text-white'
                : option.color + ' hover:opacity-80'
            }`}
          >
            {option.label}
          </button>
        ))}
        
        {/* Date Filter Button */}
        <div className="relative ml-2">
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
              dateStart || dateEnd
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            {dateStart || dateEnd ? 'Filtro Ativo' : 'Filtrar por Data'}
          </button>
          
          {/* Date Filter Dropdown */}
          {showDateFilter && (
            <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-10 w-72">
              <h4 className="font-medium text-gray-800 mb-3">Filtrar por Vencimento</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Data Inicial</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Data Final</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={clearDateFilter}
                    className="flex-1 px-3 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                  >
                    Limpar
                  </button>
                  <button
                    onClick={applyDateFilter}
                    className="flex-1 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-secondary"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Active date filter indicator */}
        {(dateStart || dateEnd) && (
          <span className="text-sm text-gray-500">
            {dateStart && dateEnd
              ? `${formatDate(dateStart)} - ${formatDate(dateEnd)}`
              : dateStart
              ? `A partir de ${formatDate(dateStart)}`
              : `Até ${formatDate(dateEnd)}`}
          </span>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : !receivables?.data?.length ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400">
            <FileText className="w-12 h-12 mb-4" />
            <p className="text-lg font-medium">Nenhuma conta encontrada</p>
            <p className="text-sm mt-1">
              {status ? 'Tente outro filtro' : 'Sincronize com o GestãoClick'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Cliente
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Descrição
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Vencimento
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Valor
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Status
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receivables.data.map((receivable) => (
                    <tr key={receivable.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <button
                          onClick={() => navigate(`/clients/${receivable.clientId}`)}
                          className="font-medium text-primary hover:underline"
                        >
                          {receivable.client?.name || 'Cliente'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                        {receivable.description}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-gray-800">{formatDate(receivable.dueDate)}</p>
                          {receivable.status === 'OVERDUE' && (
                            <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              {receivable.daysOverdue} dias
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-800">
                        {formatCurrency(receivable.value)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            receivable.status === 'PAID'
                              ? 'bg-green-100 text-green-700'
                              : receivable.status === 'OVERDUE'
                              ? 'bg-red-100 text-red-700'
                              : receivable.status === 'CANCELLED'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {receivable.status === 'PAID'
                            ? 'Pago'
                            : receivable.status === 'OVERDUE'
                            ? 'Em Atraso'
                            : receivable.status === 'CANCELLED'
                            ? 'Cancelado'
                            : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          {/* Botão Ver Boleto */}
                          <button
                            onClick={() => openBoleto(receivable.boletoUrl)}
                            className={`p-2 rounded-lg transition-colors ${
                              receivable.boletoUrl
                                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                            title={receivable.boletoUrl ? 'Ver Boleto' : 'Boleto não disponível'}
                          >
                            <FileBarChart className="w-4 h-4" />
                          </button>
                          
                          {/* Botão Ver Fatura */}
                          <button
                            onClick={() => openInvoice(receivable.invoicePdfUrl)}
                            className={`p-2 rounded-lg transition-colors ${
                              receivable.invoicePdfUrl
                                ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                            title={receivable.invoicePdfUrl ? 'Ver Fatura' : 'Fatura não disponível'}
                          >
                            <Receipt className="w-4 h-4" />
                          </button>
                          
                          {/* Botão Enviar Cobrança */}
                          {(receivable.status === 'OVERDUE' || receivable.status === 'PENDING') && (
                            <button
                              onClick={() => openSendChargeModal(receivable.id)}
                              disabled={sendingCharge === receivable.id}
                              className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                              title="Enviar cobrança"
                            >
                              {sendingCharge === receivable.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          
                          {/* Botão Dar Baixa */}
                          {receivable.status !== 'PAID' && receivable.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleSettleReceivable(receivable.id, receivable.value)}
                              className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                              title="Dar baixa"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Mostrando {(pagination.page - 1) * pagination.limit + 1} a{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
                  de {pagination.total} registros
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const params = new URLSearchParams(searchParams)
                      params.set('page', String(page - 1))
                      setSearchParams(params)
                    }}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      const params = new URLSearchParams(searchParams)
                      params.set('page', String(page + 1))
                      setSearchParams(params)
                    }}
                    disabled={page === pagination.pages}
                    className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Enviar Cobrança</h2>
              <p className="text-gray-500 text-sm mt-1">Selecione o template de email</p>
            </div>
            
            <div className="p-6">
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex justify-end gap-3 p-6 border-t">
              <button
                onClick={() => setShowTemplateModal(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendCharge}
                disabled={!selectedTemplate || sendingCharge !== null}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {sendingCharge ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
