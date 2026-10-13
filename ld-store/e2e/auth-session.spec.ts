import { test, expect, signIn, user } from './fixtures'
import { authToken } from '../tests/helpers/auth'
const otherUser = { ...user, id: '33', username: 'other-buyer', name: '另一买家' }
const otherToken = authToken(otherUser.id, otherUser)
const callbackData = (token = authToken(user.id, user), profile = user) => Buffer.from(JSON.stringify({ t: token, u: profile, j: 1 })).toString('base64')
const accountButton = (page: import('@playwright/test').Page) => page.locator('[aria-controls="header-user-menu"]')

test('cross-tab account switch replaces the visible identity, and logout redirects a private page', async ({ page, context }) => {
  await signIn(page)
  await page.goto('/checkout/7')
  await expect(accountButton(page)).toHaveAttribute('aria-label', /回归买家/)
  const tab = await context.newPage()
  await tab.goto('/product/7')
  await tab.evaluate(({ token, user }) => {
    localStorage.setItem('ld_store_token', JSON.stringify({ value: token, expire: 0 }))
    localStorage.setItem('ld_store_user', JSON.stringify({ value: user, expire: 0 }))
  }, { token: otherToken, user: otherUser })
  await expect(accountButton(page)).toHaveAttribute('aria-label', /另一买家/)
  await tab.locator('[aria-controls="header-user-menu"]').click()
  await tab.getByRole('button', { name: '退出登录' }).click()
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(accountButton(page)).toHaveCount(0)
})

test('a late 401 from the previous account cannot log out the new account', async ({ page, context }) => {
  await signIn(page)
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  let held = false
  await page.route('**/api/shop/products/7', async route => {
    if (!held) {
      held = true
      await pending
      await route.fulfill({ status: 401, json: { success: false, code: 'AUTH_INVALID' } }).catch(() => {})
    } else await route.fallback()
  })
  await page.goto('/product/7')
  await expect.poll(() => held).toBe(true)
  const tab = await context.newPage()
  await tab.goto('/product/7')
  await tab.evaluate(token => localStorage.setItem('ld_store_token', JSON.stringify({ value: token, expire: 0 })), otherToken)
  await expect(accountButton(page)).toHaveAttribute('aria-label', /另一买家/)
  release()
  // Wait for both the old rejection and the fresh product request to finish.
  await expect(page.getByRole('heading', { name: '回归测试物品', exact: true })).toBeVisible()
  await expect(accountButton(page)).toHaveAttribute('aria-label', /另一买家/)
  await expect(page).toHaveURL(/\/product\/7$/)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ld_store_token')!).value)).toBe(otherToken)
})

test('OAuth rejection leaves the callback logged out and removes credentials from its URL', async ({ page }) => {
  await page.route('**/api/shop/auth/verify', route => route.fulfill({ status: 401, json: { success: false, code: 'AUTH_INVALID' } }))
  await page.goto(`/auth/callback?ldsp_oauth=${encodeURIComponent(callbackData())}&redirect=/checkout/7`)
  await expect(page.getByText('登录授权校验失败，请重新登录')).toBeVisible()
  expect(page.url()).not.toContain('ldsp_oauth')
  expect(await page.evaluate(() => localStorage.getItem('ld_store_token'))).toBeNull()
  await expect(page.getByText('登录成功', { exact: true })).toHaveCount(0)
})

test('transient OAuth validation failures can be retried without a premature session', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/shop/auth/verify', async route => {
    if (++attempts === 1) return route.abort('failed')
    return route.fulfill({ json: { success: true, data: { authenticated: true, user } } })
  })
  await page.goto(`/auth/callback#ldsp_oauth=${callbackData()}`)
  await expect(page.getByRole('button', { name: '重试校验' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('ld_store_token'))).toBeNull()
  await page.getByRole('button', { name: '重试校验' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(accountButton(page)).toHaveAttribute('aria-label', /回归买家/)
  expect(attempts).toBe(2)
})

test('a pending OAuth callback cannot overwrite a newer login from another tab', async ({ page, context }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/shop/auth/verify', async route => {
    await pending
    return route.fulfill({ json: { success: true, data: { authenticated: true, user } } })
  })
  await page.goto(`/auth/callback#ldsp_oauth=${callbackData()}`)
  const tab = await context.newPage()
  await tab.goto('/product/7')
  await tab.evaluate(token => localStorage.setItem('ld_store_token', JSON.stringify({ value: token, expire: 0 })), otherToken)
  await expect(accountButton(page)).toHaveAttribute('aria-label', /另一买家/)
  release()
  await expect(page.getByText('登录状态已在其他页面变更，请重新进入')).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ld_store_token')!).value)).toBe(otherToken)
})

test('an idle session expires without a network request or a reload', async ({ page }) => {
  await page.clock.install()
  await page.addInitScript(token => localStorage.setItem('ld_store_token', JSON.stringify({ value: token, expire: 0 })), authToken(user.id, { ...user, exp: Math.floor(Date.now() / 1000) + 90 }))
  await page.goto('/checkout/7')
  await expect(accountButton(page)).toHaveAttribute('aria-label', /回归买家/)
  await page.clock.fastForward(61000)
  await expect(page).toHaveURL(/\/login\?redirect=.*reason=expired/)
  await expect(accountButton(page)).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('ld_store_token'))).toBeNull()
})
