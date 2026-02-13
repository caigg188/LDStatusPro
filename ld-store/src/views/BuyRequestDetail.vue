<template>
  <div class="buy-request-detail-page">
    <div class="page-container">
      <div class="top-nav">
        <button class="back-btn" @click="goBack">← 返回</button>
      </div>

      <div v-if="loading" class="state-block">加载中...</div>
      <div v-else-if="!requestData" class="state-block">求购不存在或已被删除</div>

      <template v-else>
        <section class="request-card">
          <div class="request-head">
            <div>
              <h1 class="request-title">{{ requestData.title }}</h1>
              <p class="request-meta">
                <span>{{ statusText(requestData.status) }}</span>
                <span>·</span>
                <span>{{ formatRelativeTime(requestData.updatedAt || requestData.createdAt) }}</span>
              </p>
            </div>
            <div class="request-price">
              <span class="price-value">{{ formatPrice(requestData.budgetPrice) }}</span>
              <span class="price-unit">LDC</span>
            </div>
          </div>

          <p class="request-details">{{ requestData.details }}</p>

          <div class="request-public">
            <span>公开账号：{{ requestData.requesterPublicUsername }}</span>
            <span>公开密码：{{ requestData.requesterPublicPassword }}</span>
          </div>

          <div v-if="viewerRole === 'requester'" class="owner-actions">
            <div class="price-adjust">
              <input
                v-model="adjustPrice"
                type="number"
                min="0.01"
                step="0.01"
                class="price-input"
                placeholder="输入新预算"
              />
              <button class="small-btn primary" :disabled="updatingPrice" @click="submitPriceUpdate">
                {{ updatingPrice ? '提交中...' : '调价' }}
              </button>
            </div>
            <div class="status-actions">
              <button
                v-if="requestData.status !== 'closed'"
                class="small-btn danger"
                :disabled="updatingRequestStatus"
                @click="updateRequestStatus('closed')"
              >
                关闭求购
              </button>
              <button
                v-else
                class="small-btn"
                :disabled="updatingRequestStatus"
                @click="updateRequestStatus('open')"
              >
                重新开放
              </button>
            </div>
          </div>

          <div v-else class="guest-actions">
            <button
              v-if="!isLoggedIn"
              class="small-btn primary"
              @click="goLogin"
            >
              登录后发起洽谈
            </button>
            <button
              v-else-if="canStartSession"
              class="small-btn primary"
              :disabled="startingSession"
              @click="startSession"
            >
              {{ startingSession ? '创建中...' : '发起洽谈' }}
            </button>
          </div>
        </section>

        <section v-if="viewerRole === 'requester' && sessions.length > 0" class="session-list-card">
          <h2 class="section-title">洽谈会话</h2>
          <div class="session-list">
            <button
              v-for="session in sessions"
              :key="session.id"
              class="session-item"
              :class="{ active: activeSessionId === session.id }"
              @click="selectSession(session.id)"
            >
              <div class="session-main">
                <span class="session-user">{{ session.providerPublicUsername }}</span>
                <span class="session-pass">密码 {{ session.providerPublicPassword }}</span>
              </div>
              <span class="session-status">{{ sessionStatusText(session.status) }}</span>
            </button>
          </div>
        </section>

        <section v-if="activeSession" class="chat-card">
          <div class="chat-head">
            <div>
              <h2 class="section-title">在线聊天</h2>
              <p class="chat-subtitle">
                {{ sessionStatusText(activeSession.status) }}
                <template v-if="activeSession.paymentOrderStatus">
                  · 订单{{ buyOrderStatusText(activeSession.paymentOrderStatus) }}
                </template>
              </p>
            </div>
            <div class="chat-head-actions">
              <a
                v-if="activeSession.counterpartyContactLink"
                :href="activeSession.counterpartyContactLink"
                target="_blank"
                rel="noopener"
                class="small-btn primary"
              >
                联系对方（私信）
              </a>
              <button
                v-if="activeSession.canCreatePayment"
                class="small-btn"
                :disabled="actionLoading"
                @click="createPaymentOrder"
              >
                去支付
              </button>
              <button
                v-if="activeSession.paymentOrderNo && activeSession.canRefreshPayment"
                class="small-btn primary"
                :disabled="actionLoading"
                @click="refreshPaymentStatus"
              >
                刷新支付状态
              </button>
              <button
                v-if="activeSession.status !== 'closed' && activeSession.status !== 'cancelled'"
                class="small-btn danger"
                :disabled="actionLoading"
                @click="closeSession"
              >
                关闭会话
              </button>
            </div>
          </div>

          <div class="chat-message-list">
            <div
              v-for="message in messages"
              :key="message.id"
              class="chat-message"
              :class="messageClass(message)"
            >
              <template v-if="message.senderRole === 'system'">
                <div class="system-message">{{ message.content }}</div>
              </template>
              <template v-else>
                <div class="msg-author">
                  {{ message.senderPublicUsername }}
                  <span class="msg-pass">密码 {{ message.senderPublicPassword }}</span>
                </div>
                <div class="msg-content">{{ message.content }}</div>
                <div class="msg-time">{{ formatRelativeTime(message.createdAt) }}</div>
              </template>
            </div>
          </div>

          <div class="chat-input-row">
            <textarea
              v-model="messageInput"
              class="chat-input"
              rows="3"
              maxlength="500"
              :disabled="!activeSession.canSendMessage || sendingMessage"
              placeholder="输入消息（违禁词会被拦截）"
            ></textarea>
            <button
              class="send-btn"
              :disabled="!activeSession.canSendMessage || sendingMessage || !messageInput.trim()"
              @click="sendMessage"
            >
              {{ sendingMessage ? '发送中...' : '发送' }}
            </button>
          </div>
        </section>

        <section v-else class="state-block">
          <p v-if="viewerRole === 'requester'">暂无会话，等待服务方发起洽谈。</p>
          <p v-else-if="viewerRole === 'provider'">会话加载失败，请刷新重试。</p>
          <p v-else>登录后可发起洽谈。</p>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { api } from '@/utils/api'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { formatPrice, formatRelativeTime } from '@/utils/format'
