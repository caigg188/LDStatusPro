import { api } from '@/utils/api'
import {
  BuyOrderDetailResponseSchema,
  BuyOrderListResponseSchema,
  BuyOrderPaymentResponseSchema,
  CommerceActionResponseSchema,
  OrderCreatedResponseSchema,
  OrderSubmissionResponseSchema,
  OrderDetailResponseSchema,
  OrderListResponseSchema,
  OrderPaymentResponseSchema
} from '@/contracts/commerce'
import { validateServiceResult, withServiceFailure } from '@/services/serviceContract'

interface OrderListOptions {
  role?: string
  displayStatus?: string
  status?: string
  search?: string
  timeRange?: string
  categoryId?: string | number
  dealOnly?: boolean | string
  page?: number
  pageSize?: number
  signal?: AbortSignal
}

type OrderListInput = OrderListOptions | string

function getPositiveInt(value: unknown, fallback: number, min = 1, max = Number.POSITIVE_INFINITY): number {
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

export function normalizeOrderListOptions(options: OrderListInput = {}): OrderListOptions {
  if (typeof options === 'string') return { status: options }
  if (!options || typeof options !== 'object') return {}
  return options
}

function buildOrderListParams(role: string, rawOptions: OrderListInput = {}) {
  const options = normalizeOrderListOptions(rawOptions)
  const status = String(options.status || '').trim()
  const search = String(options.search || '').trim()
  const timeRange = String(options.timeRange || '').trim()
  const categoryId = Number.parseInt(String(options.categoryId || ''), 10)
  const dealOnly = options.dealOnly === true || String(options.dealOnly || '').trim() === '1'
  const page = getPositiveInt(options.page, 1)
  const pageSize = getPositiveInt(options.pageSize, 20, 1, 50)
  const params = new URLSearchParams({ role, page: String(page), pageSize: String(pageSize) })
  if (status) params.set('status', status)
  if (options.displayStatus) params.set('displayStatus', options.displayStatus)
  if (search) params.set('search', search)
  if (timeRange) params.set('timeRange', timeRange)
  if (Number.isInteger(categoryId) && categoryId > 0) params.set('categoryId', String(categoryId))
  if (dealOnly) params.set('dealOnly', '1')
  return { params, page, pageSize, signal: options.signal }
}

export function normalizeBuyOrderListOptions(options: OrderListOptions = {}) {
  const role = String(options.role || '').trim()
  const status = String(options.status || '').trim()
  const search = String(options.search || '').trim()
  const timeRange = String(options.timeRange || '').trim()
  const page = getPositiveInt(options.page, 1)
  const pageSize = getPositiveInt(options.pageSize, 20, 1, 50)
  return { role, status, search, timeRange, page, pageSize, signal: options.signal }
}

export async function fetchOrdersByRoleRequest(role: string, options: OrderListInput = {}) {
  const meta = buildOrderListParams(role, options)
  return validateServiceResult(
    await api.get(`/api/shop/orders?${meta.params.toString()}`, { auth: 'required', signal: meta.signal }),
    OrderListResponseSchema,
    '/api/shop/orders',
    'OrderListResponse'
  )
}

export async function fetchOrderDetailRequest(orderNo: string, role = 'buyer', options: { signal?: AbortSignal } = {}) {
  return validateServiceResult(
    await api.get(`/api/shop/orders/${encodeURIComponent(orderNo)}?role=${encodeURIComponent(role)}`, { auth: 'required', signal: options.signal }),
    OrderDetailResponseSchema,
    '/api/shop/orders/:orderNo',
    'OrderDetailResponse'
  )
}

export async function createOrderRequest(
  productId: string | number,
  quantity = 1,
  couponClaimId: string | number | null = null,
  discoveryToken = '',
  submissionToken = '',
  expectedAmount?: number
) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post('/api/shop/orders', {
      productId,
      quantity,
      ...(submissionToken ? { submissionToken, expectedAmount } : {}),
      ...(couponClaimId ? { couponClaimId } : {}),
      ...(discoveryToken ? { discoveryToken } : {})
    }, { auth: 'required' }),
    OrderCreatedResponseSchema,
    '/api/shop/orders',
    'OrderCreatedResponse'
  ), '创建订单失败，请稍后重试')
}

