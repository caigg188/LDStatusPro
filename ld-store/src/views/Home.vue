<template>
  <div class="home-page">
    <!-- 迁移恢复提醒弹窗 -->
    <div v-if="showMigrationNotice" class="migration-notice-overlay">
      <div class="migration-notice-card">
        <h2 class="notice-title">⚠️ 迁移恢复提醒（必读）</h2>
        <p class="notice-desc">
          原后端加解密密钥已丢失，之前上传的物品 CDK 和收款设置中的 Client Key 无法解密，请尽快按步骤重新配置。
        </p>
        <p class="notice-desc warning">
          ⚠️ 为避免购买错误，已下架所有 CDK 类型物品，请修改收款配置、补充 CDK 后重新上架。
        </p>
        <div class="notice-steps">
          <label :class="['step-item', { completed: stepCompleted.relogin }]">
            <input type="checkbox" v-model="stepCompleted.relogin" />
            <span class="step-text">1. <strong>退出登录，然后重新授权登录</strong>（旧 Token 已失效）</span>
          </label>
          <label :class="['step-item', { completed: stepCompleted.config }]">
            <input type="checkbox" v-model="stepCompleted.config" />
            <span class="step-text">2. 重新配置收款设置（LDC 参数），重新填写并保存</span>
          </label>
          <label :class="['step-item', { completed: stepCompleted.relist }]">
            <input type="checkbox" v-model="stepCompleted.relist" />
            <span class="step-text">3. 清空可用 CDK，补充新 CDK 后再重新上架物品</span>
          </label>
          <p class="step-note">若你购买的是加密后的自动发货代码，请联系卖家获取原始内容</p>
        </div>
        <div class="notice-actions">
          <button class="notice-btn primary" @click="goToMerchantSettings">去重新配置收款设置</button>
          <button class="notice-btn danger" @click="goToCdkRecovery">去清空并重传CDK</button>
        </div>
        <div class="notice-footer">
          <span class="step-progress">已完成 {{ completedStepsCount }}/3 步</span>
          <button 
            :class="['notice-btn', allStepsCompleted ? 'confirm-done' : 'confirm']" 
            @click="ackMigrationNotice"
          >
            {{ allStepsCompleted ? '我已完成，不再显示' : '我已知晓' }}
          </button>
        </div>
      </div>
    </div>

    <div class="page-container">
      <!-- Banner -->
      <div class="home-banner">
        <div class="banner-content">
          <h1 class="banner-title">🍔 LD士多</h1>
          <p class="banner-subtitle">
            <a href="https://linux.do" target="_blank" class="link-linuxdo">LinuxDo社区</a>
            虚拟物品与服务 <span class="highlight-red">兑换中心</span>
          </p>
          <p class="banner-subtitle">
            快使用你的
            <a href="https://credit.linux.do/" target="_blank" class="highlight-yellow link-credit">社区积分</a>
            兑换物品吧
          </p>
        </div>
        <div class="banner-stats">
          <div class="stat-group">
            <div class="stat-item">
              <span class="stat-value">{{ stats.products?.online || 0 }}</span>
              <span class="stat-label">在售物品</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ stats.products?.total || 0 }}</span>
              <span class="stat-label">累计上架</span>
            </div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-group">
            <div class="stat-item">
              <span class="stat-value">{{ stats.orders?.today || 0 }}</span>
              <span class="stat-label">今日成交</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ stats.orders?.week || 0 }}</span>
              <span class="stat-label">7日成交</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ stats.orders?.total || 0 }}</span>
              <span class="stat-label">累计成交</span>
            </div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-group">
            <div class="stat-item">
              <span class="stat-value">{{ stats.stores || 0 }}</span>
              <span class="stat-label">入驻小店</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 板块切换 -->
      <div class="section-tabs-wrapper">
        <LiquidTabs
          v-model="activeSection"
          :tabs="sectionTabs"
          @update:model-value="switchSection"
        />
      </div>
      
      <!-- 物品广场 -->
      <div v-show="activeSection === 'products'" class="section-content">
        <!-- 分类筛选（排除小店） -->
        <div class="filter-section">
          <CategoryFilter
            :categories="marketCategories"
            :current-category="currentCategory"
            @select="handleCategorySelect"
          />
        </div>
        
        <!-- 排序和筛选选项 -->
        <div class="sort-section">
          <div class="sort-options">
            <button
              v-for="tab in sortTabs"
              :key="tab.value"
              class="sort-btn"
              :class="{ active: currentSort === tab.value }"
              @click="handleSortChange(tab.value)"
            >
              {{ tab.label }}
            </button>
          </div>
          <label class="stock-filter" @click="handleToggleInStock">
            <span class="checkbox" :class="{ checked: inStockOnly }">
              <span class="checkmark" v-if="inStockOnly">✓</span>
            </span>
            <span class="filter-label">只看有货</span>
          </label>
        </div>
        
        <!-- 物品统计 -->
        <div class="products-header">
          <span class="products-count">
            {{ currentCategoryName }} 共 <strong>{{ total }}</strong> 件物品
            <span v-if="inStockOnly" class="filter-tag">有库存</span>
          </span>
        </div>
        
        <!-- 物品列表 -->
        <div v-if="initialLoading" class="products-loading">
          <Skeleton type="card" :count="6" :columns="gridColumns" />
        </div>
        
        <div v-else-if="marketProducts.length > 0" class="products-grid">
          <ProductCard
            v-for="product in marketProducts"
            :key="product.id"
            :product="product"
            :categories="categories"
          />
          
          <!-- 加载更多 -->
          <div v-if="hasMore" ref="sentinel" class="load-more">
            <div v-if="loading" class="loading-indicator">
              <span class="spinner"></span>
              <span>加载中...</span>
            </div>
            <span v-else class="load-hint">⬇️ 滚动加载更多</span>
          </div>
          <div v-else class="loaded-all">✨ 已加载全部</div>
        </div>
        
        <!-- 空状态 -->
        <EmptyState
          v-else
          icon="🛒"
          text="暂无物品"
          hint="快来发布第一个物品吧~"
        >
          <template #action>
            <router-link to="/publish" class="btn btn-primary mt-4">
              ➕ 发布物品
            </router-link>
          </template>
        </EmptyState>
      </div>
      
      <!-- 小店集市 -->
      <div v-show="activeSection === 'stores'" class="section-content">
        <div class="stores-header">
          <p class="stores-desc">🏪 汇集各路大佬的自建小店，欢迎入驻🎉</p>
        </div>
        
        <!-- 小店统计 -->
        <div class="products-header">
          <span class="products-count">
            全部 共 <strong>{{ shopsTotal }}</strong> 个小店
          </span>
        </div>
        
        <div v-if="shopsLoading || !shopsLoaded" class="products-loading">
          <Skeleton type="card" :count="4" :columns="gridColumns" />
        </div>
        
        <div v-else-if="shops.length > 0" class="products-grid stores-grid">
          <ShopCard
            v-for="shop in shops"
            :key="shop.id"
            :shop="shop"
          />
        </div>
        
        <EmptyState
          v-else
          icon="🏬"
          text="暂无小店"
          hint="快来入驻开设你的第一家小店吧~"
        >
          <template #action>
            <router-link to="/my-shop" class="btn btn-primary mt-4">
              🏪 小店入驻
            </router-link>
          </template>
        </EmptyState>
      </div>

      <div v-show="activeSection === 'buy'" class="section-content">
        <div class="buy-header">
          <p class="buy-desc">求购信息处于<span style="color: #ff6b35;font-weight:bold"> 试运行阶段 </span>。有任何问题请L站私信 <a href="https://linux.do/u/JackyLiii">@JackyLiii</a>。🪧<a href="/docs/buy-request" style="color: green;">查看求购操作指南👈</a></p>
          <button class="buy-publish-btn" @click="publishBuyRequest">+ 发布求购</button>
        </div>

        <div class="buy-toolbar">
          <select v-model="buyStatusFilter" class="buy-toolbar-select" @change="loadBuyRequests(true)">
            <option value="">全部状态</option>
            <option v-for="status in buyStatusOptions" :key="status.value" :value="status.value">
              {{ status.label }}
            </option>
          </select>
          <input
            v-model="buySearchKeyword"
            type="text"
            class="buy-toolbar-input"
            placeholder="搜索求购标题或内容"
            @keyup.enter="loadBuyRequests(true)"
          />
          <button class="buy-toolbar-btn" @click="loadBuyRequests(true)">搜索</button>
          <button class="buy-toolbar-btn secondary" @click="loadBuyRequests(false)">换一批</button>
        </div>

        <div class="products-header">
          <span class="products-count">
            求购信息 <strong>{{ buyPagination.total }}</strong> 条
          </span>
        </div>

        <div v-if="buyLoading || !buyInitialized" class="products-loading">
          <Skeleton type="card" :count="6" :columns="gridColumns" />
        </div>

        <div v-else-if="buyRequests.length > 0" class="buy-grid">
          <article
            v-for="item in buyRequests"
            :key="item.id"
            class="buy-card"
            @click="goBuyRequestDetail(item.id)"
          >
            <div class="buy-card-head">
              <h3 class="buy-card-title">{{ item.title }}</h3>
              <span :class="['buy-status-pill', `buy-status-${buyStatusClass(item.status)}`]">
                {{ buyStatusText(item.status) }}
              </span>
            </div>
            <p class="buy-card-detail">{{ item.details }}</p>
            <div class="buy-card-meta">
              <span class="buy-price">{{ item.budgetPrice }} LDC</span>
              <span class="buy-meta-sep">·</span>
              <span>{{ item.requesterPublicUsername }}</span>
              <span class="buy-meta-sep">·</span>
              <span>密码 {{ item.requesterPublicPassword }}</span>
            </div>
            <div class="buy-card-footer">
              <span>会话 {{ item.sessionCount || 0 }}</span>
              <span>{{ formatRelativeTime(item.updatedAt || item.createdAt) }}</span>
            </div>
          </article>
        </div>

        <EmptyState
          v-else
          icon="🌱"
          text="暂无求购信息"
          hint="你可以先发布你的需求，等待服务方联系"
        >
          <template #action>
            <button class="btn btn-primary mt-4" @click="publishBuyRequest">
              + 发布求购
            </button>
          </template>
        </EmptyState>

        <div v-if="buyPagination.totalPages > 1" class="buy-pagination">
          <button
            class="buy-page-btn"
            :disabled="buyPagination.page <= 1 || buyLoading"
            @click="goBuyPage(buyPagination.page - 1)"
          >
            上一页
          </button>
          <span class="buy-page-text">第 {{ buyPagination.page }} / {{ buyPagination.totalPages }} 页</span>
          <button
            class="buy-page-btn"
            :disabled="buyPagination.page >= buyPagination.totalPages || buyLoading"
            @click="goBuyPage(buyPagination.page + 1)"
          >
            下一页
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { useUserStore } from '@/stores/user'
import { api } from '@/utils/api'
import { useToast } from '@/composables/useToast'
import { formatRelativeTime } from '@/utils/format'
import ProductCard from '@/components/product/ProductCard.vue'
import ShopCard from '@/components/shop/ShopCard.vue'
import CategoryFilter from '@/components/product/CategoryFilter.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Skeleton from '@/components/common/Skeleton.vue'
import LiquidTabs from '@/components/common/LiquidTabs.vue'

