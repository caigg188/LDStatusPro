import { afterEach, describe, expect, it, vi } from 'vitest'
import worker, {
  canonicalizePageUrl,
  handleOgImage,
  handleOembed,
  injectMetadataIntoHtml,
  NOINDEX_POLICY,
  parseOgImagePath,
  resolvePageMetadata,
  STOREFRONT_CSP
} from '../public/_worker.js'

const env = {
  LD_STORE_SITE_URL: 'https://ldcstore.com/',
  LD_STORE_META_API_BASE: 'https://api2.example.com'
}
const publicId = 'aaaaaaaa-1111-4111-8111-111111111111'

const productMetadata = {
  kind: 'product',
  canonicalPath: '/product/42',
  title: '测试商品 & 服务 - LD士多',
  description: '商品描述',
  ogType: 'product',
  revision: 'abc123',
  image: {
    path: '/og/product/42.png?v=abc123',
    alt: '测试商品分享图',
    type: 'image/png',
    width: 1200,
    height: 630
  },
  product: {
    priceAmount: '80.00',
    priceCurrency: 'LDC',
    availability: 'in stock'
  }
}

function apiResponse(data = productMetadata, status = 200) {
  return new Response(JSON.stringify(status === 200
    ? { success: true, data }
    : { success: false, error: { code: 'SHARE_NOT_FOUND', status } }), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function htmlAsset() {
  return new Response(`<!doctype html><html><head>
    <title>旧标题</title><title>重复标题</title>
    <meta name="description" content="旧描述">
    <meta name="robots" content="index">
    <meta property="og:title" content="旧标题">
    <meta property="og:title" content="重复标题">
    <meta property="product:price:amount" content="1">
    <link rel="canonical" href="https://old.example/path">
    <link rel="alternate" type="application/json+oembed" href="/old.json">
  </head><body><div id="app"></div></body></html>`, {
    headers: {
      'content-type': 'text/html',
      'content-length': '999',
      'content-security-policy': "default-src 'self'; script-src 'self'; object-src 'none'"
    }
  })
}

function pngHeader(width = 1200, height = 630) {
  const buffer = new ArrayBuffer(24)
  const bytes = new Uint8Array(buffer)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  const view = new DataView(buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return buffer
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Open Graph canonical URLs', () => {
  it('removes tracking and presentation queries from content routes', () => {
    expect(canonicalizePageUrl('https://ldcstore.com/product/42/?utm_source=linuxdo&tab=comments', env))
      .toBe('https://ldcstore.com/product/42')
  })

  it('keeps only the search keyword on search pages', () => {
    expect(canonicalizePageUrl('https://ldcstore.com/search?q=AI+service&page=3&sort=price', env))
      .toBe('https://ldcstore.com/search?q=AI+service')
  })

  it('retains the merchant identity while dropping tracking parameters', () => {
    expect(canonicalizePageUrl('https://ldcstore.com/merchant/old?site=idcflare.com&userId=123&utm_source=forum', env))
      .toBe('https://ldcstore.com/merchant/old?site=idcflare.com&userId=123')
  })

  it('forwards the merchant site and ID to share metadata', async () => {
    const fetchMock = vi.fn(async () => apiResponse({
      ...productMetadata, kind: 'merchant', canonicalPath: '/merchant/current?site=idcflare.com&userId=123',
      image: { ...productMetadata.image, path: '/og/merchant/idcflare.com%3A123.png?v=abc123' }
    }))
    vi.stubGlobal('fetch', fetchMock)
    const metadata = await resolvePageMetadata('https://ldcstore.com/merchant/old?site=idcflare.com&userId=123&utm_source=forum', env)
    const requestedPath = new URL(fetchMock.mock.calls[0][0]).searchParams.get('path')
    expect(requestedPath).toBe('/merchant/old?site=idcflare.com&userId=123')
    expect(metadata.url).toBe('https://ldcstore.com/merchant/current?site=idcflare.com&userId=123')
    expect(parseOgImagePath('/og/merchant/idcflare.com%3A123.png')).toEqual({ kind: 'merchant', key: 'idcflare.com:123' })
  })
})

describe('share metadata resolution', () => {
  it.each([
    '/product/42',
    '/merchant/alice',
    '/shop/7',
    '/buy-request/9',
    `/product/${publicId}`,
    `/shop/${publicId}`,
    `/buy-request/${publicId}`,
    '/coupon/coupon-token',
    '/category/AI%20%E6%9C%8D%E5%8A%A1'
  ])('uses the unified side-effect-free endpoint for %s', async path => {
    const fetchMock = vi.fn(async () => apiResponse({
      ...productMetadata,
      canonicalPath: path,
      image: { ...productMetadata.image, path: `/og/product/42.png?v=abc123` }
    }))
    vi.stubGlobal('fetch', fetchMock)
    const metadata = await resolvePageMetadata(`https://ldcstore.com${path}?utm_source=linuxdo`, env)
    expect(metadata.notFound).toBe(false)
    expect(metadata.image).toBe('https://ldcstore.com/og/product/42.png?v=abc123')
    const calledUrl = new URL(fetchMock.mock.calls[0][0])
    expect(calledUrl.pathname).toBe('/api/shop/share-meta')
    expect(calledUrl.searchParams.get('path')).toBe(path)
  })

  it('uses a privacy-preserving fallback for API 404 and a route fallback for transient failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => apiResponse(null, 404)))
    const privateOrMissing = await resolvePageMetadata('https://ldcstore.com/product/404', env)
    expect(privateOrMissing).toMatchObject({
      notFound: false,
      title: '商品暂不可公开预览 - LD士多',
      description: '该商品可能需要登录、满足社区信任等级，或当前已不可用。请打开 LD士多后查看。',
      product: null
    })
    expect(privateOrMissing.image).toBe('https://ldcstore.com/og/default/base.png?v=1')

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('timeout') }))
    const unavailable = await resolvePageMetadata('https://ldcstore.com/product/42', env)
    expect(unavailable).toMatchObject({ notFound: false, title: '商品详情 - LD士多' })
  })

  it('does not trust malformed or cross-origin image metadata', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => apiResponse({
      ...productMetadata,
      image: { ...productMetadata.image, path: 'https://evil.example/track.png' }
    })))
    const metadata = await resolvePageMetadata('https://ldcstore.com/product/42', env)
    expect(metadata.title).toBe('商品详情 - LD士多')
    expect(metadata.image).not.toContain('evil.example')
  })

  it('drops malformed product pricing fields instead of injecting them', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => apiResponse({
      ...productMetadata,
      product: { priceAmount: 'free', priceCurrency: 'USD', availability: 'unknown' }
    })))
    const metadata = await resolvePageMetadata('https://ldcstore.com/product/42', env)
    expect(metadata.product).toBeNull()
  })

  it('uses query-aware static metadata and a real not-found state for unknown routes', async () => {
    const search = await resolvePageMetadata('https://ldcstore.com/search?q=%E4%BA%91%E6%9C%8D%E5%8A%A1&page=2', env)
    expect(search.title).toBe('搜索「云服务」 - LD士多')
    expect(search.url).toBe('https://ldcstore.com/search?q=%E4%BA%91%E6%9C%8D%E5%8A%A1')
    expect((await resolvePageMetadata('https://ldcstore.com/not-a-route', env)).notFound).toBe(true)
  })
})

