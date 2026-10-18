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
        layout="equal"
        aria-label="消息分类"
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
              aria-label="搜索系统消息"
              @keyup.enter="loadSystemMessages(true)"
            />
            <button class="toolbar-search-btn" aria-label="执行系统消息搜索" title="搜索" @click="loadSystemMessages(true)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button v-if="systemFilter.search" class="toolbar-search-clear" aria-label="清空系统消息搜索" title="清空" @click="resetSystemFilter">×</button>
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
              <h3 class="system-title">{{ item.title || '系统消息' }}</h3>
              <div class="system-heading-meta">
                <time
                  class="system-time"
                  :aria-label="formatMessageTime(item.createdAt)"
                  :title="formatMessageTime(item.createdAt)"
                >
                  <span class="system-time-relative">{{ formatRelativeTime(item.createdAt) }}</span>
                  <span class="system-time-exact" aria-hidden="true">· {{ formatStandardDateTime(item.createdAt) }}</span>
                </time>
                <span class="status-pill" :class="item.isRead ? 'read' : 'unread'">
                  {{ item.isRead ? '已读' : '未读' }}
                </span>
              </div>
            </div>

            <ExpandableText
              class="system-content"
              as="p"
              :text="item.content || '-'"
            />

            <div class="system-bottom">
              <span class="system-meta" :title="systemMessageTypeText(item.messageType)">
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
              aria-label="搜索求购洽谈"
              @keyup.enter="loadSessions(true)"
            />
            <button class="toolbar-search-btn" aria-label="执行求购洽谈搜索" title="搜索" @click="loadSessions(true)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button v-if="buyFilter.role || buyFilter.status || buyFilter.search" class="toolbar-search-clear" aria-label="清空求购洽谈筛选" title="清空" @click="resetBuyFilter">×</button>
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
import { normalizeResourceId } from '@/utils/resourceId'
import { onMounted, onUnmounted, reactive, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import {
  fetchSystemMessagesRequest,
  markAllSystemMessagesReadRequest,
  markSystemMessageReadRequest
} from '@/services/shop/messageService'
import { useNotificationSummaryStore } from '@/stores/notificationSummary'
import { useToast } from '@/composables/useToast'
import { formatMessageTime, formatPrice, formatRelativeTime, formatStandardDateTime } from '@/utils/format'
import { fetchMyConversations, resolveConversationPath } from '@/services/shop/conversationService'
import AppSelect from '@/components/common/AppSelect.vue'
import LiquidTabs from '@/components/common/LiquidTabs.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ExpandableText from '@/components/common/ExpandableText.vue'

const router = useRouter()
const toast = useToast()
const notificationSummaryStore = useNotificationSummaryStore()
const {
  totalUnread,
  systemUnread,
  buyChatUnread,
  sessionsWithUnread,
  totalSessions
} = storeToRefs(notificationSummaryStore)
const MESSAGE_PAGE_SIZE = 20

const activeTab = ref('system')

const messageTabs = computed(() => [
  { value: 'system', label: `系统消息${summary.value.systemUnread > 0 ? ' ' + unreadDisplay(summary.value.systemUnread) : ''}`, icon: '📬' },
  { value: 'buy', label: `求购洽谈${summary.value.buyChatUnread > 0 ? ' ' + unreadDisplay(summary.value.buyChatUnread) : ''}`, icon: '💬' }
])

const summary = computed(() => ({
  totalUnread: totalUnread.value,
  systemUnread: systemUnread.value,
  buyChatUnread: buyChatUnread.value,
  sessionsWithUnread: sessionsWithUnread.value,
  totalSessions: totalSessions.value
}))

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

let unsubscribeRealtime = null
let realtimeRefreshTimer = null

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
    system: '系统通知',
    notification: '系统通知',
    seller_pending_delivery: '待发货提醒',
    seller_fulfillment_deadline: '卖家发货时限提醒',
    buyer_fulfillment_deadline: '买家发货保障通知',
    seller_fulfillment_policy: '卖家履约记录通知',
    buyer_refund_processing: '退款处理中',
    seller_refund_processing: '退款处理通知',
    buyer_refund_succeeded: '退款成功通知',
    seller_refund_succeeded: '退款成功通知',
    buyer_refund_failed: '退款异常通知',
    seller_refund_failed: '退款异常通知',
    buyer_refund_unknown: '退款待核对通知',
    seller_refund_unknown: '退款待核对通知',
    buyer_refund_exception: '退款异常通知',
    seller_refund_exception: '退款异常通知',
    refund_reconciled: '退款核对结果',
    buyer_refund_external_dispute: 'Credit 处理通知',
    seller_refund_external_dispute: 'Credit 处理通知',
    zero_stock_auto_offline: '库存下架提醒',
    product_offline: '物品下架通知',
    product_comment: '商品评论通知',
    comment_reply: '评论回复通知',
    product_restock: '商品补货通知',
    seller_restock_alert: '卖家补货提醒',
    restock_alert: '卖家补货提醒',
    top_service_active: '甄选服务生效通知',
    top_service_expired: '甄选服务到期通知',
    buyer_order_delivered: '物品发货提醒'
  }
  return map[String(type || '').trim()] || '系统通知'
}