defineOptions({ name: 'Home' })

const router = useRouter()
const route = useRoute()
const shopStore = useShopStore()
const userStore = useUserStore()
const toast = useToast()

const MIGRATION_NOTICE_KEY = 'ld-store-migration-notice-v3'
const showMigrationNotice = ref(false)
const stepCompleted = ref({
  relogin: false,
  config: false,
  relist: false
})

const completedStepsCount = computed(() => Object.values(stepCompleted.value).filter(Boolean).length)
const allStepsCompleted = computed(() => completedStepsCount.value === 3)

function shouldShowMigrationNotice() {
  try {
    return localStorage.getItem(MIGRATION_NOTICE_KEY) !== 'ack'
  } catch {
    return true
  }
}

function ackMigrationNotice() {
  showMigrationNotice.value = false
  if (allStepsCompleted.value) {
    try {
      localStorage.setItem(MIGRATION_NOTICE_KEY, 'ack')
    } catch {
      // ignore localStorage errors
    }
  }
}

function goToRouteWithAuth(path) {
  showMigrationNotice.value = false
  if (!userStore.isLoggedIn) {
    router.push({ name: 'Login', query: { redirect: path } })
    return
  }
  router.push(path)
}

function goToMerchantSettings() {
  goToRouteWithAuth('/user/settings')
}

