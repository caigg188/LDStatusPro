<template>
  <div class="search-page">
    <div class="search-shell">
      <div class="search-header-area">
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
      </div>

      <!-- 搜索结果 -->
      <div v-if="keyword" class="results-section">
        <div v-if="searchError" class="feedback-card error-card">
          <div>
            <strong>搜索失败</strong>
            <p>{{ searchError }}</p>
          </div>
          <button class="feedback-btn" @click="retrySearch">重试</button>
        </div>

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
          <div class="catalog-filters">
            <div class="price-filter">
              <input
                v-model="priceMinInput"
                type="number"
                min="0"
                step="0.01"
                class="price-filter-input"
                placeholder="最低折后价"
                @keyup.enter="applyPriceFilter"
              />
              <span class="price-filter-separator">-</span>
              <input
                v-model="priceMaxInput"
                type="number"
                min="0"
                step="0.01"
                class="price-filter-input"
                placeholder="最高折后价"
                @keyup.enter="applyPriceFilter"
              />
              <button class="price-filter-btn" @click="applyPriceFilter">筛选</button>
              <button
                v-if="hasDraftPriceFilter || hasActivePriceFilter"
                class="price-filter-btn secondary"
                @click="clearPriceFilter"
              >
                清空
              </button>
            </div>
            <label class="stock-filter" @click="handleToggleInStock">
              <span class="checkbox" :class="{ checked: inStockOnly }">
                <span v-if="inStockOnly" class="checkmark">✓</span>
              </span>
              <span class="filter-label">只看有货</span>
            </label>
          </div>
        </div>

        <div v-if="searching" class="loading-state">
          <Skeleton type="card" :count="8" :columns="gridColumns" />
        </div>

        <EmptyState
          v-else-if="results.length === 0 && hasSearched"
          icon="🔍"
          text="未找到相关物品"
          :hint="emptyHint"
        >
          <template #action>
            <div class="empty-actions">
              <button v-if="hasActiveFilters" class="feedback-btn" @click="clearAllFilters">清空筛选</button>
              <button class="feedback-btn secondary" @click="fillSuggestedKeyword">试试热门搜索</button>
            </div>
          </template>
        </EmptyState>

        <div v-else-if="results.length > 0" class="results-list">
          <div class="results-header">
            <span class="results-count">
              找到 {{ totalResults }} 个物品
              <span v-if="inStockOnly" class="filter-tag">有库存</span>
              <span v-if="sortLabel" class="filter-tag">{{ sortLabel }}</span>
              <span v-if="hasActivePriceFilter" class="filter-tag price-tag">{{ activePriceFilterLabel }}</span>
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
          <div v-if="hasMore" class="load-more">
            <button class="load-more-btn" @click="loadMore" :disabled="loadingMore">
              {{ loadingMore ? '加载中...' : '加载更多' }}
            </button>
          </div>
          <div v-else-if="results.length > 0" class="loaded-all">✨ 已加载全部</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { useToast } from '@/composables/useToast'
import { storage } from '@/utils/storage'
import { DEFAULT_SEARCH_KEYWORDS, loadSearchHistory, saveSearchHistory, clearSearchHistory as clearStoredSearchHistory } from '@/utils/search'
import ProductCard from '@/components/product/ProductCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Skeleton from '@/components/common/Skeleton.vue'

const router = useRouter()
const route = useRoute()
const shopStore = useShopStore()
const toast = useToast()

const searchInput = ref(null)
const keyword = ref('')
const searching = ref(false)
const hasSearched = ref(false)
const results = ref([])
const totalResults = ref(0)
const hasMore = ref(false)
const loadingMore = ref(false)
const searchHistory = ref([])
const currentSort = ref('default')
const priceMinInput = ref('')
const priceMaxInput = ref('')
const appliedPriceMin = ref(null)
const appliedPriceMax = ref(null)
const searchError = ref('')
const page = ref(1)
const pageSize = 20
const inStockOnly = computed(() => shopStore.inStockOnly)

const sortTabs = [
  { value: 'default', label: '默认' },
  { value: 'newest', label: '最新' },
  { value: 'price_asc', label: '价格↑' },
  { value: 'price_desc', label: '价格↓' },
  { value: 'sales', label: '销量' }
]

const hotKeywords = DEFAULT_SEARCH_KEYWORDS

const sortLabel = computed(() => {
  const active = sortTabs.find(item => item.value === currentSort.value)
  return active && active.value !== 'default' ? active.label : ''
})

