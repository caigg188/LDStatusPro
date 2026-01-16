<template>
  <div class="home-page">
    <div class="page-container">
      <!-- Banner -->
      <div class="home-banner">
        <div class="banner-content">
          <h1 class="banner-title">🍔 LD士多</h1>
          <p class="banner-subtitle"><a href="https://linux.do" target="_blank" class="link-linuxdo">LinuxDo论坛 </a>虚拟物品和服务<span class="highlight-red"> 兑换中心 </span></p>
          <p class="banner-subtitle">快使用你的<a href="https://credit.linux.do/" target="_blank" class="highlight-yellow link-credit"> 社区积分 </a>兑换物品吧</p>
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
        
        <!-- 商品统计 -->
        <div class="products-header">
          <span class="products-count">
            {{ currentCategoryName }} 共 <strong>{{ total }}</strong> 件商品
          </span>
        </div>
        
        <!-- 商品列表 -->
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
          <div v-else class="loaded-all">✅ 已加载全部</div>
        </div>
        
        <!-- 空状态 -->
        <EmptyState
          v-else
          icon="🛒"
          text="暂无商品"
          hint="快来发布第一个商品吧~"
        >
          <template #action>
            <router-link to="/publish" class="btn btn-primary mt-4">
              ➕ 发布商品
            </router-link>
          </template>
        </EmptyState>
      </div>
      
      <!-- 小店集市 -->
      <div v-show="activeSection === 'stores'" class="section-content">
        <div class="stores-header">
          <p class="stores-desc">🏪 汇集各路大佬的友情小店，欢迎入驻</p>
        </div>
        
        <!-- 小店统计 -->
        <div class="products-header">
          <span class="products-count">
            全部 共 <strong>{{ shopsTotal }}</strong> 个小店
          </span>
        </div>
        
        <div v-if="shopsLoading" class="products-loading">
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
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch, nextTick } from 'vue'
import { useShopStore } from '@/stores/shop'
import { api } from '@/utils/api'
import ProductCard from '@/components/product/ProductCard.vue'
import ShopCard from '@/components/shop/ShopCard.vue'
import CategoryFilter from '@/components/product/CategoryFilter.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Skeleton from '@/components/common/Skeleton.vue'
import LiquidTabs from '@/components/common/LiquidTabs.vue'

// 组件名称（用于 keep-alive 缓存）
defineOptions({ name: 'Home' })

const shopStore = useShopStore()

// 状态
const sentinel = ref(null)
const activeSection = ref('products')
const sectionTabs = [
  { value: 'products', label: '物品广场', icon: '🛒' },
  { value: 'stores', label: '小店集市', icon: '🏬' }
]
const shops = ref([])  // 独立小店列表
const shopsLoading = ref(false)
const shopsTotal = ref(0)
const stats = ref({
  products: { total: 0, online: 0 },
  orders: { total: 0, today: 0, week: 0 },
  stores: 0
})
let observer = null

// 首次加载状态（区别于加载更多的 loading）
const initialLoading = ref(true)
const hasInitialized = ref(false)

// 滚动位置保存
let savedScrollPosition = 0

// 分类商品缓存 { categoryId: { products, total, hasMore, page, timestamp } }
const categoryCache = ref(new Map())
const CATEGORY_CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

// 计算属性
const categories = computed(() => shopStore.categories)
const products = computed(() => shopStore.products)
const currentCategory = computed(() => shopStore.currentCategory)
const currentCategoryName = computed(() => shopStore.currentCategoryName)
const loading = computed(() => shopStore.loading)
const hasMore = computed(() => shopStore.hasMore)
const total = computed(() => shopStore.total)

// 物品广场的分类（排除小店）
const marketCategories = computed(() => 
  categories.value.filter(c => c.name !== '小店' && c.name !== '友情小店')
)

// 物品广场的商品（排除小店类型）
const marketProducts = computed(() => 
  products.value.filter(p => p.product_type !== 'store')
)

// 响应式网格列数
const gridColumns = ref(2)
function updateGridColumns() {
  const width = window.innerWidth
  if (width >= 1024) gridColumns.value = 4
  else if (width >= 768) gridColumns.value = 3
  else gridColumns.value = 2
}

// 切换板块
async function switchSection(section) {
  activeSection.value = section
  
  if (section === 'stores' && shops.value.length === 0) {
    await loadShops()
  }
  
  if (section === 'products') {
    await nextTick()
    setupInfiniteScroll()
  }
}

// 加载独立小店列表（使用新的小店 API）
async function loadShops() {
  shopsLoading.value = true
  try {
    const result = await api.get('/api/shops?pageSize=50')
    if (result.success && result.data?.shops) {
      shops.value = result.data.shops
      shopsTotal.value = result.data.pagination?.total || result.data.shops.length
    }
  } catch (e) {
    console.error('Load shops failed:', e)
  } finally {
    shopsLoading.value = false
  }
}

