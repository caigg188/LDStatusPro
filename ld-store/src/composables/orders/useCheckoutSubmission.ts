import { ref } from 'vue'
import type { ApiResult } from '@/utils/api'
import { captureAuthSession, isAuthSessionCurrent } from '@/utils/auth'

interface Input { productId: number; quantity: number; couponClaimId: number | null; expectedAmount: number }
interface Pending extends Input { token: string }
interface Created { status?: string; paymentResolutionDeadline?: string | null; orderNo: string; orderId: string | number; paymentUrl?: string | null; paymentState?: string; retryAfterSeconds?: number | null }
interface Options {
  owner: string
  productId: number
  create: (input: Pending) => Promise<ApiResult<Created>>
  lookup: (token: string) => Promise<ApiResult<{ exists: boolean; order: Created | null }>>
  wait?: () => Promise<void>
}
const memory = new Map<string, Pending>()

export function getCheckoutSubmissionError(result: unknown) {
  const failure = result && typeof result === 'object'
    ? result as { errorCode?: string; error?: unknown }
    : null
  if (failure?.errorCode === 'FULFILLMENT_RULE_NOT_ACCEPTED') {
    return '该物品暂时无法兑换：卖家尚未确认最新发货规则。请稍后再试或选择其他物品。'
  }
  if (failure?.error && typeof failure.error === 'object') {
    const nested = failure.error as { message?: unknown; code?: unknown }
    return String(nested.message || nested.code || '创建订单失败，请重新确认')
  }
  return String(failure?.error || '创建订单失败，请重新确认')
}

export function useCheckoutSubmission(options: Options) {
  const key = `ld-store-order-submission:${JSON.stringify([options.owner, options.productId])}`
  let saved = memory.get(key) || null
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null')
    if (value?.productId === options.productId && /^ord_[a-zA-Z0-9_-]{16,80}$/.test(value?.token)
      && Number.isInteger(value.quantity) && value.quantity > 0 && Number.isFinite(value.expectedAmount)
      && (value.couponClaimId === null || Number.isInteger(value.couponClaimId))) saved = value
  } catch { /* Memory still protects retries when storage is unavailable. */ }
  const pending = ref<Pending | null>(saved)
  const confirmed = ref<Created | null>(null)
  const checking = ref(false)
  let active = true
  const session = captureAuthSession()
  const isActive = () => active && !session.changed && isAuthSessionCurrent(session)
  const stopped = (): ApiResult<Created> => ({ success: false, status: 0, error: '', errorCode: 'SESSION_CHANGED', kind: 'abort', aborted: true, abortReason: 'caller' })

  function persist(value: Pending | null) {
    pending.value = value
    if (value) memory.set(key, value)
    else memory.delete(key)
    try {
      if (value) sessionStorage.setItem(key, JSON.stringify(value))
      else sessionStorage.removeItem(key)
    } catch { /* Keep the in-memory intent. */ }
  }

  const unknown = (): ApiResult<Created> => ({ success: false, status: 0, kind: 'network', aborted: false,
    error: '暂时无法确认订单是否创建，请确认本次订单结果，避免重复兑换。' })

  async function lookup() {
    for (let attempt = 0; attempt < 3 && isActive() && pending.value; attempt++) {
      try {
        const result = await options.lookup(pending.value.token)
        if (!isActive()) return stopped()
        if (result.success && result.data.exists && result.data.order) {
          confirmed.value = result.data.order
          return { success: true as const, status: 200, data: result.data.order }
        }
      } catch { /* Read failure does not establish whether the mutation committed. */ }
      if (attempt < 2 && isActive()) await (options.wait?.() ?? new Promise(resolve => setTimeout(resolve, 700)))
    }
    return isActive() ? unknown() : stopped()
  }

  async function send(): Promise<ApiResult<Created>> {
    if (!isActive()) return stopped()
    if (!pending.value) return unknown()
    let result: ApiResult<Created>
    try { result = await options.create({ ...pending.value }) } catch { result = unknown() }
    if (!isActive() || (!result.success && result.errorCode === 'SESSION_CHANGED')) return stopped()
    if (result.success) { confirmed.value = result.data; return result }
    const uncertain = result.status === 0 || result.status >= 500 || result.kind === 'contract'
      || result.errorCode === 'ORDER_SUBMISSION_CONFLICT'
    if (!uncertain) { persist(null); return result }
    return lookup()
  }

  async function submit(input: Input) {
    if (checking.value || pending.value || !isActive()) return unknown()
    persist({ ...input, token: `ord_${crypto.randomUUID().replaceAll('-', '')}` })
    checking.value = true
    try { return await send() } finally { checking.value = false }
  }

  async function recover(retry = false) {
    if (checking.value || !pending.value || !isActive()) return unknown()
    checking.value = true
    try {
      if (confirmed.value && (['cancelled', 'expired', 'paid', 'delivered', 'completed'].includes(confirmed.value.status || '') || !['pending', 'creating', 'unknown'].includes(confirmed.value.paymentState || ''))) return { success: true as const, status: 200, data: confirmed.value }
      const result = await lookup()
      // Only an explicit retry replays the exact original payload and token.
      // Backend checks the original expected amount before creating anything.
      return !result.success && retry && isActive() ? await send() : result
    } finally { checking.value = false }
  }

  return { pending, checking, confirmed, submit, recover, complete: () => { persist(null); confirmed.value = null }, stop: () => { active = false } }
}
