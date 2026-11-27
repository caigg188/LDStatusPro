import { reactive } from 'vue'

export const ACCOUNT_SUSPENDED_CODE = 'ACCOUNT_SUSPENDED'
export const COMMENT_RESTRICTED_CODE = 'COMMENT_RESTRICTED'
export const ACCOUNT_SANCTION_EVENT = 'ld-store:account-suspended'

const EMPTY = { active: false, reasonCode: '', reason: '', until: null, scopes: [], source: '' }

/** 账号级限制的全局状态：由 403 响应或状态接口写入，供横幅与写操作共用。 */
export const accountSanction = reactive({ ...EMPTY })

let lastKey = ''

function normalizeScopes(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item).map(String) : []
}

function dispatch(next) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ACCOUNT_SANCTION_EVENT, { detail: { ...next } }))
}

export function applyAccountSanction(details = {}, source = 'request') {
  const until = Number(details.until)
  const next = {
    active: true,
    reasonCode: String(details.reasonCode || ''),
    reason: String(details.reason || ''),
    until: Number.isFinite(until) && until > 0 ? until : null,
    scopes: normalizeScopes(details.scopes),
    source
  }
  const key = JSON.stringify(next)
  const changed = key !== lastKey
  lastKey = key
  Object.assign(accountSanction, next)
  if (changed) dispatch(next)
  return changed
}

export function clearAccountSanction() {
  if (!accountSanction.active) return false
  lastKey = ''
  Object.assign(accountSanction, EMPTY)
  dispatch(EMPTY)
  return true
}

/** 从统一错误体里识别账号级限制；其它错误码返回 false。 */
export function applyAccountSanctionFromPayload(payload, source = 'request') {
  if (!payload || typeof payload !== 'object') return false
  const error = payload.error
  if (!error || typeof error !== 'object') return false
  if (error.code !== ACCOUNT_SUSPENDED_CODE) return false
  const details = error.details && typeof error.details === 'object' ? error.details : {}
  return applyAccountSanction({
    reasonCode: details.reasonCode,
    reason: details.reason || error.message,
    until: details.until,
    scopes: details.scopes
  }, source)
}

/** 登录被封禁（login scope 生效）时整站受限。 */
export function isAccountSuspended() {
  return accountSanction.active && (!accountSanction.scopes.length || accountSanction.scopes.includes('login'))
}

/** 评论相关写操作的统一判断：login 封禁同样意味着不能再评论。 */
export function isCommentRestricted() {
  if (!accountSanction.active) return false
  const scopes = accountSanction.scopes
  if (!scopes.length) return true
  return scopes.includes('login') || scopes.includes('comment')
}

export function formatSanctionUntil(until) {
  if (!until) return '长期'
  const date = new Date(Number(until) * 1000)
  if (!Number.isFinite(date.getTime())) return '长期'
  const parts = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  }).formatToParts(date)
  const pick = (type) => parts.find((part) => part.type === type)?.value || ''
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`
}