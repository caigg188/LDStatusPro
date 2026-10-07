import { useSessionScope } from '@/composables/useSessionScope'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useUserStore } from '@/stores/user'
import { storage } from '@/utils/storage'
import type { ApiResult } from '@/contracts/apiContract'
import type { Category, Product, ProductListResponse } from '@/contracts/catalog'
import {
  fetchCategoriesRequest,
  fetchProductsRequest,
  fetchPublicStatsRequest,
  fetchUserDashboardRequest,
  fetchUserAttentionRequest
} from '@/services/shop/catalogService'
import { serviceFailure } from '@/services/serviceContract'

const DEFAULT_PAGE_SIZE = 20
const CATEGORY_CACHE_TTL = 60_000
const IN_STOCK_ONLY_STORAGE_KEY = 'shop_in_stock_only'

type MutableProduct = Product & Record<string, unknown>

interface ProductListInput {
  categoryId?: string | number
  category?: string | number
  forceRefresh?: boolean
  preserveProducts?: boolean
  page?: number | string
  sort?: string
  priceMin?: number | string | null
  priceMax?: number | string | null
  signal?: AbortSignal
}

interface SearchInput {
  sort?: string
  inStockOnly?: boolean
  page?: number
  pageSize?: number
  priceMin?: number | string | null
  priceMax?: number | string | null
  signal?: AbortSignal
}

interface CatalogSnapshot {
  products?: Product[]
  categoryId?: string | number
  total?: number
  hasMore?: boolean
  cursor?: string
  rankingContext?: unknown
  page?: number
  sort?: string
  priceMin?: number | string | null
  priceMax?: number | string | null
  inStockOnly?: boolean
}

function normalizePriceFilterValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number.parseFloat(String(value).trim())
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.round(parsed * 100) / 100)
}

function normalizePriceRange(priceMin: unknown, priceMax: unknown) {
  let normalizedMin = normalizePriceFilterValue(priceMin)
  let normalizedMax = normalizePriceFilterValue(priceMax)
  if (normalizedMin !== null && normalizedMax !== null && normalizedMin > normalizedMax) {
    ;[normalizedMin, normalizedMax] = [normalizedMax, normalizedMin]
  }
  return { priceMin: normalizedMin, priceMax: normalizedMax }
}

function cancelledFailure(message: string): ApiResult<ProductListResponse> {
  return {
    success: false,
    status: 0,
    error: message,
    aborted: true,
    abortReason: 'caller',
    kind: 'abort'
  }
}

