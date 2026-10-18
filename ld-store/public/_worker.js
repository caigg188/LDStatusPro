const DEFAULT_SITE_URL = 'https://ldcstore.com/'
const DEFAULT_API_BASE = 'https://api2.ldspro.qzz.io'
const DEFAULT_OG_IMAGE_PATH = '/og/default/base.png?v=1'
const DEFAULT_LEGACY_HOSTS = ['ldstore.cc.cd', 'ldst0re.qzz.io']
const DEFAULT_TITLE = 'LD士多 - Linux DO 社区积分兑换中心'
const DEFAULT_DESCRIPTION = '在 LD士多 使用 Linux.do 社区积分兑换精选虚拟物品与服务。'
const HTML_CACHE_CONTROL = 'no-store, no-cache, must-revalidate'
const OEMBED_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=3600'
export const NOINDEX_POLICY = 'noindex, nofollow, noarchive'
export const STOREFRONT_CSP = "default-src 'self'; script-src 'self' https://mxana.tacool.com https://static.cloudflareinsights.com; style-src 'self'; style-src-elem 'self'; style-src-attr 'none'; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https://api2.ldspro.qzz.io https://api1.ldspro.qzz.io https://api.ldspro.qzz.io https://credit.linux.do https://linux.do https://*.linux.do https://*.workers.dev; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"

const DYNAMIC_ROUTES = [
  { pattern: /^\/product\/(?:\d+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})\/?$/, label: '商品', fallbackTitle: '商品详情 - LD士多', fallbackDescription: '在 LD士多 查看商品详情、价格与兑换方式。' },
  { pattern: /^\/merchant\/[^/]+\/?$/, label: '商家主页', fallbackTitle: '商家主页 - LD士多', fallbackDescription: '浏览 LD士多 商家的公开商品与服务。' },
  { pattern: /^\/shop\/(?:\d+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})\/?$/, label: '小店', fallbackTitle: '小店详情 - LD士多', fallbackDescription: '发现 LD士多 社区成员经营的小店。' },
  { pattern: /^\/buy-request\/(?:\d+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})\/?$/, label: '求购', fallbackTitle: '求购详情 - LD士多', fallbackDescription: '查看并响应 LD士多 社区求购需求。' },
  { pattern: /^\/coupon\/[^/]+\/?$/, label: '优惠券', fallbackTitle: '领取优惠券 - LD士多', fallbackDescription: '领取 LD士多 商家发放的优惠券。' },
  { pattern: /^\/category\/[^/]+\/?$/, label: '分类', fallbackTitle: '分类商品 - LD士多', fallbackDescription: '浏览 LD士多 分类中的公开商品与服务。' }
]

