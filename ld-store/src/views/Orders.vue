<template>
  <div class="orders-page">
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">我的订单</h1>
      </div>
      
      <!-- 角色切换 -->
      <div class="role-tabs">
        <button
          :class="['role-tab', { active: currentRole === 'buyer' }]"
          @click="switchRole('buyer')"
        >
          🛒 我买的
        </button>
        <button
          :class="['role-tab', { active: currentRole === 'seller' }]"
          @click="switchRole('seller')"
        >
          📦 我卖的
        </button>
        <button
          :class="['role-tab', { active: currentRole === 'buy' }]"
          @click="switchRole('buy')"
        >
          🌱 求购订单
        </button>
      </div>

      <div class="orders-filters">
        <input
          v-model.trim="orderSearch"
          class="filter-input"
          type="text"
          placeholder="搜索订单号、商品名、用户名"
          @keyup.enter="applyFilters"
        />
        <AppSelect
          v-model="timeRange"
          class="filter-select-wrap"
          :options="timeRangeOptions"
          placeholder="选择时间范围"
          @change="applyFilters"
        />
        <button class="filter-btn" :disabled="loading || loadingMore" @click="applyFilters">
          搜索
        </button>
        <button
          v-if="orderSearch"
          class="filter-btn secondary"
          :disabled="loading || loadingMore"
          @click="clearSearch"
        >
          清空
        </button>
      </div>
      
      <!-- 加载中 -->
      <div v-if="hasDirectFilters" class="direct-filter-bar">
        <span class="direct-filter-chip strong">{{ currentRole === 'seller' ? '我卖的' : '我买的' }}</span>
        <span v-if="onlyDealOrders" class="direct-filter-chip">已成交</span>
        <span v-if="activeCategoryName" class="direct-filter-chip">{{ activeCategoryName }}</span>
        <button class="direct-filter-clear" @click="clearDirectFilters">
          清除直达筛选
        </button>
      </div>

      <div v-if="loading" class="loading-state">
        <div class="skeleton-card" v-for="i in 3" :key="i">
          <div class="skeleton-header">
            <div class="skeleton skeleton-line w-32"></div>
            <div class="skeleton skeleton-badge"></div>
          </div>
          <div class="skeleton skeleton-line w-48 mt-3"></div>
          <div class="skeleton skeleton-line w-24 mt-2"></div>
        </div>
      </div>
      
      <!-- 空状态 -->
      <EmptyState
        v-else-if="orders.length === 0"
        icon="📋"
        title="暂无订单"
        :description="currentRole === 'buyer' ? '您还没有购买任何物品' : (currentRole === 'seller' ? '您还没有收到任何订单' : '您还没有求购订单')"
      >
        <router-link to="/" class="browse-btn">
          浏览物品
        </router-link>
      </EmptyState>
      
      <!-- 订单列表 -->
      <div class="orders-list" v-else>
        <div
          v-for="order in orders"
          :key="order.id"
          class="order-card"
        >
          <div class="order-header" @click="viewOrderDetail(order)">
            <span class="order-date">{{ formatDate(order.created_at || order.createdAt) }}</span>
            <span :class="['order-status', getStatusClass(order.status)]">
              {{ getStatusText(order.status) }}
            </span>
          </div>
          
          <div class="order-content" @click="viewOrderDetail(order)">
            <div class="product-name">{{ getOrderDisplayName(order) }}</div>
            <div class="order-info">
              <!-- <span class="order-type">{{ getOrderTypeText(order.product_type || order.product?.product_type) }}</span> -->
              <span class="order-seller" v-if="isBuyRequestOrder(order)">
                {{ order.myRole === 'requester' ? '服务方' : '求购方' }}: {{ order.counterpartyUsername || '未知' }}
              </span>
              <span class="order-seller" v-else-if="currentRole === 'buyer'">
                卖家: {{ order.seller_username || order.seller?.username || '未知' }}
              </span>
              <span class="order-seller" v-else>
                买家: {{ order.buyer_username || order.buyer?.username || '未知' }}
              </span>
              <span v-if="isPlatformOrder(order)" class="order-quantity">
                x{{ getOrderQuantity(order) }}
              </span>
              <span v-if="order.status === 'pending' && (isPlatformOrder(order) || isBuyRequestOrder(order))" class="order-expire-inline">{{ getExpireCountdownText(order) }}</span>
            </div>
            <div v-if="requiresBuyerContactOrder(order)" class="order-manual-hint">
              {{ currentRole === 'buyer' ? '支付后请主动联系卖家获取服务' : '该订单需手动履约，请及时处理' }}
            </div>
          </div>
          
          <!-- 发货内容展示区 -->
          <div 
            v-if="hasDeliveryContent(order)"
            class="cdk-display"
            @click.stop
          >
            <div class="cdk-label">
              {{ isCdkOrder(order) ? '🔑 CDK 密钥' : '📦 发货内容' }}
              <span v-if="getDeliveryCodes(order).length > 1" class="cdk-count">
                共 {{ getDeliveryCodes(order).length }} 个
              </span>
            </div>
            <div class="cdk-content-wrapper">
              <code 
                class="cdk-code"
                :class="{ hidden: !order._showCdk }"
              >
                <template v-if="order._showCdk">
                  <span
                    v-for="(code, index) in getDeliveryCodes(order)"
                    :key="`${getOrderKey(order)}-${index}`"
                    class="cdk-line"
                  >
                    {{ getDeliveryCodes(order).length > 1 ? `${index + 1}. ` : '' }}{{ code }}
                  </span>
                </template>
                <template v-else>••••••••••••••••</template>
              </code>
              <div class="cdk-actions">
                <button class="cdk-btn" @click="toggleCdkVisibility(order)">
                  {{ order._showCdk ? '🙈' : '👁️' }}
                </button>
                <button class="cdk-btn" @click="copyCdk(order)">
                  📋
                </button>
              </div>
            </div>
          </div>
          
          <div class="order-footer">
            <div class="order-amount-wrap">
              <span class="order-amount">{{ order.total_price || order.amount }} LDC</span>
              <span v-if="isPlatformOrder(order)" class="order-count">共 {{ getOrderQuantity(order) }} 个</span>
            </div>
            <div class="order-actions">
              <!-- 图床订单 -->
              <template v-if="order.order_type === 'image'">
                <span class="order-action" @click="viewOrderDetail(order)">查看图床 →</span>
              </template>
              <template v-else-if="isBuyRequestOrder(order)">
                <button
                  v-if="order.status === 'pending' && order.myRole === 'requester' && !isPaymentMaintenanceBlocked"
                  class="action-btn pay-btn"
                  @click.stop="handleRepay(order)"
                  :disabled="payingOrderId === getOrderKey(order)"
                >
                  {{ payingOrderId === getOrderKey(order) ? '跳转中...' : '立即支付' }}
                </button>
                <button
                  v-if="(order.status === 'pending' || order.status === 'paid') && !isPaymentMaintenanceBlocked"
                  class="action-btn ghost-btn"
                  @click.stop="handleRefreshBuyOrder(order)"
                  :disabled="refreshingBuyOrderId === getOrderKey(order)"
                >
                  {{ refreshingBuyOrderId === getOrderKey(order) ? '刷新中...' : '刷新状态' }}
                </button>
                <button class="action-btn enter-btn" @click.stop="viewOrderDetail(order)">
                  订单详情
                </button>
              </template>
              <!-- CDK 待支付订单操作按钮（买家和卖家都可以取消） -->
              <template v-else-if="order.status === 'pending'">
                <button
                  v-if="canRepay(order) && !isPaymentMaintenanceBlocked"
                  class="action-btn pay-btn"
                  @click.stop="handleRepay(order)"
                  :disabled="payingOrderId === getOrderKey(order)"
                >
                  {{ payingOrderId === getOrderKey(order) ? '跳转中...' : '立即支付' }}
                </button>
                <button
                  v-if="currentRole === 'buyer' && isPlatformOrder(order) && !isPaymentMaintenanceBlocked"
                  class="action-btn ghost-btn"
                  @click.stop="handleRefreshOrder(order)"
                  :disabled="refreshingOrderId === getOrderKey(order) || payingOrderId === getOrderKey(order)"
                >
                  {{ refreshingOrderId === getOrderKey(order) ? '检查中...' : '检查支付' }}
                </button>
                <button
                  class="action-btn cancel-btn"
                  @click.stop="handleCancelOrder(order)"
                  :disabled="cancellingOrderId === getOrderKey(order) || payingOrderId === getOrderKey(order) || refreshingOrderId === getOrderKey(order)"
                >
                  {{ cancellingOrderId === getOrderKey(order) ? '取消中...' : '取消订单' }}
                </button>
              </template>
              <template v-else-if="showManualDeliver(order)">
                <button
                  class="action-btn deliver-btn"
                  @click.stop="openDeliverForm(order)"
                  :disabled="deliveringOrderId === getOrderKey(order)"
                >
                  {{ deliveringOrderId === getOrderKey(order) ? '发货中...' : '立即发货' }}
                </button>
              </template>
              <template v-else>
                <button
                  v-if="canReviewOrder(order)"
                  class="action-btn review-btn"
                  @click.stop="goToOrderReview(order)"
                >
                  去评价
                </button>
                <span class="order-action" @click="viewOrderDetail(order)">查看详情 →</span>
              </template>
            </div>
            <div v-if="order.status === 'pending' && isPaymentMaintenanceBlocked" class="maintenance-order-hint">
              因 LinuxDo Credit 积分服务维护中，当前仅保留订单查看，支付与补查已暂时关闭。
            </div>
          </div>
          
          <div v-if="isDeliverFormVisible(order)" class="deliver-form" @click.stop>
            <textarea
              v-model="deliverContent"
              class="deliver-input"
              rows="3"
              :placeholder="getDeliverPlaceholder(order)"
            ></textarea>
            <div class="deliver-actions">
              <button class="action-btn cancel-btn" @click="closeDeliverForm" :disabled="deliveringOrderId === getOrderKey(order)">
                取消
              </button>
              <button
                class="action-btn pay-btn"
                @click="submitManualDeliver(order)"
                :disabled="!deliverContent.trim() || deliveringOrderId === getOrderKey(order)"
              >
                确认发货
              </button>
            </div>
            <div class="deliver-hint">{{ getDeliverHint(order) }}</div>
          </div>
        </div>
      </div>
      
      <!-- 加载更多 -->
      <div v-if="hasMore && !loading" class="load-more">
        <button class="load-more-btn" @click="loadMore" :disabled="loadingMore">
          {{ loadingMore ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { isMaintenanceFeatureEnabled, isRestrictedMaintenanceMode } from '@/config/maintenance'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import AppSelect from '@/components/common/AppSelect.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { isValidLdcPaymentUrl } from '@/utils/security'
import { prepareNewTab, openInNewTab, cleanupPreparedTab } from '@/utils/newTab'
import {
  isCdkProduct,
  isNormalProduct,
  isPlatformOrderProduct,
  requiresBuyerContact
} from '@/utils/shopProduct'

const router = useRouter()
const route = useRoute()
const shopStore = useShopStore()
const toast = useToast()
const dialog = useDialog()

const loading = ref(true)
const loadingMore = ref(false)
const orders = ref([])
const page = ref(1)
const hasMore = ref(false)
const pageSize = 20
const currentRole = ref('buyer')
const orderSearch = ref('')
const timeRange = ref('1m')
const activeCategoryId = ref(0)
const activeCategoryName = ref('')
const onlyDealOrders = ref(false)
const timeRangeOptions = [
  { value: '1m', label: '最近1个月' },
  { value: '6m', label: '最近半年' },
  { value: '1y', label: '最近一年' }
]
const cancellingOrderId = ref(null)
const deliverFormOrderId = ref(null)
const deliverContent = ref('')
const deliveringOrderId = ref(null)
const payingOrderId = ref(null)
const refreshingOrderId = ref(null)
const refreshingBuyOrderId = ref(null)
const nowTs = ref(Date.now())
let countdownTimer = null
const isPaymentMaintenanceBlocked = computed(() =>
  isRestrictedMaintenanceMode() && !isMaintenanceFeatureEnabled('orderPayment')
)

const hasDirectFilters = computed(() =>
  currentRole.value !== 'buy' && (activeCategoryId.value > 0 || onlyDealOrders.value)
)

function normalizeOrderTab(value) {
  const safeValue = String(value || '').trim().toLowerCase()
  if (['buyer', 'seller', 'buy'].includes(safeValue)) {
    return safeValue
  }
  return 'buyer'
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
}

function parseRouteBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

function syncRouteState() {
  currentRole.value = normalizeOrderTab(route.query.tab)
  activeCategoryId.value = currentRole.value === 'buy' ? 0 : parsePositiveInt(route.query.categoryId)
  activeCategoryName.value = activeCategoryId.value > 0
    ? String(route.query.categoryName || `分类 #${activeCategoryId.value}`).trim()
    : ''
  onlyDealOrders.value = currentRole.value === 'buy' ? false : parseRouteBoolean(route.query.dealOnly)
}

// 切换角色
async function switchRole(role) {
  const nextQuery = { ...route.query }
  if (role === currentRole.value && normalizeOrderTab(route.query.tab) === role) return

  nextQuery.tab = role
  if (role === 'buy') {
    delete nextQuery.categoryId
    delete nextQuery.categoryName
    delete nextQuery.dealOnly
  }
  router.replace({ query: nextQuery }).catch(() => {})
}

function buildOrderQueryOptions() {
  const options = {
    page: page.value,
    pageSize,
    search: orderSearch.value.trim(),
    timeRange: timeRange.value
  }
  if (currentRole.value !== 'buy' && activeCategoryId.value > 0) {
    options.categoryId = activeCategoryId.value
  }
  if (currentRole.value !== 'buy' && onlyDealOrders.value) {
    options.dealOnly = true
  }
  return options
}

// 加载订单
async function loadOrders(append = false) {
  try {
    if (!append) {
      loading.value = true
    } else {
      loadingMore.value = true
    }
    
    const queryOptions = buildOrderQueryOptions()
    let result
    if (currentRole.value === 'buy') {
      result = await shopStore.fetchMyBuyOrders(queryOptions)
    } else if (currentRole.value === 'buyer') {
      result = await shopStore.fetchMyOrders(queryOptions)
    } else {
      result = await shopStore.fetchSellerOrders(queryOptions)
    }

    const ordersList = Array.isArray(result?.orders) ? result.orders : []
    const totalPages = Number(result?.pagination?.totalPages || 0)
    hasMore.value = page.value < totalPages
    
    if (append) {
      orders.value.push(...ordersList)
    } else {
      orders.value = ordersList
    }
  } catch (error) {
    toast.error('加载订单失败')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// 加载更多
function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value) return
  page.value++
  loadOrders(true)
}

async function applyFilters() {
  page.value = 1
  await loadOrders()
}

async function clearSearch() {
  if (!orderSearch.value) return
  orderSearch.value = ''
  await applyFilters()
}

async function clearDirectFilters() {
  const nextQuery = { ...route.query, tab: currentRole.value }
  delete nextQuery.categoryId
  delete nextQuery.categoryName
  delete nextQuery.dealOnly
  await router.replace({ query: nextQuery }).catch(() => {})
}

function getOrderKey(order) {
  return order.order_no || order.orderNo || order.id
}

function parseDateTimeToTimestamp(value) {
  if (value == null || value === '') return NaN

  if (typeof value === 'number') {
    return value > 1e12 ? value : value * 1000
  }

  const raw = String(value).trim()
  if (!raw) return NaN

  if (/^\d+$/.test(raw)) {
    const num = Number(raw)
    return num > 1e12 ? num : num * 1000
  }

  // Backend stores Beijing time like: YYYY-MM-DD HH:mm:ss
  const beijingMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/)
  if (beijingMatch) {
    const seconds = beijingMatch[3] || '00'
    return new Date(`${beijingMatch[1]}T${beijingMatch[2]}:${seconds}+08:00`).getTime()
  }

  return new Date(raw).getTime()
}

function getOrderExpireTimestamp(order) {
  const directExpire = order.pay_expired_at || order.payExpiredAt || order.expire_at || order.expireAt
  const directTs = parseDateTimeToTimestamp(directExpire)
  if (!Number.isNaN(directTs) && directTs > 0) return directTs

  const createdTs = parseDateTimeToTimestamp(order.created_at || order.createdAt)
  if (!Number.isNaN(createdTs) && createdTs > 0) {
    // Fallback: pending orders are valid for 5 minutes.
    return createdTs + 5 * 60 * 1000
  }

  return NaN
}

function getExpireCountdownText(order) {
  if (order.status !== 'pending') return ''

  const expireTs = getOrderExpireTimestamp(order)
  if (Number.isNaN(expireTs) || expireTs <= 0) return '即将过期'

  const diff = expireTs - nowTs.value
  if (diff <= 0) return '已过期，等待状态同步'

  const totalSeconds = Math.floor(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `支付剩余 ${hours}小时${minutes}分`
  }
  if (minutes > 0) {
    return `支付剩余 ${minutes}分${seconds}秒`
  }
  return `支付剩余 ${seconds}秒`
}

function getOrderPaidAt(order) {
  return order.paid_at || order.paidAt || order.pay_time || order.paidTime
}

function isPaidOvertime(order) {
  if (order.status !== 'paid') return false
  const paidAt = getOrderPaidAt(order)
  const paidTs = new Date(paidAt || 0).getTime()
  if (!paidTs || Number.isNaN(paidTs)) return false
  return Date.now() - paidTs >= 30 * 60 * 1000
}

function showManualDeliver(order) {
  if (currentRole.value !== 'seller') return false
  if (isNormalOrder(order)) return order.status === 'paid'
  return isCdkOrder(order) && isPaidOvertime(order)
}

function isDeliverFormVisible(order) {
  return deliverFormOrderId.value === getOrderKey(order) && showManualDeliver(order)
}

function openDeliverForm(order) {
  if (!showManualDeliver(order)) return
  deliverFormOrderId.value = getOrderKey(order)
  deliverContent.value = ''
}

function closeDeliverForm() {
  deliverFormOrderId.value = null
  deliverContent.value = ''
}

function canRepay(order) {
  if (isBuyRequestOrder(order)) {
    return order.myRole === 'requester'
  }
  return currentRole.value === 'buyer' && isPlatformOrder(order)
}

function extractErrorMessage(result, fallback) {
  if (typeof result?.error === 'string') return result.error
  if (result?.error?.message) return result.error.message
  if (result?.error?.code) return result.error.code
  return fallback
}

// 查看订单详情
function viewOrderDetail(order) {
  // 图床订单跳转到图床页面
  if (order.order_type === 'image') {
    router.push('/ld-image')
    return
  }

  if (isBuyRequestOrder(order)) {
    const orderNo = getOrderKey(order)
    if (!orderNo) {
      router.push('/user/orders?tab=buy')
      return
    }
    router.push(`/user/buy-orders/${encodeURIComponent(orderNo)}`)
    return
  }

  const orderNo = getOrderKey(order)
  router.push(`/order/${orderNo}?role=${currentRole.value}`)
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
    expired: '已过期',
    uploaded: '已上传'
  }
  return map[status] || status || '未知'
}