describe('HTML metadata injection', () => {
  it('emits one complete OG/Twitter/canonical set and product fields', async () => {
    const metadata = {
      title: '测试商品 & 服务 - LD士多',
      description: '商品描述',
      ogType: 'product',
      url: 'https://ldcstore.com/product/42',
      siteName: 'LD士多',
      image: 'https://ldcstore.com/og/product/42.png?v=abc123',
      imageAlt: '测试商品分享图',
      imageType: 'image/png',
      imageWidth: 1200,
      imageHeight: 630,
      locale: 'zh_CN',
      twitterCard: 'summary_large_image',
      product: productMetadata.product
    }
    const output = injectMetadataIntoHtml(await htmlAsset().text(), metadata, env)
    for (const marker of [
      '<title>', 'name="description"', 'name="robots"', 'rel="canonical"',
      'property="og:title"', 'property="og:image:secure_url"', 'property="og:image:type"',
      'property="og:image:width"', 'property="og:image:height"', 'property="og:image:alt"',
      'name="twitter:image:alt"', 'property="product:price:amount"',
      'property="product:price:currency"', 'property="product:availability"',
      'type="application/json+oembed"'
    ]) {
      expect(output.split(marker)).toHaveLength(2)
    }
    expect(output).toContain('<title>测试商品 &amp; 服务 - LD士多</title>')
    expect(output).toContain('content="noindex, nofollow, noarchive"')
    expect(output).toContain('content="1200"')
    expect(output).toContain('content="630"')
    expect(output).toContain('content="80.00"')
  })

  it('removes stale product fields from non-product pages', async () => {
    const base = await htmlAsset().text()
    const output = injectMetadataIntoHtml(base, {
      title: '首页', description: '描述', ogType: 'website', url: 'https://ldcstore.com/',
      siteName: 'LD士多', image: 'https://ldcstore.com/og/default/base.png', imageAlt: '首页',
      imageType: 'image/png', imageWidth: 1200, imageHeight: 630, locale: 'zh_CN', product: null
    }, env)
    expect(output).not.toContain('product:price:amount')
  })
})

