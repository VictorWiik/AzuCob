import { useState } from 'react'
import toast from 'react-hot-toast'
import {
  RefreshCw,
  Database,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { api } from '../services/api'
import { useAuthStore } from '../hooks/useAuth'

type FilterOption = '30' | '60' | '90' | 'custom'

export default function Settings() {
  const [syncingClients, setSyncingClients] = useState(false)
  const [syncingReceivables, setSyncingReceivables] = useState(false)
  const [syncingEfi, setSyncingEfi] = useState(false)
  const [syncingFull, setSyncingFull] = useState(false)
  
  const [filterOption, setFilterOption] = useState<FilterOption>('60')
  const [customDate, setCustomDate] = useState('')
  
  const { user } = useAuthStore()

  const getFilterParams = () => {
    if (filterOption === 'custom' && customDate) {
      return { startDate: customDate }
    }
    return { filterDays: filterOption }
  }

  const handleSyncClients = async () => {
    setSyncingClients(true)
    try {
      const result = await api.syncClients()
      toast.success(`${result.message} - Criados: ${result.result.created}, Atualizados: ${result.result.updated}`)
    } catch (error) {
      toast.error('Erro ao sincronizar clientes')
    } finally {
      setSyncingClients(false)
    }
  }

  const handleSyncReceivables = async () => {
    if (filterOption === 'custom' && !customDate) {
      toast.error('Selecione uma data inicial')
      return
    }
    
    setSyncingReceivables(true)
    try {
      const result = await api.syncReceivables(getFilterParams())
      toast.success(`${result.message} - Criados: ${result.result.created}, Atualizados: ${result.result.updated}`)
    } catch (error) {
      toast.error('Erro ao sincronizar contas a receber')
    } finally {
      setSyncingReceivables(false)
    }
  }

  const handleSyncEfi = async () => {
    setSyncingEfi(true)
    try {
      const result = await api.syncEfi()
      toast.success(result.message)
    } catch (error) {
      toast.error('Erro ao sincronizar boletos Efí')
    } finally {
      setSyncingEfi(false)
    }
  }

  const handleFullSync = async () => {
    if (filterOption === 'custom' && !customDate) {
      toast.error('Selecione uma data inicial')
      return
    }
    
    setSyncingFull(true)
    try {
      const result = await api.fullSync(getFilterParams())
      toast.success(result.message)
    } catch (error) {
      toast.error('Erro na sincronização completa')
    } finally {
      setSyncingFull(false)
    }
  }

  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-600">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
        <p className="text-gray-500 mt-1">Gerenciar sincronização e integrações</p>
      </div>

      {/* Filtro de Data */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Calendar className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Filtro de Período</h2>
            <p className="text-sm text-gray-500">Selecione o período para sincronização de contas</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <button
            onClick={() => setFilterOption('30')}
            className={`p-3 rounded-xl border-2 transition-all ${
              filterOption === '30'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="font-medium">Últimos 30 dias</span>
          </button>
          <button
            onClick={() => setFilterOption('60')}
            className={`p-3 rounded-xl border-2 transition-all ${
              filterOption === '60'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="font-medium">Últimos 60 dias</span>
          </button>
          <button
            onClick={() => setFilterOption('90')}
            className={`p-3 rounded-xl border-2 transition-all ${
              filterOption === '90'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="font-medium">Últimos 90 dias</span>
          </button>
          <button
            onClick={() => setFilterOption('custom')}
            className={`p-3 rounded-xl border-2 transition-all ${
              filterOption === 'custom'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="font-medium">Data específica</span>
          </button>
        </div>

        {filterOption === 'custom' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data inicial
            </label>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>
        )}
      </div>

      {/* Sincronização */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Sincronização</h2>
            <p className="text-sm text-gray-500">Sincronizar dados com GestãoClick e Efí Bank</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Sincronizar Clientes */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <h3 className="font-medium text-gray-800">Sincronizar Clientes</h3>
              <p className="text-sm text-gray-500">Importa todos os clientes do GestãoClick</p>
            </div>
            <button
              onClick={handleSyncClients}
              disabled={syncingClients}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {syncingClients ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Sincronizar
            </button>
          </div>

          {/* Sincronizar Contas */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <h3 className="font-medium text-gray-800">Sincronizar Contas a Receber</h3>
              <p className="text-sm text-gray-500">
                Importa contas em atraso ({filterOption === 'custom' ? 'data específica' : `últimos ${filterOption} dias`})
              </p>
            </div>
            <button
              onClick={handleSyncReceivables}
              disabled={syncingReceivables}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {syncingReceivables ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Sincronizar
            </button>
          </div>

          {/* Sincronizar Efí */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <h3 className="font-medium text-gray-800">Sincronizar Boletos Efí</h3>
              <p className="text-sm text-gray-500">Atualiza informações de boletos do Efí Bank</p>
            </div>
            <button
              onClick={handleSyncEfi}
              disabled={syncingEfi}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              {syncingEfi ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Sincronizar
            </button>
          </div>

          {/* Sincronização Completa */}
          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border-2 border-primary/20">
            <div>
              <h3 className="font-medium text-gray-800">Sincronização Completa</h3>
              <p className="text-sm text-gray-500">Executa todas as sincronizações de uma vez</p>
            </div>
            <button
              onClick={handleFullSync}
              disabled={syncingFull}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-secondary transition-colors disabled:opacity-50"
            >
              {syncingFull ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Executar Tudo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
