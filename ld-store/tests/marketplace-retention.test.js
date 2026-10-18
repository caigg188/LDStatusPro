// @vitest-environment jsdom
import { flushPromises, shallowMount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StoresMarketplace from '../src/components/home/StoresMarketplace.vue'
import { fetchMarketplaceShops } from '../src/services/homeMarketplaceService'

vi.mock('../src/services/homeMarketplaceService', () => ({ fetchMarketplaceShops: vi.fn() }))

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

describe('marketplace retention boundaries', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('does not let an older store-list response overwrite the latest filter', async () => {
    const first = deferred()
    const second = deferred()
    fetchMarketplaceShops.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const wrapper = shallowMount(StoresMarketplace, {
      global: {
        plugins: [createPinia()],
        stubs: {
          ShopCard: { props: ['shop'], template: '<div class="shop-stub">{{ shop.name }}</div>' },
          Skeleton: true,
          EmptyState: true,
          RouterLink: true
        }
      }
    })
    await wrapper.get('.stores-tag-btn').trigger('click')
    second.resolve({ success: true, data: { shops: [{ id: 2, name: 'latest' }], pagination: { total: 1, totalPages: 1 } } })
    await flushPromises()
    first.resolve({ success: true, data: { shops: [{ id: 1, name: 'stale' }], pagination: { total: 1, totalPages: 1 } } })
    await flushPromises()

    expect(wrapper.text()).toContain('latest')
    expect(wrapper.text()).not.toContain('stale')
    wrapper.unmount()
  })

  it('keeps browsing lists in the session-scoped route cache', () => {
    const appSource = readFileSync('src/App.vue', 'utf8')
    expect(appSource).toContain("ref(['Home', 'Category', 'SearchResults', 'MyFavorites'])")
    expect(appSource).not.toContain("'ProductDetail'")
  })

  it('stops hotboard work while hidden, deactivated or unmounted', () => {
    const source = readFileSync('src/components/home/HotboardMarketplace.vue', 'utf8')
    expect(source).toContain("document.visibilityState !== 'visible'")
    expect(source).toContain('onDeactivated(() =>')
    expect(source).toContain('activeRequest?.abort()')
    expect(source).toContain('stopRefresh()')
  })
})
