import { test, expect, signIn, token } from './fixtures'

const accountButton = (page: import('@playwright/test').Page) => page.locator('[aria-controls="header-user-menu"]')
const prices = { currentPrice: 1, uploadCount: 0, currentMaxSizeMB: 5, isFree: true, tiers: [] }

test('image history and pricing load from the signed-in entry without replacing the store session', async ({ page }) => {
  await signIn(page)
  const requests: string[] = []
  await page.route('**/api/image/**', async route => {
    const path = new URL(route.request().url()).pathname
    requests.push(path)
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`)
    await route.fulfill({ json: { success: true, data: path.endsWith('/history') ? { images: [] } : prices } })
  })
  await page.goto('/ld-image')
  await expect(page.getByRole('heading', { name: '士多图床', exact: true })).toBeVisible()
  await expect.poll(() => requests.length).toBe(2)
  await expect(accountButton(page)).toHaveAttribute('aria-label', /回归买家/)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ld_store_token')!).value)).toBe(token)
})

for (const status of [401, 503]) {
  test(`an image ${status} leaves both storefront tabs signed in and browsing remains usable`, async ({ page, context }) => {
    await signIn(page)
    await page.goto('/product/7')
    const sibling = await context.newPage()
    await sibling.goto('/product/7')
    let failed = 0
    await page.route('**/api/image/**', async route => {
      failed++
      await route.fulfill({ status, json: { success: false, error: { code: status === 401 ? 'AUTH_INVALID' : 'IMAGE_AUTH_UNAVAILABLE' } } })
    })
    await page.goto('/ld-image')
    await expect.poll(() => failed).toBe(2)
    await expect(accountButton(page)).toHaveAttribute('aria-label', /回归买家/)
    await expect(accountButton(sibling)).toHaveAttribute('aria-label', /回归买家/)
    await expect(page).toHaveURL(/\/ld-image$/)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ld_store_token')!).value)).toBe(token)
    await page.goto('/product/7')
    await expect(page.getByRole('heading', { name: '回归测试物品', exact: true })).toBeVisible()
    await expect(accountButton(page)).toHaveAttribute('aria-label', /回归买家/)
  })
}