const STATIC_ROUTES = [
  { pattern: /^\/announcements(?:\/[1-9]\d*)?\/?$/, title: '公告中心 - LD士多', description: '查看 LD士多 平台动态、公告与规则。' },
  { pattern: /^\/$/, title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  { pattern: /^\/search\/?$/, title: '搜索 - LD士多', description: '搜索 LD士多 中的公开商品与服务。' },
  { pattern: /^\/docs(?:\/[^/]+)?\/?$/, title: '使用文档 - LD士多', description: '查看 LD士多 的购买、发布、交付与售后使用指南。' },
  { pattern: /^\/support\/?$/, title: '支持 LDStatus Pro - LD士多', description: '了解并支持 LDStatus Pro 与 LD士多 的持续维护。' },
  { pattern: /^\/ld-image\/?$/, title: '士多图床 - LD士多', description: 'LD士多 提供的社区图片工具。' },
  { pattern: /^\/maintenance\/?$/, title: '系统维护中 - LD士多', description: 'LD士多 当前正在维护，请稍后再来。' },
  { pattern: /^\/login\/?$/, title: '登录 - LD士多', description: DEFAULT_DESCRIPTION },
  { pattern: /^\/auth\/callback\/?$/, title: '登录中 - LD士多', description: DEFAULT_DESCRIPTION },
  { pattern: /^\/checkout\/[^/]+\/?$/, title: '确认订单 - LD士多', description: DEFAULT_DESCRIPTION },
  { pattern: /^\/order\/[^/]+\/?$/, title: '订单详情 - LD士多', description: DEFAULT_DESCRIPTION },
  { pattern: /^\/pay\/signal\/?$/, title: '支付结果 - LD士多', description: '正在把支付结果同步回 LD士多 订单页面。' },
  { pattern: /^\/edit\/[^/]+\/?$/, title: '编辑商品 - LD士多', description: DEFAULT_DESCRIPTION },
  { pattern: /^\/publish\/?$/, title: '发布商品 - LD士多', description: DEFAULT_DESCRIPTION },
  { pattern: /^\/buy-requests\/new\/?$/, title: '发布求购 - LD士多', description: DEFAULT_DESCRIPTION },
  { pattern: /^\/user(?:\/.*)?$/, title: '个人中心 - LD士多', description: DEFAULT_DESCRIPTION },
  { pattern: /^\/seller(?:\/.*)?$/, title: '卖家后台 - LD士多', description: DEFAULT_DESCRIPTION },
  { pattern: /^\/merchant-services\/?$/, title: '商家服务 - LD士多', description: DEFAULT_DESCRIPTION }
]

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^$()|[\]\\]/g, '\\$&')
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function truncateText(value, maxLength = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const segments = Array.from(new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }).segment(text), ({ segment }) => segment)
  return segments.length <= maxLength ? text : `${segments.slice(0, maxLength - 1).join('')}…`
}

function getSiteUrl(env) {
  const configured = String(env.LD_STORE_SITE_URL || DEFAULT_SITE_URL).trim() || DEFAULT_SITE_URL
  try {
    const url = new URL(configured)
    url.pathname = '/'
    url.search = ''
    url.hash = ''
    return url
  } catch {
    return new URL(DEFAULT_SITE_URL)
  }
}

function normalizePathname(pathname) {
  const normalized = String(pathname || '/').replace(/\/{2,}/g, '/').replace(/\/+$/, '')
  return normalized || '/'
}

export function canonicalizePageUrl(input, env = {}) {
  const source = input instanceof URL ? input : new URL(String(input), getSiteUrl(env))
  const canonical = new URL(normalizePathname(source.pathname), getSiteUrl(env))
  if (canonical.pathname === '/search') {
    const query = truncateText(source.searchParams.get('q') || '', 80)
    if (query) canonical.searchParams.set('q', query)
  }
  if (/^\/merchant\/[^/]+$/.test(canonical.pathname)) {
    for (const key of ['site', 'userId']) {
      const value = source.searchParams.get(key)
      if (value) canonical.searchParams.set(key, value)
    }
  }
  return canonical.toString()
}

function getDynamicRoute(pathname) {
  return DYNAMIC_ROUTES.find(({ pattern }) => pattern.test(pathname)) || null
}

function getStaticRoute(pathname) {
  return STATIC_ROUTES.find(({ pattern }) => pattern.test(pathname)) || null
}

function getDefaultMetadata(url, env) {
  const canonicalUrl = canonicalizePageUrl(url, env)
  const configuredImage = absoluteSameOriginPath(env.LD_STORE_DEFAULT_OG_IMAGE, env, '/og/')
  const defaultImage = configuredImage || new URL(DEFAULT_OG_IMAGE_PATH, getSiteUrl(env)).toString()
  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    ogType: 'website',
    url: canonicalUrl,
    siteName: 'LD士多',
    image: defaultImage,
    imageAlt: DEFAULT_TITLE,
    imageType: 'image/png',
    imageWidth: 1200,
    imageHeight: 630,
    locale: 'zh_CN',
    twitterCard: 'summary_large_image',
    product: null,
    notFound: false
  }
}

function getNotFoundMetadata(url, env) {
  return {
    ...getDefaultMetadata(url, env),
    title: '页面未找到 - LD士多',
    description: '这个分享地址不存在、已下架或不可公开访问。',
    imageAlt: 'LD士多页面未找到',
    notFound: true
  }
}

