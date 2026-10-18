import { test, expect, product, signIn } from './fixtures'
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
