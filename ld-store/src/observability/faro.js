import { sanitizeError, sanitizeTelemetryItem } from './privacy'

// 当前商城访问量较低，10% 会话采样会形成数小时甚至数天的数据盲区。
// 默认采集全部“符合隐私条件”的会话；GPC/DNT 和自动化浏览器仍会在初始化前被排除。
const DEFAULT_SAMPLE_RATE = 1
const DEFAULT_API_ORIGINS = [
  'https://api.ldspro.qzz.io',
  'https://api1.ldspro.qzz.io',
  'https://api2.ldspro.qzz.io'
]
const NOTIFICATION_STREAM_PATTERN = /\/api\/shop\/notifications\/stream(?:\?|$)/
const pendingErrors = []
const pendingOAuthEvents = []
const BUILD_VERSION = import.meta.env.VITE_BUILD_VERSION

let faroInstance = null
let initializationPromise = null

function envFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

function clampSampleRate(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_SAMPLE_RATE
  return Math.min(1, Math.max(0, parsed))
}

function isAutomatedBrowser(navigatorLike) {
  if (!navigatorLike) return false
  return Boolean(
    navigatorLike.webdriver
    || /(?:bot|crawler|spider|headlesschrome|lighthouse)/i.test(navigatorLike.userAgent || '')
  )
}

function privacySignalEnabled(navigatorLike) {
  if (!navigatorLike) return false
  return navigatorLike.globalPrivacyControl === true || navigatorLike.doNotTrack === '1'
}

function validCollectorUrl(value, locationLike, isProduction) {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value, locationLike?.origin)
    const isLocalDevelopment = !isProduction && ['localhost', '127.0.0.1'].includes(url.hostname)
    if (url.protocol !== 'https:' && !isLocalDevelopment) return ''
    if (url.username || url.password) return ''
    if (!url.pathname.endsWith('/collect')) return ''
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