// 分类选择
async function handleCategorySelect(categoryId) {
  const cacheKey = categoryId || 'all'
  const cached = categoryCache.value.get(cacheKey)
  const now = Date.now()
  
  // 检查缓存是否有效
  if (cached && (now - cached.timestamp < CATEGORY_CACHE_TTL)) {
    // 使用缓存数据，直接恢复状态
    shopStore.restoreFromCache(categoryId, cached.products, cached.total, cached.hasMore, cached.page)
    initialLoading.value = false
    // 重新设置无限滚动（关键！）
    await nextTick()
    setupInfiniteScroll()
    return
  }
  
  // 无缓存或过期，请求新数据
  initialLoading.value = true
  await shopStore.fetchProducts(categoryId, true)
  initialLoading.value = false
  
  // 存入缓存
  categoryCache.value.set(cacheKey, {
    products: [...shopStore.products],
    total: shopStore.total,
    hasMore: shopStore.hasMore,
    page: shopStore.page,
    timestamp: now
  })
  
  // 设置无限滚动
  await nextTick()
  setupInfiniteScroll()
}

// 初始化
onMounted(async () => {
  updateGridColumns()
  window.addEventListener('resize', updateGridColumns)
  
  // 如果已经初始化过（keep-alive 缓存），不重新加载
  if (hasInitialized.value) {
    initialLoading.value = false
    return
  }
  
  // 获取分类和商品
  await shopStore.fetchCategories()
  await shopStore.fetchProducts('', true)
  
  // 加载完成
  initialLoading.value = false
  hasInitialized.value = true
  
  // 获取统计数据（已包含独立小店数量）
  const statsData = await shopStore.fetchPublicStats()
  if (statsData) {
    stats.value = statsData
  }
  
  // 设置无限滚动
  setupInfiniteScroll()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateGridColumns)
  if (observer) observer.disconnect()
})

// keep-alive 激活时恢复滚动位置
onActivated(() => {
  if (savedScrollPosition > 0) {
    nextTick(() => {
      window.scrollTo(0, savedScrollPosition)
    })
  }
  // 重新设置无限滚动
  if (activeSection.value === 'products') {
    setupInfiniteScroll()
  }
})

// keep-alive 停用时保存滚动位置
onDeactivated(() => {
  savedScrollPosition = window.scrollY
  if (observer) observer.disconnect()
})

// 监听 hasMore 变化重新设置观察器
watch(hasMore, (newVal) => {
  if (newVal && activeSection.value === 'products') {
    setupInfiniteScroll()
  }
})

// 无限滚动
function setupInfiniteScroll() {
  if (observer) observer.disconnect()
  
  if (!sentinel.value || !hasMore.value) return
  
  observer = new IntersectionObserver(
    async (entries) => {
      if (entries[0].isIntersecting && !loading.value && hasMore.value) {
        await shopStore.loadMore()
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

.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}

/* Banner - 液态玻璃效果 */
.home-banner {
  position: relative;
  background: rgba(255, 255, 255, 0.7);
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
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.06),
    0 2px 8px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
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
    rgba(255, 255, 255, 0.5) 0%,
    rgba(255, 255, 255, 0.1) 60%,
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
  color: #3d3d3d;
  margin: 0 0 4px;
}

.banner-subtitle {
  font-size: 14px;
  color: #999;
  margin: 0;
}

.highlight-yellow {
  color: #c9a857;
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
  color: #c17c74;
  font-weight: 700;
}

.link-linuxdo {
  color: #3d3d3d;
  font-weight: 700;
  text-decoration: none;
  transition: color 0.2s ease;
}

.link-linuxdo:hover {
  color: #b5a898;
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
  background: rgba(0, 0, 0, 0.08);
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
  color: #b5a898;
  line-height: 1.2;
}

.stat-label {
  font-size: 11px;
  color: #999;
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
  background: #f0ede9;
  color: #999;
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
  margin-bottom: 16px;
}

/* 商品头部 */
.products-header {
  margin-bottom: 16px;
}

.products-count {
  font-size: 13px;
  color: #999;
}

.products-count strong {
  color: #3d3d3d;
}

/* 小店集市头部 */
.stores-header {
  margin-bottom: 20px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #e8f5e8 0%, #d1fae5 100%);
  border-radius: 14px;
}

.stores-desc {
  margin: 0;
  font-size: 14px;
  color: #166534;
}

.stores-grid {
  /* 小店网格使用默认样式 */
  grid-gap: 16px;
}

/* 商品网格 */
.products-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (min-width: 768px) {
  .products-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .products-grid {
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
  color: #999;
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
  border: 2px solid rgba(181, 168, 152, 0.3);
  border-top-color: #b5a898;
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
    border-top: 1px solid rgba(0, 0, 0, 0.05);
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
}
</style>
