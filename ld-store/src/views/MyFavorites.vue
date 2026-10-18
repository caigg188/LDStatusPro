<template>
  <div class="collections-page">
    <div class="page-container">
      <header class="page-header">
        <div>
          <p class="page-eyebrow">个人偏好</p>
          <h1 class="page-title">收藏与拉黑</h1>
          <p class="page-subtitle">留下喜欢的，也可以管理不想再看到的物品</p>
        </div>
        <router-link to="/" class="browse-link">继续逛逛</router-link>
      </header>

      <section class="collection-workspace" :data-mode="activeTab">
        <div class="collection-tabs" role="tablist" aria-label="收藏与拉黑列表">
          <button
            v-for="(tab, index) in tabs"
            :id="`collection-tab-${tab.id}`"
            :key="tab.id"
            type="button"
            role="tab"
            class="collection-tab"
            :class="{ 'is-active': activeTab === tab.id }"
            :aria-selected="String(activeTab === tab.id)"
            aria-controls="collection-panel"
            @click="switchTab(tab.id)"
            @keydown="handleTabKeydown($event, index)"
          >
            <Heart v-if="tab.id === 'favorites'" :size="17" aria-hidden="true" />
            <EyeOff v-else :size="17" aria-hidden="true" />
            <span>{{ tab.label }}</span>
            <span v-if="lists[tab.id].loaded" class="tab-count">{{ lists[tab.id].total }}</span>
          </button>
        </div>

        <form class="collection-search" role="search" @submit.prevent="searchActiveCollection">
          <label class="search-field">
            <Search :size="17" aria-hidden="true" />
            <span class="sr-only">搜索{{ activeTabLabel }}</span>
            <input
              v-model.trim="searchTerms[activeTab]"
              type="search"
              :placeholder="`搜索${activeTabLabel}中的物品`"
            />
          </label>
          <button type="submit" class="search-button" :disabled="activeState.loading">搜索</button>
        </form>

        <div
          id="collection-panel"
          role="tabpanel"
          :aria-labelledby="`collection-tab-${activeTab}`"
          :aria-busy="String(activeState.loading)"
        >
          <div v-if="activeState.loading && !activeState.loaded" class="loading-wrap" aria-live="polite">
            <span class="loading-dot" aria-hidden="true"></span>
            正在加载{{ activeTabLabel }}…
          </div>

          <EmptyState
            v-else-if="activeState.items.length === 0 && !activeState.error"
            :text="emptyContent.text"
            :hint="emptyContent.hint"
          >
            <template #icon>
              <Heart v-if="activeTab === 'favorites'" :size="46" aria-hidden="true" />
              <EyeOff v-else :size="46" aria-hidden="true" />
            </template>
          </EmptyState>

          <div v-else class="collection-list">
            <article v-for="item in activeState.items" :key="item.id" class="collection-card">
              <div class="card-main">
                <router-link
                  v-if="activeTab === 'favorites'"
                  :to="`/product/${item.id}`"
                  class="card-cover"
                  :style="getCoverStyle(item)"
                  :aria-label="`查看 ${item.name} 的详情`"
                >
                  <img
                    v-if="item.imageUrl"
                    :src="item.imageUrl"
                    :alt="item.name"
                    class="cover-image"
                    loading="lazy"
                    @error="handleImageError"
                  />
                  <span v-else class="cover-placeholder">{{ item.categoryIcon || '□' }}</span>
                </router-link>
                <div v-else class="card-cover" :style="getCoverStyle(item)" aria-hidden="true">
                  <img
                    v-if="item.imageUrl"
                    :src="item.imageUrl"
                    alt=""
                    class="cover-image is-muted"
                    loading="lazy"
                    @error="handleImageError"
                  />
                  <span v-else class="cover-placeholder">{{ item.categoryIcon || '□' }}</span>
                </div>

                <div class="card-content">
                  <router-link v-if="activeTab === 'favorites'" :to="`/product/${item.id}`" class="card-title-link">
                    <h2 class="card-title">{{ item.name }}</h2>
                  </router-link>
                  <h2 v-else class="card-title">{{ item.name }}</h2>
                  <p class="card-desc">{{ stripMarkdown(item.description) || '暂无描述' }}</p>
                  <div class="card-meta">
                    <span class="meta-tag">{{ item.categoryIcon || '□' }} {{ item.categoryName || '其他' }}</span>
                    <span :class="['meta-status', `status-${normalizeProductStatus(item.status) || 'unknown'}`]">
                      {{ getStatusText(item.status) }}
                    </span>
                    <span class="meta-price">{{ getPrice(item) }} LDC</span>
                    <span class="meta-info">{{ getSellerText(item) }}</span>
                    <span class="meta-info">库存 {{ getStockText(item) }}</span>
                    <span class="meta-time">
                      {{ activeTab === 'favorites' ? '收藏于' : '隐藏于' }}
                      {{ formatRelativeTime(getPreferenceTime(item)) }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="card-actions">
                <template v-if="activeTab === 'favorites'">
                  <router-link :to="`/product/${item.id}`" class="action-btn">查看详情</router-link>
                  <button
                    type="button"
                    class="action-btn quiet-danger"
                    :disabled="isItemBusy(item.id)"
                    @click="blockFavorite(item)"
                  >
                    <EyeOff :size="15" aria-hidden="true" />
                    {{ currentAction === `block:${item.id}` ? '隐藏中…' : '不感兴趣' }}
                  </button>
                  <button
                    type="button"
                    class="action-btn"
                    :disabled="isItemBusy(item.id)"
                    @click="removeFavorite(item)"
                  >
                    {{ currentAction === `favorite:${item.id}` ? '移除中…' : '移除收藏' }}
                  </button>
                </template>
                <button
                  v-else
                  type="button"
                  class="action-btn restore"
                  :disabled="isItemBusy(item.id)"
                  @click="restoreProduct(item)"
                >
                  <RotateCcw :size="15" aria-hidden="true" />
                  {{ currentAction === `restore:${item.id}` ? '恢复中…' : '恢复展示' }}
                </button>
              </div>
            </article>
          </div>

          <LoadMore v-if="!activeState.loading && (activeState.items.length || activeState.error)" :has-more="activeState.hasMore || activeState.refreshPage > 0" :loading="activeState.loadingMore" :error="activeState.error" @load="loadMore" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { EyeOff, Heart, RotateCcw, Search } from '@lucide/vue'
import { useProductStore } from '@/stores/product'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { formatPrice, formatRelativeTime } from '@/utils/format'
import { stripMarkdown } from '@/utils/renderProductDescription'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadMore from '@/components/common/LoadMore.vue'

defineOptions({ name: 'MyFavorites' })
let savedScrollPosition = 0
let preferenceLists = null
const controllers = {}

const route = useRoute()
const router = useRouter()
const productStore = useProductStore()
const toast = useToast()
const dialog = useDialog()

const tabs = [
  { id: 'favorites', label: '我的收藏' },
  { id: 'blocked', label: '不感兴趣' }
]
const pageSize = 20
const activeTab = ref(route.query.tab === 'blocked' ? 'blocked' : 'favorites')
const currentAction = ref('')
const searchTerms = reactive({ favorites: '', blocked: '' })

function createListState() {
  return {
    items: [],
    page: 1,
    total: 0,
    hasMore: false,
    loading: false,
    loadingMore: false,
    loaded: false,
    requestId: 0,
    search: '',
    error: '',
    refreshPage: 0
  }
}

const lists = reactive({
  favorites: createListState(),
  blocked: createListState()
})

const activeState = computed(() => lists[activeTab.value])
const activeTabLabel = computed(() => tabs.find(tab => tab.id === activeTab.value)?.label || '列表')
const emptyContent = computed(() => {
  if (searchTerms[activeTab.value]) {
    return { text: '没有找到匹配的物品', hint: '换个关键词再试试' }
  }
  if (activeTab.value === 'blocked') {
    return { text: '暂无不感兴趣的物品', hint: '被隐藏的物品会集中出现在这里，可随时恢复展示' }
  }
  return { text: '暂无收藏', hint: '去物品广场收藏你感兴趣的内容吧' }
})

const coverColors = [
  'linear-gradient(135deg, var(--palette-hex-fef3c7), var(--palette-hex-fde68a))',
  'linear-gradient(135deg, var(--palette-hex-dbeafe), var(--palette-hex-bfdbfe))',
  'linear-gradient(135deg, var(--palette-hex-dcfce7), var(--palette-hex-bbf7d0))',
  'linear-gradient(135deg, var(--palette-hex-fce7f3), var(--palette-hex-fbcfe8))',
  'linear-gradient(135deg, var(--palette-hex-ede9fe), var(--palette-hex-ddd6fe))'
]

function getCoverStyle(item) {
  if (item.imageUrl) return {}
  const index = Math.abs(Number(item.id) || 0) % coverColors.length
  return { background: coverColors[index] }
}

function handleImageError(event) {
  event.target.style.display = 'none'
}

function getPrice(item) {
  const price = Number(item.price) || 0
  const discount = Number(item.discount ?? 1)
  return formatPrice(price * discount)
}

function normalizeProductStatus(status) {
  const normalized = String(status || '').trim().toLowerCase()
  const alias = {
    approved: 'manual_approved',
    active: 'manual_approved',
    pending: 'pending_ai',
    rejected: 'manual_rejected',
    offline: 'offline_manual',
    inactive: 'offline_manual'
  }
  return alias[normalized] || normalized
}

function getStatusText(status) {
  const map = {
    ai_approved: '已上架',
    manual_approved: '已上架',
    pending_ai: '审核中',
    pending_manual: '待人工审核',
    ai_rejected: '已拒绝',
    manual_rejected: '已拒绝',
    offline_manual: '已下架'
  }
  return map[normalizeProductStatus(status)] || '状态未知'
}

function getSellerText(item) {
  const username = String(item?.sellerUsername || '').trim()
  return username ? `@${username}` : '@未知'
}

function getStockText(item) {
  const stock = Number.parseInt(item?.stock, 10)
  const available = Number.parseInt(item?.availableStock ?? item?.cdkStats?.available, 10)
  if (stock === -1 || available === -1 || item?.sharedCdkEnabled) {
    return '不限量'
  }
  if (String(item?.productType || '').toLowerCase() === 'cdk' && Number.isFinite(available)) {
    return String(Math.max(available, 0))
  }
  return Number.isFinite(stock) ? String(Math.max(stock, 0)) : '0'
}

function getPreferenceTime(item) {
  return activeTab.value === 'favorites'
    ? (item.favoritedAt || item.updatedAt || item.createdAt)
    : (item.blockedAt || item.updatedAt || item.createdAt)
}

function isItemBusy(_itemId) {
  return currentAction.value !== ''
}

async function loadCollection(tabId, { append = false, page: requestedPage, replaceTail = false } = {}) {
  const state = lists[tabId]
  const targetPage = requestedPage || (append ? state.page + 1 : 1)
  const requestId = ++state.requestId
  controllers[tabId]?.abort()
  const controller = new AbortController()
  controllers[tabId] = controller
  if (!append && !replaceTail) state.search = searchTerms[tabId]
  const prefix = append ? state.items : replaceTail ? state.items.slice(0, (targetPage - 1) * pageSize) : []
  state.loading = !append && !replaceTail
  state.loadingMore = append || replaceTail
  state.error = ''

  try {
    const loader = tabId === 'favorites'
      ? productStore.fetchFavorites
      : productStore.fetchBlocked
    const result = await loader({
      page: targetPage,
      pageSize,
      search: state.search,
      signal: controller.signal
    })
    if (requestId !== state.requestId || result.aborted) return
    if (!result.success) throw new Error(result.error || '列表加载失败')
    const items = Array.isArray(result.data?.products) ? result.data.products : []
    const total = Number(result.data?.pagination?.total || 0)

    state.items = [...prefix, ...items]
    state.refreshPage = 0
    state.page = targetPage
    state.total = total
    state.hasMore = targetPage * pageSize < total
    state.loaded = true
  } catch (error) {
    if (requestId === state.requestId) state.error = error.message || '列表加载失败，请重试'
  } finally {
    if (requestId === state.requestId) {
      state.loading = false
      state.loadingMore = false
    }
  }
}

async function switchTab(tabId, { updateRoute = true } = {}) {
  if (!lists[tabId]) return
  activeTab.value = tabId
  if (updateRoute) {
    const query = { ...route.query, tab: tabId === 'blocked' ? 'blocked' : undefined }
    await router.replace({ query })
  }
  if (!lists[tabId].loaded) await loadCollection(tabId)
}

async function handleTabKeydown(event, index) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  let nextIndex = index
  if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
  if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
  if (event.key === 'Home') nextIndex = 0
  if (event.key === 'End') nextIndex = tabs.length - 1
  await switchTab(tabs[nextIndex].id)
  await nextTick()
  document.getElementById(`collection-tab-${tabs[nextIndex].id}`)?.focus()
}