import { isValidLdcPaymentUrl } from '@/utils/security'
import { prepareNewTab, openInNewTab, cleanupPreparedTab } from '@/utils/newTab'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const toast = useToast()
const dialog = useDialog()

const loading = ref(true)
const requestData = ref(null)
const viewerRole = ref('guest')
const sessions = ref([])
const activeSessionId = ref(0)
const messages = ref([])
const messageInput = ref('')

const adjustPrice = ref('')
const updatingPrice = ref(false)
const updatingRequestStatus = ref(false)
const startingSession = ref(false)
const sendingMessage = ref(false)
const actionLoading = ref(false)

let pollTimer = null

const isLoggedIn = computed(() => userStore.isLoggedIn)
const requestId = computed(() => Number(route.params.id || 0))
const canStartSession = computed(() => !!requestDetailState.value?.canStartSession)

const requestDetailState = ref(null)

const activeSession = computed(() => {
  if (!activeSessionId.value) return null
  return sessions.value.find(item => item.id === activeSessionId.value) || null
})

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

function sessionStatusText(status) {
  const map = {
    negotiating: '洽谈中',
    paid_pending_confirm: '待确认',
    paid: '已确认',
    closed: '已关闭',
    cancelled: '已取消'
  }
  return map[status] || status
}

function buyOrderStatusText(status) {
  const map = {
    pending: '待支付',
    paid: '已支付',
    completed: '已完成',
    cancelled: '已取消',
    expired: '已过期'
  }
  return map[status] || status
}

function goBack() {
  router.back()
}

function goLogin() {
  router.push({ name: 'Login', query: { redirect: route.fullPath } })
}

function messageClass(message) {
  if (message.senderRole === 'system') return 'system'

  if (viewerRole.value === 'requester') {
    return message.senderRole === 'requester' ? 'self' : 'other'
  }
  if (viewerRole.value === 'provider') {
    return message.senderRole === 'provider' ? 'self' : 'other'
  }
  return 'other'
}

function normalizeSessions(detailData) {
  if (Array.isArray(detailData.sessions)) return detailData.sessions
  if (detailData.session) return [detailData.session]
  return []
}

