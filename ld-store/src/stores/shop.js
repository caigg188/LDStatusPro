import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/utils/api'

export const useShopStore = defineStore('shop', () => {
  // 状态
  const categories = ref([])
  const products = ref([])
  const currentCategory = ref('')
  const loading = ref(false)
  const hasMore = ref(true)
  const page = ref(1)
  const total = ref(0)
  const pageSize = 20

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

  // 缓存
  const productCache = new Map()
  const categoryCache = ref({ data: null, time: 0 })
  const CACHE_TTL = 60000 // 1分钟缓存
  let latestProductsRequestId = 0

  // 计算属性
  const currentCategoryName = computed(() => {
    if (!currentCategory.value) return '全部'
    const cat = categories.value.find(c => String(c.id) === String(currentCategory.value))
    return cat ? cat.name : '全部'
  })

  // 获取分类列表
  async function fetchCategories(force = false) {
    const now = Date.now()
    if (!force && categoryCache.value.data && now - categoryCache.value.time < CACHE_TTL) {
      categories.value = categoryCache.value.data
      return categories.value
    }

    try {
      const result = await api.get('/api/shop/categories')
      if (result.success && result.data?.categories) {
        categories.value = result.data.categories
        categoryCache.value = { data: result.data.categories, time: now }
      }
    } catch (e) {
      console.error('Fetch categories failed:', e)
    }
    return categories.value
  }

  // 排序状态
  const currentSort = ref('default')
  
  // 筛选：只看有库存
  const inStockOnly = ref(false)

  // 排序参数映射
  const sortMapping = {
    default: { sortBy: 'updated_at', sortOrder: 'DESC' },
    newest: { sortBy: 'created_at', sortOrder: 'DESC' },
    price_asc: { sortBy: 'price', sortOrder: 'ASC' },
    price_desc: { sortBy: 'price', sortOrder: 'DESC' },
    sales: { sortBy: 'sold_count', sortOrder: 'DESC' }
  }

  // 获取商品列表
  async function fetchProducts(categoryId = '', forceRefresh = false, sort = '') {
    // 切换分类或排序时重置状态
    const sortChanged = sort && sort !== currentSort.value
    const shouldReset = categoryId !== currentCategory.value || forceRefresh || sortChanged

    // 同一上下文加载中时不重复发起请求，避免翻页多次打点
    if (loading.value && !shouldReset) return

    if (shouldReset) {
      currentCategory.value = categoryId
      if (sort) currentSort.value = sort
      page.value = 1
      hasMore.value = true
      products.value = []
    }

    const requestPage = page.value
    const requestCategory = currentCategory.value
    const requestSort = currentSort.value
    const requestInStockOnly = inStockOnly.value
    const requestId = ++latestProductsRequestId
    loading.value = true

    try {
      let url = `/api/shop/products?page=${requestPage}&pageSize=${pageSize}`
      if (requestCategory) {
        url += `&categoryId=${encodeURIComponent(requestCategory)}`
      }

      // 添加排序参数
      const sortConfig = sortMapping[requestSort] || sortMapping.default
      url += `&sortBy=${sortConfig.sortBy}&sortOrder=${sortConfig.sortOrder}`

      // 添加库存筛选
      if (requestInStockOnly) {
        url += '&inStock=true'
      }

      const result = await api.get(url)

      // 忽略过时请求，避免旧分类结果覆盖新分类
      if (requestId !== latestProductsRequestId) return

      if (result.success && result.data?.products) {
        const newProducts = result.data.products
        total.value = result.data.pagination?.total || result.data.total || newProducts.length
        hasMore.value = (requestPage * pageSize) < total.value

        if (requestPage === 1) {
          products.value = newProducts
        } else {
          products.value = [...products.value, ...newProducts]
        }
      }
    } catch (e) {
      if (requestId === latestProductsRequestId) {
        console.error('Fetch products failed:', e)
      }
    } finally {
      if (requestId === latestProductsRequestId) {
        loading.value = false
      }
    }
  }
  // 从缓存恢复分类状态（前端缓存用）
  function restoreFromCache(categoryId, cachedProducts, cachedTotal, cachedHasMore, cachedPage, cachedSort = 'default') {
    currentCategory.value = categoryId
    products.value = cachedProducts
    total.value = cachedTotal
    hasMore.value = cachedHasMore
    page.value = cachedPage
    currentSort.value = cachedSort
  }

  // 加载更多商品
  async function loadMore() {
    if (loading.value || !hasMore.value) return
    page.value++
    await fetchProducts(currentCategory.value)
  }

  // 获取商品详情
  async function fetchProduct(id, force = false) {
    // 检查缓存
    if (!force) {
      const cached = productCache.get(id)
      if (cached && Date.now() - cached.time < CACHE_TTL) {
        return cached.data
      }
    }

    try {
      const result = await api.get(`/api/shop/products/${id}`)
      if (result.success && result.data?.product) {
        productCache.set(id, { data: result.data.product, time: Date.now() })
        return result.data.product
      }
    } catch (e) {
      console.error('Fetch product failed:', e)
    }
    return null
  }

  // 获取商品详情 (别名)
  async function fetchProductDetail(id, force = false) {
    return fetchProduct(id, force)
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
    try {
      const result = await api.post(`/api/shop/products/${id}/report`, { reason })
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // 获取自己的商品详情 (需要登录，可获取任意状态的商品)
  async function addFavorite(productId) {
    try {
      const result = await api.post(`/api/shop/products/${productId}/favorite`)
      if (result?.success) {
        setProductFavoriteState(productId, true)
      }
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async function removeFavorite(productId) {
    try {
      const result = await api.delete(`/api/shop/products/${productId}/favorite`)
      if (result?.success) {
        setProductFavoriteState(productId, false)
        myFavorites.value = myFavorites.value.filter(item => String(item.id) !== String(productId))
      }
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async function fetchMyFavorites(options = {}) {
    favoritesLoading.value = true
    try {
      const params = new URLSearchParams()
      const page = Math.max(Number.parseInt(options.page, 10) || 1, 1)
      const size = Math.min(Math.max(Number.parseInt(options.pageSize, 10) || 20, 1), 50)
      const search = String(options.search || '').trim()
      params.set('page', String(page))
      params.set('pageSize', String(size))
      if (search) params.set('search', search)

      const result = await api.get(`/api/shop/favorites?${params.toString()}`)
      if (result.success && result.data) {
        myFavorites.value = result.data.products || []
        return result.data
      }
      return {
        products: [],
        pagination: { total: 0, page, pageSize: size, totalPages: 0 }
      }
    } catch (e) {
      console.error('Fetch my favorites failed:', e)
      const page = Math.max(Number.parseInt(options.page, 10) || 1, 1)
      const size = Math.min(Math.max(Number.parseInt(options.pageSize, 10) || 20, 1), 50)
      return {
        products: [],
        pagination: { total: 0, page, pageSize: size, totalPages: 0 }
      }
    } finally {
      favoritesLoading.value = false
    }
  }

  async function fetchMyProductDetail(id) {
    try {
      const result = await api.get(`/api/shop/my-products/${id}`)
      if (result.success && result.data?.product) {
        return result.data.product
      }
    } catch (e) {
      console.error('Fetch my product failed:', e)
    }
    return null
  }

  // 获取商品 CDK 列表 (别名)
  async function fetchProductCdks(productId, status = '') {
    const result = await fetchCdkList(productId, { status })
    // 后端返回 { cdks, stats, batches, pagination }
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
      return []
    }

    const {
      sort = 'default',
      inStockOnly: onlyInStock = false,
      page: searchPage = 1,
      pageSize: searchPageSize = pageSize
    } = options

    searchQuery.value = keyword
    searchLoading.value = true

    try {
      const sortConfig = sortMapping[sort] || sortMapping.default
      const params = new URLSearchParams({
        search: keyword,
        page: String(searchPage),
        pageSize: String(searchPageSize),
        sortBy: sortConfig.sortBy,
        sortOrder: sortConfig.sortOrder
      })
      if (onlyInStock) {
        params.set('inStock', 'true')
      }

      // 使用已有的 /api/shop/products 端点，通过 search 参数进行搜索
      const result = await api.get(`/api/shop/products?${params.toString()}`)
      if (result.success && result.data?.products) {
        searchResults.value = result.data.products
        return result.data.products
      }
      return []
    } catch (e) {
      console.error('Search products failed:', e)
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

  // 获取我的商品
  async function fetchMyProducts(force = false) {
    myProductsLoading.value = true

    try {
      const result = await api.get('/api/shop/my-products')
      if (result.success && result.data?.products) {
        myProducts.value = result.data.products
        return result.data.products
      }
      return []
    } catch (e) {
      console.error('Fetch my products failed:', e)
      return []
    } finally {
      myProductsLoading.value = false
    }
  }

  // 创建商品
  async function createProduct(data) {
    try {
      const result = await api.post('/api/shop/products', data)
      if (result.success) {
        // 清除缓存
        invalidateCache()
        await fetchMyProducts()
      }
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // 更新商品
  async function updateProduct(id, data) {
    try {
      const result = await api.put(`/api/shop/my-products/${id}`, data)
      if (result.success) {
        invalidateCache()
        productCache.delete(id)
        await fetchMyProducts()
      }
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // 下架商品
  async function offlineProduct(id) {
    try {
      const result = await api.post(`/api/shop/my-products/${id}/offline`)
      if (result.success) {
        invalidateCache()
        await fetchMyProducts()
      }
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // 删除商品
  async function deleteProduct(id) {
    try {
      const result = await api.delete(`/api/shop/my-products/${id}`)
      if (result.success) {
        invalidateCache()
        productCache.delete(id)
        // 不需要重新获取，前端会自己移除
      }
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // ======== CDK 管理 ========

  // 获取 CDK 列表（正确的 API 路径）
  // 返回 { cdks, stats, batches, pagination }
  async function fetchCdkList(productId, options = {}) {
    try {
      let url = `/api/shop/products/${productId}/cdk?page=${options.page || 1}`
      if (options.status) url += `&status=${options.status}`
      const result = await api.get(url)
      return result.success ? result.data : { cdks: [], stats: {}, total: 0 }
    } catch (e) {
      return { cdks: [], stats: {}, total: 0 }
    }
  }

  // 添加 CDK（正确的 API 路径）
  async function addCdk(productId, codes) {
    try {
      const result = await api.post(`/api/shop/products/${productId}/cdk`, { codes })
      if (result.success) {
        invalidateCache()
      }
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // 删除 CDK（正确的 API 路径）
  async function deleteCdk(productId, cdkId) {
    try {
      const result = await api.delete(`/api/shop/products/${productId}/cdk/${cdkId}`)
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // 一键清空可删除 CDK（available / disabled）
  async function clearCdk(productId) {
    try {
      const result = await api.post(`/api/shop/products/${productId}/cdk/clear`)
      if (result.success) {
        invalidateCache()
      }
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // ======== 订单管理 ========

  function normalizeOrderListOptions(options = {}) {
    if (typeof options === 'string') {
      return { status: options }
    }
    if (!options || typeof options !== 'object') {
      return {}
    }
    return options
  }

  function buildOrderListParams(role, rawOptions = {}) {
    const options = normalizeOrderListOptions(rawOptions)
    const status = String(options.status || '').trim()
    const search = String(options.search || '').trim()
    const timeRange = String(options.timeRange || '').trim()
    const page = Math.max(Number.parseInt(options.page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(Number.parseInt(options.pageSize, 10) || 20, 1), 50)
    const params = new URLSearchParams()

    params.set('role', role)
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    if (status) params.set('status', status)
    if (search) params.set('search', search)
    if (timeRange) params.set('timeRange', timeRange)

    return { params, page, pageSize }
  }

  // 获取我的订单（买家）
  async function fetchMyOrders(options = {}) {
    ordersLoading.value = true

    try {
      const { params, page, pageSize } = buildOrderListParams('buyer', options)
      const result = await api.get(`/api/shop/orders?${params.toString()}`)
      if (result.success && result.data?.orders) {
        myOrders.value = result.data.orders
        return result.data
      }
      return { orders: [], pagination: { total: 0, page, pageSize, totalPages: 0 } }
    } catch (e) {
      console.error('Fetch my orders failed:', e)
      const { page, pageSize } = buildOrderListParams('buyer', options)
      return { orders: [], pagination: { total: 0, page, pageSize, totalPages: 0 } }
    } finally {
      ordersLoading.value = false
    }
  }

  // 获取订单列表 (别名，用于 Orders.vue)
  async function fetchOrders(params = {}) {
    const options = normalizeOrderListOptions(params)
    if (options.role === 'seller') {
      return fetchSellerOrders(options)
    }
    return fetchMyOrders(options)
  }

  // 获取卖家订单
  async function fetchSellerOrders(options = {}) {
    ordersLoading.value = true

    try {
      const { params, page, pageSize } = buildOrderListParams('seller', options)
      const result = await api.get(`/api/shop/orders?${params.toString()}`)
      if (result.success && result.data?.orders) {
        sellerOrders.value = result.data.orders
        return result.data
      }
      return { orders: [], pagination: { total: 0, page, pageSize, totalPages: 0 } }
    } catch (e) {
      console.error('Fetch seller orders failed:', e)
      const { page, pageSize } = buildOrderListParams('seller', options)
      return { orders: [], pagination: { total: 0, page, pageSize, totalPages: 0 } }
    } finally {
      ordersLoading.value = false
    }
  }

  // 获取订单详情
  async function fetchOrderDetail(orderNo, role = 'buyer') {
    try {
      const result = await api.get(`/api/shop/orders/${orderNo}?role=${role}`)
      return result.success ? result.data : null
    } catch (e) {
      return null
    }
  }

  // 创建订单
  async function createOrder(productId, quantity = 1) {
    try {
      const result = await api.post('/api/shop/orders', { productId, quantity })
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // 取消订单
  async function cancelOrder(orderNo) {
    try {
      const result = await api.post(`/api/shop/orders/${orderNo}/cancel`)
      if (result.success) {
        await fetchMyOrders()
      }
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // 刷新订单状态
  async function refreshOrderStatus(orderNo) {
    try {
      const result = await api.post(`/api/shop/orders/${orderNo}/refresh`)
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // 获取支付链接（用于重新支付待支付订单）
  async function getPaymentUrl(orderNo) {
    try {
      const result = await api.get(`/api/shop/orders/${orderNo}/payment-url`)
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // 发货（卖家）
  async function deliverOrder(orderNo, content) {
    try {
      const result = await api.post(`/api/shop/orders/${orderNo}/deliver`, { content })
      if (result.success) {
        await fetchSellerOrders()
      }
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // ======== 求购订单 ========

  async function fetchMyBuyOrders(options = {}) {
    ordersLoading.value = true

    try {
      const params = new URLSearchParams()
      const role = String(options.role || '')
      const status = String(options.status || '')
      const search = String(options.search || '').trim()
      const timeRange = String(options.timeRange || '').trim()
      const page = Number(options.page || 1)
      const pageSize = Number(options.pageSize || 20)

      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (role) params.set('role', role)
      if (status) params.set('status', status)
      if (search) params.set('search', search)
      if (timeRange) params.set('timeRange', timeRange)

      const result = await api.get(`/api/shop/buy-orders?${params.toString()}`)
      if (result.success && result.data) {
        myBuyOrders.value = result.data.orders || []
        return result.data
      }
      return { orders: [], pagination: { total: 0, page: 1, pageSize, totalPages: 0 } }
    } catch (e) {
      console.error('Fetch buy orders failed:', e)
      return { orders: [], pagination: { total: 0, page: 1, pageSize: Number(options.pageSize || 20), totalPages: 0 } }
    } finally {
      ordersLoading.value = false
    }
  }

  async function getBuyOrderDetail(orderNo) {
    try {
      return await api.get(`/api/shop/buy-orders/${encodeURIComponent(orderNo)}`)
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async function getBuyOrderPaymentUrl(orderNo) {
    try {
      return await api.get(`/api/shop/buy-orders/${encodeURIComponent(orderNo)}/payment-url`)
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  async function refreshBuyOrderStatus(orderNo) {
    try {
      return await api.post(`/api/shop/buy-orders/${encodeURIComponent(orderNo)}/refresh`)
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // ======== 商户设置 ========

  // 获取商户配置
  async function fetchMerchantConfig() {
    try {
      const result = await api.get('/api/shop/merchant/config')
      return result.success ? result.data : null
    } catch (e) {
      return null
    }
  }

  // 更新商户配置
  async function updateMerchantConfig(config) {
    try {
      const result = await api.put('/api/shop/merchant/config', config)
      return result
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  // 清除缓存
  function invalidateCache() {
    productCache.clear()
    products.value = []
    page.value = 1
    hasMore.value = true
  }

  // 获取公开统计数据（首页用）
  async function fetchPublicStats() {
    try {
      const result = await api.get('/api/shop/stats')
      return result.success ? result.data : null
    } catch (e) {
      console.error('Fetch public stats failed:', e)
      return null
    }
  }

  // 切换库存筛选
  async function toggleInStockOnly() {
    inStockOnly.value = !inStockOnly.value
    // 重新加载商品
    page.value = 1
    hasMore.value = true
    products.value = []
    await fetchProducts(currentCategory.value, true)
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
    // 计算属性
    currentCategoryName,
    // 方法
    fetchCategories,
    fetchProducts,
    restoreFromCache,
    loadMore,
    toggleInStockOnly,
    fetchProduct,
    searchProducts,
    clearSearch,
    fetchMyProducts,
    createProduct,
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
    reportProduct,
    addFavorite,
    removeFavorite,
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
    invalidateCache,
    fetchPublicStats
  }
})

