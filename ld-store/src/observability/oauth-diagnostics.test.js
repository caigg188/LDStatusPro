import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ pushEvent: vi.fn(), pushError: vi.fn() }))
vi.mock('@grafana/faro-web-sdk', () => ({
  getWebInstrumentations: () => [],
  initializeFaro: () => ({ api: { ...mocks, setView: vi.fn() } })
}))
vi.mock('@grafana/faro-web-tracing', () => ({ TracingInstrumentation: class {} }))
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks()
  vi.stubEnv('VITE_FARO_ENABLED', '1')
  vi.stubEnv('VITE_FARO_COLLECTOR_URL', 'https://collector.invalid/collect')
  vi.stubEnv('VITE_FARO_API_KEY', 'test-only'.repeat(4))
  vi.stubGlobal('navigator', { userAgent: 'fixture-browser' })
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
it('buffers bounded, allowlisted OAuth diagnostics and excludes all callback credentials', async () => {
  const telemetry = await import('./faro')
  const sensitive = 'must-never-be-exported'
  for (let i = 0; i < 25; i++) telemetry.captureOAuthEvent('exchange', 'invalid_grant', {
    status: 401, requestId: '12345678-1234-1234-1234-123456789abc', code: sensitive,
    state: sensitive, verifier: sensitive, url: `https://store.invalid/#${sensitive}`, expiresAt: Date.now() + 120000
  })
  await telemetry.initializeStorefrontTelemetry()
  expect(mocks.pushEvent).toHaveBeenCalledTimes(20)
  expect(JSON.stringify(mocks.pushEvent.mock.calls)).not.toContain(sensitive)
  expect(mocks.pushEvent.mock.calls[0][1]).toMatchObject({ stage: 'exchange', reason: 'invalid_grant', http_status: '401', remaining_bucket: 'over_60s' })
  telemetry.captureOAuthEvent(sensitive, 'invalid_grant')
  telemetry.captureOAuthEvent('exchange', sensitive)
  expect(mocks.pushEvent).toHaveBeenCalledTimes(20)
})
it('respects privacy preferences and does not emit diagnostics with DNT', async () => {
  vi.stubGlobal('navigator', { doNotTrack: '1' })
  const telemetry = await import('./faro')
  telemetry.captureOAuthEvent('init', 'started')
  await telemetry.initializeStorefrontTelemetry()
  expect(mocks.pushEvent).not.toHaveBeenCalled()
})
it('never interrupts login when the telemetry SDK throws', async () => {
  const telemetry = await import('./faro')
  await telemetry.initializeStorefrontTelemetry()
  mocks.pushEvent.mockImplementationOnce(() => { throw new Error('fixture telemetry unavailable') })
  expect(() => telemetry.captureOAuthEvent('init', 'started')).not.toThrow()
})
