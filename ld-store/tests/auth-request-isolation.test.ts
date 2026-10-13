// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../src/utils/api'
import { authSession, clearAuthSession, setAuthSession } from '../src/utils/auth'
import { storage } from '../src/utils/storage'
import { exportCdkRequest } from '../src/services/shop/inventoryService'
import { authToken } from './helpers/auth'
const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
beforeEach(() => { localStorage.clear(); clearAuthSession(); setAuthSession(authToken()) })
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

it.each([401, 200])('drops old %s responses without expiring the new account', async status => {
  const response = deferred<Response>()
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(response.promise))
  const request = api.get('/api/shop/orders')
  setAuthSession(authToken('22'))
  response.resolve(json({ success: false, code: 'AUTH_INVALID' }, status))
  expect(await request).toMatchObject({ aborted: true, errorCode: 'SESSION_CHANGED' })
  expect(authSession.value.user?.id).toBe('22')
})
it('drops old successful data and rejected network requests', async () => {
  for (const success of [true, false]) {
    const response = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(response.promise))
    const request = api.get('/api/shop/products', { auth: 'optional' })
    setAuthSession(authToken('22'))
    if (success) response.resolve(json({ secret: 'old account' }))
    else response.reject(new Error('old request'))
    expect(await request).toMatchObject({ errorCode: 'SESSION_CHANGED' })
  }
})
it('checks the session again after asynchronously parsing the response body', async () => {
  const body = deferred<unknown>()
  const response = json({})
  response.json = vi.fn().mockReturnValue(body.promise)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
  const request = api.get('/api/shop/orders')
  await vi.waitFor(() => expect(response.json).toHaveBeenCalled())
  setAuthSession(authToken('22'))
  body.resolve({ success: false, code: 'AUTH_INVALID' })
  expect(await request).toMatchObject({ errorCode: 'SESSION_CHANGED' })
  expect(authSession.value.user?.id).toBe('22')
})
it('expires the current account on a real current 401 but public requests cannot expire it', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ code: 'AUTH_INVALID' }, 401)))
  await api.get('/api/shop/products', { auth: 'none' })
  expect(authSession.value.token).toBeTruthy()
  await api.get('/api/shop/orders')
  expect(authSession.value.token).toBeNull()
})
it('blocks mutations when storage changed before the UI received its event', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  storage.set('token', authToken('22'))
  expect(await api.post('/api/shop/orders', { productId: 7 })).toMatchObject({ errorCode: 'SESSION_CHANGED' })
  expect(fetch).not.toHaveBeenCalled()
})
it('isolates stream handshakes and closes the stale response body', async () => {
  const pending = deferred<Response>()
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise))
  const request = api.openEventStream('/api/shop/notifications/stream')
  const response = json({}, 401)
  const cancel = vi.spyOn(response.body!, 'cancel')
  setAuthSession(authToken('22'))
  pending.resolve(response)
  expect(await request).toMatchObject({ errorCode: 'SESSION_CHANGED' })
  expect(cancel).toHaveBeenCalled()
  expect(authSession.value.user?.id).toBe('22')
})
it('exports a CDK file through shared authentication and handles current 401s', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response('secret-cdk', { headers: { 'content-disposition': 'attachment; filename="codes.txt"' } }))
    .mockResolvedValueOnce(json({ message: 'unauthorized' }, 401))
  vi.stubGlobal('fetch', fetch)
  const result = await exportCdkRequest(7)
  expect(result).toMatchObject({ success: true, data: { filename: 'codes.txt' } })
  // Response.blob() can return Node's Blob or jsdom's Blob; size belongs to both.
  if (result.success) expect(result.data.blob.size).toBe(10)
  expect(fetch.mock.calls[0][1].headers.get('Authorization')).toBe(`Bearer ${authToken()}`)
  await exportCdkRequest(7)
  expect(authSession.value.token).toBeNull()
})
it('discards a CDK file if the account changes while its body is downloading', async () => {
  const body = deferred<Blob>()
  const response = new Response('')
  response.blob = vi.fn().mockReturnValue(body.promise)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
  const request = exportCdkRequest(7)
  await vi.waitFor(() => expect(response.blob).toHaveBeenCalled())
  setAuthSession(authToken('22'))
  body.resolve(new Blob(['secret-cdk']))
  expect(await request).toMatchObject({ errorCode: 'SESSION_CHANGED' })
  expect(authSession.value.user?.id).toBe('22')
})
it('handles a download endpoint returning an authentication error inside HTTP 200 JSON', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: false, code: 'AUTH_INVALID' })))
  expect(await exportCdkRequest(7)).toMatchObject({ success: false, errorCode: 'AUTH_INVALID' })
  expect(authSession.value.token).toBeNull()
})
it('does not download an unexpected successful JSON envelope as a CDK file', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: true, data: {} })))
  expect(await exportCdkRequest(7)).toMatchObject({ success: false, kind: 'contract' })
  expect(authSession.value.token).toBeTruthy()
})
