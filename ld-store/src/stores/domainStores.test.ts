// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCatalogStore } from './catalog'
import { useOrderStore } from './order'

const mocks = vi.hoisted(() => ({
  fetchProducts: vi.fn(),
  fetchCategories: vi.fn(),
  fetchPublicStats: vi.fn(),
  fetchUserDashboard: vi.fn(),
  fetchUserAttention: vi.fn(),
  fetchOrders: vi.fn(),
  fetchBuyOrders: vi.fn()
}))

vi.mock('@/services/shop/catalogService', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/services/shop/catalogService')>(),
  fetchProductsRequest: mocks.fetchProducts,
  fetchCategoriesRequest: mocks.fetchCategories,
  fetchPublicStatsRequest: mocks.fetchPublicStats,
  fetchUserDashboardRequest: mocks.fetchUserDashboard,
  fetchUserAttentionRequest: mocks.fetchUserAttention,
  normalizeFavoritesOptions: (options: unknown) => options
}))

vi.mock('@/services/shop/orderService', () => ({
  fetchOrdersByRoleRequest: mocks.fetchOrders,
  fetchMyBuyOrdersRequest: mocks.fetchBuyOrders,
  fetchOrderDetailRequest: vi.fn(),
  createOrderRequest: vi.fn(),
  getOrderSubmissionRequest: vi.fn(),
  cancelOrderRequest: vi.fn(),
  deliverOrderRequest: vi.fn(),
  getBuyOrderDetailRequest: vi.fn(),
  getBuyOrderPaymentUrlRequest: vi.fn(),
  getPaymentUrlRequest: vi.fn(),
  refreshBuyOrderStatusRequest: vi.fn(),
  refreshOrderStatusRequest: vi.fn()
}))

vi.mock('@/services/shop/inventoryService', () => ({
  fetchMyProductsRequest: vi.fn(),
  createProductRequest: vi.fn(),
  getProductSubmissionStatusRequest: vi.fn(),
  updateProductRequest: vi.fn(),
  offlineProductRequest: vi.fn(),
  deleteProductRequest: vi.fn(),
  fetchMyProductDetailRequest: vi.fn(),
  fetchCdkListRequest: vi.fn(),
  addCdkRequest: vi.fn(),
  deleteCdkRequest: vi.fn(),
  clearCdkRequest: vi.fn()
}))

vi.mock('@/services/shop/merchantService', () => ({
  fetchMerchantConfigRequest: vi.fn(),
  updateMerchantConfigRequest: vi.fn()
}))

vi.mock('@/services/shop/discoveryService', () => ({
  getDiscoveryTokenForProduct: vi.fn(() => ''),
  clearDiscoveryTokenForProduct: vi.fn()
}))

function success<T>(data: T) {
  return { success: true as const, status: 200, data }
}

function failure(error: string) {
  return { success: false as const, status: 503, error, aborted: false, kind: 'http' as const }
}

