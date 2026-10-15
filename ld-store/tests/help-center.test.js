import { describe, expect, it } from 'vitest'
import {
  HELP_ARTICLES,
  HELP_GROUPS,
  HELP_LEGACY_ALIASES,
  getHelpArticle,
  resolveLegacyHelpLocation,
  searchHelpCenter
} from '../src/config/helpCenter'

describe('帮助中心注册表', () => {
  it('文章 ID 唯一且字段完整', () => {
    const ids = HELP_ARTICLES.map(article => article.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const article of HELP_ARTICLES) {
      expect(HELP_GROUPS.some(group => group.id === article.group)).toBe(true)
      expect(article.title).toBeTruthy()
      expect(article.summary).toBeTruthy()
      expect(article.audience.length).toBeGreaterThan(0)
      expect(article.keywords.length).toBeGreaterThan(0)
      expect(article.icon).toBeTruthy()
      expect(article.loader).toBeTypeOf('function')
      expect(Array.isArray(article.related)).toBe(true)
    }
  })

  it('所有文章组件可加载，相关文章均有效', async () => {
    await Promise.all(HELP_ARTICLES.map(async article => {
      const module = await article.loader()
      expect(module.default).toBeTruthy()
      for (const relatedId of article.related) {
        expect(getHelpArticle(relatedId), `${article.id} -> ${relatedId}`).toBeTruthy()
        expect(relatedId).not.toBe(article.id)
      }
    }))
  })
})

describe('旧帮助地址', () => {
  it.each([
    ['quick-start', 'Docs', undefined, ''],
    ['publish-link', 'DocsSection', 'publish-product', '#normal-product'],
    ['publish-cdk', 'DocsSection', 'publish-product', '#auto-delivery'],
    ['shop-register', 'DocsSection', 'seller-growth', '#shop-management']
  ])('%s 跳到新的文章锚点', (legacy, routeName, section, hash) => {
    const resolved = resolveLegacyHelpLocation(legacy, { q: 'test' })
    expect(resolved.name).toBe(routeName)
    expect(resolved.params?.section).toBe(section)
    expect(resolved.hash).toBe(hash)
    expect(resolved.query).toEqual({ q: 'test' })
    expect(resolved.replace).toBe(true)
    expect(HELP_LEGACY_ALIASES[legacy]).toBeTruthy()
  })
})

describe('帮助搜索', () => {
  it.each([
    ['共享库存', ['product-types', 'inventory-management']],
    ['独立卡密', ['product-types', 'inventory-management']],
    ['优惠券占用', ['buyer-coupons']],
    ['卖家后台', ['seller-center']],
    ['待发货', ['seller-orders']],
    ['退款争议', ['refunds']],
    ['拒绝退款', ['refunds']],
    ['通知地址', ['payment-settings']],
    ['求购订单', ['buy-request']],
    ['不感兴趣', ['collections-blocks']]
  ])('“%s”的正确答案位于前三项', (query, expectedArticleIds) => {
    const topThreeIds = searchHelpCenter(query, 3).map(result => result.articleId)
    expect(expectedArticleIds.some(id => topThreeIds.includes(id))).toBe(true)
  })

  it('支持同义词并优先返回稳定锚点', () => {
    const [shared] = searchHelpCenter('库存9999')
    const [callback] = searchHelpCenter('return url')
    const [reserved] = searchHelpCenter('reserved')
    const [dispute] = searchHelpCenter('credit争议')

    expect(shared.path).toBe('/docs/product-types#shared-cdk')
    expect(callback.path).toBe('/docs/payment-settings#callback-urls')
    expect(reserved.path).toBe('/docs/buyer-coupons#coupon-reservation')
    expect(dispute.path).toBe('/docs/refunds#credit-dispute')
  })

  it.each([
    ['七天后', '/docs/refunds#application-window'],
    ['管理员复核', '/docs/refunds#credit-dispute']
  ])('售后边界查询“%s”直达对应说明且不重复', (query, path) => {
    const results = searchHelpCenter(query)
    expect(results[0]?.path).toBe(path)
    expect(results.filter(result => result.path === path)).toHaveLength(1)
  })

  it('退款争议查询优先返回专项指南', () => {
    expect(searchHelpCenter('退款争议')[0]?.articleId).toBe('refunds')
  })
})
