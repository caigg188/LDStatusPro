// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import StoresMarketplace from '../src/components/home/StoresMarketplace.vue'
import { useOrderListController } from '../src/composables/orders/useOrderListController'
import { useCatalogStore } from '../src/stores/catalog'

const mocks = vi.hoisted(() => ({ shops: vi.fn(), products: vi.fn(), error: vi.fn() }))
vi.mock('@/services/homeMarketplaceService', () => ({ fetchMarketplaceShops: mocks.shops }))
vi.mock('@/services/shop/catalogService', () => ({ fetchProductsRequest: mocks.products }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ error: mocks.error }) }))

function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function shopsPage(id = 1) { return { success: true, data: { shops: [{ id, name: `shop-${id}` }], pagination: { total: 60, pageSize: 20, totalPages: 3 } } } }
function productsPage(id, page = 1, hasMore = true) { return { success: true, status: 200, data: { products: [{ id, name: `product-${id}` }], pagination: { total: 100, page, pageSize: 20, totalPages: 5, hasMore } } } }
const stubs = { ShopCard: { props: ['shop'], template: '<div class="shop-stub">{{ shop.name }}</div>' }, Skeleton: true, EmptyState: true, RouterLink: true }
let wrappers = []
let observers = []
class MockObserver {
  callback; target; disconnected = false
  constructor(callback) { this.callback = callback; observers.push(this) }
  observe(target) { this.target = target }
  disconnect() { this.disconnected = true }
  fire() { return this.callback([{ isIntersecting: true, target: this.target }]) }
}
beforeEach(() => {
  vi.resetAllMocks(); observers = []; setActivePinia(createPinia())
  vi.stubGlobal('IntersectionObserver', MockObserver)
})
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers = []; vi.unstubAllGlobals() })
function mountShops() { const wrapper = mount(StoresMarketplace, { global: { stubs } }); wrappers.push(wrapper); return wrapper }

describe('list loading regression scenarios', () => {
  it('rebinds the observer to the new sentinel after filtering', async () => {
    mocks.shops.mockResolvedValue(shopsPage())
    const wrapper = mountShops(); await flushPromises()
    expect(observers).toHaveLength(1)
    const firstSentinel = observers[0].target
    const pending = deferred(); mocks.shops.mockReturnValueOnce(pending.promise)
    await wrapper.get('.stores-tag-btn').trigger('click')
    expect(wrapper.find('.load-more').exists()).toBe(false)
    pending.resolve(shopsPage(2)); await flushPromises()
    expect(wrapper.get('.load-more').element).not.toBe(firstSentinel)
    expect(observers.at(-1).target).toBe(wrapper.get('.load-more').element)
    expect(observers[0].disconnected).toBe(true)
  })

  it('preserves shop totals after an append failure and retries the same page', async () => {
    mocks.shops.mockResolvedValueOnce(shopsPage()).mockResolvedValueOnce({ success: false, status: 503, error: 'fixture unavailable' }).mockResolvedValueOnce(shopsPage(2))
    const wrapper = mountShops(); await flushPromises()
    await observers[0].fire(); await flushPromises()
    expect(mocks.shops.mock.calls.map(([arg]) => arg.page)).toEqual([1, 2])
    expect(wrapper.text()).toContain('fixture unavailable')
    expect(wrapper.text()).not.toContain('已加载全部')
    expect(wrapper.text()).toContain('shop-1')
    expect(wrapper.get('.products-count strong').text()).toBe('60')
    await wrapper.get('.load-more-btn').trigger('click'); await flushPromises()
    expect(mocks.shops.mock.calls.map(([arg]) => arg.page)).toEqual([1, 2, 2])
    expect(wrapper.text()).toContain('shop-2')
  })

  it('releases loading when a shop append is interrupted by deactivation', async () => {
    const pending = deferred()
    mocks.shops.mockResolvedValueOnce(shopsPage()).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(shopsPage(2))
    const shown = ref(true)
    const Host = defineComponent({ setup: () => () => h(KeepAlive, {}, { default: () => shown.value ? h(StoresMarketplace) : h('div') }) })
    const wrapper = mount(Host, { global: { stubs } }); wrappers.push(wrapper)
    await flushPromises()
    const task = observers.at(-1).fire(); await nextTick()
    shown.value = false; await nextTick()
    pending.resolve({ success: false, aborted: true }); await task; await flushPromises()
    shown.value = true; await flushPromises()
    expect(mocks.shops).toHaveBeenCalledTimes(2)
    expect(wrapper.get('.load-more-btn').attributes('disabled')).toBeUndefined()
    await observers.at(-1).fire(); await flushPromises()
    expect(mocks.shops).toHaveBeenCalledTimes(3)
    expect(mocks.shops.mock.calls.at(-1)[0].page).toBe(2)
  })

  it('order next-page failure preserves the last successful page', async () => {
    const requests = []
    const controller = useOrderListController({
      buildQuery: (page, signal) => ({ page, signal }),
      fetchPage: async query => {
        requests.push(query.page)
        if (requests.length === 2) return { success: false, status: 503, error: 'fixture unavailable' }
        return { success: true, data: { orders: [{ orderNo: `page-${query.page}` }], pagination: { page: query.page, totalPages: 3, pageSize: 20, total: 60 } } }
      }
    })
    await controller.load(); await controller.loadMore(); await controller.loadMore()
    expect(requests).toEqual([1, 2, 2])
    expect(controller.orders.value.map(item => item.orderNo)).toEqual(['page-1', 'page-2'])
    expect(controller.hasMore.value).toBe(true)
  })

  it('late cancelled catalog append cannot change the new category page', async () => {
    const store = useCatalogStore()
    store.restoreFromCache({ categoryId: 'old', products: [{ id: 1 }], page: 3, total: 100, hasMore: true, sort: 'newest' })
    const pending = deferred()
    mocks.products.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(productsPage(9)).mockResolvedValueOnce(productsPage(10, 2))
    const stale = store.loadMore()
    await store.fetchProducts({ categoryId: 'new', forceRefresh: true, sort: 'newest' })
    expect(store.page).toBe(1)
    pending.resolve(productsPage(4, 4)); await stale
    expect(store.currentCategory).toBe('new')
    expect(store.products.map(item => item.id)).toEqual([9])
    expect(store.page).toBe(1)
    await store.loadMore()
    expect(mocks.products.mock.calls.at(-1)[0]).toMatchObject({ categoryId: 'new', page: 2 })
  })
})
