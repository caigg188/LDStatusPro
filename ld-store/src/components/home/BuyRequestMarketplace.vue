<template>
  <section id="home-panel-buy" class="section-content" role="tabpanel" aria-labelledby="home-tab-buy" tabindex="0">
    <div class="buy-header">
      <p class="buy-desc">
        🚨 为了保证双方的权益，请勿在私信中直接联系方式。沟通好积分后支付LDC后会开放双方L站联系方式！🪧
        <router-link to="/docs/buy-request" class="buy-guide-link">查看求购操作指南👈</router-link>
      </p>
      <button type="button" class="buy-publish-btn" @click="publishBuyRequest">+ 发布求购</button>
    </div>

    <div class="buy-toolbar">
      <AppSelect
        v-model="statusFilter"
        :options="[{ value: '', label: '全部状态' }, ...statusOptions]"
        variant="toolbar"
        class="buy-toolbar-select"
        @change="loadRequests()"
      />
      <div class="buy-toolbar-search">
        <label for="home-buy-search" class="sr-only">搜索求购</label>
        <input
          id="home-buy-search"
          v-model="searchKeyword"
          type="search"
          class="buy-toolbar-input"
          placeholder="搜索求购标题或内容"
          @keyup.enter="loadRequests()"
        />
        <button type="button" class="buy-toolbar-btn buy-toolbar-btn-search" aria-label="搜索求购" @click="loadRequests()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
      </div>
      <button type="button" class="buy-toolbar-btn secondary buy-toolbar-btn-refresh" @click="refreshBatch">换一批</button>
    </div>

    <div class="products-header"><span class="products-count">求购信息 <strong>{{ pagination.total }}</strong> 条</span></div>

    <div v-if="loading || !initialized" class="products-loading">
      <Skeleton type="card" :count="6" :columns="gridColumns" />
    </div>

    <div v-else-if="requests.length > 0" class="buy-grid" :aria-busy="loading">
      <article v-for="item in requests" :key="item.id" class="buy-card">
        <router-link :to="`/buy-request/${item.id}`" class="buy-card-link" :aria-label="`查看求购：${item.title}`">
          <div class="buy-card-head">
            <h3 class="buy-card-title">{{ item.title }}</h3>
            <span :class="['buy-status-pill', `buy-status-${statusClass(item.status)}`]">{{ statusText(item.status) }}</span>
          </div>
          <p class="buy-card-detail">{{ item.details }}</p>
          <div class="buy-card-meta">
            <span class="buy-price">{{ item.budgetPrice }} LDC</span><span class="buy-meta-sep">·</span>
            <span>{{ item.requesterPublicUsername }}</span><span class="buy-meta-sep">·</span>
            <span>密码 {{ item.requesterPublicPassword }}</span>
          </div>
          <div class="buy-card-footer">
            <span>会话 {{ item.sessionCount || 0 }}</span>
            <span>{{ formatRelativeTime(item.updatedAt || item.createdAt) }}</span>
          </div>
        </router-link>
      </article>
    </div>

    <EmptyState v-else icon="🌱" text="暂无求购信息" hint="你可以先发布你的需求，等待服务方联系">
      <template #action><button type="button" class="btn btn-primary mt-4" @click="publishBuyRequest">+ 发布求购</button></template>
    </EmptyState>

    <div v-if="pagination.totalPages > 1" class="buy-pagination">
      <button type="button" class="buy-page-btn" :disabled="pagination.page <= 1 || loading" @click="goPage(pagination.page - 1)">上一页</button>
      <span class="buy-page-text">第 {{ pagination.page }} / {{ pagination.totalPages }} 页</span>
      <button type="button" class="buy-page-btn" :disabled="pagination.page >= pagination.totalPages || loading" @click="goPage(pagination.page + 1)">下一页</button>
    </div>
  </section>
</template>

<script setup>
import { onActivated, onDeactivated, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useToast } from '@/composables/useToast'
import { formatRelativeTime } from '@/utils/format'
import { fetchMarketplaceBuyRequests } from '@/services/homeMarketplaceService'
import AppSelect from '@/components/common/AppSelect.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Skeleton from '@/components/common/Skeleton.vue'
import { catalogColumns } from '@/config/breakpoints'

defineOptions({ name: 'BuyRequestMarketplace' })

