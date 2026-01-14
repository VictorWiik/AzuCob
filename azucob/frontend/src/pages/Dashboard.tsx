import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Users,
  AlertTriangle,
  DollarSign,
  Mail,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { api } from '../services/api'
import type { DashboardSummary, TopDebtor, RecentCharge, IntegrationStatus } from '../types'
import { useAuthStore } from '../hooks/useAuth'

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const defaultIntegrationStatus: IntegrationStatus = {
  gestaoClick: { connected: false, lastSync: null },
  efiBanco: { connected: false, lastSync: null },
}

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [topDebtors, setTopDebtors] = useState<TopDebtor[]>([])
  const [recentCharges, setRecentCharges] = useState<RecentCharge[]>([])
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>(defaultIntegrationStatus)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const loadData = async () => {
    try {
      const [summaryData, debtorsData, chargesData, statusData] = await Promise.all([
        api.getDashboardSummary().catch(() => null),
        api.getTopDebtors().catch(() => []),
        api.getRecentCharges().catch(() => []),
        api.getIntegrationStatus().catch(() => defaultIntegrationStatus),
      ])
      setSummary(summaryData)
      setTopDebtors(debtorsData || [])
      setRecentCharges(chargesData || [])
      setIntegrationStatus(statusData || defaultIntegrationStatus)
    } catch (error) {
      toast.error('Erro ao carregar dados do dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.fullSync()
      toast.success('Sincronização realizada com sucesso!')
      loadData()
    } catch (error) {
      toast.error('Erro ao sincronizar dados')
    } finally {
      setSyncing(false)
    }
  }

  const handleProcessCharges = async () => {
    try {
      const result = await api.processCharges()
      toast.success(result.message || 'Cobranças processadas!')
      loadData()
    } catch (error) {
      toast.error('Erro ao processar cobranças')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  const pieData = [
    { name: 'Última Semana', value: summary?.overdueLastWeek || 0, color: '#FF6B6B' },
    { name: 'Último Mês', value: (summary?.overdueLastMonth || 0) - (summary?.overdueLastWeek || 0), color: '#FFA06B' },
    { name: 'Anteriores', value: (summary?.totalOverdue || 0) - (summary?.overdueLastMonth || 0), color: '#FFD93D' },
  ]

  const gestaoClickStatus = integrationStatus?.gestaoClick || { connected: false, lastSync: null }
  const efiBancoStatus = integrationStatus?.efiBanco || { connected: false, lastSync: null }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 mt-1">Bem-vindo, {user?.name?.split(' ')[0] || 'Usuário'}!</p>
        </div>
        <div className="flex gap-3">
          {user?.role === 'ADMIN' && (
            <>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                Sincronizar
              </button>
              <button
                onClick={handleProcessCharges}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-secondary transition-colors"
              >
                <Mail className="w-4 h-4" />
                Processar Cobranças
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total de Clientes</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{summary?.totalClients || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Inadimplentes</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{summary?.totalOverdue || 0}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm">
            <TrendingUp className="w-4 h-4 text-red-500" />
            <span className="text-red-500 font-medium">+{summary?.overdueLastWeek || 0}</span>
            <span className="text-gray-400">na última semana</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Valor em Atraso</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {formatCurrency(summary?.totalOverdueAmount || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pagos este mês</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{summary?.paidThisMonth || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-3">
            {formatCurrency(summary?.paidAmountThisMonth || 0)}
          </p>
        </div>
      </div>

      {/* Charts and lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top debtors */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Top 10 Inadimplentes</h2>
            <button
              onClick={() => navigate('/clients?filter=overdue')}
              className="text-primary text-sm font-medium hover:underline flex items-center gap-1"
            >
              Ver todos
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6">
            {topDebtors.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={topDebtors.slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                  <YAxis
                    type="category"
                    dataKey="clientName"
                    width={150}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Bar dataKey="totalAmount" fill="#0066CC" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-400">
                Nenhum inadimplente encontrado
              </div>
            )}
          </div>
        </div>

        {/* Overdue distribution */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Distribuição</h2>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-4">
              {pieData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-600">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity and integration status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent charges */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Cobranças Recentes</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recentCharges.length > 0 ? (
              recentCharges.slice(0, 5).map((charge) => (
                <div key={charge.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{charge.clientName}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(charge.sentAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-800">{formatCurrency(charge.amount)}</p>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${
                        charge.status === 'SENT'
                          ? 'text-green-600'
                          : charge.status === 'FAILED'
                          ? 'text-red-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {charge.status === 'SENT' ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {charge.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-gray-400">
                Nenhuma cobrança enviada recentemente
              </div>
            )}
          </div>
        </div>

        {/* Integration status */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Status das Integrações</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    gestaoClickStatus.connected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <div>
                  <p className="font-medium text-gray-800">GestãoClick</p>
                  <p className="text-xs text-gray-400">
                    {gestaoClickStatus.lastSync
                      ? `Última sync: ${new Date(gestaoClickStatus.lastSync).toLocaleString('pt-BR')}`
                      : 'Nunca sincronizado'}
                  </p>
                </div>
              </div>
              <span
                className={`text-sm font-medium ${
                  gestaoClickStatus.connected ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {gestaoClickStatus.connected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    efiBancoStatus.connected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <div>
                  <p className="font-medium text-gray-800">Banco Efí</p>
                  <p className="text-xs text-gray-400">
                    {efiBancoStatus.lastSync
                      ? `Última sync: ${new Date(efiBancoStatus.lastSync).toLocaleString('pt-BR')}`
                      : 'Nunca sincronizado'}
                  </p>
                </div>
              </div>
              <span
                className={`text-sm font-medium ${
                  efiBancoStatus.connected ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {efiBancoStatus.connected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {summary?.emailsSentToday || 0}
                  </p>
                  <p className="text-sm text-gray-500">Emails hoje</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {summary?.emailsSentThisWeek || 0}
                  </p>
                  <p className="text-sm text-gray-500">Emails esta semana</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
