import { api } from '@/utils/api'
const root = '/api/shop/duo-plus'
export const duoApi = {
  options: () => api.get(`${root}/options`),
  list: (page = 1) => api.get(`${root}/orders?page=${page}`),
  create: (body) => api.post(`${root}/orders`, body),
  order: (no) => api.get(`${root}/orders/${encodeURIComponent(no)}`),
  orderAction: (no, action) => api.post(`${root}/orders/${encodeURIComponent(no)}/${action}`, {}),
  detail: (id) => api.get(`${root}/campaigns/${encodeURIComponent(id)}`),
  campaignAction: (id, action) => api.post(`${root}/campaigns/${encodeURIComponent(id)}/${action}`, {})
}
