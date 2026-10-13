// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { authToken } from './helpers/auth'
import { createPinia, setActivePinia } from 'pinia'
import { useUserStore } from '../src/stores/user'
import { useProductStore } from '../src/stores/product'
import { useCatalogStore } from '../src/stores/catalog'
import { useOrderStore } from '../src/stores/order'
import { useInventoryStore } from '../src/stores/inventory'
import { useCheckoutStore } from '../src/stores/checkout'
const mocks = vi.hoisted(() => ({ product: vi.fn(), blocked: vi.fn(), products: vi.fn(), favorite: vi.fn() }))
vi.mock('@/services/shop/catalogService', async original => ({
  ...await original<typeof import('@/services/shop/catalogService')>(),
  fetchProductRequest: mocks.product,
  fetchBlockedProductsRequest: mocks.blocked,
  fetchProductsRequest: mocks.products,
  addFavoriteRequest: mocks.favorite,
}))
const success = (data: unknown) => ({ success: true, status: 200, data })
async function login(account: string) {
  const id = account === 'A' ? '11' : '22'
  await useUserStore().login(authToken(id), { id, site: 'linux.do' })
}
beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); sessionStorage.clear(); vi.resetAllMocks() })

it('clears viewer-specific detail data on logout and fetches a fresh guest result', async () => {
  await login('A')
  const store = useProductStore()
  mocks.product.mockResolvedValueOnce(success({ product: { id: 7, isFavorited: true } }))
    .mockResolvedValueOnce(success({ product: { id: 7, isFavorited: false } }))
  await store.fetchProduct(7)
  useUserStore().logout()
  expect(await store.fetchProduct(7)).toMatchObject({ data: { product: { isFavorited: false } } })
  expect(mocks.product).toHaveBeenCalledTimes(2)
})

it('replaces the first blocked page, appends subsequent pages and clears on account switch', async () => {
  await login('A')
  const store = useProductStore()
  mocks.blocked.mockResolvedValueOnce(success({ products: [{ id: 7 }] }))
    .mockResolvedValueOnce(success({ products: [{ id: 8 }] }))
    .mockResolvedValueOnce(success({ products: [] }))
  await store.fetchBlocked({ page: 1 })
  await store.fetchBlocked({ page: 2 })
  expect(store.isProductBlocked(7)).toBe(true)
  expect(store.isProductBlocked(8)).toBe(true)
  await store.fetchBlocked({ page: 1 })
  expect(store.blockedProductIds.size).toBe(0)
  mocks.blocked.mockResolvedValueOnce(success({ products: [{ id: 7 }] }))
  await store.fetchBlocked()
  await login('B')
  expect(store.blockedProductIds.size).toBe(0)
})

it('rejects late detail and mutation responses even after returning to the same account', async () => {
  await login('A')
  const store = useProductStore()
  let resolveDetail!: (value: unknown) => void
  let resolveFavorite!: (value: unknown) => void
  mocks.product.mockImplementationOnce(() => new Promise(resolve => { resolveDetail = resolve }))
  mocks.favorite.mockImplementationOnce(() => new Promise(resolve => { resolveFavorite = resolve }))
  const detail = store.fetchProduct(7)
  const favorite = store.addFavorite(7)
  useUserStore().logout()
  await login('A')
  resolveDetail(success({ product: { id: 7, isFavorited: true } }))
  resolveFavorite(success({}))
  expect(await detail).toMatchObject({ aborted: true, errorCode: 'SESSION_CHANGED' })
  expect(await favorite).toMatchObject({ aborted: true, errorCode: 'SESSION_CHANGED' })
  mocks.product.mockResolvedValueOnce(success({ product: { id: 7, isFavorited: false } }))
  expect(await store.fetchProduct(7)).toMatchObject({ data: { product: { isFavorited: false } } })
})

it('clears order, inventory, catalog and checkout state together', async () => {
  await login('A')
  const orders = useOrderStore()
  const inventory = useInventoryStore()
  const catalog = useCatalogStore()
  const checkout = useCheckoutStore()
  orders.buyerOrders = [{ orderNo: 'A', status: 'pending' }]
  inventory.merchantConfig = { privateSetting: 'A' }
  checkout.startCheckout({ productId: 7, quantity: 2 })
  catalog.searchQuery = 'old query'
  useUserStore().logout()
  expect(orders.buyerOrders).toEqual([])
  expect(inventory.merchantConfig).toBeNull()
  expect(checkout.getDraft()).toBeNull()
  expect(catalog.searchQuery).toBe('')
})

it('does not restore stale catalog data or errors when an old request rejects', async () => {
  await login('A')
  const catalog = useCatalogStore()
  let reject!: (error: Error) => void
  mocks.products.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
  const task = catalog.fetchProducts()
  useUserStore().logout()
  reject(new Error('old account failure'))
  expect(await task).toMatchObject({ errorCode: 'SESSION_CHANGED' })
  expect(catalog.products).toEqual([])
  expect(catalog.productsError).toBe('')
})
