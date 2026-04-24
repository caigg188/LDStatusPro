<template>
  <div class="messages-page">
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">我的消息</h1>
          <p class="page-subtitle">集中查看系统消息与求购洽谈进展</p>
        </div>
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

      <LiquidTabs
        :modelValue="activeTab"
        :tabs="messageTabs"
        class="tab-switch"
        @update:modelValue="switchTab"
      />

      <section v-if="activeTab === 'system'" class="panel-wrap">
        <div class="toolbar">
          <AppSelect
            v-model="systemFilter.readStatus"
            class="toolbar-select"
            :options="systemReadStatusOptions"
            placeholder="全部状态"
            variant="toolbar"
            @change="loadSystemMessages(true)"
          />
          <div class="toolbar-search">
            <input
              v-model="systemFilter.search"
              type="text"
              class="toolbar-input"
              placeholder="搜索系统消息"
              @keyup.enter="loadSystemMessages(true)"
            />
            <button class="toolbar-search-btn" @click="loadSystemMessages(true)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button v-if="systemFilter.search" class="toolbar-search-clear" @click="resetSystemFilter">×</button>
          </div>
          <button
            class="toolbar-link-btn"
            :disabled="markAllSystemLoading || summary.systemUnread <= 0"
            @click="markAllSystemRead"
          >
            {{ markAllSystemLoading ? '处理中...' : '全部已读' }}
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
                  class="mini-btn mark-read-btn"
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
            variant="toolbar"
            @change="loadSessions(true)"
          />
          <AppSelect
            v-model="buyFilter.status"
            class="toolbar-select"
            :options="sessionStatusOptions"
            placeholder="全部状态"
            variant="toolbar"
            @change="loadSessions(true)"
          />
          <div class="toolbar-search">
            <input
              v-model="buyFilter.search"
              type="text"
              class="toolbar-input"
              placeholder="搜索求购标题/公开账号"
              @keyup.enter="loadSessions(true)"
            />
            <button class="toolbar-search-btn" @click="loadSessions(true)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button v-if="buyFilter.role || buyFilter.status || buyFilter.search" class="toolbar-search-clear" @click="resetBuyFilter">×</button>
          </div>
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
import { onMounted, onUnmounted, reactive, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/utils/api'
import { useToast } from '@/composables/useToast'
import { formatPrice, formatRelativeTime } from '@/utils/format'
import { fetchMyConversations, resolveConversationPath } from '@/utils/conversation'
import AppSelect from '@/components/common/AppSelect.vue'
import LiquidTabs from '@/components/common/LiquidTabs.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ExpandableText from '@/components/common/ExpandableText.vue'

const router = useRouter()
const toast = useToast()
const MESSAGE_PAGE_SIZE = 20

const activeTab = ref('system')

const messageTabs = computed(() => [
  { value: 'system', label: `系统消息${summary.value.systemUnread > 0 ? ' ' + unreadDisplay(summary.value.systemUnread) : ''}`, icon: '📬' },
  { value: 'buy', label: `求购洽谈${summary.value.buyChatUnread > 0 ? ' ' + unreadDisplay(summary.value.buyChatUnread) : ''}`, icon: '💬' }
])

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
  { value: 'paid', label: '已支付' },
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
  isolation: isolate;
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

/* tab-switch via LiquidTabs */
.tab-switch {
  width: 100%;
  margin-bottom: 12px;
}

.tab-switch :deep(.liquid-tab) {
  flex: 1;
  justify-content: center;
}

.panel-wrap {
  background: transparent;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.toolbar-select {
  flex-shrink: 0;
  min-width: 0;
}

.toolbar-search {
  flex: 1;
  position: relative;
  min-width: 0;
  display: flex;
  align-items: center;
}

.toolbar-input {
  width: 100%;
  height: 40px;
  box-sizing: border-box;
  padding: 0 12px;
  padding-right: 40px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
}

.toolbar-input:focus {
  outline: none;
  border-color: var(--color-success);
  background: var(--input-focus-bg);
  box-shadow: 0 2px 8px var(--glass-shadow-light);
}

.toolbar-input::placeholder {
  color: var(--text-placeholder);
}

.toolbar-search-btn {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 8px;
  background: var(--glass-bg-heavy);
  color: var(--text-secondary);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}

.toolbar-search-btn:hover {
  opacity: 0.85;
}

.toolbar-search-clear {
  position: absolute;
  right: 36px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  border: none;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}

.toolbar-search-clear:hover {
  background: var(--border-color);
  color: var(--text-secondary);
}

.toolbar-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(143, 163, 141, 0.25);
  border-radius: 10px;
  background: rgba(143, 163, 141, 0.1);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  color: #6b8068;
  font-size: 13px;
  font-weight: 500;
  padding: 0 10px;
  height: 40px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.2s, color 0.2s;
}

.toolbar-link-btn:hover:not(:disabled) {
  border-color: rgba(143, 163, 141, 0.45);
  color: #5a7060;
}

.toolbar-link-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
  isolation: isolate;
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
  background: var(--bg-tertiary);
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

.mini-btn.mark-read-btn {
  color: #6b8068;
}

.mini-btn.primary {
  color: var(--color-primary);
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
  isolation: isolate;
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
  background: var(--bg-tertiary);
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
  background: var(--bg-tertiary);
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
  background: var(--bg-tertiary);
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
  background: var(--bg-tertiary);
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

/* Mobile */
@media (max-width: 640px) {
  .page-header {
    margin-bottom: 10px;
  }

  .page-title {
    font-size: 20px;
  }

  .page-subtitle {
    font-size: 12px;
  }

  .summary-card {
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .summary-item {
    padding: 8px;
    border-radius: 10px;
  }

  .summary-label {
    font-size: 11px;
  }

  .summary-value {
    font-size: 18px;
  }

  .tab-switch :deep(.liquid-tab) {
    padding: 8px 10px;
    font-size: 13px;
  }

  .tab-switch :deep(.tab-icon) {
    font-size: 14px;
  }

  /* toolbar single row */
  .toolbar {
    gap: 6px;
    flex-wrap: nowrap;
  }

  .toolbar-select {
    flex-shrink: 0;
  }

  .toolbar-select :deep(.select-trigger) {
    height: 36px;
    box-sizing: border-box;
    min-height: unset;
    min-width: unset;
    width: auto;
    padding: 0 24px 0 8px;
    font-size: 12px;
  }

  .toolbar-select :deep(.select-arrow) {
    right: 6px;
    width: 14px;
    height: 14px;
  }

  .toolbar-search {
    flex: 1;
    min-width: 0;
  }

  .toolbar-input {
    height: 36px;
    padding: 0 8px;
    padding-right: 34px;
    font-size: 13px;
  }

  .toolbar-search-btn {
    width: 28px;
    height: 28px;
  }

  .toolbar-search-clear {
    right: 34px;
    width: 20px;
    height: 20px;
    font-size: 12px;
  }

  .toolbar-link-btn {
    height: 36px;
    box-sizing: border-box;
    padding: 0 8px;
    font-size: 12px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  /* compact system-card */
  .system-card {
    padding: 10px 12px;
    border-radius: 12px;
  }

  .system-title {
    font-size: 14px;
  }

  .system-content {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.5;
  }

  .system-bottom {
    margin-top: 8px;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .system-actions {
    width: 100%;
  }

  .mini-btn {
    padding: 4px 8px;
    font-size: 11px;
  }

  /* compact session-card */
  .session-card {
    padding: 10px 12px;
    border-radius: 12px;
  }

  .card-top {
    flex-direction: column;
    gap: 6px;
  }

  .top-right {
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 6px;
  }

  .request-title {
    font-size: 15px;
  }

  .request-meta {
    margin-top: 4px;
    font-size: 11px;
  }

  .new-msg-pill,
  .role-badge,
  .status-badge,
  .deal-badge {
    font-size: 11px;
    padding: 1px 8px;
  }

  .identity-row {
    margin-top: 6px;
    gap: 6px;
    font-size: 11px;
  }

  .latest-message {
    margin-top: 6px;
    padding: 8px;
    font-size: 12px;
  }

  .card-bottom {
    margin-top: 8px;
  }

  .enter-btn {
    font-size: 12px;
    padding: 6px 12px;
  }

  .pager {
    font-size: 12px;
    gap: 8px;
  }

  .pager button {
    padding: 4px 8px;
    font-size: 12px;
  }
}
</style>
