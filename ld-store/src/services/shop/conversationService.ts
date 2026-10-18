import { normalizeResourceId } from '@/utils/resourceId'
import { api } from '@/utils/api'
import { ConversationListResponseSchema, NotificationSummaryResponseSchema } from '@/contracts/commerce'
import { validateServiceResult, withServiceFailure } from '@/services/serviceContract'

interface ConversationOptions {
  type?: string
  status?: string
  role?: string
  search?: string
  page?: number
  pageSize?: number
  signal?: AbortSignal
}

function buildConversationQuery(input: ConversationOptions = {}): string {
  const params = new URLSearchParams()
  const values: Record<string, unknown> = {
    type: input.type || 'buy_request',
    status: input.status,
    role: input.role,
    search: input.search,
    page: input.page,
    pageSize: input.pageSize
  }
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  return params.toString()
}

export async function fetchConversationUnreadSummary(options: ConversationOptions = {}) {
  const query = buildConversationQuery(options)
  return withServiceFailure(async () => validateServiceResult(
    await api.get(`/api/shop/conversations/unread-summary${query ? `?${query}` : ''}`, { auth: 'required', signal: options.signal }),
    NotificationSummaryResponseSchema,
    '/api/shop/conversations/unread-summary',
    'ConversationUnreadSummaryResponse'
  ), '加载会话未读状态失败')
}

export async function fetchMyConversations(options: ConversationOptions = {}) {
  const query = buildConversationQuery(options)
  return withServiceFailure(async () => validateServiceResult(
    await api.get(`/api/shop/conversations/my${query ? `?${query}` : ''}`, { auth: 'required', signal: options.signal }),
    ConversationListResponseSchema,
    '/api/shop/conversations/my',
    'ConversationListResponse'
  ), '加载会话失败')
}

export function resolveConversationPath(item: Record<string, unknown>): string {
  if (item?.chatPath) return String(item.chatPath)
  const request = item.request && typeof item.request === 'object' ? item.request as Record<string, unknown> : null
  const requestId = normalizeResourceId(item?.requestId || request?.id || 0)
  const sessionId = normalizeResourceId(item?.sessionId || item?.sourceId || item?.id || 0)
  if (!requestId || !sessionId) return ''
  return `/buy-request/${requestId}?session=${sessionId}`
}
