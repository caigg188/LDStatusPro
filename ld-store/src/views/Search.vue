<template>
  <div class="search-page">
    <div class="search-shell">
      <div class="search-header-area">
        <!-- 搜索框 -->
        <div class="search-header">
          <div class="search-box">
            <span class="search-icon" aria-hidden="true">🔍</span>
            <input
              ref="searchInput"
              v-model="keyword"
              type="text"
              class="search-input"
              placeholder="搜索物品..."
              role="combobox"
              aria-autocomplete="list"
              :aria-expanded="showSuggestions"
              aria-controls="search-suggestion-list"
              :aria-activedescendant="activeSuggestionId"
              @input="handleSearch"
              @focus="handleSearchFocus"
              @blur="handleSearchBlur"
              @keydown.down.prevent="moveSuggestion(1)"
              @keydown.up.prevent="moveSuggestion(-1)"
              @keydown.esc="closeSuggestions"
              @keydown.enter.prevent="handleSearchEnter"
            />
            <button
              v-if="keyword"
              type="button"
              class="clear-btn"
              aria-label="清空搜索内容"
              @click="clearSearch"
            >
              ✕
            </button>
          </div>
          <div
            v-if="showSuggestions"
            id="search-suggestion-list"
            class="suggestion-list"
            role="listbox"
            aria-label="搜索建议"
            :aria-busy="suggestionLoading"
          >
            <button
              v-for="(suggestion, index) in suggestions"
              :id="suggestionId(index)"
              :key="`${suggestion.type}-${suggestion.productId || ''}-${suggestion.value}`"
              type="button"
              role="option"
              class="suggestion-item"
              :class="{ active: activeSuggestionIndex === index }"
              :aria-selected="activeSuggestionIndex === index"
              @mouseenter="activeSuggestionIndex = index"
              @mousedown.prevent="selectSuggestion(suggestion)"
            >
              <span class="suggestion-label">{{ suggestion.label || suggestion.value }}</span>
              <span class="suggestion-kind">{{ suggestionTypeLabel(suggestion.type) }}</span>
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
        <div v-if="!keyword && hotKeywords.length" class="hot-section">
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
        <div v-if="searchError && !results.length" class="feedback-card error-card">
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
          v-else-if="results.length === 0 && hasSearched && !searchError"
          icon="🔍"
          text="未找到相关物品"
          :hint="emptyHint"
        >
          <template #action>
            <div class="empty-actions">
              <button v-if="hasActiveFilters" class="feedback-btn" @click="clearAllFilters">清空筛选</button>
              <button v-if="hotKeywords.length" class="feedback-btn secondary" @click="fillSuggestedKeyword">试试热门搜索</button>
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
            />
          </div>
          <LoadMore :has-more="hasMore" :loading="loadingMore" :error="searchError" automatic @load="loadMore" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, nextTick, onMounted, onActivated, onDeactivated, onBeforeUnmount, watch } from 'vue'
import { useRoute, onBeforeRouteLeave } from 'vue-router'
import { useCatalogStore } from '@/stores/catalog'
import { useToast } from '@/composables/useToast'
import { storage } from '@/utils/storage'
import { loadSearchHistory, saveSearchHistory, clearSearchHistory as clearStoredSearchHistory } from '@/utils/search'
import { fetchSearchSuggestionsRequest, recordSearchOutcome } from '@/services/shop/discoveryService'
import ProductCard from '@/components/product/ProductCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Skeleton from '@/components/common/Skeleton.vue'
import LoadMore from '@/components/common/LoadMore.vue'
import { catalogColumns } from '@/config/breakpoints'

defineOptions({ name: 'SearchResults' })

const route = useRoute()
const shopStore = useCatalogStore()
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

const hotKeywords = ref([])
const suggestions = ref([])
const suggestionsOpen = ref(false)
const activeSuggestionIndex = ref(-1)
const suggestionLoading = ref(false)

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
let suggestionTimer = null
let suggestionCloseTimer = null
let latestSearchRequestId = 0
let latestSuggestionRequestId = 0
let lastCompletedQuery = ''
let failedAppend = false
let interruptedInitial = false
let savedScrollPosition = 0
let activeRequest = null
let viewActive = true
let currentRouteQuery = String(route.query.q || '').trim()

