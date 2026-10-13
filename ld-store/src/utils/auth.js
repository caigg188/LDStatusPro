import { shallowRef } from 'vue'
import { storage } from './storage'

export const AUTH_EXPIRED_EVENT = 'ld-store:auth-expired'
const AUTH_ERROR_CODES = new Set(['AUTH_REQUIRED', 'AUTH_INVALID', 'AUTH_EXPIRED', 'UNAUTHORIZED', 'INVALID_TOKEN', 'TOKEN_EXPIRED', 'INVALID_OR_EXPIRED_TOKEN'])
const TOKEN_EXPIRE_SKEW_MS = 30 * 1000
const SITES = new Set(['linux.do', 'idcflare.com'])
// JWT 同时承载身份和资料；不再把独立的 user 缓存当作身份来源。
export const authSession = shallowRef({ token: null, user: null, revision: 0, reason: 'initial' })
let initialized = false
let expiryTimer
let listening = false

function decodeJson(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4))
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0))))
}

export function parseJwtPayload(token) {
  if (typeof token !== 'string' || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return null
  try {
    const [header, payload] = token.split('.')
    if (decodeJson(header)?.alg !== 'HS256') return null
    const data = decodeJson(payload)
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null
  } catch { return null }
}

export function isTokenExpired(token, skewMs = TOKEN_EXPIRE_SKEW_MS) {
  const payload = parseJwtPayload(token)
  return !payload || !Number.isSafeInteger(payload.exp) || payload.exp * 1000 <= Date.now() + skewMs
    || (payload.nbf !== undefined && (!Number.isSafeInteger(payload.nbf) || payload.nbf * 1000 > Date.now()))
}

export function getAuthUser(token, suppliedUser) {
  const payload = parseJwtPayload(token)
  if (isTokenExpired(token) || !payload) return null
  const id = String(payload.sub ?? payload.id ?? '')
  const site = payload.site || 'linux.do'
  if (!/^[1-9]\d*$/.test(id) || !SITES.has(site)) return null
  if (suppliedUser !== undefined && (!suppliedUser || typeof suppliedUser !== 'object' || Array.isArray(suppliedUser)
    || String(suppliedUser.id) !== id || (suppliedUser.site || 'linux.do') !== site)) return null
  return {
    id, site, username: payload.username || '', name: payload.name || '',
    avatar: payload.avatar || '', avatar_url: payload.avatar_url || '',
    avatar_template: payload.avatar_template || '', animated_avatar: payload.animated_avatar || '',
    trust_level: payload.trust_level ?? null
  }
}

function scheduleExpiry() {
  clearTimeout(expiryTimer)
  if (!listening || !authSession.value.token) return
  const remaining = parseJwtPayload(authSession.value.token).exp * 1000 - Date.now() - TOKEN_EXPIRE_SKEW_MS
  expiryTimer = setTimeout(syncAuthSession, Math.min(Math.max(remaining, 1), 2147483647))
}

function replaceSession(token, user, reason) {
  initialized = true
  authSession.value = { token, user, revision: authSession.value.revision + 1, reason }
  scheduleExpiry()
}

function expireSession(detail) {
  storage.remove('token')
  storage.remove('user')
  replaceSession(null, null, 'expired')
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
    detail: { ...detail, revision: authSession.value.revision }
  }))
}

export function syncAuthSession() {
  const storedToken = storage.get('token')
  const user = storedToken ? getAuthUser(storedToken) : null
  const previous = authSession.value
  if (storedToken && !user) storage.remove('token')
  if (previous.token && ((!storedToken && isTokenExpired(previous.token)) || storedToken === previous.token && !user)) {
    expireSession({ reason: 'local_token_expired' })
  } else if ((user ? storedToken : null) !== previous.token) {
    replaceSession(user ? storedToken : null, user, 'storage')
  }
  initialized = true
  scheduleExpiry()
  return authSession.value
}

export function captureAuthSession() {
  const previous = authSession.value
  const wasInitialized = initialized
  const current = syncAuthSession()
  return { ...current, changed: wasInitialized && current.revision !== previous.revision }
}

export function isAuthSessionCurrent(snapshot) {
  const current = syncAuthSession()
  return snapshot.revision === current.revision && snapshot.token === current.token
}

export function setAuthSession(token, suppliedUser) {
  const user = getAuthUser(token, suppliedUser)
  if (!user) return false
  const remaining = parseJwtPayload(token).exp * 1000 - Date.now()
  if (!storage.set('token', token, remaining)) return false
  storage.remove('user')
  replaceSession(token, user, 'login')
  return true
}

export function clearAuthSession() {
  storage.remove('token')
  storage.remove('user')
  replaceSession(null, null, 'logout')
}

export function isAuthErrorCode(payload) {
  return AUTH_ERROR_CODES.has(String(payload?.error?.code || payload?.code || '').trim().toUpperCase())
}

export function emitAuthExpired(detail, snapshot) {
  if (!snapshot?.token || !isAuthSessionCurrent(snapshot)) return false
  expireSession(detail)
  return true
}

function reconcileVisibility() {
  if (document.visibilityState === 'visible') syncAuthSession()
}
function reconcileStorage(event) {
  if (event.storageArea === localStorage && (event.key === null || event.key === `${storage.NAMESPACE}token`)) syncAuthSession()
}
export function startAuthSessionSync() {
  if (listening) return
  listening = true
  window.addEventListener('storage', reconcileStorage)
  window.addEventListener('focus', syncAuthSession)
  document.addEventListener('visibilitychange', reconcileVisibility)
  syncAuthSession()
  scheduleExpiry()
}
export function stopAuthSessionSync() {
  listening = false
  clearTimeout(expiryTimer)
  window.removeEventListener('storage', reconcileStorage)
  window.removeEventListener('focus', syncAuthSession)
  document.removeEventListener('visibilitychange', reconcileVisibility)
}