function getPrivateFallbackMetadata(url, env, route) {
  const title = `${route.label}暂不可公开预览 - LD士多`
  return {
    ...getDefaultMetadata(url, env),
    title,
    description: `该${route.label}可能需要登录、满足社区信任等级，或当前已不可用。请打开 LD士多后查看。`,
    imageAlt: title,
    notFound: false
  }
}

function absoluteSameOriginPath(rawPath, env, requiredPrefix) {
  const siteUrl = getSiteUrl(env)
  try {
    const resolved = new URL(String(rawPath || ''), siteUrl)
    if (resolved.origin !== siteUrl.origin || !resolved.pathname.startsWith(requiredPrefix)) return ''
    return resolved.toString()
  } catch {
    return ''
  }
}

function unwrapApiPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  if (payload.success === true && payload.data !== undefined) return payload.data
  return payload
}

async function fetchJsonResult(url, timeoutMs = 3000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cf: { cacheEverything: true, cacheTtl: 300 }
    })
    if (response.status === 404) return { state: 'not_found', status: 404, data: null }
    if (!response.ok) return { state: 'unavailable', status: response.status, data: null }
    const payload = unwrapApiPayload(await response.json())
    return payload ? { state: 'ok', status: response.status, data: payload } : { state: 'unavailable', status: response.status, data: null }
  } catch {
    return { state: 'unavailable', status: 0, data: null }
  } finally {
    clearTimeout(timeoutId)
  }
}

function normalizeShareMetadata(payload, requestUrl, env) {
  if (!payload || typeof payload !== 'object') return null
  const image = payload.image
  const canonicalPath = String(payload.canonicalPath || '')
  const imageUrl = absoluteSameOriginPath(image?.path, env, '/og/')
  if (
    !canonicalPath.startsWith('/') || canonicalPath.startsWith('//') ||
    !String(payload.title || '').trim() ||
    !String(payload.description || '').trim() ||
    !imageUrl ||
    image?.type !== 'image/png' ||
    Number(image?.width) !== 1200 ||
    Number(image?.height) !== 630
  ) {
    return null
  }

  const canonicalUrl = canonicalizePageUrl(new URL(canonicalPath, requestUrl), env)
  const priceAmount = Number(payload.product?.priceAmount)
  const product = payload.product && payload.ogType === 'product' && Number.isFinite(priceAmount) && priceAmount >= 0 &&
    payload.product.priceCurrency === 'LDC' && ['in stock', 'out of stock'].includes(payload.product.availability)
    ? {
        priceAmount: String(payload.product.priceAmount || ''),
        priceCurrency: String(payload.product.priceCurrency || 'LDC'),
        availability: String(payload.product.availability || '')
      }
    : null

  return {
    title: truncateText(payload.title, 70),
    description: truncateText(payload.description, 120),
    ogType: ['website', 'product', 'profile'].includes(payload.ogType) ? payload.ogType : 'website',
    url: canonicalUrl,
    siteName: 'LD士多',
    image: imageUrl,
    imageAlt: truncateText(image.alt || payload.title, 120),
    imageType: 'image/png',
    imageWidth: 1200,
    imageHeight: 630,
    locale: 'zh_CN',
    twitterCard: 'summary_large_image',
    product,
    notFound: false
  }
}

