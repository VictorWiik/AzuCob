import { useState, useEffect } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { EmailTemplate } from '../types'

export default function Templates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [variables, setVariables] = useState<string[]>([])
  
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    htmlContent: '',
    active: true
  })

  useEffect(() => {
    fetchTemplates()
    fetchVariables()
  }, [])

  const fetchTemplates = async () => {
    try {
      const data = await api.getTemplates()
      setTemplates(data || [])
    } catch (error) {
      toast.error('Erro ao carregar templates')
    } finally {
      setLoading(false)
    }
  }

  const fetchVariables = async () => {
    try {
      const data = await api.getAvailableVariables()
      setVariables(data || [])
    } catch (error) {
      console.error('Erro ao carregar variáveis')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingTemplate) {
        await api.updateTemplate(editingTemplate.id, formData)
        toast.success('Template atualizado com sucesso!')
      } else {
        await api.createTemplate(formData)
        toast.success('Template criado com sucesso!')
      }
      
      setShowModal(false)
      resetForm()
      fetchTemplates()
    } catch (error) {
      toast.error('Erro ao salvar template')
    }
  }

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      subject: template.subject,
      htmlContent: template.htmlContent,
      active: template.active
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return
    
    try {
      await api.deleteTemplate(id)
      toast.success('Template excluído com sucesso!')
      fetchTemplates()
    } catch (error) {
      toast.error('Erro ao excluir template')
    }
  }

  const resetForm = () => {
    setEditingTemplate(null)
    setFormData({
      name: '',
      subject: '',
      htmlContent: '',
      active: true
    })
  }

  const openNewModal = () => {
    resetForm()
    setShowModal(true)
  }

  const insertVariable = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      htmlContent: prev.htmlContent + `{{${variable}}}`
    }))
  }

  const defaultTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0066CC; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px 20px; background: #f9f9f9; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    .btn { display: inline-block; background: #0066CC; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; }
    .highlight { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Azuton - Cobrança</h1>
    </div>
    <div class="content">
      <p>Prezado(a) <strong>{{nome}}</strong>,</p>
      
      <p>Identificamos que existe uma pendência financeira em seu cadastro referente à:</p>
      
      <div class="highlight">
        <p><strong>Descrição:</strong> {{descricao}}</p>
        <p><strong>Valor:</strong> {{valor}}</p>
        <p><strong>Vencimento:</strong> {{vencimento}}</p>
        <p><strong>Dias em atraso:</strong> {{dias_atraso}} dias</p>
      </div>
      
      <p>Solicitamos a regularização do débito o mais breve possível para evitar a suspensão dos serviços.</p>
      
      <p>Em anexo, segue o boleto para pagamento e a fatura detalhada.</p>
      
      <p>Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.</p>
      
      <p>Atenciosamente,<br><strong>Equipe Financeira - Azuton</strong></p>
    </div>
    <div class="footer">
      <p>Azuton Tecnologia em Telecomunicações</p>
      <p>www.azuton.com</p>
    </div>
  </div>
</body>
</html>`

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
          <h1 className="text-2xl font-bold text-gray-900">Templates de Email</h1>
          <p className="text-gray-600 mt-1">Gerencie os templates de cobrança por email</p>
        </div>
        <button
          onClick={openNewModal}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Template
        </button>
      </div>

      {/* Variables Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">Variáveis Disponíveis</h3>
        <div className="flex flex-wrap gap-2">
          {variables.map(variable => (
            <span key={variable} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
              {`{{${variable}}}`}
            </span>
          ))}
        </div>
      </div>

      {/* Templates List */}
      <div className="grid gap-6">
        {templates.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500">Nenhum template cadastrado</p>
            <button onClick={openNewModal} className="btn-primary mt-4">
              Criar Primeiro Template
            </button>
          </div>
        ) : (
          templates.map(template => (
            <div key={template.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        template.active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {template.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-1">
                      <span className="font-medium">Assunto:</span> {template.subject}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(template)}
                      className="p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Preview */}
                <div className="mt-4 border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 border-b flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Pré-visualização</span>
                  </div>
                  <div className="p-4 bg-white max-h-64 overflow-auto">
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: template.htmlContent.slice(0, 1000) + '...' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingTemplate ? 'Editar Template' : 'Novo Template'}
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
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Template
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
                  
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-sm font-medium text-gray-700">Template Ativo</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assunto do Email
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Ex: Aviso de Cobrança - {{nome}} - {{valor}}"
                    required
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Conteúdo HTML
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, htmlContent: defaultTemplate })}
                        className="text-sm text-primary hover:text-primary-dark"
                      >
                        Usar Template Padrão
                      </button>
                    </div>
                  </div>
                  
                  {/* Variable Buttons */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    {variables.map(variable => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => insertVariable(variable)}
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs transition-colors"
                      >
                        + {variable}
                      </button>
                    ))}
                  </div>
                  
                  <textarea
                    value={formData.htmlContent}
                    onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                    rows={15}
                    placeholder="Digite o HTML do template..."
                    required
                  />
                </div>
                
                {/* Live Preview */}
                {formData.htmlContent && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pré-visualização
                    </label>
                    <div className="border rounded-lg p-4 bg-gray-50 max-h-64 overflow-auto">
                      <iframe
                        srcDoc={formData.htmlContent}
                        className="w-full h-64 border-0"
                        title="Preview"
                      />
                    </div>
                  </div>
                )}
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
                >
                  {editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