describe('Worker responses and oEmbed', () => {
  it('returns rewritten HTML with no-store/noindex and preserves HEAD semantics', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => apiResponse()))
    const workerEnv = { ...env, ASSETS: { fetch: vi.fn(async () => htmlAsset()) } }
    const response = await worker.fetch(new Request('https://ldcstore.com/product/42'), workerEnv)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store, no-cache, must-revalidate')
    expect(response.headers.get('x-robots-tag')).toBe(NOINDEX_POLICY)
    expect(response.headers.get('content-security-policy')).toBe(STOREFRONT_CSP)
    expect(response.headers.get('content-security-policy')).toContain("style-src-attr 'none'")
    expect(response.headers.get('content-length')).toBeNull()
    expect(await response.text()).toContain('property="og:title"')

    const head = await worker.fetch(new Request('https://ldcstore.com/product/42', { method: 'HEAD' }), workerEnv)
    expect(head.status).toBe(200)
    expect(await head.text()).toBe('')
  })

  it('returns a generic HTTP 200 for private-or-missing dynamic content and 404 for unknown routes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => apiResponse(null, 404)))
    const workerEnv = { ...env, ASSETS: { fetch: vi.fn(async () => htmlAsset()) } }
    const privateOrMissing = await worker.fetch(new Request('https://ldcstore.com/product/404'), workerEnv)
    expect(privateOrMissing.status).toBe(200)
    expect(await privateOrMissing.text()).toContain('商品暂不可公开预览 - LD士多')
    const unknown = await worker.fetch(new Request('https://ldcstore.com/unknown'), workerEnv)
    expect(unknown.status).toBe(404)
    expect(unknown.headers.get('x-robots-tag')).toBe(NOINDEX_POLICY)
  })

  it('rejects cross-origin oEmbed targets and returns dynamic same-origin thumbnails', async () => {
    const invalid = await handleOembed(new Request('https://ldcstore.com/oembed.json?url=https%3A%2F%2Fevil.example%2F'), env)
    expect(invalid.status).toBe(400)
    expect(invalid.headers.get('x-robots-tag')).toBe(NOINDEX_POLICY)
    expect(await invalid.json()).toEqual({ error: 'invalid_origin' })

    vi.stubGlobal('fetch', vi.fn(async () => apiResponse()))
    const valid = await handleOembed(new Request('https://ldcstore.com/oembed.json?url=https%3A%2F%2Fldcstore.com%2Fproduct%2F42'), env)
    expect(valid.status).toBe(200)
    expect(valid.headers.get('x-robots-tag')).toBe(NOINDEX_POLICY)
    expect(await valid.json()).toMatchObject({
      type: 'link',
      title: productMetadata.title,
      thumbnail_url: 'https://ldcstore.com/og/product/42.png?v=abc123',
      thumbnail_width: 1200,
      thumbnail_height: 630
    })
  })

  it('redirects legacy hosts without losing paths or queries', async () => {
    const response = await worker.fetch(new Request('https://ldst0re.qzz.io/product/42?from=old'), {
      ...env,
      ASSETS: { fetch: vi.fn() }
    })
    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe('https://ldcstore.com/product/42?from=old')
  })
})

