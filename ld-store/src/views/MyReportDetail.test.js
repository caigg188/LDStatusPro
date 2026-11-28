// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import MyReportDetail from './MyReportDetail.vue'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/utils/api', () => ({ api: { get: mocks.get } }))
vi.mock('@/stores/user', () => ({ useUserStore: () => ({ sessionKey: 'test-user' }) }))

let wrapper
afterEach(() => {
  wrapper?.unmount()
  mocks.get.mockReset()
})

it.each([
  ['the current product returned alongside the report', {}, { name: '当前商品' }, '当前商品'],
  ['the current product before the historical name', { product_name: '历史商品' }, { name: '当前商品' }, '当前商品'],
  ['the historical name when the current product is absent', { product_name: '历史商品' }, null, '历史商品'],
  ['the product number when neither name exists', {}, null, '商品 #7'],
  ['the current product name in the report row', { current_product_name: '处置关联商品' }, undefined, '处置关联商品']
])('shows %s', async (_scenario, productFields, currentProduct, expectedName) => {
  mocks.get.mockResolvedValue({
    success: true,
    status: 200,
    data: {
      report: {
        id: 23,
        product_id: 7,
        target_type: 'comment',
        status: 'resolved',
        report_category_label: '隐私泄露',
        ...productFields
      },
      currentProduct,
      events: [],
      evidence: []
    }
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/user/reports/:type/:id', component: MyReportDetail }]
  })
  await router.push('/user/reports/comment/23')
  await router.isReady()
  wrapper = mount(MyReportDetail, { global: { plugins: [router], stubs: { ReportFollowup: true, RouterLink: true } } })
  await flushPromises()

  expect(mocks.get).toHaveBeenCalledWith(`/api/shop/reports/comment/23`, { auth: 'required' })
  expect(wrapper.get('header.report-card > p').text()).toBe(
    `评论举报 · ${expectedName} · 隐私泄露`
  )
})
