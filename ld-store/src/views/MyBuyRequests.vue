<template>
  <div class="my-buy-requests-page">
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">我的求购</h1>
          <p class="page-subtitle">管理你发布的求购信息与洽谈进度</p>
        </div>
        <div class="header-actions">
          <router-link to="/user/messages" class="header-link">我的消息</router-link>
          <router-link to="/buy-requests/new" class="create-btn">+ 发布求购</router-link>
        </div>
      </div>

      <div class="toolbar">
        <AppSelect
          v-model="statusFilter"
          class="toolbar-select"
          :options="statusOptions"
          placeholder="全部状态"
          full-width
          variant="toolbar"
          @change="loadRequests"
        />
        <input
          v-model="searchKeyword"
          type="text"
          class="toolbar-input"
          placeholder="搜索标题或内容"
          @keyup.enter="loadRequests"
        />
        <button class="toolbar-btn" @click="loadRequests">搜索</button>
      </div>

      <div v-if="loading" class="loading-wrap">
        <p>加载中...</p>
      </div>

      <div v-else-if="requests.length === 0" class="empty-wrap">
        <EmptyState icon="🌱" text="暂无求购" hint="你还没有发布求购信息" />
      </div>

      <div v-else class="card-list">
        <article v-for="item in requests" :key="item.id" class="request-card">
          <div class="card-top">
            <div>
              <h3 class="request-title">{{ item.title }}</h3>
              <p class="request-meta">
                <span>{{ formatPrice(item.budgetPrice) }} LDC</span>
                <span>·</span>
                <span>{{ formatRelativeTime(item.updatedAt || item.createdAt) }}</span>
              </p>
            </div>
            <span class="status-badge" :class="`status-${item.status}`">
              {{ statusText(item.status) }}
            </span>
          </div>

          <p class="request-details">{{ item.details }}</p>

          <div class="request-public">
            <span>公开账号：{{ item.requesterPublicUsername }}</span>
            <span>公开密码：{{ item.requesterPublicPassword }}</span>
          </div>

          <div class="request-stats">
            <span>会话：{{ item.sessionCount || 0 }}</span>
            <span>待确认：{{ item.paidSessionCount || 0 }}</span>
          </div>

          <div class="card-actions">
            <button class="action-btn primary" @click="openDetail(item.id)">查看详情</button>
            <button
              v-if="['pending_review', 'open', 'negotiating', 'matched'].includes(item.status)"
              class="action-btn danger"
              @click="updateStatus(item, 'closed')"
            >
              关闭求购
            </button>
            <button
              v-else-if="item.status === 'closed'"
              class="action-btn"
              @click="updateStatus(item, 'open')"
            >
              重新开放
            </button>
          </div>
        </article>
      </div>
      <nav v-if="pagination.totalPages > 1" class="request-pagination" aria-label="我的求购分页">
        <button type="button" :disabled="loading || pagination.page <= 1" @click="goPage(pagination.page - 1)">上一页</button>
        <span>第 {{ pagination.page }} / {{ pagination.totalPages }} 页 · 共 {{ pagination.total }} 条</span>
        <button type="button" :disabled="loading || pagination.page >= pagination.totalPages" @click="goPage(pagination.page + 1)">下一页</button>
      </nav>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchMyBuyRequestsRequest, updateBuyRequestStatusRequest } from '@/services/shop/buyRequestService'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { formatPrice, formatRelativeTime } from '@/utils/format'
import AppSelect from '@/components/common/AppSelect.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const router = useRouter()
const toast = useToast()
const dialog = useDialog()

