const DEFAULT_SITE_URL = 'https://ldcstore.com/'
const DEFAULT_API_BASE = 'https://api2.ldspro.qzz.io'
const DEFAULT_OG_IMAGE = 'https://img.ldspro.qzz.io/JackyLiii/20260123_og-image_9zs1sl.png'
const DEFAULT_LEGACY_HOSTS = ['ldstore.cc.cd', 'ldst0re.qzz.io']
const DEFAULT_TITLE = 'LD士多-LinuxDo站点积分兑换中心'
const DEFAULT_DESCRIPTION = '在 LD士多 使用 Linux.do 社区积分兑换精选虚拟物品与服务。'

const STATIC_ROUTE_TITLES = [
  [/^\/$/, 'LD士多-LinuxDo站点积分兑换中心'],
  [/^\/merchant\/[^/]+\/?$/, '商家主页 - LD士多'],
  [/^\/category\/[^/]+\/?$/, '分类商品 - LD士多'],
  [/^\/search\/?$/, '搜索 - LD士多'],
  [/^\/buy-request\/[^/]+\/?$/, '求购详情 - LD士多'],
  [/^\/user\/?$/, '个人中心 - LD士多'],
  [/^\/user\/orders\/?$/, '我的订单 - LD士多'],
  [/^\/user\/favorites\/?$/, '我的收藏 - LD士多'],
  [/^\/user\/buy-orders\/[^/]+\/?$/, '求购订单详情 - LD士多'],
  [/^\/user\/products\/?$/, '我的商品 - LD士多'],
  [/^\/user\/buy-requests\/?$/, '我的求购 - LD士多'],
  [/^\/user\/messages\/?$/, '我的消息 - LD士多'],
  [/^\/user\/buy-chats\/?$/, '我的消息 - LD士多'],
  [/^\/user\/settings\/?$/, 'LDC收款配置 - LD士多'],
  [/^\/user\/my-shop\/?$/, '小店入驻 - LD士多'],
  [/^\/publish\/?$/, '发布商品 - LD士多'],
  [/^\/edit\/[^/]+\/?$/, '编辑商品 - LD士多'],
  [/^\/order\/[^/]+\/?$/, '订单详情 - LD士多'],
  [/^\/login\/?$/, '登录 - LD士多'],
  [/^\/auth\/callback\/?$/, '登录中...'],
  [/^\/ld-image\/?$/, '士多图床 - LD士多'],
  [/^\/docs(?:\/[^/]+)?\/?$/, '使用文档 - LD士多'],
  [/^\/support\/?$/, '支持 LDStatus Pro - LD士多'],
  [/^\/maintenance\/?$/, '系统维护中 - LD士多']
]

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateText(value, maxLength = 120) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}…`
}

function toAbsoluteUrl(raw, fallbackOrigin) {
  const source = String(raw || '').trim()
  if (!source) return ''
  try {
    return new URL(source, fallbackOrigin).toString()
  } catch (_) {
    return ''
  }
}

function getDefaultMetadata(url, env) {
  const siteUrl = String(env.LD_STORE_SITE_URL || DEFAULT_SITE_URL).trim() || DEFAULT_SITE_URL
  const canonicalUrl = toAbsoluteUrl(url.pathname + url.search, siteUrl) || url.toString()
  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    ogType: 'website',
    url: canonicalUrl,
    siteName: 'LD士多',
    image: String(env.LD_STORE_DEFAULT_OG_IMAGE || DEFAULT_OG_IMAGE).trim() || DEFAULT_OG_IMAGE,
    imageAlt: DEFAULT_TITLE,
    locale: 'zh_CN',
    twitterCard: 'summary_large_image',
    cacheControl: 'no-store, no-cache, must-revalidate'
  }
}

function getStaticRouteTitle(pathname) {
  for (const [pattern, title] of STATIC_ROUTE_TITLES) {
    if (pattern.test(pathname)) {
      return title
    }
  }
  return ''
}

function mergeMetadata(base, patch = {}) {
  return {
    ...base,
    ...patch
  }
}

async function fetchJson(url, timeoutMs = 2500) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      signal: controller.signal
    })
    if (!response.ok) return null
    return await response.json()
  } catch (_) {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

function unwrapApiPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  if (payload.success === true && payload.data !== undefined) {
    return payload.data
  }
  return payload
}

function pickFirstNonEmpty(values) {
  for (const item of values) {
    const value = String(item || '').trim()
    if (value) return value
  }
  return ''
}

function parseImages(raw) {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || '').trim()).filter(Boolean)
  }
  if (typeof raw !== 'string') {
    return []
  }
  const value = raw.trim()
  if (!value) return []
  if (!value.startsWith('[')) {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || '').trim()).filter(Boolean)
    }
  } catch (_) {}
  return []
}

async function getProductMetadata(url, env, baseMeta) {
  const match = url.pathname.match(/^\/product\/(\d+)\/?$/)
  if (!match) return null

  const productId = match[1]
  const apiBase = String(env.LD_STORE_META_API_BASE || DEFAULT_API_BASE).trim() || DEFAULT_API_BASE
  const apiUrl = `${apiBase.replace(/\/$/, '')}/api/shop/products/${encodeURIComponent(productId)}`
  const response = await fetchJson(apiUrl)
  const payload = unwrapApiPayload(response)
  const product = payload?.product || payload?.data?.product || null
  if (!product || typeof product !== 'object') return null

  const productName = String(product.name || '').trim()
  if (!productName) return null

  const parsedImages = parseImages(product.images)
  const productImage = toAbsoluteUrl(
    pickFirstNonEmpty([
      product.image_url,
      product.cover_url,
      product.cover,
      parsedImages[0],
      baseMeta.image
    ]),
    baseMeta.url
  ) || baseMeta.image

  const rawDescription = stripHtml(product.description || product.short_description || '')
  const description = truncateText(
    rawDescription || `在 LD士多 查看「${productName}」的详情信息与兑换方式。`,
    120
  )

  return mergeMetadata(baseMeta, {
    title: `${productName} - LD士多`,
    description,
    ogType: 'product',
    image: productImage,
    imageAlt: `${productName} - LD士多`,
    cacheControl: 'no-store, no-cache, must-revalidate'
  })
}

async function getShopMetadata(url, env, baseMeta) {
  const match = url.pathname.match(/^\/shop\/(\d+)\/?$/)
  if (!match) return null

  const shopId = match[1]
  const apiBase = String(env.LD_STORE_META_API_BASE || DEFAULT_API_BASE).trim() || DEFAULT_API_BASE
  const apiUrl = `${apiBase.replace(/\/$/, '')}/api/shops/${encodeURIComponent(shopId)}`
  const response = await fetchJson(apiUrl)
  const payload = unwrapApiPayload(response)
  const shop = payload?.data || payload
  if (!shop || typeof shop !== 'object') return null

  const shopName = String(shop.name || '').trim()
  if (!shopName) return null

  const shopImage = toAbsoluteUrl(
    pickFirstNonEmpty([
      shop.image_url,
      baseMeta.image
    ]),
    baseMeta.url
  ) || baseMeta.image

  const rawDescription = stripHtml(shop.description || '')
  const description = truncateText(
    rawDescription || `在 LD士多 查看「${shopName}」的小店详情与相关信息。`,
    120
  )

  return mergeMetadata(baseMeta, {
    title: `${shopName} - LD士多`,
    description,
    image: shopImage,
    imageAlt: `${shopName} - LD士多`,
    cacheControl: 'no-store, no-cache, must-revalidate'
  })
}

async function getMerchantMetadata(url, env, baseMeta) {
  const match = url.pathname.match(/^\/merchant\/([^/]+)\/?$/)
  if (!match) return null

  const username = decodeURIComponent(match[1] || '').trim()
  if (!username) return null

  const apiBase = String(env.LD_STORE_META_API_BASE || DEFAULT_API_BASE).trim() || DEFAULT_API_BASE
  const apiUrl = `${apiBase.replace(/\/$/, '')}/api/shop/merchants/${encodeURIComponent(username)}`
  const response = await fetchJson(apiUrl)
  const payload = unwrapApiPayload(response)
  const merchant = payload?.merchant || payload?.data?.merchant || null
  if (!merchant || typeof merchant !== 'object') return null

  const merchantUsername = String(merchant.username || username).trim()
  if (!merchantUsername) return null

  const merchantImage = toAbsoluteUrl(
    pickFirstNonEmpty([
      merchant.avatar,
      merchant.avatar_url,
      baseMeta.image
    ]),
    baseMeta.url
  ) || baseMeta.image

  return mergeMetadata(baseMeta, {
    title: `${merchantUsername}的小店 - LD士多`,
    description: `来逛逛${merchantUsername}的士多小店吧`,
    ogType: 'profile',
    image: merchantImage,
    imageAlt: `${merchantUsername}的小店 - LD士多`,
    cacheControl: 'no-store, no-cache, must-revalidate'
  })
}

async function resolvePageMetadata(url, env) {
  const baseMeta = getDefaultMetadata(url, env)

  const productMeta = await getProductMetadata(url, env, baseMeta)
  if (productMeta) {
    return productMeta
  }

  const shopMeta = await getShopMetadata(url, env, baseMeta)
  if (shopMeta) {
    return shopMeta
  }

  const merchantMeta = await getMerchantMetadata(url, env, baseMeta)
  if (merchantMeta) {
    return merchantMeta
  }

  const staticTitle = getStaticRouteTitle(url.pathname)
  if (staticTitle) {
    return mergeMetadata(baseMeta, {
      title: staticTitle,
      imageAlt: staticTitle,
      cacheControl: 'no-store, no-cache, must-revalidate'
    })
  }

  return mergeMetadata(baseMeta, {
    title: '页面未找到 - LD士多',
    imageAlt: '页面未找到 - LD士多',
    cacheControl: 'no-store, no-cache, must-revalidate'
  })
}

function injectTagBeforeHeadClose(html, tag) {
  if (html.includes('</head>')) {
    return html.replace('</head>', `${tag}\n</head>`)
  }
  return `${html}\n${tag}`
}

function upsertTitle(html, title) {
  const tag = `<title>${escapeHtml(title)}</title>`
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, tag)
  }
  return injectTagBeforeHeadClose(html, tag)
}

function upsertMetaByName(html, name, content) {
  const safeName = escapeRegExp(name)
  const tag = `<meta name="${name}" content="${escapeHtml(content)}">`
  const pattern = new RegExp(`<meta\\s+[^>]*name=["']${safeName}["'][^>]*>`, 'i')
  if (pattern.test(html)) {
    return html.replace(pattern, tag)
  }
  return injectTagBeforeHeadClose(html, tag)
}