function aborted() {
  return { success: false as const, status: 0, error: '', aborted: true, abortReason: 'caller' as const, kind: 'abort' as const }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function productPage(id: number, page: number, pagination: Record<string, unknown> = {}) {
  return success({
    products: [{ id, name: `物品 ${id}` }],
    pagination: { total: 2, page, pageSize: 20, totalPages: 1, ...pagination },
    rankingContext: { surface: 'home', version: 'v1', fallback: false }
  })
}

describe('storefront domain stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('prevents an older catalog response from overwriting the latest page', async () => {
    const older = deferred<ReturnType<typeof productPage>>()
    mocks.fetchProducts
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce(productPage(2, 2))
    const store = useCatalogStore()

    const first = store.fetchProducts({ page: 1 })
    const second = await store.fetchProducts({ page: 2 })
    older.resolve(productPage(1, 1))
    const stale = await first

    expect(second.success).toBe(true)
    expect(stale).toMatchObject({ success: false, aborted: true, kind: 'abort' })
    expect(store.products.map(product => product.id)).toEqual([2])
    expect(store.page).toBe(2)
  })

  it('keeps buyer and seller request lifecycle state independent', async () => {
    const buyer = deferred<ReturnType<typeof success>>()
    mocks.fetchOrders.mockImplementation((role: string) => role === 'buyer'
      ? buyer.promise
      : Promise.resolve(success({
          orders: [{ orderNo: 'SELLER-1', status: 'paid' }],
          pagination: { total: 1, page: 1, pageSize: 20, totalPages: 1 }
        })))
    const store = useOrderStore()

    const buyerTask = store.fetchBuyerOrders()
    expect(store.buyerOrdersLoading).toBe(true)
    await store.fetchSellerOrders()
    expect(store.buyerOrdersLoading).toBe(true)
    expect(store.sellerOrdersLoading).toBe(false)
    expect(store.sellerOrders[0]?.orderNo).toBe('SELLER-1')

    buyer.resolve(success({
      orders: [{ orderNo: 'BUYER-1', status: 'pending' }],
      pagination: { total: 1, page: 1, pageSize: 20, totalPages: 1 }
    }))
    await buyerTask
    expect(store.buyerOrdersLoading).toBe(false)
    expect(store.buyerOrders[0]?.orderNo).toBe('BUYER-1')
  })

  it('returns an explicit failure instead of masking a list error as an empty array', async () => {
    mocks.fetchOrders.mockResolvedValue(failure('订单服务维护中'))
    const store = useOrderStore()
    const result = await store.fetchBuyerOrders()

    expect(result).toMatchObject({ success: false, status: 503, kind: 'http' })
    expect(store.buyerOrdersError).toBe('订单服务维护中')
    expect(Array.isArray(result)).toBe(false)
  })

  it('exposes catalog state directly without a compatibility facade', async () => {
    mocks.fetchProducts.mockResolvedValue(productPage(9, 1))
    const catalog = useCatalogStore()

    const result = await catalog.fetchProducts({ page: 1 })
    expect(result.success).toBe(true)
    expect(catalog.products[0]?.id).toBe(9)
  })

  it('keeps the current list while a category switch is in flight', async () => {
    mocks.fetchProducts.mockResolvedValueOnce(productPage(1, 1))
    const store = useCatalogStore()
    await store.fetchProducts({ categoryId: '', page: 1 })

    const pending = deferred<ReturnType<typeof productPage>>()
    mocks.fetchProducts.mockReturnValueOnce(pending.promise)
    const switching = store.fetchProducts({ categoryId: 2, forceRefresh: true })

    expect(store.currentCategory).toBe(2)
    expect(store.products.map(product => product.id)).toEqual([1])
    expect(store.loading).toBe(true)

    pending.resolve(productPage(2, 1))
    await switching
    expect(store.products.map(product => product.id)).toEqual([2])
  })

  it('does not treat an aborted category switch as an empty catalog', async () => {
    mocks.fetchProducts.mockResolvedValueOnce(productPage(1, 1))
    const store = useCatalogStore()
    await store.fetchProducts({ categoryId: '', page: 1 })

    const pending = deferred<ReturnType<typeof aborted>>()
    mocks.fetchProducts.mockReturnValueOnce(pending.promise)
    const controller = new AbortController()
    const switching = store.fetchProducts({ categoryId: 2, forceRefresh: true, signal: controller.signal })
    controller.abort()
    pending.resolve(aborted())

    const result = await switching
    expect(result).toMatchObject({ success: false, aborted: true, kind: 'abort' })
    expect(store.products.map(product => product.id)).toEqual([1])
    expect(store.total).toBe(2)
  })

  it('ignores an in-flight category response after restoreFromCache', async () => {
    mocks.fetchProducts.mockResolvedValueOnce(productPage(1, 1))
    const store = useCatalogStore()
    await store.fetchProducts({ categoryId: '', page: 1 })

    const pending = deferred<ReturnType<typeof productPage>>()
    mocks.fetchProducts.mockReturnValueOnce(pending.promise)
    const switching = store.fetchProducts({ categoryId: 2, forceRefresh: true })
    store.restoreFromCache({
      categoryId: '',
      products: [{ id: 1, name: '物品 1' }],
      total: 2,
      hasMore: false,
      page: 1,
      sort: 'default'
    })
    pending.resolve(productPage(2, 1))

    expect(await switching).toMatchObject({ success: false, aborted: true, kind: 'abort' })
    expect(store.currentCategory).toBe('')
    expect(store.products.map(product => product.id)).toEqual([1])
    expect(store.loading).toBe(false)
  })

  it('keeps price filters and the current list when loading the next page', async () => {
    mocks.fetchProducts.mockResolvedValueOnce(productPage(1, 1, {
      total: 40,
      totalPages: 2,
      hasMore: true,
      nextCursor: 'cursor-1'
    }))
    const store = useCatalogStore()
    await store.fetchProducts({ categoryId: '', page: 1, priceMin: 5, priceMax: 20 })

    mocks.fetchProducts.mockResolvedValueOnce(productPage(2, 2, {
      total: 40,
      totalPages: 2,
      hasMore: false,
      nextCursor: 'cursor-2'
    }))
    const result = await store.loadMore()

    expect(result.success).toBe(true)
    expect(mocks.fetchProducts).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 2,
      priceMin: 5,
      priceMax: 20,
      cursor: 'cursor-1'
    }))
    expect(store.currentPriceMin).toBe(5)
    expect(store.currentPriceMax).toBe(20)
    expect(store.products.map(product => product.id)).toEqual([1, 2])
    expect(store.page).toBe(2)
    expect(store.hasMore).toBe(false)
  })

  it('does not treat omitted price keys as clearing the active range', async () => {
    mocks.fetchProducts.mockResolvedValueOnce(productPage(1, 1, {
      total: 40,
      hasMore: true,
      nextCursor: 'cursor-1'
    }))
    const store = useCatalogStore()
    await store.fetchProducts({ categoryId: '', page: 1, priceMin: 8, priceMax: 30 })

    mocks.fetchProducts.mockResolvedValueOnce(productPage(2, 2, {
      total: 40,
      hasMore: false,
      nextCursor: 'cursor-2'
    }))
    await store.fetchProducts({ categoryId: '', page: 2 })

    expect(mocks.fetchProducts).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 2,
      priceMin: 8,
      priceMax: 30,
      cursor: 'cursor-1'
    }))
    expect(store.currentPriceMin).toBe(8)
    expect(store.currentPriceMax).toBe(30)
    expect(store.products.map(product => product.id)).toEqual([1, 2])
  })

  it('restarts at page 1 when the price range actually changes', async () => {
    mocks.fetchProducts.mockResolvedValueOnce(productPage(1, 1, {
      total: 40,
      hasMore: true,
      nextCursor: 'cursor-1'
    }))
    const store = useCatalogStore()
    await store.fetchProducts({ categoryId: '', page: 1, priceMin: 5, priceMax: 20 })

    mocks.fetchProducts.mockResolvedValueOnce(productPage(3, 1, {
      total: 12,
      hasMore: false,
      nextCursor: 'cursor-new'
    }))
    await store.fetchProducts({ categoryId: '', page: 2, priceMin: 10, priceMax: 20, forceRefresh: true })

    expect(mocks.fetchProducts).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 1,
      priceMin: 10,
      priceMax: 20,
      cursor: ''
    }))
    expect(store.currentPriceMin).toBe(10)
    expect(store.products.map(product => product.id)).toEqual([3])
    expect(store.page).toBe(1)
  })
})