export async function resolvePageMetadata(input, env = {}) {
  const url = input instanceof URL ? input : new URL(String(input), getSiteUrl(env))
  const pathname = normalizePathname(url.pathname)
  const dynamicRoute = getDynamicRoute(pathname)

  if (dynamicRoute) {
    const apiBase = String(env.LD_STORE_META_API_BASE || DEFAULT_API_BASE).trim() || DEFAULT_API_BASE
    const canonical = new URL(canonicalizePageUrl(url, env))
    const apiUrl = `${apiBase.replace(/\/$/, '')}/api/shop/share-meta?path=${encodeURIComponent(canonical.pathname + canonical.search)}`
    const result = await fetchJsonResult(apiUrl)
    // The API deliberately uses the same 404 for missing and access-restricted
    // content. Returning a generic 200 card here prevents both existence leaks
    // and forum users mistaking a permission boundary for a broken link.
    if (result.state === 'not_found') return getPrivateFallbackMetadata(url, env, dynamicRoute)
    if (result.state === 'ok') {
      const metadata = normalizeShareMetadata(result.data, url, env)
      if (metadata) return metadata
    }
    return {
      ...getDefaultMetadata(url, env),
      title: dynamicRoute.fallbackTitle,
      description: dynamicRoute.fallbackDescription,
      imageAlt: dynamicRoute.fallbackTitle
    }
  }

  const staticRoute = getStaticRoute(pathname)
  if (!staticRoute) return getNotFoundMetadata(url, env)
  const searchQuery = pathname === '/search' ? truncateText(url.searchParams.get('q') || '', 80) : ''
  const title = searchQuery ? `搜索「${searchQuery}」 - LD士多` : staticRoute.title
  return {
    ...getDefaultMetadata(url, env),
    title,
    description: staticRoute.description,
    imageAlt: title
  }
}

function injectTagBeforeHeadClose(html, tag) {
  if (html.includes('</head>')) return html.replace('</head>', `${tag}\n</head>`)
  return `${html}\n${tag}`
}

function replaceUniqueTag(html, pattern, tag) {
  const withoutDuplicates = html.replace(pattern, '')
  return injectTagBeforeHeadClose(withoutDuplicates, tag)
}

function upsertTitle(html, title) {
  return replaceUniqueTag(html, /<title>[\s\S]*?<\/title>\s*/gi, `<title>${escapeHtml(title)}</title>`)
}

function upsertMetaByName(html, name, content) {
  const safeName = escapeRegExp(name)
  const pattern = new RegExp(`<meta\\s+[^>]*name=["']${safeName}["'][^>]*>\\s*`, 'gi')
  return replaceUniqueTag(html, pattern, `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}">`)
}

function upsertMetaByProperty(html, property, content) {
  const safeProperty = escapeRegExp(property)
  const pattern = new RegExp(`<meta\\s+[^>]*property=["']${safeProperty}["'][^>]*>\\s*`, 'gi')
  return replaceUniqueTag(html, pattern, `<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}">`)
}

function removeMetaByProperty(html, property) {
  const safeProperty = escapeRegExp(property)
  return html.replace(new RegExp(`<meta\\s+[^>]*property=["']${safeProperty}["'][^>]*>\\s*`, 'gi'), '')
}

