import { reactive } from 'vue'

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

export const MAINTENANCE_MODES = Object.freeze({
  NORMAL: 'normal',
  LDC_RESTRICTED: 'ldc_restricted',
  FULL: 'full',
})

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? '' : 'https://api2.ldspro.qzz.io')
const STATUS_CACHE_MS = 60_000

// Frontend fallback profile used before backend status is fetched.
const TEMPORARY_MAINTENANCE_ENABLED = false

const DEFAULT_STATUS_URL = 'https://status.ldspro.qzz.io/'
const DEFAULT_ETA = '恢复时间待定，请关注状态页或稍后刷新页面。'

const DEFAULT_FEATURES_BY_MODE = Object.freeze({
  [MAINTENANCE_MODES.NORMAL]: Object.freeze({
    publicBrowse: true,
    productListRead: true,
    orderRead: true,
    orderCreate: true,
    orderPayment: true,
    orderCancel: true,
    orderDelivery: true,
    productCdkManage: true,
    productManage: true,
    buyRequestRead: true,
    buyRequestTrade: true,
    buyRequestChatWrite: true,
    topServiceRead: true,
    topServicePurchase: true,
    imageUpload: true,
  }),
  [MAINTENANCE_MODES.LDC_RESTRICTED]: Object.freeze({
    publicBrowse: false,
    productListRead: false,
    orderRead: true,
    orderCreate: false,
    orderPayment: false,
    orderCancel: true,
    orderDelivery: true,
    productCdkManage: true,
    productManage: false,
    buyRequestRead: false,
    buyRequestTrade: false,
    buyRequestChatWrite: false,
    topServiceRead: false,
    topServicePurchase: false,
    imageUpload: false,
  }),
  [MAINTENANCE_MODES.FULL]: Object.freeze({
    publicBrowse: false,
    productListRead: false,
    orderRead: false,
    orderCreate: false,
    orderPayment: false,
    orderCancel: false,
    orderDelivery: false,
    productCdkManage: false,
    productManage: false,
    buyRequestRead: false,
    buyRequestTrade: false,
    buyRequestChatWrite: false,
    topServiceRead: false,
    topServicePurchase: false,
    imageUpload: false,
  }),
})

const DEFAULT_COPY_BY_MODE = Object.freeze({
  [MAINTENANCE_MODES.NORMAL]: Object.freeze({
    title: 'LD士多运行正常',
    message: '当前服务运行正常，订单、求购、图床与商家服务均已开放。',
    reason: '当前服务运行正常。',
    allowedActions: ['全部功能正常开放'],
    blockedActions: [],
  }),
  [MAINTENANCE_MODES.LDC_RESTRICTED]: Object.freeze({
    title: 'LD士多受限维护中',
    message: '因 LinuxDo 暂时下线 Credit 积分服务，当前仅开放我的订单、订单详情与我的物品管理。',
    reason: 'LinuxDo 暂时下线 Credit 积分服务，恢复时间待定。',
    allowedActions: [
      '查看我的订单与订单详情',
      '在我的商品中管理 CDK',
      '处理已支付普通物品订单的手动发货',
    ],
    blockedActions: [
      '首页物品展示、商品详情与分类页',
      '创建订单与拉起支付',
      '刷新支付状态',
      '求购功能与沟通',
      '购买置顶服务与商家服务',
      '商品发布、编辑、上下架与删除',
      '士多图床上传',
    ],
  }),
  [MAINTENANCE_MODES.FULL]: Object.freeze({
    title: 'LD士多临时维护中',
    message: '站点当前处于全站维护模式，请稍后再试。',
    reason: '站点当前处于全站维护模式。',
    allowedActions: ['仅开放维护公告与状态页查看'],
    blockedActions: ['商品浏览、订单、求购、图床、商家服务等全部业务功能'],
  }),
})

const FEATURE_MESSAGE_MAP = Object.freeze({
  publicBrowse: '因 LinuxDo Credit 积分服务维护中，当前仅开放订单查看与我的物品管理。',
  productListRead: '因 LinuxDo Credit 积分服务维护中，物品列表暂时隐藏。',
  orderCreate: '因 LinuxDo Credit 积分服务维护中，暂时无法创建新订单。',
  orderPayment: '因 LinuxDo Credit 积分服务维护中，暂时无法拉起支付或刷新支付状态。',
  orderCancel: '站点维护中，当前暂不允许取消订单。',
  orderDelivery: '站点维护中，当前暂不允许处理发货。',
  productCdkManage: '站点维护中，当前暂不允许管理商品 CDK。',
  productManage: '因 LinuxDo Credit 积分服务维护中，商品发布、编辑、上下架与删除暂时关闭。',
  buyRequestRead: '因 LinuxDo Credit 积分服务维护中，求购功能当前暂不可用。',
  buyRequestTrade: '因 LinuxDo Credit 积分服务维护中，求购交易功能暂时关闭。',
  buyRequestChatWrite: '因 LinuxDo Credit 积分服务维护中，求购沟通功能暂时关闭。',
  topServiceRead: '因 LinuxDo Credit 积分服务维护中，商家服务当前暂不可用。',
  topServicePurchase: '因 LinuxDo Credit 积分服务维护中，置顶服务购买与支付暂时关闭。',
  imageUpload: '因 LinuxDo Credit 积分服务维护中，图床上传暂时关闭。',
})