function upsertMetaByProperty(html, property, content) {
  const safeProperty = escapeRegExp(property)
  const tag = `<meta property="${property}" content="${escapeHtml(content)}">`
  const pattern = new RegExp(`<meta\\s+[^>]*property=["']${safeProperty}["'][^>]*>`, 'i')
  if (pattern.test(html)) {
    return html.replace(pattern, tag)
  }
  return injectTagBeforeHeadClose(html, tag)
}

function upsertOembedLink(html, href, title) {
  const tag = `<link rel="alternate" type="application/json+oembed" href="${escapeHtml(href)}" title="${escapeHtml(title)}">`
  const pattern = /<link\s+[^>]*type=["']application\/json\+oembed["'][^>]*>/i
  if (pattern.test(html)) {
    return html.replace(pattern, tag)
  }
  return injectTagBeforeHeadClose(html, tag)
}

function injectMetadataIntoHtml(html, metadata, env) {
  let output = html
  output = upsertTitle(output, metadata.title)
  output = upsertMetaByName(output, 'description', metadata.description)

  output = upsertMetaByProperty(output, 'og:title', metadata.title)
  output = upsertMetaByProperty(output, 'og:description', metadata.description)
  output = upsertMetaByProperty(output, 'og:type', metadata.ogType || 'website')
  output = upsertMetaByProperty(output, 'og:url', metadata.url)
  output = upsertMetaByProperty(output, 'og:site_name', metadata.siteName || 'LD士多')
  output = upsertMetaByProperty(output, 'og:image', metadata.image)
  output = upsertMetaByProperty(output, 'og:image:alt', metadata.imageAlt || metadata.title)
  output = upsertMetaByProperty(output, 'og:locale', metadata.locale || 'zh_CN')

  output = upsertMetaByName(output, 'twitter:card', metadata.twitterCard || 'summary_large_image')
  output = upsertMetaByName(output, 'twitter:title', metadata.title)
  output = upsertMetaByName(output, 'twitter:description', metadata.description)
  output = upsertMetaByName(output, 'twitter:image', metadata.image)

  const siteUrl = String(env.LD_STORE_SITE_URL || DEFAULT_SITE_URL).trim() || DEFAULT_SITE_URL
  const oembedHref = `${siteUrl.replace(/\/$/, '')}/oembed.json?url=${encodeURIComponent(metadata.url)}`
  output = upsertOembedLink(output, oembedHref, metadata.title)

  return output
}

function shouldBypassHtmlRewrite(pathname) {
  if (pathname.startsWith('/assets/')) return true
  if (pathname.startsWith('/api/')) return true
  if (pathname === '/favicon.svg') return true
  if (pathname === '/robots.txt') return true
  if (pathname === '/og-image.svg') return true
  if (pathname === '/generate-og-image.html') return true
  if (pathname === '/_headers') return true
  if (pathname === '/_redirects') return true
  return /\.[a-zA-Z0-9]+$/.test(pathname)
}

function isRedirectStatus(status) {
  return status >= 300 && status < 400
}

function isSameDestination(location, requestUrl) {
  const raw = String(location || '').trim()
  if (!raw) return false
  try {
    const target = new URL(raw, requestUrl)
    return target.origin === requestUrl.origin
      && target.pathname === requestUrl.pathname
      && target.search === requestUrl.search
  } catch (_) {
    return false
  }
}

function getLegacyHosts(env) {
  const raw = String(env.LD_STORE_LEGACY_HOSTS || '').trim()
  const hosts = raw
    ? raw.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_LEGACY_HOSTS
  return new Set(hosts)
}

function maybeRedirectLegacyHost(requestUrl, env) {
  const hostname = requestUrl.hostname.toLowerCase()
  const legacyHosts = getLegacyHosts(env)
  if (!legacyHosts.has(hostname)) {
    return null
  }

  const siteUrl = String(env.LD_STORE_SITE_URL || DEFAULT_SITE_URL).trim() || DEFAULT_SITE_URL
  let destination
  try {
    destination = new URL(siteUrl)
  } catch (_) {
    destination = new URL(DEFAULT_SITE_URL)
  }

  // Prevent redirect loops if env hosts are misconfigured.
  if (hostname === destination.hostname.toLowerCase()) {
    return null
  }

  const targetUrl = new URL(requestUrl.pathname + requestUrl.search, destination)
  return new Response(null, {
    status: 301,
    headers: {
      location: targetUrl.toString(),
      'cache-control': 'public, max-age=3600'
    }
  })
}

function jsonResponse(body, status = 200, cacheControl = 'public, max-age=300', isHead = false) {
  const text = JSON.stringify(body)
  return new Response(isHead ? null : text, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl
    }
  })
}