const showSuggestions = computed(() => (
  suggestionsOpen.value && keyword.value.trim().length > 0 && suggestions.value.length > 0
))
const activeSuggestionId = computed(() => (
  showSuggestions.value && activeSuggestionIndex.value >= 0
    ? suggestionId(activeSuggestionIndex.value)
    : undefined
))

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
  gridColumns.value = catalogColumns(window.innerWidth)
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
  activeRequest?.abort()
  searching.value = false
  loadingMore.value = false
  results.value = []
  totalResults.value = 0
  hasMore.value = false
  searchError.value = ''
  hasSearched.value = false
  page.value = 1
  suggestions.value = []
  suggestionsOpen.value = false
  activeSuggestionIndex.value = -1
}

async function doSearch(options = {}) {
  clearTimeout(searchTimer)
  const trimmedKeyword = keyword.value.trim()
  if (!trimmedKeyword) {
    resetSearchState()
    return
  }

  const requestPage = Number.isFinite(Number(options.page)) ? Number(options.page) : 1
  const append = options.append === true && requestPage > 1
  if (options.closeSuggestions !== false) closeSuggestions()

  if (options.saveHistory !== false && !append) {
    saveHistory(trimmedKeyword)
  }

  const requestId = ++latestSearchRequestId
  activeRequest?.abort()
  activeRequest = new AbortController()
  failedAppend = false
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
    if (requestId !== latestSearchRequestId || !result) return

    const nextResults = Array.isArray(result.products) ? result.products : []
    const effectiveAppend = append && !result.cursorRestarted
    results.value = effectiveAppend ? [...results.value, ...nextResults] : nextResults
    totalResults.value = Number(result.total || nextResults.length)
    hasMore.value = Boolean(result.hasMore)
    page.value = Number(result.page || requestPage)

    if (!append) {
      const reformulation = Boolean(lastCompletedQuery && lastCompletedQuery !== trimmedKeyword)
      recordSearchOutcome({
        query: trimmedKeyword,
        products: nextResults,
        searchToken: result.searchToken,
        zeroResult: nextResults.length === 0,
        reformulation
      })
      lastCompletedQuery = trimmedKeyword
    }

  } catch (error) {
    if (requestId !== latestSearchRequestId) return
    console.error('Search error:', error)
    failedAppend = append
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
    priceMax: appliedPriceMax.value,
    signal: activeRequest.signal
  })

  if (result.aborted) return null
  if (!result.success) throw new Error(result.error || '搜索失败，请稍后重试')
  const pagination = result.data.pagination

  return {
    products: result.data.products || [],
    searchToken: result.data.rankingContext?.searchToken,
    total: pagination.total || 0,
    hasMore: typeof pagination.hasMore === 'boolean'
      ? pagination.hasMore
      : requestPage * pagination.pageSize < pagination.total,
    page: Number(result.data.cursorRestarted ? 1 : (pagination.page || requestPage)),
    cursorRestarted: result.data.cursorRestarted === true
  }
}

function handleSearch() {
  clearTimeout(searchTimer)
  clearTimeout(suggestionTimer)
  activeSuggestionIndex.value = -1
  suggestionsOpen.value = Boolean(keyword.value.trim())
  suggestionTimer = setTimeout(() => void loadSuggestions(keyword.value), 140)
  searchTimer = setTimeout(() => {
    if (keyword.value.trim()) {
      doSearch({ saveHistory: false, closeSuggestions: false })
      return
    }

    resetSearchState()
  }, 300)
}

async function loadSuggestions(value = '') {
  const query = String(value || '').trim()
  const requestId = ++latestSuggestionRequestId
  suggestionLoading.value = true
  try {
    const result = await fetchSearchSuggestionsRequest(query)
    if (requestId !== latestSuggestionRequestId) return
    const next = Array.isArray(result?.data?.suggestions) ? result.data.suggestions : []
    if (!query) {
      const trending = next.map(item => item.label || item.value).filter(Boolean)
      hotKeywords.value = trending
      return
    }
    suggestions.value = next
    suggestionsOpen.value = next.length > 0
  } finally {
    if (requestId === latestSuggestionRequestId) suggestionLoading.value = false
  }
}

function suggestionId(index) {
  return `search-suggestion-${index}`
}

function suggestionTypeLabel(type) {
  return ({ product: '物品', category: '分类', alias: '相关搜索', query: '热门' })[type] || '建议'
}

