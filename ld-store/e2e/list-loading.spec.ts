import { test, expect, product, signIn } from './fixtures'

// Deterministic UUIDv4 fixtures exercise list loading after the ID cutover.
const resourceId = (value: number) => `a1111111-1111-4111-8111-${String(value).padStart(12, '0')}`
const products = (start: number, count: number) => Array.from({ length: count }, (_, i) => ({ ...product, id: resourceId(start + i), name: `分页物品 ${start + i}` }))
const pagination = (page: number, total = 40, pageSize = 20) => ({ page, total, pageSize, totalPages: Math.ceil(total / pageSize), hasMore: page * pageSize < total })

test.beforeEach(async ({ page }) => {
  await page.route(`**/api/shop/products/${resourceId(46)}`, route => route.fulfill({ json: { success: true, data: { product: { ...product, id: resourceId(46) } } } }))
  await page.route(`**/api/shop/products/${resourceId(46)}/comments*`, route => route.fulfill({ json: { success: true, data: { commentEnabled: true, comments: [], pagination: pagination(1, 0), summary: {} } } }))
  await page.route('**/api/shop/search/suggestions*', route => route.fulfill({ json: { success: true, data: { normalizedQuery: '', suggestions: [], source: 'fallback' } } }))
})

test('shop filtering keeps automatic loading connected to the current list', async ({ page }) => {
  const reads: number[] = []
  await page.route('**/api/shops?*', async route => {
    const params = new URL(route.request().url()).searchParams
    const current = Number(params.get('page'))
    reads.push(current)
    await new Promise(resolve => setTimeout(resolve, 30))
    return route.fulfill({ json: { success: true, data: {
      shops: Array.from({ length: 20 }, (_, i) => ({ id: resourceId((current - 1) * 20 + i + 1), name: `分页小店 ${i + 1}`, ownerUsername: 'fixture', tags: '[]' })),
      pagination: pagination(current),
    } } })
  })
  await page.goto('/?section=stores')
  await expect(page.locator('.shop-card')).toHaveCount(20)
  await page.locator('.stores-tag-btn').first().click()
  await expect.poll(() => reads.length).toBe(2)
  await expect(page.locator('.shop-card')).toHaveCount(20)
  await page.locator('.load-more').scrollIntoViewIfNeeded()
  await expect(page.locator('.shop-card')).toHaveCount(40)
  expect(reads).toEqual([1, 1, 2])
  await expect(page.locator('.loaded-all')).toHaveText('已加载全部')
})

test('shop append failure preserves results and retries the failed page', async ({ page }) => {
  const reads: number[] = []
  let failed = false
  await page.route('**/api/shops?*', route => {
    const current = Number(new URL(route.request().url()).searchParams.get('page'))
    reads.push(current)
    if (current === 2 && !failed) { failed = true; return route.fulfill({ status: 503, json: { success: false, message: '模拟分页失败' } }) }
    return route.fulfill({ json: { success: true, data: {
      shops: Array.from({ length: 20 }, (_, i) => ({ id: resourceId((current - 1) * 20 + i + 1), name: `分页小店 ${i + 1}`, ownerUsername: 'fixture', tags: '[]' })),
      pagination: pagination(current),
    } } })
  })
  await page.goto('/?section=stores')
  await expect(page.locator('.shop-card')).toHaveCount(20)
  await page.locator('.load-more').scrollIntoViewIfNeeded()
  await expect(page.locator('.load-more button')).toHaveText('重试')
  await expect(page.locator('.shop-card')).toHaveCount(20)
  await expect(page.locator('.products-count strong')).toHaveText('40')
  await page.locator('.load-more button').click()
  await expect(page.locator('.shop-card')).toHaveCount(40)
  expect(reads).toEqual([1, 2, 2])
})