// 状态样式
function getStatusClass(status) {
  const map = {
    pending: 'status-pending',
    paying: 'status-pending',
    paid: 'status-paid',
    completed: 'status-completed',
    cancelled: 'status-cancelled',
    refunded: 'status-refunded',
    delivered: 'status-delivered',
    expired: 'status-expired',
    uploaded: 'status-completed'
  }
  return map[status] || ''
}

// 订单类型
function getOrderDisplayName(order) {
  if (isBuyRequestOrder(order)) {
    return order.requestTitle || order.request_title || order.product?.name || '求购订单'
  }
  return order.product?.name || order.product_name
}

// 格式化日期
function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

// 是否是CDK类型订单
function isCdkOrder(order) {
  return isCdkProduct(order)
}

function isNormalOrder(order) {
  return isNormalProduct(order)
}

function isPlatformOrder(order) {
  return isPlatformOrderProduct(order)
}

function requiresBuyerContactOrder(order) {
  return requiresBuyerContact(order)
}

function isBuyRequestOrder(order) {
  const type = order.order_type || order.orderType
  return type === 'buy_request'
}

function getOrderQuantity(order) {
  const quantity = Number(order?.quantity ?? order?.product_quantity ?? 1)
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1
}

function getOrderProductId(order) {
  const value = Number(order?.product_id ?? order?.product?.id ?? 0)
  return Number.isInteger(value) && value > 0 ? value : 0
}

