<template>
  <div class="search-page">
    <div class="page-container">
      <!-- 搜索框 -->
      <div class="search-header">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            ref="searchInput"
            v-model="keyword"
            type="text"
            class="search-input"
            placeholder="搜索物品..."
            @input="handleSearch"
            @keyup.enter="doSearch"
          />
          <button
            v-if="keyword"
            class="clear-btn"
            @click="clearSearch"
          >
            ✕
          </button>
        </div>
      </div>
      
      <!-- 搜索历史 -->
      <div v-if="!keyword && searchHistory.length > 0" class="history-section">
        <div class="section-header">
          <h3 class="section-title">搜索历史</h3>
          <button class="clear-history" @click="clearHistory">清空</button>
        </div>
        <div class="history-list">
          <button
            v-for="item in searchHistory"
            :key="item"
            class="history-item"
            @click="searchFromHistory(item)"
          >
            {{ item }}
          </button>
        </div>
      </div>
      
      <!-- 热门搜索 -->
      <div v-if="!keyword" class="hot-section">
        <h3 class="section-title">热门搜索</h3>
        <div class="hot-list">
          <button
            v-for="(item, index) in hotKeywords"
            :key="item"
            :class="['hot-item', { top: index < 3 }]"
            @click="searchFromHistory(item)"
          >
            <span class="hot-rank">{{ index + 1 }}</span>
            <span class="hot-text">{{ item }}</span>
          </button>
        </div>
      </div>
      
      <!-- 搜索结果 -->
      <div v-if="keyword" class="results-section">
        <!-- 排序和筛选 -->
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
              <span v-if="inStockOnly" class="checkmark">✓</span>
            </span>
            <span class="filter-label">只看有货</span>
          </label>
        </div>

        <!-- 加载中 -->
        <div v-if="searching" class="loading-state">
          <Skeleton type="product" :count="3" />
        </div>
        
        <!-- 空结果 -->
        <EmptyState
          v-else-if="results.length === 0 && hasSearched"
          icon="🔍"
          title="未找到相关物品"
          :description="`没有找到与「${keyword}」相关的物品`"
        />
        
        <!-- 结果列表 -->
        <div v-else-if="results.length > 0" class="results-list">
          <div class="results-header">
            <span class="results-count">
              找到 {{ results.length }} 个物品
              <span v-if="inStockOnly" class="filter-tag">有库存</span>
            </span>
          </div>
          <div class="products-grid">
            <ProductCard
              v-for="product in results"
              :key="product.id"
              :product="product"
              @click="viewProduct(product)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { storage } from '@/utils/storage'
import ProductCard from '@/components/product/ProductCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Skeleton from '@/components/common/Skeleton.vue'

const router = useRouter()
const route = useRoute()
const shopStore = useShopStore()

const searchInput = ref(null)
const keyword = ref('')
const searching = ref(false)
const hasSearched = ref(false)
const results = ref([])
const searchHistory = ref([])
const currentSort = ref('default')
const inStockOnly = ref(false)

const sortTabs = [
  { value: 'default', label: '默认' },
  { value: 'price_asc', label: '价格↑' },
  { value: 'price_desc', label: '价格↓' }
]

// 热门搜索（可从后端获取）
const hotKeywords = ref([
  'ChatGPT',
  'Claude',
  'VPS',
  '小鸡',
  'API',
  '存储',
  '代理',
  '咨询'
])

// 防抖定时器
let searchTimer = null
let latestSearchRequestId = 0

// 加载搜索历史
function loadHistory() {
  const history = storage.get('search_history')
  if (Array.isArray(history)) {
    searchHistory.value = history.slice(0, 10)
  }
}

// 保存搜索历史
function saveHistory(keyword) {
  const history = searchHistory.value.filter(item => item !== keyword)
  history.unshift(keyword)
  searchHistory.value = history.slice(0, 10)
  storage.set('search_history', searchHistory.value)
}

// 清空历史
function clearHistory() {
  searchHistory.value = []
  storage.remove('search_history')
}

