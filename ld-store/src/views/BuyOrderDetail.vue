<template>
  <div class="buy-order-detail-page">
    <div class="page-container">
      <div class="top-nav">
        <button class="back-btn" @click="goBack">← 返回订单列表</button>
      </div>

      <div v-if="loading" class="state-block">加载中...</div>
      <div v-else-if="!order" class="state-block">订单不存在或无权限查看</div>

      <template v-else>
        <section class="order-card">
          <div class="order-head">
            <div>
              <h1 class="order-title">{{ order.requestTitle || '求购订单' }}</h1>
              <p class="order-meta">
                <span>订单号 {{ order.orderNo }}</span>
                <span>·</span>
                <span>{{ formatDate(order.createdAt || order.created_at) }}</span>
              </p>
            </div>
            <span class="status-badge" :class="statusClass(order.status)">
              {{ statusText(order.status) }}
            </span>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <span class="label">订单金额</span>
              <span class="value amount">{{ formatPrice(order.amount || 0) }} LDC</span>
            </div>
            <div class="info-item">
              <span class="label">我的身份</span>
              <span class="value">{{ order.myRole === 'requester' ? '求购方' : '服务方' }}</span>
            </div>
            <div class="info-item">
              <span class="label">对方</span>
              <span class="value">{{ order.counterpartyUsername || '未知' }}</span>
            </div>
            <div class="info-item">
              <span class="label">求购状态</span>
              <span class="value">{{ requestStatusText(order.requestStatus) }}</span>
            </div>
          </div>
        </section>

        <section class="action-card">
          <div class="action-list">
            <a
              v-if="order.counterpartyContactLink"
              :href="order.counterpartyContactLink"
              target="_blank"
              rel="noopener"
              class="action-btn primary"
            >
              联系对方（L站）
            </a>
            <button class="action-btn" @click="goChat">查看对应会话</button>
            <button
              v-if="canRepay"
              class="action-btn primary"
              :disabled="paying"
              @click="handleRepay"
            >
              {{ paying ? '跳转中...' : '立即支付' }}
            </button>
            <button
              v-if="canRefresh"
              class="action-btn"
              :disabled="refreshing"
              @click="handleRefresh"
            >
              {{ refreshing ? '刷新中...' : '刷新状态' }}
            </button>
          </div>
          <p v-if="!order.counterpartyContactLink" class="action-hint">
            联系方式将在订单完成后自动开放
          </p>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { useToast } from '@/composables/useToast'
import { formatPrice } from '@/utils/format'
import { isValidLdcPaymentUrl } from '@/utils/security'
import { prepareNewTab, openInNewTab, cleanupPreparedTab } from '@/utils/newTab'

const route = useRoute()
const router = useRouter()
const shopStore = useShopStore()
const toast = useToast()

const loading = ref(true)
const order = ref(null)
const paying = ref(false)
const refreshing = ref(false)

const orderNo = computed(() => String(route.params.orderNo || '').trim())
const canRepay = computed(() => {
  return order.value?.status === 'pending' && order.value?.myRole === 'requester'
})
const canRefresh = computed(() => {
  const status = String(order.value?.status || '')
  return status === 'pending' || status === 'paid'
})

function goBack() {
  router.push('/user/orders?tab=buy')
}

function goChat() {
  const path = String(order.value?.chatPath || '')
  if (path) {
    router.push(path)
    return
  }
  router.push('/user/buy-chats')
}

function statusText(status) {
  const map = {
    pending: '待支付',
    paid: '已支付',
    completed: '已完成',
    cancelled: '已取消',
    expired: '已过期'
  }
  return map[status] || status || '未知'
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
  return map[status] || status || '未知'
}

function statusClass(status) {
  const map = {
    pending: 'status-pending',
    paid: 'status-paid',
    completed: 'status-completed',
    cancelled: 'status-cancelled',
    expired: 'status-expired'
  }
  return map[status] || 'status-pending'
}

function formatDate(timestamp) {
  const value = Number(timestamp || 0)
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN')
}

async function loadOrderDetail() {
  if (!orderNo.value) {
    loading.value = false
    return
  }

  loading.value = true
  try {
    const result = await shopStore.getBuyOrderDetail(orderNo.value)
    if (!result.success) {
      toast.error(result.error || '加载订单详情失败')
      order.value = null
      return
    }
    order.value = result.data?.order || null
  } catch (error) {
    toast.error(error.message || '加载订单详情失败')
    order.value = null
  } finally {
    loading.value = false
  }
}

async function handleRepay() {
  if (!orderNo.value || paying.value) return
  paying.value = true

  const preparedWindow = prepareNewTab()
  try {
    const result = await shopStore.getBuyOrderPaymentUrl(orderNo.value)
    const paymentUrl = result?.data?.paymentUrl || ''
    if (!result?.success || !paymentUrl) {
      cleanupPreparedTab(preparedWindow)
      toast.error(result?.error || '获取支付链接失败')
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
      return
    }
    toast.success('支付页面已打开')
  } catch (error) {
    cleanupPreparedTab(preparedWindow)
    toast.error(error.message || '获取支付链接失败')
  } finally {
    paying.value = false
  }
}

async function handleRefresh() {
  if (!orderNo.value || refreshing.value) return
  refreshing.value = true
  try {
    const result = await shopStore.refreshBuyOrderStatus(orderNo.value)
    if (!result?.success) {
      toast.error(result?.error || '刷新状态失败')
      return
    }

    const status = result?.data?.status || result?.data?.order?.status
    if (status === 'completed') {
      toast.success('订单已完成，联系方式已开放')
    } else if (status === 'expired') {
      toast.warning('订单已过期，请重新发起支付')
    } else {
      toast.show(result?.data?.message || '订单尚未完成')
    }

    await loadOrderDetail()
  } catch (error) {
    toast.error(error.message || '刷新状态失败')
  } finally {
    refreshing.value = false
  }
}

onMounted(loadOrderDetail)
</script>

<style scoped>
.buy-order-detail-page {
  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: 80px;
}

.page-container {
  max-width: 860px;
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
  cursor: pointer;
  font-size: 14px;
}

.state-block,
.order-card,
.action-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 16px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.order-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.order-title {
  margin: 0;
  font-size: 22px;
  color: var(--text-primary);
}

.order-meta {
  margin: 6px 0 0;
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--text-tertiary);
  font-size: 12px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
}

.status-pending {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.status-paid {
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
}

.status-completed {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-cancelled,
.status-expired {
  background: var(--bg-secondary);
  color: var(--text-tertiary);
}

.info-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.info-item {
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 10px;
  background: var(--bg-secondary);
}

.label {
  display: block;
  font-size: 12px;
  color: var(--text-tertiary);
}

.value {
  display: block;
  margin-top: 4px;
  color: var(--text-primary);
}

.value.amount {
  color: var(--color-success);
  font-weight: 700;
}

.action-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.action-btn {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
}

.action-btn.primary {
  background: var(--color-success);
  border-color: var(--color-success);
  color: #fff;
}

.action-hint {
  margin: 12px 0 0;
  color: var(--text-tertiary);
  font-size: 12px;
}

@media (max-width: 720px) {
  .order-head {
    flex-direction: column;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