function canReviewOrder(order) {
  if (currentRole.value !== 'buyer') return false
  if (!isCdkOrder(order)) return false
  if (order?.status !== 'delivered') return false
  if (order?.comment_enabled === false) return false
  return getOrderProductId(order) > 0
}

function goToOrderReview(order) {
  const productId = getOrderProductId(order)
  if (!productId) {
    toast.warning('该订单缺少商品信息，无法跳转评价')
    return
  }
  router.push({ path: `/product/${productId}`, hash: '#comments' })
}

// 是否有发货内容
function hasDeliveryContent(order) {
  return !!(order.cdk || order.delivery_content || order.deliveryContent)
}

// 获取发货内容
function getDeliveryContent(order) {
  return order.cdk || order.delivery_content || order.deliveryContent || ''
}

function getDeliveryCodes(order) {
  const content = getDeliveryContent(order)
  if (!content) return []
  return String(content)
    .split(/\r?\n/g)
    .filter((item) => item.trim().length > 0)
}

// 切换CDK显示
function toggleCdkVisibility(order) {
  order._showCdk = !order._showCdk
}

// 复制CDK
function copyCdk(order) {
  const content = getDeliveryContent(order)
  if (content) {
    navigator.clipboard.writeText(content)
    toast.success(isCdkOrder(order) ? 'CDK 已复制到剪贴板' : '发货内容已复制到剪贴板')
  }
}

