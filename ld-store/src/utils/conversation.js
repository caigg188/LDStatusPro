import { api } from './api'

function appendParam(params, key, value) {
  if (value === undefined || value === null || value === '') {
    return
  }
  params.set(key, String(value))
}

function buildConversationQuery(input = {}) {
  const params = new URLSearchParams()
  appendParam(params, 'type', input.type || 'buy_request')
  appendParam(params, 'status', input.status)
  appendParam(params, 'role', input.role)
  appendParam(params, 'search', input.search)
  appendParam(params, 'page', input.page)
  appendParam(params, 'pageSize', input.pageSize)
  return params.toString()
}

export async function fetchConversationUnreadSummary(options = {}) {
  const query = buildConversationQuery(options)
  return api.get(`/api/shop/conversations/unread-summary${query ? `?${query}` : ''}`)
}

export async function fetchMyConversations(options = {}) {
  const query = buildConversationQuery(options)
  return api.get(`/api/shop/conversations/my${query ? `?${query}` : ''}`)
}

export function resolveConversationPath(item) {
  if (item?.chatPath) {
    return item.chatPath
  }

  const requestId = Number(item?.requestId || item?.request?.id || 0)
  const sessionId = Number(item?.sessionId || item?.sourceId || item?.id || 0)
  if (!requestId || !sessionId) {
    return ''
  }

  return `/buy-request/${requestId}?session=${sessionId}`
}
