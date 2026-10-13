// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, normalizeResponsePayload } from './api'
import { authToken } from '../../tests/helpers/auth'
import { clearAuthSession, setAuthSession } from './auth'
import { storage } from './storage'

function mockResponse(body, { status = 200, contentType = 'application/json' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => name.toLowerCase() === 'content-type' ? contentType : ''
    },
    json: async () => typeof body === 'string' ? JSON.parse(body) : body,
    text: async () => typeof body === 'string' ? body : JSON.stringify(body)
  }
}

function abortableFetch(_url, options) {
  return new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

describe('API request lifecycle', () => {
  beforeEach(() => {
    storage.clear()
    clearAuthSession()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('does not send a JSON content type for GET or other requests without a body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ success: true }))
    vi.stubGlobal('fetch', fetchMock)

    await api.get('/api/shop/products', { auth: 'none' })
    await api.post('/api/shop/products/1/favorite', undefined, { auth: 'none' })

    for (const [, options] of fetchMock.mock.calls) {
      expect(options.body).toBeUndefined()
      expect(options.headers.has('content-type')).toBe(false)
    }
  })

  it('keeps required and unclassified requests off the network when logged out', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/api/shop/merchant/enforcement', { auth: 'required' })).resolves.toEqual({
      success: false,
      status: 401,
      error: '请先登录后再继续',
      errorCode: 'AUTH_REQUIRED',
      aborted: false,
      kind: 'http'
    })
    await expect(api.get('/api/shop/unclassified')).resolves.toMatchObject({
      success: false,
      status: 401,
      errorCode: 'AUTH_REQUIRED'
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('can force a public request to omit a stored token', async () => {
    setAuthSession(authToken())
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ success: true }))
    vi.stubGlobal('fetch', fetchMock)

    await api.get('/api/shop/system-status', { auth: 'none' })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers.has('Authorization')).toBe(false)
  })

  it('serializes JSON bodies and adds the JSON content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ success: true }))
    vi.stubGlobal('fetch', fetchMock)

    await api.post('/api/shop/orders', { productId: 7 }, { auth: 'none' })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.body).toBe('{"productId":7}')
    expect(options.headers.get('Content-Type')).toBe('application/json')
  })

  it('passes FormData through without setting a multipart content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ success: true }))
    vi.stubGlobal('fetch', fetchMock)
    const formData = new FormData()
    formData.append('file', 'value')

    await api.upload('/api/image/upload', formData, { auth: 'none' })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.body).toBe(formData)
    expect(options.headers.has('content-type')).toBe(false)
  })

  it('attaches the storefront token to authenticated image host requests', async () => {
    setAuthSession(authToken())
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ success: true }))
    vi.stubGlobal('fetch', fetchMock)

    await api.get('/api/image/history')
    await api.get('/api/image/price-info', { auth: 'required' })
    await api.upload('/api/image/upload', new FormData(), { auth: 'required' })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.headers.get('Authorization')).toBe(`Bearer ${storage.get('token')}`)
    }
  })

  it('distinguishes caller cancellation from request timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(abortableFetch))
    const caller = new AbortController()
    const callerRequest = api.get('/api/shop/products', { auth: 'none', signal: caller.signal })
    caller.abort()

    await expect(callerRequest).resolves.toEqual({
      success: false,
      status: 0,
      error: '',
      aborted: true,
      abortReason: 'caller',
      kind: 'abort'
    })

    vi.useFakeTimers()
    const timeoutRequest = api.get('/api/shop/products', { auth: 'none', timeout: 25 })
    await vi.advanceTimersByTimeAsync(25)

    await expect(timeoutRequest).resolves.toEqual({
      success: false,
      status: 0,
      error: '',
      aborted: true,
      abortReason: 'timeout',
      kind: 'abort'
    })
  })

  it('normalizes 401, non-JSON, nested legacy responses and network failures', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResponse({ message: '请重新登录' }, { status: 401 }))
      .mockResolvedValueOnce(mockResponse('plain response', { contentType: 'text/plain' }))
      .mockResolvedValueOnce(mockResponse({ success: true, data: { success: true, data: { id: 9 } } }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/api/shop/orders', { auth: 'none' })).resolves.toMatchObject({ success: false, status: 401, error: '请重新登录' })
    await expect(api.get('/api/status', { auth: 'none' })).resolves.toEqual({ success: true, status: 200, data: 'plain response' })
    await expect(api.get('/api/shop/products/9', { auth: 'none' })).resolves.toEqual({ success: true, status: 200, data: { id: 9 } })
    await expect(api.get('/api/status', { auth: 'none' })).resolves.toEqual({
      success: false,
      status: 0,
      error: '网络连接异常，请检查网络后重试',
      aborted: false,
      kind: 'network'
    })
  })

  it('keeps falsy legacy payload data during response normalization', () => {
    expect(normalizeResponsePayload({ success: true, data: { success: true, data: 0 } })).toEqual({ success: true, status: 200, data: 0 })
    expect(normalizeResponsePayload({ success: true, data: { success: true, data: null } })).toEqual({ success: true, status: 200, data: null })
    expect(normalizeResponsePayload({ success: true, data: 0 })).toEqual({ success: true, status: 200, data: 0 })
    expect(normalizeResponsePayload({ success: true, reportId: 7 })).toEqual({ success: true, status: 200, data: { reportId: 7 }, reportId: 7 })
  })

  it('normalizes successful and failed payload envelopes without losing metadata', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResponse({ success: true, auth_url: 'https://example.test/login' }))
      .mockResolvedValueOnce(mockResponse({ success: false, status: 409, error: { code: 'STALE', message: '状态已更新' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/api/auth/init', { auth: 'none' })).resolves.toEqual({
      success: true,
      status: 200,
      data: { auth_url: 'https://example.test/login' },
      auth_url: 'https://example.test/login'
    })
    await expect(api.get('/api/shop/products', { auth: 'none' })).resolves.toEqual({
      success: false,
      status: 409,
      error: '状态已更新',
      errorCode: 'STALE',
      aborted: false,
      kind: 'http'
    })
  })
})
