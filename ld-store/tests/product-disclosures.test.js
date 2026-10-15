// @vitest-environment jsdom
import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProductCard from '../src/components/product/ProductCard.vue'
import ProductStockIndicator from '../src/components/product/ProductStockIndicator.vue'

vi.mock('@/stores/product', () => ({ useProductStore: () => ({ isProductBlocked: () => false }) }))
vi.mock('@/services/shop/discoveryService', () => ({ recordProductClick: vi.fn(), recordProductImpression: vi.fn() }))

function mountCard(overrides = {}) {
  return mount(ProductCard, {
    props: { product: { id: 1, name: '隔离测试物品', productType: 'cdk', stock: -1, ...overrides } },
    global: { components: { RouterLink: RouterLinkStub }, stubs: { AvatarImage: true } }
  })
}

describe('物品标签与库存展示', () => {
  it.each([['global', '士多甄选'], ['category', '士多优选']])('付费 %s 只显示原服务名', (pinType, name) => {
    const wrapper = mountCard({ isPinned: true, pinIsPaid: true, pinType })
    expect(wrapper.get('.selection-badge').text()).toBe(name)
    expect(wrapper.getComponent(RouterLinkStub).props('to')).toBe('/product/1')
    wrapper.unmount()
  })

  it.each([
    { isPinned: true, pinIsPaid: false },
    { isPinned: false, pinIsPaid: true },
    {}
  ])('免费置顶及自然展示不出现付费服务标签：%j', product => {
    const wrapper = mountCard(product)
    expect(wrapper.find('.selection-badge').exists()).toBe(false)
    wrapper.unmount()
  })

  it('共享卡密保留 9999 展示，切回独立时显示实际库存', async () => {
    const product = { id: 1, name: '共享内容', productType: 'cdk', stock: -1, sharedCdkEnabled: true }
    const card = mountCard(product)
    const indicator = mount(ProductStockIndicator, { props: { product } })
    expect(card.get('.product-stock').text()).toBe('9999')
    expect(indicator.text()).toBe('库存 9999')

    const independent = { ...product, sharedCdkEnabled: false, availableStock: 2, cdkStats: { available: 2, total: 5 } }
    await card.setProps({ product: independent })
    await indicator.setProps({ product: independent })
    expect(card.get('.product-stock').text()).toBe('2/5')
    expect(indicator.text()).toBe('库存仅剩 2/5')
    card.unmount()
    indicator.unmount()
  })
})
