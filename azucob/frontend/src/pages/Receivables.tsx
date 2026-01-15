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
} from 'lucide-react'
import { api } from '../services/api'
import type { Receivable, PaginatedResponse, EmailTemplate } from '../types'
import { useAuthStore } from '../hooks/useAuth'

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR')
}

export default function Receivables() {
  const [receivables, setReceivables] = useState<PaginatedResponse<Receivable> | null>(null)
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

  const status = searchParams.get('status') || ''
  const page = parseInt(searchParams.get('page') || '1')

  const loadReceivables = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getReceivables({ page, limit: 20, status: status || undefined })
      // Garante que data tem a estrutura correta
      if (data && typeof data === 'object') {
        setReceivables({
          data: data.data || [],
          meta: data.meta || { total: 0, page: 1, limit: 20, totalPages: 1 }
        })
      } else {
        setReceivables({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 1 } })
      }
    } catch (error) {
      toast.error('Erro ao carregar contas a receber')
      setReceivables({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 1 } })
    } finally {
      setLoading(false)
    }
  }, [page, status])

  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates()
      setTemplates((data || []).filter((t: EmailTemplate) => t.active))
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

  const handleSettleReceivable = async (id: string, amount: number) => {
    const paymentDate = prompt('Data do pagamento (AAAA-MM-DD):', new Date().toISOString().split('T')[0])
    if (!paymentDate) return

    const paidValue = prompt('Valor pago:', amount.toString())
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

  const statusOptions = [
    { value: '', label: 'Todos', color: 'bg-gray-100 text-gray-600' },
    { value: 'OVERDUE', label: 'Em Atraso', color: 'bg-red-100 text-red-600' },
    { value: 'PENDING', label: 'Pendente', color: 'bg-amber-100 text-amber-600' },
    { value: 'PAID', label: 'Pago', color: 'bg-green-100 text-green-600' },
  ]

  const totalPages = receivables?.meta?.totalPages || 1
  const currentPage = receivables?.meta?.page || 1
  const total = receivables?.meta?.total || 0
  const limit = receivables?.meta?.limit || 20

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
      <div className="flex items-center gap-2 flex-wrap">
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
                        {formatCurrency(receivable.amount)}
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
                        {receivable.status === 'OVERDUE' && (
                          <div className="flex gap-2">
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
                            <button
                              onClick={() => handleSettleReceivable(receivable.id, receivable.amount)}
                              className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                              title="Dar baixa"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {receivable.status === 'PENDING' && (
                          <button
                            onClick={() => handleSettleReceivable(receivable.id, receivable.amount)}
                            className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                            title="Dar baixa"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Mostrando {(currentPage - 1) * limit + 1} a{' '}
                  {Math.min(currentPage * limit, total)}{' '}
                  de {total} registros
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
                    disabled={page === totalPages}
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
