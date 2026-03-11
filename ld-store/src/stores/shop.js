import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { storage } from '@/utils/storage'
import {
  addFavoriteRequest,
  createProductCommentReplyRequest,
  createProductCommentRequest,
  deleteProductCommentRequest,
  fetchCategoriesRequest,
  fetchFavoritesRequest,
  fetchMerchantProfileRequest,
  fetchProductCommentRepliesRequest,
  fetchProductCommentsRequest,
  fetchProductRequest,
  fetchProductsRequest,
  fetchPublicStatsRequest,
  fetchUserDashboardRequest,
  getProductRestockSubscriptionStatusRequest,
  normalizeFavoritesOptions,
  removeFavoriteRequest,
  reportProductCommentRequest,
  reportProductRequest,
  subscribeProductRestockRequest,
  voteProductCommentRequest
} from '@/services/shop/catalogService'
import {
  addCdkRequest,
  clearCdkRequest,
  createProductRequest,
  deleteCdkRequest,
  deleteProductRequest,
  fetchCdkListRequest,
  fetchMyProductDetailRequest,
  fetchMyProductsRequest,
  getProductSubmissionStatusRequest,
  offlineProductRequest,
  updateProductRequest
} from '@/services/shop/inventoryService'
import {
  fetchMerchantConfigRequest,
  updateMerchantConfigRequest
} from '@/services/shop/merchantService'
import {
  cancelOrderRequest,
  createOrderRequest,
  deliverOrderRequest,
  fetchMyBuyOrdersRequest,
  fetchOrderDetailRequest,
  fetchOrdersByRoleRequest,
  getBuyOrderDetailRequest,
  getBuyOrderPaymentUrlRequest,
  getPaymentUrlRequest,
  normalizeBuyOrderListOptions,
  normalizeOrderListOptions,
  refreshBuyOrderStatusRequest,
  refreshOrderStatusRequest
} from '@/services/shop/orderService'

const DEFAULT_PAGE_SIZE = 20
const CACHE_TTL = 60000
const IN_STOCK_ONLY_STORAGE_KEY = 'shop_in_stock_only'

function getPositiveInt(value, fallback, min = 1, max = Number.POSITIVE_INFINITY) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

function createEmptyListState(page, pageSize) {
  return {
    orders: [],
    pagination: {
      total: 0,
      page,
      pageSize,
      totalPages: 0
    }
  }
}