function isDealCompleted(session) {
  const paymentStatus = String(session?.paymentOrderStatus || '')
  if (paymentStatus === 'completed') return true
  return Number(session?.contactUnlockedAt || 0) > 0
}

async function loadSystemMessages(reset = false) {
  if (reset) systemPagination.page = 1

  systemLoading.value = true
  try {
    const result = await fetchSystemMessagesRequest({
      page: systemPagination.page,
      pageSize: systemPagination.pageSize,
      readStatus: systemFilter.readStatus,
      search: systemFilter.search
    })
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

    notificationSummaryStore.setSystemUnread(Number(result.data?.summary?.totalUnread || 0))
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
  const messageId = normalizeResourceId(item?.id || 0)
  if (!messageId || item.isRead || markingSystemId.value === messageId) return

  markingSystemId.value = messageId
  try {
    const result = await markSystemMessageReadRequest(messageId)
    if (!result.success) {
      toast.error(result.error || '标记已读失败')
      return
    }

    item.isRead = true
    item.readAt = Date.now()

    notificationSummaryStore.markSystemRead(1)
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
    const result = await markAllSystemMessagesReadRequest()
    if (!result.success) {
      toast.error(result.error || '全部标记已读失败')
      return
    }

    notificationSummaryStore.markAllSystemRead()
    await loadSystemMessages()
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

    notificationSummaryStore.setBuyChatSummary({
      totalUnread: Number(result.data?.summary?.totalUnread || 0),
      sessionsWithUnread: Number(result.data?.summary?.sessionsWithUnread || 0),
      totalSessions: Number(pageData.total || 0)
    })
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

function handleRealtimeEvent(event) {
  if (document.visibilityState === 'hidden') return
  const shouldReloadSystem = event.type === 'system-message.changed' && activeTab.value === 'system'
  const shouldReloadBuy = event.type === 'buy-message.created' && activeTab.value === 'buy'
  if (!shouldReloadSystem && !shouldReloadBuy) return
  if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer)
  realtimeRefreshTimer = setTimeout(() => {
    realtimeRefreshTimer = null
    if (shouldReloadSystem) loadSystemMessages()
    if (shouldReloadBuy) loadSessions()
  }, 120)
}

onMounted(async () => {
  await Promise.all([loadSystemMessages(true), loadSessions(true)])
  unsubscribeRealtime = notificationSummaryStore.subscribeEvents(handleRealtimeEvent)
})

onUnmounted(() => {
  unsubscribeRealtime?.()
  unsubscribeRealtime = null
  if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer)
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
  font-size: var(--text-display);
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
  border: 1px solid var(--palette-rgba-143-163-141-0p25);
  border-radius: 10px;
  background: var(--palette-rgba-143-163-141-0p1);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  color: var(--palette-hex-6b8068);
  font-size: 13px;
  font-weight: 500;
  padding: 0 10px;
  height: 40px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.2s, color 0.2s;
}

.toolbar-link-btn:hover:not(:disabled) {
  border-color: var(--palette-rgba-143-163-141-0p45);
  color: var(--palette-hex-5a7060);
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
  border-color: var(--palette-rgba-220-38-38-0p35);
  box-shadow: 0 10px 28px var(--palette-rgba-220-38-38-0p08);
}

.system-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.system-heading-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.system-title {
  margin: 0;
  min-width: 0;
  flex: 1 1 auto;
  font-size: 16px;
  line-height: 1.45;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.system-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.5;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.status-pill {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  font-size: 11px;
  line-height: 1.4;
  border-radius: 999px;
  padding: 2px 8px;
  white-space: nowrap;
}

.status-pill.unread {
  color: var(--palette-hex-dc2626);
  background: var(--palette-rgba-220-38-38-0p1);
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
  min-width: 0;
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
  color: var(--palette-hex-6b8068);
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
  border-color: var(--palette-rgba-220-38-38-0p35);
  box-shadow: 0 10px 28px var(--palette-rgba-220-38-38-0p08);
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
  background: var(--palette-rgba-220-38-38-0p1);
  color: var(--palette-hex-dc2626);
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
  background: var(--palette-rgba-245-158-11-0p14);
  color: var(--palette-hex-b45309);
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
  background: var(--palette-rgba-16-185-129-0p16);
  color: var(--palette-hex-047857);
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
  background: var(--palette-rgba-220-38-38-0p1);
  color: var(--palette-hex-dc2626);
}

.unread-badge.muted {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

.enter-btn {
  border: none;
  border-radius: 10px;
  background: var(--color-success);
  color: var(--palette-hex-ffffff);
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
@media (max-width: 639px) {
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

  .system-heading-meta {
    gap: 6px;
  }

  .system-title {
    font-size: 14px;
  }

  .system-time {
    font-size: 11px;
  }

  .system-time-exact {
    display: none;
  }

  .system-content {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.5;
  }

  .system-bottom {
    margin-top: 8px;
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .system-meta {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .system-actions {
    width: auto;
    margin-left: auto;
    flex: 0 0 auto;
    justify-content: flex-end;
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

@media (max-width: 359px) {
  .toolbar {
    flex-wrap: wrap;
  }

  .toolbar-search {
    order: 2;
    flex: 1 0 100%;
  }
}
</style>