function goToCdkRecovery() {
  goToRouteWithAuth('/user/products')
}

const sentinel = ref(null)
const sectionTabs = [
  { value: 'products', label: '物品广场', icon: '🛒' },
  { value: 'stores', label: '小店集市', icon: '🏪' },
  { value: 'buy', label: '求购广场', icon: '🌱' }
]
const normalizeSection = (value) => (
  sectionTabs.some(tab => tab.value === value) ? value : 'products'
)
const activeSection = ref(normalizeSection(String(route.query.section || '').trim()))

const sortTabs = [
  { value: 'default', label: '默认' },
  { value: 'newest', label: '最新' },
  { value: 'price_asc', label: '价格↑' },
  { value: 'price_desc', label: '价格↓' },
  { value: 'sales', label: '销量' }
]

const shops = ref([])
const shopsLoading = ref(false)
const shopsLoaded = ref(false)
const shopsTotal = ref(0)

const buyRequests = ref([])
const buyLoading = ref(false)
const buyInitialized = ref(false)
const buyStatusFilter = ref('')
const buySearchKeyword = ref('')
const buyStatusOptions = [
  { value: 'open', label: '开放中' },
  { value: 'negotiating', label: '洽谈中' },
  { value: 'matched', label: '已匹配' }
]
const buyPagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0
})

