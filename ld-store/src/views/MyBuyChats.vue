<template>
  <div class="buy-chats-page">
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">聊天洽谈</h1>
          <p class="page-subtitle">查看你参与的求购会话与消息进度</p>
        </div>
        <router-link to="/user/buy-requests" class="link-btn">我发布的求购</router-link>
      </div>

      <div class="summary-card">
        <div class="summary-item">
          <span class="summary-label">总会话</span>
          <span class="summary-value">{{ summary.totalSessions || 0 }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">有未读会话</span>
          <span class="summary-value">{{ summary.sessionsWithUnread || 0 }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">未读消息</span>
          <span class="summary-value highlight">{{ summary.totalUnread || 0 }}</span>
        </div>
      </div>

      <div class="toolbar">
        <select v-model="filter.role" class="toolbar-select" @change="loadSessions(true)">
          <option value="">全部身份</option>
          <option value="requester">我是求购方</option>
          <option value="provider">我是服务方</option>
        </select>
        <select v-model="filter.status" class="toolbar-select" @change="loadSessions(true)">
          <option value="">全部会话状态</option>
          <option v-for="item in sessionStatusOptions" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
        <input
          v-model="filter.search"
          type="text"
          class="toolbar-input"
          placeholder="搜索求购标题/公开账号"
          @keyup.enter="loadSessions(true)"
        />
        <button class="toolbar-btn primary" @click="loadSessions(true)">搜索</button>
        <button class="toolbar-btn" @click="resetFilter">重置</button>
      </div>

      <div v-if="loading" class="state-wrap">加载中...</div>
      <div v-else-if="sessions.length === 0" class="state-wrap">
        <EmptyState icon="🌱" text="暂无洽谈会话" hint="先去求购广场发起或参与洽谈" />
      </div>

      <div v-else class="session-list">
        <article v-for="item in sessions" :key="item.id" class="session-card">
          <div class="card-top">
            <div class="top-main">
              <h3 class="request-title">{{ item.request?.title || '-' }}</h3>
              <p class="request-meta">
                <span>{{ formatPrice(item.request?.budgetPrice || 0) }} LDC</span>
                <span>·</span>
                <span>{{ requestStatusText(item.request?.status) }}</span>
                <span>·</span>
                <span>{{ formatRelativeTime(item.lastMessageAt || item.updatedAt || item.createdAt) }}</span>
              </p>
            </div>
            <div class="top-right">
              <span class="role-badge">{{ roleText(item.role) }}</span>
              <span class="status-badge" :class="`status-${item.status}`">{{ sessionStatusText(item.status) }}</span>
            </div>
          </div>

          <div class="identity-row">
            <span>对方公开账号：{{ item.counterpartyPublicUsername || '-' }}</span>
            <span>密码：{{ item.counterpartyPublicPassword || '-' }}</span>
          </div>

          <div class="latest-message" v-if="item.latestMessage?.content">
            {{ item.latestMessage.content }}
          </div>
          <div class="latest-message muted" v-else>
            暂无消息
          </div>

          <div class="card-bottom">
            <span class="unread-badge" v-if="item.unreadCount > 0">未读 {{ item.unreadCount }}</span>
            <span class="unread-badge muted" v-else>已读</span>
            <button class="enter-btn" @click="openSession(item)">进入会话</button>
          </div>
        </article>
      </div>

      <div v-if="pagination.totalPages > 1" class="pager">
        <button :disabled="pagination.page <= 1" @click="goPage(pagination.page - 1)">上一页</button>
        <span>{{ pagination.page }} / {{ pagination.totalPages }}</span>
        <button :disabled="pagination.page >= pagination.totalPages" @click="goPage(pagination.page + 1)">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/utils/api'
import { useToast } from '@/composables/useToast'
import { formatPrice, formatRelativeTime } from '@/utils/format'
import EmptyState from '@/components/common/EmptyState.vue'

const router = useRouter()
const toast = useToast()

const loading = ref(false)
const sessions = ref([])
const summary = ref({
  totalUnread: 0,
  sessionsWithUnread: 0,
  totalSessions: 0
})

const filter = reactive({
  role: '',
  status: '',
  search: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0
})

const sessionStatusOptions = [
  { value: 'negotiating', label: '洽谈中' },
  { value: 'paid_pending_confirm', label: '待确认' },
  { value: 'paid', label: '已确认' },
  { value: 'closed', label: '已关闭' },
  { value: 'cancelled', label: '已取消' }
]

let summaryTimer = null

function roleText(role) {
  if (role === 'requester') return '求购方'
  if (role === 'provider') return '服务方'
  return role || '未知'
}

function requestStatusText(status) {
  const map = {
    pending_review: '待审核',
    open: '开放中',
    negotiating: '洽谈中',
    matched: '已匹配',
    closed: '已关闭',
    blocked: '已处理'
  }
  return map[status] || status || '-'
}

function sessionStatusText(status) {
  return sessionStatusOptions.find((item) => item.value === status)?.label || status
}

async function loadSummary() {
  try {
    const result = await api.get('/api/shop/buy-sessions/unread-summary')
    if (!result.success) return
    summary.value = {
      totalUnread: Number(result.data?.totalUnread || 0),
      sessionsWithUnread: Number(result.data?.sessionsWithUnread || 0),
      totalSessions: Number(result.data?.totalSessions || 0)
    }
  } catch (_) {
    // ignore polling errors
  }
}

async function loadSessions(reset = false) {
  if (reset) pagination.page = 1

  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(pagination.page),
      pageSize: String(pagination.pageSize)
    })
    if (filter.status) params.set('status', filter.status)
    if (filter.role) params.set('role', filter.role)
    if (filter.search.trim()) params.set('search', filter.search.trim())

    const result = await api.get(`/api/shop/buy-sessions/my?${params.toString()}`)
    if (!result.success) {
      toast.error(result.error || '加载会话失败')
      return
    }

    sessions.value = result.data?.sessions || []
    const pageData = result.data?.pagination || {}
    pagination.total = Number(pageData.total || 0)
    pagination.totalPages = Number(pageData.totalPages || 0)
    summary.value = {
      totalUnread: Number(result.data?.summary?.totalUnread || 0),
      sessionsWithUnread: Number(result.data?.summary?.sessionsWithUnread || 0),
      totalSessions: Number(pageData.total || 0)
    }
  } catch (error) {
    toast.error(error.message || '加载会话失败')
  } finally {
    loading.value = false
  }
}

