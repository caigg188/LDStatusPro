import { test, expect, product } from './fixtures'

for (const categoryName of ['测试分类', 'DeveloperToolsAndDigitalServices', 'W'.repeat(50)]) {
  test(`product navigation keeps category and delivery labels readable: ${categoryName}`, async ({ page }, testInfo) => {
    await page.route('**/api/shop/products/7', route => route.fulfill({ json: {
      success: true, data: { product: { ...product, categoryName, productType: 'cdk' } }
    } }))
    await page.goto('/product/7')
    await expect(page.locator('.nav-type.cdk')).toHaveText('CDK自动发货')

    for (const width of [320, 390, 639, 640, 767, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 })
      await expect.poll(() => page.locator('.detail-nav').evaluate(el => {
        const nav = el.getBoundingClientRect()
        const tags = [...el.querySelectorAll('.nav-category, .nav-type')].map(item => item.getBoundingClientRect())
        return {
          pageFits: document.documentElement.scrollWidth <= innerWidth + 1,
          labelsFit: tags.every(tag => tag.left >= nav.left - 1 && tag.right <= nav.right + 1),
          labelsDoNotOverlap: tags[0].right <= tags[1].left + 1 || tags[0].bottom <= tags[1].top + 1
        }
      }), `navigation at ${width}px`).toEqual({ pageFits: true, labelsFit: true, labelsDoNotOverlap: true })

      if (width < 640) {
        for (const name of ['返回', '收藏', '将这件商品标记为不感兴趣', '举报']) {
          const button = page.locator('.detail-nav').getByRole('button', { name, exact: true })
          await expect(button).toBeVisible()
          const size = await button.boundingBox()
          expect(Math.round(size!.width)).toBeGreaterThanOrEqual(44)
          expect(Math.round(size!.height)).toBeGreaterThanOrEqual(44)
        }
      }

      if (width === 320) {
        await expect.poll(() => page.locator('.detail-page').evaluate(el => getComputedStyle(el).opacity)).toBe('1')
        await page.screenshot({ path: testInfo.outputPath('navigation-320.png') })
      }
    }
  })
}