const stats = ref({
  products: { total: 0, online: 0 },
  orders: { total: 0, today: 0, week: 0 },
  stores: 0
})

let observer = null
const initialLoading = ref(true)
const hasInitialized = ref(false)

let savedScrollPosition = 0
let latestCatalogActionId = 0

const categoryCache = ref(new Map())
const CATEGORY_CACHE_TTL = 5 * 60 * 1000

const getCacheKey = (categoryId, sortKey) => `${categoryId || 'all'}_${sortKey || 'default'}`

function consumeStoreError(fallback = '') {
  return shopStore.consumeLastError?.() || fallback
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : []
}

function tryRestoreFromCache(categoryId, sortKey) {
  const cacheKey = getCacheKey(categoryId, sortKey)
  const cached = categoryCache.value.get(cacheKey)
  const now = Date.now()
  if (cached && Array.isArray(cached.products) && (now - cached.timestamp < CATEGORY_CACHE_TTL)) {
    shopStore.restoreFromCache(categoryId, cached.products, cached.total, cached.hasMore, cached.page, cached.sort)
    initialLoading.value = false
    return true
  }
  return false
}

function saveCache(categoryId, sortKey) {
  const cacheKey = getCacheKey(categoryId, sortKey)
  const productsToCache = toSafeArray(shopStore.products)
  categoryCache.value.set(cacheKey, {
    products: [...productsToCache],
    total: Number.isFinite(Number(shopStore.total)) ? Number(shopStore.total) : productsToCache.length,
    hasMore: !!shopStore.hasMore,
    page: Number.isFinite(Number(shopStore.page)) ? Number(shopStore.page) : 1,
    sort: sortKey,
    timestamp: Date.now()
  })
}

const categories = computed(() => toSafeArray(shopStore.categories))
const products = computed(() => toSafeArray(shopStore.products))
const currentCategory = computed(() => shopStore.currentCategory)
const currentCategoryName = computed(() => shopStore.currentCategoryName)
const currentSort = computed({
  get: () => shopStore.currentSort,
  set: (val) => { shopStore.currentSort = val }
})
const inStockOnly = computed(() => shopStore.inStockOnly)
const loading = computed(() => shopStore.loading)
const hasMore = computed(() => shopStore.hasMore)
const total = computed(() => shopStore.total)

const marketCategories = computed(() =>
  categories.value.filter(c => c?.name !== '小店' && c?.name !== '友情小店')
)
const marketProducts = computed(() =>
  toSafeArray(products.value).filter(p => p?.product_type !== 'store')
)

const gridColumns = ref(2)
function updateGridColumns() {
  const width = window.innerWidth
  if (width >= 1024) gridColumns.value = 4
  else if (width >= 768) gridColumns.value = 3
  else gridColumns.value = 2
}

async function switchSection(section) {
  activeSection.value = section

  const currentSection = String(route.query.section || '').trim()
  if (currentSection !== section) {
    try {
      await router.replace({
        query: {
          ...route.query,
          section
        }
      })
    } catch {
      // ignore duplicated navigation errors
    }
  }

  if (section === 'stores' && !shopsLoaded.value) {
    await loadShops()
  }

  if (section === 'buy' && !buyInitialized.value) {
    await loadBuyRequests(true)
  }

  if (section === 'products') {
    await nextTick()
    setupInfiniteScroll()
  }
}

