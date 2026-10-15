import { test, expect, product, signIn, user } from './fixtures'

const contactUrl = 'https://linux.do/u/jackyliii'

test('terms connect to refund windows and the confirmed review contact', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 780 })
  await page.goto('/docs/terms')
  const article = page.locator('#help-article')
  await expect(article.locator('.help-article-header__meta')).toContainText('2026年10月15日')
  await expect(article.locator('.update-date')).toContainText('2026年10月15日')
  await expect(article).toContainText('不重算历史订单或退款申请的期限')
  await article.getByRole('link', { name: '退款、协商与争议', exact: true }).click()
  await expect(page).toHaveURL(/\/docs\/refunds$/)
  await expect(page.locator('#application-window')).toBeAttached()
  await expect(article).toContainText('已有申请按原状态继续处理')
  const contact = article.getByRole('link', { name: '联系 LD 士多管理员 Jacky', exact: true })
  await expect(contact).toHaveAttribute('href', contactUrl)
  await expect(contact).toHaveAttribute('rel', 'noopener noreferrer')
  expect(await article.locator('h2[id], h3[id]').evaluateAll(headings => {
    const ids = headings.map(heading => heading.id)
    return new Set(ids).size === ids.length
  })).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('refund-guide.png'), fullPage: true })

  for (const section of ['terms', 'shipping-deadline', 'quick-start']) {
    await page.goto(`/docs/${section}`)
    await expect(article.locator(`a[href="${contactUrl}"]`)).toBeVisible()
    await expect(article.locator('a[href="/support"]')).toHaveCount(0)
  }
  // Other articles keep their own existing update date.
  await page.goto('/docs/concepts')
  await expect(article.locator('.help-article-header__meta')).toContainText('2026年9月6日')
})

for (const status of ['expired', 'rejected'] as const) {
  test(`${status} refund entry keeps review guidance reachable without submitting a refund`, async ({ page }, testInfo) => {
    if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 780 })
    await signIn(page)
    const paidAt = new Date(Date.now() - 8 * 86400000).toISOString()
    const methods: string[] = []
    await page.route(/\/api\/shop\/orders\/E2E_ORDER_31(?:\?|$)/, route => route.fulfill({ json: { success: true, data: {
      order: { id: 31, orderNo: 'E2E_ORDER_31', status: 'completed', productId: 7, productName: product.name,
        productType: 'normal', quantity: 1, amount: 10, buyerUserId: '11', buyerSite: 'linux.do', buyerUsername: user.username,
        sellerUserId: '22', sellerSite: 'linux.do', sellerUsername: 'test-seller', createdAt: paidAt, paidAt }, logs: []
    } } }))
    await page.route('**/api/shop/orders/E2E_ORDER_31/refund', route => {
      methods.push(route.request().method())
      return route.fulfill({ json: { success: true, data: {
        role: 'buyer', eligibility: { canApply: false, code: status === 'expired' ? 'REFUND_TIME_EXPIRED' : 'REFUND_ALREADY_EXISTS',
          message: status === 'expired' ? '已超过 7 天在线申请期限' : '已有退款申请' },
        refund: status === 'expired' ? null : { id: 51, orderNo: 'E2E_ORDER_31', status: 'rejected', refundAmount: 10,
          reasonCode: 'not_as_described', reasonDetail: '隔离测试：商品交付与描述不一致', sellerResponse: '隔离测试：卖家拒绝', events: [] },
        disputeGuideUrl: 'https://credit.linux.do/docs/how-to-use'
      } } })
    })
    await page.goto('/order/E2E_ORDER_31')
    const panel = page.locator('#order-refund')
    await expect(panel).toBeVisible()
    if (status === 'expired') await expect(panel.getByRole('button', { name: '申请退款', exact: true })).toBeDisabled()
    const link = panel.getByRole('link', { name: status === 'expired' ? '了解 7 天申请窗口与后续售后' : '查看内部复核与争议路径' })
    await link.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`refund-${status}.png`) })
    await link.click()
    await expect(page).toHaveURL(status === 'expired' ? /\/docs\/refunds#application-window$/ : /\/docs\/refunds#credit-dispute$/)
    await expect(page.locator(status === 'expired' ? '#application-window' : '#credit-dispute')).toBeVisible()
    await expect(page.locator('#help-article').getByRole('link', { name: '联系 LD 士多管理员 Jacky', exact: true })).toHaveAttribute('href', contactUrl)
    expect(methods.length).toBeGreaterThan(0)
    expect(methods.every(method => method === 'GET')).toBe(true)
  })
}
