import { formatDateTime } from './format'

export const REFUND_REASON_OPTIONS = Object.freeze([
  { value: 'not_received_or_unusable', label: '未收到或无法使用' },
  { value: 'not_as_described', label: '与物品描述不符' },
  { value: 'duplicate_or_mistaken_purchase', label: '重复购买或误购' },
  { value: 'seller_agreed', label: '卖家已同意退款' },
  { value: 'other', label: '其他问题' }
])

const REASON_LABELS = Object.freeze({
  ...Object.fromEntries(REFUND_REASON_OPTIONS.map(option => [option.value, option.label])),
  shipment_timeout: '卖家超时未发货'
})

const STATUS_META = Object.freeze({
  requested: { label: '等待卖家处理', tone: 'warning', description: '退款申请已提交，卖家尚未处理。' },
  negotiating: { label: '协商中', tone: 'info', description: '卖家正在联系你协商处理。' },
  processing: { label: '退款执行中', tone: 'info', description: '系统正在向 LINUX DO Credit 提交全额退款。' },
  failed: { label: '退款执行失败', tone: 'danger', description: '本次自动退款未完成，卖家可以查看原因并重试。' },
  unknown: { label: '退款结果待核对', tone: 'danger', description: '无法确认 Credit 是否已完成退款，为避免重复退回，系统已停止自动重试。' },
  refunded: { label: '已退款', tone: 'success', description: 'LDC 积分已由 LINUX DO Credit 原路退回。' },
  rejected: { label: '申请已拒绝', tone: 'danger', description: '请先查看卖家说明；协商仍无法解决时，可到 Credit 发起争议。' },
  external_dispute: {
    label: '已转 Credit 处理',
    tone: 'warning',
    description: 'Credit 中的原订单已不再是 success 状态，LD 士多已停止本地退款流程；这不代表积分已退回。'
  }
})

const REFUND_STAGE_DEFINITIONS = Object.freeze([
  { key: 'request', label: '申请已提交' },
  { key: 'seller', label: '卖家处理' },
  { key: 'execution', label: '退款执行' },
  { key: 'result', label: '处理结果' }
])

const REFUND_EVENT_META = Object.freeze({
  response_policy_enrolled: { label: '已通知双方退款处理时限', tone: 'info', icon: 'update' },
  response_deadline_reminder: { label: '已提醒卖家临近截止时间', tone: 'warning', icon: 'update' },
  response_timeout_approved: { label: '超时未决定，系统自动同意退款', tone: 'info', icon: 'approved' },
  admin_approved: { label: '管理员同意退款', tone: 'info', icon: 'approved' },
  admin_overridden: { label: '管理员改判退款', tone: 'info', icon: 'approved' },
  admin_rejected: { label: '管理员驳回退款申请', tone: 'danger', icon: 'rejected' },
  admin_retry_started: { label: '管理员核查后重试退款', tone: 'info', icon: 'update' },
  contact_updated: { label: '卖家补充协商记录', tone: 'info', icon: 'contact' },
  requested: { label: '买家提交退款申请', tone: 'brand', icon: 'request' },
  contacted: { label: '卖家联系买家协商', tone: 'info', icon: 'contact' },
  approved: { label: '卖家同意全额退款', tone: 'info', icon: 'approved' },
  rejected: { label: '卖家拒绝退款申请', tone: 'danger', icon: 'rejected' },
  refund_succeeded: { label: 'LDC 积分退款成功', tone: 'success', icon: 'success' },
  refund_failed: { label: '退款执行失败', tone: 'danger', icon: 'failed' },
  refund_unknown: { label: '退款结果等待核对', tone: 'warning', icon: 'unknown' },
  external_dispute_detected: { label: '检测到 Credit 外部处理', tone: 'warning', icon: 'external' },
  automatic_refund_started: { label: '系统因超时发起全额退款', tone: 'info', icon: 'approved' },
  seller_refund_started: { label: '卖家主动发起全额退款', tone: 'info', icon: 'approved' },
  refund_admin_confirmed: { label: '平台登记 Credit 核对结果', tone: 'info', icon: 'update' },
  admin_confirmed_refunded: { label: '平台确认 Credit 已退款', tone: 'success', icon: 'success' },
  admin_confirmed_failed: { label: '平台确认退款未完成', tone: 'danger', icon: 'failed' },
  admin_confirmed_external_dispute: { label: '平台确认已转 Credit 处理', tone: 'warning', icon: 'external' }
})

function createStage(index, state = 'pending', options = {}) {
  const definition = REFUND_STAGE_DEFINITIONS[index]
  return {
    ...definition,
    state,
    tone: options.tone || (state === 'done' ? 'success' : 'neutral'),
    description: options.description || (state === 'pending' ? '尚未开始' : ''),
    current: options.current === true
  }
}

