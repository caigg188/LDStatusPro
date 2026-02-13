<template>
  <div class="my-buy-requests-page">
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">我的求购</h1>
          <p class="page-subtitle">管理你发布的求购信息与洽谈进度</p>
        </div>
        <div class="header-actions">
          <router-link to="/user/buy-chats" class="header-link">聊天洽谈</router-link>
          <router-link to="/publish?type=buy" class="create-btn">+ 发布求购</router-link>
        </div>
      </div>

      <div class="toolbar">
        <select v-model="statusFilter" class="toolbar-select" @change="loadRequests">
          <option value="">全部状态</option>
          <option value="pending_review">待审核</option>
          <option value="open">开放中</option>
          <option value="negotiating">洽谈中</option>
          <option value="matched">已匹配</option>
          <option value="closed">已关闭</option>
        </select>
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
              v-if="item.status !== 'closed'"
              class="action-btn danger"
              @click="updateStatus(item, 'closed')"
            >
              关闭求购
            </button>
            <button
              v-else
              class="action-btn"
              @click="updateStatus(item, 'open')"
            >
              重新开放
            </button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/utils/api'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { formatPrice, formatRelativeTime } from '@/utils/format'
import EmptyState from '@/components/common/EmptyState.vue'

const router = useRouter()
const toast = useToast()
const dialog = useDialog()

const loading = ref(false)
const requests = ref([])
const statusFilter = ref('')
const searchKeyword = ref('')

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

async function loadRequests() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: '1',
      pageSize: '100'
    })
    if (statusFilter.value) params.set('status', statusFilter.value)
    if (searchKeyword.value.trim()) params.set('search', searchKeyword.value.trim())

    const result = await api.get(`/api/shop/buy-requests/my?${params.toString()}`)
    if (result.success) {
      requests.value = result.data?.requests || []
    } else {
      toast.error(result.error || '加载求购失败')
    }
  } catch (error) {
    toast.error(error.message || '加载求购失败')
  } finally {
    loading.value = false
  }
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
    const result = await api.post(`/api/shop/buy-requests/${item.id}/status`, { status })
    if (!result.success) {
      toast.error(result.error || '状态更新失败')
      return
    }
    toast.success('状态已更新')
    await loadRequests()
  } catch (error) {
    toast.error(error.message || '状态更新失败')
  }
}

onMounted(loadRequests)
</script>

<style scoped>
.my-buy-requests-page {
  min-height: 100vh;
  padding-bottom: 80px;
  background: var(--bg-primary);
}

.page-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
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
  font-size: 24px;
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

.toolbar-select,
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
  color: #fff;
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
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
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
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
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
  background: var(--bg-secondary);
  color: var(--text-secondary);
  padding: 8px 12px;
  font-size: 13px;
}

.action-btn.primary {
  background: var(--color-success);
  border-color: var(--color-success);
  color: #fff;
}

.action-btn.danger {
  background: rgba(220, 38, 38, 0.1);
  border-color: rgba(220, 38, 38, 0.25);
  color: #dc2626;
}

@media (max-width: 720px) {
  .toolbar {
    grid-template-columns: 1fr;
  }

  .page-header {
    flex-direction: column;
  }
}
</style>
