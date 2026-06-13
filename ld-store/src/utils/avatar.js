// 统一处理头像地址
const AVATAR_DEFAULT_ORIGIN = 'https://linux.do'
const AVATAR_PROXY_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? '' : 'https://api2.ldspro.qzz.io')
const AVATAR_PROXY_ALLOWED_HOSTS = new Set(['linux.do', 'idcflare.com'])
const AVATAR_PROXY_ALLOWED_PATHS = ['/user_avatar/', '/letter_avatar_proxy/']
const AVATAR_GLOBAL_CONCURRENCY_INITIAL = 8
const AVATAR_GLOBAL_CONCURRENCY_MIN = 2
const AVATAR_GLOBAL_CONCURRENCY_MAX = 12
const AVATAR_ORIGIN_CONCURRENCY_INITIAL = 6
const AVATAR_ORIGIN_CONCURRENCY_MIN = 1
const AVATAR_ORIGIN_CONCURRENCY_MAX = 8
const AVATAR_RETRY_LIMIT = 1
const AVATAR_LOAD_TIMEOUT_MS = 12000
const AVATAR_URL_BASE_COOLDOWN_MS = 2500
const AVATAR_URL_MAX_COOLDOWN_MS = 2 * 60 * 1000
const AVATAR_ORIGIN_BASE_COOLDOWN_MS = 3000
const AVATAR_ORIGIN_MAX_COOLDOWN_MS = 60 * 1000
const AVATAR_FAILURE_RESET_WINDOW_MS = 90 * 1000
const AVATAR_COOLDOWN_TRIGGER_FAILURES = 2
const AVATAR_RECOVERY_SUCCESS_STREAK = 6

const avatarLoadQueue = []
const avatarInflightLoads = new Map()
const avatarLoadCache = new Map()
const avatarOriginState = new Map()
const avatarOriginActiveLoads = new Map()

const avatarGlobalState = {
  limit: AVATAR_GLOBAL_CONCURRENCY_INITIAL,
  successStreak: 0,
  updatedAt: 0
}

let activeAvatarLoads = 0

function normalizeAvatarInputs(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue.flatMap(item => normalizeAvatarInputs(item))
  }
  return [rawValue]
}

