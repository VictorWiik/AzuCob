import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { api } from '../services/api'
import type { Client } from '../types'
import { useAuthStore } from '../hooks/useAuth'

interface ClientsResponse {
  data: Client[]
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

export default function Clients() {
  const [clients, setClients] = useState<ClientsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const filter = searchParams.get('filter')
  const page = parseInt(searchParams.get('page') || '1')

  // Helper para obter dados de paginação (suporta meta e pagination)
  const getPaginationData = () => {
    if (!clients) return { total: 0, page: 1, limit: 20, totalPages: 1 }
    
    if (clients.meta) {
      return {
        total: clients.meta.total,
        page: clients.meta.page,
        limit: clients.meta.limit,
        totalPages: clients.meta.totalPages,
      }
    }
    
    if (clients.pagination) {
      return {
        total: clients.pagination.total,
        page: clients.pagination.page,
        limit: clients.pagination.limit,
        totalPages: clients.pagination.pages,
      }
    }
    
    return { total: clients.data.length, page: 1, limit: clients.data.length, totalPages: 1 }
  }

  const loadClients = useCallback(async () => {
    setLoading(true)
    try {
      if (filter === 'overdue') {
        const overdueClients = await api.getOverdueClients()
        setClients({
          data: overdueClients,
          meta: {
            total: overdueClients.length,
            page: 1,
            limit: overdueClients.length,
            totalPages: 1,
          },
        })
      } else {
        const data = await api.getClients({ page, limit: 20, search })
        setClients(data)
      }
    } catch (error) {
      toast.error('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }, [filter, page, search])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadClients()
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await api.syncClients()
      toast.success(result.message)
      loadClients()
    } catch (error) {
      toast.error('Erro ao sincronizar clientes')
    } finally {
      setSyncing(false)
    }
  }

  const formatDocument = (doc: string) => {
    if (doc.length === 11) {
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }
    return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }

  const paginationData = getPaginationData()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
          <p className="text-gray-500 mt-1">
            {filter === 'overdue' ? 'Clientes com contas em atraso' : 'Gerenciar base de clientes'}
          </p>
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
      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, documento ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>
        </form>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/clients')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              !filter
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => navigate('/clients?filter=overdue')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 ${
              filter === 'overdue'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Inadimplentes
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : !clients?.data || clients.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400">
            <Users className="w-12 h-12 mb-4" />
            <p className="text-lg font-medium">Nenhum cliente encontrado</p>
            <p className="text-sm mt-1">
              {search ? 'Tente buscar com outros termos' : 'Sincronize com o GestãoClick'}
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
                      Documento
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      E-mail
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Telefone
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clients.data.map((client) => (
                    <tr
                      key={client.id}
                      onClick={() => navigate(`/clients/${client.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-primary font-semibold text-sm">
                              {client.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{client.name}</p>
                            {client.city && client.state && (
                              <p className="text-sm text-gray-400">
                                {client.city} - {client.state}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatDocument(client.document)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600">{client.primaryEmail || '-'}</span>
                        {client.additionalEmails && client.additionalEmails.length > 0 && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            +{client.additionalEmails.length}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{client.phone || '-'}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            client.active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {client.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {paginationData.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Mostrando {(paginationData.page - 1) * paginationData.limit + 1} a{' '}
                  {Math.min(paginationData.page * paginationData.limit, paginationData.total)} de{' '}
                  {paginationData.total} clientes
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/clients?page=${page - 1}${filter ? `&filter=${filter}` : ''}`)}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => navigate(`/clients?page=${page + 1}${filter ? `&filter=${filter}` : ''}`)}
                    disabled={page === paginationData.totalPages}
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
    </div>
  )
}