const REQUEST_RULES = [
  { feature: 'orderCreate', methods: ['POST'], test: (path) => path === '/api/shop/orders' },
  { feature: 'orderPayment', methods: ['GET'], test: (path) => /^\/api\/shop\/orders\/[^/]+\/payment-url$/.test(path) },
  { feature: 'orderPayment', methods: ['POST'], test: (path) => /^\/api\/shop\/orders\/[^/]+\/refresh$/.test(path) },
  { feature: 'buyRequestTrade', methods: ['POST'], test: (path) => path === '/api/shop/buy-requests' },
  { feature: 'buyRequestTrade', methods: ['PUT'], test: (path) => /^\/api\/shop\/buy-requests\/[^/]+$/.test(path) },
  { feature: 'buyRequestTrade', methods: ['POST'], test: (path) => /^\/api\/shop\/buy-requests\/[^/]+\/(price|status|sessions)$/.test(path) },
  { feature: 'buyRequestChatWrite', methods: ['POST'], test: (path) => /^\/api\/shop\/buy-sessions\/[^/]+\/messages$/.test(path) },
  { feature: 'buyRequestTrade', methods: ['POST'], test: (path) => /^\/api\/shop\/buy-sessions\/[^/]+\/(payment|mark-paid|confirm-paid|close)$/.test(path) },
  { feature: 'orderPayment', methods: ['GET'], test: (path) => /^\/api\/shop\/buy-orders\/[^/]+\/payment-url$/.test(path) },
  { feature: 'orderPayment', methods: ['POST'], test: (path) => /^\/api\/shop\/buy-orders\/[^/]+\/refresh$/.test(path) },
  { feature: 'topServicePurchase', methods: ['POST'], test: (path) => path === '/api/shop/top-service/orders' },
  { feature: 'topServicePurchase', methods: ['GET'], test: (path) => /^\/api\/shop\/top-service\/orders\/[^/]+\/payment-url$/.test(path) },
  { feature: 'topServicePurchase', methods: ['POST'], test: (path) => /^\/api\/shop\/top-service\/orders\/[^/]+\/refresh$/.test(path) },
  { feature: 'productManage', methods: ['POST'], test: (path) => path === '/api/shop/products' },
  { feature: 'productManage', methods: ['PUT'], test: (path) => /^\/api\/shop\/my-products\/[^/]+$/.test(path) },
  { feature: 'productManage', methods: ['POST'], test: (path) => /^\/api\/shop\/my-products\/[^/]+\/offline$/.test(path) },
  { feature: 'productManage', methods: ['DELETE'], test: (path) => /^\/api\/shop\/my-products\/[^/]+$/.test(path) },
  { feature: 'imageUpload', methods: ['POST', 'PUT', 'DELETE'], test: (path) => path.startsWith('/api/image') },
]

function envFlag(value) {
  return TRUE_VALUES.has(String(value || '').trim().toLowerCase())
}

function safeText(value, maxLength = 0) {
  if (value === undefined || value === null) return ''
  let text = String(value).trim()
  if (maxLength > 0 && text.length > maxLength) {
    text = text.slice(0, maxLength)
  }
  return text
}

function normalizeMode(value) {
  const normalized = safeText(value, 40).toLowerCase()
  if (Object.values(MAINTENANCE_MODES).includes(normalized)) return normalized
  return MAINTENANCE_MODES.NORMAL
}

function resolveFallbackMode() {
  const envMode = normalizeMode(import.meta.env.VITE_MAINTENANCE_PROFILE)
  if (envMode !== MAINTENANCE_MODES.NORMAL) return envMode
  if (TEMPORARY_MAINTENANCE_ENABLED || envFlag(import.meta.env.VITE_MAINTENANCE_MODE)) {
    return MAINTENANCE_MODES.LDC_RESTRICTED
  }
  return MAINTENANCE_MODES.NORMAL
}