function getDeliverPlaceholder(order) {
  if (isNormalOrder(order)) {
    return '请输入交付说明、联系方式、服务结果或其他履约信息'
  }
  return '请输入发货内容（CDK/链接/说明）'
}

function getDeliverHint(order) {
  if (isNormalOrder(order)) {
    return '提示：普通物品不会自动发货，请填写买家获取服务所需的信息并及时完成履约。'
  }
  return '提示：系统卡顿导致未自动发货时，可手动补发。'
}

async function handleRepay(order) {
  if (isPaymentMaintenanceBlocked.value) {
    toast.warning('因 LinuxDo Credit 积分服务维护中，当前暂不支持支付或补查')
    return
  }

  const orderNo = getOrderKey(order)
  if (!orderNo || payingOrderId.value === orderNo) return

  const loadingId = toast.loading('正在获取支付链接...')
  const preparedWindow = prepareNewTab()
  payingOrderId.value = orderNo

  try {
    const result = isBuyRequestOrder(order)
      ? await shopStore.getBuyOrderPaymentUrl(orderNo)
      : await shopStore.getPaymentUrl(orderNo)
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
    payingOrderId.value = null
  }
}

async function handleRefreshOrder(order) {
  if (isPaymentMaintenanceBlocked.value) {
    toast.warning('因 LinuxDo Credit 积分服务维护中，当前暂不支持支付或补查')
    return
  }

  const orderNo = getOrderKey(order)
  if (!orderNo || refreshingOrderId.value === orderNo) return

  refreshingOrderId.value = orderNo
  try {
    const result = await shopStore.refreshOrderStatus(orderNo)
    if (!result?.success) {
      toast.error(extractErrorMessage(result, '检查支付状态失败'))
      return
    }

    const status = result?.data?.status || ''
    if (status === 'delivered') {
      toast.success(isNormalOrder(order) ? '支付成功，卖家已完成交付' : '支付成功，已自动发货')
    } else if (status === 'paid') {
      toast.success(requiresBuyerContactOrder(order) ? '支付成功，请主动联系卖家获取服务' : '支付成功，订单状态已更新')
    } else if (status === 'expired') {
      toast.warning('订单已过期，请重新下单')
    } else {
      toast.show(result?.data?.message || '订单尚未支付')
    }

    await loadOrders()
  } catch (error) {
    toast.error(error?.message || '检查支付状态失败')
  } finally {
    refreshingOrderId.value = null
  }
}

