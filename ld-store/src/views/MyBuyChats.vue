<template>
  <div class="messages-page">
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">我的消息</h1>
          <p class="page-subtitle">集中查看系统消息与求购洽谈进展</p>
        </div>
        <router-link to="/user/buy-requests" class="link-btn">我发布的求购</router-link>
      </div>

      <div class="summary-card">
        <div class="summary-item">
          <span class="summary-label">总未读</span>
          <span class="summary-value highlight">{{ summary.totalUnread || 0 }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">系统未读</span>
          <span class="summary-value">{{ summary.systemUnread || 0 }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">洽谈未读</span>
          <span class="summary-value">{{ summary.buyChatUnread || 0 }}</span>
        </div>
      </div>

      <div class="tab-switch">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'system' }"
          @click="switchTab('system')"
        >
          系统消息
          <span v-if="summary.systemUnread > 0" class="tab-badge">{{ unreadDisplay(summary.systemUnread) }}</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'buy' }"
          @click="switchTab('buy')"
        >
          求购洽谈
          <span v-if="summary.buyChatUnread > 0" class="tab-badge">{{ unreadDisplay(summary.buyChatUnread) }}</span>
        </button>
      </div>

      <section v-if="activeTab === 'system'" class="panel-wrap">
        <div class="toolbar">
          <AppSelect
            v-model="systemFilter.readStatus"
            class="toolbar-select"
            :options="systemReadStatusOptions"
            placeholder="全部状态"
            full-width
            variant="toolbar"
            @change="loadSystemMessages(true)"
          />
          <input
            v-model="systemFilter.search"
            type="text"
            class="toolbar-input"
            placeholder="搜索系统消息"
            @keyup.enter="loadSystemMessages(true)"
          />
          <button class="toolbar-btn search-btn primary" @click="loadSystemMessages(true)">搜索</button>
          <button class="toolbar-btn" @click="resetSystemFilter">重置</button>
          <button
            class="toolbar-btn"
            :disabled="markAllSystemLoading || summary.systemUnread <= 0"
            @click="markAllSystemRead"
          >
            {{ markAllSystemLoading ? '处理中...' : '全部标记已读' }}
          </button>
        </div>

        <div v-if="systemLoading" class="state-wrap">加载中...</div>
        <div v-else-if="systemMessages.length === 0" class="state-wrap">
          <EmptyState icon="📭" text="暂无系统消息" hint="你的系统通知会显示在这里" />
        </div>

        <div v-else class="system-list">
          <article
            v-for="item in systemMessages"
            :key="item.id"
            class="system-card"
            :class="{ unread: !item.isRead }"
          >
            <div class="system-top">
              <div class="system-title-row">
                <h3 class="system-title">{{ item.title || '系统消息' }}</h3>
                <span class="status-pill" :class="item.isRead ? 'read' : 'unread'">
                  {{ item.isRead ? '已读' : '未读' }}
                </span>
              </div>
              <span class="system-time">{{ formatRelativeTime(item.createdAt || 0) }}</span>
            </div>

            <ExpandableText
              class="system-content"
              as="p"
              :text="item.content || '-'"
            />

            <div class="system-bottom">
              <span class="system-meta">
                {{ systemMessageTypeText(item.messageType) }}
              </span>
              <div class="system-actions">
                <button
                  v-if="!item.isRead"
                  class="mini-btn"
                  :disabled="markingSystemId === item.id"
                  @click="markSystemMessageRead(item)"
                >
                  {{ markingSystemId === item.id ? '处理中...' : '标记已读' }}
                </button>
                <button v-if="item.link" class="mini-btn primary" @click="openSystemMessage(item)">查看详情</button>
              </div>
            </div>
          </article>
        </div>

        <div v-if="systemPagination.totalPages > 1" class="pager">
          <span class="pager-summary">共 {{ systemPagination.total }} 条，每页 {{ systemPagination.pageSize }} 条</span>
          <button :disabled="systemPagination.page <= 1" @click="goSystemPage(systemPagination.page - 1)">上一页</button>
          <span>{{ systemPagination.page }} / {{ systemPagination.totalPages }}</span>
          <button
            :disabled="systemPagination.page >= systemPagination.totalPages"
            @click="goSystemPage(systemPagination.page + 1)"
          >
            下一页
          </button>
        </div>
      </section>

      <section v-else class="panel-wrap">
        <div class="toolbar">
          <AppSelect
            v-model="buyFilter.role"
            class="toolbar-select"
            :options="buyRoleOptions"
            placeholder="全部身份"
            full-width
            variant="toolbar"
            @change="loadSessions(true)"
          />
          <AppSelect
            v-model="buyFilter.status"
            class="toolbar-select"
            :options="sessionStatusOptions"
            placeholder="全部会话状态"
            full-width
            variant="toolbar"
            @change="loadSessions(true)"
          />
          <input
            v-model="buyFilter.search"
            type="text"
            class="toolbar-input"
            placeholder="搜索求购标题/公开账号"
            @keyup.enter="loadSessions(true)"
          />
          <button class="toolbar-btn search-btn primary" @click="loadSessions(true)">搜索</button>
          <button class="toolbar-btn" @click="resetBuyFilter">重置</button>
        </div>

        <div v-if="buyLoading" class="state-wrap">加载中...</div>
        <div v-else-if="sessions.length === 0" class="state-wrap">
          <EmptyState icon="🌱" text="暂无洽谈会话" hint="先去求购广场发起或参与洽谈" />
        </div>

        <div v-else class="session-list">
          <article
            v-for="item in sessions"
            :key="item.conversationId || item.id"
            class="session-card"
            :class="{ 'has-unread': Number(item.unreadCount || 0) > 0 }"
          >
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
                <span v-if="Number(item.unreadCount || 0) > 0" class="new-msg-pill">新消息</span>
                <span class="role-badge">{{ roleText(item.role) }}</span>
                <span class="status-badge" :class="`status-${item.status}`">{{ sessionStatusText(item.status) }}</span>
                <span v-if="isDealCompleted(item)" class="deal-badge">已成交</span>
              </div>
            </div>

            <div class="identity-row">
              <span>对方公开账号：{{ item.counterpartyPublicUsername || '-' }}</span>
              <span>密码：{{ item.counterpartyPublicPassword || '-' }}</span>
            </div>

            <ExpandableText
              v-if="item.latestMessage?.content"
              class="latest-message"
              :text="item.latestMessage.content"
            />
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

        <div v-if="buyPagination.totalPages > 1" class="pager">
          <span class="pager-summary">共 {{ buyPagination.total }} 条，每页 {{ buyPagination.pageSize }} 条</span>
          <button :disabled="buyPagination.page <= 1" @click="goBuyPage(buyPagination.page - 1)">上一页</button>
          <span>{{ buyPagination.page }} / {{ buyPagination.totalPages }}</span>
          <button :disabled="buyPagination.page >= buyPagination.totalPages" @click="goBuyPage(buyPagination.page + 1)">
            下一页
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/utils/api'
import { useToast } from '@/composables/useToast'
import { formatPrice, formatRelativeTime } from '@/utils/format'
import { fetchMyConversations, resolveConversationPath } from '@/utils/conversation'
import AppSelect from '@/components/common/AppSelect.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ExpandableText from '@/components/common/ExpandableText.vue'

