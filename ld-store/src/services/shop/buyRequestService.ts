import { api, type JsonValue } from '@/utils/api'
import {
  BuyMessagesResponseSchema,
  BuyMessageCreatedResponseSchema,
  BuyRequestDetailResponseSchema,
  BuyRequestListResponseSchema,
  BuyRequestMutationResponseSchema,
  BuySessionDetailResponseSchema,
  BuySessionMutationResponseSchema,
  CommerceActionResponseSchema
} from '@/contracts/commerce'
import { validateServiceResult, withServiceFailure } from '@/services/serviceContract'

interface BuyRequestListOptions {
  page?: number
  pageSize?: number
  status?: string
  search?: string
  signal?: AbortSignal
}

interface BuyMessageListOptions {
  limit?: number
  sinceId?: string | number
  beforeId?: string | number
  signal?: AbortSignal
}

function listQuery(options: BuyRequestListOptions): string {
  const params = new URLSearchParams({
    page: String(options.page || 1),
    pageSize: String(options.pageSize || 20)
  })
  if (options.status) params.set('status', options.status)
  if (options.search?.trim()) params.set('search', options.search.trim())
  return params.toString()
}

export async function fetchMyBuyRequestsRequest(options: BuyRequestListOptions = {}) {
  return withServiceFailure(async () => validateServiceResult(
    await api.get(`/api/shop/buy-requests/my?${listQuery(options)}`, { auth: 'required', signal: options.signal }),
    BuyRequestListResponseSchema,
    '/api/shop/buy-requests/my',
    'BuyRequestListResponse'
  ), '加载求购列表失败，请稍后重试')
}

export async function fetchBuyRequestDetailRequest(requestId: string | number, signal?: AbortSignal) {
  return withServiceFailure(async () => validateServiceResult(
    await api.get(`/api/shop/buy-requests/${requestId}`, { auth: 'optional', signal }),
    BuyRequestDetailResponseSchema,
    '/api/shop/buy-requests/:id',
    'BuyRequestDetailResponse'
  ), '加载求购详情失败，请稍后重试')
}

export async function createBuyRequestRequest(payload: Record<string, JsonValue>) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post('/api/shop/buy-requests', payload, { auth: 'required' }),
    BuyRequestMutationResponseSchema,
    '/api/shop/buy-requests',
    'BuyRequestMutationResponse'
  ), '发布求购失败，请稍后重试')
}

export async function updateBuyRequestStatusRequest(requestId: string | number, status: string) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post(`/api/shop/buy-requests/${requestId}/status`, { status }, { auth: 'required' }),
    BuyRequestMutationResponseSchema,
    '/api/shop/buy-requests/:id/status',
    'BuyRequestMutationResponse'
  ), '状态更新失败，请稍后重试')
}

export async function updateBuyRequestPriceRequest(requestId: string | number, price: number) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post(`/api/shop/buy-requests/${requestId}/price`, { price }, { auth: 'required' }),
    BuyRequestMutationResponseSchema,
    '/api/shop/buy-requests/:id/price',
    'BuyRequestMutationResponse'
  ), '调价失败，请稍后重试')
}

export async function fetchBuySessionDetailRequest(sessionId: string | number, signal?: AbortSignal, requestId?: string | number) {
  const query = requestId ? `?${new URLSearchParams({ requestId: String(requestId) })}` : ''
  return withServiceFailure(async () => validateServiceResult(
    await api.get(`/api/shop/buy-sessions/${sessionId}${query}`, { auth: 'required', signal }),
    BuySessionDetailResponseSchema,
    '/api/shop/buy-sessions/:id',
    'BuySessionDetailResponse'
  ), '加载求购会话失败，请稍后重试')
}

export async function createBuySessionRequest(requestId: string | number) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post(`/api/shop/buy-requests/${requestId}/sessions`, {}, { auth: 'required' }),
    BuySessionMutationResponseSchema,
    '/api/shop/buy-requests/:id/sessions',
    'BuySessionMutationResponse'
  ), '发起洽谈失败，请稍后重试')
}

export async function fetchBuySessionMessagesRequest(sessionId: string | number, options: BuyMessageListOptions = {}) {
  const params = new URLSearchParams({
    limit: String(options.limit || 50)
  })
  if (options.sinceId) params.set('sinceId', String(options.sinceId))
  if (options.beforeId) params.set('beforeId', String(options.beforeId))
  return withServiceFailure(async () => validateServiceResult(
    await api.get(`/api/shop/buy-sessions/${sessionId}/messages?${params.toString()}`, { auth: 'required', signal: options.signal }),
    BuyMessagesResponseSchema,
    '/api/shop/buy-sessions/:id/messages',
    'BuyMessagesResponse'
  ), '加载会话消息失败，请稍后重试')
}

export async function markBuySessionReadRequest(sessionId: string | number, lastReadMessageId: string | number) {
  return validateServiceResult(
    await api.post(`/api/shop/buy-sessions/${sessionId}/read`, { lastReadMessageId }, { auth: 'required' }),
    CommerceActionResponseSchema,
    '/api/shop/buy-sessions/:id/read',
    'CommerceActionResponse'
  )
}

export async function sendBuySessionMessageRequest(sessionId: string | number, content: string) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post(`/api/shop/buy-sessions/${sessionId}/messages`, { content }, { auth: 'required' }),
    BuyMessageCreatedResponseSchema,
    '/api/shop/buy-sessions/:id/messages',
    'BuyMessageCreatedResponse'
  ), '发送失败，请稍后重试')
}

export async function createBuySessionPaymentRequest(sessionId: string | number) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post(`/api/shop/buy-sessions/${sessionId}/payment`, {}, { auth: 'required' }),
    BuySessionMutationResponseSchema,
    '/api/shop/buy-sessions/:id/payment',
    'BuySessionMutationResponse'
  ), '创建支付订单失败，请稍后重试')
}

export async function closeBuySessionRequest(sessionId: string | number) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post(`/api/shop/buy-sessions/${sessionId}/close`, {}, { auth: 'required' }),
    BuySessionMutationResponseSchema,
    '/api/shop/buy-sessions/:id/close',
    'BuySessionMutationResponse'
  ), '关闭会话失败，请稍后重试')
}