// 搜索
async function doSearch(options = {}) {
  const trimmedKeyword = keyword.value.trim()
  if (!trimmedKeyword) return

  if (options.saveHistory !== false) {
    // 保存历史
    saveHistory(trimmedKeyword)
  }

  const requestId = ++latestSearchRequestId
  searching.value = true
  hasSearched.value = true
  
  try {
    const searchResults = await shopStore.searchProducts(trimmedKeyword, {
      sort: currentSort.value,
      inStockOnly: inStockOnly.value
    })
    if (requestId !== latestSearchRequestId) return
    results.value = searchResults
  } catch (error) {
    if (requestId !== latestSearchRequestId) return
    console.error('Search error:', error)
    results.value = []
  } finally {
    if (requestId === latestSearchRequestId) {
      searching.value = false
    }
  }
}

// 防抖搜索
function handleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (keyword.value.trim()) {
      doSearch({ saveHistory: false })
    } else {
      latestSearchRequestId++
      searching.value = false
      results.value = []
      hasSearched.value = false
    }
  }, 300)
}

// 从历史搜索
function searchFromHistory(item) {
  keyword.value = item
  doSearch()
}

// 清空搜索
function clearSearch() {
  latestSearchRequestId++
  searching.value = false
  keyword.value = ''
  results.value = []
  hasSearched.value = false
  searchInput.value?.focus()
}

function handleSortChange(sort) {
  if (currentSort.value === sort) return
  currentSort.value = sort
  if (keyword.value.trim()) {
    doSearch({ saveHistory: false })
  }
}

function handleToggleInStock() {
  inStockOnly.value = !inStockOnly.value
  if (keyword.value.trim()) {
    doSearch({ saveHistory: false })
  }
}

// 查看物品
function viewProduct(product) {
  router.push(`/product/${product.id}`)
}

// 监听路由查询参数
watch(() => route.query.q, (q) => {
  if (q) {
    keyword.value = q
    doSearch()
  }
}, { immediate: true })

onMounted(() => {
  loadHistory()
  searchInput.value?.focus()
})

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  latestSearchRequestId++
})
</script>

<style scoped>
.search-page {
  min-height: 100vh;
  padding-bottom: 80px;
  background: var(--bg-primary);
}

.page-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 16px;
}

/* 搜索框 */
.search-header {
  margin-bottom: 24px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: var(--bg-card);
  border-radius: 28px;
  box-shadow: var(--shadow-sm);
}

.search-icon {
  font-size: 18px;
  opacity: 0.6;
}

.search-input {
  flex: 1;
  border: none;
  background: none;
  font-size: 16px;
  color: var(--text-primary);
  outline: none;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.clear-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border: none;
  border-radius: 50%;
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: var(--bg-tertiary);
}

/* 搜索历史 */
.history-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.clear-history {
  padding: 4px 8px;
  background: none;
  border: none;
  font-size: 13px;
  color: var(--text-tertiary);
  cursor: pointer;
}

.clear-history:hover {
  color: var(--text-secondary);
}

.history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.history-item {
  padding: 8px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 20px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.history-item:hover {
  background: var(--bg-secondary);
  border-color: var(--border-default);
}

/* 热门搜索 */
.hot-section {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 20px;
  box-shadow: var(--shadow-sm);
}

.hot-section .section-title {
  margin-bottom: 16px;
}

.hot-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hot-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: none;
  border: none;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}

.hot-item:hover {
  background: var(--bg-secondary);
}

.hot-rank {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.hot-item.top .hot-rank {
  background: #cfa76f;
  color: white;
}

.hot-text {
  font-size: 14px;
  color: var(--text-primary);
}

/* 搜索结果 */
.results-section {
  min-height: 200px;
}

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
  gap: 6px;
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

.loading-state {
  padding-top: 20px;
}

.results-header {
  margin-bottom: 16px;
}

.results-count {
  font-size: 14px;
  color: var(--text-tertiary);
}

.results-count .filter-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  font-size: 11px;
  color: var(--color-success);
  background: var(--color-success-bg);
  border-radius: 10px;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

@media (max-width: 640px) {
  .sort-section {
    align-items: flex-start;
  }

  .products-grid {
    grid-template-columns: 1fr;
  }
}
</style>