function upsertCanonical(html, href) {
  return replaceUniqueTag(
    html,
    /<link\s+[^>]*rel=["']canonical["'][^>]*>\s*/gi,
    `<link rel="canonical" href="${escapeHtml(href)}">`
  )
}

function upsertOembedLink(html, href, title) {
  return replaceUniqueTag(
    html,
    /<link\s+[^>]*type=["']application\/json\+oembed["'][^>]*>\s*/gi,
    `<link rel="alternate" type="application/json+oembed" href="${escapeHtml(href)}" title="${escapeHtml(title)}">`
  )
}

export function injectMetadataIntoHtml(html, metadata, env = {}) {
  let output = html
  output = upsertTitle(output, metadata.title)
  output = upsertMetaByName(output, 'description', metadata.description)
  output = upsertMetaByName(output, 'robots', NOINDEX_POLICY)
  output = upsertCanonical(output, metadata.url)

  output = upsertMetaByProperty(output, 'og:title', metadata.title)
  output = upsertMetaByProperty(output, 'og:description', metadata.description)
  output = upsertMetaByProperty(output, 'og:type', metadata.ogType || 'website')
  output = upsertMetaByProperty(output, 'og:url', metadata.url)
  output = upsertMetaByProperty(output, 'og:site_name', metadata.siteName || 'LD士多')
  output = upsertMetaByProperty(output, 'og:image', metadata.image)
  output = upsertMetaByProperty(output, 'og:image:secure_url', metadata.image)
  output = upsertMetaByProperty(output, 'og:image:type', metadata.imageType || 'image/png')
  output = upsertMetaByProperty(output, 'og:image:width', String(metadata.imageWidth || 1200))
  output = upsertMetaByProperty(output, 'og:image:height', String(metadata.imageHeight || 630))
  output = upsertMetaByProperty(output, 'og:image:alt', metadata.imageAlt || metadata.title)
  output = upsertMetaByProperty(output, 'og:locale', metadata.locale || 'zh_CN')

  output = upsertMetaByName(output, 'twitter:card', metadata.twitterCard || 'summary_large_image')
  output = upsertMetaByName(output, 'twitter:title', metadata.title)
  output = upsertMetaByName(output, 'twitter:description', metadata.description)
  output = upsertMetaByName(output, 'twitter:image', metadata.image)
  output = upsertMetaByName(output, 'twitter:image:alt', metadata.imageAlt || metadata.title)

  for (const property of ['product:price:amount', 'product:price:currency', 'product:availability']) {
    output = removeMetaByProperty(output, property)
  }
  if (metadata.product?.priceAmount) {
    output = upsertMetaByProperty(output, 'product:price:amount', metadata.product.priceAmount)
    output = upsertMetaByProperty(output, 'product:price:currency', metadata.product.priceCurrency || 'LDC')
    output = upsertMetaByProperty(output, 'product:availability', metadata.product.availability || 'in stock')
  }

  const siteUrl = getSiteUrl(env)
  const oembedHref = new URL('/oembed.json', siteUrl)
  oembedHref.searchParams.set('url', metadata.url)
  output = upsertOembedLink(output, oembedHref.toString(), metadata.title)
  return output
}

function shouldBypassHtmlRewrite(pathname) {
  if (pathname.startsWith('/assets/')) return true
  if (pathname.startsWith('/api/')) return true
  if (pathname === '/favicon.svg') return true
  if (pathname === '/robots.txt') return true
  if (pathname === '/_headers') return true
  if (pathname === '/_redirects') return true
  return /\.[a-zA-Z0-9]+$/.test(pathname)
}

const OG_IMAGE_KINDS = new Set(['product', 'merchant', 'shop', 'buy_request', 'coupon', 'category'])
const MAX_OG_IMAGE_BYTES = 1024 * 1024

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return ''
  }
}

export function parseOgImagePath(pathname) {
  const match = String(pathname || '').match(/^\/og\/([^/]+)\/([^/]+)\.png$/)
  if (!match) return null
  const kind = safeDecode(match[1]).trim()
  const key = safeDecode(match[2]).trim()
  if (kind === 'default' && key === 'base') return { kind, key }
  if (!OG_IMAGE_KINDS.has(kind) || !key || key.length > 160 || key.includes('/')) return null
  if (['product', 'shop', 'buy_request'].includes(kind) && !new RegExp('^(?:[1-9]\\d*|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}'+')$').test(key)) return null
  return { kind, key }
}

function isPng1200x630(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 24 || buffer.byteLength > MAX_OG_IMAGE_BYTES) return false
  const bytes = new Uint8Array(buffer)
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (signature.some((value, index) => bytes[index] !== value)) return false
  const view = new DataView(buffer)
  return view.getUint32(16) === 1200 && view.getUint32(20) === 630
}

function imageResponse(buffer, { cacheControl, isHead = false } = {}) {
  return new Response(isHead ? null : buffer, {
    status: 200,
    headers: {
      'content-type': 'image/png',
      'content-length': String(buffer.byteLength),
      'cache-control': cacheControl || 'public, max-age=300',
      'access-control-allow-origin': '*',
      'cross-origin-resource-policy': 'cross-origin',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': NOINDEX_POLICY
    }
  })
}

async function fetchValidatedPng(url, timeoutMs = 9000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'image/png' },
      signal: controller.signal
    })
    const contentLength = Number(response.headers.get('content-length') || 0)
    if (!response.ok || contentLength > MAX_OG_IMAGE_BYTES) return null
    const buffer = await response.arrayBuffer()
    return isPng1200x630(buffer) ? buffer : null
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

