import { ORDER_STATUS_LABELS } from './orderPresentation'

export const EMPTY_OVERVIEW = Object.freeze({
  daysOnStore: 0,
  firstActivityAt: '',
  latestActivityAt: '',
  totalPurchaseOrders: 0,
  totalPurchaseQuantity: 0,
  totalSpent: 0,
  totalSellOrders: 0,
  totalSellQuantity: 0,
  totalRevenue: 0,
  publishedProductCount: 0,
  approvedProductCount: 0,
  activeProductCount: 0,
  favoriteCount: 0,
  distinctPurchasedProducts: 0,
  distinctBuyers: 0,
  purchasedCategoryCount: 0
})

export const EMPTY_DISTRIBUTION = Object.freeze({
  categories: [],
  totals: { orderCount: 0, quantity: 0, amount: 0 }
})

export const EMPTY_ATTENTION = Object.freeze({
  pendingPaymentCount: 0,
  awaitingDeliveryCount: 0,
  refundAttentionCount: 0,
  unusedCouponCount: 0,
  expiringCouponCount: 0,
  pendingReportCount: 0,
  nextFulfillmentDeadlineAt: null,
  recentOrders: [],
  generatedAt: 0
})

export const EMPTY_MERCHANT = Object.freeze({
  configured: false,
  isActive: false,
  isVerified: false,
  updatedAt: null
})

export function formatHubNumber(value) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Math.max(Number(value) || 0, 0))
}

export function formatHubAmount(value) {
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Math.max(Number(value) || 0, 0))
}

export function remainingDeadlineLabel(deadline, now = Date.now()) {
  const ms = Date.parse(String(deadline || ''))
  if (!Number.isFinite(ms)) return ''
  const remaining = ms - now
  if (remaining <= 0) return '已到期'
  if (remaining >= 24 * 3600 * 1000) return `剩 ${Math.ceil(remaining / (24 * 3600 * 1000))} 天`
  if (remaining >= 3600 * 1000) return `剩 ${Math.ceil(remaining / (3600 * 1000))} 小时`
  return `剩 ${Math.max(1, Math.ceil(remaining / 60000))} 分钟`
}

export function buildTrustHint(trustLevel) {
  const level = Number(trustLevel)
  if (!Number.isInteger(level) || level < 0) {
    return { label: 'TL?', detail: '信任等级待确认', tone: 'trust-unknown' }
  }
  if (level >= 4) return { label: `TL${level}`, detail: '可查看士多热榜', tone: 'trust-elite' }
  if (level === 3) return { label: 'TL3', detail: '可查看士多热榜', tone: 'trust-high' }
  if (level === 2) return { label: 'TL2', detail: '可查看士多热榜', tone: 'trust-mid' }
  if (level === 1) return { label: 'TL1', detail: '可查看士多热榜', tone: 'trust-basic' }
  return { label: 'TL0', detail: '暂不能查看士多热榜', tone: 'trust-new' }
}

export function buildAttentionItems({
  attention = EMPTY_ATTENTION,
  messageUnread = 0,
  now = Date.now()
} = {}) {
  const deliveryHint = attention.awaitingDeliveryCount > 0
    ? remainingDeadlineLabel(attention.nextFulfillmentDeadlineAt, now)
    : ''
  return [
    {
      key: 'pay',
      label: '待支付',
      count: Number(attention.pendingPaymentCount || 0),
      hint: '',
      to: { path: '/user/orders', query: { tab: 'buyer', status: 'pending' } }
    },
    {
      key: 'delivery',
      label: '待收货',
      count: Number(attention.awaitingDeliveryCount || 0),
      hint: deliveryHint,
      to: { path: '/user/orders', query: { tab: 'buyer', status: 'paid' } }
    },
    {
      key: 'refund',
      label: '退款',
      count: Number(attention.refundAttentionCount || 0),
      hint: '',
      to: { path: '/user/orders', query: { tab: 'buyer', status: 'refund' } }
    },
    {
      key: 'messages',
      label: '消息',
      count: Number(messageUnread || 0),
      hint: '',
      to: '/user/messages'
    },
    {
      key: 'coupons',
      label: '券将过期',
      count: Number(attention.expiringCouponCount || 0),
      hint: '',
      to: '/user/coupons'
    },
    {
      key: 'reports',
      label: '举报跟进',
      count: Number(attention.pendingReportCount || 0),
      hint: '',
      to: '/user/reports'
    }
  ]
}

export function activeAttentionItems(items = []) {
  return items.filter(item => Number(item.count || 0) > 0)
}

