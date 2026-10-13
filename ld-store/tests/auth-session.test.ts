// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AUTH_EXPIRED_EVENT, authSession, captureAuthSession, clearAuthSession, emitAuthExpired, getAuthUser, isAuthSessionCurrent, isTokenExpired, setAuthSession, startAuthSessionSync, stopAuthSessionSync, syncAuthSession } from '../src/utils/auth'
import { useUserStore } from '../src/stores/user'
import { storage } from '../src/utils/storage'
import { authToken } from './helpers/auth'

beforeEach(() => { localStorage.clear(); clearAuthSession(); setActivePinia(createPinia()) })
afterEach(() => { stopAuthSessionSync(); vi.useRealTimers(); vi.restoreAllMocks() })
const storageEvent = (key: string | null = 'ld_store_token') => window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }))

describe('shared storefront session', () => {
  it.each([
    ['broken', 'broken'], ['missing exp', authToken('11', { exp: undefined })],
    ['string exp', authToken('11', { exp: '4102444800' })], ['expired', authToken('11', { exp: 1 })],
    ['future nbf', authToken('11', { nbf: 4102444700 })], ['missing id', authToken('11', { sub: null })],
    ['username as id', authToken('buyer')], ['unknown site', authToken('11', { site: 'unknown.test' })],
  ])('rejects %s without destroying the active account', async (_name, invalid) => {
    const store = useUserStore()
    await store.login(authToken('22'), { id: '22', site: 'linux.do' })
    expect(isTokenExpired(invalid) || !getAuthUser(invalid)).toBe(true)
    expect(await store.login(invalid, { id: '11', site: 'linux.do' })).toBe(false)
    expect(store.currentUser?.id).toBe('22')
    expect(storage.get('token')).toBe(authToken('22'))
  })

  it('derives identity, privileges and UTF-8 profile from the JWT; rejects callback identity conflicts', async () => {
    const token = authToken('11', { name: '中文名字', username: 'new-name', avatar_url: 'https://linux.do/avatar/new.png' })
    expect(getAuthUser(token, { id: '22', site: 'linux.do' })).toBeNull()
    expect(getAuthUser(token, { id: '11', site: 'idcflare.com' })).toBeNull()
    expect(setAuthSession(token, { id: 11, site: 'linux.do', trust_level: 4, username: 'stale-name' })).toBe(true)
    const store = useUserStore()
    expect(store.currentUser).toMatchObject({ id: '11', name: '中文名字', username: 'new-name', trust_level: 2 })
    expect(store.trustLevel).toBe(2)
    expect(store.avatarCandidates.some((url: string) => url.includes('/avatar/new.png'))).toBe(true)
  })

  it('restores old installations from the token while ignoring conflicting cached user data', () => {
    storage.set('token', authToken('11'))
    storage.set('user', { id: '22', site: 'idcflare.com' })
    const store = useUserStore()
    expect(store.restoreSession()).toBe(true)
    expect(store.user).toMatchObject({ id: '11', site: 'linux.do' })
    storage.set('token', authToken('11', { site: 'idcflare.com' }))
    expect(store.restoreSession()).toBe(true)
    expect(store.user.site).toBe('idcflare.com')
  })

  it('uses JWT lifetime for persistence and preserves the active session on storage failure', () => {
    const token = authToken('11', { exp: Math.floor(Date.now() / 1000) + 900 })
    setAuthSession(token)
    expect(JSON.parse(localStorage.getItem('ld_store_token')!).expire).toBeLessThanOrEqual(Date.now() + 900000)
    expect(JSON.parse(localStorage.getItem('ld_store_token')!).expire).toBeGreaterThan(Date.now() + 899000)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(setAuthSession(authToken('22'))).toBe(false)
    expect(authSession.value.user?.id).toBe('11')
  })

  it('synchronizes cross-tab login, logout and clear, and recovers missed events on focus', () => {
    startAuthSessionSync()
    const store = useUserStore()
    setAuthSession(authToken('11'))
    const previousKey = store.sessionKey
    storage.set('token', authToken('22'))
    storageEvent()
    expect(store.user?.id).toBe('22')
    expect(store.sessionKey).not.toBe(previousKey)
    storage.remove('token'); storageEvent()
    expect(store.isLoggedIn).toBe(false)
    storage.set('token', authToken('11')); window.dispatchEvent(new Event('focus'))
    expect(store.isLoggedIn).toBe(true)
    localStorage.clear(); storageEvent(null)
    expect(store.isLoggedIn).toBe(false)
  })

  it('expires an idle session reactively and emits once, then accepts a new session without cooldown suppression', () => {
    vi.useFakeTimers()
    startAuthSessionSync()
    const events: Event[] = []
    const handler = (event: Event) => events.push(event)
    window.addEventListener(AUTH_EXPIRED_EVENT, handler)
    try {
      setAuthSession(authToken('11', { exp: Math.floor(Date.now() / 1000) + 31 }))
      const lease = captureAuthSession()
      vi.advanceTimersByTime(1100)
      expect(useUserStore().isLoggedIn).toBe(false)
      expect(storage.get('token')).toBeNull()
      expect(emitAuthExpired({}, lease)).toBe(false)
      expect(events).toHaveLength(1)
      setAuthSession(authToken('22'))
      expect(emitAuthExpired({}, captureAuthSession())).toBe(true)
      expect(events).toHaveLength(2)
    } finally { window.removeEventListener(AUTH_EXPIRED_EVENT, handler) }
  })

  it('rejects a stale lease even after reauthorizing the same account and invalidates same-user caches', () => {
    setAuthSession(authToken())
    const lease = captureAuthSession()
    const store = useUserStore()
    const oldKey = store.sessionKey
    setAuthSession(authToken())
    expect(isAuthSessionCurrent(lease)).toBe(false)
    expect(store.sessionKey).not.toBe(oldKey)
    expect(emitAuthExpired({}, lease)).toBe(false)
    expect(store.isLoggedIn).toBe(true)
  })

  it('does not adopt a different stored identity silently in a request snapshot', () => {
    setAuthSession(authToken())
    storage.set('token', authToken('22'))
    const lease = captureAuthSession()
    expect(lease.changed).toBe(true)
    expect(lease.user.id).toBe('22')
    expect(captureAuthSession().changed).toBe(false)
    storage.set('token', 'invalid'); syncAuthSession()
    expect(useUserStore().isLoggedIn).toBe(false)
  })
})
it('rearms the expiry timer for sessions longer than the browser timer limit', () => {
  vi.useFakeTimers()
  startAuthSessionSync()
  setAuthSession(authToken('11', { exp: Math.floor(Date.now() / 1000) + 30 * 86400 }))
  vi.advanceTimersByTime(25 * 86400000)
  expect(useUserStore().isLoggedIn).toBe(true)
  vi.advanceTimersByTime(5 * 86400000)
  expect(useUserStore().isLoggedIn).toBe(false)
})