async function getStaticOgFallback(requestUrl, env) {
  const fallbackUrl = new URL('/og-default.png', requestUrl)
  const response = await env.ASSETS.fetch(new Request(fallbackUrl.toString(), { method: 'GET' }))
  if (!response.ok) return null
  const buffer = await response.arrayBuffer()
  return isPng1200x630(buffer) ? buffer : null
}

export async function handleOgImage(request, env, context = {}) {
  const requestUrl = new URL(request.url)
  const parsed = parseOgImagePath(requestUrl.pathname)
  if (!parsed) {
    return new Response(request.method === 'HEAD' ? null : 'Not Found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': NOINDEX_POLICY
      }
    })
  }

  const revision = String(requestUrl.searchParams.get('v') || '')
  const versioned = /^[a-zA-Z0-9_-]{1,64}$/.test(revision)
  const cacheUrl = new URL(requestUrl.pathname, requestUrl.origin)
  if (versioned) cacheUrl.searchParams.set('v', revision)
  const cacheRequest = new Request(cacheUrl.toString(), { method: 'GET' })
  const edgeCache = globalThis.caches?.default
  const cached = versioned && edgeCache ? await edgeCache.match(cacheRequest) : null
  if (cached) {
    const buffer = await cached.arrayBuffer()
    return imageResponse(buffer, {
      cacheControl: cached.headers.get('cache-control') || 'public, max-age=86400, immutable',
      isHead: request.method === 'HEAD'
    })
  }

  const apiBase = String(env.LD_STORE_META_API_BASE || DEFAULT_API_BASE).trim() || DEFAULT_API_BASE
  const upstream = new URL(
    `/api/shop/share-image/${encodeURIComponent(parsed.kind)}/${encodeURIComponent(parsed.key)}`,
    apiBase.endsWith('/') ? apiBase : `${apiBase}/`
  )
  if (versioned) upstream.searchParams.set('v', revision)
  const image = await fetchValidatedPng(upstream.toString())
  if (image) {
    const cacheControl = versioned
      ? 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800, immutable'
      : 'public, max-age=300, s-maxage=300'
    const response = imageResponse(image, { cacheControl, isHead: request.method === 'HEAD' })
    if (versioned && edgeCache && typeof context.waitUntil === 'function') {
      const cacheable = imageResponse(image, { cacheControl })
      context.waitUntil(edgeCache.put(cacheRequest, cacheable))
    }
    return response
  }

  const fallback = await getStaticOgFallback(requestUrl, env)
  if (fallback) return imageResponse(fallback, { cacheControl: 'public, max-age=300, s-maxage=300', isHead: request.method === 'HEAD' })
  return new Response(request.method === 'HEAD' ? null : 'Open Graph image unavailable', {
    status: 502,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': NOINDEX_POLICY
    }
  })
}

function isRedirectStatus(status) {
  return status >= 300 && status < 400
}

function isSameDestination(location, requestUrl) {
  const raw = String(location || '').trim()
  if (!raw) return false
  try {
    const target = new URL(raw, requestUrl)
    return target.origin === requestUrl.origin && target.pathname === requestUrl.pathname && target.search === requestUrl.search
  } catch {
    return false
  }
}

function getLegacyHosts(env) {
  const raw = String(env.LD_STORE_LEGACY_HOSTS || '').trim()
  const hosts = raw ? raw.split(',').map(item => item.trim().toLowerCase()).filter(Boolean) : DEFAULT_LEGACY_HOSTS
  return new Set(hosts)
}

function maybeRedirectLegacyHost(requestUrl, env) {
  const hostname = requestUrl.hostname.toLowerCase()
  if (!getLegacyHosts(env).has(hostname)) return null
  const destination = getSiteUrl(env)
  if (hostname === destination.hostname.toLowerCase()) return null
  const targetUrl = new URL(requestUrl.pathname + requestUrl.search, destination)
  return new Response(null, {
    status: 301,
    headers: { location: targetUrl.toString(), 'cache-control': 'public, max-age=3600' }
  })
}

