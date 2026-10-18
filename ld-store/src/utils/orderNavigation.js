import { normalizeResourceId } from '@/utils/resourceId'
function toPositiveId(value) {
  return normalizeResourceId(value)
}

export function resolveOrderSubjectTarget(order = {}) {
  const orderType = String(order.order_type || order.orderType || '').toLowerCase()
  if (orderType === 'buy_request') {
    const requestId = toPositiveId(order.request_id ?? order.requestId ?? order.request?.id)
    return requestId ? `/buy-request/${requestId}` : ''
  }

  const productId = toPositiveId(order.product_id ?? order.productId ?? order.product?.id)
  return productId ? `/product/${productId}` : ''
}
