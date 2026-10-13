// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNotificationSummaryStore } from '../src/stores/notificationSummary'
import { clearAuthSession, setAuthSession } from '../src/utils/auth'
import { authToken } from './helpers/auth'
const mocks = vi.hoisted(() => ({ get: vi.fn(), openEventStream: vi.fn() }))
vi.mock('@/utils/api', () => ({ api: mocks }))
beforeEach(() => { localStorage.clear(); clearAuthSession(); setActivePinia(createPinia()); vi.clearAllMocks() })
afterEach(() => vi.unstubAllGlobals())
it('partitions notification broadcasts and leadership leases by forum and numeric identity', () => {
  const names: string[] = []
  vi.stubGlobal('BroadcastChannel', class {
    constructor(name: string) { names.push(name) }
    addEventListener() {} removeEventListener() {} postMessage() {} close() {}
  })
  mocks.get.mockResolvedValue({ success: true, data: {} })
  mocks.openEventStream.mockResolvedValue({ success: false, status: 401 })
  const store = useNotificationSummaryStore()
  setAuthSession(authToken('11'))
  store.startRealtime()
  expect(Object.keys(localStorage).some(key => key.includes('leader-v2:["linux.do","11"]'))).toBe(true)
  store.stopRealtime()
  setAuthSession(authToken('11', { site: 'idcflare.com' }))
  store.startRealtime()
  expect(names).toEqual(['ld-store-notification-summary-v2:["linux.do","11"]', 'ld-store-notification-summary-v2:["idcflare.com","11"]'])
  expect(Object.keys(localStorage).some(key => key.includes('leader-v2:["idcflare.com","11"]'))).toBe(true)
  store.stopRealtime()
})