function jsonResponse(body, status = 200, cacheControl = OEMBED_CACHE_CONTROL, isHead = false) {
  const text = JSON.stringify(body)
  return new Response(isHead ? null : text, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
      'x-content-type-options': 'nosniff',
      'x-robots-tag': NOINDEX_POLICY
    }
  })
}

export async function handleOembed(request, env = {}) {
  const requestUrl = new URL(request.url)
  const siteUrl = getSiteUrl(env)
  const targetRaw = requestUrl.searchParams.get('url')
  let target = new URL(siteUrl)
  if (targetRaw) {
    try {
      target = new URL(targetRaw)
    } catch {
      return jsonResponse({ error: 'invalid_url' }, 400, 'no-store', request.method === 'HEAD')
    }
    if (target.origin !== siteUrl.origin) {
      return jsonResponse({ error: 'invalid_origin' }, 400, 'no-store', request.method === 'HEAD')
    }
  }

  const metadata = await resolvePageMetadata(target, env)
  return jsonResponse({
    version: '1.0',
    type: 'link',
    title: metadata.title,
    author_name: 'LD士多',
    author_url: siteUrl.toString(),
    provider_name: 'LD士多',
    provider_url: siteUrl.toString(),
    thumbnail_url: metadata.image,
    thumbnail_width: metadata.imageWidth,
    thumbnail_height: metadata.imageHeight
  }, 200, OEMBED_CACHE_CONTROL, request.method === 'HEAD')
}

async function handleHtmlRequest(request, env) {
  const requestUrl = new URL(request.url)
  const metadata = await resolvePageMetadata(requestUrl, env)
  let assetResponse = await env.ASSETS.fetch(request)

  if (isRedirectStatus(assetResponse.status) && isSameDestination(assetResponse.headers.get('location'), requestUrl)) {
    assetResponse = await env.ASSETS.fetch(new Request(new URL('/', requestUrl).toString(), request))
  }
  if (!assetResponse.ok) return assetResponse
  const contentType = (assetResponse.headers.get('content-type') || '').toLowerCase()
  if (!contentType.includes('text/html')) return assetResponse

  const rewritten = injectMetadataIntoHtml(await assetResponse.text(), metadata, env)
  const headers = new Headers(assetResponse.headers)
  headers.set('content-type', 'text/html; charset=utf-8')
  headers.set('cache-control', HTML_CACHE_CONTROL)
  headers.set('content-security-policy', STOREFRONT_CSP)
  headers.set('x-robots-tag', NOINDEX_POLICY)
  headers.delete('content-length')
  const status = metadata.notFound ? 404 : 200
  return new Response(request.method === 'HEAD' ? null : rewritten, { status, headers })
}

export default {
  async fetch(request, env, context = {}) {
    const url = new URL(request.url)
    const method = request.method.toUpperCase()
    const legacyRedirect = maybeRedirectLegacyHost(url, env)
    if (legacyRedirect) return legacyRedirect
    if (method !== 'GET' && method !== 'HEAD') return env.ASSETS.fetch(request)
    if (url.pathname === '/oembed.json') return handleOembed(request, env)
    if (url.pathname.startsWith('/og/')) return handleOgImage(request, env, context)

    if (shouldBypassHtmlRewrite(url.pathname)) {
      const assetResponse = await env.ASSETS.fetch(request)
      if (assetResponse.status === 200) {
        const contentType = (assetResponse.headers.get('content-type') || '').toLowerCase()
        if (contentType.includes('text/html') && /\.[a-zA-Z0-9]+$/.test(url.pathname)) {
          return new Response(request.method === 'HEAD' ? null : 'Not Found', {
            status: 404,
            headers: {
              'content-type': 'text/plain; charset=utf-8',
              'cache-control': 'no-store',
              'x-robots-tag': NOINDEX_POLICY
            }
          })
        }
      }
      return assetResponse
    }
    return handleHtmlRequest(request, env)
  }
}