const CACHE_TTL = 2 * 60 * 1000
const router = useRouter()
const userStore = useUserStore()
const toast = useToast()
const requests = ref([])
const loading = ref(false)
const initialized = ref(false)
const statusFilter = ref('')
const searchKeyword = ref('')
const gridColumns = ref(2)
const pagination = reactive({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
const statusOptions = [
  { value: 'open', label: '开放中' },
  { value: 'negotiating', label: '洽谈中' },
  { value: 'matched', label: '已匹配' }
]
let activeRequest = null
let requestId = 0
let lastLoadedAt = 0
let sortSeed = crypto.randomUUID()
let appliedFilters = { status: '', search: '' }

function updateGridColumns() {
  gridColumns.value = catalogColumns(window.innerWidth)
}

function statusText(status) {
  return ({ open: '开放中', negotiating: '洽谈中', matched: '已匹配', closed: '已关闭', blocked: '已处理' })[status] || status
}

function statusClass(status) {
  const value = String(status || '').toLowerCase()
  return ['open', 'negotiating', 'matched', 'closed', 'blocked', 'pending_review'].includes(value) ? value : 'default'
}

async function loadRequests(requestedPage = 1, requestedSeed = sortSeed) {
  const filters = requestedPage === 1 ? { status: statusFilter.value, search: searchKeyword.value } : appliedFilters
  activeRequest?.abort()
  activeRequest = new AbortController()
  const currentRequestId = ++requestId
  loading.value = true
  try {
    const result = await fetchMarketplaceBuyRequests({
      page: requestedPage,
      pageSize: pagination.pageSize,
      sortSeed: requestedSeed,
      ...filters,
      signal: activeRequest.signal
    })
    if (currentRequestId !== requestId || result.aborted) return
    if (!result.success || !result.data) {
      toast.error(result.error || '加载求购信息失败，请稍后重试')
      return
    }
    pagination.page = requestedPage
    sortSeed = requestedSeed
    appliedFilters = filters
    requests.value = result.data.requests || []
    pagination.total = result.data.pagination?.total || 0
    pagination.totalPages = result.data.pagination?.totalPages || 0
    lastLoadedAt = Date.now()
  } catch (error) {
    if (currentRequestId === requestId) toast.error(error.message || '加载求购信息失败，请稍后重试')
  } finally {
    if (currentRequestId === requestId) {
      loading.value = false
      initialized.value = true
    }
  }
}

function refreshBatch() {
  return loadRequests(1, crypto.randomUUID())
}

function goPage(page) {
  if (page < 1 || page > pagination.totalPages) return
  loadRequests(page)
}

function publishBuyRequest() {
  if (!userStore.isLoggedIn) {
    router.push({ name: 'Login', query: { redirect: '/buy-requests/new' } })
    return
  }
  router.push('/buy-requests/new')
}

onMounted(() => {
  updateGridColumns()
  window.addEventListener('resize', updateGridColumns)
  loadRequests()
})

onActivated(() => {
  window.addEventListener('resize', updateGridColumns)
  if (!loading.value && (!initialized.value || Date.now() - lastLoadedAt >= CACHE_TTL)) loadRequests(pagination.page)
})

onDeactivated(() => {
  requestId++
  activeRequest?.abort()
  loading.value = false
  if (!requests.value.length) initialized.value = false
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
.buy-header, .buy-toolbar, .products-header, .buy-card-head, .buy-card-meta, .buy-card-footer, .buy-pagination { display: flex; align-items: center; }
.buy-header { margin-bottom: 14px; padding: 16px 20px; background: var(--palette-hex-eef7f0); border: 1px solid var(--palette-hex-bde8cc); border-radius: 14px; justify-content: space-between; gap: 12px; }
.buy-desc { margin: 0; font-size: 14px; color: var(--text-secondary); }.buy-guide-link { color: var(--color-success); }
.buy-publish-btn, .buy-toolbar-btn { min-height: 38px; border: 0; border-radius: 10px; background: var(--color-success); color: var(--palette-hex-ffffff); font-size: 13px; font-weight: 600; padding: 8px 12px; cursor: pointer; white-space: nowrap; }
.buy-toolbar { gap: 10px; margin-bottom: 12px; }.buy-toolbar-select { flex-shrink: 0; min-width: 120px; }.buy-toolbar-search { flex: 1; position: relative; min-width: 0; }
.buy-toolbar-input { width: 100%; min-height: 40px; box-sizing: border-box; border: 1px solid var(--border-color); border-radius: 10px; background: var(--input-bg); color: var(--text-primary); font-size: 14px; padding: 10px 44px 10px 12px; }
.buy-toolbar-input:focus { outline: 0; background: var(--input-focus-bg); border-color: var(--input-focus-border); box-shadow: 0 2px 8px var(--glass-shadow-light); }
.buy-toolbar-btn.secondary { background: var(--bg-tertiary); color: var(--text-secondary); }.buy-toolbar-btn-search { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); display: grid; place-items: center; width: 32px; height: 32px; padding: 0; background: var(--glass-bg-heavy); color: var(--text-secondary); }
.products-header { justify-content: space-between; gap: 12px; margin-bottom: 16px; }.products-count { font-size: 13px; color: var(--text-tertiary); }.products-count strong { color: var(--text-primary); }
.buy-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--grid-gap); }
.buy-card { height: 100%; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 14px; isolation: isolate; transition: transform .2s ease; }.buy-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); }
.buy-card-link { display: flex; flex-direction: column; height: 100%; padding: 14px; border-radius: inherit; color: inherit; text-decoration: none; }.buy-card-link:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
.buy-card-head { align-items: flex-start; justify-content: space-between; gap: 8px; }.buy-card-title { margin: 0; color: var(--text-primary); font-size: 15px; line-height: 1.4; }
.buy-status-pill { border-radius: 999px; font-size: 11px; padding: 3px 8px; color: var(--text-secondary); background: var(--bg-secondary); white-space: nowrap; border: 1px solid var(--border-light); }
.buy-status-open { color: var(--palette-hex-0f6b3a); background: var(--palette-hex-e9f9ef); border-color: var(--palette-hex-bdebcf); }.buy-status-negotiating { color: var(--palette-hex-8a4b08); background: var(--palette-hex-fff4e6); border-color: var(--palette-hex-ffd7ad); }.buy-status-matched { color: var(--palette-hex-1249a3); background: var(--palette-hex-ebf3ff); border-color: var(--palette-hex-bfd8ff); }.buy-status-closed, .buy-status-blocked { color: var(--palette-hex-6b7280); background: var(--palette-hex-f3f4f6); border-color: var(--palette-hex-d1d5db); }.buy-status-pending_review { color: var(--palette-hex-7a2e0e); background: var(--palette-hex-fff1ec); border-color: var(--palette-hex-ffc9b5); }
.buy-card-detail { margin: 10px 0 0; color: var(--text-secondary); font-size: 13px; line-height: 1.55; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; }
.buy-card-meta { margin-top: auto; padding-top: 10px; color: var(--text-tertiary); font-size: 12px; flex-wrap: wrap; gap: 5px; }.buy-price { color: var(--color-warning); font-weight: 600; }.buy-meta-sep { opacity: .5; }
.buy-card-footer { margin-top: 8px; padding-top: 10px; border-top: 1px dashed var(--border-light); justify-content: space-between; color: var(--text-tertiary); font-size: 12px; }
.buy-pagination { margin-top: 14px; justify-content: center; gap: 10px; }.buy-page-btn { min-height: 36px; border: 1px solid var(--border-color); border-radius: 9px; background: var(--bg-secondary); color: var(--text-secondary); padding: 6px 10px; cursor: pointer; }.buy-page-btn:disabled { opacity: .5; cursor: not-allowed; }.buy-page-text { color: var(--text-tertiary); font-size: 13px; }
.products-loading { min-height: 360px; padding: 20px 0; }
@media (min-width: 768px) { .buy-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1024px) { .buy-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (max-width: 639px) { .buy-header { flex-direction: column; align-items: flex-start; }.buy-toolbar { gap: 6px; }.buy-toolbar-input, .buy-toolbar-btn, .buy-publish-btn, .buy-page-btn { min-height: 44px; }.buy-toolbar-input { font-size: 16px; }.buy-toolbar-btn-search { width: 40px; height: 40px; } }
:global(html.dark) .buy-header { background: var(--palette-hex-1e2a20); border-color: var(--palette-hex-2a3f2e); }
@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .section-content { animation: none; } .buy-card { transition: none; } .buy-card:hover { transform: none; } }
</style>
