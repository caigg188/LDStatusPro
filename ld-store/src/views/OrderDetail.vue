<template>
  <div class="order-detail-page">
    <div class="page-container">
      <div class="top-nav">
        <button class="top-back-btn" type="button" @click="goBack">
          ← 返回
        </button>
        <router-link to="/support" class="support-btn top-support-btn">
          <span class="support-heart">💖</span>
          <span>支持 LD 士多</span>
        </router-link>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="loading-state">
        <div class="skeleton-card large">
          <div class="skeleton skeleton-line w-48"></div>
          <div class="skeleton skeleton-line w-full mt-4"></div>
          <div class="skeleton skeleton-line w-32 mt-2"></div>
        </div>
      </div>
      
      <!-- 订单不存在 -->
      <EmptyState
        v-else-if="!order"
        icon="🔍"
        title="订单不存在"
        description="无法找到该订单信息"
      >
        <router-link to="/user/orders" class="back-btn">
          ← 返回
        </router-link>
      </EmptyState>
      
      <!-- 订单详情 -->
      <template v-else>
        <!-- 订单状态卡片 -->
        <div :class="['status-card', getStatusClass(order.status)]">
          <div class="status-card__main">
            <div class="status-icon">{{ getStatusIcon(order.status) }}</div>
            <div>
              <div class="status-text">{{ getStatusText(order.status) }}</div>
              <div class="status-time" v-if="order.created_at || order.createdAt">
                {{ formatDateTime(order.created_at || order.createdAt) }}
              </div>
            </div>
          </div>
          <div class="status-card__meta">
            <span class="status-chip">订单号 {{ order.order_no || order.orderNo || order.id }}</span>
            <span class="status-chip">
              {{ currentStatusTimeLabel }} {{ currentStatusTimeText }}
            </span>
            <span v-if="getProductCategoryText(order) !== '未知'" class="status-chip secondary">
              {{ getProductCategoryText(order) }}
            </span>
          </div>
        </div>
        
        <!-- 物品信息 -->
        <div class="info-card">
          <h3 class="card-title">物品信息</h3>
          
          <div class="info-row">
            <span class="info-label">物品名称</span>
            <button
              v-if="productDetailPath"
              type="button"
              class="info-value info-link"
              @click="goToProductDetail"
            >
              {{ order.product?.name || order.product_name || order.productName }}
            </button>
            <span v-else class="info-value">{{ order.product?.name || order.product_name || order.productName }}</span>
          </div>

          <div class="info-row">
            <span class="info-label">物品分类</span>
            <span class="info-value">
              <span class="order-category-badge">
                {{ getProductCategoryText(order) }}
              </span>
            </span>
          </div>

          <div class="info-row" v-if="isPlatformOrder(order)">
            <span class="info-label">购买数量</span>
            <span class="info-value">x{{ getOrderQuantity(order) }}</span>
          </div>
          
          <div class="info-row" v-if="order.original_price && order.original_price !== order.amount">
            <span class="info-label">原价</span>
            <span class="info-value original-price">{{ order.original_price }} LDC</span>
          </div>
          
          <div class="info-row amount">
            <span class="info-label">实付积分</span>
            <span class="info-value price">{{ order.amount || order.total_price }} LDC</span>
          </div>
        </div>
        
        <!-- 交易双方信息 -->
        <div class="info-card">
          <h3 class="card-title">交易信息</h3>
          
          <div class="info-row">
            <span class="info-label">卖家</span>
            <span class="info-value user-info">
              <a :href="'https://linux.do/u/' + (order.seller_username || '')" target="_blank" rel="noopener" class="user-link">
                @{{ order.seller_username || '未知' }}
              </a>
            </span>
          </div>
          
          <div class="info-row">
            <span class="info-label">买家</span>
            <span class="info-value user-info">
              <a :href="'https://linux.do/u/' + (order.buyer_username || '')" target="_blank" rel="noopener" class="user-link">
                @{{ order.buyer_username || '未知' }}
              </a>
            </span>
          </div>
          
          <div class="info-row" v-if="order.delivery_type">
            <span class="info-label">发货方式</span>
            <span class="info-value">{{ order.delivery_type === 'auto' ? '🤖 自动发货' : '👤 手动发货' }}</span>
          </div>
        </div>
        
        <div class="info-card" v-if="requiresBuyerContactOrder(order)">
          <h3 class="card-title">📨 履约提醒</h3>
          <div class="description-content">
            {{ currentRole === 'buyer' ? '支付完成后请主动联系卖家获取服务，订单会保留在平台内等待卖家手动履约。' : '该订单为普通物品订单，买家支付后需要您主动处理交付并填写发货内容。' }}
          </div>
        </div>

        <!-- CDK 信息 -->
        <div class="info-card" v-if="isCdkOrder(order) && getDeliveryContent(order)">
          <h3 class="card-title">🔑 CDK 密钥</h3>
          
          <div class="cdk-box">
            <div class="cdk-head">
              <span class="cdk-total">共 {{ getDeliveryList(order).length }} 个</span>
            </div>
            <code class="cdk-code">
              <template v-if="showCdk">
                <span
                  v-for="(code, index) in getDeliveryList(order)"
                  :key="`cdk-${index}`"
                  class="cdk-line"
                >
                  {{ getDeliveryList(order).length > 1 ? `${index + 1}. ` : '' }}{{ code }}
                </span>
              </template>
              <template v-else>••••••••••••</template>
            </code>
            <div class="cdk-actions">
              <button
                class="icon-btn"
                :title="showCdk ? '隐藏密钥' : '显示密钥'"
                @click="showCdk = !showCdk"
              >
                {{ showCdk ? '🙈' : '👁️' }}
              </button>
              <button class="icon-btn" title="复制密钥" @click="copyCdk">📋</button>
              <button class="icon-btn" title="导出为 TXT" @click="downloadCdk">💾</button>
            </div>
          </div>
        </div>
        
        <div class="info-card" v-if="isNormalOrder(order) && getDeliveryContent(order)">
          <h3 class="card-title">📦 发货内容</h3>
          <div class="description-content preserve-line-breaks">{{ getDeliveryContent(order) }}</div>
        </div>

        <!-- 使用说明（显示物品描述） -->
        <div class="info-card" v-if="(isCdkOrder(order) || isNormalOrder(order)) && getProductDescription(order)">
          <h3 class="card-title">📝 使用说明</h3>
          <div class="description-content">{{ getProductDescription(order) }}</div>
        </div>
        
        <!-- 订单信息 -->
        <div class="info-card">
          <h3 class="card-title">订单信息</h3>

          <div class="order-summary-grid">
            <div class="summary-item">
              <span class="summary-label">订单号</span>
              <span class="summary-value mono">{{ order.order_no || order.orderNo || order.id }}</span>
            </div>
            <div v-if="order.ldc_trade_no" class="summary-item">
              <span class="summary-label">LDC交易号</span>
              <span class="summary-value mono">{{ order.ldc_trade_no }}</span>
            </div>
          </div>
        </div>
        
        <!-- 订单日志 -->
        <div class="info-card" v-if="orderLogs && orderLogs.length > 0">
          <h3 class="card-title">订单动态</h3>
          
          <div class="order-logs">
            <div class="log-item" v-for="(log, index) in sortedOrderLogs" :key="index">
              <div class="log-icon">{{ getLogIcon(log.action) }}</div>
              <div class="log-content">
                <div class="log-action">{{ getLogText(log) }}</div>
                <div class="log-time">{{ formatDateTime(log.created_at || log.createdAt || log.time) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="actions" v-if="showActions">
          <div class="actions-row">
            <button
              v-if="canRepay"
              class="pay-btn"
              @click="handleRepay"
              :disabled="paying || cancelling"
            >
              {{ paying ? '跳转中...' : '立即支付' }}
            </button>
            <button
              v-if="canRefreshPaymentStatus"
              class="refresh-btn"
              @click="handleRefreshPaymentStatus"
              :disabled="checkingPayment || cancelling || paying"
            >
              {{ checkingPayment ? '检查中...' : '检查支付状态' }}
            </button>
            <button 
              v-if="order.status === 'pending'" 
              class="cancel-btn" 
              :class="{ 'full-width': !canRepay && !canRefreshPaymentStatus }"
              @click="handleCancelOrder"
              :disabled="cancelling || paying"
            >
              {{ cancelling ? '取消中...' : '取消订单' }}
            </button>
          </div>
          <p v-if="isPaymentMaintenanceBlocked" class="maintenance-action-hint">
            因 LinuxDo Credit 积分服务维护中，当前仅保留订单查看，支付与补查已暂时关闭。
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { isMaintenanceFeatureEnabled, isRestrictedMaintenanceMode } from '@/config/maintenance'
import EmptyState from '@/components/common/EmptyState.vue'
import { isValidLdcPaymentUrl } from '@/utils/security'
import { prepareNewTab, openInNewTab, cleanupPreparedTab } from '@/utils/newTab'
import {
  isCdkProduct,
  isNormalProduct,
  isPlatformOrderProduct,
  requiresBuyerContact
} from '@/utils/shopProduct'

const route = useRoute()
const router = useRouter()
const shopStore = useShopStore()
const toast = useToast()
const dialog = useDialog()

const loading = ref(true)
const order = ref(null)
const orderLogs = ref([])
const showCdk = ref(false)
const cancelling = ref(false)
const paying = ref(false)
const checkingPayment = ref(false)
let pendingOrderAutoRefreshTimer = null
const isPaymentMaintenanceBlocked = computed(() =>
  isRestrictedMaintenanceMode() && !isMaintenanceFeatureEnabled('orderPayment')
)

// 当前用户角色（买家/卖家）
const currentRole = computed(() => route.query.role || 'buyer')
const backTarget = computed(() => currentRole.value === 'seller' ? '/user/orders?tab=seller' : '/user/orders?tab=buyer')

// 是否显示操作按钮区域（买家和卖家都可以取消待支付订单）
const showActions = computed(() => {
  return order.value?.status === 'pending'
})

const canRepay = computed(() => {
  return !isPaymentMaintenanceBlocked.value
    && currentRole.value === 'buyer'
    && order.value?.status === 'pending'
    && isPlatformOrder(order.value)
})

const canRefreshPaymentStatus = computed(() => {
  return !isPaymentMaintenanceBlocked.value
    && currentRole.value === 'buyer'
    && order.value?.status === 'pending'
    && isPlatformOrder(order.value)
})

const categoryNameMap = computed(() => {
  const map = new Map()
  const list = Array.isArray(shopStore.categories) ? shopStore.categories : []
  for (const cat of list) {
    if (cat?.id == null) continue
    map.set(String(cat.id), cat.name || '')
  }
  return map
})

const productDetailPath = computed(() => {
  const productId =
    order.value?.product?.id ??
    order.value?.product_id ??
    order.value?.productId

  if (productId == null || productId === '') return ''
  return `/product/${productId}`
})

const sortedOrderLogs = computed(() => {
  const logs = Array.isArray(orderLogs.value) ? [...orderLogs.value] : []
  return logs.sort((a, b) => getLogTimestamp(b) - getLogTimestamp(a))
})

const currentStatusTime = computed(() => getStatusTimestamp(order.value, orderLogs.value))
const currentStatusTimeLabel = computed(() => getStatusTimeLabel(order.value))
const currentStatusTimeText = computed(() => formatDateTime(currentStatusTime.value))

function goBack() {
  router.push(backTarget.value)
}

function goToProductDetail() {
  if (!productDetailPath.value) return
  router.push(productDetailPath.value)
}

function isCdkOrder(orderData) {
  return isCdkProduct(orderData)
}

function isNormalOrder(orderData) {
  return isNormalProduct(orderData)
}

function isPlatformOrder(orderData) {
  return isPlatformOrderProduct(orderData)
}

function requiresBuyerContactOrder(orderData) {
  return requiresBuyerContact(orderData)
}

function getProductCategoryText(orderData) {
  const directName =
    orderData?.category_name ||
    orderData?.categoryName ||
    orderData?.product?.category_name ||
    orderData?.product?.categoryName ||
    orderData?.product?.category?.name

  if (directName) return directName

  const categoryId =
    orderData?.category_id ??
    orderData?.categoryId ??
    orderData?.product?.category_id ??
    orderData?.product?.categoryId ??
    orderData?.product?.category?.id

  if (categoryId != null) {
    const mappedName = categoryNameMap.value.get(String(categoryId))
    if (mappedName) return mappedName
    return `分类 #${categoryId}`
  }

  return '未知'
}

// 获取发货内容（处理多种可能的字段名）
function getDeliveryContent(orderData) {
  return orderData?.cdk || orderData?.delivery_content || orderData?.deliveryContent || ''
}

function getDeliveryList(orderData) {
  const content = getDeliveryContent(orderData)
  if (!content) return []
  return String(content)
    .split(/\r?\n/g)
    .filter((item) => item.trim().length > 0)
}

function getOrderQuantity(orderData) {
  const quantity = Number(orderData?.quantity ?? orderData?.product_quantity ?? 1)
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1
}

// 获取物品描述（使用说明）
function getProductDescription(orderData) {
  // 从物品快照或直接字段获取描述
  return orderData?.product?.description || 
         orderData?.productDescription || 
         orderData?.product_description || 
         ''
}

// 加载订单详情
async function loadOrder(options = {}) {
  const silent = options?.silent === true
  try {
    if (!silent) {
      loading.value = true
    }
    const orderId = route.params.id
    const role = route.query.role || 'buyer'
    const result = await shopStore.fetchOrderDetail(orderId, role)
    // 解包可能嵌套的数据
    order.value = result?.order || result?.data?.order || result
    // 订单日志
    orderLogs.value = result?.logs || result?.data?.logs || []
  } catch (error) {
    if (!silent) {
      toast.error('加载订单详情失败')
    }
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}

function stopPendingOrderAutoRefresh() {
  if (pendingOrderAutoRefreshTimer) {
    clearInterval(pendingOrderAutoRefreshTimer)
    pendingOrderAutoRefreshTimer = null
  }
}

function startPendingOrderAutoRefresh() {
  stopPendingOrderAutoRefresh()
  if (!canRefreshPaymentStatus.value) return

  pendingOrderAutoRefreshTimer = setInterval(() => {
    loadOrder({ silent: true }).catch(() => {})
  }, 30000)
}

// 日志图标
function getLogIcon(action) {
  const map = {
    create: '📝',
    pay: '💰',
    deliver: '📦',
    refund: '↩️',
    cancel: '❌',
    expire: '⏰',
    lock_cdk: '🔒',
    unlock_cdk: '🔓'
  }
  return map[action] || '📋'
}

// 日志文字
function getLogText(log) {
  const actionMap = {
    create: '创建订单',
    pay: '支付成功',
    deliver: '发货完成',
    refund: '订单退款',
    cancel: '取消订单',
    expire: '订单过期',
    lock_cdk: '锁定CDK',
    unlock_cdk: '释放CDK'
  }
  const actionText = actionMap[log.action] || log.action
  const operator = log.operator_name || log.operator_type || ''
  return operator ? `${actionText} (${operator})` : actionText
}

function toTimestamp(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function getLogTimestamp(log) {
  return toTimestamp(log?.created_at || log?.createdAt || log?.time)
}

function isLogActionMatch(log, actions = []) {
  const action = String(log?.action || '').toLowerCase()
  return actions.includes(action)
}

function getTimelineTimestampFromLogs(logs, actions = []) {
  const matchedLogs = Array.isArray(logs) ? logs.filter((log) => isLogActionMatch(log, actions)) : []
  if (!matchedLogs.length) return 0
  return matchedLogs.reduce((latest, log) => Math.max(latest, getLogTimestamp(log)), 0)
}

function getStatusTimestamp(orderData, logs = []) {
  if (!orderData) return 0
  const status = String(orderData.status || '')
  const logTimestampMap = {
    delivered: getTimelineTimestampFromLogs(logs, ['deliver']),
    completed: getTimelineTimestampFromLogs(logs, ['deliver']),
    paid: getTimelineTimestampFromLogs(logs, ['pay']),
    refunded: getTimelineTimestampFromLogs(logs, ['refund']),
    cancelled: getTimelineTimestampFromLogs(logs, ['cancel']),
    expired: getTimelineTimestampFromLogs(logs, ['expire'])
  }
  const fieldMap = {
    delivered: orderData.delivered_at || orderData.deliveredAt,
    completed: orderData.completed_at || orderData.completedAt || orderData.delivered_at || orderData.deliveredAt,
    paid: orderData.paid_at || orderData.paidAt,
    refunded: orderData.refunded_at || orderData.refundedAt,
    cancelled: orderData.cancelled_at || orderData.cancelledAt,
    expired: orderData.expired_at || orderData.expiredAt || orderData.pay_expired_at || orderData.payExpiredAt || orderData.expire_at || orderData.expireAt,
    pending: orderData.created_at || orderData.createdAt,
    paying: orderData.paid_at || orderData.paidAt || orderData.created_at || orderData.createdAt
  }
  return logTimestampMap[status] || toTimestamp(fieldMap[status]) || toTimestamp(orderData.updated_at || orderData.updatedAt || orderData.created_at || orderData.createdAt)
}

function getStatusTimeLabel(orderData) {
  const status = String(orderData?.status || '')
  const map = {
    delivered: '发货时间',
    completed: '完成时间',
    paid: '支付时间',
    refunded: '退款时间',
    cancelled: '取消时间',
    expired: '过期时间',
    pending: '创建时间',
    paying: '支付时间'
  }
  return map[status] || '更新时间'
}

// 状态文字
function getStatusText(status) {
  const map = {
    pending: '待支付',
    paying: '支付中',
    paid: '已支付',
    completed: '已完成',
    cancelled: '已取消',
    refunded: '已退款',
    delivered: '已发货',
    expired: '已过期'
  }
  return map[status] || status || '未知'
}

// 状态图标
function getStatusIcon(status) {
  const map = {
    pending: '⏳',
    paying: '💳',
    paid: '✅',
    completed: '🎉',
    cancelled: '❌',
    refunded: '↩️',
    delivered: '📦',
    expired: '⌛'
  }
  return map[status] || '📋'
}

// 状态样式
function getStatusClass(status) {
  const map = {
    pending: 'status-pending',
    paying: 'status-pending',
    paid: 'status-success',
    completed: 'status-success',
    cancelled: 'status-cancelled',
    refunded: 'status-refunded',
    delivered: 'status-info',
    expired: 'status-cancelled'
  }
  return map[status] || ''
}

// 格式化日期时间
function formatDateTime(date) {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  const second = String(d.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

// 复制发货内容
function copyCdk() {
  const content = getDeliveryList(order.value).join('\n')
  if (content) {
    navigator.clipboard.writeText(content)
    toast.success(isCdkOrder(order.value) ? 'CDK 已复制' : '发货内容已复制')
  }
}

function downloadCdk() {
  const lines = getDeliveryList(order.value)
  if (!lines.length) {
    toast.error('暂无可导出的 CDK')
    return
  }

  const orderNo = String(order.value?.order_no || order.value?.orderNo || order.value?.id || 'order').trim()
  const blob = new Blob([`${lines.join('\n')}\n`], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${orderNo}-cdk.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.success('CDK 已导出为 TXT')
}

function extractErrorMessage(result, fallback) {
  if (typeof result?.error === 'string') return result.error
  if (result?.error?.message) return result.error.message
  if (result?.error?.code) return result.error.code
  return fallback
}

async function handleRefreshPaymentStatus() {
  if (!canRefreshPaymentStatus.value || !order.value || checkingPayment.value) return

  const orderNo = order.value?.order_no || order.value?.orderNo
  if (!orderNo) return

  checkingPayment.value = true
  try {
    const result = await shopStore.refreshOrderStatus(orderNo)
    if (!result?.success) {
      toast.error(extractErrorMessage(result, '检查支付状态失败'))
      return
    }

    const status = result?.data?.status || ''
    if (status === 'delivered') {
      toast.success(isNormalOrder(order.value) ? '支付成功，卖家已完成交付' : '支付成功，已自动发货')
    } else if (status === 'paid') {
      toast.success(requiresBuyerContactOrder(order.value) ? '支付成功，请主动联系卖家获取服务' : '支付成功，订单状态已更新')
    } else if (status === 'expired') {
      toast.warning('订单已过期，请重新下单')
    } else {
      toast.show(result?.data?.message || '订单尚未支付')
    }

    await loadOrder({ silent: true })
  } catch (error) {
    toast.error(error?.message || '检查支付状态失败')
  } finally {
    checkingPayment.value = false
  }
}

async function handleRepay() {
  if (!canRepay.value || !order.value) return

  const orderNo = order.value?.order_no || order.value?.orderNo
  if (!orderNo || paying.value) return

  const loadingId = toast.loading('正在获取支付链接...')
  const preparedWindow = prepareNewTab()
  paying.value = true

  try {
    const result = await shopStore.getPaymentUrl(orderNo)
    const paymentUrl = result?.data?.paymentUrl

    if (!result?.success || !paymentUrl) {
      cleanupPreparedTab(preparedWindow)
      toast.error(extractErrorMessage(result, '获取支付链接失败'))
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
    }
    toast.success('支付页面已打开')
  } catch (error) {
    cleanupPreparedTab(preparedWindow)
    toast.error(error?.message || '获取支付链接失败')
  } finally {
    toast.close(loadingId)
    paying.value = false
  }
}

// 取消订单
async function handleCancelOrder() {
  const productName = order.value?.product?.name || order.value?.product_name || '该物品'
  const confirmed = await dialog.confirm(`确定要取消订单「${productName}」吗？`, {
    title: '取消订单',
    confirmText: '确定取消',
    cancelText: '再想想'
  })
  
  if (!confirmed) return
  
  try {
    cancelling.value = true
    const orderNo = order.value?.order_no || order.value?.orderNo
    await shopStore.cancelOrder(orderNo)
    toast.success('订单已取消')
    router.push(backTarget.value)
  } catch (error) {
    toast.error(error.message || '取消失败')
  } finally {
    cancelling.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    loadOrder(),
    shopStore.fetchCategories().catch(() => null)
  ])
  startPendingOrderAutoRefresh()
})

watch(canRefreshPaymentStatus, (enabled) => {
  if (enabled) {
    startPendingOrderAutoRefresh()
  } else {
    stopPendingOrderAutoRefresh()
  }
})

onUnmounted(() => {
  stopPendingOrderAutoRefresh()
})
</script>

<style scoped>
.order-detail-page {
  min-height: 100vh;
  padding-bottom: 100px;
}

.page-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
}

.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.top-back-btn {
  padding: 10px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.top-back-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

@media (max-width: 640px) {
  .page-container {
    padding: 12px;
  }

  .top-nav {
    flex-wrap: nowrap;
    gap: 8px;
  }

  .top-back-btn,
  .top-support-btn {
    flex: 1 1 0;
    min-width: 0;
    justify-content: center;
    padding: 8px 10px;
    font-size: 13px;
  }
}

/* 加载骨架 */
.loading-state {
  padding-top: 20px;
}

.skeleton-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.skeleton-card.large {
  min-height: 200px;
}

.skeleton {
  background: var(--skeleton-gradient);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-line {
  height: 16px;
}

.w-32 { width: 128px; }
.w-48 { width: 192px; }
.w-full { width: 100%; }
.mt-2 { margin-top: 8px; }
.mt-4 { margin-top: 16px; }

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* 返回按钮 */
.back-btn {
  display: inline-block;
  padding: 10px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

/* 状态卡片 */
.status-card {
  padding: 24px;
  border-radius: 20px;
  margin-bottom: 16px;
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.status-card.status-pending {
  background: var(--color-warning-bg);
}

.status-card.status-success {
  background: var(--color-success-bg);
}

.status-card.status-info {
  background: var(--color-info-bg);
}

.status-card.status-cancelled {
  background: var(--bg-secondary);
}

.status-card.status-refunded {
  background: var(--color-danger-bg);
}

.status-icon {
  width: 56px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 30px;
  margin-bottom: 0;
  border-radius: 16px;
  background: var(--bg-card);
}

.status-card__main {
  display: flex;
  align-items: center;
  gap: 16px;
  text-align: left;
}

.status-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.status-chip.secondary {
  background: var(--bg-secondary);
}

.status-text {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.status-time {
  font-size: 14px;
  color: var(--text-tertiary);
}

/* 信息卡片 */
.info-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.info-card:hover {
  box-shadow: var(--shadow-md);
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-tertiary);
  margin: 0 0 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);
}

.info-row:last-child {
  border-bottom: none;
}

.info-row.amount {
  padding-top: 16px;
  margin-top: 8px;
  border-top: 1px dashed var(--border-medium);
  border-bottom: none;
}

.support-heart {
  display: inline-block;
  animation: heart-beat 1.4s ease-in-out infinite;
  filter: drop-shadow(0 0 6px rgba(239, 122, 122, 0.5));
}

.info-label {
  font-size: 14px;
  color: var(--text-tertiary);
}

.info-value {
  font-size: 14px;
  color: var(--text-primary);
  max-width: 60%;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info-link {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-primary);
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.info-link::after {
  content: '↗';
  font-size: 12px;
  line-height: 1;
}

.info-link:hover {
  opacity: 0.85;
}

.info-link:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--color-primary) 40%, white);
  outline-offset: 3px;
  border-radius: 8px;
}

.info-value.mono {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
}

.info-value.price {
  font-size: 20px;
  font-weight: 700;
  color: #cfa76f;
}

/* 订单类型标签（避免和全局 .type-badge 冲突） */
.order-type-badge {
  position: static;
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.order-category-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.order-type-badge.cdk {
  background: #e8f5e8;
  color: #5a8c5a;
}

.order-type-badge.link {
  background: #e8f0f5;
  color: #778d9c;
}

.order-type-badge.store {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.order-type-badge.service {
  background: #ece7f8;
  color: #6f5a96;
}

/* CDK 展示框 */
.cdk-box {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-light);
}

.cdk-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cdk-total {
  font-size: 12px;
  color: var(--text-tertiary);
}

.cdk-code {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 14px;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.cdk-line {
  line-height: 1.5;
}

.cdk-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.icon-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

/* 链接展示框 */
.link-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.link-url {
  flex: 1;
  font-size: 14px;
  color: var(--color-info);
  word-break: break-all;
  text-decoration: none;
}

.link-url:hover {
  text-decoration: underline;
}

/* 使用说明 */
.description-content {
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.order-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.summary-item {
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
}

.summary-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.summary-value {
  display: block;
  font-size: 14px;
  color: var(--text-primary);
}

/* 寄存信息 */
.store-info {
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.store-notice {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 12px;
}

.store-info .info-row {
  padding: 8px 0 0;
  border: none;
}

/* 操作按钮 */
.actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16px;
  background: var(--bg-card);
  border-top: 1px solid var(--border-light);
  text-align: center;
}

.support-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
  min-height: 40px;
  background: linear-gradient(135deg, #a5b4a3 0%, #95a493 100%);
  color: white;
  border-radius: 999px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  transition: all 0.2s;
}

.top-support-btn {
  flex-shrink: 0;
}

.support-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-primary);
}

.actions-row {
  display: flex;
  gap: 12px;
  max-width: 568px;
  margin: 0 auto;
}

.maintenance-action-hint {
  max-width: 568px;
  margin: 12px auto 0;
  color: #b45309;
  font-size: 13px;
  line-height: 1.6;
}

.pay-btn {
  flex: 1;
  padding: 16px 32px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.pay-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.pay-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-btn {
  flex: 1;
  padding: 16px 24px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  flex: 1;
  padding: 16px 32px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn.full-width {
  flex: 1;
  width: 100%;
}

/* 原价样式 */
.original-price {
  text-decoration: line-through;
  color: var(--text-tertiary) !important;
}

/* 用户链接 */
.user-link {
  color: var(--color-info);
  text-decoration: none;
}

.user-link:hover {
  text-decoration: underline;
}

/* 订单日志 */
.order-logs {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.log-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-light);
}

.log-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.log-item:first-child {
  padding-top: 0;
}

.log-icon {
  font-size: 18px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: 8px;
  flex-shrink: 0;
}

.log-content {
  flex: 1;
  min-width: 0;
}

.log-action {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.log-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

@media (max-width: 640px) {
  .page-container {
    padding: 12px;
  }

  .status-card {
    padding: 20px;
  }

  .status-card__main {
    align-items: flex-start;
  }

  .status-icon {
    width: 48px;
    height: 48px;
    font-size: 26px;
  }

  .info-row {
    align-items: flex-start;
    gap: 12px;
  }

  .order-summary-grid {
    grid-template-columns: 1fr;
  }

  .info-value {
    max-width: 65%;
  }

  .actions {
    padding: 12px;
  }

  .actions-row {
    flex-direction: column;
  }

  .pay-btn,
  .cancel-btn,
  .refresh-btn {
    width: 100%;
  }
}
</style>