export async function getOrderSubmissionRequest(token: string, legacy?: { productId: string | number; couponClaimId: string | number | null }) {
  const query = legacy ? `?${new URLSearchParams({ legacyProductId: String(legacy.productId), legacyCouponClaimId: legacy.couponClaimId === null ? '' : String(legacy.couponClaimId) })}` : ''
  return withServiceFailure(async () => validateServiceResult(
    await api.get(`/api/shop/order-submissions/${encodeURIComponent(token)}${query}`, { auth: 'required' }),
    OrderSubmissionResponseSchema,
    '/api/shop/order-submissions/:token',
    'OrderSubmissionResponse'
  ), '暂时无法确认订单结果')
}

export async function cancelOrderRequest(orderNo: string) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post(`/api/shop/orders/${encodeURIComponent(orderNo)}/cancel`, undefined, { auth: 'required' }),
    CommerceActionResponseSchema,
    '/api/shop/orders/:orderNo/cancel',
    'CommerceActionResponse'
  ), '取消订单失败，请稍后重试')
}

export async function refreshOrderStatusRequest(orderNo: string) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post(`/api/shop/orders/${encodeURIComponent(orderNo)}/refresh`, undefined, { auth: 'required' }),
    OrderPaymentResponseSchema,
    '/api/shop/orders/:orderNo/refresh',
    'OrderPaymentResponse'
  ), '刷新订单状态失败，请稍后重试')
}

export async function getPaymentUrlRequest(orderNo: string) {
  return withServiceFailure(async () => validateServiceResult(
    await api.get(`/api/shop/orders/${encodeURIComponent(orderNo)}/payment-url`, { auth: 'required' }),
    OrderPaymentResponseSchema,
    '/api/shop/orders/:orderNo/payment-url',
    'OrderPaymentResponse'
  ), '获取支付链接失败，请稍后重试')
}

export async function deliverOrderRequest(orderNo: string, content: string) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post(`/api/shop/orders/${encodeURIComponent(orderNo)}/deliver`, { content }, { auth: 'required' }),
    CommerceActionResponseSchema,
    '/api/shop/orders/:orderNo/deliver',
    'CommerceActionResponse'
  ), '发货失败，请稍后重试')
}

export async function fetchMyBuyOrdersRequest(options: OrderListOptions = {}) {
  const normalized = normalizeBuyOrderListOptions(options)
  const params = new URLSearchParams({ page: String(normalized.page), pageSize: String(normalized.pageSize) })
  if (normalized.role) params.set('role', normalized.role)
  if (normalized.status) params.set('status', normalized.status)
  if (normalized.search) params.set('search', normalized.search)
  if (normalized.timeRange) params.set('timeRange', normalized.timeRange)
  return validateServiceResult(
    await api.get(`/api/shop/buy-orders?${params.toString()}`, { auth: 'required', signal: normalized.signal }),
    BuyOrderListResponseSchema,
    '/api/shop/buy-orders',
    'BuyOrderListResponse'
  )
}

export async function getBuyOrderDetailRequest(orderNo: string) {
  return withServiceFailure(async () => validateServiceResult(
    await api.get(`/api/shop/buy-orders/${encodeURIComponent(orderNo)}`, { auth: 'required' }),
    BuyOrderDetailResponseSchema,
    '/api/shop/buy-orders/:orderNo',
    'BuyOrderDetailResponse'
  ), '加载求购订单详情失败，请稍后重试')
}

export async function getBuyOrderPaymentUrlRequest(orderNo: string) {
  return withServiceFailure(async () => validateServiceResult(
    await api.get(`/api/shop/buy-orders/${encodeURIComponent(orderNo)}/payment-url`, { auth: 'required' }),
    BuyOrderPaymentResponseSchema,
    '/api/shop/buy-orders/:orderNo/payment-url',
    'BuyOrderPaymentResponse'
  ), '获取求购订单支付链接失败，请稍后重试')
}

export async function refreshBuyOrderStatusRequest(orderNo: string) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post(`/api/shop/buy-orders/${encodeURIComponent(orderNo)}/refresh`, undefined, { auth: 'required' }),
    BuyOrderPaymentResponseSchema,
    '/api/shop/buy-orders/:orderNo/refresh',
    'BuyOrderPaymentResponse'
  ), '刷新求购订单状态失败，请稍后重试')
}