function cloneFeatures(mode) {
  return { ...(DEFAULT_FEATURES_BY_MODE[mode] || DEFAULT_FEATURES_BY_MODE[MAINTENANCE_MODES.NORMAL]) }
}

function normalizeList(values = []) {
  return Array.isArray(values)
    ? values.map((item) => safeText(item, 200)).filter(Boolean)
    : []
}

function normalizeStatusPayload(payload = {}) {
  const source = payload?.maintenance && typeof payload.maintenance === 'object'
    ? payload.maintenance
    : payload
  const mode = normalizeMode(source?.mode || resolveFallbackMode())
  const copy = DEFAULT_COPY_BY_MODE[mode] || DEFAULT_COPY_BY_MODE[MAINTENANCE_MODES.NORMAL]
  const features = cloneFeatures(mode)

  if (source?.features && typeof source.features === 'object') {
    for (const [key, value] of Object.entries(source.features)) {
      features[key] = value !== false
    }
  }

  return {
    enabled: mode !== MAINTENANCE_MODES.NORMAL,
    mode,
    title: safeText(source?.title, 120) || copy.title,
    message: safeText(source?.message, 500) || copy.message,
    reason: safeText(source?.reason, 500) || copy.reason,
    eta: safeText(source?.eta, 200) || DEFAULT_ETA,
    statusUrl: safeText(source?.statusUrl, 300) || DEFAULT_STATUS_URL,
    features,
    allowedActions: normalizeList(source?.allowedActions || copy.allowedActions),
    blockedActions: normalizeList(source?.blockedActions || copy.blockedActions),
    loadedAt: Date.now(),
  }
}

function normalizePath(input) {
  const raw = safeText(input, 2000)
  if (!raw) return ''

  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return new URL(raw).pathname
    }
    return new URL(raw, 'https://ld-store.local').pathname
  } catch {
    const withoutQuery = raw.split('?')[0]
    return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
  }
}

const maintenanceState = reactive(normalizeStatusPayload({ mode: MAINTENANCE_MODES.NORMAL }))

let fetchPromise = null
let lastFetchedAt = 0
let hasFetched = false

async function fetchSystemStatus() {
  const response = await fetch(`${API_BASE}/api/shop/system-status`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`status_${response.status}`)
  }

  const data = await response.json().catch(() => null)
  return data?.data || data || {}
}

export function applyMaintenanceStatus(payload = {}) {
  Object.assign(maintenanceState, normalizeStatusPayload(payload))
  return maintenanceState
}

export async function ensureMaintenanceStatusLoaded(options = {}) {
  const force = options.force === true
  const now = Date.now()

  if (!force && fetchPromise) {
    return fetchPromise
  }

  if (!force && hasFetched && now - lastFetchedAt < STATUS_CACHE_MS) {
    return maintenanceState
  }

  fetchPromise = (async () => {
    try {
      const payload = await fetchSystemStatus()
      applyMaintenanceStatus(payload)
    } catch {
      applyMaintenanceStatus({ mode: maintenanceState.mode })
    } finally {
      hasFetched = true
      lastFetchedAt = Date.now()
      fetchPromise = null
    }

    return maintenanceState
  })()

  return fetchPromise
}

export function isMaintenanceEnabled() {
  return maintenanceState.enabled === true
}

export function isRestrictedMaintenanceMode() {
  return maintenanceState.mode === MAINTENANCE_MODES.LDC_RESTRICTED
}

export function isFullMaintenanceMode() {
  return maintenanceState.mode === MAINTENANCE_MODES.FULL
}

export function isMaintenanceFeatureEnabled(featureKey) {
  if (!featureKey) return true
  return maintenanceState.features?.[featureKey] !== false
}

export function getMaintenanceFeatureMessage(featureKey) {
  return FEATURE_MESSAGE_MAP[featureKey] || maintenanceState.message
}

export function getMaintenanceRequestBlock(method, url) {
  if (!isMaintenanceEnabled()) return null

  const normalizedMethod = String(method || 'GET').trim().toUpperCase()
  const path = normalizePath(url)
  if (!path || path === '/api/shop/system-status') return null

  if (isFullMaintenanceMode()) {
    return {
      feature: 'full',
      message: maintenanceState.message,
    }
  }

  for (const rule of REQUEST_RULES) {
    if (!rule.methods.includes(normalizedMethod)) continue
    if (!rule.test(path)) continue
    if (isMaintenanceFeatureEnabled(rule.feature)) return null
    return {
      feature: rule.feature,
      message: getMaintenanceFeatureMessage(rule.feature),
    }
  }

  return null
}

export { maintenanceState as MAINTENANCE_STATE }