test('search retries append failures and preserves loaded results after visiting a detail', async ({ page }) => {
  const reads: number[] = []
  let failed = false
  await page.route('**/api/shop/products?*', route => {
    const current = Number(new URL(route.request().url()).searchParams.get('page'))
    reads.push(current)
    if (current === 2 && !failed) { failed = true; return route.fulfill({ status: 503, json: { success: false, message: '模拟分页失败' } }) }
    return route.fulfill({ json: { success: true, data: { products: products(7 + (current - 1) * 20, 20), pagination: pagination(current) } } })
  })
  await page.goto('/search')
  await page.getByRole('combobox').fill('pagination-fixture')
  await page.getByRole('combobox').press('Enter')
  await expect(page.locator('.product-card')).toHaveCount(20)
  await page.locator('.load-more').scrollIntoViewIfNeeded()
  await expect(page.locator('.load-more button')).toHaveText('重试')
  await page.locator('.load-more button').click()
  await expect(page.locator('.product-card')).toHaveCount(40)
  expect(reads).toEqual([1, 2, 2])
  await page.locator('.product-card').last().click()
  await expect(page).toHaveURL(`/product/${resourceId(46)}`)
  await page.goBack()
  await expect(page.locator('.product-card')).toHaveCount(40)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300)
  expect(reads).toEqual([1, 2, 2])
})

test('category lists load their next page with manual fallback at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.addInitScript(() => { Object.defineProperty(window, 'IntersectionObserver', { value: undefined, configurable: true }) })
  await page.route('**/api/shop/products?*', route => {
    const current = Number(new URL(route.request().url()).searchParams.get('page'))
    return route.fulfill({ json: { success: true, data: { products: products(7 + (current - 1) * 20, current === 1 ? 20 : 1), pagination: pagination(current, 21) } } })
  })
  await page.goto('/category/测试分类')
  await expect(page.locator('.product-card')).toHaveCount(20)
  await page.getByRole('button', { name: '加载更多', exact: true }).click()
  await expect(page.locator('.product-card')).toHaveCount(21)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('merchant lists reach product 25 while preserving the explicit seller identity', async ({ page }) => {
  const queries: URLSearchParams[] = []
  await page.route('**/api/shop/merchants/fixture*', route => {
    const params = new URL(route.request().url()).searchParams
    queries.push(params)
    const current = Number(params.get('page') || 1)
    return route.fulfill({ json: { success: true, data: {
      merchant: { username: 'fixture', userId: '22', site: 'linux.do', trustLevel: 2 },
      stats: { onlineCount: 26, totalListedCount: 26, totalSoldCount: 0 },
      products: products(current === 1 ? 7 : 31, current === 1 ? 24 : 1),
      pagination: { page: current, pageSize: 24, hasMore: current === 1 },
    } } })
  })
  await page.goto('/merchant/fixture?site=linux.do&userId=22')
  await expect(page.locator('.product-card')).toHaveCount(24)
  await page.locator('.load-more').scrollIntoViewIfNeeded()
  await expect(page.locator('.product-card')).toHaveCount(25)
  expect(queries.at(-1)?.get('page')).toBe('2')
  expect(queries.at(-1)?.get('site')).toBe('linux.do')
  expect(queries.at(-1)?.get('userId')).toBe('22')
})

test('favorites keep appended pages when returning from product detail', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/shop/favorites?*', route => {
    const current = Number(new URL(route.request().url()).searchParams.get('page'))
    return route.fulfill({ json: { success: true, data: { products: products(7 + (current - 1) * 20, 20), pagination: pagination(current) } } })
  })
  await page.route('**/api/shop/blocked-products?*', route => route.fulfill({ json: { success: true, data: { products: [], pagination: pagination(1, 0) } } }))
  await page.goto('/user/favorites')
  await expect(page.locator('.collection-card')).toHaveCount(20)
  await page.locator('.load-more button').click()
  await expect(page.locator('.collection-card')).toHaveCount(40)
  await page.locator('.collection-card').last().getByRole('link', { name: '查看详情' }).click()
  await expect(page).toHaveURL(`/product/${resourceId(46)}`)
  await page.goBack()
  await expect(page.locator('.collection-card')).toHaveCount(40)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300)
})