const router = useRouter()
const toast = useToast()
const MESSAGE_PAGE_SIZE = 20

const activeTab = ref('system')

const summary = ref({
  totalUnread: 0,
  systemUnread: 0,
  buyChatUnread: 0,
  sessionsWithUnread: 0,
  totalSessions: 0
})

// 系统消息
const systemLoading = ref(false)
const markAllSystemLoading = ref(false)
const markingSystemId = ref(0)
const systemMessages = ref([])
const systemFilter = reactive({
  readStatus: '',
  search: ''
})
const systemPagination = reactive({
  page: 1,
  pageSize: MESSAGE_PAGE_SIZE,
  total: 0,
  totalPages: 0
})

const systemReadStatusOptions = [
  { value: 'unread', label: '仅未读' },
  { value: 'read', label: '仅已读' }
]

// 求购洽谈
const buyLoading = ref(false)
const sessions = ref([])
const buyFilter = reactive({
  role: '',
  status: '',
  search: ''
})
const buyPagination = reactive({
  page: 1,
  pageSize: MESSAGE_PAGE_SIZE,
  total: 0,
  totalPages: 0
})

const buyRoleOptions = [
  { value: 'requester', label: '我是求购方' },
  { value: 'provider', label: '我是服务方' }
]

const sessionStatusOptions = [
  { value: 'negotiating', label: '洽谈中' },
  { value: 'paid_pending_confirm', label: '待确认' },
  { value: 'paid', label: '已确认' },
  { value: 'closed', label: '已关闭' },
  { value: 'cancelled', label: '已取消' }
]

let summaryTimer = null

function unreadDisplay(value) {
  const count = Number(value || 0)
  return count > 99 ? '99+' : String(count)
}

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

function systemMessageTypeText(type) {
  const map = {
    product_offline: '物品下架通知',
    product_comment: '商品评论通知',
    product_restock: '商品补货通知',
    seller_restock_alert: '卖家补货提醒'
  }
  return map[String(type || '').trim()] || '系统通知'
}