async function loadShops() {
  shopsLoading.value = true
  try {
    const result = await api.get('/api/shops?pageSize=50')
    if (result.success && result.data?.shops) {
      shops.value = result.data.shops
      shopsTotal.value = result.data.pagination?.total || result.data.shops.length
    } else {
      shops.value = []
      shopsTotal.value = 0
      toast.error(result.error || '加载小店列表失败，请稍后重试')
    }
  } catch (error) {
    console.error('Load shops failed:', error)
    toast.error(error.message || '加载小店列表失败，请稍后重试')
  } finally {
    shopsLoading.value = false
    shopsLoaded.value = true
  }
}

function buyStatusText(status) {
  const map = {
    open: '开放中',
    negotiating: '洽谈中',
    matched: '已匹配',
    closed: '已关闭',
    blocked: '已处理'
  }
  return map[status] || status
}

function buyStatusClass(status) {
  const value = String(status || '').toLowerCase()
  if (['open', 'negotiating', 'matched', 'closed', 'blocked', 'pending_review'].includes(value)) {
    return value
  }
  return 'default'
}

async function loadBuyRequests(resetPage = true) {
  if (resetPage) {
    buyPagination.page = 1
  }

  buyLoading.value = true
  try {
    const params = new URLSearchParams({
      page: String(buyPagination.page),
      pageSize: String(buyPagination.pageSize),
      sort: 'random'
    })
    if (buyStatusFilter.value) params.set('status', buyStatusFilter.value)
    if (buySearchKeyword.value.trim()) params.set('search', buySearchKeyword.value.trim())

    const result = await api.get(`/api/shop/buy-requests?${params.toString()}`)
    if (result.success && result.data) {
      const data = result.data
      buyRequests.value = data.requests || []
      buyPagination.total = data.pagination?.total || 0
      buyPagination.totalPages = data.pagination?.totalPages || 0
      return
    }

    toast.error(result.error || '加载求购信息失败，请稍后重试')
    buyRequests.value = []
    buyPagination.total = 0
    buyPagination.totalPages = 0
  } catch (error) {
    console.error('Load buy requests failed:', error)
    toast.error(error.message || '加载求购信息失败，请稍后重试')
    buyRequests.value = []
    buyPagination.total = 0
    buyPagination.totalPages = 0
  } finally {
    buyLoading.value = false
    buyInitialized.value = true
  }
}

function goBuyPage(page) {
  if (page < 1 || page > buyPagination.totalPages) return
  buyPagination.page = page
  loadBuyRequests(false)
}

function publishBuyRequest() {
  if (!userStore.isLoggedIn) {
    router.push({ name: 'Login', query: { redirect: '/publish?type=buy' } })
    return
  }
  router.push('/publish?type=buy')
}

function goBuyRequestDetail(id) {
  router.push(`/buy-request/${id}`)
}

async function handleCategorySelect(categoryId) {
  const actionId = ++latestCatalogActionId
  const sortKey = shopStore.currentSort || 'default'

  if (tryRestoreFromCache(categoryId, sortKey)) {
    if (actionId !== latestCatalogActionId) return
    await nextTick()
    if (actionId !== latestCatalogActionId) return
    setupInfiniteScroll()
    return
  }

  initialLoading.value = true
  const result = await shopStore.fetchProducts(categoryId, true)
  if (actionId !== latestCatalogActionId) return
  initialLoading.value = false
  if (!result?.success) {
    toast.error(result?.error || consumeStoreError('加载物品失败，请稍后重试'))
    return
  }

  const shouldCache =
    String(shopStore.currentCategory) === String(categoryId) &&
    (shopStore.currentSort || 'default') === sortKey
  if (shouldCache) {
    saveCache(categoryId, sortKey)
  }

  await nextTick()
  if (actionId !== latestCatalogActionId) return
  setupInfiniteScroll()
}

async function handleSortChange(sort) {
  const actionId = ++latestCatalogActionId
  const categoryId = shopStore.currentCategory

  if (tryRestoreFromCache(categoryId, sort)) {
    if (actionId !== latestCatalogActionId) return
    await nextTick()
    if (actionId !== latestCatalogActionId) return
    setupInfiniteScroll()
    return
  }

  initialLoading.value = true
  const result = await shopStore.fetchProducts(categoryId, true, sort)
  if (actionId !== latestCatalogActionId) return
  initialLoading.value = false
  if (!result?.success) {
    toast.error(result?.error || consumeStoreError('加载物品失败，请稍后重试'))
    return
  }

  const shouldCache =
    String(shopStore.currentCategory) === String(categoryId) &&
    (shopStore.currentSort || 'default') === (sort || 'default')
  if (shouldCache) {
    saveCache(categoryId, sort)
  }

  await nextTick()
  if (actionId !== latestCatalogActionId) return
  setupInfiniteScroll()
}