test('my requests exposes later pages beyond the previous 100-item cap', async ({ page }, testInfo) => {
  await signIn(page)
  await page.route('**/api/shop/buy-requests/my?*', route => {
    const current = Number(new URL(route.request().url()).searchParams.get('page'))
    return route.fulfill({ json: { success: true, data: {
      requests: Array.from({ length: current === 6 ? 1 : 20 }, (_, i) => ({ id: resourceId((current - 1) * 20 + i + 1), title: `求购分页 ${(current - 1) * 20 + i + 1}`, status: 'open', budgetPrice: 1, details: '隔离分页场景' })),
      pagination: pagination(current, 101),
    } } })
  })
  await page.goto('/user/buy-requests')
  await expect(page.locator('.request-card')).toHaveCount(20)
  for (let current = 2; current <= 6; current++) {
    await page.getByRole('button', { name: '下一页' }).click()
    await expect(page.locator('.request-title').first()).toHaveText(`求购分页 ${(current - 1) * 20 + 1}`)
  }
  await expect(page.locator('.request-card')).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath('my-requests.png') })
})

test('request marketplace keeps one batch seed across pages and rotates explicitly', async ({ page }) => {
  const reads: URLSearchParams[] = []
  await page.route('**/api/shop/buy-requests?*', route => {
    const params = new URL(route.request().url()).searchParams
    reads.push(params)
    const current = Number(params.get('page'))
    return route.fulfill({ json: { success: true, data: {
      requests: [{ id: resourceId(current), title: `求购批次 ${current}`, status: 'open', budgetPrice: 1, details: '隔离批次' }],
      pagination: pagination(current),
    } } })
  })
  await page.goto('/?section=buy')
  await expect(page.locator('.buy-card')).toHaveCount(1)
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await expect(page.locator('.buy-card-title')).toHaveText('求购批次 2')
  expect(reads[1].get('sortSeed')).toBe(reads[0].get('sortSeed'))
  expect(reads[0].get('sortSeed')).toBeTruthy()
  await page.getByRole('button', { name: '换一批', exact: true }).click()
  await expect(page.locator('.buy-card-title')).toHaveText('求购批次 1')
  expect(reads[2].get('sortSeed')).not.toBe(reads[0].get('sortSeed'))
})

test('returning favorites refreshes changed preferences while keeping loaded depth', async ({ page }) => {
  await signIn(page)
  let items = products(7, 40)
  await page.route('**/api/shop/favorites?*', route => {
    const current = Number(new URL(route.request().url()).searchParams.get('page'))
    return route.fulfill({ json: { success: true, data: { products: items.slice((current - 1) * 20, current * 20), pagination: pagination(current, items.length) } } })
  })
  await page.route('**/api/shop/blocked-products?*', route => route.fulfill({ json: { success: true, data: { products: [], pagination: pagination(1, 0) } } }))
  await page.route(`**/api/shop/products/${resourceId(46)}`, route => route.fulfill({ json: { success: true, data: { product: { ...product, id: resourceId(46), isFavorited: true } } } }))
  await page.route(`**/api/shop/products/${resourceId(46)}/favorite`, route => {
    items = items.filter(item => item.id !== resourceId(46))
    return route.fulfill({ json: { success: true, data: {} } })
  })
  await page.goto('/user/favorites')
  await expect(page.locator('.collection-card')).toHaveCount(20)
  await page.locator('.load-more button').click()
  await expect(page.locator('.collection-card')).toHaveCount(40)
  await page.locator('.collection-card').last().getByRole('link', { name: '查看详情' }).click()
  await page.getByRole('button', { name: '已收藏', exact: true }).click()
  await expect(page.getByRole('button', { name: '收藏', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.locator('.collection-card')).toHaveCount(39)
})