function isDealCompleted(session) {
  const paymentStatus = String(session?.paymentOrderStatus || '')
  if (paymentStatus === 'completed') return true
  return Number(session?.contactUnlockedAt || 0) > 0
}

async function loadSummary() {
  if (document.visibilityState === 'hidden') {
    return
  }

  try {
    const result = await api.get('/api/shop/messages/unread-summary')
    if (!result.success) return
    summary.value = {
      totalUnread: Number(result.data?.totalUnread || 0),
      systemUnread: Number(result.data?.systemUnread || 0),
      buyChatUnread: Number(result.data?.buyChatUnread || 0),
      sessionsWithUnread: Number(result.data?.sessionsWithUnread || 0),
      totalSessions: Number(result.data?.totalSessions || 0)
    }
  } catch (_) {
    // ignore polling errors
  }
}

async function loadSystemMessages(reset = false) {
  if (reset) systemPagination.page = 1

  systemLoading.value = true
  try {
    const params = new URLSearchParams({
      page: String(systemPagination.page),
      pageSize: String(systemPagination.pageSize)
    })
    if (systemFilter.readStatus) params.set('readStatus', systemFilter.readStatus)
    if (systemFilter.search.trim()) params.set('search', systemFilter.search.trim())

    const result = await api.get(`/api/shop/messages/system?${params.toString()}`)
    if (!result.success) {
      toast.error(result.error || '加载系统消息失败')
      return
    }

    systemMessages.value = result.data?.messages || []
    const pageData = result.data?.pagination || {}
    systemPagination.page = Number(pageData.page || systemPagination.page || 1)
    systemPagination.pageSize = Number(pageData.pageSize || MESSAGE_PAGE_SIZE)
    systemPagination.total = Number(pageData.total || 0)
    systemPagination.totalPages = Number(pageData.totalPages || 0)

    const systemUnread = Number(result.data?.summary?.totalUnread || 0)
    summary.value = {
      ...summary.value,
      systemUnread,
      totalUnread: systemUnread + Number(summary.value.buyChatUnread || 0)
    }
  } catch (error) {
    toast.error(error.message || '加载系统消息失败')
  } finally {
    systemLoading.value = false
  }
}

function resetSystemFilter() {
  systemFilter.readStatus = ''
  systemFilter.search = ''
  loadSystemMessages(true)
}

function goSystemPage(page) {
  if (page < 1 || page > systemPagination.totalPages) return
  systemPagination.page = page
  loadSystemMessages()
}

async function markSystemMessageRead(item) {
  const messageId = Number(item?.id || 0)
  if (!messageId || item.isRead || markingSystemId.value === messageId) return

  markingSystemId.value = messageId
  try {
    const result = await api.post(`/api/shop/messages/system/${messageId}/read`)
    if (!result.success) {
      toast.error(result.error || '标记已读失败')
      return
    }

    item.isRead = true
    item.readAt = Date.now()

    const systemUnread = Math.max(0, Number(summary.value.systemUnread || 0) - 1)
    summary.value = {
      ...summary.value,
      systemUnread,
      totalUnread: systemUnread + Number(summary.value.buyChatUnread || 0)
    }
  } catch (error) {
    toast.error(error.message || '标记已读失败')
  } finally {
    markingSystemId.value = 0
  }
}

async function markAllSystemRead() {
  if (markAllSystemLoading.value || Number(summary.value.systemUnread || 0) <= 0) return

  markAllSystemLoading.value = true
  try {
    const result = await api.post('/api/shop/messages/system/read-all')
    if (!result.success) {
      toast.error(result.error || '全部标记已读失败')
      return
    }

    await Promise.all([loadSummary(), loadSystemMessages()])
    toast.success('已全部标记为已读')
  } catch (error) {
    toast.error(error.message || '全部标记已读失败')
  } finally {
    markAllSystemLoading.value = false
  }
}

async function openSystemMessage(item) {
  if (!item) return
  if (!item.isRead) {
    await markSystemMessageRead(item)
  }
  if (item.link) {
    router.push(item.link)
  }
}

