<template>
  <div class="category-page">
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">
          {{ categoryIcon }} {{ categoryName }}
        </h1>
        <p class="page-subtitle">
          <template v-if="isProductListHiddenByMaintenance">
            {{ maintenanceTitle }}
          </template>
          <template v-else>
            共 {{ total }} 个物品
          </template>
          <span v-if="hasActivePriceFilter" class="active-filter">{{ activePriceFilterLabel }}</span>
        </p>
      </div>

      <div class="filter-bar">
        <LiquidTabs
          v-model="currentSort"
          :tabs="sortTabs"
          @update:model-value="changeSort"
        />

        <div class="price-filter-row">
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
        </div>
      </div>

      <div v-if="loading" class="loading-state">
        <Skeleton type="product" :count="4" />
      </div>

      <EmptyState
        v-else-if="products.length === 0"
        :icon="isProductListHiddenByMaintenance ? '🚧' : '📭'"
        :title="isProductListHiddenByMaintenance ? maintenanceTitle : '暂无物品'"
        :description="isProductListHiddenByMaintenance ? maintenanceCatalogDescription : `${categoryName} 分类下暂时没有符合条件的物品`"
      >
        <router-link v-if="!isProductListHiddenByMaintenance" to="/" class="back-btn">
          ← 返回
        </router-link>
      </EmptyState>

      <div v-else class="products-grid">
        <ProductCard
          v-for="product in products"
          :key="product.id"
          :product="product"
          @click="viewProduct(product)"
        />
      </div>

      <div v-if="hasMore && !loading" class="load-more">
        <button class="load-more-btn" @click="loadMore" :disabled="loadingMore">
          {{ loadingMore ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onActivated, onDeactivated, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { useToast } from '@/composables/useToast'
import { fetchProductsRequest } from '@/services/shop/catalogService'
import { MAINTENANCE_STATE, isMaintenanceFeatureEnabled, isRestrictedMaintenanceMode } from '@/config/maintenance'
import ProductCard from '@/components/product/ProductCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Skeleton from '@/components/common/Skeleton.vue'
import LiquidTabs from '@/components/common/LiquidTabs.vue'

defineOptions({ name: 'Category' })

const route = useRoute()
const router = useRouter()
const shopStore = useShopStore()
const toast = useToast()

const loading = ref(true)
const loadingMore = ref(false)
const products = ref([])
const page = ref(1)
const total = ref(0)
const hasMore = ref(false)
const currentSort = ref('default')
const pageSize = 20

const priceMinInput = ref('')
const priceMaxInput = ref('')
const appliedPriceMin = ref(null)
const appliedPriceMax = ref(null)

let savedScrollPosition = 0
let lastCategory = ''

const categoryIconFallback = {
  AI: '🤖',
  存储: '💾',
  小鸡: '🐣',
  咨询: '💬',
  卡券: '🎟️'
}

const sortOptions = [
  { value: 'default', label: '默认' },
  { value: 'newest', label: '最新' },
  { value: 'price_asc', label: '价格↑' },
  { value: 'price_desc', label: '价格↓' },
  { value: 'sales', label: '销量' }
]

const sortTabs = sortOptions.map((option) => ({
  value: option.value,
  label: option.label
}))

const category = computed(() => String(route.params.name || '').trim())
const categories = computed(() => Array.isArray(shopStore.categories) ? shopStore.categories : [])
const resolvedCategory = computed(() => categories.value.find((item) => (
  String(item?.name || '').trim() === category.value || String(item?.id || '') === category.value
)) || null)
const resolvedCategoryId = computed(() => resolvedCategory.value?.id ?? '')
const categoryName = computed(() => resolvedCategory.value?.name || category.value || '分类')
const categoryIcon = computed(() => (
  resolvedCategory.value?.icon
  || categoryIconFallback[categoryName.value]
  || '📦'
))
const isProductListHiddenByMaintenance = computed(() => (
  isRestrictedMaintenanceMode() && !isMaintenanceFeatureEnabled('productListRead')
))
const maintenanceTitle = computed(() => MAINTENANCE_STATE.title || 'LD士多受限维护中')
const maintenanceCatalogDescription = computed(() => (
  MAINTENANCE_STATE.message || '因 LinuxDo 暂时下线 Credit 积分服务，当前分类物品列表已临时隐藏。'
))

const hasActivePriceFilter = computed(() => appliedPriceMin.value !== null || appliedPriceMax.value !== null)
const hasDraftPriceFilter = computed(() => (
  normalizePriceFilterInput(priceMinInput.value) !== null || normalizePriceFilterInput(priceMaxInput.value) !== null
))
const activePriceFilterLabel = computed(() => {
  if (appliedPriceMin.value !== null && appliedPriceMax.value !== null) {
    return `价格 ${appliedPriceMin.value} - ${appliedPriceMax.value} LDC`
  }
  if (appliedPriceMin.value !== null) return `价格 ≥ ${appliedPriceMin.value} LDC`
  if (appliedPriceMax.value !== null) return `价格 ≤ ${appliedPriceMax.value} LDC`
  return ''
})

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

async function ensureCategoriesLoaded() {
  if (categories.value.length > 0) return
  await shopStore.fetchCategories()
}

async function loadProducts(append = false) {
  try {
    if (!append) {
      loading.value = true
      page.value = 1
    } else {
      loadingMore.value = true
    }

    await ensureCategoriesLoaded()
    const categoryId = resolvedCategoryId.value
    if (!categoryId) {
      products.value = []
      total.value = 0
      hasMore.value = false
      return false
    }

    const result = await fetchProductsRequest({
      categoryId,
      page: page.value,
      pageSize,
      sort: currentSort.value,
      priceMin: appliedPriceMin.value,
      priceMax: appliedPriceMax.value
    })

    if (!result?.success || !Array.isArray(result.data?.products)) {
      toast.error(result?.error || '加载分类物品失败，请稍后重试')
      if (!append) {
        products.value = []
        total.value = 0
        hasMore.value = false
      }
      return false
    }

    const nextProducts = result.data.products || []
    const pagination = result.data.pagination || {}
    if (append) {
      products.value.push(...nextProducts)
    } else {
      products.value = nextProducts
    }

    total.value = pagination.total || nextProducts.length
    hasMore.value = (pagination.page || page.value) < (pagination.totalPages || 0)
    syncPriceFilterInputs(appliedPriceMin.value, appliedPriceMax.value)
    return true
  } catch (error) {
    console.error('Load category products error:', error)
    if (!append) {
      products.value = []
      total.value = 0
      hasMore.value = false
    }
    toast.error(error.message || '加载分类物品失败，请稍后重试')
    return false
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function loadMore() {
  page.value += 1
  const success = await loadProducts(true)
  if (!success) {
    page.value = Math.max(page.value - 1, 1)
  }
}

function changeSort(sort) {
  currentSort.value = sort
  loadProducts()
}

function applyPriceFilter() {
  const normalizedPriceRange = normalizePriceFilterRange(priceMinInput.value, priceMaxInput.value)
  appliedPriceMin.value = normalizedPriceRange.priceMin
  appliedPriceMax.value = normalizedPriceRange.priceMax
  syncPriceFilterInputs(appliedPriceMin.value, appliedPriceMax.value)
  loadProducts()
}

function clearPriceFilter() {
  if (!hasDraftPriceFilter.value && !hasActivePriceFilter.value) return
  appliedPriceMin.value = null
  appliedPriceMax.value = null
  syncPriceFilterInputs(null, null)
  loadProducts()
}

function viewProduct(product) {
  router.push(`/product/${product.id}`)
}

watch(() => route.params.name, async (newCategory) => {
  if (!newCategory) return
  if (String(newCategory) !== lastCategory) {
    lastCategory = String(newCategory)
    await loadProducts()
  }
}, { immediate: true })

onActivated(async () => {
  if (route.params.name === lastCategory && savedScrollPosition > 0) {
    await nextTick()
    window.scrollTo(0, savedScrollPosition)
  }
})

onDeactivated(() => {
  savedScrollPosition = window.scrollY
})
</script>

<style scoped>
.category-page {
  min-height: 100vh;
  padding-bottom: 80px;
}

.page-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 16px;
}

.page-header {
  text-align: center;
  padding: 24px 0;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.page-subtitle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 14px;
  color: var(--text-tertiary);
  margin: 0;
}

.active-filter {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-size: 12px;
}

.filter-bar {
  margin-bottom: 20px;
  padding: 12px 16px;
  background: var(--bg-card);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
}

.price-filter-row {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.price-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.price-filter-input {
  width: 120px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
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

.back-btn {
  display: inline-block;
  padding: 10px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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

@media (max-width: 640px) {
  .page-container {
    padding: 12px;
  }

  .products-grid {
    grid-template-columns: 1fr;
  }

  .price-filter-row {
    justify-content: stretch;
  }

  .price-filter {
    width: 100%;
  }

  .price-filter-input {
    flex: 1 1 120px;
    width: auto;
    min-width: 0;
  }
}
</style>
