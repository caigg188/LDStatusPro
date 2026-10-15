import { test, expect } from './fixtures'

for (const width of [320, 390, 768, 1024, 1280, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`terms remain readable at ${width}px in ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.goto('/docs/terms')
      const article = page.locator('#help-article')
      await expect(article.locator('.numbered-list li')).toHaveCount(3)
      // An inline emphasis node must stay in the text column, never the number column.
      const emphasis = article.locator('.numbered-list strong')
      for (const node of await emphasis.all()) {
        const bounds = await node.evaluate(element => {
          const item = element.closest('li')!.getBoundingClientRect()
          const rects = [...element.getClientRects()]
          return { allInTextColumn: rects.every(rect => rect.left >= item.left + 30),
            readableLine: rects.some(rect => rect.width > 35) }
        })
        expect(bounds).toEqual({ allInTextColumn: true, readableLine: true })
      }
      await article.locator('.numbered-list').scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath('violations.png') })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      await expect(article.locator('#applicable-law + ul')).not.toContainText('中华人民共和国')
      await expect(article.locator('h2[id]')).toHaveCount(12)
      const calloutText = article.locator('.highlight-box p').first()
      expect(await calloutText.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
      const inlineEmphasis = article.locator('.highlight-box p strong').first()
      expect(await inlineEmphasis.evaluate(el => getComputedStyle(el).display)).toBe('inline')
      const ids = await article.locator('h2[id], h3[id]').evaluateAll(nodes => nodes.map(node => node.id))
      expect(new Set(ids).size).toBe(ids.length)
      await article.locator('#applicable-law').scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath('law-and-contact.png') })
      if (width === 1440) {
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({ path: testInfo.outputPath('terms-overview.png') })
      }
    })
  }
}
