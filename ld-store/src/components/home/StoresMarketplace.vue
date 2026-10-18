<template>
  <section id="home-panel-stores" class="section-content" role="tabpanel" aria-labelledby="home-tab-stores" tabindex="0">
    <div class="stores-header">
      <p class="stores-desc">🏪 汇集各路大佬的自建小店，欢迎入驻🎉</p>
    </div>

    <div class="stores-filter">
      <div class="stores-tag-filter" aria-label="小店标签筛选">
        <button
          v-for="tag in SHOPS_TAGS"
          :key="tag"
          type="button"
          class="stores-tag-btn"
          :class="{ active: selectedTags.includes(tag), ['tag-' + tagClassMap[tag]]: selectedTags.includes(tag) }"
          :aria-pressed="selectedTags.includes(tag)"
          @click="toggleTag(tag)"
        >
          <span>{{ tag }}</span>
          <span v-if="selectedTags.includes(tag)" class="tag-remove" aria-hidden="true">×</span>
        </button>
      </div>
      <div class="stores-search">
        <label for="home-store-search" class="sr-only">搜索小店</label>
        <input
          id="home-store-search"
          v-model="searchKeyword"
          type="search"
          class="stores-search-input"
          placeholder="搜索小店名称、店主或描述"
          @keyup.enter="loadShops(true)"
        />
        <button type="button" class="stores-search-btn" aria-label="搜索小店" @click="loadShops(true)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
      </div>
      <button v-if="hasFilters" type="button" class="stores-reset-btn" @click="resetFilters">重置</button>
    </div>

    <div class="products-header">
      <span class="products-count">{{ hasFilters ? '筛选结果' : '全部' }} 共 <strong>{{ total }}</strong> 个小店</span>
    </div>

    <div v-if="initialLoading" class="products-loading">
      <Skeleton type="card" :count="4" :columns="gridColumns" />
    </div>

    <div v-else-if="shops.length > 0" class="products-grid stores-grid" :aria-busy="loading">
      <ShopCard v-for="shop in shops" :key="shop.id" :shop="shop" />

    </div>

    <EmptyState v-else-if="!loadError" icon="🏬" text="暂无小店" hint="快来入驻开设你的第一家小店吧~">
      <template #action>
        <router-link to="/seller/store" class="btn btn-primary mt-4">🏪 小店入驻</router-link>
      </template>
    </EmptyState>
    <LoadMore v-if="!initialLoading && (shops.length || loadError)" :has-more="hasMore" :loading="loading" :error="loadError" automatic @load="loadMore" />
  </section>
</template>

<script setup>
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue'
import { fetchMarketplaceShops } from '@/services/homeMarketplaceService'
import ShopCard from '@/components/shop/ShopCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Skeleton from '@/components/common/Skeleton.vue'
import LoadMore from '@/components/common/LoadMore.vue'
import { catalogColumns } from '@/config/breakpoints'

defineOptions({ name: 'StoresMarketplace' })

const SHOPS_TAGS = ['订阅', '服务', '小鸡', 'AI', '娱乐', '公益站']
const tagClassMap = { '订阅': 'subscription', '服务': 'service', '小鸡': 'vps', 'AI': 'ai', '娱乐': 'entertainment', '公益站': 'charity' }
const CACHE_TTL = 2 * 60 * 1000
const pageSize = 20

const shops = ref([])
const loading = ref(false)
const initialLoading = ref(true)
const initialized = ref(false)
const total = ref(0)
const page = ref(1)
const hasMore = ref(false)
const loadError = ref('')
const selectedTags = ref([])
const searchKeyword = ref('')
const gridColumns = ref(2)
const hasFilters = computed(() => selectedTags.value.length > 0 || !!searchKeyword.value.trim())
let appliedFilters = { tags: [], search: '' }
let activeRequest = null
let requestId = 0
let lastLoadedAt = 0
let interruptedReset = false

function updateGridColumns() {
  gridColumns.value = catalogColumns(window.innerWidth)
}

function toggleTag(tag) {
  const index = selectedTags.value.indexOf(tag)
  if (index >= 0) selectedTags.value.splice(index, 1)
  else selectedTags.value.push(tag)
  loadShops(true)
}

function resetFilters() {
  selectedTags.value = []
  searchKeyword.value = ''
  loadShops(true)
}