const loading = ref(false)
const requests = ref([])
const statusFilter = ref('')
const searchKeyword = ref('')
const pagination = reactive({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
let requestId = 0
let controller = null
let appliedFilters = { status: '', search: '' }

const statusOptions = [
  { value: 'pending_review', label: '待审核' },
  { value: 'open', label: '开放中' },
  { value: 'negotiating', label: '洽谈中' },
  { value: 'matched', label: '已匹配' },
  { value: 'closed', label: '已关闭' }
]

function statusText(status) {
  const map = {
    pending_review: '待审核',
    open: '开放中',
    negotiating: '洽谈中',
    matched: '已匹配',
    closed: '已关闭',
    blocked: '已处理'
  }
  return map[status] || status
}

async function loadRequests(requestedPage = 1) {
  const nextPage = typeof requestedPage === 'number' ? requestedPage : 1
  if (nextPage === 1) appliedFilters = { status: statusFilter.value, search: searchKeyword.value }
  const request = ++requestId
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  try {
    const result = await fetchMyBuyRequestsRequest({
      page: nextPage,
      pageSize: pagination.pageSize,
      ...appliedFilters,
      signal: controller.signal
    })
    if (request !== requestId || result.aborted) return
    if (result.success) {
      Object.assign(pagination, result.data.pagination)
      requests.value = result.data?.requests || []
    } else {
      toast.error(result.error || '加载求购失败')
    }
  } catch (error) {
    if (request === requestId) toast.error(error.message || '加载求购失败')
  } finally {
    if (request === requestId) loading.value = false
  }
}

function goPage(nextPage) {
  if (!loading.value) void loadRequests(nextPage)
}

function openDetail(id) {
  router.push(`/buy-request/${id}`)
}

async function updateStatus(item, status) {
  const confirmed = await dialog.confirm(
    status === 'closed' ? '确定关闭这条求购吗？' : '确定重新开放这条求购吗？',
    { title: '状态变更' }
  )
  if (!confirmed) return

  try {
    const result = await updateBuyRequestStatusRequest(item.id, status)
    if (!result.success) {
      toast.error(result.error || '状态更新失败')
      return
    }
    toast.success('状态已更新')
    await loadRequests(pagination.page)
  } catch (error) {
    toast.error(error.message || '状态更新失败')
  }
}

onMounted(loadRequests)
onUnmounted(() => { requestId++; controller?.abort() })
</script>

<style scoped>
.my-buy-requests-page {
  min-height: 100vh;
  padding-bottom: 80px;
  background: var(--bg-primary);
}

.page-container {
  max-width: 900px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-link,
.create-btn {
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  background: var(--bg-card);
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 13px;
  text-decoration: none;
  white-space: nowrap;
}

.create-btn {
  border-color: var(--color-success);
  color: var(--color-success);
  background: var(--color-success-bg);
}

.page-title {
  margin: 0;
  font-size: var(--text-display);
  color: var(--text-primary);
}

.page-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-tertiary);
}

.toolbar {
  display: grid;
  grid-template-columns: 140px 1fr 90px;
  gap: 10px;
  margin-bottom: 14px;
}

.toolbar-select {
  min-width: 0;
}

.toolbar-input {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-primary);
  padding: 10px 12px;
  font-size: 14px;
}

.toolbar-btn {
  border: none;
  border-radius: 10px;
  background: var(--color-success);
  color: var(--palette-hex-ffffff);
  font-weight: 600;
}

.loading-wrap,
.empty-wrap {
  padding: 40px 12px;
  text-align: center;
  color: var(--text-tertiary);
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.request-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 14px;
  isolation: isolate;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.request-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 17px;
}

.request-meta {
  margin: 6px 0 0;
  color: var(--text-tertiary);
  font-size: 13px;
  display: flex;
  gap: 6px;
  align-items: center;
}

.status-badge {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.status-pending_review {
  background: var(--palette-hex-fef3c7);
  color: var(--palette-hex-b45309);
}

.status-open {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-negotiating {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.status-matched {
  background: var(--palette-hex-dbeafe);
  color: var(--palette-hex-2563eb);
}

.status-closed,
.status-blocked {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

.request-details {
  margin: 10px 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.request-public {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.request-stats {
  margin-top: 8px;
  display: flex;
  gap: 10px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.card-actions {
  margin-top: 12px;
  display: flex;
  gap: 10px;
}

.action-btn {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  padding: 8px 12px;
  font-size: 13px;
}

.action-btn.primary {
  background: var(--color-success);
  border-color: var(--color-success);
  color: var(--palette-hex-ffffff);
}

.action-btn.danger {
  background: var(--palette-hex-fee2e2);
  border-color: var(--palette-hex-f5c6d0);
  color: var(--palette-hex-dc2626);
}

.request-pagination { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 20px; color: var(--text-secondary); font-size: 13px; }
.request-pagination button { min-height: 44px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-card); color: inherit; cursor: pointer; }
.request-pagination button:disabled { opacity: .5; cursor: not-allowed; }
.request-pagination button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }

@media (max-width: 767px) {
  .my-buy-requests-page { padding-bottom: calc(160px + env(safe-area-inset-bottom)); }
  .toolbar {
    grid-template-columns: 1fr;
  }

  .page-header {
    flex-direction: column;
  }
}

/* Dark mode overrides */
:global(html.dark) .status-pending_review {
  background: var(--palette-hex-363024);
}

:global(html.dark) .status-matched {
  background: var(--palette-hex-2a3040);
}

:global(html.dark) .action-btn.danger {
  background: var(--palette-hex-3a2225);
  border-color: var(--palette-hex-4a2c30);
}
</style>