export function resolveTelemetryConfig(
  env = import.meta.env,
  navigatorLike = globalThis.navigator,
  locationLike = globalThis.location
) {
  const enabled = envFlag(env.VITE_FARO_ENABLED)
  const collectorUrl = validCollectorUrl(env.VITE_FARO_COLLECTOR_URL, locationLike, env.PROD === true)
  const apiKey = String(env.VITE_FARO_API_KEY || '').trim()
  const blocked = privacySignalEnabled(navigatorLike) || isAutomatedBrowser(navigatorLike)

  return {
    enabled: Boolean(enabled && collectorUrl && apiKey.length >= 16 && !blocked),
    collectorUrl,
    apiKey,
    sampleRate: clampSampleRate(env.VITE_FARO_SESSION_SAMPLE_RATE),
    environment: env.VITE_DEPLOYMENT_ENVIRONMENT || (env.PROD === true ? 'production' : 'development'),
    version: env.VITE_APP_VERSION || env.VITE_BUILD_VERSION || BUILD_VERSION || 'development'
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function resolveTraceHeaderCorsUrls(
  env = import.meta.env,
  locationLike = globalThis.location
) {
  const candidates = [
    ...DEFAULT_API_ORIGINS,
    env.VITE_API_BASE,
    env.VITE_AUTH_API_BASE,
    env.VITE_IMAGE_API_BASE
  ]

  return [...new Set(candidates.filter(Boolean).flatMap((candidate) => {
    try {
      const url = new URL(candidate, locationLike?.origin)
      if (!['http:', 'https:'].includes(url.protocol)) return []
      return [url.origin]
    } catch {
      return []
    }
  }))].map((origin) => new RegExp(`^${escapeRegExp(origin)}(?:/|$)`))
}

export function resolveTelemetryIgnoreUrls() {
  return [NOTIFICATION_STREAM_PATTERN]
}

function routeViewName(route) {
  const routeRecord = route?.matched?.[route.matched.length - 1]
  return String(routeRecord?.path || route?.name || 'unknown').slice(0, 120)
}

function flushPendingErrors() {
  if (!faroInstance) return
  pendingErrors.splice(0).forEach(({ error, context }) => {
    faroInstance.api.pushError(error, { context })
  })
  pendingOAuthEvents.splice(0).forEach(attributes => faroInstance.api.pushEvent('oauth_handoff', attributes, 'auth'))
}

export function captureStorefrontError(error, context = {}) {
  const config = resolveTelemetryConfig()
  if (!config.enabled) return

  const safeError = sanitizeError(error)
  const safeContext = sanitizeTelemetryItem({ ...context }) || {}
  if (faroInstance) {
    faroInstance.api.pushError(safeError, { context: safeContext })
    return
  }

  if (pendingErrors.length < 5) pendingErrors.push({ error: safeError, context: safeContext })
}

// Explicit allowlist: no callback URL, code, state, verifier, identity or token.
const OAUTH_STAGES = new Set(['init', 'callback', 'exchange', 'verify', 'session'])
const OAUTH_REASONS = new Set(['started', 'accepted', 'malformed', 'state_missing', 'state_mismatch',
  'storage_blocked', 'invalid_grant', 'unavailable', 'network_error', 'session_changed',
  'invalid_identity', 'persist_failed', 'success', 'update_required'])
export function captureOAuthEvent(stage, reason, details = {}) {
  try {
    const config = resolveTelemetryConfig()
    if (!config.enabled || !OAUTH_STAGES.has(stage) || !OAUTH_REASONS.has(reason)) return
    const attributes = { stage, reason, client_build: String(config.version).slice(0, 80) }
    if (Number.isInteger(details.status) && details.status >= 100 && details.status <= 599) {
      attributes.http_status = String(details.status)
    }
    if (typeof details.requestId === 'string' && /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(details.requestId)) {
      attributes.request_id = details.requestId
    }
    if (Number.isSafeInteger(details.expiresAt)) {
      const remaining = details.expiresAt - Date.now()
      attributes.remaining_bucket = remaining > 60000 ? 'over_60s' : remaining > 0 ? 'within_60s' : 'past'
    }
    if (faroInstance) faroInstance.api.pushEvent('oauth_handoff', attributes, 'auth')
    else if (pendingOAuthEvents.length < 20) pendingOAuthEvents.push(attributes)
  } catch { /* Diagnostics must never prevent login. */ }
}

export function initializeStorefrontTelemetry(router) {
  if (initializationPromise) return initializationPromise

  const config = resolveTelemetryConfig()
  if (!config.enabled) return Promise.resolve(null)

  initializationPromise = Promise.all([
    import('@grafana/faro-web-sdk'),
    import('@grafana/faro-web-tracing')
  ]).then(([{ getWebInstrumentations, initializeFaro }, { TracingInstrumentation }]) => {
    faroInstance = initializeFaro({
      url: config.collectorUrl,
      apiKey: config.apiKey,
      // OTel FetchInstrumentation 会 clone 并持续消费响应体；无限 SSE 必须排除，
      // 否则每条通知连接都会留下一个永不结束的 fetch span/reader。
      ignoreUrls: resolveTelemetryIgnoreUrls(),
      app: {
        name: 'ldstore-web',
        version: config.version,
        environment: config.environment
      },
      sessionTracking: {
        samplingRate: config.sampleRate
      },
      instrumentations: [
        ...getWebInstrumentations({ captureConsole: false }),
        new TracingInstrumentation({
          instrumentationOptions: {
            propagateTraceHeaderCorsUrls: resolveTraceHeaderCorsUrls()
          }
        })
      ],
      beforeSend(item) {
        try {
          return sanitizeTelemetryItem(item)
        } catch {
          return null
        }
      }
    })

    const updateView = (route) => faroInstance?.api.setView({ name: routeViewName(route) })
    updateView(router?.currentRoute?.value)
    router?.afterEach((to) => updateView(to))
    flushPendingErrors()
    return faroInstance
  }).catch(() => {
    faroInstance = null
    pendingErrors.splice(0)
    pendingOAuthEvents.splice(0)
    return null
  })

  return initializationPromise
}
