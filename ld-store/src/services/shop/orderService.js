import { api } from '@/utils/api'

function toRequestError(error, fallback) {
  return { success: false, error: error?.message || fallback }
}

function createEmptyOrderPage(page, pageSize) {
  return { orders: [], pagination: { total: 0, page, pageSize, totalPages: 0 } }
}

function getPositiveInt(value, fallback, min = 1, max = Number.POSITIVE_INFINITY) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

export function normalizeOrderListOptions(options = {}) {
  if (typeof options === 'string') {
    return { status: options }
  }
  if (!options || typeof options !== 'object') {
    return {}
  }
  return options
}

function buildOrderListParams(role, rawOptions = {}) {
  const options = normalizeOrderListOptions(rawOptions)
  const status = String(options.status || '').trim()
  const search = String(options.search || '').trim()
  const timeRange = String(options.timeRange || '').trim()
  const categoryId = Number.parseInt(options.categoryId, 10)
  const dealOnly = options.dealOnly === true || String(options.dealOnly || '').trim() === '1'
  const page = getPositiveInt(options.page, 1)
  const pageSize = getPositiveInt(options.pageSize, 20, 1, 50)
  const params = new URLSearchParams()

  params.set('role', role)
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  if (status) params.set('status', status)
  if (search) params.set('search', search)
  if (timeRange) params.set('timeRange', timeRange)
  if (Number.isInteger(categoryId) && categoryId > 0) params.set('categoryId', String(categoryId))
  if (dealOnly) params.set('dealOnly', '1')

  return { params, page, pageSize }
}

export function normalizeBuyOrderListOptions(options = {}) {
  const role = String(options.role || '').trim()
  const status = String(options.status || '').trim()
  const search = String(options.search || '').trim()
  const timeRange = String(options.timeRange || '').trim()
  const page = getPositiveInt(options.page, 1)
  const pageSize = getPositiveInt(options.pageSize, 20, 1, 50)

  return { role, status, search, timeRange, page, pageSize }
}

export async function fetchOrdersByRoleRequest(role, options = {}) {
  const meta = buildOrderListParams(role, options)
  return {
    ...meta,
    emptyState: createEmptyOrderPage(meta.page, meta.pageSize),
    result: await api.get(`/api/shop/orders?${meta.params.toString()}`)
  }
}

export async function fetchOrderDetailRequest(orderNo, role = 'buyer') {
  return api.get(`/api/shop/orders/${orderNo}?role=${role}`)
}

export async function createOrderRequest(productId, quantity = 1) {
  try {
    return await api.post('/api/shop/orders', { productId, quantity })
  } catch (error) {
    return toRequestError(error, '创建订单失败，请稍后重试')
  }
}

export async function cancelOrderRequest(orderNo) {
  try {
    return await api.post(`/api/shop/orders/${orderNo}/cancel`)
  } catch (error) {
    return toRequestError(error, '取消订单失败，请稍后重试')
  }
}

export async function refreshOrderStatusRequest(orderNo) {
  try {
    return await api.post(`/api/shop/orders/${orderNo}/refresh`)
  } catch (error) {
    return toRequestError(error, '刷新订单状态失败，请稍后重试')
  }
}

export async function getPaymentUrlRequest(orderNo) {
  try {
    return await api.get(`/api/shop/orders/${orderNo}/payment-url`)
  } catch (error) {
    return toRequestError(error, '获取支付链接失败，请稍后重试')
  }
}

export async function deliverOrderRequest(orderNo, content) {
  try {
    return await api.post(`/api/shop/orders/${orderNo}/deliver`, { content })
  } catch (error) {
    return toRequestError(error, '发货失败，请稍后重试')
  }
}

export async function fetchMyBuyOrdersRequest(options = {}) {
  const normalized = normalizeBuyOrderListOptions(options)
  const params = new URLSearchParams()
  params.set('page', String(normalized.page))
  params.set('pageSize', String(normalized.pageSize))
  if (normalized.role) params.set('role', normalized.role)
  if (normalized.status) params.set('status', normalized.status)
  if (normalized.search) params.set('search', normalized.search)
  if (normalized.timeRange) params.set('timeRange', normalized.timeRange)

  return {
    ...normalized,
    emptyState: createEmptyOrderPage(normalized.page, normalized.pageSize),
    result: await api.get(`/api/shop/buy-orders?${params.toString()}`)
  }
}

export async function getBuyOrderDetailRequest(orderNo) {
  try {
    return await api.get(`/api/shop/buy-orders/${encodeURIComponent(orderNo)}`)
  } catch (error) {
    return toRequestError(error, '加载求购订单详情失败，请稍后重试')
  }
}

export async function getBuyOrderPaymentUrlRequest(orderNo) {
  try {
    return await api.get(`/api/shop/buy-orders/${encodeURIComponent(orderNo)}/payment-url`)
  } catch (error) {
    return toRequestError(error, '获取求购订单支付链接失败，请稍后重试')
  }
}

export async function refreshBuyOrderStatusRequest(orderNo) {
  try {
    return await api.post(`/api/shop/buy-orders/${encodeURIComponent(orderNo)}/refresh`)
  } catch (error) {
    return toRequestError(error, '刷新求购订单状态失败，请稍后重试')
  }
}