async function searchActiveCollection() {
  await loadCollection(activeTab.value)
}

async function loadMore() {
  const state = activeState.value
  if (state.loading || state.loadingMore) return
  if (state.refreshPage) return loadCollection(activeTab.value, { page: state.refreshPage, replaceTail: true })
  await loadCollection(activeTab.value, { append: state.items.length > 0 })
}

async function removeCurrentItem(tabId, itemId) {
  const state = lists[tabId]
  state.items = state.items.filter(item => String(item.id) !== String(itemId))
  state.total = Math.max(0, state.total - 1)
  // Refill only the last loaded page: deletion shifts OFFSET, while the
  // preceding local prefix already contains the correct remaining items.
  state.refreshPage = Math.max(1, Math.min(state.page, Math.ceil(state.total / pageSize)))
  await loadCollection(tabId, { page: state.refreshPage, replaceTail: true })
}

function getErrorMessage(result, fallback) {
  if (typeof result?.error === 'object') return result.error?.message || result.error?.code || fallback
  return result?.error || fallback
}

async function removeFavorite(item) {
  if (!item?.id || isItemBusy(item.id)) return
  const confirmed = await dialog.confirm('确定从收藏中移除这件物品吗？', {
    title: '移除收藏',
    confirmText: '移除'
  })
  if (!confirmed) return

  currentAction.value = `favorite:${item.id}`
  try {
    const result = await productStore.removeFavorite(item.id)
    if (!result?.success) throw new Error(getErrorMessage(result, '移除收藏失败'))
    await removeCurrentItem('favorites', item.id)
    toast.success(result?.message || result?.data?.message || '已取消收藏')
  } catch (error) {
    toast.error(error.message || '移除收藏失败')
  } finally {
    currentAction.value = ''
  }
}

