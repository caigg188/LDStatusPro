// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MyFavorites from '../src/views/MyFavorites.vue'
const mocks = vi.hoisted(() => ({ favorites: vi.fn(), blocked: vi.fn(), remove: vi.fn(), confirm: vi.fn(), toast: vi.fn() }))
vi.mock('@/stores/product', () => ({ useProductStore: () => ({ fetchFavorites: mocks.favorites, fetchBlocked: mocks.blocked, removeFavorite: mocks.remove }) }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }), useRouter: () => ({ replace: vi.fn() }), onBeforeRouteLeave: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ error: mocks.toast, success: mocks.toast }) }))
vi.mock('@/composables/useDialog', () => ({ useDialog: () => ({ confirm: mocks.confirm }) }))
let wrapper
function page(items, total = 40) { return { success: true, data: { products: items, pagination: { total } } } }
function item(id) { return { id, name: `audit-item-${id}`, price: 1 } }
function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
beforeEach(() => { vi.resetAllMocks(); mocks.blocked.mockResolvedValue(page([], 0)); mocks.confirm.mockResolvedValue(true) })
afterEach(() => wrapper?.unmount())
async function start() { wrapper = mount(MyFavorites, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, EmptyState: true } } }); await flushPromises() }
describe('collection pagination regressions', () => {
  it('rejects an older append after a new search', async () => {
    const pending = deferred()
    mocks.favorites.mockResolvedValueOnce(page(Array.from({ length: 20 }, (_, i) => item(i + 1))))
      .mockReturnValueOnce(pending.promise).mockResolvedValueOnce(page([item(100)], 1))
    await start()
    await wrapper.get('.load-more-btn').trigger('click')
    await wrapper.get('input[type="search"]').setValue('new-query')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.findAll('.collection-card')).toHaveLength(1)
    pending.resolve(page([item(21), item(22)])); await flushPromises()
    expect(wrapper.findAll('.collection-card')).toHaveLength(1)
    expect(wrapper.text()).toContain('audit-item-100')
    expect(wrapper.text()).not.toContain('audit-item-21')
  })
  it('refills the last loaded page after removing a favorite without skipping unseen items', async () => {
    let remote = Array.from({ length: 41 }, (_, i) => item(i + 1))
    mocks.favorites.mockImplementation(async ({ page: requestedPage, pageSize }) => page(remote.slice((requestedPage - 1) * pageSize, requestedPage * pageSize), remote.length))
    mocks.remove.mockImplementation(async id => { remote = remote.filter(row => row.id !== id); return { success: true } })
    await start()
    const button = wrapper.findAll('.collection-card').at(0).findAll('button').find(button => button.text() === '移除收藏')
    await button.trigger('click'); await flushPromises()
    await wrapper.get('.load-more-btn').trigger('click'); await flushPromises()
    expect(remote).toHaveLength(40)
    expect(wrapper.findAll('.collection-card')).toHaveLength(40)
    expect(wrapper.text()).toContain('audit-item-21')
    expect(wrapper.find('.load-more-btn').exists()).toBe(false)
  })
})