async function handleToggleInStock() {
  categoryCache.value.clear()
  initialLoading.value = true
  const result = await shopStore.toggleInStockOnly()
  initialLoading.value = false
  if (!result?.success) {
    toast.error(result?.error || consumeStoreError('加载物品失败，请稍后重试'))
    return
  }
  await nextTick()
  setupInfiniteScroll()
}

async function recoverProductsIfNeeded() {
  if (loading.value || initialLoading.value) return
  if (marketProducts.value.length > 0) return

  const categoryId = shopStore.currentCategory
  const sortKey = shopStore.currentSort || 'default'
  const restored = tryRestoreFromCache(categoryId, sortKey)
  if (!restored) {
    initialLoading.value = true
    const result = await shopStore.fetchProducts(categoryId, true, sortKey)
    initialLoading.value = false
    if (!result?.success) {
      toast.error(result?.error || consumeStoreError('加载物品失败，请稍后重试'))
      return
    }
    saveCache(categoryId, sortKey)
  }
}

onMounted(async () => {
  if (shouldShowMigrationNotice()) {
    showMigrationNotice.value = true
  }

  updateGridColumns()
  window.addEventListener('resize', updateGridColumns)

  if (hasInitialized.value) {
    initialLoading.value = false
    return
  }

  await shopStore.fetchCategories()
  const categoryError = consumeStoreError('')
  if (categoryError) {
    toast.warning(categoryError)
  }

  const productResult = await shopStore.fetchProducts('', true)
  if (!productResult?.success) {
    toast.error(productResult?.error || consumeStoreError('加载物品失败，请稍后重试'))
  }
  saveCache(shopStore.currentCategory, shopStore.currentSort)

  initialLoading.value = false
  hasInitialized.value = true

  const statsData = await shopStore.fetchPublicStats()
  if (statsData) {
    stats.value = statsData
  } else {
    const statsError = consumeStoreError('')
    if (statsError) {
      toast.warning(statsError)
    }
  }

  if (activeSection.value === 'stores') {
    await loadShops()
  } else if (activeSection.value === 'buy') {
    await loadBuyRequests(true)
  }

  if (activeSection.value === 'products') {
    setupInfiniteScroll()
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateGridColumns)
  if (observer) observer.disconnect()
})

onActivated(async () => {
  if (savedScrollPosition > 0) {
    await nextTick()
    window.scrollTo(0, savedScrollPosition)
  }

  if (activeSection.value === 'products') {
    await recoverProductsIfNeeded()
    await nextTick()
    setupInfiniteScroll()
  } else if (activeSection.value === 'buy' && !buyInitialized.value) {
    await loadBuyRequests(true)
  }
})

onDeactivated(() => {
  savedScrollPosition = window.scrollY
  if (observer) observer.disconnect()
})

watch(hasMore, (newVal) => {
  if (newVal && activeSection.value === 'products') {
    setupInfiniteScroll()
  }
})

function setupInfiniteScroll() {
  if (observer) observer.disconnect()
  if (!sentinel.value || !hasMore.value) return

  observer = new IntersectionObserver(
    async (entries) => {
      if (entries[0].isIntersecting && !loading.value && hasMore.value) {
        const result = await shopStore.loadMore()
        if (result && result.success === false && !result.cancelled) {
          toast.error(result.error || consumeStoreError('加载更多失败，请稍后重试'))
        }
      }
    },
    { rootMargin: '100px' }
  )

  observer.observe(sentinel.value)
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  padding-bottom: 80px;
}

/* ========== 迁移提醒弹窗 ========== */
.migration-notice-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.migration-notice-card {
  width: 100%;
  max-width: 640px;
  background: #fff8f2;
  border: 2px solid #f59e0b;
  border-radius: 18px;
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.25);
  padding: 20px;
}

.notice-title {
  margin: 0 0 10px;
  font-size: 22px;
  font-weight: 700;
  color: #9a3412;
}

.notice-desc {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.7;
  color: #7c2d12;
}

.notice-desc.warning {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  padding: 10px 12px;
  font-weight: 600;
  color: #92400e;
}

.notice-steps {
  margin: 14px 0 0;
  padding-left: 0;
  list-style: none;
  display: grid;
  gap: 10px;
  font-size: 14px;
  color: #7c2d12;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.step-item:hover {
  border-color: #f59e0b;
  background: #fffbeb;
}

