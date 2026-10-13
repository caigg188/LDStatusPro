// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AuthCallback from '../src/views/AuthCallback.vue'
import { authSession, clearAuthSession, setAuthSession } from '../src/utils/auth'
import { authToken } from './helpers/auth'
import { Buffer } from 'node:buffer'
const mocks = vi.hoisted(() => ({ replace: vi.fn().mockResolvedValue(undefined), success: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: { redirect: '/product/7' } }), useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ success: mocks.success }) }))
let wrapper: VueWrapper | undefined
beforeEach(() => { localStorage.clear(); clearAuthSession(); setActivePinia(createPinia()); vi.clearAllMocks() })
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.unstubAllGlobals(); vi.restoreAllMocks() })
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
function callback(token = authToken(), id = '11', query = false) {
  const data = Buffer.from(JSON.stringify({ t: token, u: { id, site: 'linux.do' }, j: 1 })).toString('base64')
  history.replaceState(null, '', `/auth/callback${query ? `?ldsp_oauth=${encodeURIComponent(data)}&redirect=/product/7` : `#ldsp_oauth=${data}`}`)
  wrapper = mount(AuthCallback, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
}
const verified = () => json({ success: true, data: { authenticated: true, user: { id: '11', site: 'linux.do' } } })
it('removes callback credentials immediately, verifies before persistence and redirects only after success', async () => {
  let resolve!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(yes => { resolve = yes })))
  callback(authToken(), '11', true)
  expect(location.href).not.toContain('ldsp_oauth')
  expect(authSession.value.token).toBeNull()
  expect(mocks.success).not.toHaveBeenCalled()
  resolve(verified()); await flushPromises()
  expect(authSession.value.user?.id).toBe('11')
  expect(mocks.success).toHaveBeenCalledWith('登录成功')
  expect(mocks.replace).toHaveBeenCalledWith('/product/7')
})
it.each([401, 403, 500])('does not commit or report success after HTTP %s', async status => {
  setAuthSession(authToken('22'))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: false }, status)))
  callback(); await flushPromises()
  expect(authSession.value.user?.id).toBe('22')
  expect(mocks.success).not.toHaveBeenCalled()
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(wrapper!.text()).toContain(status >= 500 ? '暂时不可用' : '校验失败')
})
it('retries a transient network failure without claiming success prematurely', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(verified())
  vi.stubGlobal('fetch', fetch)
  callback(); await flushPromises()
  expect(authSession.value.token).toBeNull()
  expect(wrapper!.text()).toContain('暂未完成')
  await wrapper!.get('button').trigger('click'); await flushPromises()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(mocks.success).toHaveBeenCalledTimes(1)
})
it.each(['invalid-token', authToken('11', { exp: 1 }), authToken('22')])('rejects invalid or mismatched callback data before contacting the server', async token => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  callback(token); await flushPromises()
  expect(fetch).not.toHaveBeenCalled()
  expect(authSession.value.token).toBeNull()
  expect(wrapper!.text()).toContain('无效或已过期')
})
it.each([
  { success: true, data: { authenticated: false, user: { id: '11' } } },
  { success: true, data: { authenticated: true, user: { id: '22' } } },
  { success: true, data: {} },
])('requires authenticated server confirmation with the same identity', async payload => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(payload)))
  callback(); await flushPromises()
  expect(authSession.value.token).toBeNull()
  expect(mocks.success).not.toHaveBeenCalled()
})
it('cannot overwrite a new cross-tab login while validation is pending', async () => {
  let resolve!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(yes => { resolve = yes })))
  callback(); setAuthSession(authToken('22'))
  resolve(verified()); await flushPromises()
  expect(authSession.value.user?.id).toBe('22')
  expect(mocks.success).not.toHaveBeenCalled()
  expect(wrapper!.text()).toContain('其他页面变更')
})
it('does not log in after leaving the callback, and aborts its request', async () => {
  let resolve!: (response: Response) => void
  const fetch = vi.fn((_url: string, _options: RequestInit) => new Promise<Response>(yes => { resolve = yes }))
  vi.stubGlobal('fetch', fetch)
  callback(); wrapper!.unmount(); wrapper = undefined
  expect(fetch.mock.calls[0][1].signal?.aborted).toBe(true)
  resolve(verified()); await flushPromises()
  expect(authSession.value.token).toBeNull()
})
it('reports storage failure without false success', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(verified()))
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  callback(); await flushPromises()
  expect(authSession.value.token).toBeNull()
  expect(mocks.success).not.toHaveBeenCalled()
  expect(wrapper!.text()).toContain('无法保存')
})