async function blockFavorite(item) {
  if (!item?.id || isItemBusy(item.id)) return
  const confirmed = await dialog.confirmDanger(
    '确认将这件物品标记为不感兴趣吗？<br><strong>它会从公开商品列表中隐藏，并同时移出收藏。</strong>',
    { title: '标记为不感兴趣', confirmText: '确认隐藏', cancelText: '暂不处理' }
  )
  if (!confirmed) return

  currentAction.value = `block:${item.id}`
  try {
    const result = await productStore.blockProduct(item.id)
    if (!result?.success) throw new Error(getErrorMessage(result, '设置不感兴趣失败'))
    await removeCurrentItem('favorites', item.id)
    lists.blocked.loaded = false
    toast.success(result?.message || result?.data?.message || '已标记为不感兴趣')
  } catch (error) {
    toast.error(error.message || '设置不感兴趣失败')
  } finally {
    currentAction.value = ''
  }
}

async function restoreProduct(item) {
  if (!item?.id || isItemBusy(item.id)) return
  currentAction.value = `restore:${item.id}`
  try {
    const result = await productStore.unblockProduct(item.id)
    if (!result?.success) throw new Error(getErrorMessage(result, '恢复展示失败'))
    await removeCurrentItem('blocked', item.id)
    toast.success(result?.message || result?.data?.message || '已恢复展示')
  } catch (error) {
    toast.error(error.message || '恢复展示失败')
  } finally {
    currentAction.value = ''
  }
}