async function handleOembed(request, env) {
  const url = new URL(request.url)
  const targetRaw = url.searchParams.get('url')
  const siteUrl = String(env.LD_STORE_SITE_URL || DEFAULT_SITE_URL).trim() || DEFAULT_SITE_URL

  let target = new URL(siteUrl)
  if (targetRaw) {
    try {
      const parsed = new URL(targetRaw)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        target = parsed
      }
    } catch (_) {}
  }

  const metadata = await resolvePageMetadata(target, env)
  const oembed = {
    version: '1.0',
    type: 'link',
    title: metadata.title,
    author_name: 'LD士多',
    author_url: siteUrl,
    provider_name: 'LD士多',
    provider_url: siteUrl,
    thumbnail_url: metadata.image,
    thumbnail_width: 1200,
    thumbnail_height: 630
  }

  return jsonResponse(
    oembed,
    200,
    metadata.cacheControl || 'public, max-age=300',
    request.method === 'HEAD'
  )
}

async function handleHtmlRequest(request, env) {
  const requestUrl = new URL(request.url)
  const metadata = await resolvePageMetadata(requestUrl, env)

  let assetResponse = await env.ASSETS.fetch(request)

  // Some Pages setups may return a self-redirect (for example "/" -> "/").
  // Do not pass that redirect through, otherwise the browser loops forever.
  if (isRedirectStatus(assetResponse.status)) {
    const location = assetResponse.headers.get('location')
    if (isSameDestination(location, requestUrl)) {
      const fallbackUrl = new URL('/', requestUrl)
      assetResponse = await env.ASSETS.fetch(new Request(fallbackUrl.toString(), request))
    }
  }

  if (!assetResponse.ok) {
    return assetResponse
  }

  const contentType = (assetResponse.headers.get('content-type') || '').toLowerCase()
  if (!contentType.includes('text/html')) {
    return assetResponse
  }

  const html = await assetResponse.text()
  const rewritten = injectMetadataIntoHtml(html, metadata, env)

  const headers = new Headers(assetResponse.headers)
  headers.set('content-type', 'text/html; charset=utf-8')
  headers.set('cache-control', metadata.cacheControl || 'public, max-age=300')

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers
    })
  }

  return new Response(rewritten, {
    status: 200,
    headers
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const method = request.method.toUpperCase()
    const legacyRedirect = maybeRedirectLegacyHost(url, env)

    if (legacyRedirect) {
      return legacyRedirect
    }

    if (method !== 'GET' && method !== 'HEAD') {
      return env.ASSETS.fetch(request)
    }

    if (url.pathname === '/oembed.json') {
      return handleOembed(request, env)
    }

    if (shouldBypassHtmlRewrite(url.pathname)) {
      return env.ASSETS.fetch(request)
    }

    return handleHtmlRequest(request, env)
  }
}
