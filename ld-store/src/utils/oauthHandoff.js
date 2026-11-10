import { captureOAuthEvent } from '@/observability/faro'

const KEY = 'ldstore.oauth.pkce'
export async function prepareOAuthHandoff() {
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return { verifier, challenge }
}
export function rememberOAuthState(verifier, state) {
  if (!state) throw new Error('登录校验信息缺失')
  try { sessionStorage.setItem(KEY, JSON.stringify({ verifier, state })) }
  catch {
    captureOAuthEvent('init', 'storage_blocked')
    throw new Error('浏览器会话存储不可用，请允许本站存储后重新登录')
  }
}
// Cross-device clocks are not comparable. The issuer enforces expiry and use count.
export function isOAuthHandoff(data) {
  return data !== null && typeof data === 'object' && !Array.isArray(data)
    && typeof data.c === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(data.c)
    && typeof data.s === 'string' && data.s.length > 0 && data.s.length <= 8192
    && Number.isSafeInteger(data.exp) && data.exp > 0
}
export function consumeOAuthState(state) {
  try {
    const pending = JSON.parse(sessionStorage.getItem(KEY))
    if (!pending) { captureOAuthEvent('callback', 'state_missing'); return null }
    if (pending.state !== state) { captureOAuthEvent('callback', 'state_mismatch'); return null }
    if (typeof pending.verifier !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(pending.verifier)) {
      captureOAuthEvent('callback', 'malformed'); return null
    }
    sessionStorage.removeItem(KEY)
    return pending.verifier
  } catch { captureOAuthEvent('callback', 'storage_blocked'); return null }
}