watch(
  () => route.query.tab,
  (tab) => {
    const nextTab = tab === 'blocked' ? 'blocked' : 'favorites'
    if (route.name && route.name !== 'MyFavorites') return
    if (nextTab !== activeTab.value) void switchTab(nextTab, { updateRoute: false })
  }
)

onMounted(async () => {
  await Promise.all([loadCollection('favorites'), loadCollection('blocked')])
})
onBeforeRouteLeave(() => {
  savedScrollPosition = window.scrollY
  preferenceLists = [productStore.favorites, productStore.blockedProducts]
})
onActivated(async () => {
  const changed = preferenceLists && (preferenceLists[0] !== productStore.favorites || preferenceLists[1] !== productStore.blockedProducts)
  if (changed) {
    for (const [tab, state] of Object.entries(lists)) {
      const targetPage = state.page
      await loadCollection(tab)
      while (state.page < targetPage && state.hasMore && !state.error) await loadCollection(tab, { append: true })
    }
  }
  for (const [tab, state] of Object.entries(lists)) {
    if (!state.loaded && !state.loading && !state.error) void loadCollection(tab)
  }
  await nextTick()
  window.scrollTo(0, savedScrollPosition)
})
function stopLists() {
  for (const [tab, state] of Object.entries(lists)) {
    state.requestId++
    controllers[tab]?.abort()
    state.loading = false
    state.loadingMore = false
  }
}
onDeactivated(stopLists)
onUnmounted(stopLists)
</script>

