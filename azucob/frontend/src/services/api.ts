import axios from 'axios';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

const axiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Generic methods
  get: (url: string, config?: any) => axiosInstance.get(url, config).then((r) => r.data),
  post: (url: string, data?: any, config?: any) => axiosInstance.post(url, data, config).then((r) => r.data),
  put: (url: string, data?: any, config?: any) => axiosInstance.put(url, data, config).then((r) => r.data),
  delete: (url: string, config?: any) => axiosInstance.delete(url, config).then((r) => r.data),

  // Auth
  login: (email: string, password: string) =>
    axiosInstance.post('/auth/login', { email, password }).then((r) => r.data),
  register: (data: { email: string; password: string; name: string }) =>
    axiosInstance.post('/auth/register', data).then((r) => r.data),
  me: () => axiosInstance.get('/auth/me').then((r) => r.data),

  // Dashboard
  getDashboardSummary: () => axiosInstance.get('/dashboard/summary').then((r) => r.data),
  getTopDebtors: () => axiosInstance.get('/dashboard/top-debtors').then((r) => r.data),
  getRecentCharges: () => axiosInstance.get('/dashboard/recent-charges').then((r) => r.data),
  getIntegrationStatus: () => axiosInstance.get('/dashboard/integration-status').then((r) => r.data),

  // Clients
  getClients: (params?: any) => axiosInstance.get('/clients', { params }).then((r) => r.data),
  getClient: (id: string) => axiosInstance.get(`/clients/${id}`).then((r) => r.data),
  getOverdueClients: () => axiosInstance.get('/clients/overdue').then((r) => r.data),
  addClientEmail: (clientId: string, email: string, name?: string) =>
    axiosInstance.post(`/clients/${clientId}/emails`, { email, name }).then((r) => r.data),
  removeClientEmail: (clientId: string, emailId: string) =>
    axiosInstance.delete(`/clients/${clientId}/emails/${emailId}`).then((r) => r.data),

  // Receivables
  getReceivables: (params?: any) => axiosInstance.get('/receivables', { params }).then((r) => r.data),
  getReceivable: (id: string) => axiosInstance.get(`/receivables/${id}`).then((r) => r.data),
  getOverdueReceivables: () => axiosInstance.get('/receivables/overdue').then((r) => r.data),
  settleReceivable: (id: string, data: any) =>
    axiosInstance.post(`/receivables/${id}/settle`, data).then((r) => r.data),
  sendCharge: (id: string, data?: any) =>
    axiosInstance.post(`/receivables/${id}/charge`, data).then((r) => r.data),

  // Templates
  getTemplates: () => axiosInstance.get('/templates').then((r) => r.data),
  getTemplate: (id: string) => axiosInstance.get(`/templates/${id}`).then((r) => r.data),
  getTemplateVariables: () => axiosInstance.get('/templates/variables').then((r) => r.data),
  createTemplate: (data: any) => axiosInstance.post('/templates', data).then((r) => r.data),
  updateTemplate: (id: string, data: any) => axiosInstance.put(`/templates/${id}`, data).then((r) => r.data),
  deleteTemplate: (id: string) => axiosInstance.delete(`/templates/${id}`).then((r) => r.data),

  // Rules
  getRules: () => axiosInstance.get('/rules').then((r) => r.data),
  getRule: (id: string) => axiosInstance.get(`/rules/${id}`).then((r) => r.data),
  createRule: (data: any) => axiosInstance.post('/rules', data).then((r) => r.data),
  updateRule: (id: string, data: any) => axiosInstance.put(`/rules/${id}`, data).then((r) => r.data),
  deleteRule: (id: string) => axiosInstance.delete(`/rules/${id}`).then((r) => r.data),
  toggleRule: (id: string) => axiosInstance.post(`/rules/${id}/toggle`).then((r) => r.data),

  // Sync
  syncClients: () => axiosInstance.post('/sync/clients').then((r) => r.data),
  syncReceivables: () => axiosInstance.post('/sync/receivables').then((r) => r.data),
  syncEfi: () => axiosInstance.post('/sync/efi').then((r) => r.data),
  fullSync: () => axiosInstance.post('/sync/full').then((r) => r.data),

  // Charges
  processCharges: () => axiosInstance.post('/charges/process').then((r) => r.data),
};

export default api;
