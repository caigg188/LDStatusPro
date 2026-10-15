import { test, expect, product } from './fixtures'

test('original service labels and stock remain readable in the catalog and detail', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 780 })
  const shared = { ...product, productType: 'cdk', sharedCdkEnabled: true, stock: -1, availableStock: -1,
    isPinned: true, pinIsPaid: true, pinType: 'global' }
  const items = [shared,
    { ...product, id: 8, isPinned: true, pinIsPaid: true, pinType: 'category' },
    { ...product, id: 9, isPinned: true, pinIsPaid: false },
    { ...product, id: 10 }]
  await page.route('**/api/shop/products?*', route => route.fulfill({ json: { success: true, data: {
    products: items, pagination: { total: 4, page: 1, pageSize: 20, totalPages: 1, hasMore: false }
  } } }))
  await page.route('**/api/shop/products/7', route => route.fulfill({ json: { success: true, data: { product: shared } } }))
  await page.goto('/')
  await expect(page.locator('.product-card')).toHaveCount(4)
  await expect(page.locator('.selection-badge')).toHaveCount(2)
  await expect(page.locator('.selection-badge').first()).toHaveText('士多甄选')
  await expect(page.locator('.selection-badge').last()).toHaveText('士多优选')
  for (const card of await page.locator('.product-card').all()) {
    const geometry = await card.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      const badge = element.querySelector('.selection-badge')?.getBoundingClientRect()
      const type = element.querySelector('.type-tag')?.getBoundingClientRect()
      return { fits: element.scrollWidth <= element.clientWidth + 1,
        noOverlap: !badge || !type || badge.left >= type.right,
        badgeInside: !badge || (badge.left >= bounds.left && badge.right <= bounds.right) }
    })
    expect(geometry).toEqual({ fits: true, noOverlap: true, badgeInside: true })
  }
  await expect(page.locator('.product-card').first().locator('.product-stock')).toHaveText('9999')
  await page.screenshot({ path: testInfo.outputPath('catalog-disclosures.png'), fullPage: true })
  await page.locator('.product-card').first().click()
  await expect(page).toHaveURL(/\/product\/7$/)
  await expect(page.locator('.stock-indicator')).toHaveText('库存 9999')
  await page.locator('.stock-indicator').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await expect(page.locator('.stock-indicator')).toBeVisible()
  await expect.poll(() => page.locator('.stock-indicator').evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return bounds.top >= 64 && bounds.bottom < innerHeight - 120
  })).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('detail-disclosure.png') })
})

test('help navigation labels match destinations on desktop and mobile', async ({ page }, testInfo) => {
  await page.goto('/docs/payment-settings')
  await expect(page.locator('#help-article')).toContainText('Client ID（PID）和 Client Key')
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: '目录', exact: true }).click()
  const support = page.locator('.help-sidebar__footer:visible').getByRole('link', { name: '支持开发' })
  await expect(support).toHaveAttribute('href', '/support')
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: '关闭目录', exact: true }).last().click()
  else await expect(page.getByRole('link', { name: '查看常见问题与排查' })).toHaveAttribute('href', '/docs/faq')
  await page.goto('/docs/account-safety')
  await expect(page.locator('#help-article')).toContainText('商品详情的举报入口')
  await page.locator('.help-actions').getByRole('link', { name: '常见问题与排查' }).click()
  await expect(page).toHaveURL(/\/docs\/faq$/)
  await expect(page.locator('.help-actions').getByRole('link', { name: '账号与交易安全' })).toHaveAttribute('href', '/docs/account-safety')
  await page.screenshot({ path: testInfo.outputPath('help-links.png'), fullPage: true })
})