function isProxyEligibleAvatarUrl(value) {
  if (!value || value.startsWith('data:') || value.startsWith('blob:')) return false

  try {
    const url = new URL(value)
    const hostname = String(url.hostname || '').toLowerCase()
    if (!AVATAR_PROXY_ALLOWED_HOSTS.has(hostname)) return false

    const pathname = String(url.pathname || '/')
    return AVATAR_PROXY_ALLOWED_PATHS.some(prefix => pathname.startsWith(prefix))
  } catch {
    return false
  }
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function reduceConcurrency(limit, min) {
  const current = Number(limit) || min
  return Math.max(min, Math.min(current - 1, Math.ceil(current * 0.6)))
}

function increaseConcurrency(limit, max) {
  const current = Number(limit) || 0
  return Math.min(max, current + 1)
}

function calculateFailureCount(previousCount, updatedAt, now) {
  return (now - Number(updatedAt || 0)) <= AVATAR_FAILURE_RESET_WINDOW_MS
    ? Number(previousCount || 0)
    : 0
}

function calculateCooldownMs(baseMs, maxMs, failureCount, triggerCount = 1) {
  if (failureCount < triggerCount) return 0
  return Math.min(baseMs * (2 ** Math.max(failureCount - triggerCount, 0)), maxMs)
}

function createAvatarCacheEntry() {
  return {
    status: 'idle',
    failureCount: 0,
    cooldownUntil: 0,
    updatedAt: 0,
    requestCount: 0,
    lastRequestedAt: 0,
    lastFailureAt: 0,
    lastLoadedAt: 0
  }
}

function getAvatarCacheEntry(url) {
  const cached = avatarLoadCache.get(url)
  return cached ? { ...createAvatarCacheEntry(), ...cached } : createAvatarCacheEntry()
}

function setAvatarCacheEntry(url, patch) {
  avatarLoadCache.set(url, {
    ...getAvatarCacheEntry(url),
    ...patch
  })
}

function createOriginState() {
  return {
    failureCount: 0,
    successStreak: 0,
    cooldownUntil: 0,
    updatedAt: 0,
    concurrencyLimit: AVATAR_ORIGIN_CONCURRENCY_INITIAL
  }
}

function getAvatarOriginKey(url) {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return ''
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

function getOriginState(url) {
  const originKey = getAvatarOriginKey(url)
  if (!originKey) return null

  if (!avatarOriginState.has(originKey)) {
    avatarOriginState.set(originKey, createOriginState())
  }

  return avatarOriginState.get(originKey)
}

function getGlobalConcurrencyLimit() {
  return clampNumber(
    Number(avatarGlobalState.limit || AVATAR_GLOBAL_CONCURRENCY_INITIAL),
    AVATAR_GLOBAL_CONCURRENCY_MIN,
    AVATAR_GLOBAL_CONCURRENCY_MAX
  )
}

function getOriginConcurrencyLimit(url) {
  const state = getOriginState(url)
  if (!state) return AVATAR_ORIGIN_CONCURRENCY_MAX

  return clampNumber(
    Number(state.concurrencyLimit || AVATAR_ORIGIN_CONCURRENCY_INITIAL),
    AVATAR_ORIGIN_CONCURRENCY_MIN,
    AVATAR_ORIGIN_CONCURRENCY_MAX
  )
}

function getUrlCooldownDelay(url) {
  const cached = getAvatarCacheEntry(url)
  const retryAfterMs = Number(cached.cooldownUntil || 0) - Date.now()
  return retryAfterMs > 0 ? retryAfterMs : 0
}

function getOriginCooldownDelay(url) {
  const state = getOriginState(url)
  if (!state?.cooldownUntil) return 0

  const retryAfterMs = Number(state.cooldownUntil || 0) - Date.now()
  return retryAfterMs > 0 ? retryAfterMs : 0
}

function buildCooldownError(url, retryAfterMs, scope = 'url') {
  const error = new Error(`Avatar load cooling down: ${url}`)
  error.name = 'AvatarCooldownError'
  error.code = 'AVATAR_COOLDOWN'
  error.scope = scope
  error.retryAfterMs = Math.max(1000, Number(retryAfterMs) || 1000)
  return error
}

function getAvatarCooldownError(url) {
  const urlRetryAfterMs = getUrlCooldownDelay(url)
  const originRetryAfterMs = getOriginCooldownDelay(url)
  const retryAfterMs = Math.max(urlRetryAfterMs, originRetryAfterMs)

  if (retryAfterMs <= 0) return null

  const scope = urlRetryAfterMs > 0 && originRetryAfterMs > 0
    ? 'mixed'
    : (originRetryAfterMs > 0 ? 'origin' : 'url')

  return buildCooldownError(url, retryAfterMs, scope)
}

function noteGlobalFailure() {
  avatarGlobalState.limit = reduceConcurrency(avatarGlobalState.limit, AVATAR_GLOBAL_CONCURRENCY_MIN)
  avatarGlobalState.successStreak = 0
  avatarGlobalState.updatedAt = Date.now()
}

function noteGlobalSuccess() {
  avatarGlobalState.successStreak = Number(avatarGlobalState.successStreak || 0) + 1
  if (avatarGlobalState.successStreak >= AVATAR_RECOVERY_SUCCESS_STREAK) {
    avatarGlobalState.limit = increaseConcurrency(avatarGlobalState.limit, AVATAR_GLOBAL_CONCURRENCY_MAX)
    avatarGlobalState.successStreak = 0
  }
  avatarGlobalState.updatedAt = Date.now()
}

export function buildAvatarProxyUrl(rawValue, size = 128) {
  const absoluteUrl = toAbsoluteAvatarUrl(rawValue, size)
  if (!isProxyEligibleAvatarUrl(absoluteUrl)) return ''
  return `${AVATAR_PROXY_BASE}/api/shop/avatar-proxy?url=${encodeURIComponent(absoluteUrl)}`
}

export function toAbsoluteAvatarUrl(rawValue, size = 128) {
  if (rawValue === undefined || rawValue === null) return ''

  const value = String(rawValue).trim()
  if (!value) return ''

  const withSize = value.replace('{size}', String(size))

  if (withSize.startsWith('data:') || withSize.startsWith('blob:')) return withSize
  if (/^https?:\/\//i.test(withSize)) return withSize
  if (withSize.startsWith('//')) return `https:${withSize}`
  if (withSize.startsWith('/')) return `${AVATAR_DEFAULT_ORIGIN}${withSize}`
  return withSize
}

export function buildAvatarCandidates(rawValue, size = 128, { includeProxy = false, preferProxy = false } = {}) {
  const candidates = []
  const seen = new Set()

  for (const item of normalizeAvatarInputs(rawValue)) {
    const absoluteUrl = toAbsoluteAvatarUrl(item, size)
    if (!absoluteUrl) continue

    const proxyUrl = buildAvatarProxyUrl(absoluteUrl, size)
    const ordered = includeProxy && proxyUrl
      ? (preferProxy ? [proxyUrl, absoluteUrl] : [absoluteUrl, proxyUrl])
      : [absoluteUrl]

    for (const candidate of ordered) {
      if (!candidate || seen.has(candidate)) continue
      seen.add(candidate)
      candidates.push(candidate)
    }
  }

  return candidates
}

export function resolveAvatarUrl(rawValue, size = 128, options = undefined) {
  return buildAvatarCandidates(rawValue, size, options)[0] || ''
}

export function serializeAvatarCandidates(candidates = []) {
  return JSON.stringify(Array.isArray(candidates) ? candidates : [])
}

function wait(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function increaseOriginActiveLoads(url) {
  const originKey = getAvatarOriginKey(url)
  if (!originKey) return

  const current = Number(avatarOriginActiveLoads.get(originKey) || 0)
  avatarOriginActiveLoads.set(originKey, current + 1)
}

function decreaseOriginActiveLoads(url) {
  const originKey = getAvatarOriginKey(url)
  if (!originKey) return

  const current = Number(avatarOriginActiveLoads.get(originKey) || 0)
  if (current <= 1) {
    avatarOriginActiveLoads.delete(originKey)
    return
  }

  avatarOriginActiveLoads.set(originKey, current - 1)
}

function noteOriginFailure(url) {
  const originKey = getAvatarOriginKey(url)
  if (!originKey) return

  const now = Date.now()
  const state = getOriginState(url) || createOriginState()
  const previousFailures = calculateFailureCount(state.failureCount, state.updatedAt, now)
  const failureCount = previousFailures + 1
  const cooldownMs = calculateCooldownMs(
    AVATAR_ORIGIN_BASE_COOLDOWN_MS,
    AVATAR_ORIGIN_MAX_COOLDOWN_MS,
    failureCount,
    AVATAR_COOLDOWN_TRIGGER_FAILURES
  )

  avatarOriginState.set(originKey, {
    ...state,
    failureCount,
    successStreak: 0,
    cooldownUntil: cooldownMs > 0 ? now + cooldownMs : 0,
    updatedAt: now,
    concurrencyLimit: reduceConcurrency(state.concurrencyLimit, AVATAR_ORIGIN_CONCURRENCY_MIN)
  })
}

function noteOriginSuccess(url) {
  const originKey = getAvatarOriginKey(url)
  if (!originKey) return

  const state = avatarOriginState.get(originKey)
  if (!state) return

  const now = Date.now()
  let successStreak = Number(state.successStreak || 0) + 1
  let concurrencyLimit = getOriginConcurrencyLimit(url)

  if (successStreak >= AVATAR_RECOVERY_SUCCESS_STREAK) {
    concurrencyLimit = increaseConcurrency(concurrencyLimit, AVATAR_ORIGIN_CONCURRENCY_MAX)
    successStreak = 0
  }

  const previousFailures = calculateFailureCount(state.failureCount, state.updatedAt, now)
  const failureCount = Math.max(0, previousFailures - 1)
  const nextState = {
    ...state,
    failureCount,
    successStreak,
    cooldownUntil: 0,
    updatedAt: now,
    concurrencyLimit
  }

  if (
    failureCount <= 0
    && successStreak === 0
    && concurrencyLimit === AVATAR_ORIGIN_CONCURRENCY_INITIAL
  ) {
    avatarOriginState.delete(originKey)
    return
  }

  avatarOriginState.set(originKey, nextState)
}

function createAvatarImageLoader(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    let settled = false
    const timeoutId = window.setTimeout(() => {
      if (settled) return
      settled = true
      image.onload = null
      image.onerror = null
      reject(new Error(`Avatar load timed out: ${url}`))
    }, AVATAR_LOAD_TIMEOUT_MS)

    image.decoding = 'async'
    image.referrerPolicy = 'no-referrer'

    image.onload = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      image.onload = null
      image.onerror = null
      resolve(url)
    }

    image.onerror = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      image.onload = null
      image.onerror = null
      reject(new Error(`Avatar load failed: ${url}`))
    }

    image.src = url
  })
}

