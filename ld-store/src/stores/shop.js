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
  const ordersLoading = ref(false)

  // 缓存
  const productCache = new Map()
  const categoryCache = ref({ data: null, time: 0 })
  const CACHE_TTL = 60000 // 1分钟缓存

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

  // 获取商品列表
  async function fetchProducts(categoryId = '', forceRefresh = false) {
    if (loading.value) return

    // 切换分类时重置状态
    if (categoryId !== currentCategory.value || forceRefresh) {
      currentCategory.value = categoryId
      page.value = 1
      hasMore.value = true
      products.value = []
    }

    loading.value = true

    try {
      let url = `/api/shop/products?page=${page.value}&pageSize=${pageSize}`
      if (categoryId) {
        url += `&categoryId=${encodeURIComponent(categoryId)}`
      }

      const result = await api.get(url)
      if (result.success && result.data?.products) {
        const newProducts = result.data.products
        total.value = result.data.pagination?.total || result.data.total || newProducts.length
        hasMore.value = (page.value * pageSize) < total.value

        if (page.value === 1) {
          products.value = newProducts
        } else {
          products.value = [...products.value, ...newProducts]
        }
      }
    } catch (e) {
      console.error('Fetch products failed:', e)
    } finally {
      loading.value = false
    }
  }

  // 加载更多商品
  async function loadMore() {
    if (loading.value || !hasMore.value) return
    page.value++
    await fetchProducts(currentCategory.value)
  }

  // 获取商品详情
  async function fetchProduct(id) {
    // 检查缓存
    const cached = productCache.get(id)
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return cached.data
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
  async function fetchProductDetail(id) {
    return fetchProduct(id)
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

  // 搜索商品
  async function searchProducts(query) {
    if (!query.trim()) {
      searchResults.value = []
      return []
    }

    searchQuery.value = query
    searchLoading.value = true

    try {
      const result = await api.get(`/api/shop/products/search?q=${encodeURIComponent(query)}`)
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
        await fetchMyProducts()
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

  // ======== 订单管理 ========

  // 获取我的订单（买家）
  async function fetchMyOrders(status = '') {
    ordersLoading.value = true

    try {
      let url = '/api/shop/orders?role=buyer'
      if (status) url += `&status=${status}`
      
      const result = await api.get(url)
      if (result.success && result.data?.orders) {
        myOrders.value = result.data.orders
        return result.data.orders
      }
      return []
    } catch (e) {
      console.error('Fetch my orders failed:', e)
      return []
    } finally {
      ordersLoading.value = false
    }
  }

  // 获取订单列表 (别名，用于 Orders.vue)
  async function fetchOrders(params = {}) {
    return fetchMyOrders(params.status || '')
  }

  // 获取卖家订单
  async function fetchSellerOrders(status = '') {
    ordersLoading.value = true

    try {
      let url = '/api/shop/orders?role=seller'
      if (status) url += `&status=${status}`
      
      const result = await api.get(url)
      if (result.success && result.data?.orders) {
        sellerOrders.value = result.data.orders
      }
    } catch (e) {
      console.error('Fetch seller orders failed:', e)
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

  return {
    // 状态
    categories,
    products,
    currentCategory,
    loading,
    hasMore,
    total,
    searchQuery,
    searchResults,
    searchLoading,
    myProducts,
    myProductsLoading,
    myOrders,
    sellerOrders,
    ordersLoading,
    // 计算属性
    currentCategoryName,
    // 方法
    fetchCategories,
    fetchProducts,
    loadMore,
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
    fetchMyOrders,
    fetchSellerOrders,
    fetchOrders,
    fetchOrderDetail,
    fetchProductDetail,
    fetchProductCdks,
    addProductCdks,
    deleteProductCdk,
    createOrder,
    cancelOrder,
    refreshOrderStatus,
    deliverOrder,
    fetchMerchantConfig,
    updateMerchantConfig,
    invalidateCache,
    fetchPublicStats
  }
})
