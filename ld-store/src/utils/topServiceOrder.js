const PAYMENT_WINDOW_MS = 5 * 60 * 1000

export function parseTopServiceBeijingDateTimeMs(value = '') {
  const text = String(value || '').trim()
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (match) {
    const [, year, month, day, hour, minute, second] = match
    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - 8,
      Number(minute),
      Number(second)
    )
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(text) || /[zZ]|[+-]\d{2}(?::?\d{2})?$/.test(text)) {
    const ms = Date.parse(text)
    return Number.isFinite(ms) ? ms : 0
  }
  return 0
}

export function getTopServicePaymentDeadlineMs(order = {}) {
  const explicit = Number(order.payExpiredAtMs || 0)
  if (Number.isFinite(explicit) && explicit > 0) return explicit

  const legacyDeadline = parseTopServiceBeijingDateTimeMs(order.payExpiredAt)
  if (legacyDeadline > 0) return legacyDeadline

  const createdAtMs = parseTopServiceBeijingDateTimeMs(order.createdAt)
  return createdAtMs > 0 ? createdAtMs + PAYMENT_WINDOW_MS : 0
}

export function getTopServicePaymentRemainingSeconds(order = {}, nowMs = Date.now()) {
  const deadlineMs = getTopServicePaymentDeadlineMs(order)
  if (!deadlineMs || !Number.isFinite(Number(nowMs))) return 0
  return Math.max(0, Math.ceil((deadlineMs - Number(nowMs)) / 1000))
}

export function formatTopServicePaymentCountdown(order = {}, nowMs = Date.now()) {
  const totalSeconds = getTopServicePaymentRemainingSeconds(order, nowMs)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function canPayTopServiceOrder(order = {}, nowMs = Date.now()) {
  return order.status === 'pending' && order.canPay === true && !order.paymentReversalStatus
    && !order.paidAt && !order.effectiveAt && !order.ldcTradeNo
    && getTopServicePaymentRemainingSeconds(order, nowMs) > 0
}

export function canCancelTopServiceOrder(order = {}, nowMs = Date.now()) {
  return order.status === 'pending' && order.canCancel === true && !order.paymentReversalStatus
    && !order.paidAt && !order.effectiveAt && !order.ldcTradeNo
    && getTopServicePaymentRemainingSeconds(order, nowMs) > 0
}

export function topServicePlacement(type, categoryName = '', shared = false) {
  const category = categoryName || '所属分类'
  if (type === 'category') return `${category}顶部优选位`
  return shared ? `${category}及“全部”分类的甄选位` : `${category}的甄选位`
}

export function getTopServiceOrderPresentation(order = {}, nowMs = Date.now()) {
  const reversal = order.paymentReversalStatus
  if (reversal === 'refunded') return { label: '积分已退回', tone: 'neutral', message: '本次服务未能生效，积分已退回。请先核对 Credit 记录。' }
  if (reversal) return { label: reversal === 'pending' ? '积分退回中' : '退款待核验', tone: 'warning', message: reversal === 'pending' ? '已收到付款，但服务未能生效，积分正在退回。请勿重复付款。' : '积分退回结果尚未确认，请保留订单号并联系管理员核对。请勿重复付款。' }
  if (order.status === 'pending') {
    if (getTopServicePaymentRemainingSeconds(order, nowMs) <= 0) return { label: '支付时间已到', tone: 'warning', message: '支付时间已到，正在同步订单状态。请勿继续付款；名额释放以服务端结果为准。' }
    return { label: '待支付', tone: 'warning', message: '名额已为这笔订单保留。请在截止时间前付款，或取消订单释放名额。' }
  }
  if (order.status === 'active') {
    if (order.isSuspendedForCategory || (order.categoryBindingApplies && order.isCategoryMatched === false)) return { label: '已支付，暂停展示', tone: 'warning', message: `物品分类与开通分类不一致。切回「${order.boundCategoryName || order.categoryName || '开通分类'}」后可在有效期内恢复，过期时间不顺延。` }
    return { label: '服务已生效', tone: 'success', message: order.isPaidService === false ? '这是管理员设置的非有偿置顶，不占用付费名额。' : '服务已生效。到期自动结束，不会自动续费。' }
  }
  if (order.status === 'suspended') return { label: '服务已暂停', tone: 'warning', message: order.suspendedReason || '服务已由平台暂停，请联系管理员了解恢复方式。' }
  if (order.status === 'expired') {
    if (order.effectiveAt) return { label: '服务已结束', tone: 'neutral', message: '本次推广已到期。如需再次推广，请重新选择物品和方案。' }
    return { label: '支付超时', tone: 'neutral', message: '订单已超时，名额已释放。如已被扣款，请保留 Credit 支付记录并联系管理员核对，不要重复付款。' }
  }
  if (order.status === 'cancelled') return { label: '订单已取消', tone: 'neutral', message: order.cancelReasonCode === 'payment_link_create_failed' ? '支付链接生成失败，订单已取消，名额已释放。' : '订单已取消，名额已释放。请勿在之前打开的 Credit 页面继续付款。' }
  return { label: '状态待确认', tone: 'neutral', message: '暂未取得完整订单状态，请刷新核验。' }
}

export function topServiceQuoteChanged(quote, order) {
  return Number(quote.productId) !== Number(order.productId)
    || quote.packageType !== order.packageType
    || Number(quote.durationDays) !== Number(order.durationDays)
    || Math.round(Number(quote.amount) * 100) !== Math.round(Number(order.amount) * 100)
    || Number(quote.categoryId) !== Number(order.boundCategoryId ?? order.categoryId)
}

export function getTopServiceError(response, fallback = '暂未完成操作，请稍后重试') {
  const code = response?.errorCode || response?.code || response?.error
  const messages = {
    TOP_SERVICE_EXISTS: '该物品已有进行中的服务订单，请先处理已有订单。',
    TOP_QUOTA_FULL: '这个展示位置的名额刚刚用完，请刷新名额或选择其他服务。',
    PACKAGE_UNAVAILABLE: '所选方案已暂停购买，请刷新后重新选择。',
    PRODUCT_NOT_AVAILABLE: '该物品已不符合开通条件，请前往物品管理检查。',
    NOT_FOUND: '未找到可操作的物品或订单，请刷新后重试。',
    SERVER_CONFIG_ERROR: '支付服务暂时不可用，请稍后重试。',
    MERCHANT_SELLING_DISABLED: '当前商家暂不可购买推广服务，请查看账号经营状态。',
    PAYMENT_RESULT_INVALID: '暂时无法核实 Credit 支付结果，请保留订单号并联系管理员。不要重复付款。'
  }
  return messages[code] || response?.message || (typeof response?.error === 'string' && /[\u4e00-\u9fff]/.test(response.error) ? response.error : fallback)
}
