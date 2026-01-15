import { useState, useEffect } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { ChargeRule, EmailTemplate } from '../types'

export default function Rules() {
  const [rules, setRules] = useState<ChargeRule[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRule, setEditingRule] = useState<ChargeRule | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    daysOverdue: 3,
    templateId: '',
    isActive: true,
    sendBoleto: true,
    sendInvoice: true
  })

  useEffect(() => {
    fetchRules()
    fetchTemplates()
  }, [])

  const fetchRules = async () => {
    try {
      const data = await api.getRules()
      setRules(data || [])
    } catch (error) {
      toast.error('Erro ao carregar regras')
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const data = await api.getTemplates()
      const templateList = data || []
      setTemplates(templateList.filter((t: EmailTemplate) => t.isActive))
    } catch (error) {
      console.error('Erro ao carregar templates')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingRule) {
        await api.updateRule(editingRule.id, formData)
        toast.success('Regra atualizada com sucesso!')
      } else {
        await api.createRule(formData)
        toast.success('Regra criada com sucesso!')
      }
      
      setShowModal(false)
      resetForm()
      fetchRules()
    } catch (error) {
      toast.error('Erro ao salvar regra')
    }
  }

  const handleEdit = (rule: ChargeRule) => {
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      daysOverdue: rule.daysOverdue,
      templateId: rule.templateId,
      isActive: rule.isActive,
      sendBoleto: rule.sendBoleto,
      sendInvoice: rule.sendInvoice
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta regra?')) return
    
    try {
      await api.deleteRule(id)
      toast.success('Regra excluída com sucesso!')
      fetchRules()
    } catch (error) {
      toast.error('Erro ao excluir regra')
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await api.toggleRuleActive(id)
      toast.success('Status alterado com sucesso!')
      fetchRules()
    } catch (error) {
      toast.error('Erro ao alterar status')
    }
  }

  const resetForm = () => {
    setEditingRule(null)
    setFormData({
      name: '',
      daysOverdue: 3,
      templateId: '',
      isActive: true,
      sendBoleto: true,
      sendInvoice: true
    })
  }

  const openNewModal = () => {
    resetForm()
    setShowModal(true)
  }

  const getTemplateName = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    return template?.name || 'N/A'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regras de Cobrança</h1>
          <p className="text-gray-600 mt-1">Configure as regras automáticas de cobrança por dias de atraso</p>
        </div>
        <button
          onClick={openNewModal}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Regra
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-semibold text-amber-800">Como funcionam as regras</h3>
            <p className="text-amber-700 text-sm mt-1">
              As regras de cobrança são executadas automaticamente todos os dias úteis às 9h. 
              Quando uma conta a receber atinge o número de dias de atraso configurado, 
              o sistema envia automaticamente o email de cobrança com o template selecionado.
            </p>
          </div>
        </div>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500 mb-4">Nenhuma regra de cobrança cadastrada</p>
          <button onClick={openNewModal} className="btn-primary">
            Criar Primeira Regra
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Regra
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dias de Atraso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Anexos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rules.sort((a, b) => a.daysOverdue - b.daysOverdue).map(rule => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{rule.name}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="bg-primary/10 text-primary font-bold px-3 py-1 rounded-full">
                        D+{rule.daysOverdue}
                      </span>
                      <span className="text-gray-500 text-sm">
                        ({rule.daysOverdue} {rule.daysOverdue === 1 ? 'dia' : 'dias'})
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {getTemplateName(rule.templateId)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      {rule.sendBoleto && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          Boleto
                        </span>
                      )}
                      {rule.sendInvoice && (
                        <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                          Fatura
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggle(rule.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        rule.isActive ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          rule.isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Suggested Rules */}
      {rules.length < 4 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Regras Sugeridas</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { days: 3, desc: 'Lembrete inicial' },
              { days: 7, desc: 'Segunda notificação' },
              { days: 15, desc: 'Aviso de suspensão' },
              { days: 30, desc: 'Último aviso' }
            ].filter(s => !rules.some(r => r.daysOverdue === s.days)).map(suggestion => (
              <div
                key={suggestion.days}
                className="border border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors"
                onClick={() => {
                  setFormData({
                    name: `Cobrança D+${suggestion.days}`,
                    daysOverdue: suggestion.days,
                    templateId: templates[0]?.id || '',
                    isActive: true,
                    sendBoleto: true,
                    sendInvoice: true
                  })
                  setShowModal(true)
                }}
              >
                <span className="text-2xl font-bold text-primary">D+{suggestion.days}</span>
                <p className="text-sm text-gray-600 mt-1">{suggestion.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRule ? 'Editar Regra' : 'Nova Regra de Cobrança'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Regra
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Ex: Cobrança D+7"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dias de Atraso para Disparo
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={formData.daysOverdue}
                      onChange={(e) => setFormData({ ...formData, daysOverdue: parseInt(e.target.value) })}
                      className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                    <span className="text-gray-600">dias após o vencimento</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template de Email
                  </label>
                  <select
                    value={formData.templateId}
                    onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    <option value="">Selecione um template</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  {templates.length === 0 && (
                    <p className="text-sm text-amber-600 mt-1">
                      Nenhum template disponível. Crie um template primeiro.
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Anexos do Email
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.sendBoleto}
                        onChange={(e) => setFormData({ ...formData, sendBoleto: e.target.checked })}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <div>
                        <span className="font-medium text-gray-900">Boleto Bancário</span>
                        <p className="text-sm text-gray-500">Anexar PDF do boleto do Efí Bank</p>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.sendInvoice}
                        onChange={(e) => setFormData({ ...formData, sendInvoice: e.target.checked })}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <div>
                        <span className="font-medium text-gray-900">Fatura</span>
                        <p className="text-sm text-gray-500">Anexar PDF da fatura do GestãoClick</p>
                      </div>
                    </label>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium text-gray-900">Regra Ativa</span>
                    <p className="text-sm text-gray-500">Ativar/desativar esta regra de cobrança</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.isActive ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={templates.length === 0}
                >
                  {editingRule ? 'Salvar Alterações' : 'Criar Regra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