function resetFilter() {
  filter.role = ''
  filter.status = ''
  filter.search = ''
  loadSessions(true)
}

function goPage(page) {
  if (page < 1 || page > pagination.totalPages) return
  pagination.page = page
  loadSessions()
}

function openSession(session) {
  const requestId = Number(session?.request?.id || 0)
  const sessionId = Number(session?.id || 0)
  if (!requestId || !sessionId) return

  router.push({
    path: `/buy-request/${requestId}`,
    query: { session: String(sessionId) }
  })
}

function startSummaryPolling() {
  stopSummaryPolling()
  summaryTimer = setInterval(loadSummary, 10000)
}

function stopSummaryPolling() {
  if (summaryTimer) {
    clearInterval(summaryTimer)
    summaryTimer = null
  }
}

onMounted(async () => {
  await loadSessions(true)
  startSummaryPolling()
})

onUnmounted(() => {
  stopSummaryPolling()
})
</script>

<style scoped>
.buy-chats-page {
  min-height: 100vh;
  padding-bottom: 80px;
  background: var(--bg-primary);
}

.page-container {
  max-width: 980px;
  margin: 0 auto;
  padding: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
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

.link-btn {
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: 10px;
  text-decoration: none;
  padding: 8px 12px;
  font-size: 13px;
}

.summary-card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

.summary-item {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.summary-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.summary-value.highlight {
  color: var(--color-warning);
}

.toolbar {
  display: grid;
  grid-template-columns: 160px 180px 1fr auto auto;
  gap: 10px;
  margin-bottom: 12px;
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
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-secondary);
  padding: 0 14px;
  font-size: 13px;
}

.toolbar-btn.primary {
  border-color: var(--color-success);
  background: var(--color-success);
  color: #fff;
}

.state-wrap {
  padding: 40px 12px;
  text-align: center;
  color: var(--text-tertiary);
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.session-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 14px;
}

.card-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.top-main {
  min-width: 0;
  flex: 1;
}

.top-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.request-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 17px;
}

.request-meta {
  margin: 6px 0 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.role-badge {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 999px;
  padding: 2px 10px;
}

.status-badge {
  font-size: 12px;
  border-radius: 999px;
  padding: 2px 10px;
}

.status-negotiating {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.status-paid_pending_confirm {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.status-paid {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-closed,
.status-cancelled {
  background: var(--bg-secondary);
  color: var(--text-tertiary);
}

.identity-row {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.latest-message {
  margin-top: 10px;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  border-radius: 10px;
  padding: 10px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.latest-message.muted {
  color: var(--text-tertiary);
}

.card-bottom {
  margin-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.unread-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.unread-badge.muted {
  background: var(--bg-secondary);
  color: var(--text-tertiary);
}

.enter-btn {
  border: none;
  border-radius: 10px;
  background: var(--color-success);
  color: #fff;
  font-size: 13px;
  padding: 8px 14px;
}

.pager {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.pager button {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-secondary);
  padding: 6px 10px;
}

.pager button:disabled {
  opacity: 0.55;
}

@media (max-width: 760px) {
  .summary-card {
    grid-template-columns: 1fr;
  }

  .toolbar {
    grid-template-columns: 1fr;
  }

  .card-top {
    flex-direction: column;
  }

  .top-right {
    justify-content: flex-start;
  }
}
</style>
