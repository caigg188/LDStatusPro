// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { resolveOrderItemPricing } from '../src/utils/orderItemPricing.js'
import OrderDetail from '../src/views/OrderDetail.vue'

const orderDetailSource = readFileSync(resolve(import.meta.dirname, '../src/views/OrderDetail.vue'), 'utf8')

const mocks = vi.hoisted(() => ({
  loading: null,
  order: null,
  logs: null,
  load: vi.fn(async () => null),
  startAutoRefresh: vi.fn(),
  stopAutoRefresh: vi.fn(),
  stop: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { id: 'LD123' },
    query: {},
    meta: { orderRole: 'buyer' }
  }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() })
}))

vi.mock('@/stores/catalog', () => ({
  useCatalogStore: () => ({
    categories: [],
    fetchCategories: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/stores/order', () => ({
  useOrderStore: () => ({
    fetchOrderDetail: vi.fn(),
    cancelOrder: vi.fn(),
    refreshOrderStatus: vi.fn()
  })
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn(), show: vi.fn(), loading: vi.fn() })
}))

vi.mock('@/composables/useDialog', () => ({
  useDialog: () => ({ confirm: vi.fn() })
}))

vi.mock('@/composables/orders/usePaymentPopupSync', () => ({
  usePaymentPopupSync: () => ({ paymentPopupOpen: { value: false }, start: vi.fn(), stop: vi.fn() })
}))

vi.mock('@/composables/orders/useOrderDetail', async () => {
  const { ref } = await import('vue')
  mocks.loading = ref(false)
  mocks.order = ref(null)
  mocks.logs = ref([])
  return {
    useOrderDetail: () => ({
      loading: mocks.loading,
      order: mocks.order,
      logs: mocks.logs,
      load: mocks.load,
      startAutoRefresh: mocks.startAutoRefresh,
      stopAutoRefresh: mocks.stopAutoRefresh,
      stop: mocks.stop
    })
  }
})

const discountedOrder = {
  orderNo: 'LD123',
  status: 'paid',
  productType: 'cdk',
  quantity: 2,
  originalPrice: 20,
  productSubtotal: 16,
  amount: 16,
  productName: '测试卡密',
  product: {
    id: 9,
    name: '测试卡密',
    price: 10,
    discount: 0.8,
    categoryName: '卡密'
  },
  createdAt: '2026-04-01T00:00:00.000Z'
}

const regularOrder = {
  ...discountedOrder,
  originalPrice: 20,
  productSubtotal: 20,
  amount: 20,
  product: {
    ...discountedOrder.product,
    discount: 1
  }
}

let wrapper

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

async function renderOrder(order) {
  mocks.loading.value = false
  mocks.order.value = order
  mocks.logs.value = []
  wrapper = mount(OrderDetail, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        EmptyState: true,
        OrderRefundPanel: true,
        FulfillmentDeadline: true
      }
    }
  })
  await flushPromises()
  return wrapper
}

describe('订单详情物品计价', () => {
  it('无折扣时只给出当前单价和折后小计', () => {
    expect(resolveOrderItemPricing({
      quantity: 2,
      originalPrice: 20,
      productSubtotal: 20,
      amount: 20,
      product: { price: 10, discount: 1 }
    })).toMatchObject({
      quantity: 2,
      originalUnitPrice: 10,
      discountedUnitPrice: 10,
      hasProductDiscount: false,
      productSubtotal: 20
    })
  })

  it('有物品折扣时按快照给出原价和折后单价', () => {
    expect(resolveOrderItemPricing({
      quantity: 3,
      originalPrice: 30,
      productSubtotal: 24,
      amount: 24,
      product: { price: 10, discount: 0.8 }
    })).toMatchObject({
      quantity: 3,
      originalUnitPrice: 10,
      discountedUnitPrice: 8,
      hasProductDiscount: true,
      productSubtotal: 24
    })
  })

  it('快照缺折扣但小计低于标价时仍视为有折扣', () => {
    expect(resolveOrderItemPricing({
      quantity: 2,
      originalPrice: 20,
      productSubtotal: 16,
      amount: 16,
      product: { price: 10 }
    })).toMatchObject({
      originalUnitPrice: 10,
      discountedUnitPrice: 8,
      hasProductDiscount: true,
      productSubtotal: 16
    })
  })

  it('详情页物品信息展示数量、单价、金额小计', () => {
    expect(orderDetailSource).toContain('info-label">数量')
    expect(orderDetailSource).toContain('info-label">单价')
    expect(orderDetailSource).toContain('info-label">金额小计')
    expect(orderDetailSource).toContain('原价')
    expect(orderDetailSource).toContain('折后')
    expect(orderDetailSource).toContain('info-label">实付积分')
    expect(orderDetailSource).not.toContain('购买数量')
    expect(orderDetailSource).not.toContain('商品标价小计')
    expect(orderDetailSource).not.toContain('商品折后小计')
  })

  it('无折扣时渲染数量、当前单价和金额小计', async () => {
    const page = await renderOrder(regularOrder)
    const text = page.text()
    expect(text).toContain('数量')
    expect(text).toContain('2 件')
    expect(text).toContain('单价')
    expect(text).toContain('10.00 LDC / 件')
    expect(text).not.toContain('原价')
    expect(text).not.toContain('折后')
    expect(text).toContain('金额小计')
    expect(text).toContain('20.00 LDC')
    expect(text).toContain('实付积分')
  })

  it('有折扣时同时渲染原价和折后单价', async () => {
    const page = await renderOrder(discountedOrder)
    const text = page.text()
    expect(text).toContain('原价 10.00 LDC / 件')
    expect(text).toContain('折后 8.00 LDC / 件')
    expect(text).toContain('金额小计')
    expect(text).toContain('16.00 LDC')
  })
})

describe('订单详情 CDK 操作区', () => {
  it('显示、复制、导出按钮与 CDK 密钥标题同一行', async () => {
    const page = await renderOrder({
      ...discountedOrder,
      deliveryContent: 'AAAA-1111\nBBBB-2222\nCCCC-3333'
    })
    const header = page.get('.cdk-card-header')
    expect(header.find('.card-title').text()).toContain('CDK 密钥')
    expect(header.findAll('.cdk-actions .icon-btn')).toHaveLength(3)
    expect(header.get('[aria-label="显示密钥"]')).toBeTruthy()
    expect(header.get('[aria-label="复制密钥"]')).toBeTruthy()
    expect(header.get('[aria-label="导出为 TXT"]')).toBeTruthy()
    expect(page.get('.cdk-box').find('.cdk-actions').exists()).toBe(false)
  })
})
