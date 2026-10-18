import { normalizeResourceId } from '@/utils/resourceId'
import { ref } from 'vue'
import type { ApiResult } from '@/utils/api'
import { captureAuthSession, isAuthSessionCurrent } from '@/utils/auth'

interface Input { productId: string | number; quantity: number; couponClaimId: string | number | null; expectedAmount: number }
interface Pending extends Input { token: string }
interface Created { status?: string; paymentResolutionDeadline?: string | null; orderNo: string; orderId: string | number; paymentUrl?: string | null; paymentState?: string; retryAfterSeconds?: number | null }
interface Lookup { exists: boolean; order: Created | null; legacyIntent?: { productId: string | number; couponClaimId: string | number | null } }
interface Options {
  owner: string
  productId: string | number
  create: (input: Pending) => Promise<ApiResult<Created>>
  lookup: (token: string, legacy?: Pending) => Promise<ApiResult<Lookup>>
  wait?: () => Promise<void>
}
const memory = new Map<string, Pending>()
const prefix = 'ld-store-order-submission:'
function validPending(value: Pending | null, productId: unknown): value is Pending {
  return !!value && value.productId === productId && /^ord_[a-zA-Z0-9_-]{16,80}$/.test(value.token)
    && Number.isInteger(value.quantity) && value.quantity > 0 && Number.isFinite(value.expectedAmount)
    && (value.couponClaimId === null || !!normalizeResourceId(value.couponClaimId))
}

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
  const key = `${prefix}${JSON.stringify([options.owner, options.productId])}`
  const aliases = new Set([key])
  let saved = memory.get(key) || null
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null')
    if (validPending(value, options.productId)) saved = value
  } catch { /* Memory still protects retries when storage is unavailable. */ }
  const pending = ref<Pending | null>(saved)
  const confirmed = ref<Created | null>(null)
  const checking = ref(false)
  const restorationBlocked = ref(false)
  let restored = false
  let restoring: Promise<boolean> | null = null
  let active = true
  const session = captureAuthSession()
  const isActive = () => active && !session.changed && isAuthSessionCurrent(session)
  const stopped = (): ApiResult<Created> => ({ success: false, status: 0, error: '', errorCode: 'SESSION_CHANGED', kind: 'abort', aborted: true, abortReason: 'caller' })

  function persist(value: Pending | null) {
    pending.value = value
    if (value) memory.set(key, value)
    else for (const alias of aliases) memory.delete(alias)
    try {
      if (value) sessionStorage.setItem(key, JSON.stringify(value))
      else for (const alias of aliases) sessionStorage.removeItem(alias)
      return true
    } catch { /* Keep the in-memory intent. */ }
    return false
  }

  const unknown = (): ApiResult<Created> => ({ success: false, status: 0, kind: 'network', aborted: false,
    error: '暂时无法确认订单是否创建，请确认本次订单结果，避免重复兑换。' })

  async function restore() {
    if (restored) return isActive()
    if (restoring) return restoring
    restoring = (async () => {
      checking.value = true
      restorationBlocked.value = false
      try {
        // A direct UUID visit must find old numeric keys too, not only a numeric redirect.
        const candidates = new Map(memory)
        try {
          for (let index = 0; index < sessionStorage.length; index++) {
            const alias = sessionStorage.key(index)
            if (alias?.startsWith(prefix)) {
              try { candidates.set(alias, JSON.parse(sessionStorage.getItem(alias) || 'null')) } catch { /* Ignore corrupt entries. */ }
            }
          }
        } catch { /* In-memory intents remain available when browser storage is blocked. */ }
        if (typeof normalizeResourceId(options.productId) === 'string') {
          for (const [alias, intent] of candidates) {
            let owner, productId
            try { [owner, productId] = JSON.parse(alias.slice(prefix.length)) } catch { continue }
            if (owner !== options.owner || typeof normalizeResourceId(productId) !== 'number'
              || !normalizeResourceId(productId) || !validPending(intent, productId)) continue
            const result = await options.lookup(intent.token, intent)
            if (!isActive()) return false
            const mapped = result.success ? result.data.legacyIntent : null
            if (!mapped || typeof normalizeResourceId(mapped.productId) !== 'string'
              || (mapped.couponClaimId !== null && typeof normalizeResourceId(mapped.couponClaimId) !== 'string')) {
              restorationBlocked.value = true
              continue
            }
            if (normalizeResourceId(mapped.productId) !== normalizeResourceId(options.productId)) continue
            const canonical = { ...intent, productId: options.productId, couponClaimId: mapped.couponClaimId }
            aliases.add(alias)
            if (pending.value && (pending.value.token !== canonical.token
              || pending.value.quantity !== canonical.quantity || pending.value.expectedAmount !== canonical.expectedAmount
              || pending.value.couponClaimId !== canonical.couponClaimId)) {
              restorationBlocked.value = true
              continue
            }
            // Never delete the old durable key until the canonical copy is durable.
            if (persist(canonical)) {
              try { sessionStorage.removeItem(alias) } catch { /* Both aliases are safe to retain. */ }
              memory.delete(alias)
            }
          }
        }
        restored = !restorationBlocked.value
        return restored && isActive()
      } catch {
        restorationBlocked.value = true
        return false
      } finally { checking.value = false }
    })()
    try { return await restoring } finally { restoring = null }
  }

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
    if (!await restore()) return unknown()
    if (checking.value || pending.value || !isActive()) return unknown()
    persist({ ...input, token: `ord_${crypto.randomUUID().replaceAll('-', '')}` })
    checking.value = true
    try { return await send() } finally { checking.value = false }
  }

  async function recover(retry = false) {
    if (!await restore()) return unknown()
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

  return { pending, checking, confirmed, restorationBlocked, restore, submit, recover,
    complete: () => { persist(null); confirmed.value = null },
    stop: () => { active = false } }
}