async function handleRefreshBuyOrder(order) {
  if (isPaymentMaintenanceBlocked.value) {
    toast.warning('因 LinuxDo Credit 积分服务维护中，当前暂不支持支付或补查')
    return
  }

  const orderNo = getOrderKey(order)
  if (!orderNo || refreshingBuyOrderId.value === orderNo) return

  refreshingBuyOrderId.value = orderNo
  try {
    const result = await shopStore.refreshBuyOrderStatus(orderNo)
    if (!result?.success) {
      toast.error(extractErrorMessage(result, '刷新状态失败'))
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

    await loadOrders()
  } catch (error) {
    toast.error(error?.message || '刷新状态失败')
  } finally {
    refreshingBuyOrderId.value = null
  }
}

// 取消订单

async function handleCancelOrder(order) {
  const productName = order.product?.name || order.product_name || '该物品'
  const confirmed = await dialog.confirm(`确定要取消订单「${productName}」吗？`, {
    title: '取消订单',
    confirmText: '确定取消',
    cancelText: '再想想'
  })

  if (!confirmed) return

  const orderNo = getOrderKey(order)
  if (!orderNo || cancellingOrderId.value === orderNo) return

  const loadingId = toast.loading('正在取消订单...')
  cancellingOrderId.value = orderNo

  try {
    await shopStore.cancelOrder(orderNo)
    toast.success('订单已取消')
    // 刷新订单列表
    await loadOrders()
  } catch (error) {
    toast.error(error.message || '取消失败')
  } finally {
    toast.close(loadingId)
    cancellingOrderId.value = null
  }
}

// 手动发货
async function submitManualDeliver(order) {
  const orderNo = getOrderKey(order)
  if (!orderNo || deliveringOrderId.value === orderNo) return
  const content = deliverContent.value.trim()
  if (!content) {
    toast.warning('请输入发货内容')
    return
  }
  
  const loadingId = toast.loading('正在发货...')
  deliveringOrderId.value = orderNo
  
  try {
    const result = await shopStore.deliverOrder(orderNo, content)
    if (result?.success === false) {
      toast.error(result?.error?.message || result?.error || '发货失败')
      return
    }
    toast.success(result?.message || '发货成功')
    closeDeliverForm()
    await loadOrders()
  } catch (error) {
    toast.error('发货失败: ' + (error.message || '未知错误'))
  } finally {
    toast.close(loadingId)
    deliveringOrderId.value = null
  }
}

onMounted(() => {
  countdownTimer = setInterval(() => {
    nowTs.value = Date.now()
  }, 1000)
})

watch(
  () => [route.query.tab, route.query.categoryId, route.query.categoryName, route.query.dealOnly].join('|'),
  async () => {
    syncRouteState()
    page.value = 1
    closeDeliverForm()
    await loadOrders()
  },
  { immediate: true }
)

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
})
</script>