function noteUrlRequested(url) {
  const now = Date.now()
  const cached = getAvatarCacheEntry(url)
  setAvatarCacheEntry(url, {
    ...cached,
    requestCount: Number(cached.requestCount || 0) + 1,
    lastRequestedAt: now,
    updatedAt: now
  })
}

function markUrlLoading(url) {
  const cached = getAvatarCacheEntry(url)
  setAvatarCacheEntry(url, {
    ...cached,
    status: cached.status === 'loaded' ? 'loaded' : 'loading',
    updatedAt: Date.now()
  })
}

function noteUrlFailure(url) {
  const now = Date.now()
  const cached = getAvatarCacheEntry(url)
  const previousFailures = calculateFailureCount(
    cached.failureCount,
    cached.lastFailureAt || cached.updatedAt,
    now
  )
  const failureCount = previousFailures + 1
  const cooldownMs = calculateCooldownMs(
    AVATAR_URL_BASE_COOLDOWN_MS,
    AVATAR_URL_MAX_COOLDOWN_MS,
    failureCount
  )

  setAvatarCacheEntry(url, {
    ...cached,
    status: 'failed',
    failureCount,
    updatedAt: now,
    cooldownUntil: now + cooldownMs,
    lastFailureAt: now
  })
}

function noteUrlSuccess(url) {
  const now = Date.now()
  const cached = getAvatarCacheEntry(url)

  setAvatarCacheEntry(url, {
    ...cached,
    status: 'loaded',
    failureCount: 0,
    updatedAt: now,
    cooldownUntil: 0,
    lastLoadedAt: now
  })
}