async function loadSessions(reset = false) {
  if (reset) buyPagination.page = 1

  buyLoading.value = true
  try {
    const result = await fetchMyConversations({
      type: 'buy_request',
      page: buyPagination.page,
      pageSize: buyPagination.pageSize,
      status: buyFilter.status,
      role: buyFilter.role,
      search: buyFilter.search.trim()
    })
    if (!result.success) {
      toast.error(result.error || '加载会话失败')
      return
    }

    sessions.value = result.data?.conversations || result.data?.sessions || []
    const pageData = result.data?.pagination || {}
    buyPagination.page = Number(pageData.page || buyPagination.page || 1)
    buyPagination.pageSize = Number(pageData.pageSize || MESSAGE_PAGE_SIZE)
    buyPagination.total = Number(pageData.total || 0)
    buyPagination.totalPages = Number(pageData.totalPages || 0)

    const buyChatUnread = Number(result.data?.summary?.totalUnread || 0)
    summary.value = {
      ...summary.value,
      buyChatUnread,
      sessionsWithUnread: Number(result.data?.summary?.sessionsWithUnread || 0),
      totalSessions: Number(pageData.total || 0),
      totalUnread: Number(summary.value.systemUnread || 0) + buyChatUnread
    }
  } catch (error) {
    toast.error(error.message || '加载会话失败')
  } finally {
    buyLoading.value = false
  }
}

function resetBuyFilter() {
  buyFilter.role = ''
  buyFilter.status = ''
  buyFilter.search = ''
  loadSessions(true)
}

function goBuyPage(page) {
  if (page < 1 || page > buyPagination.totalPages) return
  buyPagination.page = page
  loadSessions()
}

function openSession(session) {
  const path = resolveConversationPath(session)
  if (!path) return
  router.push(path)
}

async function switchTab(tab) {
  if (activeTab.value === tab) return
  activeTab.value = tab

  if (tab === 'system' && systemMessages.value.length === 0) {
    await loadSystemMessages(true)
    return
  }

  if (tab === 'buy' && sessions.value.length === 0) {
    await loadSessions(true)
  }
}

function startSummaryPolling() {
  stopSummaryPolling()
  summaryTimer = setInterval(() => {
    loadSummary()
  }, 10000)
}

function stopSummaryPolling() {
  if (summaryTimer) {
    clearInterval(summaryTimer)
    summaryTimer = null
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    loadSummary()
  }
}

onMounted(async () => {
  await loadSummary()
  await Promise.all([loadSystemMessages(true), loadSessions(true)])
  startSummaryPolling()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  stopSummaryPolling()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<style scoped>
.messages-page {
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

.tab-switch {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.tab-btn {
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tab-btn.active {
  border-color: var(--color-success);
  color: var(--color-success);
  background: var(--color-success-bg);
}

.tab-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  color: #fff;
  background: #dc2626;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.panel-wrap {
  background: transparent;
}

.toolbar {
  display: grid;
  grid-template-columns: 160px 180px 1fr auto auto;
  gap: 10px;
  margin-bottom: 12px;
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
  height: 40px;
  box-sizing: border-box;
}

.toolbar-btn {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-secondary);
  padding: 0 14px;
  font-size: 13px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: start;
  white-space: nowrap;
}

.toolbar-btn:disabled {
  opacity: 0.6;
}

.toolbar-btn.search-btn {
  min-width: 72px;
  padding: 0 12px;
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

.system-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.system-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 14px;
}

.system-card.unread {
  border-color: rgba(220, 38, 38, 0.35);
  box-shadow: 0 10px 28px rgba(220, 38, 38, 0.08);
}

.system-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.system-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.system-title {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary);
}

.system-time {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.status-pill {
  font-size: 11px;
  border-radius: 999px;
  padding: 2px 8px;
}

.status-pill.unread {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
}

.status-pill.read {
  color: var(--text-tertiary);
  background: var(--bg-secondary);
}

.system-content {
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.system-bottom {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.system-meta {
  font-size: 12px;
  color: var(--text-tertiary);
}

.system-actions {
  display: flex;
  gap: 8px;
}

.mini-btn {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-secondary);
  padding: 6px 10px;
  font-size: 12px;
}

.mini-btn.primary {
  border-color: var(--color-success);
  background: var(--color-success);
  color: #fff;
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

.session-card.has-unread {
  border-color: rgba(220, 38, 38, 0.35);
  box-shadow: 0 10px 28px rgba(220, 38, 38, 0.08);
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

.new-msg-pill {
  font-size: 12px;
  border-radius: 999px;
  padding: 2px 10px;
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
  font-weight: 700;
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

.deal-badge {
  font-size: 12px;
  border-radius: 999px;
  padding: 2px 10px;
  background: rgba(16, 185, 129, 0.16);
  color: #047857;
  font-weight: 600;
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
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.pager-summary {
  margin-right: auto;
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

  .card-top,
  .system-top,
  .system-bottom {
    flex-direction: column;
  }

  .top-right {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .system-actions {
    width: 100%;
  }
}
</style>
