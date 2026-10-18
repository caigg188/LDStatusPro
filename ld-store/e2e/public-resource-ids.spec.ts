import { test, expect, product, signIn, user } from './fixtures'
const id='aaaaaaaa-1111-4111-8111-111111111111'
const claim='bbbbbbbb-2222-4222-8222-222222222222'
const pagination={total:0,page:1,pageSize:20,totalPages:0,hasMore:false}
test('historical product link becomes UUID and checkout submits UUID product and coupon references',async({page,context,scenario})=>{
  await signIn(page)
  await context.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname
    const ok=(data:unknown)=>route.fulfill({json:{success:true,data}})
    if(path==='/api/shop/products/7'||path===`/api/shop/products/${id}`) return ok({product:{...product,id}})
    if(path===`/api/shop/products/${id}/comments`) return ok({commentEnabled:true,viewerHasPurchased:false,comments:[],pagination,summary:{}})
    if(path==='/api/shop/orders/quote') return ok({productId:id,quantity:1,originalPrice:10,productSubtotal:10,payableAmount:9,coupons:[{claimId:claim,eligible:true,campaign:{id:'A'.repeat(32),name:'UUID coupon',scopeType:'product',discountType:'fixed_amount',fixedAmount:1,minSpend:0},discountAmount:1,payableAmount:9}]})
    if(path==='/api/shop/orders'&&request.method()==='POST') {
      scenario.submissions.push(request.postDataJSON())
      scenario.order={orderId:31,orderNo:'E2E_ORDER_31',paymentUrl:'https://payment.invalid/test-only',status:'pending'}
      return ok({...scenario.order,orderId:'E2E_ORDER_31'})
    }
    return route.fallback()
  })
  await page.goto('/product/7')
  await expect(page).toHaveURL(`/product/${id}`)
  await page.locator('.buy-btn:visible').filter({hasText:'立即兑换'}).last().click()
  await expect(page).toHaveURL(`/checkout/${id}`)
  await page.locator('.confirm-button:visible').last().click()
  await expect(page).toHaveURL(/\/order\/E2E_ORDER_31/)
  expect(scenario.submissions).toHaveLength(1)
  expect(scenario.submissions[0]).toMatchObject({productId:id,couponClaimId:claim})
})
test('historical checkout is canonical before recovery state is constructed',async({page,context})=>{
  await signIn(page)
  await context.route('**/api/shop/products/*',async route=>{
    const path=new URL(route.request().url()).pathname
    if(path==='/api/shop/products/7'||path===`/api/shop/products/${id}`) return route.fulfill({json:{success:true,data:{product:{...product,id}}}})
    return route.fallback()
  })
  await page.goto('/checkout/7')
  await expect(page).toHaveURL(`/checkout/${id}`)
  await expect(page.locator('.confirm-button:visible').last()).toBeEnabled()
})
for (const path of ['/checkout/7', `/checkout/${id}`]) {
  test(`recovers a pre-cutover pending order without a second submission from ${path}`, async ({ page, context, scenario }) => {
    await signIn(page)
    const token = 'ord_pre_cutover_lost_response_1234'
    const key = `ld-store-order-submission:${JSON.stringify([JSON.stringify([user.site, user.id]), 7])}`
    await page.addInitScript(({ key, token }) => sessionStorage.setItem(key, JSON.stringify({ token, productId: 7, couponClaimId: 4, quantity: 2, expectedAmount: 19 })), { key, token })
    scenario.order = { orderId: 31, orderNo: 'E2E_ORDER_31', paymentUrl: 'https://payment.invalid/test-only', status: 'pending' }
    const lookups: string[] = []
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/shop/products/7' || url.pathname === `/api/shop/products/${id}`)
        return route.fulfill({ json: { success: true, data: { product: { ...product, id } } } })
      if (url.pathname.startsWith('/api/shop/order-submissions/')) {
        expect(url.pathname).toBe(`/api/shop/order-submissions/${token}`)
        lookups.push(url.search)
        return route.fulfill({ json: { success: true, data: { exists: true, order: { ...scenario.order, orderId: scenario.order.orderNo },
          ...(url.searchParams.has('legacyProductId') ? { legacyIntent: { productId: id, couponClaimId: claim } } : {}) } } })
      }
      return route.fallback()
    })
    await page.goto(path)
    await expect(page).toHaveURL(/\/order\/E2E_ORDER_31/)
    expect(lookups).toContain('?legacyProductId=7&legacyCouponClaimId=4')
    expect(scenario.submissions).toHaveLength(0)
    expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull()
  })
}
test('blocks a new checkout while an old pending intent cannot be resolved', async ({ page, context, scenario }) => {
  await signIn(page)
  const key = `ld-store-order-submission:${JSON.stringify([JSON.stringify([user.site, user.id]), 7])}`
  await page.addInitScript(key => sessionStorage.setItem(key, JSON.stringify({ token: 'ord_unknown_pre_cutover_12345678', productId: 7, couponClaimId: 4, quantity: 2, expectedAmount: 19 })), key)
  await context.route('**/api/shop/order-submissions/**', route => route.abort('failed'))
  await page.goto(`/checkout/${id}`)
  await expect(page.getByText('旧订单记录尚未确认，请重试查询，或前往我的订单核对。')).toBeVisible()
  await expect(page.getByRole('link', { name: '查看我的订单' })).toHaveAttribute('href', '/user/orders')
  await expect(page.locator('.confirm-button:visible')).toHaveCount(0)
  await page.getByRole('button', { name: '确认并继续本次订单' }).click()
  await expect(page.getByText('旧订单记录尚未确认，请重试查询，或前往我的订单核对。')).toBeVisible()
  expect(scenario.submissions).toHaveLength(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).not.toBeNull()
})
for (const fallback of [false, true]) {
  test(`historical session link selects the same UUID conversation (fallback=${fallback})`, async ({ page, context, scenario }) => {
    await signIn(page)
    const requestId = 'dddddddd-4444-4444-8444-444444444444'
    const firstSessionId = 'eeeeeeee-5555-4555-8555-555555555555'
    const preferredSessionId = 'ffffffff-6666-4666-8666-666666666666'
    const messageId = 'aaaaaaaa-7777-4777-8777-777777777777'
    const request = { id: requestId, title: '历史会话兼容', status: 'open', budgetPrice: 10 }
    const preferred = { id: preferredSessionId, status: 'negotiating', canSendMessage: true }
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname
      const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })
      if (path === '/api/shop/buy-requests/9' || path === `/api/shop/buy-requests/${requestId}`) {
        if (fallback) return route.fulfill({ status: 404, json: { success: false, error: { message: '求购不可见' } } })
        return ok({ request, viewerRole: 'requester', sessions: [{ ...preferred, id: firstSessionId }, preferred] })
      }
      if (path === '/api/shop/buy-sessions/77' || path === `/api/shop/buy-sessions/${preferredSessionId}`) {
        expect(['9', requestId]).toContain(url.searchParams.get('requestId'))
        return ok({ request, session: preferred, viewerRole: 'requester' })
      }
      if (path === `/api/shop/buy-sessions/${preferredSessionId}/messages`) {
        scenario.reads.push(path)
        return ok({ messages: [{ id: messageId, content: '正确的历史会话消息', senderRole: 'system', createdAt: Date.now() }], pagination: { latestMessageId: messageId, oldestMessageId: messageId, hasMoreBefore: false } })
      }
      if (path === `/api/shop/buy-sessions/${preferredSessionId}/read`) return ok({})
      return route.fallback()
    })
    await page.goto('/buy-request/9?session=77')
    await expect(page).toHaveURL(`/buy-request/${requestId}?session=${preferredSessionId}`)
    await expect(page.getByText('正确的历史会话消息')).toBeVisible()
    expect(scenario.reads).toContain(`/api/shop/buy-sessions/${preferredSessionId}/messages`)
  })
}