.step-item input[type="checkbox"] {
  width: 20px;
  height: 20px;
  margin-top: 2px;
  cursor: pointer;
  accent-color: #16a34a;
  flex-shrink: 0;
}

.step-item .step-text {
  flex: 1;
  line-height: 1.5;
}

.step-item.completed {
  background: #f0fdf4;
  border-color: #86efac;
}

.step-item.completed .step-text {
  text-decoration: line-through;
  color: #6b7280;
}

.step-note {
  margin: 8px 0 0;
  font-size: 13px;
  color: #9a3412;
  font-style: italic;
}

.notice-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}

.notice-btn {
  border: none;
  border-radius: 10px;
  padding: 11px 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.notice-btn.primary {
  background: #15803d;
  color: #fff;
}

.notice-btn.primary:hover {
  filter: brightness(0.95);
}

.notice-btn.danger {
  background: #b91c1c;
  color: #fff;
}

.notice-btn.danger:hover {
  filter: brightness(0.95);
}

.notice-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed #f59e0b;
}

.step-progress {
  font-size: 14px;
  color: #9a3412;
  font-weight: 500;
}

.notice-btn.confirm {
  background: #d97706;
  color: #fff;
  padding: 10px 24px;
}

.notice-btn.confirm:hover {
  filter: brightness(0.95);
}

.notice-btn.confirm-done {
  background: #16a34a;
  color: #fff;
  padding: 10px 24px;
}

.notice-btn.confirm-done:hover {
  filter: brightness(0.95);
}

.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}

/* Banner - 液态玻璃效果 */
.home-banner {
  position: relative;
  background: var(--glass-bg-light);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-radius: 24px;
  padding: 28px 24px;
  margin-bottom: 24px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  border: 1px solid var(--glass-border-light);
  box-shadow: 
    0 8px 32px var(--glass-shadow),
    0 2px 8px var(--glass-shadow-light),
    inset 0 1px 0 var(--glass-shine-strong);
  overflow: hidden;
}

/* Banner 内部光泽 */
.home-banner::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(
    180deg,
    var(--glass-shine) 0%,
    rgba(255, 255, 255, 0.05) 60%,
    transparent 100%
  );
  border-radius: 24px 24px 50% 50%;
  pointer-events: none;
}

.banner-content {
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.banner-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
}

.banner-subtitle {
  font-size: 14px;
  color: var(--text-tertiary);
  margin: 0;
}

.highlight-yellow {
  color: var(--color-warning);
  font-weight: 700;
}