async function loadAvatarWithRetry(url, attempt = 0) {
  try {
    return await createAvatarImageLoader(url)
  } catch (error) {
    if (attempt >= AVATAR_RETRY_LIMIT) {
      throw error
    }

    await wait(600 + attempt * 900)
    return loadAvatarWithRetry(url, attempt + 1)
  }
}

function dequeueAvatarLoad() {
  while (activeAvatarLoads < getGlobalConcurrencyLimit() && avatarLoadQueue.length > 0) {
    let taskIndex = -1
    let cooldownError = null

    for (let index = 0; index < avatarLoadQueue.length; index += 1) {
      const queuedTask = avatarLoadQueue[index]
      const nextCooldownError = getAvatarCooldownError(queuedTask.url)
      if (nextCooldownError) {
        cooldownError = nextCooldownError
        taskIndex = index
        break
      }

      const originKey = getAvatarOriginKey(queuedTask.url)
      const originActiveLoads = Number(avatarOriginActiveLoads.get(originKey) || 0)
      if (!originKey || originActiveLoads < getOriginConcurrencyLimit(queuedTask.url)) {
        taskIndex = index
        break
      }
    }

    if (taskIndex < 0) {
      break
    }

    const [task] = avatarLoadQueue.splice(taskIndex, 1)
    if (!task) break

    if (cooldownError) {
      if (avatarInflightLoads.get(task.url) === task.promise) {
        avatarInflightLoads.delete(task.url)
      }
      task.reject(cooldownError)
      continue
    }

    activeAvatarLoads += 1
    increaseOriginActiveLoads(task.url)
    markUrlLoading(task.url)

    loadAvatarWithRetry(task.url)
      .then(() => {
        noteUrlSuccess(task.url)
        noteOriginSuccess(task.url)
        noteGlobalSuccess()
        task.resolve(task.url)
      })
      .catch((error) => {
        noteUrlFailure(task.url)
        noteOriginFailure(task.url)
        noteGlobalFailure()
        task.reject(error)
      })
      .finally(() => {
        activeAvatarLoads = Math.max(0, activeAvatarLoads - 1)
        decreaseOriginActiveLoads(task.url)
        if (avatarInflightLoads.get(task.url) === task.promise) {
          avatarInflightLoads.delete(task.url)
        }
        dequeueAvatarLoad()
      })
  }
}

export function preloadAvatarCandidate(url) {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
    return Promise.resolve(url)
  }

  noteUrlRequested(url)

  const cached = getAvatarCacheEntry(url)
  if (cached.status === 'loaded') {
    return Promise.resolve(url)
  }

  const cooldownError = getAvatarCooldownError(url)
  if (cooldownError) {
    return Promise.reject(cooldownError)
  }

  if (avatarInflightLoads.has(url)) {
    return avatarInflightLoads.get(url)
  }

  let resolveTask
  let rejectTask
  const promise = new Promise((resolve, reject) => {
    resolveTask = resolve
    rejectTask = reject
  })

  const task = {
    url,
    promise,
    resolve: resolveTask,
    reject: rejectTask
  }

  avatarInflightLoads.set(url, promise)
  avatarLoadQueue.push(task)
  dequeueAvatarLoad()
  return promise
}

