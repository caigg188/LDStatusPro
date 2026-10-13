// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia } from 'pinia'
import MerchantProfile from '../src/views/MerchantProfile.vue'

const requests = vi.hoisted(() => ({ profile: vi.fn() }))
vi.mock('../src/stores/product', () => ({ useProductStore: () => ({ fetchMerchantProfile: requests.profile }) }))
vi.mock('../src/stores/catalog', () => ({ useCatalogStore: () => ({ categories: [], fetchCategories: async () => [] }) }))
vi.mock('../src/stores/user', () => ({ useUserStore: () => ({ isLoggedIn: false, trustLevel: 0 }) }))

it('reloads same-name identities on query changes and ignores an older profile response', async () => {
  const pending = []
  requests.profile.mockImplementation((username, identity) => new Promise(resolve => pending.push({ username, identity, resolve })))
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/merchant/:username', name: 'MerchantProfile', component: { render: () => null } }
  ] })
  await router.push('/merchant/same?site=idcflare.com&userId=123')
  const wrapper = mount(MerchantProfile, { global: { plugins: [createPinia(), router], stubs: { AvatarImage: true } } })
  try {
    await flushPromises()
    await router.push('/merchant/same?site=linux.do&userId=456')
    await flushPromises()
    expect(pending.map(request => request.identity)).toEqual([
      { site: 'idcflare.com', userId: '123' }, { site: 'linux.do', userId: '456' }
    ])
    const result = username => ({ success: true, data: { merchant: { username }, stats: {}, products: [] } })
    pending[1].resolve(result('current-identity'))
    await flushPromises()
    expect(wrapper.find('h1').text()).toBe('@current-identity')
    pending[0].resolve(result('old-identity'))
    await flushPromises()
    expect(wrapper.find('h1').text()).toBe('@current-identity')
  } finally { wrapper.unmount(); requests.profile.mockReset() }
});
