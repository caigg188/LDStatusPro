import { test as base, expect, type Page } from '@playwright/test'
export const user = { id: '11', username: 'browser-buyer', name: '回归买家', site: 'linux.do', trust_level: 2 }
export const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, ...user, exp: 4102444800 })).toString('base64url')}.fixture`
export const product = { id: 7, name: '回归测试物品', description: '仅供隔离浏览器回归使用', price: 10, discount: 1, stock: 20, availableStock: 20,
  productType: 'normal', status: 'approved', categoryId: 1, categoryName: '测试分类', sellerUserId: 22, sellerUsername: 'test-seller', sellerSite: 'linux.do',
  purchaseTrustLevel: 0, canPurchase: true, isFavorited: false, imageUrl: '', purchaseLimit: { mode: 'none', reached: false } }
const pagination = { total: 1, page: 1, pageSize: 20, totalPages: 1, hasMore: false }
export type Scenario = {
  lostResponse: boolean; lookupAvailable: boolean; priceChanged: boolean; failFilter: boolean
  sellingDisabled: boolean
  fulfillmentAccepted: boolean; fulfillmentAckCount: number; fulfillmentOrderBlocked: boolean
  fulfillmentHistory: Record<string, unknown>[]
  quotes: number; submissions: Record<string, unknown>[]; reads: string[]
  order: null | { orderId: number; orderNo: string; paymentUrl: string; status: string }
}
export async function signIn(page: Page) {
  await page.addInitScript(({ user, token }) => {
    localStorage.setItem('ld_store_user', JSON.stringify({ value: user, expire: 0 }))
    localStorage.setItem('ld_store_token', JSON.stringify({ value: token, expire: 0 }))
  }, { user, token })
}
export const test = base.extend<{ scenario: Scenario }>({
  scenario: [async ({ context }, use) => {
    const state: Scenario = {
      lostResponse: false, lookupAvailable: true, priceChanged: false, failFilter: false, sellingDisabled: false,
      fulfillmentAccepted: false, fulfillmentAckCount: 0, fulfillmentOrderBlocked: false,
      fulfillmentHistory: [], quotes: 0, submissions: [], reads: [], order: null
    }
    const unexpected: string[] = []
    const pageErrors: string[] = []
    context.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)))
    await context.routeWebSocket('**/*', socket => socket.close())
    await context.route('**/*', async route => {
      const request = route.request()
      const url = new URL(request.url())
      // Never allow a browser request to reach a real API, OAuth or payment service.
      if (url.origin !== 'http://127.0.0.1:4197') return route.abort('blockedbyclient')
      if (!url.pathname.startsWith('/api/')) return route.continue()
      const path = url.pathname
      const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })
      const fail = (status: number, code: string) => route.fulfill({ status, json: { success: false, code, message: '模拟请求失败' } })
      if (path === '/api/auth/init') {
        const callback = new URL(url.searchParams.get('return_url')!)
        callback.hash = `ldsp_oauth=${Buffer.from(JSON.stringify({ t: token, u: user, j: 1 })).toString('base64')}`
        return ok({ auth_url: callback.toString() })
      }
      if (path === '/api/shop/auth/verify') return ok({ authenticated: true, user })
      if (path === '/api/shop/system-status') return ok({ mode: 'normal', enabled: false })
      if (path === '/api/shop/announcements/states') return ok({ items: [] })
      if (path === '/api/shop/announcements') return ok({ items: [], timestamp: Date.now() })
      if (path === '/api/shop/notifications/stream') return route.fulfill({ status: 204, body: '' })
      if (path === '/api/shop/messages/unread-summary') return ok({ totalUnread: 0 })
      if (path === '/api/shop/categories') return ok({ categories: [{ id: 1, name: '测试分类' }] })
      if (path === '/api/shop/stats') return ok({ products: { total: 1 }, orders: {}, stores: 0 })
      if (path === '/api/shop/hotboard') return ok({ trustLevel: 2, sellerTop: [], viewTop: [], soldTop: [], categoryTrend: [], hourlyTrend: [] })
      if (path === '/api/shop/fulfillment-policy') return ok({ version: 'shipment-72h-test', enabled: true, enabledAt: '2026-09-01T00:00:00Z', deliveryHours: 72, offlineHours: 48, strikeWindowDays: 30, strikeThreshold: 3, restrictionHours: 168, ruleUrl: '/docs/shipping-deadline' })
      if (path === '/api/shop/merchant/enforcement') return ok({ enforcement: { status: state.sellingDisabled ? 'disabled' : 'active', sellingAllowed: !state.sellingDisabled, version: state.sellingDisabled ? 1 : 0, reasonCode: state.sellingDisabled ? 'test_only' : null, reason: state.sellingDisabled ? '隔离浏览器测试中的卖家权限限制' : null, changedByName: null, changedAt: null }, history: [] })
      if (path === '/api/shop/merchant/fulfillment/acknowledge' && request.method() === 'POST') {
        state.fulfillmentAckCount++
        state.fulfillmentAccepted = true
        return ok({ enabled: true, accepted: true, policyVersion: 'shipment-72h-test', validCount: state.fulfillmentHistory.length, threshold: 3, windowDays: 30, restrictionHours: 168, activeRestriction: null, restrictions: [], history: state.fulfillmentHistory, ruleUrl: '/docs/shipping-deadline', supportUrl: '/support' })
      }
      if (path === '/api/shop/merchant/fulfillment') return ok({ enabled: true, accepted: state.fulfillmentAccepted, policyVersion: 'shipment-72h-test', validCount: state.fulfillmentHistory.length, threshold: 3, windowDays: 30, restrictionHours: 168, activeRestriction: null, restrictions: [], history: state.fulfillmentHistory, ruleUrl: '/docs/shipping-deadline', supportUrl: '/support' })
      if (path === '/api/shop/products') {
        state.reads.push(url.search)
        if (state.failFilter && url.searchParams.has('priceMin')) return fail(503, 'TEST_FILTER_FAILED')
        return ok({ products: [product], pagination })
      }
      if (path === '/api/shop/products/7') return ok({ product: { ...product, isFavorited: Boolean(request.headers().authorization) } })
      if (path === '/api/shop/products/7/comments') return ok({ commentEnabled: true, viewerHasPurchased: false, comments: [], pagination: { ...pagination, total: 0 }, summary: {} })
      if (path === '/api/shop/orders/quote') {
        state.quotes++
        const quantity = request.postDataJSON().quantity
        const amount = (state.priceChanged && state.quotes > 1 ? 12 : 10) * quantity
        return ok({ productId: 7, quantity, originalPrice: amount, productSubtotal: amount, payableAmount: amount, coupons: [] })
      }
      if (path === '/api/shop/orders' && request.method() === 'POST') {
        state.submissions.push(request.postDataJSON())
        if (state.fulfillmentOrderBlocked) return fail(409, 'FULFILLMENT_RULE_NOT_ACCEPTED')
        state.order ??= { orderId: 31, orderNo: 'E2E_ORDER_31', paymentUrl: 'https://payment.invalid/test-only', status: 'pending' }
        if (state.lostResponse) return route.abort('failed')
        return ok(state.order)
      }
      if (path.startsWith('/api/shop/order-submissions/')) return ok({ exists: Boolean(state.lookupAvailable && state.order), order: state.lookupAvailable ? state.order : null })
      if (path === '/api/shop/orders/E2E_ORDER_31') return ok({ order: { ...state.order, productId: 7, productName: product.name,
        productType: 'normal', quantity: 1, amount: 10, buyerUserId: '11', buyerSite: 'linux.do', buyerUsername: user.username,
        sellerUserId: '22', sellerSite: 'linux.do', sellerUsername: 'test-seller', createdAt: new Date().toISOString(), payExpiredAt: new Date(Date.now() + 600000).toISOString() }, logs: [] })
      if (path === '/api/shop/orders/E2E_ORDER_31/refund') return ok({ refund: null, refundEnabled: false, canRequestRefund: false })
      if (path === '/api/shop/orders/E2E_ORDER_31/payment-url') return ok({ paymentUrl: state.order?.paymentUrl, status: 'pending' })
      if (path === '/api/shop/buy-requests') return ok({ requests: [], pagination: { ...pagination, total: 0 } })
      if (path === '/api/shops') return ok({ shops: [], pagination: { ...pagination, total: 0 } })
      if (path === '/api/shop/discovery/events') return ok({ accepted: 0 })
      unexpected.push(`${request.method()} ${path}`)
      return fail(501, 'UNMOCKED_TEST_ENDPOINT')
    })
    await use(state)
    expect(unexpected, 'Every API request must have an explicit local mock').toEqual([])
    expect(pageErrors, 'No uncaught application errors').toEqual([])
  }, { auto: true }],
})
export { expect }