export function getAvatarCandidateState(rawValue, size = 128) {
  const url = toAbsoluteAvatarUrl(rawValue, size)
  if (!url) {
    return {
      url: '',
      status: 'idle',
      requestCount: 0,
      failureCount: 0,
      hasRequested: false,
      isLoaded: false,
      isInflight: false,
      isCoolingDown: false,
      retryAfterMs: 0,
      isOriginDegraded: false,
      originLimit: AVATAR_ORIGIN_CONCURRENCY_INITIAL
    }
  }

  const now = Date.now()
  const cached = getAvatarCacheEntry(url)
  const originState = getOriginState(url)
  const urlRetryAfterMs = Math.max(0, Number(cached.cooldownUntil || 0) - now)
  const originRetryAfterMs = Math.max(0, Number(originState?.cooldownUntil || 0) - now)
  const retryAfterMs = Math.max(urlRetryAfterMs, originRetryAfterMs)
  const isInflight = avatarInflightLoads.has(url)
  const status = isInflight ? 'loading' : cached.status
  const originLimit = originState
    ? getOriginConcurrencyLimit(url)
    : AVATAR_ORIGIN_CONCURRENCY_INITIAL

  return {
    url,
    status,
    requestCount: Number(cached.requestCount || 0),
    failureCount: Number(cached.failureCount || 0),
    hasRequested: Boolean(cached.requestCount || 0) || isInflight,
    isLoaded: status === 'loaded',
    isInflight,
    isCoolingDown: retryAfterMs > 0,
    retryAfterMs,
    isOriginDegraded: Boolean(originState) && (
      Number(originState.failureCount || 0) > 0
      || Number(originState.cooldownUntil || 0) > now
      || originLimit < AVATAR_ORIGIN_CONCURRENCY_INITIAL
    ),
    originLimit
  }
}

export function shouldPreferAvatarProxy(rawValue, size = 128) {
  for (const item of normalizeAvatarInputs(rawValue)) {
    const absoluteUrl = toAbsoluteAvatarUrl(item, size)
    if (!isProxyEligibleAvatarUrl(absoluteUrl)) continue

    const state = getAvatarCandidateState(absoluteUrl, size)
    if (state.isCoolingDown || state.isOriginDegraded || state.failureCount > 0) {
      return true
    }
  }

  return false
}

export function isAvatarCooldownError(error) {
  return Boolean(error) && (
    error?.code === 'AVATAR_COOLDOWN'
    || error?.name === 'AvatarCooldownError'
  )
}

export function getAvatarCooldownDelay(error, fallbackMs = 1500) {
  if (!isAvatarCooldownError(error)) return 0
  const retryAfterMs = Number(error?.retryAfterMs || fallbackMs)
  return Math.max(1000, retryAfterMs)
}

function parseAvatarCandidates(rawValue) {
  if (Array.isArray(rawValue)) return rawValue
  if (!rawValue || typeof rawValue !== 'string') return []

  try {
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function applyNextAvatarFallback(target, seed = 'user', size = 128) {
  if (!target) return false

  const candidates = parseAvatarCandidates(target.dataset?.avatarCandidates)
  const currentIndex = Number.parseInt(target.dataset?.avatarIndex || '0', 10)
  const nextIndex = Number.isInteger(currentIndex) ? currentIndex + 1 : 1

  if (nextIndex < candidates.length) {
    target.dataset.avatarIndex = String(nextIndex)
    target.src = candidates[nextIndex]
    return true
  }

  target.onerror = null
  target.src = buildFallbackAvatar(seed, size)
  return false
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildFallbackAvatar(seed = '', size = 128) {
  const text = String(seed || '').trim()
  const char = Array.from(text)[0] || '?'

  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  const bg = `hsl(${hue} 55% 50%)`
  const letter = escapeXml(char.toUpperCase())

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="${bg}"/><text x="50" y="50" dy="0.02em" text-anchor="middle" dominant-baseline="middle" font-family="Segoe UI, PingFang SC, Microsoft YaHei, Helvetica, Arial, sans-serif" font-size="46" font-weight="700" fill="#fff">${letter}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