export const useShopStore = defineStore('shop', () => {
  // 状态
  const categories = ref([])
  const products = ref([])
  const currentCategory = ref('')
  const loading = ref(false)
  const hasMore = ref(true)
  const page = ref(1)
  const total = ref(0)
  const pageSize = DEFAULT_PAGE_SIZE

  // 搜索状态
  const searchQuery = ref('')
  const searchResults = ref([])
  const searchLoading = ref(false)

  // 我的商品
  const myProducts = ref([])
  const myProductsLoading = ref(false)

  // 我的订单
  const myOrders = ref([])
  const sellerOrders = ref([])
  const myBuyOrders = ref([])
  const myFavorites = ref([])
  const favoritesLoading = ref(false)
  const ordersLoading = ref(false)
  const lastError = ref('')

  function setLastError(message = '') {
    lastError.value = String(message || '').trim()
  }

  function consumeLastError() {
    const message = lastError.value
    lastError.value = ''
    return message
  }

  function toSafeArray(value) {
    return Array.isArray(value) ? value : []
  }

  function getCategoryCacheKey() {
    const userStore = useUserStore()
    const trustLevel = Number.isInteger(Number(userStore.trustLevel))
      ? Number(userStore.trustLevel)
      : 0
    return `${userStore.isLoggedIn ? 'auth' : 'guest'}:${trustLevel}`
  }

  // 缓存
  const productCache = new Map()
  const categoryCache = ref({ key: '', data: null, time: 0 })
  let latestProductsRequestId = 0

  // 排序状态
  const currentSort = ref('default')

  // 筛选：只看有库存
  const inStockOnly = ref(storage.get(IN_STOCK_ONLY_STORAGE_KEY, false) === true)

  // 计算属性
  const currentCategoryName = computed(() => {
    if (!currentCategory.value) return '全部'
    const category = categories.value.find(item => String(item.id) === String(currentCategory.value))
    return category ? category.name : '全部'
  })

  // 获取分类列表
  async function fetchCategories(force = false) {
    const now = Date.now()
    const cacheKey = getCategoryCacheKey()
    if (
      !force
      && categoryCache.value.key === cacheKey
      && Array.isArray(categoryCache.value.data)
      && now - categoryCache.value.time < CACHE_TTL
    ) {
      categories.value = categoryCache.value.data
      setLastError('')
      return categories.value
    }

    try {
      const result = await fetchCategoriesRequest()
      if (result.success && Array.isArray(result.data?.categories)) {
        const nextCategories = toSafeArray(result.data.categories)
        categories.value = nextCategories
        categoryCache.value = { key: cacheKey, data: nextCategories, time: now }
        setLastError('')
      } else if (result.success) {
        categories.value = []
        setLastError('分类数据格式异常，请稍后重试')
      } else {
        setLastError(result.error || '加载分类失败，请稍后重试')
      }
    } catch (error) {
      console.error('Fetch categories failed:', error)
      setLastError(error.message || '加载分类失败，请稍后重试')
    }

    return categories.value
  }

  // 获取商品列表
  async function fetchProducts(categoryInput = '', forceRefresh = false, sort = '') {
    let categoryId = categoryInput
    let requestedSort = sort
    let requestedPage = null

    // 兼容旧调用风格：fetchProducts({ category, page, sort })
    if (categoryInput && typeof categoryInput === 'object' && !Array.isArray(categoryInput)) {
      categoryId = categoryInput.categoryId ?? categoryInput.category ?? ''
      requestedSort = categoryInput.sort || ''
      requestedPage = Number.parseInt(categoryInput.page, 10)
      forceRefresh = categoryInput.forceRefresh ?? forceRefresh
    }

    if (!Number.isFinite(requestedPage) || requestedPage <= 0) {
      requestedPage = null
    }

    const sortChanged = requestedSort && requestedSort !== currentSort.value
    const shouldReset = categoryId !== currentCategory.value || forceRefresh || sortChanged || requestedPage === 1

    if (loading.value && !shouldReset && requestedPage === null) {
      return { success: false, cancelled: true, error: '请求进行中，请稍后重试' }
    }

    if (shouldReset) {
      currentCategory.value = categoryId
      if (requestedSort) currentSort.value = requestedSort
      page.value = requestedPage || 1
      hasMore.value = true
      products.value = []
    } else if (requestedPage) {
      page.value = requestedPage
    }

    const requestPage = page.value
    const requestCategory = currentCategory.value
    const requestSort = currentSort.value
    const requestInStockOnly = inStockOnly.value
    const requestId = ++latestProductsRequestId
    loading.value = true

    try {
      const result = await fetchProductsRequest({
        page: requestPage,
        pageSize,
        categoryId: requestCategory,
        sort: requestSort,
        inStockOnly: requestInStockOnly
      })

      if (requestId !== latestProductsRequestId) {
        return { success: false, cancelled: true, error: '请求已过期' }
      }

      if (result.success && Array.isArray(result.data?.products)) {
        const newProducts = toSafeArray(result.data.products)
        const previousProducts = toSafeArray(products.value)
        total.value = result.data.pagination?.total || result.data.total || newProducts.length
        hasMore.value = (requestPage * pageSize) < total.value
        products.value = requestPage === 1 ? newProducts : [...previousProducts, ...newProducts]
        setLastError('')

        return {
          success: true,
          products: newProducts,
          total: total.value,
          hasMore: hasMore.value,
          page: requestPage
        }
      }

      const errorMessage = result.success
        ? '商品数据格式异常，请稍后重试'
        : (result.error || '加载物品失败，请稍后重试')

      if (requestPage === 1) {
        products.value = []
        total.value = 0
        hasMore.value = false
      }

      setLastError(errorMessage)
      return { success: false, error: errorMessage, products: [] }
    } catch (error) {
      if (requestId === latestProductsRequestId) {
        console.error('Fetch products failed:', error)
        const errorMessage = error.message || '加载物品失败，请稍后重试'
        setLastError(errorMessage)
        return { success: false, error: errorMessage, products: [] }
      }

      return { success: false, cancelled: true, error: '请求已过期' }
    } finally {
      if (requestId === latestProductsRequestId) {
        loading.value = false
      }
    }
  }

  // 从缓存恢复分类状态（前端缓存用）
  function restoreFromCache(categoryId, cachedProducts, cachedTotal, cachedHasMore, cachedPage, cachedSort = 'default') {
    currentCategory.value = categoryId
    const restoredProducts = toSafeArray(cachedProducts)
    products.value = restoredProducts
    total.value = Number.isFinite(Number(cachedTotal)) ? Number(cachedTotal) : restoredProducts.length
    hasMore.value = typeof cachedHasMore === 'boolean' ? cachedHasMore : false
    page.value = Number.isFinite(Number(cachedPage)) ? Number(cachedPage) : 1
    currentSort.value = cachedSort
  }

  // 加载更多商品
  async function loadMore() {
    if (loading.value || !hasMore.value) {
      return { success: false, cancelled: true, error: '' }
    }

    page.value += 1
    const result = await fetchProducts(currentCategory.value)
    if (!result?.success) {
      page.value = Math.max(page.value - 1, 1)
    }
    return result
  }

  // 获取商品详情
  async function fetchProduct(id, force = false) {
    if (!force) {
      const cached = productCache.get(id)
      if (cached && Date.now() - cached.time < CACHE_TTL) {
        return cached.data
      }
    }

    try {
      const result = await fetchProductRequest(id)
      if (result.success && result.data?.product) {
        productCache.set(id, { data: result.data.product, time: Date.now() })
        return result.data.product
      }
    } catch (error) {
      console.error('Fetch product failed:', error)
    }

    return null
  }

  // 获取商品详情 (别名)
  async function fetchProductDetail(id, force = false) {
    return fetchProduct(id, force)
  }

  async function fetchMerchantProfile(username) {
    return fetchMerchantProfileRequest(username)
  }

  function setProductFavoriteState(productId, favorited) {
    const cacheKey = String(productId)
    const targetState = !!favorited

    const cached = productCache.get(productId) || productCache.get(cacheKey)
    if (cached?.data) {
      cached.data.isFavorited = targetState
      cached.data.is_favorited = targetState
      if (productCache.has(cacheKey)) {
        productCache.set(cacheKey, cached)
      } else {
        productCache.set(productId, cached)
      }
    }
  }

  async function reportProduct(id, reason) {
    return reportProductRequest(id, reason)
  }

  async function fetchProductComments(productId, options = {}) {
    return fetchProductCommentsRequest(productId, options)
  }

  async function createProductComment(productId, payload) {
    return createProductCommentRequest(productId, payload)
  }

  async function deleteProductComment(commentId) {
    return deleteProductCommentRequest(commentId)
  }

  async function reportProductComment(commentId, reason) {
    return reportProductCommentRequest(commentId, reason)
  }

  async function voteProductComment(commentId, voteType = '') {
    return voteProductCommentRequest(commentId, voteType)
  }

  async function fetchProductCommentReplies(commentId, options = {}) {
    return fetchProductCommentRepliesRequest(commentId, options)
  }

  async function createProductCommentReply(commentId, content) {
    return createProductCommentReplyRequest(commentId, content)
  }

  async function addFavorite(productId) {
    const result = await addFavoriteRequest(productId)
    if (result?.success) {
      setProductFavoriteState(productId, true)
    }
    return result
  }

  async function removeFavorite(productId) {
    const result = await removeFavoriteRequest(productId)
    if (result?.success) {
      setProductFavoriteState(productId, false)
      myFavorites.value = myFavorites.value.filter(item => String(item.id) !== String(productId))
    }
    return result
  }

  async function getProductRestockSubscriptionStatus(productId) {
    return getProductRestockSubscriptionStatusRequest(productId)
  }

  async function subscribeProductRestock(productId) {
    return subscribeProductRestockRequest(productId)
  }

  async function fetchMyFavorites(options = {}) {
    favoritesLoading.value = true

    try {
      const { result, page: favoritePage, pageSize: favoritePageSize } = await fetchFavoritesRequest(options)
      if (result.success && result.data) {
        myFavorites.value = result.data.products || []
        return result.data
      }

      return createEmptyListState(favoritePage, favoritePageSize)
    } catch (error) {
      console.error('Fetch my favorites failed:', error)
      const normalized = normalizeFavoritesOptions(options)
      return createEmptyListState(normalized.page, normalized.pageSize)
    } finally {
      favoritesLoading.value = false
    }
  }

  async function fetchMyProductDetail(id) {
    try {
      const result = await fetchMyProductDetailRequest(id)
      if (result.success && result.data?.product) {
        return result.data.product
      }
    } catch (error) {
      console.error('Fetch my product failed:', error)
    }

    return null
  }

  // 获取商品 CDK 列表 (别名)
  async function fetchProductCdks(productId, status = '') {
    const result = await fetchCdkList(productId, { status })
    return result?.cdks || []
  }

  // 添加商品 CDK (别名)
  async function addProductCdks(productId, codes) {
    return addCdk(productId, codes)
  }

  // 删除商品 CDK (别名)
  async function deleteProductCdk(productId, cdkId) {
    return deleteCdk(productId, cdkId)
  }

  // 一键清空商品可删除 CDK (别名)
  async function clearProductCdks(productId) {
    return clearCdk(productId)
  }

  // 搜索商品
  async function searchProducts(query, options = {}) {
    const keyword = typeof query === 'string' ? query.trim() : ''
    if (!keyword) {
      searchResults.value = []
      setLastError('')
      return []
    }

    const {
      sort = 'default',
      inStockOnly: onlyInStock = inStockOnly.value,
      page: searchPage = 1,
      pageSize: searchPageSize = pageSize
    } = options

    searchQuery.value = keyword
    searchLoading.value = true

    try {
      const result = await fetchProductsRequest({
        search: keyword,
        page: searchPage,
        pageSize: searchPageSize,
        sort,
        inStockOnly: onlyInStock
      })

      if (result.success && result.data?.products) {
        searchResults.value = result.data.products
        setLastError('')
        return result.data.products
      }

      setLastError(result.error || '搜索失败，请稍后重试')
      return []
    } catch (error) {
      console.error('Search products failed:', error)
      setLastError(error.message || '搜索失败，请稍后重试')
      return []
    } finally {
      searchLoading.value = false
    }
  }

  // 清除搜索
  function clearSearch() {
    searchQuery.value = ''
    searchResults.value = []
  }

  // ======== 我的商品 ========

  async function fetchMyProducts(_force = false) {
    myProductsLoading.value = true

    try {
      const result = await fetchMyProductsRequest()
      if (result.success && result.data?.products) {
        myProducts.value = result.data.products
        return result.data.products
      }
      return []
    } catch (error) {
      console.error('Fetch my products failed:', error)
      return []
    } finally {
      myProductsLoading.value = false
    }
  }

  async function createProduct(data, options = {}) {
    const result = await createProductRequest(data, options)
    if (result.success) {
      invalidateCache()
      await fetchMyProducts()
    }
    return result
  }

  async function getProductSubmissionStatus(submissionToken) {
    return getProductSubmissionStatusRequest(submissionToken)
  }

  async function updateProduct(id, data, options = {}) {
    const result = await updateProductRequest(id, data, options)
    if (result.success) {
      invalidateCache()
      productCache.delete(id)
      await fetchMyProducts()
    }
    return result
  }

  async function offlineProduct(id) {
    const result = await offlineProductRequest(id)
    if (result.success) {
      invalidateCache()
      await fetchMyProducts()
    }
    return result
  }

  async function deleteProduct(id) {
    const result = await deleteProductRequest(id)
    if (result.success) {
      invalidateCache()
      productCache.delete(id)
    }
    return result
  }

  // ======== CDK 管理 ========

  async function fetchCdkList(productId, options = {}) {
    try {
      const result = await fetchCdkListRequest(productId, options)
      return result.success ? result.data : { cdks: [], stats: {}, total: 0 }
    } catch {
      return { cdks: [], stats: {}, total: 0 }
    }
  }

  async function addCdk(productId, codes) {
    const result = await addCdkRequest(productId, codes)
    if (result.success) {
      invalidateCache()
    }
    return result
  }

  async function deleteCdk(productId, cdkId) {
    return deleteCdkRequest(productId, cdkId)
  }

  async function clearCdk(productId) {
    const result = await clearCdkRequest(productId)
    if (result.success) {
      invalidateCache()
    }
    return result
  }

  // ======== 订单管理 ========

  async function fetchMyOrders(options = {}) {
    ordersLoading.value = true

    try {
      const { result, emptyState } = await fetchOrdersByRoleRequest('buyer', options)
      if (result.success && result.data?.orders) {
        myOrders.value = result.data.orders
        return result.data
      }
      return emptyState
    } catch (error) {
      console.error('Fetch my orders failed:', error)
      const normalized = normalizeOrderListOptions(options)
      return createEmptyListState(
        getPositiveInt(normalized.page, 1),
        getPositiveInt(normalized.pageSize, 20, 1, 50)
      )
    } finally {
      ordersLoading.value = false
    }
  }

  async function fetchOrders(params = {}) {
    const options = normalizeOrderListOptions(params)
    if (options.role === 'seller') {
      return fetchSellerOrders(options)
    }
    return fetchMyOrders(options)
  }

  async function fetchSellerOrders(options = {}) {
    ordersLoading.value = true

    try {
      const { result, emptyState } = await fetchOrdersByRoleRequest('seller', options)
      if (result.success && result.data?.orders) {
        sellerOrders.value = result.data.orders
        return result.data
      }
      return emptyState
    } catch (error) {
      console.error('Fetch seller orders failed:', error)
      const normalized = normalizeOrderListOptions(options)
      return createEmptyListState(
        getPositiveInt(normalized.page, 1),
        getPositiveInt(normalized.pageSize, 20, 1, 50)
      )
    } finally {
      ordersLoading.value = false
    }
  }

  async function fetchOrderDetail(orderNo, role = 'buyer') {
    try {
      const result = await fetchOrderDetailRequest(orderNo, role)
      return result.success ? result.data : null
    } catch {
      return null
    }
  }

  async function createOrder(productId, quantity = 1) {
    return createOrderRequest(productId, quantity)
  }

  async function cancelOrder(orderNo) {
    const result = await cancelOrderRequest(orderNo)
    if (result.success) {
      await fetchMyOrders()
    }
    return result
  }

  async function refreshOrderStatus(orderNo) {
    return refreshOrderStatusRequest(orderNo)
  }

  async function getPaymentUrl(orderNo) {
    return getPaymentUrlRequest(orderNo)
  }

  async function deliverOrder(orderNo, content) {
    const result = await deliverOrderRequest(orderNo, content)
    if (result.success) {
      await fetchSellerOrders()
    }
    return result
  }

  // ======== 求购订单 ========

  async function fetchMyBuyOrders(options = {}) {
    ordersLoading.value = true

    try {
      const { result, emptyState } = await fetchMyBuyOrdersRequest(options)
      if (result.success && result.data) {
        myBuyOrders.value = result.data.orders || []
        return result.data
      }
      return emptyState
    } catch (error) {
      console.error('Fetch buy orders failed:', error)
      const normalized = normalizeBuyOrderListOptions(options)
      return createEmptyListState(normalized.page, normalized.pageSize)
    } finally {
      ordersLoading.value = false
    }
  }

  async function getBuyOrderDetail(orderNo) {
    return getBuyOrderDetailRequest(orderNo)
  }

  async function getBuyOrderPaymentUrl(orderNo) {
    return getBuyOrderPaymentUrlRequest(orderNo)
  }

  async function refreshBuyOrderStatus(orderNo) {
    return refreshBuyOrderStatusRequest(orderNo)
  }

  // ======== 商户设置 ========

  async function fetchMerchantConfig() {
    const result = await fetchMerchantConfigRequest()
    return result.success ? result.data : null
  }

  async function updateMerchantConfig(config) {
    return updateMerchantConfigRequest(config)
  }

  function invalidateCache() {
    productCache.clear()
    products.value = []
    page.value = 1
    hasMore.value = true
  }

  async function fetchPublicStats() {
    try {
      const result = await fetchPublicStatsRequest()
      if (result.success) {
        setLastError('')
        return result.data
      }
      setLastError(result.error || '加载统计数据失败，请稍后重试')
      return null
    } catch (error) {
      console.error('Fetch public stats failed:', error)
      setLastError(error.message || '加载统计数据失败，请稍后重试')
      return null
    }
  }

  function setInStockOnly(nextValue) {
    const normalizedValue = !!nextValue
    inStockOnly.value = normalizedValue
    storage.set(IN_STOCK_ONLY_STORAGE_KEY, normalizedValue, 0)
    return normalizedValue
  }

  async function toggleInStockOnly() {
    setInStockOnly(!inStockOnly.value)
    page.value = 1
    hasMore.value = true
    products.value = []
    return fetchProducts(currentCategory.value, true)
  }

  async function fetchUserDashboard() {
    try {
      const result = await fetchUserDashboardRequest()
      if (result.success) {
        setLastError('')
        return result.data
      }
      setLastError(result.error || '鍔犺浇涓汉缁熻澶辫触锛岃绋嶅悗閲嶈瘯')
      return null
    } catch (error) {
      console.error('Fetch user dashboard failed:', error)
      setLastError(error.message || '鍔犺浇涓汉缁熻澶辫触锛岃绋嶅悗閲嶈瘯')
      return null
    }
  }

  return {
    // 状态
    categories,
    products,
    currentCategory,
    currentSort,
    inStockOnly,
    loading,
    hasMore,
    page,
    total,
    searchQuery,
    searchResults,
    searchLoading,
    myProducts,
    myProductsLoading,
    myOrders,
    sellerOrders,
    myBuyOrders,
    myFavorites,
    favoritesLoading,
    ordersLoading,
    lastError,
    // 计算属性
    currentCategoryName,
    // 方法
    fetchCategories,
    fetchProducts,
    restoreFromCache,
    loadMore,
    setInStockOnly,
    toggleInStockOnly,
    fetchProduct,
    searchProducts,
    clearSearch,
    fetchMyProducts,
    createProduct,
    getProductSubmissionStatus,
    updateProduct,
    offlineProduct,
    deleteProduct,
    fetchCdkList,
    addCdk,
    deleteCdk,
    clearCdk,
    fetchMyOrders,
    fetchSellerOrders,
    fetchOrders,
    fetchOrderDetail,
    fetchProductDetail,
    fetchMerchantProfile,
    reportProduct,
    fetchProductComments,
    createProductComment,
    deleteProductComment,
    reportProductComment,
    voteProductComment,
    fetchProductCommentReplies,
    createProductCommentReply,
    addFavorite,
    removeFavorite,
    getProductRestockSubscriptionStatus,
    subscribeProductRestock,
    fetchMyFavorites,
    fetchMyProductDetail,
    fetchProductCdks,
    addProductCdks,
    deleteProductCdk,
    clearProductCdks,
    createOrder,
    cancelOrder,
    refreshOrderStatus,
    getPaymentUrl,
    deliverOrder,
    fetchMyBuyOrders,
    getBuyOrderDetail,
    getBuyOrderPaymentUrl,
    refreshBuyOrderStatus,
    fetchMerchantConfig,
    updateMerchantConfig,
    consumeLastError,
    invalidateCache,
    fetchPublicStats,
    fetchUserDashboard
  }
})