const hasActivePriceFilter = computed(() => appliedPriceMin.value !== null || appliedPriceMax.value !== null)
const hasDraftPriceFilter = computed(() => (
  normalizePriceFilterInput(priceMinInput.value) !== null || normalizePriceFilterInput(priceMaxInput.value) !== null
))
const hasActiveFilters = computed(() => inStockOnly.value || hasActivePriceFilter.value || currentSort.value !== 'default')
const activePriceFilterLabel = computed(() => {
  if (appliedPriceMin.value !== null && appliedPriceMax.value !== null) {
    return `价格 ${appliedPriceMin.value} - ${appliedPriceMax.value} LDC`
  }
  if (appliedPriceMin.value !== null) return `价格 ≥ ${appliedPriceMin.value} LDC`
  if (appliedPriceMax.value !== null) return `价格 ≤ ${appliedPriceMax.value} LDC`
  return ''
})
const emptyHint = computed(() => {
  const currentKeyword = keyword.value.trim()
  if (!currentKeyword) return '换个关键词试试'
  const summaries = [`没有找到与“${currentKeyword}”相关的物品`]
  if (hasActivePriceFilter.value) {
    summaries.push(activePriceFilterLabel.value)
  }
  if (inStockOnly.value) {
    summaries.push('当前仅显示有库存物品')
  }
  return summaries.join('，')
})
const gridColumns = ref(2)

let searchTimer = null
let latestSearchRequestId = 0

function formatPriceFilterInput(value) {
  return value === null || value === undefined || value === '' ? '' : String(value)
}

function normalizePriceFilterInput(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const parsed = Number.parseFloat(text)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.round(parsed * 100) / 100)
}

function normalizePriceFilterRange(priceMin, priceMax) {
  let normalizedMin = normalizePriceFilterInput(priceMin)
  let normalizedMax = normalizePriceFilterInput(priceMax)

  if (normalizedMin !== null && normalizedMax !== null && normalizedMin > normalizedMax) {
    ;[normalizedMin, normalizedMax] = [normalizedMax, normalizedMin]
  }

  return {
    priceMin: normalizedMin,
    priceMax: normalizedMax
  }
}

function syncPriceFilterInputs(priceMin, priceMax) {
  priceMinInput.value = formatPriceFilterInput(priceMin)
  priceMaxInput.value = formatPriceFilterInput(priceMax)
}

function updateGridColumns() {
  const width = window.innerWidth
  if (width >= 1024) gridColumns.value = 4
  else if (width >= 768) gridColumns.value = 3
  else gridColumns.value = 2
}

function loadHistory() {
  searchHistory.value = loadSearchHistory(storage)
}

function saveHistory(searchKeyword) {
  searchHistory.value = saveSearchHistory(storage, searchKeyword)
}

function clearHistory() {
  searchHistory.value = []
  clearStoredSearchHistory(storage)
}

function resetSearchState() {
  latestSearchRequestId++
  searching.value = false
  loadingMore.value = false
  results.value = []
  totalResults.value = 0
  hasMore.value = false
  searchError.value = ''
  hasSearched.value = false
  page.value = 1
}

async function doSearch(options = {}) {
  const trimmedKeyword = keyword.value.trim()
  if (!trimmedKeyword) {
    resetSearchState()
    return
  }

  const requestPage = Number.isFinite(Number(options.page)) ? Number(options.page) : 1
  const append = options.append === true && requestPage > 1

  if (options.saveHistory !== false && !append) {
    saveHistory(trimmedKeyword)
  }

  const requestId = ++latestSearchRequestId
  searchError.value = ''
  hasSearched.value = true

  if (append) {
    loadingMore.value = true
  } else {
    searching.value = true
    page.value = 1
  }

  try {
    const result = await fetchSearchResults(trimmedKeyword, requestPage)
    if (requestId !== latestSearchRequestId) return

    const nextResults = Array.isArray(result.products) ? result.products : []
    results.value = append ? [...results.value, ...nextResults] : nextResults
    totalResults.value = Number(result.total || nextResults.length)
    hasMore.value = Boolean(result.hasMore)
    page.value = requestPage

    const latestError = shopStore.consumeLastError?.() || ''
    if (latestError) {
      searchError.value = latestError
      if (!append) {
        results.value = []
        totalResults.value = 0
        hasMore.value = false
      }
      toast.error(latestError)
    }
  } catch (error) {
    if (requestId !== latestSearchRequestId) return
    console.error('Search error:', error)
    searchError.value = error.message || '搜索失败，请稍后重试'
    if (!append) {
      results.value = []
      totalResults.value = 0
      hasMore.value = false
    }
    toast.error(searchError.value)
  } finally {
    if (requestId === latestSearchRequestId) {
      searching.value = false
      loadingMore.value = false
    }
  }
}

async function fetchSearchResults(searchKeyword, requestPage = 1) {
  const result = await shopStore.searchProducts(searchKeyword, {
    sort: currentSort.value,
    inStockOnly: inStockOnly.value,
    page: requestPage,
    pageSize,
    priceMin: appliedPriceMin.value,
    priceMax: appliedPriceMax.value
  })

  if (Array.isArray(result)) {
    return {
      products: result,
      total: result.length,
      hasMore: false
    }
  }

  return {
    products: result?.products || [],
    total: result?.total || 0,
    hasMore: Boolean(result?.hasMore)
  }
}

function handleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (keyword.value.trim()) {
      doSearch({ saveHistory: false })
      return
    }

    resetSearchState()
  }, 300)
}

function searchFromHistory(item) {
  keyword.value = item
  doSearch()
}

function clearSearch() {
  keyword.value = ''
  syncPriceFilterInputs(appliedPriceMin.value, appliedPriceMax.value)
  resetSearchState()
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
  shopStore.setInStockOnly(!inStockOnly.value)
  if (keyword.value.trim()) {
    doSearch({ saveHistory: false })
  }
}

function applyPriceFilter() {
  const normalizedPriceRange = normalizePriceFilterRange(priceMinInput.value, priceMaxInput.value)
  appliedPriceMin.value = normalizedPriceRange.priceMin
  appliedPriceMax.value = normalizedPriceRange.priceMax
  syncPriceFilterInputs(appliedPriceMin.value, appliedPriceMax.value)
  if (keyword.value.trim()) {
    doSearch({ saveHistory: false })
  }
}

function clearPriceFilter() {
  if (!hasDraftPriceFilter.value && !hasActivePriceFilter.value) return
  appliedPriceMin.value = null
  appliedPriceMax.value = null
  syncPriceFilterInputs(null, null)
  if (keyword.value.trim()) {
    doSearch({ saveHistory: false })
  }
}

function clearAllFilters() {
  currentSort.value = 'default'
  if (inStockOnly.value) {
    shopStore.setInStockOnly(false)
  }
  appliedPriceMin.value = null
  appliedPriceMax.value = null
  syncPriceFilterInputs(null, null)
  if (keyword.value.trim()) {
    doSearch({ saveHistory: false })
  }
}

function fillSuggestedKeyword() {
  const suggested = hotKeywords[0] || ''
  if (!suggested) return
  keyword.value = suggested
  doSearch()
}

function retrySearch() {
  if (!keyword.value.trim()) return
  doSearch({ saveHistory: false, page: page.value || 1 })
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value || !keyword.value.trim()) return
  await doSearch({ saveHistory: false, page: page.value + 1, append: true })
}

function viewProduct(product) {
  router.push(`/product/${product.id}`)
}

watch(() => route.query.q, (q) => {
  const nextKeyword = String(q || '').trim()
  if (!nextKeyword) {
    keyword.value = ''
    resetSearchState()
    return
  }

  if (nextKeyword === keyword.value.trim() && hasSearched.value) return
  keyword.value = nextKeyword
  doSearch()
}, { immediate: true })

onMounted(() => {
  loadHistory()
  updateGridColumns()
  syncPriceFilterInputs(appliedPriceMin.value, appliedPriceMax.value)
  window.addEventListener('resize', updateGridColumns)
  searchInput.value?.focus()
})

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  window.removeEventListener('resize', updateGridColumns)
  latestSearchRequestId++
})
</script>

<style scoped>
.search-page {
  min-height: 100vh;
  padding-bottom: 80px;
}

.search-shell {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}

.search-header-area {
  max-width: 800px;
  margin: 0 auto 24px;
}

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

.results-section {
  min-height: 200px;
}

.feedback-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
}

.feedback-card p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.error-card {
  border-color: rgba(239, 68, 68, 0.2);
  background: rgba(239, 68, 68, 0.06);
}

.feedback-btn {
  padding: 8px 14px;
  border: none;
  border-radius: 10px;
  background: var(--color-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.feedback-btn:hover {
  opacity: 0.92;
}

.feedback-btn.secondary {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
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
  gap: 4px;
  flex-wrap: wrap;
}

.catalog-filters {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex: 1 1 360px;
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

.price-filter-row {
  margin-bottom: 16px;
}

.price-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.price-filter-input {
  width: 112px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.2;
}

.price-filter-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.12);
}

.price-filter-separator {
  font-size: 12px;
  color: var(--text-tertiary);
}

.price-filter-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 10px;
  background: var(--color-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.price-filter-btn:hover {
  opacity: 0.92;
}

.price-filter-btn.secondary {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.loading-state {
  padding-top: 20px;
}

.empty-actions {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
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

.results-count .filter-tag.price-tag {
  color: var(--color-primary);
  background: var(--color-primary-bg);
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.load-more {
  padding: 30px;
  text-align: center;
}

.load-more-btn {
  padding: 12px 40px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 24px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.load-more-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--border-default);
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loaded-all {
  padding: 24px 0 8px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
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

@media (max-width: 640px) {
  .search-shell {
    padding: 12px;
  }

  .search-header-area {
    margin-bottom: 20px;
  }

  .sort-section {
    align-items: flex-start;
  }

  .feedback-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .catalog-filters {
    width: 100%;
    justify-content: flex-start;
  }

  .price-filter {
    width: 100%;
  }

  .price-filter-input {
    flex: 1 1 120px;
    width: auto;
    min-width: 0;
  }

  .products-grid {
    grid-template-columns: 1fr;
  }
}
</style>