function getPreferredSessionId() {
  const value = Number(route.query.session || 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

async function loadDetail(showLoading = true) {
  if (!requestId.value) {
    loading.value = false
    return
  }

  if (showLoading) loading.value = true
  try {
    const result = await api.get(`/api/shop/buy-requests/${requestId.value}`)
    if (!result.success) {
      toast.error(result.error || '加载失败')
      requestData.value = null
      return
    }

    const data = result.data || {}
    requestDetailState.value = data
    requestData.value = data.request || null
    viewerRole.value = data.viewerRole || 'guest'
    sessions.value = normalizeSessions(data)

    if (requestData.value) {
      adjustPrice.value = String(requestData.value.budgetPrice || '')
    }

    if (sessions.value.length > 0) {
      const preferredSessionId = getPreferredSessionId()
      const exists = sessions.value.some(item => item.id === activeSessionId.value)
      const preferredExists = preferredSessionId > 0
        && sessions.value.some((item) => item.id === preferredSessionId)

      if (preferredExists) {
        activeSessionId.value = preferredSessionId
      } else if (!exists) {
        activeSessionId.value = sessions.value[0].id
      }
    } else {
      activeSessionId.value = 0
      messages.value = []
    }
  } catch (error) {
    toast.error(error.message || '加载失败')
  } finally {
    if (showLoading) loading.value = false
  }
}

async function loadMessages(reset = false) {
  if (!activeSessionId.value) return

  const sinceId = reset || messages.value.length === 0
    ? 0
    : messages.value[messages.value.length - 1]?.id || 0

  try {
    const result = await api.get(
      `/api/shop/buy-sessions/${activeSessionId.value}/messages?limit=100&sinceId=${sinceId}`
    )
    if (!result.success) return

    const list = result.data?.messages || []
    if (reset) {
      messages.value = list
    } else if (list.length > 0) {
      messages.value = [...messages.value, ...list]
    }

    const sessionState = result.data?.session || null
    if (sessionState && activeSession.value) {
      activeSession.value.status = sessionState.status
      activeSession.value.providerMarkPaidAt = sessionState.providerMarkPaidAt
      activeSession.value.requesterConfirmPaidAt = sessionState.requesterConfirmPaidAt
      activeSession.value.contactUnlockedAt = sessionState.contactUnlockedAt
      activeSession.value.paymentOrderNo = sessionState.paymentOrderNo || activeSession.value.paymentOrderNo || ''
      activeSession.value.paymentOrderStatus = sessionState.paymentOrderStatus || activeSession.value.paymentOrderStatus || ''
      activeSession.value.paymentPayExpiredAt = sessionState.paymentPayExpiredAt || activeSession.value.paymentPayExpiredAt || 0
      activeSession.value.paymentPaidAt = sessionState.paymentPaidAt || activeSession.value.paymentPaidAt || 0
      activeSession.value.paymentCompletedAt = sessionState.paymentCompletedAt || activeSession.value.paymentCompletedAt || 0
      if (activeSession.value.paymentOrderStatus === 'completed') {
        activeSession.value.canCreatePayment = false
        activeSession.value.canRefreshPayment = false
      }
      if (sessionState.requestStatus && requestData.value) {
        requestData.value.status = sessionState.requestStatus
      }

      if (sessionState.contactUnlockedAt && !activeSession.value.counterpartyContactLink) {
        await loadDetail(false)
      }
    }
  } catch (error) {
    // silence polling errors
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    loadMessages(false)
  }, 4000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function selectSession(sessionId) {
  if (!sessionId) return
  activeSessionId.value = sessionId
  router.replace({
    query: {
      ...route.query,
      session: String(sessionId)
    }
  }).catch(() => {})
  await loadMessages(true)
}

async function startSession() {
  if (!requestId.value) return
  startingSession.value = true
  try {
    const result = await api.post(`/api/shop/buy-requests/${requestId.value}/sessions`, {})
    if (!result.success) {
      toast.error(result.error || '发起洽谈失败')
      return
    }
    toast.success('已进入洽谈会话')
    await loadDetail(false)
    if (sessions.value.length > 0) {
      activeSessionId.value = sessions.value[0].id
      await loadMessages(true)
    }
  } catch (error) {
    toast.error(error.message || '发起洽谈失败')
  } finally {
    startingSession.value = false
  }
}

async function sendMessage() {
  const content = messageInput.value.trim()
  if (!content || !activeSessionId.value) return

  sendingMessage.value = true
  try {
    const result = await api.post(`/api/shop/buy-sessions/${activeSessionId.value}/messages`, { content })
    if (!result.success) {
      toast.error(result.error || '发送失败')
      return
    }
    messageInput.value = ''
    await loadMessages(false)
  } catch (error) {
    toast.error(error.message || '发送失败')
  } finally {
    sendingMessage.value = false
  }
}

async function submitPriceUpdate() {
  const nextPrice = parseFloat(adjustPrice.value)
  if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
    toast.error('请输入有效价格')
    return
  }

  updatingPrice.value = true
  try {
    const result = await api.post(`/api/shop/buy-requests/${requestId.value}/price`, { price: nextPrice })
    if (!result.success) {
      toast.error(result.error || '调价失败')
      return
    }
    toast.success('价格已更新')
    await loadDetail(false)
  } catch (error) {
    toast.error(error.message || '调价失败')
  } finally {
    updatingPrice.value = false
  }
}

async function updateRequestStatus(status) {
  const confirmed = await dialog.confirm(
    status === 'closed' ? '确定关闭这条求购吗？' : '确定重新开放这条求购吗？',
    { title: '状态变更' }
  )
  if (!confirmed) return

  updatingRequestStatus.value = true
  try {
    const result = await api.post(`/api/shop/buy-requests/${requestId.value}/status`, { status })
    if (!result.success) {
      toast.error(result.error || '更新状态失败')
      return
    }
    toast.success('状态已更新')
    await loadDetail(false)
  } catch (error) {
    toast.error(error.message || '更新状态失败')
  } finally {
    updatingRequestStatus.value = false
  }
}

async function createPaymentOrder() {
  if (!activeSessionId.value) return

  actionLoading.value = true
  const preparedWindow = prepareNewTab()
  try {
    const result = await api.post(`/api/shop/buy-sessions/${activeSessionId.value}/payment`, {})
    if (!result.success) {
      cleanupPreparedTab(preparedWindow)
      toast.error(result.error || '创建支付订单失败')
      return
    }

    const paymentUrl = result.data?.order?.paymentUrl || ''
    if (!paymentUrl) {
      cleanupPreparedTab(preparedWindow)
      toast.warning('订单已创建，请在“求购订单”中继续支付')
      await loadDetail(false)
      return
    }

    if (!isValidLdcPaymentUrl(paymentUrl)) {
      cleanupPreparedTab(preparedWindow)
      toast.error('支付链接异常，请稍后重试')
      return
    }

    const opened = openInNewTab(paymentUrl, preparedWindow)
    if (!opened) {
      cleanupPreparedTab(preparedWindow)
      toast.warning('支付窗口被拦截，请允许弹窗后重试')
    } else {
      toast.success('支付页面已打开，请完成支付后刷新状态')
    }

    await loadDetail(false)
  } catch (error) {
    cleanupPreparedTab(preparedWindow)
    toast.error(error.message || '创建支付订单失败')
  } finally {
    actionLoading.value = false
  }
}

async function refreshPaymentStatus() {
  const orderNo = activeSession.value?.paymentOrderNo
  if (!orderNo) {
    toast.warning('暂无支付订单')
    return
  }

  actionLoading.value = true
  try {
    const result = await api.post(`/api/shop/buy-orders/${encodeURIComponent(orderNo)}/refresh`, {})
    if (!result.success) {
      toast.error(result.error || '刷新失败')
      return
    }

    const orderStatus = result.data?.status || result.data?.order?.status
    if (orderStatus === 'completed') {
      toast.success('支付已确认，联系方式已开放')
    } else if (orderStatus === 'expired') {
      toast.warning('订单已过期，请重新发起支付')
    } else {
      toast.show(result.data?.message || '订单未完成，请稍后重试')
    }

    await loadDetail(false)
    await loadMessages(false)
  } catch (error) {
    toast.error(error.message || '刷新失败')
  } finally {
    actionLoading.value = false
  }
}

async function closeSession() {
  if (!activeSessionId.value) return
  const confirmed = await dialog.confirm('确定关闭当前会话吗？', { title: '关闭会话' })
  if (!confirmed) return

  actionLoading.value = true
  try {
    const result = await api.post(`/api/shop/buy-sessions/${activeSessionId.value}/close`, {})
    if (!result.success) {
      toast.error(result.error || '关闭失败')
      return
    }
    toast.success('会话已关闭')
    await loadDetail(false)
    await loadMessages(false)
  } catch (error) {
    toast.error(error.message || '关闭失败')
  } finally {
    actionLoading.value = false
  }
}

onMounted(async () => {
  await loadDetail(true)
  if (activeSessionId.value) {
    await loadMessages(true)
  }
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})

watch(
  () => route.query.session,
  async () => {
    const preferredSessionId = getPreferredSessionId()
    if (!preferredSessionId) return
    if (preferredSessionId === activeSessionId.value) return
    if (!sessions.value.some((item) => item.id === preferredSessionId)) return
    await selectSession(preferredSessionId)
  }
)
</script>

<style scoped>
.buy-request-detail-page {
  min-height: 100vh;
  padding-bottom: 80px;
  background: var(--bg-primary);
}

.page-container {
  max-width: 980px;
  margin: 0 auto;
  padding: 16px;
}

.top-nav {
  margin-bottom: 12px;
}

.back-btn {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 14px;
  cursor: pointer;
}

.state-block {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 24px;
  color: var(--text-tertiary);
}

.request-card,
.session-list-card,
.chat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 12px;
}

.request-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.request-title {
  margin: 0;
  font-size: 24px;
  color: var(--text-primary);
}

.request-meta {
  margin: 8px 0 0;
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--text-tertiary);
  font-size: 13px;
}