describe('same-origin OG image proxy', () => {
  it.each([
    ['/og/product/42.png', { kind: 'product', key: '42' }],
    ['/og/buy_request/9.png', { kind: 'buy_request', key: '9' }],
    [`/og/product/${publicId}.png`, { kind: 'product', key: publicId }],
    [`/og/shop/${publicId}.png`, { kind: 'shop', key: publicId }],
    [`/og/buy_request/${publicId}.png`, { kind: 'buy_request', key: publicId }],
    ['/og/merchant/%E5%BC%A0%E4%B8%89.png', { kind: 'merchant', key: '张三' }],
    ['/og/default/base.png', { kind: 'default', key: 'base' }]
  ])('parses %s', (path, expected) => {
    expect(parseOgImagePath(path)).toEqual(expected)
  })

  it.each(['/og/product/nope.png', '/og/unknown/42.png', '/og/default/other.png', '/og/product/42.jpg'])('rejects invalid image path %s', path => {
    expect(parseOgImagePath(path)).toBeNull()
  })

  it('validates and edge-caches versioned backend PNG responses', async () => {
    const upstreamFetch = vi.fn(async () => new Response(pngHeader(), {
      headers: { 'content-type': 'image/png', 'content-length': '24' }
    }))
    vi.stubGlobal('fetch', upstreamFetch)
    const edgeCache = { match: vi.fn(async () => null), put: vi.fn(async () => undefined) }
    vi.stubGlobal('caches', { default: edgeCache })
    const pending = []
    const response = await handleOgImage(
      new Request('https://ldcstore.com/og/product/42.png?v=abc123'),
      { ...env, ASSETS: { fetch: vi.fn() } },
      { waitUntil: promise => pending.push(promise) }
    )
    await Promise.all(pending)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toContain('max-age=86400')
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('x-robots-tag')).toBe(NOINDEX_POLICY)
    expect(new URL(upstreamFetch.mock.calls[0][0]).pathname).toBe('/api/shop/share-image/product/42')
    expect(edgeCache.put).toHaveBeenCalledOnce()
  })
  it('forwards UUID image keys intact to the API', async () => {
    const upstream = vi.fn(async () => new Response(pngHeader(), { headers: { 'content-type': 'image/png' } }))
    vi.stubGlobal('fetch', upstream)
    vi.stubGlobal('caches', { default: { match: vi.fn(async () => null), put: vi.fn(async () => undefined) } })
    const pending = []
    const response = await handleOgImage(new Request(`https://ldcstore.com/og/product/${publicId}.png?v=test`), env,
      { waitUntil: promise => pending.push(promise) })
    await Promise.all(pending)
    expect(response.status).toBe(200)
    expect(new URL(upstream.mock.calls[0][0]).pathname).toBe(`/api/shop/share-image/product/${publicId}`)
  })

  it('serves cached images to HEAD without contacting the backend', async () => {
    const upstreamFetch = vi.fn()
    vi.stubGlobal('fetch', upstreamFetch)
    vi.stubGlobal('caches', {
      default: {
        match: vi.fn(async () => new Response(pngHeader(), {
          headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400, immutable' }
        })),
        put: vi.fn()
      }
    })
    const response = await handleOgImage(
      new Request('https://ldcstore.com/og/product/42.png?v=abc123', { method: 'HEAD' }),
      { ...env, ASSETS: { fetch: vi.fn() } }
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('x-robots-tag')).toBe(NOINDEX_POLICY)
    expect((await response.arrayBuffer()).byteLength).toBe(0)
    expect(upstreamFetch).not.toHaveBeenCalled()
  })

  it('uses a short-lived static fallback and never caches invalid upstream content', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>error</html>', {
      headers: { 'content-type': 'text/html' }
    })))
    const edgeCache = { match: vi.fn(async () => null), put: vi.fn() }
    vi.stubGlobal('caches', { default: edgeCache })
    const assetFetch = vi.fn(async () => new Response(pngHeader(), { headers: { 'content-type': 'image/png' } }))
    const response = await handleOgImage(
      new Request('https://ldcstore.com/og/coupon/token.png?v=rev1'),
      { ...env, ASSETS: { fetch: assetFetch } },
      { waitUntil: vi.fn() }
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('max-age=300')
    expect(response.headers.get('x-robots-tag')).toBe(NOINDEX_POLICY)
    expect(assetFetch).toHaveBeenCalledOnce()
    expect(edgeCache.put).not.toHaveBeenCalled()
  })

  it('rejects malformed routes before any upstream request', async () => {
    const upstreamFetch = vi.fn()
    vi.stubGlobal('fetch', upstreamFetch)
    const response = await handleOgImage(
      new Request('https://ldcstore.com/og/product/not-a-number.png'),
      { ...env, ASSETS: { fetch: vi.fn() } }
    )
    expect(response.status).toBe(404)
    expect(response.headers.get('x-robots-tag')).toBe(NOINDEX_POLICY)
    expect(upstreamFetch).not.toHaveBeenCalled()
  })

  it('marks unavailable generated images as noindex', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not an image')))
    const response = await handleOgImage(
      new Request('https://ldcstore.com/og/product/42.png'),
      { ...env, ASSETS: { fetch: vi.fn(async () => new Response('invalid fallback')) } }
    )

    expect(response.status).toBe(502)
    expect(response.headers.get('x-robots-tag')).toBe(NOINDEX_POLICY)
  })
})

describe('announcement deep links', () => {
  it.each(['/announcements','/announcements/11'])('serves %s without requesting personalized content at the edge',async path=>{
    const externalFetch=vi.fn();vi.stubGlobal('fetch',externalFetch)
    const response=await worker.fetch(new Request(`https://ldcstore.com${path}?context_synthetic=true`),{...env,ASSETS:{fetch:vi.fn(async()=>htmlAsset())}})
    expect(response.status).toBe(200)
    expect(response.headers.get('x-robots-tag')).toBe(NOINDEX_POLICY)
    expect(await response.text()).toContain('公告中心 - LD士多')
    expect(externalFetch).not.toHaveBeenCalled()
  })
})
