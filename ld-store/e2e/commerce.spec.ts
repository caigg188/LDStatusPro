import { test, expect, signIn } from './fixtures'

const confirm = (page: import('@playwright/test').Page) => page.locator('.confirm-button:visible').last()

test('logged-in users visiting /login are sent home', async ({ page }) => {
  await signIn(page)
  await page.goto('/login')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: '使用 Linux.do 账号登录' })).toHaveCount(0)
})

test('logged-in users visiting /login honor a safe redirect', async ({ page }) => {
  await signIn(page)
  await page.goto('/login?redirect=/product/7')
  await expect(page).toHaveURL(/\/product\/7$/)
  await expect(page.getByRole('button', { name: '使用 Linux.do 账号登录' })).toHaveCount(0)
})

test('login guard, OAuth callback and logout use the real route flow', async ({ page }) => {
  await page.goto('/checkout/7')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await page.locator('.checkbox-custom').click()
  await expect(page.getByRole('checkbox')).toBeChecked()
  await page.getByRole('button', { name: '使用 Linux.do 账号登录' }).click()
  await expect(page).toHaveURL(/\/checkout\/7$/)
  await expect(confirm(page)).toBeEnabled()
  await page.getByRole('button', { name: '返回物品详情' }).click()
  await expect(page.getByRole('button', { name: '已收藏', exact: true })).toBeVisible()
  await page.locator('[aria-controls="header-user-menu"]').click()
  await page.getByRole('button', { name: '退出登录' }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.locator('a[href="/product/7"]').first().click()
  await expect(page.getByRole('button', { name: '收藏', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '已收藏', exact: true })).toHaveCount(0)
  await page.goto('/checkout/7')
  await expect(page).toHaveURL(/\/login/)
})

test('lost response recovers the original order and never submits twice', async ({ page, scenario }) => {
  await signIn(page)
  scenario.lostResponse = true
  await page.goto('/product/7')
  await page.locator('.buy-btn:visible').filter({ hasText: '立即兑换' }).last().click()
  await expect(page).toHaveURL(/\/checkout\/7$/)
  await confirm(page).click()
  await expect(page).toHaveURL(/\/order\/E2E_ORDER_31/)
  expect(scenario.submissions).toHaveLength(1)
  expect(scenario.submissions[0].submissionToken).toMatch(/^ord_/)
  await expect(page.getByText('E2E_ORDER_31', { exact: true }).first()).toBeVisible()
})

test('reload retains an uncertain order and resumes without creating a new intent', async ({ page, scenario }, testInfo) => {
  await signIn(page)
  scenario.lostResponse = true
  scenario.lookupAvailable = false
  await page.goto('/checkout/7')
  await confirm(page).click()
  await expect(page.getByRole('button', { name: '确认并继续本次订单' })).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('uncertain-order.png'), fullPage: true })
  await page.reload()
  await expect(page.getByRole('button', { name: '确认并继续本次订单' })).toBeEnabled()
  scenario.lookupAvailable = true
  await page.getByRole('button', { name: '确认并继续本次订单' }).click()
  await expect(page).toHaveURL(/\/order\/E2E_ORDER_31/)
  expect(scenario.submissions).toHaveLength(1)
})

test('price changes require renewed confirmation before creation', async ({ page, scenario }) => {
  await signIn(page)
  scenario.priceChanged = true
  await page.goto('/checkout/7')
  await confirm(page).click()
  await expect(page.getByRole('alert').filter({ hasText: '物品价格或优惠券刚刚发生变化' })).toBeVisible()
  expect(scenario.submissions).toHaveLength(0)
  await expect(confirm(page)).toBeEnabled()
  await confirm(page).click()
  await expect(page).toHaveURL(/\/order\/E2E_ORDER_31/)
  expect(scenario.submissions[0].expectedAmount).toBe(12)
})

test('blocked payment popup still leads to an actionable order detail', async ({ page, scenario }) => {
  await signIn(page)
  await page.addInitScript(() => { window.open = () => null })
  await page.goto('/checkout/7')
  await confirm(page).click()
  await expect(page).toHaveURL(/\/order\/E2E_ORDER_31/)
  await expect(page.getByRole('button', { name: /立即支付/ }).first()).toBeVisible()
  expect(scenario.submissions).toHaveLength(1)
})

