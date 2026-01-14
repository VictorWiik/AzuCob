import { useState, useEffect } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '../hooks/useAuth'

interface IntegrationStatus {
  gestaoClick: boolean
  efi: boolean
  resend: boolean
}

interface SyncStatus {
  lastClientSync: string | null
  lastReceivableSync: string | null
  lastEfiSync: string | null
}

export default function Settings() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('integrations')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>({
    gestaoClick: false,
    efi: false,
    resend: false
  })
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastClientSync: null,
    lastReceivableSync: null,
    lastEfiSync: null
  })

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await api.get('/dashboard/integration-status')
      setIntegrationStatus(response.data.integrations || {
        gestaoClick: false,
        efi: false,
        resend: false
      })
      setSyncStatus(response.data.sync || {
        lastClientSync: null,
        lastReceivableSync: null,
        lastEfiSync: null
      })
    } catch (error) {
      console.error('Erro ao carregar status')
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async (type: 'clients' | 'receivables' | 'efi' | 'full') => {
    setSyncing(type)
    
    try {
      const endpoint = type === 'full' ? '/sync/full' : `/sync/${type}`
      await api.post(endpoint)
      toast.success(
        type === 'full' 
          ? 'Sincronização completa realizada!' 
          : `Sincronização de ${type === 'clients' ? 'clientes' : type === 'receivables' ? 'contas' : 'Efí'} realizada!`
      )
      fetchStatus()
    } catch (error) {
      toast.error('Erro ao sincronizar')
    } finally {
      setSyncing(null)
    }
  }

  const handleProcessCharges = async () => {
    if (!confirm('Deseja executar o processamento de cobranças agora? Isso enviará emails para todos os clientes elegíveis.')) {
      return
    }
    
    setSyncing('charges')
    
    try {
      const response = await api.post('/charges/process')
      toast.success(`Processamento concluído! ${response.data.sent || 0} emails enviados.`)
    } catch (error) {
      toast.error('Erro ao processar cobranças')
    } finally {
      setSyncing(null)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca'
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(dateStr))
  }

  const tabs = [
    { id: 'integrations', label: 'Integrações', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
    { id: 'sync', label: 'Sincronização', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
    { id: 'schedule', label: 'Agendamentos', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'account', label: 'Minha Conta', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' }
  ]

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-600 mt-1">Gerencie as configurações do sistema</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <nav className="flex -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Status das Integrações</h3>
              
              <div className="grid gap-4">
                {/* GestãoClick */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">GestãoClick</h4>
                      <p className="text-sm text-gray-500">ERP - Clientes e Contas a Receber</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                      integrationStatus.gestaoClick 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        integrationStatus.gestaoClick ? 'bg-green-500' : 'bg-red-500'
                      }`}></span>
                      {integrationStatus.gestaoClick ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                </div>

                {/* Efí Bank */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Efí Bank</h4>
                      <p className="text-sm text-gray-500">Banco - Boletos e Pagamentos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                      integrationStatus.efi 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        integrationStatus.efi ? 'bg-green-500' : 'bg-red-500'
                      }`}></span>
                      {integrationStatus.efi ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                </div>

                {/* Resend */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Resend</h4>
                      <p className="text-sm text-gray-500">Serviço de Envio de Emails</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                      integrationStatus.resend 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        integrationStatus.resend ? 'bg-green-500' : 'bg-red-500'
                      }`}></span>
                      {integrationStatus.resend ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <h4 className="font-semibold text-blue-800 mb-2">Configuração de Integrações</h4>
                <p className="text-blue-700 text-sm">
                  As credenciais de integração são configuradas através de variáveis de ambiente no Railway. 
                  Para alterar as configurações, acesse o painel do Railway e atualize as variáveis de ambiente.
                </p>
              </div>
            </div>
          )}

          {/* Sync Tab */}
          {activeTab === 'sync' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Sincronização Manual</h3>
              
              <div className="grid gap-4">
                {/* Sync Clients */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-900">Sincronizar Clientes</h4>
                    <p className="text-sm text-gray-500">
                      Última sincronização: {formatDate(syncStatus.lastClientSync)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSync('clients')}
                    disabled={syncing !== null}
                    className="btn-secondary flex items-center gap-2"
                  >
                    {syncing === 'clients' ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    Sincronizar
                  </button>
                </div>

                {/* Sync Receivables */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-900">Sincronizar Contas a Receber</h4>
                    <p className="text-sm text-gray-500">
                      Última sincronização: {formatDate(syncStatus.lastReceivableSync)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSync('receivables')}
                    disabled={syncing !== null}
                    className="btn-secondary flex items-center gap-2"
                  >
                    {syncing === 'receivables' ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    Sincronizar
                  </button>
                </div>

                {/* Sync Efí */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-900">Sincronizar Efí Bank</h4>
                    <p className="text-sm text-gray-500">
                      Última sincronização: {formatDate(syncStatus.lastEfiSync)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSync('efi')}
                    disabled={syncing !== null}
                    className="btn-secondary flex items-center gap-2"
                  >
                    {syncing === 'efi' ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    Sincronizar
                  </button>
                </div>
              </div>

              {/* Full Sync */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-900">Sincronização Completa</h4>
                    <p className="text-sm text-gray-500">Sincroniza todas as fontes de dados de uma vez</p>
                  </div>
                  <button
                    onClick={() => handleSync('full')}
                    disabled={syncing !== null}
                    className="btn-primary flex items-center gap-2"
                  >
                    {syncing === 'full' ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    Sincronizar Tudo
                  </button>
                </div>
              </div>

              {/* Process Charges */}
              {user?.role === 'ADMIN' && (
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-amber-800">Processar Cobranças</h4>
                      <p className="text-sm text-amber-700">
                        Executa manualmente o processamento de cobranças automáticas
                      </p>
                    </div>
                    <button
                      onClick={handleProcessCharges}
                      disabled={syncing !== null}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      {syncing === 'charges' ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                      Executar Agora
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Agendamentos Automáticos</h3>
              
              <div className="grid gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Sincronização GestãoClick</h4>
                      <p className="text-sm text-gray-500">Clientes e Contas a Receber</p>
                    </div>
                  </div>
                  <div className="ml-13 pl-10">
                    <span className="inline-flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Todos os dias às 6:00
                    </span>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Sincronização Efí Bank</h4>
                      <p className="text-sm text-gray-500">Boletos e Status de Pagamento</p>
                    </div>
                  </div>
                  <div className="ml-13 pl-10">
                    <span className="inline-flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      A cada 4 horas
                    </span>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Envio de Cobranças</h4>
                      <p className="text-sm text-gray-500">Emails automáticos de cobrança</p>
                    </div>
                  </div>
                  <div className="ml-13 pl-10">
                    <span className="inline-flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Segunda a Sexta às 9:00
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border rounded-lg p-4">
                <h4 className="font-semibold text-gray-700 mb-2">Observações</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Os agendamentos são executados automaticamente pelo servidor</li>
                  <li>• Os horários estão no fuso horário do servidor (UTC-3)</li>
                  <li>• Cobranças automáticas só são enviadas em dias úteis</li>
                  <li>• Cada regra de cobrança envia apenas um email por conta</li>
                </ul>
              </div>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Minha Conta</h3>
              
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-gray-900">{user?.name}</h4>
                    <p className="text-gray-600">{user?.email}</p>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                      user?.role === 'ADMIN' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user?.role === 'ADMIN' ? 'Administrador' : 'Usuário'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="font-semibold text-gray-900 mb-4">Informações do Sistema</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">Versão</span>
                    <p className="font-medium text-gray-900">1.0.0</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500">Ambiente</span>
                    <p className="font-medium text-gray-900">Produção</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="font-semibold text-gray-900 mb-4">Suporte</h4>
                <p className="text-gray-600 text-sm mb-4">
                  Para suporte técnico ou dúvidas sobre o sistema, entre em contato com a equipe de TI.
                </p>
                <a 
                  href="mailto:suporte@azuton.com" 
                  className="inline-flex items-center gap-2 text-primary hover:text-primary-dark transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  suporte@azuton.com
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