function moveSuggestion(direction) {
  if (!showSuggestions.value) {
    suggestionsOpen.value = suggestions.value.length > 0
    return
  }
  const count = suggestions.value.length
  activeSuggestionIndex.value = (activeSuggestionIndex.value + direction + count) % count
}

function selectSuggestion(suggestion) {
  keyword.value = String(suggestion?.value || suggestion?.label || '').trim()
  closeSuggestions()
  doSearch()
}

function handleSearchEnter() {
  const selected = suggestions.value[activeSuggestionIndex.value]
  if (showSuggestions.value && selected) {
    selectSuggestion(selected)
    return
  }
  closeSuggestions()
  doSearch()
}

function handleSearchFocus() {
  clearTimeout(suggestionCloseTimer)
  if (keyword.value.trim() && suggestions.value.length > 0) suggestionsOpen.value = true
}

function handleSearchBlur() {
  suggestionCloseTimer = setTimeout(closeSuggestions, 120)
}

function closeSuggestions() {
  suggestionsOpen.value = false
  activeSuggestionIndex.value = -1
}

function searchFromHistory(item) {
  keyword.value = item
  closeSuggestions()
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
  const suggested = hotKeywords.value[0] || ''
  if (!suggested) return
  keyword.value = suggested
  doSearch()
}

function retrySearch() {
  if (!keyword.value.trim()) return
  if (failedAppend) return loadMore()
  doSearch({ saveHistory: false })
}

async function loadMore() {
  if (searching.value || loadingMore.value || !hasMore.value || !keyword.value.trim()) return
  await doSearch({ saveHistory: false, page: page.value + 1, append: true })
}

watch(() => route.query.q, (q) => {
  if (route.name !== 'Search' || !viewActive) return
  currentRouteQuery = String(q || '').trim()
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
  void loadSuggestions('')
})

onBeforeRouteLeave(() => { savedScrollPosition = window.scrollY })

onActivated(async () => {
  viewActive = true
  window.addEventListener('resize', updateGridColumns)
  const nextKeyword = String(route.query.q || '').trim()
  if (nextKeyword !== currentRouteQuery) {
    currentRouteQuery = nextKeyword
    keyword.value = nextKeyword
    await doSearch()
  } else if (interruptedInitial) {
    interruptedInitial = false
    await doSearch({ saveHistory: false })
  }
  await nextTick()
  window.scrollTo(0, savedScrollPosition)
})

function stopSearch() {
  viewActive = false
  interruptedInitial = searching.value
  clearTimeout(searchTimer)
  clearTimeout(suggestionTimer)
  clearTimeout(suggestionCloseTimer)
  window.removeEventListener('resize', updateGridColumns)
  latestSearchRequestId++
  latestSuggestionRequestId++
  activeRequest?.abort()
  searching.value = false
  loadingMore.value = false
}
onDeactivated(stopSearch)
onBeforeUnmount(stopSearch)
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
  position: relative;
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

.search-box:focus-within {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent), var(--shadow-sm);
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
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border: none;
  border-radius: 50%;
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.clear-btn:focus-visible,
.suggestion-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.suggestion-list {
  position: absolute;
  z-index: 20;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  max-height: min(360px, 52vh);
  overflow-y: auto;
  padding: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow-lg);
}

.suggestion-item {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  color: var(--text-primary);
  background: transparent;
  border: 0;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
}

.suggestion-item:hover,
.suggestion-item.active {
  background: var(--bg-secondary);
}

.suggestion-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggestion-kind {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  font-size: 12px;
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
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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
  background: var(--palette-hex-cfa76f);
  color: var(--palette-hex-ffffff);
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
  border-color: var(--palette-rgba-239-68-68-0p2);
  background: var(--palette-rgba-239-68-68-0p06);
}

.feedback-btn {
  padding: 8px 14px;
  border: none;
  border-radius: 10px;
  background: var(--color-primary);
  color: var(--palette-hex-ffffff);
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
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.stock-filter .checkbox.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.stock-filter .checkmark {
  color: var(--palette-hex-ffffff);
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
  box-shadow: 0 0 0 3px var(--palette-rgba-34-197-94-0p12);
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
  color: var(--palette-hex-ffffff);
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
  gap: var(--grid-gap);
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

@media (max-width: 639px) {
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