test('catalog filters recover from errors and survive a detail round trip', async ({ page, scenario }, testInfo) => {
  await page.goto('/')
  const mobile = testInfo.project.name === 'mobile'
  if (mobile) {
    await page.getByRole('button', { name: '筛选物品', exact: true }).click()
    await page.getByLabel('最低价', { exact: true }).fill('5')
    scenario.failFilter = true
    await page.getByRole('button', { name: '应用筛选' }).click()
    await expect(page.getByRole('dialog', { name: '筛选物品' })).toBeVisible()
    scenario.failFilter = false
    await page.getByRole('button', { name: '应用筛选' }).click()
    await expect(page.getByRole('dialog', { name: '筛选物品' })).not.toBeVisible()
  } else {
    await page.locator('#home-price-min').fill('5')
    await page.getByRole('button', { name: '筛选', exact: true }).click()
  }
  await expect.poll(() => scenario.reads.some(query => query.includes('priceMin=5'))).toBe(true)
  await page.locator('a[href="/product/7"]').first().click()
  await expect(page).toHaveURL(/\/product\/7/)
  await page.goBack()
  await expect(page.locator('a[href="/product/7"]').first()).toBeVisible()
  if (mobile) await expect(page.getByRole('button', { name: /筛选，已启用/ })).toBeVisible()
  else await expect(page.locator('#home-price-min')).toHaveValue('5')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
})

test('seller fulfillment entry stays visible and confirmation synchronizes the whole seller shell', async ({ page, scenario }, testInfo) => {
  await signIn(page)
  scenario.fulfillmentHistory = [{
    id: 9, orderNo: 'E2E-FULFILLMENT-9', occurredAt: '2026-09-07T01:30:00Z',
    penaltyId: null, exemptReason: null, revokedAt: null, revokeReason: null
  }]
  await page.setViewportSize(testInfo.project.name === 'mobile'
    ? { width: 375, height: 812 }
    : { width: 1280, height: 900 })
  await page.goto('/seller/fulfillment')

  await expect(page.getByRole('heading', { name: '完成规则确认，让普通物品恢复成交' })).toBeVisible()
  await expect(page.locator('.fulfillment-hero')).toContainText('买家也无法创建订单')
  // The shell banner is for other seller routes. This page is the confirmation surface.
  await expect(page.locator('.seller-fulfillment-gate')).toHaveCount(0)
  await expect(page.locator('a[href="/seller/fulfillment"]').filter({ hasText: '发货与履约' })).toContainText('待确认')
  await expect(page.getByText('E2E-FULFILLMENT-9', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('seller-fulfillment-unconfirmed-light.png'), fullPage: true })

  const acknowledgement = page.getByRole('checkbox')
  await acknowledgement.focus()
  await page.keyboard.press('Space')
  await expect(acknowledgement).toBeChecked()
  await page.getByRole('button', { name: '我已阅读并确认' }).click()
  await expect(page.getByText('当前版本已经确认')).toBeVisible()
  await expect(page.locator('.seller-fulfillment-gate')).toHaveCount(0)
  await expect(page.locator('.seller-nav-badge', { hasText: '待确认' })).toHaveCount(0)
  expect(scenario.fulfillmentAckCount).toBe(1)
  await page.reload()
  await expect(page.getByText('当前版本已经确认')).toBeVisible()
  await expect(page.locator('.seller-fulfillment-gate')).toHaveCount(0)

  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 812, height: 375 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('seller-fulfillment-dark-landscape.png'), fullPage: true })
})

test('seller disablement warning takes priority over the fulfillment confirmation banner', async ({ page, scenario }) => {
  await signIn(page)
  scenario.sellingDisabled = true
  await page.goto('/seller/fulfillment')
  await expect(page.locator('.seller-enforcement')).toContainText('卖家功能已被平台禁用')
  await expect(page.locator('.seller-fulfillment-gate')).toHaveCount(0)
  await expect(page.locator('.seller-nav-badge', { hasText: '待确认' })).toHaveCount(1)
})

test('checkout translates the seller acknowledgement gate into buyer-facing copy', async ({ page, scenario }) => {
  await signIn(page)
  scenario.fulfillmentOrderBlocked = true
  await page.goto('/checkout/7')
  await confirm(page).click()
  await expect(page.getByRole('alert')).toContainText('卖家尚未确认最新发货规则')
  await expect(page.getByRole('alert')).not.toContainText('发布页')
})
