// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureAuthSession, clearAuthSession, setAuthSession } from '@/utils/auth'
import { authToken } from '../../../tests/helpers/auth'
import { reportDuo } from './duoTelemetry'

const ok = () => new Response('{"accepted":1}', {
  status: 202,
  headers: { 'Content-Type': 'application/json' }
})

let fetchMock

beforeEach(() => {
  vi.useFakeTimers()
  clearAuthSession()
  fetchMock = vi.fn(async () => ok())
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(async () => {
  clearAuthSession()
  await vi.runAllTimersAsync()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function payloads() {
  return fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).events)
}

describe('DUO+ telemetry', () => {
  it('batches all event types under the existing route limit', async () => {
    const token = authToken()
    setAuthSession(token)
    const types = ['impression', 'click', 'observation']
    const events = Array.from({ length: 23 }, (_, index) => ({ token: `ticket-${index}`, type: types[index % types.length] }))
    for (const event of events) reportDuo(event.token, event.type)
    expect(fetchMock).not.toHaveBeenCalled()

    await vi.runAllTimersAsync()
    expect(payloads().map(batch => batch.length)).toEqual([20, 3])
    expect(payloads().flat()).toEqual(events)
    for (const [url, options] of fetchMock.mock.calls) {
      expect(url).toMatch(/\/api\/shop\/duo-plus\/events$/)
      expect(options.headers.get('Authorization')).toBe(`Bearer ${token}`)
    }
  })

  it('keeps each serialized request within the byte limit', async () => {
    setAuthSession(authToken())
    for (let index = 0; index < 9; index++) reportDuo('界'.repeat(4096), 'observation')

    await vi.runAllTimersAsync()
    expect(payloads().map(batch => batch.length)).toEqual([2, 2, 2, 2, 1])
    for (const [, { body }] of fetchMock.mock.calls) {
      expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(32 * 1024)
    }
  })

  it('discards old and signed-out events when the session changes before a flush', async () => {
    reportDuo('guest', 'click')
    setAuthSession(authToken('11'))
    const oldSession = captureAuthSession()
    reportDuo('old', 'impression', oldSession)
    const newToken = authToken('22')
    setAuthSession(newToken)
    reportDuo('stale-observer', 'observation', oldSession)
    reportDuo('new', 'click')

    await vi.runAllTimersAsync()
    expect(payloads()).toEqual([[{ token: 'new', type: 'click' }]])
    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe(`Bearer ${newToken}`)
  })

  it('pauses the queue for a minute on 429 and retries the same batch', async () => {
    setAuthSession(authToken())
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 }))
    reportDuo('limited', 'impression')
    await vi.advanceTimersByTimeAsync(150)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    reportDuo('later', 'observation')
    await vi.advanceTimersByTimeAsync(59_999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)

    expect(payloads()).toEqual([
      [{ token: 'limited', type: 'impression' }],
      [{ token: 'limited', type: 'impression' }],
      [{ token: 'later', type: 'observation' }]
    ])
  })

  it('drops a delayed retry after session replacement and sends the new session promptly', async () => {
    setAuthSession(authToken('11'))
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 }))
    reportDuo('old', 'click')
    await vi.advanceTimersByTimeAsync(150)

    const newToken = authToken('22')
    setAuthSession(newToken)
    reportDuo('new', 'impression')
    await vi.advanceTimersByTimeAsync(150)
    expect(payloads()).toEqual([[{ token: 'old', type: 'click' }], [{ token: 'new', type: 'impression' }]])
    expect(fetchMock.mock.calls[1][1].headers.get('Authorization')).toBe(`Bearer ${newToken}`)

    await vi.runAllTimersAsync()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