export function buildRecordLinks({
  unusedCouponCount = 0,
  messageUnread = 0,
  pendingReportCount = 0
} = {}) {
  const badge = value => {
    const count = Number(value || 0)
    if (count <= 0) return ''
    return count > 99 ? '99+' : String(count)
  }
  return [
    { key: 'orders', label: '订单', to: '/user/orders', badge: '' },
    { key: 'coupons', label: '优惠券', to: '/user/coupons', badge: badge(unusedCouponCount) },
    { key: 'favorites', label: '收藏', to: '/user/favorites', badge: '' },
    { key: 'buyRequests', label: '求购', to: '/user/buy-requests', badge: '' },
    { key: 'messages', label: '消息', to: '/user/messages', badge: badge(messageUnread) },
    { key: 'reports', label: '举报', to: '/user/reports', badge: badge(pendingReportCount) }
  ]
}

export function shouldShowSellerChannel({
  overview = EMPTY_OVERVIEW,
  merchant = EMPTY_MERCHANT,
  sellerPendingDeliveryCount = 0,
  sellerRefundPendingCount = 0
} = {}) {
  return Number(sellerPendingDeliveryCount || 0) > 0
    || Number(sellerRefundPendingCount || 0) > 0
    || Number(overview.publishedProductCount || 0) > 0
    || Number(overview.totalSellOrders || 0) > 0
    || Boolean(merchant?.configured)
}

export function sellerChannelCopy({
  sellerPendingDeliveryCount = 0,
  sellerRefundPendingCount = 0
} = {}) {
  const parts = []
  if (Number(sellerPendingDeliveryCount || 0) > 0) parts.push(`待发 ${formatHubNumber(sellerPendingDeliveryCount)}`)
  if (Number(sellerRefundPendingCount || 0) > 0) parts.push(`售后 ${formatHubNumber(sellerRefundPendingCount)}`)
  return parts.join(' · ') || '管理物品、订单和收款'
}

export function recentOrderAction(order = {}) {
  const orderNo = String(order.orderNo || order.id || '').trim()
  const to = orderNo ? { path: `/order/${orderNo}`, query: { role: 'buyer' } } : '/user/orders'
  const status = String(order.status || '')
  if (status === 'pending' || status === 'paying') return { label: '去支付', to }
  if (status === 'refund_pending') return { label: '查看退款', to }
  if (status === 'paid') return { label: '查看进度', to }
  if (status === 'delivered') return { label: '查看交付', to }
  return { label: '查看订单', to }
}

export function recentOrderStatusLabel(order = {}) {
  return ORDER_STATUS_LABELS[order.status] || order.status || '未知'
}

export function recentOrderStatusTone(order = {}) {
  const status = String(order.status || '')
  if (status === 'pending' || status === 'paying') return 'warn'
  if (status === 'paid') return 'info'
  if (status === 'refund_pending' || status === 'refund_failed') return 'danger'
  if (status === 'delivered' || status === 'completed' || status === 'refunded') return 'ok'
  return 'mute'
}

export function spendingSharePercent(amount, total) {
  const value = Math.max(Number(amount) || 0, 0)
  const sum = Math.max(Number(total) || 0, 0)
  if (sum <= 0 || value <= 0) return 0
  return Math.round((value / sum) * 100)
}

export function buildSpendingShares(distribution = EMPTY_DISTRIBUTION) {
  const categories = Array.isArray(distribution.categories) ? distribution.categories : []
  const summed = categories.reduce((sum, item) => sum + Math.max(Number(item.amount) || 0, 0), 0)
  const total = Math.max(Number(distribution.totals?.amount) || 0, summed)
  return [...categories]
    .sort((left, right) => {
      const primary = Math.max(Number(right.amount) || 0, 0) - Math.max(Number(left.amount) || 0, 0)
      if (primary !== 0) return primary
      return Math.max(Number(right.orderCount) || 0, 0) - Math.max(Number(left.orderCount) || 0, 0)
    })
    .map(item => ({
      ...item,
      amount: Math.max(Number(item.amount) || 0, 0),
      share: spendingSharePercent(item.amount, total)
    }))
}

export function spendingInsightText(shares = []) {
  const top = shares[0]
  const name = String(top?.categoryName || '').trim()
  if (!top || !name || Number(top.share || 0) <= 0) return ''
  return `你把 ${top.share}% 的积分花在「${name}」`
}

export function spendingSummaryText(overview = EMPTY_OVERVIEW) {
  return `累计 ${formatHubNumber(overview.totalPurchaseOrders)} 单 · ${formatHubAmount(overview.totalSpent)} LDC`
}