.request-price {
  white-space: nowrap;
}

.price-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--color-success);
}

.price-unit {
  margin-left: 4px;
  color: var(--text-tertiary);
}

.request-details {
  margin: 12px 0;
  white-space: pre-wrap;
  color: var(--text-secondary);
  line-height: 1.65;
}

.request-public {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.owner-actions,
.guest-actions {
  margin-top: 12px;
}

.price-adjust {
  display: flex;
  gap: 8px;
}

.price-input {
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  padding: 9px 10px;
}

.status-actions {
  margin-top: 10px;
}

.small-btn {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
}

.small-btn.primary {
  background: var(--color-success);
  border-color: var(--color-success);
  color: #fff;
}

.small-btn.danger {
  background: rgba(220, 38, 38, 0.1);
  border-color: rgba(220, 38, 38, 0.25);
  color: #dc2626;
}

.section-title {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.session-item {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  text-align: left;
}

.session-item.active {
  border-color: var(--color-success);
  background: var(--color-success-bg);
}

.session-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-user {
  font-size: 14px;
  font-weight: 600;
}

.session-pass,
.session-status {
  font-size: 12px;
  color: var(--text-tertiary);
}

.chat-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.chat-subtitle {
  margin: 6px 0 0;
  color: var(--text-tertiary);
  font-size: 12px;
}

.chat-head-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.chat-message-list {
  margin-top: 12px;
  max-height: 420px;
  overflow-y: auto;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 10px;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-message {
  max-width: 78%;
  border-radius: 12px;
  padding: 8px 10px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
}

.chat-message.self {
  margin-left: auto;
  background: var(--color-success-bg);
  border-color: rgba(34, 197, 94, 0.35);
}

.chat-message.other {
  margin-right: auto;
}

.chat-message.system {
  margin: 0 auto;
  max-width: 90%;
  background: transparent;
  border: none;
  padding: 0;
}

.system-message {
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}

.msg-author {
  font-size: 12px;
  color: var(--text-tertiary);
}

.msg-pass {
  margin-left: 6px;
}

.msg-content {
  margin-top: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
  line-height: 1.55;
}

.msg-time {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.chat-input-row {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-input {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  padding: 10px 12px;
  resize: vertical;
}

.send-btn {
  align-self: flex-end;
  border: none;
  border-radius: 10px;
  background: var(--color-success);
  color: #fff;
  font-size: 13px;
  padding: 8px 14px;
}

@media (max-width: 720px) {
  .request-head,
  .chat-head {
    flex-direction: column;
  }

  .chat-message {
    max-width: 100%;
  }

  .chat-head-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