.link-credit {
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.link-credit:hover {
  opacity: 0.8;
}

.highlight-red {
  color: var(--color-danger);
  font-weight: 700;
}

.link-linuxdo {
  color: var(--text-primary);
  font-weight: 700;
  text-decoration: none;
  transition: color 0.2s ease;
}

.link-linuxdo:hover {
  color: var(--color-primary);
}

.banner-stats {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: flex-end;
  position: relative;
  z-index: 1;
}

.stat-group {
  display: flex;
  gap: 16px;
}

.stat-divider {
  width: 1px;
  height: 36px;
  background: var(--border-light);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 50px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

/* 板块切换 */
.section-tabs-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.tab-text {
  font-weight: 600;
}

.tab-count {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
}

.section-tab.active .tab-count {
  background: #b5a898;
  color: white;
}

/* 内容区域 */
.section-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 分类筛选 */
.filter-section {
  margin-bottom: 12px;
}

/* 排序和筛选选项 */
.sort-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.sort-options {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.sort-btn {
  padding: 4px 10px;
  font-size: 12px;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.sort-btn:hover {
  color: var(--text-secondary);
  background: var(--bg-tertiary);
}

.sort-btn.active {
  color: var(--color-primary);
  background: var(--color-primary-bg);
  font-weight: 500;
}

/* 库存筛选 */
.stock-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}

.stock-filter .checkbox {
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--border-color);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  transition: all 0.2s ease;
}

.stock-filter .checkbox.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.stock-filter .checkmark {
  color: white;
  font-size: 10px;
  font-weight: bold;
}

.stock-filter .filter-label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.stock-filter:hover .checkbox {
  border-color: var(--color-primary);
}

/* 物品头部 */
.products-header {
  margin-bottom: 16px;
}

.products-count {
  font-size: 13px;
  color: var(--text-tertiary);
}

.products-count strong {
  color: var(--text-primary);
}

.products-count .filter-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  font-size: 11px;
  color: var(--color-success);
  background: var(--color-success-bg);
  border-radius: 10px;
}

/* 小店集市头部 */
.stores-header {
  margin-bottom: 20px;
  padding: 16px 20px;
  background: var(--color-success-bg);
  border-radius: 14px;
}

.stores-desc {
  margin: 0;
  font-size: 14px;
  color: var(--color-success);
}

.stores-grid {
  /* 小店网格使用默认样式 */
  grid-gap: 16px;
}

/* 物品网格 */
.buy-header {
  margin-bottom: 14px;
  padding: 16px 20px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.buy-desc {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.buy-publish-btn {
  border: none;
  border-radius: 10px;
  background: var(--color-success);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 12px;
  cursor: pointer;
  white-space: nowrap;
}

.buy-toolbar {
  display: grid;
  grid-template-columns: 180px 1fr 96px 96px;
  gap: 10px;
  margin-bottom: 12px;
}

.buy-toolbar-select,
.buy-toolbar-input {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  padding: 10px 12px;
}

.buy-toolbar-btn {
  border: none;
  border-radius: 10px;
  background: var(--color-success);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.buy-toolbar-btn.secondary {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.buy-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.buy-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  height: 100%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.buy-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.buy-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.buy-card-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 15px;
  line-height: 1.4;
}

.buy-status-pill {
  border-radius: 999px;
  font-size: 11px;
  padding: 3px 8px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  white-space: nowrap;
  border: 1px solid var(--border-light);
}

.buy-status-open {
  color: #0f6b3a;
  background: #e9f9ef;
  border-color: #bdebcf;
}

.buy-status-negotiating {
  color: #8a4b08;
  background: #fff4e6;
  border-color: #ffd7ad;
}

.buy-status-matched {
  color: #1249a3;
  background: #ebf3ff;
  border-color: #bfd8ff;
}

.buy-status-closed,
.buy-status-blocked {
  color: #6b7280;
  background: #f3f4f6;
  border-color: #d1d5db;
}

.buy-status-pending_review {
  color: #7a2e0e;
  background: #fff1ec;
  border-color: #ffc9b5;
}

.buy-card-detail {
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.55;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
}

.buy-card-meta {
  margin-top: auto;
  padding-top: 10px;
  color: var(--text-tertiary);
  font-size: 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.buy-price {
  color: var(--color-warning);
  font-weight: 600;
}

.buy-meta-sep {
  opacity: 0.5;
}

.buy-card-footer {
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-tertiary);
  font-size: 12px;
}

.buy-pagination {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.buy-page-btn {
  border: 1px solid var(--border-color);
  border-radius: 9px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  padding: 6px 10px;
  cursor: pointer;
}

.buy-page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.buy-page-text {
  color: var(--text-tertiary);
  font-size: 13px;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (min-width: 768px) {
  .products-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .buy-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .products-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .buy-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* 加载更多 */
.load-more,
.loaded-all {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-medium);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.load-hint {
  opacity: 0.6;
}

.products-loading {
  padding: 20px 0;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .home-banner {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .banner-stats {
    justify-content: center;
    border-top: 1px solid var(--border-light);
    padding-top: 16px;
    gap: 12px;
  }
  
  .stat-group {
    gap: 12px;
  }
  
  .stat-divider {
    height: 28px;
  }
  
  .stat-value {
    font-size: 18px;
  }
  
  .stat-label {
    font-size: 10px;
  }
  
  .section-tabs {
    gap: 10px;
  }
  
  .section-tab {
    padding: 14px 16px;
    flex-direction: column;
    gap: 4px;
  }
  
  .tab-icon {
    font-size: 24px;
  }
  
  .tab-text {
    font-size: 13px;
  }
}

@media (max-width: 640px) {
  .page-container {
    padding: 12px;
  }

  .home-banner {
    padding: 20px 16px;
  }

  .banner-title {
    font-size: 24px;
  }
  
  .banner-stats {
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .stat-group {
    gap: 8px;
  }
  
  .stat-item {
    min-width: 42px;
  }
  
  .stat-value {
    font-size: 16px;
  }
  
  .section-tab {
    padding: 12px 10px;
  }
  
  .tab-count {
    font-size: 11px;
    padding: 2px 6px;
  }
  
  .stores-header {
    padding: 12px 16px;
  }
  
  .stores-desc {
    font-size: 13px;
  }

  .buy-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .buy-toolbar {
    grid-template-columns: 1fr;
  }
}
</style>