<style scoped>
.orders-page {
  min-height: 100vh;
  padding-bottom: 80px;
}

.page-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

/* 角色切换 */
.role-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.role-tab {
  flex: 1;
  padding: 14px 20px;
  background: var(--bg-card);
  border: 2px solid var(--border-color);
  border-radius: 14px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.role-tab:hover {
  border-color: var(--border-hover);
  background: var(--bg-secondary);
}

.role-tab.active {
  background: rgba(143, 163, 141, 0.15);
  border-color: #8fa38d;
  color: #6b7d69;
  font-weight: 600;
}

.orders-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.direct-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: -6px 0 16px;
}

.direct-filter-chip {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(181, 168, 152, 0.14);
  color: #7c6f62;
  font-size: 13px;
  font-weight: 500;
}

.direct-filter-chip.strong {
  background: rgba(143, 163, 141, 0.18);
  color: #5d715b;
}

.direct-filter-clear {
  height: 34px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
}

.filter-input {
  flex: 1;
  min-width: 220px;
  height: 42px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
}

.filter-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.filter-select-wrap {
  min-width: 118px;
}

.filter-btn {
  height: 42px;
  padding: 0 14px;
  border-radius: 12px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.filter-btn.secondary {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.filter-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 加载骨架 */
.loading-state {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 16px 20px;
  box-shadow: var(--shadow-sm);
}

.skeleton-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skeleton {
  background: var(--skeleton-gradient);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-line {
  height: 14px;
}

.skeleton-badge {
  width: 60px;
  height: 24px;
  border-radius: 12px;
}

.w-24 { width: 96px; }
.w-32 { width: 128px; }
.w-48 { width: 192px; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* 空状态按钮 */
.browse-btn {
  display: inline-block;
  padding: 12px 24px;
  background: var(--color-primary);
  color: white;
  border-radius: 12px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.browse-btn:hover {
  background: var(--color-primary-hover);
}

/* 订单列表 */
.orders-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 16px 20px;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.order-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.order-date {
  font-size: 13px;
  color: var(--text-tertiary);
}

.order-status {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.status-paid {
  background: var(--color-success-light);
  color: var(--color-success);
}

.status-completed {
  background: var(--color-success-light);
  color: var(--color-success);
}

.status-delivered {
  background: var(--color-info-light);
  color: var(--color-info);
}

.status-cancelled {
  background: var(--bg-secondary);
  color: var(--text-tertiary);
}

.status-refunded {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.status-expired {
  background: var(--bg-tertiary);
  color: var(--text-quaternary);
}

.order-content {
  margin-bottom: 12px;
}

.product-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: var(--text-tertiary);
}

.order-manual-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-primary);
}

.order-quantity {
  font-weight: 600;
  color: var(--text-secondary);
}

.order-expire-inline {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-warning);
  white-space: nowrap;
  margin-left: auto;
}

/* CDK 显示区域 */
.cdk-display {
  margin: 12px 0;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.cdk-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-success);
  margin-bottom: 8px;
}

.cdk-count {
  color: var(--text-tertiary);
  font-weight: 400;
}

.cdk-content-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.cdk-code {
  flex: 1;
  padding: 10px 12px;
  background: var(--bg-card);
  border-radius: 8px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  gap: 4px;
  white-space: pre-wrap;
  word-break: break-word;
}

.cdk-code.hidden {
  display: block;
  color: var(--text-tertiary);
  letter-spacing: 2px;
}

.cdk-line {
  line-height: 1.5;
}

.cdk-actions {
  display: flex;
  gap: 6px;
}

.cdk-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.cdk-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.order-amount-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.order-amount {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-warning);
}

.order-count {
  font-size: 12px;
  color: var(--text-tertiary);
}

.order-action {
  font-size: 13px;
  color: var(--color-primary);
}

.order-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.maintenance-order-hint {
  margin-top: 10px;
  color: #b45309;
  font-size: 12px;
  line-height: 1.6;
  text-align: right;
}

.action-btn {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  border: none;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.cancel-btn {
  background: var(--bg-secondary);
  color: var(--text-tertiary);
}

.action-btn.cancel-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.action-btn.deliver-btn {
  background: linear-gradient(135deg, var(--color-info) 0%, #3b82f6 100%);
  color: white;
}

.action-btn.deliver-btn:hover:not(:disabled) {
  opacity: 0.92;
}

.action-btn.pay-btn {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
  color: white;
}

.action-btn.pay-btn:hover {
  opacity: 0.9;
}

.action-btn.ghost-btn {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}

.action-btn.ghost-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.action-btn.enter-btn {
  background: var(--color-success);
  color: #fff;
}

.action-btn.enter-btn:hover:not(:disabled) {
  opacity: 0.92;
}

.action-btn.review-btn {
  background: linear-gradient(135deg, #8da6a8 0%, #789497 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(120, 148, 151, 0.24);
}

.action-btn.review-btn:hover:not(:disabled) {
  box-shadow: 0 6px 14px rgba(120, 148, 151, 0.3);
  filter: brightness(0.97);
}

/* 手动发货 */
.deliver-form {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-light);
}

.deliver-input {
  width: 100%;
  min-height: 72px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  resize: vertical;
  box-sizing: border-box;
}

.deliver-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.deliver-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

.deliver-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 加载更多 */
.load-more {
  padding: 20px;
  text-align: center;
}

.load-more-btn {
  padding: 12px 32px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 24px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.load-more-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .filter-input {
    min-width: 100%;
  }

  .filter-select,
  .filter-btn {
    flex: 1;
  }
}
</style>