export const useCatalogStore = defineStore('catalog', () => {
  const categories = ref<Category[]>([])
  const products = ref<MutableProduct[]>([])
  const currentCategory = ref<string | number>('')
  const currentSort = ref('default')
  const inStockOnly = ref(storage.get(IN_STOCK_ONLY_STORAGE_KEY, false) === true)
  const currentPriceMin = ref<number | null>(null)
  const currentPriceMax = ref<number | null>(null)
  const loading = ref(false)
  const hasMore = ref(true)
  const page = ref(1)
  const total = ref(0)
  const catalogCursor = ref('')
  const rankingContext = ref<unknown>(null)

  const searchQuery = ref('')
  const searchResults = ref<MutableProduct[]>([])
  const searchLoading = ref(false)
  const searchCursor = ref('')
  const searchRankingContext = ref<unknown>(null)

  const categoriesError = ref('')
  const productsError = ref('')
  const searchError = ref('')
  const statsError = ref('')
  const dashboardError = ref('')
  const attentionError = ref('')

  const categoryCache = ref<{ key: string; data: Category[] | null; time: number }>({ key: '', data: null, time: 0 })
  let latestProductsRequestId = 0
  let latestSearchRequestId = 0

  const session = useSessionScope(() => {
    latestProductsRequestId++; latestSearchRequestId++
    categories.value = []; categoryCache.value = { key: '', data: null, time: 0 }
    invalidateCache(); clearSearch()
    currentCategory.value = ''; total.value = 0
    loading.value = false; searchLoading.value = false
    categoriesError.value = ''; productsError.value = ''; statsError.value = ''; dashboardError.value = ''; attentionError.value = ''
  })

  const currentCategoryName = computed(() => {
    if (!currentCategory.value) return '全部'
    return categories.value.find(item => String(item.id) === String(currentCategory.value))?.name || '全部'
  })

  function categoryCacheKey(): string {
    const userStore = useUserStore()
    const trustLevel = Number.isInteger(Number(userStore.trustLevel)) ? Number(userStore.trustLevel) : 0
    return `${userStore.isLoggedIn ? 'auth' : 'guest'}:${trustLevel}`
  }

  async function fetchCategories(force = false) {
    const now = Date.now()
    const key = categoryCacheKey()
    if (!force && categoryCache.value.key === key && categoryCache.value.data && now - categoryCache.value.time < CATEGORY_CACHE_TTL) {
      categories.value = categoryCache.value.data
      categoriesError.value = ''
      return { success: true as const, status: 200, data: { categories: categoryCache.value.data } }
    }

    try {
      const result = await session.run(() => fetchCategoriesRequest())
      if (session.isStale(result)) return result
      if (result.success) {
        categories.value = result.data.categories
        categoryCache.value = { key, data: result.data.categories, time: now }
        categoriesError.value = ''
      } else {
        categoriesError.value = result.error || '加载分类失败，请稍后重试'
      }
      return result
    } catch (error) {
      const failure = serviceFailure(error, '加载分类失败，请稍后重试')
      categoriesError.value = failure.error
      return failure
    }
  }

  async function fetchProducts(categoryInput: ProductListInput | string | number = '', forceRefresh = false, sort = ''): Promise<ApiResult<ProductListResponse>> {
    const preserveRequested = typeof categoryInput === 'object' && categoryInput?.preserveProducts === true
    const previous = {
      products: products.value,
      page: page.value,
      total: total.value,
      hasMore: hasMore.value,
      cursor: catalogCursor.value,
      rankingContext: rankingContext.value
    }
    let categoryId: string | number = categoryInput as string | number
    let requestedSort = sort
    let requestedPage: number | null = null
    let requestedPriceMin: unknown = currentPriceMin.value
    let requestedPriceMax: unknown = currentPriceMax.value
    let requestSignal: AbortSignal | undefined

    if (typeof categoryInput === 'object' && categoryInput !== null) {
      categoryId = categoryInput.categoryId ?? categoryInput.category ?? ''
      requestedSort = categoryInput.sort || ''
      requestedPage = Number.parseInt(String(categoryInput.page ?? ''), 10)
      forceRefresh = categoryInput.forceRefresh ?? forceRefresh
      requestSignal = categoryInput.signal
      // Omit means keep the active range; only an explicit key (including null) changes it.
      requestedPriceMin = Object.hasOwn(categoryInput, 'priceMin') ? categoryInput.priceMin : currentPriceMin.value
      requestedPriceMax = Object.hasOwn(categoryInput, 'priceMax') ? categoryInput.priceMax : currentPriceMax.value
    }
    if (!Number.isFinite(requestedPage) || Number(requestedPage) <= 0) requestedPage = null

    const priceRange = normalizePriceRange(requestedPriceMin, requestedPriceMax)
    const categoryChanged = String(categoryId) !== String(currentCategory.value)
    const sortChanged = Boolean(requestedSort && requestedSort !== currentSort.value)
    const priceChanged = priceRange.priceMin !== currentPriceMin.value || priceRange.priceMax !== currentPriceMax.value
    const queryChanged = categoryChanged || sortChanged || priceChanged || forceRefresh
    const preserveCurrent = preserveRequested && !categoryChanged && !sortChanged && !priceChanged
    const restorePrevious = () => {
      if (!preserveCurrent) return
      products.value = previous.products
      page.value = previous.page
      total.value = previous.total
      hasMore.value = previous.hasMore
      catalogCursor.value = previous.cursor
      rankingContext.value = previous.rankingContext
    }
    const shouldReset = queryChanged || requestedPage === 1
    if (loading.value && !shouldReset && requestedPage === null) return cancelledFailure('请求进行中，请稍后重试')

    if (shouldReset) {
      currentCategory.value = categoryId
      if (requestedSort) currentSort.value = requestedSort
      currentPriceMin.value = priceRange.priceMin
      currentPriceMax.value = priceRange.priceMax
      page.value = queryChanged ? 1 : (requestedPage || 1)
      hasMore.value = true
      catalogCursor.value = ''
      rankingContext.value = null
    } else if (requestedPage) {
      page.value = requestedPage
    }

    const requestPage = page.value
    const requestId = ++latestProductsRequestId
    loading.value = true
    try {
      const result = await session.run(() => fetchProductsRequest({
        page: requestPage,
        pageSize: DEFAULT_PAGE_SIZE,
        categoryId,
        sort: currentSort.value,
        inStockOnly: inStockOnly.value,
        priceMin: currentPriceMin.value,
        priceMax: currentPriceMax.value,
        cursor: requestPage > 1 ? catalogCursor.value : '',
        signal: requestSignal
      }))
      if (session.isStale(result)) return result
      if (requestId !== latestProductsRequestId) return cancelledFailure('请求已过期')
      if (result.aborted) return result
      if (!result.success) {
        restorePrevious()
        productsError.value = result.error || '加载物品失败，请稍后重试'
        if (requestPage === 1 && !preserveCurrent) {
          products.value = []
          total.value = 0
          hasMore.value = false
        }
        return result
      }

      const newProducts = result.data.products as MutableProduct[]
      const cursorRestarted = result.data.cursorRestarted === true
      const effectivePage = cursorRestarted ? 1 : requestPage
      total.value = result.data.pagination.total
      catalogCursor.value = result.data.pagination.nextCursor || ''
      rankingContext.value = result.data.rankingContext || null
      hasMore.value = typeof result.data.pagination.hasMore === 'boolean'
        ? result.data.pagination.hasMore
        : effectivePage * DEFAULT_PAGE_SIZE < total.value
      products.value = effectivePage === 1 ? newProducts : [...products.value, ...newProducts]
      page.value = effectivePage
      productsError.value = ''
      return result
    } catch (error) {
      if (requestId !== latestProductsRequestId) return cancelledFailure('请求已过期')
      restorePrevious()
      const failure = serviceFailure(error, '加载物品失败，请稍后重试')
      productsError.value = failure.error
      return failure
    } finally {
      if (requestId === latestProductsRequestId) loading.value = false
    }
  }

  function restoreFromCache(snapshot: CatalogSnapshot = {}) {
    latestProductsRequestId += 1
    loading.value = false
    const restoredProducts = Array.isArray(snapshot.products) ? snapshot.products as MutableProduct[] : []
    const priceRange = normalizePriceRange(snapshot.priceMin, snapshot.priceMax)
    currentCategory.value = snapshot.categoryId ?? ''
    products.value = restoredProducts
    total.value = Number.isFinite(Number(snapshot.total)) ? Number(snapshot.total) : restoredProducts.length
    hasMore.value = typeof snapshot.hasMore === 'boolean' ? snapshot.hasMore : false
    catalogCursor.value = String(snapshot.cursor || '')
    rankingContext.value = snapshot.rankingContext || null
    page.value = Number.isFinite(Number(snapshot.page)) ? Number(snapshot.page) : 1
    currentSort.value = snapshot.sort || 'default'
    currentPriceMin.value = priceRange.priceMin
    currentPriceMax.value = priceRange.priceMax
    if (typeof snapshot.inStockOnly === 'boolean') setInStockOnly(snapshot.inStockOnly)
  }

  async function loadMore(options: { signal?: AbortSignal } = {}) {
    if (loading.value || !hasMore.value) return cancelledFailure('')
    const previousPage = page.value
    const result = await fetchProducts({
      categoryId: currentCategory.value,
      page: previousPage + 1,
      sort: currentSort.value,
      priceMin: currentPriceMin.value,
      priceMax: currentPriceMax.value,
      signal: options.signal
    })
    if (!result.success) page.value = previousPage
    return result
  }

  async function searchProducts(query: string, options: SearchInput = {}): Promise<ApiResult<ProductListResponse>> {
    const keyword = String(query || '').trim()
    const requestId = ++latestSearchRequestId
    if (!keyword) {
      clearSearch()
      return {
        success: true,
        status: 200,
        data: {
          products: [],
          pagination: { total: 0, page: 1, pageSize: options.pageSize || DEFAULT_PAGE_SIZE, totalPages: 0 }
        }
      }
    }

    const searchPage = options.page || 1
    const searchPageSize = options.pageSize || DEFAULT_PAGE_SIZE
    const priceRange = normalizePriceRange(options.priceMin, options.priceMax)
    searchQuery.value = keyword
    searchLoading.value = true
    try {
      const result = await session.run(() => fetchProductsRequest({
        search: keyword,
        page: searchPage,
        pageSize: searchPageSize,
        sort: options.sort || 'default',
        inStockOnly: options.inStockOnly ?? inStockOnly.value,
        priceMin: priceRange.priceMin,
        priceMax: priceRange.priceMax,
        cursor: searchPage > 1 ? searchCursor.value : '',
        signal: options.signal
      }))
      if (session.isStale(result)) return result
      if (requestId !== latestSearchRequestId) return cancelledFailure('请求已过期')
      if (!result.success) {
        searchError.value = result.error || '搜索失败，请稍后重试'
        return result
      }
      searchResults.value = result.data.products as MutableProduct[]
      searchCursor.value = result.data.pagination.nextCursor || ''
      searchRankingContext.value = result.data.rankingContext || null
      searchError.value = ''
      return result
    } catch (error) {
      const failure = serviceFailure(error, '搜索失败，请稍后重试')
      searchError.value = failure.error
      return failure
    } finally {
      if (requestId === latestSearchRequestId) searchLoading.value = false
    }
  }

  function clearSearch() {
    searchQuery.value = ''
    searchResults.value = []
    searchCursor.value = ''
    searchRankingContext.value = null
    searchError.value = ''
  }

  function setInStockOnly(nextValue: boolean) {
    inStockOnly.value = Boolean(nextValue)
    storage.set(IN_STOCK_ONLY_STORAGE_KEY, inStockOnly.value, 0)
    return inStockOnly.value
  }

  async function toggleInStockOnly() {
    setInStockOnly(!inStockOnly.value)
    return fetchProducts(currentCategory.value, true)
  }

  function invalidateCache() {
    products.value = []
    page.value = 1
    hasMore.value = true
    catalogCursor.value = ''
    rankingContext.value = null
  }

  function removeProductFromVisibleLists(productId: string | number) {
    const id = String(productId)
    const previousLength = products.value.length
    products.value = products.value.filter(item => String(item.id) !== id)
    searchResults.value = searchResults.value.filter(item => String(item.id) !== id)
    if (products.value.length < previousLength) total.value = Math.max(0, total.value - 1)
  }

  function setProductFlag(productId: string | number, key: string, value: unknown) {
    const id = String(productId)
    products.value = products.value.map(product => String(product.id) === id ? { ...product, [key]: value } : product)
    searchResults.value = searchResults.value.map(product => String(product.id) === id ? { ...product, [key]: value } : product)
  }

  async function fetchPublicStats() {
    const result = await session.run(() => fetchPublicStatsRequest())
    if (session.isStale(result)) return result
    statsError.value = result.success ? '' : (result.error || '加载统计数据失败，请稍后重试')
    return result
  }

  async function fetchUserDashboard() {
    const result = await session.run(() => fetchUserDashboardRequest())
    if (session.isStale(result)) return result
    dashboardError.value = result.success ? '' : (result.error || '加载个人统计失败，请稍后重试')
    return result
  }

  async function fetchUserAttention() {
    const result = await session.run(() => fetchUserAttentionRequest())
    if (session.isStale(result)) return result
    attentionError.value = result.success ? '' : (result.error || '待办事项加载失败，请稍后重试')
    return result
  }

  function consumeError(domain: 'categories' | 'products' | 'search' | 'stats' | 'dashboard' | 'attention' = 'products') {
    const target = { categories: categoriesError, products: productsError, search: searchError, stats: statsError, dashboard: dashboardError, attention: attentionError }[domain]
    const message = target.value
    target.value = ''
    return message
  }

  return {
    categories,
    products,
    currentCategory,
    currentSort,
    inStockOnly,
    currentPriceMin,
    currentPriceMax,
    loading,
    hasMore,
    page,
    total,
    catalogCursor,
    rankingContext,
    searchQuery,
    searchResults,
    searchLoading,
    searchCursor,
    searchRankingContext,
    categoriesError,
    productsError,
    searchError,
    statsError,
    dashboardError,
    attentionError,
    currentCategoryName,
    fetchCategories,
    fetchProducts,
    restoreFromCache,
    loadMore,
    searchProducts,
    clearSearch,
    setInStockOnly,
    toggleInStockOnly,
    invalidateCache,
    removeProductFromVisibleLists,
    setProductFlag,
    fetchPublicStats,
    fetchUserDashboard,
    fetchUserAttention,
    consumeError
  }
})
