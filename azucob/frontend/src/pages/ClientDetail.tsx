import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  FileText,
  Plus,
  Trash2,
  Send,
  CheckCircle,
  Loader2,
  User,
  AlertTriangle,
} from 'lucide-react'
import { api } from '../services/api'
import type { Client, Receivable, EmailTemplate } from '../types'

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR')
}

interface AddEmailForm {
  email: string
  name?: string
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [client, setClient] = useState<Client | null>(null)
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddEmail, setShowAddEmail] = useState(false)
  const [addingEmail, setAddingEmail] = useState(false)
  const [sendingCharge, setSendingCharge] = useState<string | null>(null)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [showTemplateModal, setShowTemplateModal] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddEmailForm>()

  const loadClient = async () => {
    if (!id) return
    try {
      const clientData = await api.getClientById(id)
      setClient(clientData)
      if (clientData.receivables) {
        setReceivables(clientData.receivables)
      }
    } catch (error) {
      toast.error('Erro ao carregar cliente')
      navigate('/clients')
    } finally {
      setLoading(false)
    }
  }

  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates()
      setTemplates(data.filter((t: EmailTemplate) => t.active))
    } catch (error) {
      console.error('Erro ao carregar templates')
    }
  }

  useEffect(() => {
    loadClient()
    loadTemplates()
  }, [id])

  const handleAddEmail = async (data: AddEmailForm) => {
    if (!id) return
    setAddingEmail(true)
    try {
      await api.addClientEmail(id, data.email, data.name)
      toast.success('E-mail adicionado com sucesso!')
      reset()
      setShowAddEmail(false)
      loadClient()
    } catch (error) {
      toast.error('Erro ao adicionar e-mail')
    } finally {
      setAddingEmail(false)
    }
  }

  const handleRemoveEmail = async (emailId: string) => {
    if (!id || !confirm('Deseja remover este e-mail?')) return
    try {
      await api.removeClientEmail(id, emailId)
      toast.success('E-mail removido')
      loadClient()
    } catch (error) {
      toast.error('Erro ao remover e-mail')
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

  const handleSettleReceivable = async (receivableId: string, amount: number) => {
    const paymentDate = prompt('Data do pagamento (AAAA-MM-DD):', new Date().toISOString().split('T')[0])
    if (!paymentDate) return

    const paidValue = prompt('Valor pago:', amount.toString())
    if (!paidValue) return

    try {
      await api.settleReceivable(receivableId, {
        paidValue: parseFloat(paidValue),
        paidAt: paymentDate
      })
      toast.success('Pagamento registrado com sucesso!')
      loadClient()
    } catch (error) {
      toast.error('Erro ao registrar pagamento')
    }
  }

  const formatDocument = (doc: string) => {
    if (doc.length === 11) {
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }
    return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!client) {
    return null
  }

  const overdueReceivables = receivables.filter((r) => r.status === 'OVERDUE')
  const pendingReceivables = receivables.filter((r) => r.status === 'PENDING')
  const paidReceivables = receivables.filter((r) => r.status === 'PAID')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/clients')}
          className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{client.name}</h1>
          <p className="text-gray-500">{formatDocument(client.document)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{client.name}</p>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  client.active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {client.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {client.email && (
              <div className="flex items-center gap-3 text-gray-600">
                <Mail className="w-5 h-5 text-gray-400" />
                <span>{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-3 text-gray-600">
                <Phone className="w-5 h-5 text-gray-400" />
                <span>{client.phone}</span>
              </div>
            )}
            {client.city && client.state && (
              <div className="flex items-start gap-3 text-gray-600">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <p className="text-gray-400">
                  {client.city} - {client.state}
                </p>
              </div>
            )}
          </div>

          {/* Additional emails */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">E-mails de Cobrança</h3>
              <button
                onClick={() => setShowAddEmail(!showAddEmail)}
                className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {showAddEmail && (
              <form onSubmit={handleSubmit(handleAddEmail)} className="mb-4 space-y-3">
                <input
                  type="email"
                  placeholder="E-mail"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  {...register('email', {
                    required: 'E-mail é obrigatório',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'E-mail inválido',
                    },
                  })}
                />
                <input
                  type="text"
                  placeholder="Nome do contato (opcional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  {...register('name')}
                />
                <button
                  type="submit"
                  disabled={addingEmail}
                  className="w-full py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  {addingEmail ? 'Adicionando...' : 'Adicionar'}
                </button>
              </form>
            )}

            <div className="space-y-2">
              {client.emails && client.emails.length > 0 ? (
                client.emails.map((emailObj) => (
                  <div
                    key={emailObj.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{emailObj.email}</p>
                      {emailObj.name && (
                        <p className="text-xs text-gray-400">{emailObj.name}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveEmail(emailObj.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 text-center py-2">
                  Nenhum e-mail adicional cadastrado
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Receivables */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{overdueReceivables.length}</p>
              <p className="text-sm text-red-500">Em atraso</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{pendingReceivables.length}</p>
              <p className="text-sm text-amber-500">Pendentes</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{paidReceivables.length}</p>
              <p className="text-sm text-green-500">Pagos</p>
            </div>
          </div>

          {/* Overdue list */}
          {overdueReceivables.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold text-gray-800">Contas em Atraso</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {overdueReceivables.map((receivable) => (
                  <div key={receivable.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{receivable.description}</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Vencimento: {formatDate(receivable.dueDate)} •{' '}
                          <span className="text-red-500 font-medium">
                            {receivable.daysOverdue} dias em atraso
                          </span>
                        </p>
                      </div>
                      <p className="text-lg font-bold text-red-600">
                        {formatCurrency(receivable.amount)}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => openSendChargeModal(receivable.id)}
                        disabled={sendingCharge === receivable.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
                      >
                        {sendingCharge === receivable.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Enviar Cobrança
                      </button>
                      <button
                        onClick={() => handleSettleReceivable(receivable.id, receivable.amount)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Dar Baixa
                      </button>
                      {receivable.efiBoletoUrl && (
                        <a
                          href={receivable.efiBoletoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          Boleto
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All receivables */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Todas as Contas</h3>
            </div>
            {receivables.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                        Descrição
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                        Vencimento
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                        Valor
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {receivables.map((receivable) => (
                      <tr key={receivable.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-800">
                          {receivable.description}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {formatDate(receivable.dueDate)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {formatCurrency(receivable.amount)}
                        </td>
                        <td className="px-4 py-3">
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3" />
                <p>Nenhuma conta a receber encontrada</p>
              </div>
            )}
          </div>
        </div>
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