<style scoped>
.collections-page { min-height: 100vh; padding-bottom: 80px; background: var(--bg-primary); }
.page-container { max-width: 960px; }
.page-header { position: relative; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 18px; padding-left: 18px; }
.page-header::before { position: absolute; inset: 2px auto 2px 0; width: 4px; border-radius: 999px; background: linear-gradient(180deg, var(--color-warning) 0 48%, var(--color-danger) 52% 100%); content: ''; }
.page-eyebrow { margin: 0 0 4px; color: var(--text-tertiary); font-size: 11px; font-weight: 700; letter-spacing: .14em; }
.page-title { margin: 0; color: var(--text-primary); font-size: var(--text-display); line-height: 1.2; }
.page-subtitle { margin: 7px 0 0; color: var(--text-tertiary); font-size: 13px; text-wrap: balance; }
.browse-link { min-height: 44px; display: inline-flex; align-items: center; padding: 0 16px; border: 1px solid var(--border-color); border-radius: 999px; background: var(--bg-card); color: var(--text-secondary); font-size: 13px; text-decoration: none; }
.collection-workspace { overflow: hidden; border: 1px solid var(--border-light); border-radius: 18px; background: var(--bg-card); box-shadow: var(--shadow-sm); }
.collection-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; padding: 7px; border-bottom: 1px solid var(--border-light); background: var(--bg-secondary); }
.collection-tab { min-height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid transparent; border-radius: 12px; background: transparent; color: var(--text-tertiary); font: inherit; font-size: 14px; font-weight: 650; cursor: pointer; transition: background .2s, border-color .2s, color .2s, transform .2s; }
.collection-tab:hover { color: var(--text-primary); }
.collection-workspace[data-mode='favorites'] .collection-tab.is-active { border-color: var(--palette-rgba-217-119-6-p24); background: var(--bg-card); color: var(--color-warning); }
.collection-workspace[data-mode='blocked'] .collection-tab.is-active { border-color: var(--palette-rgba-220-38-38-p22); background: var(--bg-card); color: var(--color-danger); }
.collection-tab:focus-visible, .browse-link:focus-visible, .action-btn:focus-visible, .search-button:focus-visible, .search-field:focus-within { outline: 3px solid var(--color-primary-light); outline-offset: 2px; }
.tab-count { min-width: 24px; padding: 2px 7px; border-radius: 999px; background: var(--bg-tertiary); color: currentColor; font-size: 11px; text-align: center; }
.collection-search { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 14px; border-bottom: 1px solid var(--border-light); }
.search-field { min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 13px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--bg-primary); color: var(--text-tertiary); }
.search-field input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--text-primary); font: inherit; font-size: 14px; }
.search-button { min-width: 72px; min-height: 44px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--bg-card); color: var(--text-secondary); font-weight: 650; cursor: pointer; }
.loading-wrap { min-height: 220px; display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--text-tertiary); font-size: 14px; }
.loading-dot { width: 9px; height: 9px; border-radius: 50%; background: currentColor; animation: loading-pulse 1s ease-in-out infinite alternate; }
.collection-list { display: grid; gap: 12px; padding: 14px; }
.collection-card { overflow: hidden; border: 1px solid var(--border-light); border-radius: 14px; background: var(--bg-card); transition: border-color .2s, transform .2s; }
.collection-card:hover { border-color: var(--border-hover); transform: translateY(-1px); }
.card-main { display: flex; gap: 14px; padding: 14px; }
.card-cover { width: 88px; height: 88px; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; overflow: hidden; border-radius: 11px; background: var(--bg-secondary); text-decoration: none; }
.cover-image { width: 100%; height: 100%; object-fit: cover; }
.cover-image.is-muted { filter: saturate(.35); opacity: .72; }
.cover-placeholder { color: var(--text-tertiary); font-size: 30px; }
.card-content { min-width: 0; flex: 1; }
.card-title-link { display: inline-block; color: inherit; text-decoration: none; }
.card-title { margin: 0; color: var(--text-primary); font-size: 17px; line-height: 1.35; }
.card-desc { display: -webkit-box; overflow: hidden; margin: 7px 0; color: var(--text-secondary); font-size: 13px; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.card-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
.meta-tag, .meta-time { color: var(--text-tertiary); font-size: 12px; }
.meta-price { color: var(--color-warning); font-size: 13px; font-weight: 700; }
.meta-info, .meta-status { padding: 2px 8px; border-radius: 999px; background: var(--bg-tertiary); color: var(--text-secondary); font-size: 11px; }
.meta-status.status-ai_approved, .meta-status.status-manual_approved { background: var(--color-success-bg); color: var(--color-success); }
.meta-status.status-offline_manual, .meta-status.status-ai_rejected, .meta-status.status-manual_rejected { background: var(--palette-rgba-220-38-38-p1); color: var(--color-danger); }
.meta-time { margin-left: auto; }
.card-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--border-light); background: var(--bg-secondary); }
.action-btn { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 14px; border: 1px solid var(--border-color); border-radius: 11px; background: var(--bg-card); color: var(--text-secondary); font-size: 13px; text-decoration: none; cursor: pointer; }
.action-btn.quiet-danger { border-color: var(--palette-rgba-220-38-38-p22); color: var(--color-danger); }
.action-btn.restore { border-color: var(--palette-rgba-34-197-94-p28); color: var(--color-success); }
.action-btn:disabled, .search-button:disabled { opacity: .56; cursor: not-allowed; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@keyframes loading-pulse { to { opacity: .28; transform: scale(.76); } }

@media (max-width: 639px) {
  .page-header { align-items: flex-start; gap: 12px; padding-left: 14px; }
  .page-subtitle { max-width: 240px; font-size: 12px; }
  .browse-link { min-width: 44px; padding: 0 12px; white-space: nowrap; }
  .collection-workspace { border-radius: 15px; }
  .collection-search { padding: 10px; }
  .collection-list { gap: 9px; padding: 10px; }
  .card-main { gap: 10px; padding: 11px; }
  .card-cover { width: 66px; height: 66px; border-radius: 9px; }
  .card-title { font-size: 14px; }
  .card-desc { margin: 4px 0; font-size: 12px; -webkit-line-clamp: 1; }
  .meta-time { width: 100%; margin-left: 0; }
  .card-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 9px 10px; }
  .card-actions .action-btn:last-child:nth-child(3) { grid-column: 1 / -1; }
}

@media (prefers-reduced-motion: reduce) {
  .collection-tab, .collection-card { transition: none; }
  .collection-card:hover { transform: none; }
  .loading-dot { animation: none; }
}
</style>
