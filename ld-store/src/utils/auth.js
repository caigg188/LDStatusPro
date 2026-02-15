import { storage } from './storage'

export const AUTH_EXPIRED_EVENT = 'ld-store:auth-expired'

const AUTH_ERROR_CODES = new Set([
  'AUTH_REQUIRED',
  'AUTH_INVALID',
  'AUTH_EXPIRED',
  'UNAUTHORIZED',
  'INVALID_TOKEN',
  'TOKEN_EXPIRED',
  'INVALID_OR_EXPIRED_TOKEN'
])

const TOKEN_EXPIRE_SKEW_MS = 30 * 1000
const AUTH_EVENT_COOLDOWN_MS = 1200

let lastAuthExpiredEventAt = 0

function decodeBase64Url(input) {
  const normalized = String(input || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  return atob(padded)
}

function parseJwtPayload(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const json = decodeBase64Url(parts[1])
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function isTokenExpired(token, skewMs = TOKEN_EXPIRE_SKEW_MS) {
  const payload = parseJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return false
  return payload.exp * 1000 <= Date.now() + skewMs
}

export function isAuthErrorCode(payload) {
  const code = String(payload?.error?.code || payload?.code || '').trim().toUpperCase()
  if (!code) return false
  return AUTH_ERROR_CODES.has(code)
}

function clearStoredAuth() {
  storage.remove('token')
  storage.remove('user')
}

export function emitAuthExpired(detail = {}) {
  clearStoredAuth()

  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return

  const now = Date.now()
  if (now - lastAuthExpiredEventAt < AUTH_EVENT_COOLDOWN_MS) return
  lastAuthExpiredEventAt = now

  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
    detail: {
      ...detail,
      at: now
    }
  }))
}