export function buildRefundStages(status, hasRefund = true, source = 'buyer', trigger = '') {
  if (!hasRefund) return []

  const value = String(status || '')
  const requestDone = source === 'system' ? '系统已触发超时保障' : source === 'seller' ? '卖家已主动退款' : '申请信息已送达'
  const decisionDone = trigger === 'response_timeout' ? '系统已自动同意退款' : trigger.startsWith('admin_') ? '管理员已同意退款' : source === 'buyer' ? '卖家已同意退款' : '无需卖家审批'
  const pending = index => createStage(index)
  const done = (index, description) => createStage(index, 'done', { description })
  const current = (index, description, tone = 'info') => createStage(index, 'current', {
    description,
    tone,
    current: true
  })
  const error = (index, description, tone = 'danger') => createStage(index, 'error', {
    description,
    tone,
    current: true
  })

  if (value === 'requested') {
    return [
      done(0, requestDone),
      current(1, '等待卖家响应', 'warning'),
      pending(2),
      pending(3)
    ]
  }

  if (value === 'negotiating') {
    return [
      done(0, requestDone),
      current(1, '双方正在协商'),
      pending(2),
      pending(3)
    ]
  }

  if (value === 'processing') {
    return [
      done(0, requestDone),
      done(1, decisionDone),
      current(2, '正在提交 Credit'),
      pending(3)
    ]
  }

  if (value === 'refunded') {
    const result = done(3, 'LDC 已原路退回')
    result.label = '已退款'
    result.current = true
    return [
      done(0, requestDone),
      done(1, decisionDone),
      done(2, 'Credit 已确认退款'),
      result
    ]
  }

  if (value === 'rejected') {
    const skipped = createStage(2, 'skipped', {
      description: '未执行积分退款',
      tone: 'neutral'
    })
    const result = error(3, '查看卖家说明')
    result.label = '已拒绝'
    return [
      done(0, requestDone),
      done(1, '卖家已作出决定'),
      skipped,
      result
    ]
  }

  if (value === 'failed') {
    return [
      done(0, requestDone),
      done(1, decisionDone),
      error(2, '可检查原因后重试'),
      pending(3)
    ]
  }

  if (value === 'unknown') {
    return [
      done(0, requestDone),
      done(1, decisionDone),
      error(2, '需人工核对 Credit', 'warning'),
      pending(3)
    ]
  }

  if (value === 'external_dispute') {
    const seller = createStage(1, 'skipped', {
      description: 'LD 士多未继续卖家决策',
      tone: 'neutral'
    })
    const execution = createStage(2, 'skipped', {
      description: '未从 LD 士多发起退款',
      tone: 'neutral'
    })
    const result = current(3, '请前往 Credit 核对实际结果', 'warning')
    result.label = 'Credit 处理'
    return [
      done(0, '申请信息已记录'),
      seller,
      execution,
      result
    ]
  }

  return [
    current(0, '售后状态待确认', 'warning'),
    pending(1),
    pending(2),
    pending(3)
  ]
}

export function getRefundEventMeta(action) {
  return REFUND_EVENT_META[String(action || '')] || {
    label: '售后状态更新',
    tone: 'neutral',
    icon: 'update'
  }
}

export function getRefundActorLabel(event = {}) {
  const type = String(event.actorType || '').toLowerCase()
  const roleLabel = {
    buyer: '买家',
    seller: '卖家',
    system: '系统',
    admin: '平台'
  }[type] || '售后记录'
  const actorName = String(event.actorName || '').trim().replace(/^@/, '')
  return actorName ? `${roleLabel} · @${actorName}` : roleLabel
}

export function getRefundReasonLabel(code) {
  return REASON_LABELS[String(code || '')] || '其他问题'
}

export function getRefundStatusMeta(status) {
  return STATUS_META[String(status || '')] || {
    label: '售后状态未知',
    tone: 'neutral',
    description: '请刷新页面后重试。'
  }
}

export function validateRefundForm(form = {}) {
  const errors = {}
  const reasonCode = String(form.reasonCode || '').trim()
  const reasonDetail = String(form.reasonDetail || '').trim()
  if (!REFUND_REASON_OPTIONS.some(option => option.value === reasonCode)) {
    errors.reasonCode = '请选择退款原因'
  }
  if (reasonDetail.length < 10) {
    errors.reasonDetail = '请至少填写 10 个字，说明遇到的问题'
  } else if (reasonDetail.length > 500) {
    errors.reasonDetail = '问题说明不能超过 500 个字'
  }
  return errors
}

export function validateSellerRejectionReason(value) {
  const reason = String(value || '').trim()
  if (reason.length < 5) return '请至少填写 5 个字，向买家说明拒绝原因'
  if (reason.length > 500) return '拒绝理由不能超过 500 个字'
  return ''
}

export function getRefundErrorMessage(result, fallback = '操作失败，请稍后重试') {
  if (typeof result?.error === 'string') return result.error
  if (result?.error?.message) return result.error.message
  if (result?.message) return result.message
  return fallback
}

export function buildLinuxDoMessageUrl(username, orderNo, role = 'seller') {
  const safeUsername = String(username || '').trim().replace(/^@/, '')
  if (!safeUsername) return ''
  const safeOrderNo = String(orderNo || '').trim()
  const params = new URLSearchParams({
    username: safeUsername,
    title: `LD 士多订单 ${safeOrderNo} 售后协商`,
    body: role === 'buyer'
      ? `你好，我想与你协商 LD 士多订单 ${safeOrderNo} 的退款售后问题。`
      : `你好，我正在处理 LD 士多订单 ${safeOrderNo} 的退款申请，想与你进一步协商。`
  })
  return `https://linux.do/new-message?${params.toString()}`
}

export function formatRefundDate(value) {
  return formatDateTime(value) || '—'
}