async function loadShops(resetPage = true) {
  if (resetPage) {
    initialLoading.value = true
    shops.value = []
    total.value = 0
    hasMore.value = false
    appliedFilters = { tags: [...selectedTags.value], search: searchKeyword.value }
  }
  const requestPage = resetPage ? 1 : page.value + 1
  loadError.value = ''
  activeRequest?.abort()
  activeRequest = new AbortController()
  const currentRequestId = ++requestId
  loading.value = true

  try {
    const result = await fetchMarketplaceShops({
      page: requestPage,
      pageSize,
      ...appliedFilters,
      signal: activeRequest.signal
    })
    if (currentRequestId !== requestId || result.aborted) return
    if (!result.success || !result.data?.shops) {
      loadError.value = result.error || '加载小店列表失败，请重试'
      return
    }

    page.value = requestPage
    const nextShops = result.data.shops
    shops.value = resetPage ? nextShops : [...shops.value, ...nextShops]
    total.value = result.data.pagination?.total || nextShops.length
    hasMore.value = page.value < (result.data.pagination?.totalPages || 1)
    lastLoadedAt = Date.now()
  } catch (error) {
    if (currentRequestId === requestId) loadError.value = error.message || '加载小店列表失败，请重试'
  } finally {
    if (currentRequestId === requestId) {
      loading.value = false
      initialLoading.value = false
      initialized.value = true
    }
  }
}

async function loadMore() {
  if (loading.value) return
  await loadShops(shops.value.length === 0)
}

onMounted(() => {
  updateGridColumns()
  window.addEventListener('resize', updateGridColumns)
  loadShops(true)
})

onActivated(() => {
  window.addEventListener('resize', updateGridColumns)
  if (!loading.value && (interruptedReset || !initialized.value || Date.now() - lastLoadedAt >= CACHE_TTL)) {
    interruptedReset = false
    void loadShops(true)
  }
})

onDeactivated(() => {
  interruptedReset = initialLoading.value
  requestId++
  activeRequest?.abort()
  loading.value = false
  initialLoading.value = false
  window.removeEventListener('resize', updateGridColumns)
})

onUnmounted(() => {
  activeRequest?.abort()
  window.removeEventListener('resize', updateGridColumns)
})

</script>

<style scoped>
.section-content { min-height: 360px; animation: fade-in .3s ease; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
.stores-header { margin-bottom: 20px; padding: 16px 20px; background: var(--color-success-bg); border-radius: 14px; }
.stores-desc { margin: 0; font-size: 14px; color: var(--color-success); }
.stores-filter, .stores-tag-filter, .products-header { display: flex; align-items: center; }
.stores-filter { gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.stores-tag-filter { gap: 6px; flex-wrap: wrap; }
.stores-tag-btn { min-height: 34px; display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; font-size: 12px; font-weight: 500; border-radius: 14px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-secondary); cursor: pointer; transition: color .2s, border-color .2s, background-color .2s; }
.stores-tag-btn:hover, .stores-tag-btn:focus-visible { border-color: var(--color-primary); color: var(--color-primary); }
.stores-tag-btn.active { font-weight: 600; border-color: transparent; }
.tag-subscription { background: var(--palette-hex-e2e8df); color: var(--palette-hex-6d7f6d); }.tag-service { background: var(--palette-hex-dde2ea); color: var(--palette-hex-5f6f80); }.tag-vps { background: var(--palette-hex-e8e2d8); color: var(--palette-hex-7d7060); }.tag-ai { background: var(--palette-hex-e3dfe8); color: var(--palette-hex-706480); }.tag-entertainment { background: var(--palette-hex-e8dee0); color: var(--palette-hex-806068); }.tag-charity { background: var(--palette-hex-e5dde3); color: var(--palette-hex-706070); }
.tag-remove { display: inline-grid; place-items: center; width: 14px; height: 14px; border-radius: 50%; background: var(--palette-rgba-0-0-0-p2); color: var(--palette-hex-ffffff); font-size: 10px; }
.stores-search { flex: 1; position: relative; min-width: 180px; }
.stores-search-input { width: 100%; min-height: 40px; box-sizing: border-box; border: 1px solid var(--border-color); border-radius: 10px; background: var(--input-bg); color: var(--text-primary); font-size: 14px; padding: 10px 44px 10px 12px; }
.stores-search-input:focus { outline: 0; background: var(--input-focus-bg); border-color: var(--input-focus-border); box-shadow: 0 2px 8px var(--glass-shadow-light); }
.stores-search-btn { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 8px; background: var(--glass-bg-heavy); color: var(--text-secondary); cursor: pointer; }
.stores-reset-btn { min-height: 36px; padding: 8px 14px; font-size: 12px; font-weight: 600; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-secondary); cursor: pointer; }
.products-header { justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.products-count { font-size: 13px; color: var(--text-tertiary); }.products-count strong { color: var(--text-primary); }
.products-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--grid-gap); }
.products-loading { min-height: 360px; padding: 20px 0; }
button:focus-visible, input:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
@media (min-width: 768px) { .products-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1024px) { .products-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (max-width: 639px) { .stores-filter { flex-direction: column; align-items: stretch; gap: 8px; }.stores-search-input, .stores-tag-btn, .stores-reset-btn { min-height: 44px; }.stores-search-input { font-size: 16px; }.stores-search-btn { width: 40px; height: 40px; } }
@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .section-content { animation: none; } }
</style>
