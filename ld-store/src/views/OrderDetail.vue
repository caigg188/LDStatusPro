<template>
  <div class="order-detail-page">
    <div class="page-container">
      <div class="top-nav">
        <button class="top-back-btn" type="button" @click="goBack">
          <ArrowLeft :size="16" aria-hidden="true" />
          <span>返回</span>
        </button>
        <router-link to="/support" class="support-btn top-support-btn">
          <Heart class="support-heart" :size="16" aria-hidden="true" />
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
        text="订单不存在"
        hint="无法找到该订单信息"
      >
        <template #icon>
          <SearchX :size="48" :stroke-width="1.6" aria-hidden="true" />
        </template>
        <template #action>
          <router-link to="/user/orders" class="back-btn">
            <ArrowLeft :size="16" aria-hidden="true" />
            <span>返回</span>
          </router-link>
        </template>
      </EmptyState>
      
      <!-- 订单详情 -->
      <template v-else>
        <!-- 订单状态卡片 -->
        <div :class="['status-card', getStatusClass(displayOrderStatus(order))]">
          <div class="status-card__main">
            <div class="status-icon" aria-hidden="true">
              <component :is="getStatusIcon(displayOrderStatus(order))" :size="28" :stroke-width="1.8" />
            </div>
            <div>
              <div class="status-text">{{ getStatusText(displayOrderStatus(order)) }}</div>
              <p v-if="refundStageText(order)" class="status-time">{{ refundStageText(order) }}</p>
              <p v-if="displayOrderStatus(order) !== order.status" class="status-time">履约：{{ orderFulfillmentLabel(order) }}</p>
              <div class="status-time" v-if="order.createdAt">
                {{ formatDateTime(order.createdAt) }}
              </div>
            </div>
          </div>
          <div class="status-card__meta">
            <span class="status-chip">订单号 {{ order.orderNo || order.id }}</span>
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
          <h3 class="card-title">
            <ShoppingBag :size="17" aria-hidden="true" />
            物品信息
          </h3>
          
          <div class="info-row">
            <span class="info-label">物品名称</span>
            <button
              v-if="productDetailPath"
              type="button"
              class="info-value info-link"
              @click="goToProductDetail"
            >
              {{ order.product?.name || order.productName }}
            </button>
            <span v-else class="info-value">{{ order.product?.name || order.productName }}</span>
          </div>

          <div class="info-row">
            <span class="info-label">物品分类</span>
            <span class="info-value">
              <span class="order-category-badge">
                {{ getProductCategoryText(order) }}
              </span>
            </span>
          </div>

          <div class="info-row">
            <span class="info-label">数量</span>
            <span class="info-value">{{ itemPricing.quantity }} 件</span>
          </div>

          <div class="info-row" v-if="itemPricing.originalUnitPrice > 0">
            <span class="info-label">单价</span>
            <span class="info-value unit-price-value">
              <template v-if="itemPricing.hasProductDiscount">
                <small class="unit-price-original">
                  原价 <del>{{ formatMoney(itemPricing.originalUnitPrice) }} LDC / 件</del>
                </small>
                <strong class="unit-price-discounted">
                  折后 {{ formatMoney(itemPricing.discountedUnitPrice) }} LDC / 件
                </strong>
              </template>
              <strong v-else class="unit-price-current">
                {{ formatMoney(itemPricing.originalUnitPrice) }} LDC / 件
              </strong>
            </span>
          </div>

          <div class="info-row" v-if="itemPricing.productSubtotal > 0">
            <span class="info-label">金额小计</span>
            <span class="info-value">{{ formatMoney(itemPricing.productSubtotal) }} LDC</span>
          </div>

          <template v-if="hasCoupon">
            <div class="info-row coupon-row">
              <span class="info-label">优惠券</span>
              <span class="info-value coupon-name">{{ couponSnapshot.name || '优惠券' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">优惠规则</span>
              <span class="info-value">{{ couponRuleText }}</span>
            </div>
            <div class="info-row discount-row">
              <span class="info-label">优惠券减免</span>
              <span class="info-value">-{{ couponDiscountAmount.toFixed(2) }} LDC</span>
            </div>
          </template>
          
          <div class="info-row amount">
            <span class="info-label">实付积分</span>
            <span class="info-value price">{{ order.amount || order.totalPrice }} LDC</span>
          </div>
        </div>
        
        <!-- 交易双方信息 -->
        <div class="info-card">
          <h3 class="card-title">
            <UsersRound :size="17" aria-hidden="true" />
            交易信息
          </h3>
          
          <div class="info-row">
            <span class="info-label">卖家</span>
            <span class="info-value user-info">
              <span v-if="sellerIdentity.nickname" class="user-nickname">{{ sellerIdentity.nickname }}</span>
              <a
                v-if="sellerIdentity.profileUrl"
                :href="sellerIdentity.profileUrl"
                target="_blank"
                rel="noopener"
                class="user-link"
                :aria-label="`查看 @${sellerIdentity.username} 的 Linux DO 个人主页`"
              >
                @{{ sellerIdentity.username }}
              </a>
              <span v-else class="user-unknown">未知</span>
            </span>
          </div>
          
          <div class="info-row">
            <span class="info-label">买家</span>
            <span class="info-value user-info">
              <span v-if="buyerIdentity.nickname" class="user-nickname">{{ buyerIdentity.nickname }}</span>
              <a
                v-if="buyerIdentity.profileUrl"
                :href="buyerIdentity.profileUrl"
                target="_blank"
                rel="noopener"
                class="user-link"
                :aria-label="`查看 @${buyerIdentity.username} 的 Linux DO 个人主页`"
              >
                @{{ buyerIdentity.username }}
              </a>
              <span v-else class="user-unknown">未知</span>
            </span>
          </div>
          
          <div class="info-row" v-if="order.deliveryType">
            <span class="info-label">发货方式</span>
            <span class="info-value delivery-value">
              <PackageCheck v-if="order.deliveryType === 'auto'" :size="16" aria-hidden="true" />
              <UserRound v-else :size="16" aria-hidden="true" />
              {{ order.deliveryType === 'auto' ? '自动发货' : '手动发货' }}
            </span>
          </div>
        </div>
        
        <div class="info-card" v-if="requiresBuyerContactOrder(order)">
          <h3 class="card-title">
            <BellRing :size="17" aria-hidden="true" />
            履约提醒
          </h3>
          <div class="description-content">
            {{ currentRole === 'buyer' ? '支付完成后请主动联系卖家获取服务，订单会保留在平台内等待卖家手动履约。' : '该订单为普通物品订单，买家支付后需要您主动处理交付并填写发货内容。' }}
          </div>
        </div>

        <!-- CDK 信息 -->
        <div class="info-card" v-if="isCdkOrder(order) && getDeliveryContent(order)">
          <div class="cdk-card-header">
            <h3 class="card-title">
              <KeyRound :size="17" aria-hidden="true" />
              CDK 密钥
            </h3>
            <div class="cdk-actions">
              <button
                type="button"
                class="icon-btn"
                :title="showCdk ? '隐藏密钥' : '显示密钥'"
                :aria-label="showCdk ? '隐藏密钥' : '显示密钥'"
                @click="showCdk = !showCdk"
              >
                <EyeOff v-if="showCdk" :size="17" aria-hidden="true" />
                <Eye v-else :size="17" aria-hidden="true" />
              </button>
              <button type="button" class="icon-btn" title="复制密钥" aria-label="复制密钥" @click="copyCdk">
                <Copy :size="17" aria-hidden="true" />
              </button>
              <button type="button" class="icon-btn" title="导出为 TXT" aria-label="导出为 TXT" @click="downloadCdk">
                <Download :size="17" aria-hidden="true" />
              </button>
            </div>
          </div>
          
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
          </div>
        </div>
        
        <div class="info-card" v-if="isNormalOrder(order) && getDeliveryContent(order)">
          <h3 class="card-title">
            <PackageCheck :size="17" aria-hidden="true" />
            发货内容
          </h3>
          <div class="description-content preserve-line-breaks">{{ getDeliveryContent(order) }}</div>
        </div>

        <!-- 使用说明（显示物品描述） -->
        <div class="info-card" v-if="(isCdkOrder(order) || isNormalOrder(order)) && getProductDescription(order)">
          <h3 class="card-title">
            <FileText :size="17" aria-hidden="true" />
            使用说明
          </h3>
          <div class="description-content markdown-content" v-html="renderedProductDescription"></div>
        </div>

        <FulfillmentDeadline v-if="['paid', 'refund_pending'].includes(order.status)" :order="order" />
        <OrderRefundPanel
          v-if="isPlatformOrder(order)"
          :order="order"
          :role="currentRole"
          @updated="handleRefundUpdated"
        />
        
        <!-- 订单信息 -->
        <div class="info-card">
          <h3 class="card-title">
            <ReceiptText :size="17" aria-hidden="true" />
            订单信息
          </h3>

          <div class="order-summary-grid">
            <div class="summary-item">
              <span class="summary-label">业务单号</span>
              <span class="summary-value mono">{{ order.orderNo || order.id }}</span>
            </div>
            <div v-if="order.ldcTradeNo" class="summary-item">
              <span class="summary-label">编号</span>
              <span class="summary-value mono">{{ order.ldcTradeNo }}</span>
            </div>
          </div>
        </div>
        
        <!-- 订单日志 -->
        <div class="info-card" v-if="orderLogs && orderLogs.length > 0">
          <h3 class="card-title">
            <History :size="17" aria-hidden="true" />
            订单动态
          </h3>
          
          <div class="order-logs">
            <div class="log-item" v-for="(log, index) in sortedOrderLogs" :key="index">
              <div class="log-icon" aria-hidden="true">
                <component :is="getLogIcon(log.action)" :size="16" :stroke-width="1.9" />
              </div>
              <div class="log-content">
                <div class="log-action">{{ getLogText(log) }}</div>
                <div class="log-time">{{ formatDateTime(log.createdAt || log.time) }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="currentRole === 'buyer' && ['cancelled', 'expired'].includes(order.status) && productDetailPath" class="actions">
          <button type="button" class="refresh-btn" @click="router.push(productDetailPath)">重新选购并下单</button>
        </div>
        <!-- 操作按钮 -->
        <div class="actions" v-if="showActions">
          <p v-if="paymentConfirming" class="maintenance-action-hint" role="status" aria-live="polite">
            {{ (order?.payment_init_status || order?.paymentInitStatus) === 'creating' ? '正在创建支付，请稍候。' : '支付结果确认中，请勿重复兑换。' }}
            <span v-if="order?.paymentResolutionDeadline">预计在 {{ new Date(order.paymentResolutionDeadline).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }} 前后完成核查；未确认支付的订单将自动取消。</span>
            页面会自动更新。
          </p>
          <p v-if="paymentPopupOpen" class="maintenance-action-hint" role="status" aria-live="polite">
            支付窗口打开中。支付完成或关闭窗口后，这里会自动更新订单状态。
          </p>
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
              :disabled="cancelling || paying || paymentConfirming"
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
import { orderStatusLabel, displayOrderStatus, orderFulfillmentLabel, refundStageText } from '@/utils/orderPresentation'
import FulfillmentDeadline from '@/components/order/FulfillmentDeadline.vue'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  BadgeCheck,
  BellRing,
  CircleCheck,
  CircleDollarSign,
  CircleX,
  ClipboardList,
  Clock,
  Copy,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  FileText,
  Heart,
  History,
  KeyRound,
  LockKeyhole,
  LockOpen,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  SearchX,
  ShieldAlert,
  ShoppingBag,
  TimerOff,
  UserRound,
  UsersRound
} from '@lucide/vue'
import { useCatalogStore } from '@/stores/catalog'
import { useOrderStore } from '@/stores/order'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { useOrderActions } from '@/composables/orders/useOrderActions'
import { useOrderDetail } from '@/composables/orders/useOrderDetail'
import { usePaymentPopupSync } from '@/composables/orders/usePaymentPopupSync'
import { isMaintenanceFeatureEnabled, isRestrictedMaintenanceMode } from '@/config/maintenance'
import EmptyState from '@/components/common/EmptyState.vue'
import OrderRefundPanel from '@/components/order/OrderRefundPanel.vue'
import { isValidLdcPaymentUrl } from '@/utils/security'
import { renderProductDescription } from '@/utils/renderProductDescription'
import { preparePaymentPopup, openPaymentPopup, cleanupPreparedTab } from '@/utils/newTab'
import { trackPaymentPopup } from '@/utils/paymentReturn'
import {
  isCdkProduct,
  isNormalProduct,
  isPlatformOrderProduct,
  requiresBuyerContact
} from '@/utils/shopProduct'
import { ORDER_LIST_SCROLL_SOURCE, readOrderScrollSnapshot } from '@/utils/orderListScroll'
import { resolveOrderPartyIdentity } from '@/utils/orderPartyIdentity'
import { resolveOrderItemPricing } from '@/utils/orderItemPricing'
import { formatPrice } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const catalogStore = useCatalogStore()
const orderStore = useOrderStore()
const toast = useToast()
const dialog = useDialog()

const showCdk = ref(false)
const isPaymentMaintenanceBlocked = computed(() =>
  isRestrictedMaintenanceMode() && !isMaintenanceFeatureEnabled('orderPayment')
)

const couponSnapshot = computed(() => {
  const value = order.value?.couponSnapshot
  if (!value) return {}
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return {} }
})
const itemPricing = computed(() => resolveOrderItemPricing(order.value))
const couponDiscountAmount = computed(() => Number(
  order.value?.couponDiscountAmount
  ?? couponSnapshot.value?.couponDiscountAmount
  ?? 0
))
const hasCoupon = computed(() => !!(
  order.value?.couponClaimId
  ?? couponSnapshot.value?.campaignId
))
const couponRuleText = computed(() => {
  if (couponSnapshot.value.discountType === 'fixed_amount') {
    return `减 ${Number(couponSnapshot.value.fixedAmount || 0).toFixed(2)} LDC（整单一次）`
  }
  if (couponSnapshot.value.discountType === 'percentage') {
    const bps = Number(couponSnapshot.value.percentageBps || 0)
    return `${(bps / 1000).toFixed(bps % 1000 === 0 ? 0 : 1)} 折（仅优惠 ${couponSnapshot.value.discountedQuantity || 1} 件）`
  }
  return '按订单快照结算'
})

const sellerIdentity = computed(() => resolveOrderPartyIdentity(order.value, 'seller'))
const buyerIdentity = computed(() => resolveOrderPartyIdentity(order.value, 'buyer'))

// 当前用户角色（买家/卖家）
const currentRole = computed(() => route.meta.orderRole || route.query.role || 'buyer')
const detailActions = useOrderActions()
const orderDetailController = useOrderDetail({
  orderId: computed(() => String(route.params.id || '')),
  role: computed(() => String(currentRole.value)),
  fetchDetail: (orderId, role, signal) => orderStore.fetchOrderDetail(orderId, role, { signal }),
  onError: () => toast.error('加载订单详情失败')
})
const {
  loading,
  order,
  logs: orderLogs,
  load: loadOrder,
  startAutoRefresh: startOrderAutoRefresh,
  stopAutoRefresh: stopPendingOrderAutoRefresh,
  stop: stopOrderDetail
} = orderDetailController
const cancelling = computed(() => detailActions.cancellingOrderId.value !== null)
const paying = computed(() => detailActions.payingOrderId.value !== null)
const checkingPayment = computed(() => detailActions.refreshingOrderId.value !== null)
const backTarget = computed(() => {
  if (currentRole.value !== 'seller') return '/user/orders?tab=buyer'
  return route.query.from === 'refunds' ? '/seller/refunds?status=action_required' : '/seller/orders?source=product'
})

// 是否显示操作按钮区域（买家和卖家都可以取消待支付订单）
const showActions = computed(() => {
  return order.value?.status === 'pending'
})

const paymentConfirming = computed(() => order.value?.status === 'pending' && ['pending', 'creating', 'unknown'].includes(
  order.value?.payment_init_status || order.value?.paymentInitStatus || ''
))

const canRepay = computed(() => {
  return !isPaymentMaintenanceBlocked.value
    && !paymentConfirming.value
    && !!(order.value?.payment_url || order.value?.paymentUrl)
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
  const list = Array.isArray(catalogStore.categories) ? catalogStore.categories : []
  for (const cat of list) {
    if (cat?.id == null) continue
    map.set(String(cat.id), cat.name || '')
  }
  return map
})

const productDetailPath = computed(() => {
  const productId =
    order.value?.product?.id ??
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
const renderedProductDescription = computed(() => renderProductDescription(getProductDescription(order.value)))

function goBack() {
  // 从订单列表进来（存有滚动快照）时用 router.back()，返回后筛选与滚动位置可完整保留；
  // 新标签页/直接进入无快照，退回固定地址兜底
  if (readOrderScrollSnapshot()?.source === ORDER_LIST_SCROLL_SOURCE) {
    router.back()
    return
  }
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
    orderData?.categoryName ||
    orderData?.product?.categoryName ||
    orderData?.product?.category?.name

  if (directName) return directName

  const categoryId =
    orderData?.categoryId ??
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
  return orderData?.cdk || orderData?.deliveryContent || ''
}

function getDeliveryList(orderData) {
  const content = getDeliveryContent(orderData)
  if (!content) return []
  return String(content)
    .split(/\r?\n/g)
    .filter((item) => item.trim().length > 0)
}

function formatMoney(value) {
  return formatPrice(Number(value) || 0)
}

// 获取物品描述（使用说明）
function getProductDescription(orderData) {
  // 从物品快照或直接字段获取描述
  return orderData?.product?.description || 
         orderData?.productDescription || 
         ''
}

function handleRefundUpdated() {
  loadOrder({ silent: true }).catch(() => {})
}

function startPendingOrderAutoRefresh() {
  startOrderAutoRefresh(() => canRefreshPaymentStatus.value)
}

// 订单动态图标
function getLogIcon(action) {
  const map = {
    create: FilePlus2,
    pay: CircleDollarSign,
    repay: RefreshCw,
    deliver: PackageCheck,
    refund_request: RotateCcw,
    refund_reject: CircleX,
    refund_external_dispute: ShieldAlert,
    refund: RotateCcw,
    cancel: CircleX,
    expire: TimerOff,
    lock_cdk: LockKeyhole,
    unlock_cdk: LockOpen
  }
  return map[String(action || '').toLowerCase()] || ClipboardList
}

// 日志文字
function getLogText(log) {
  const actionMap = {
    create: '创建订单',
    pay: '支付成功',
    repay: '重新发起支付',
    deliver: '发货完成',
    complete: '买家确认收货',
    admin_complete: '管理员历史完结',
    refund_request: '买家申请退款',
    refund_reject: '卖家拒绝退款',
    refund_external_dispute: '订单已转 Credit 处理',
    refund: '订单退款',
    cancel: '取消订单',
    expire: '订单过期',
    lock_cdk: '锁定CDK',
    unlock_cdk: '释放CDK'
  }
  const actionText = actionMap[log.action] || log.action
  const operator = log.operatorName || log.operatorType || ''
  return operator ? `${actionText} (${operator})` : actionText
}

function toTimestamp(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function getLogTimestamp(log) {
  return toTimestamp(log?.createdAt || log?.time)
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
    completed: getTimelineTimestampFromLogs(logs, ['complete', 'completed', 'admin_complete']),
    paid: getTimelineTimestampFromLogs(logs, ['pay']),
    refunded: getTimelineTimestampFromLogs(logs, ['refund']),
    external_dispute: getTimelineTimestampFromLogs(logs, ['refund_external_dispute']),
    cancelled: getTimelineTimestampFromLogs(logs, ['cancel']),
    expired: getTimelineTimestampFromLogs(logs, ['expire'])
  }
  const fieldMap = {
    delivered: orderData.deliveredAt,
    completed: orderData.completedAt,
    paid: orderData.paidAt,
    refunded: orderData.refundedAt,
    external_dispute: orderData.updatedAt,
    cancelled: orderData.cancelledAt,
    expired: orderData.expiredAt || orderData.payExpiredAt || orderData.expireAt,
    pending: orderData.createdAt,
    paying: orderData.paidAt || orderData.createdAt
  }
  return logTimestampMap[status] || toTimestamp(fieldMap[status]) || toTimestamp(orderData.updatedAt || orderData.createdAt)
}

function getStatusTimeLabel(orderData) {
  if (orderData?.status === 'completed' && orderLogs.value.some(log => log.action === 'admin_complete')) return '管理员完结时间'
  const status = String(orderData?.status || '')
  const map = {
    delivered: '发货时间',
    completed: '完成时间',
    paid: '支付时间',
    refunded: '退款时间',
    external_dispute: '检测时间',
    cancelled: '取消时间',
    expired: '过期时间',
    pending: '创建时间',
    paying: '支付时间'
  }
  return map[status] || '更新时间'
}

// 状态文字（paid 即「待发货」：已支付未发货，与列表待发货筛选一致）
function getStatusText(status) {
  if (status === 'pending' && paymentConfirming.value) return (order.value?.payment_init_status || order.value?.paymentInitStatus) === 'creating' ? '正在创建' : '支付确认中'
  return orderStatusLabel(status)
}

// 订单状态图标
function getStatusIcon(status) {
  const map = {
    pending: Clock,
    paying: CreditCard,
    paid: CircleCheck,
    completed: BadgeCheck,
    cancelled: CircleX,
    refunded: RotateCcw,
    external_dispute: ShieldAlert,
    delivered: PackageCheck,
    expired: TimerOff
  }
  return map[String(status || '').toLowerCase()] || ClipboardList
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
    refund_pending: 'status-refund-pending',
    refund_failed: 'status-refund-failed',
    external_dispute: 'status-external-dispute',
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

  const orderNo = String(order.value?.orderNo || order.value?.id || 'order').trim()
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

let announcedPaymentStatus = ''

function toastPaymentSyncResult(status, pendingMessage = '') {
  if (status && status !== 'pending' && status === announcedPaymentStatus) return
  if (status && status !== 'pending') announcedPaymentStatus = status
  if (status === 'delivered') {
    toast.success(isNormalOrder(order.value) ? '支付成功，卖家已完成交付' : '支付成功，已自动发货')
  } else if (status === 'paid') {
    toast.success(requiresBuyerContactOrder(order.value) ? '支付成功，请主动联系卖家获取服务' : '支付成功，订单状态已更新')
  } else if (status === 'expired') {
    toast.warning('订单已过期，请重新下单')
  } else if (pendingMessage) {
    toast.show(pendingMessage)
  }
}

let deliveryFollowUpTimer = null

function scheduleDeliveryFollowUp() {
  const current = order.value
  if (!current || current.status !== 'paid' || current.deliveryType !== 'auto' || getDeliveryContent(current)) return
  if (deliveryFollowUpTimer) return
  deliveryFollowUpTimer = window.setTimeout(() => {
    deliveryFollowUpTimer = null
    if (order.value?.status === 'paid') void loadOrder({ silent: true })
  }, 2000)
}

async function reloadOrderAfterPayment() {
  const before = order.value?.status
  await loadOrder({ silent: true })
  const after = order.value?.status || ''
  if (before === 'pending' && after && after !== before) toastPaymentSyncResult(after)
  scheduleDeliveryFollowUp()
}

async function refreshPaymentFromPopup() {
  await handleRefreshPaymentStatus()
  scheduleDeliveryFollowUp()
}

async function handleRefreshPaymentStatus() {
  if (!canRefreshPaymentStatus.value || !order.value || checkingPayment.value) return

  const orderNo = order.value?.orderNo
  if (!orderNo) return

  try {
    const result = await detailActions.run('refresh', orderNo, () => orderStore.refreshOrderStatus(orderNo))
    if (!result) return
    if (!result?.success) {
      toast.error(extractErrorMessage(result, '检查支付状态失败'))
      return
    }

    toastPaymentSyncResult(result?.data?.status || '', result?.data?.message || '订单尚未支付')
    await loadOrder({ silent: true })
  } catch (error) {
    toast.error(error?.message || '检查支付状态失败')
  }
}

const { paymentPopupOpen, start: startPaymentPopupSync, stop: stopPaymentPopupSync } = usePaymentPopupSync({
  orderNo: () => String(route.params.id || order.value?.orderNo || ''),
  canQueryPayment: () => canRefreshPaymentStatus.value && !checkingPayment.value,
  reload: () => reloadOrderAfterPayment(),
  refreshPayment: () => refreshPaymentFromPopup()
})

async function handleRepay() {
  if (!canRepay.value || !order.value) return

  const orderNo = order.value?.orderNo
  if (!orderNo || paying.value) return

  const loadingId = toast.loading('正在获取支付链接...')
  const preparedWindow = preparePaymentPopup()

  try {
    const result = await detailActions.run('payment', orderNo, () => orderStore.getPaymentUrl(orderNo))
    if (!result) {
      cleanupPreparedTab(preparedWindow)
      return
    }
    const paymentUrl = result?.data?.paymentUrl

    if (!result?.success || !paymentUrl) {
      cleanupPreparedTab(preparedWindow)
      toast.update(loadingId, {
        type: 'error',
        message: extractErrorMessage(result, '获取支付链接失败')
      })
      return
    }

    if (!isValidLdcPaymentUrl(paymentUrl)) {
      cleanupPreparedTab(preparedWindow)
      toast.update(loadingId, { type: 'error', message: '支付链接异常，请稍后重试' })
      return
    }

    const { popup, isPopup } = openPaymentPopup(paymentUrl, preparedWindow)
    if (!isPopup) cleanupPreparedTab(preparedWindow)
    if (isPopup && popup) {
      trackPaymentPopup(orderNo, popup)
      startPaymentPopupSync()
    }
    toast.update(loadingId, { type: 'success', message: '支付窗口已打开' })
  } catch (error) {
    cleanupPreparedTab(preparedWindow)
    toast.update(loadingId, { type: 'error', message: error?.message || '获取支付链接失败' })
  }
}

// 取消订单
async function handleCancelOrder() {
  const productName = order.value?.product?.name || order.value?.productName || '该物品'
  const confirmed = await dialog.confirm(`确定要取消订单「${productName}」吗？`, {
    title: '取消订单',
    confirmText: '确定取消',
    cancelText: '再想想'
  })
  
  if (!confirmed) return
  
  try {
    const orderNo = order.value?.orderNo
    if (!orderNo) return
    const result = await detailActions.run('cancel', orderNo, () => orderStore.cancelOrder(orderNo))
    if (!result) return
    if (!result.success) throw new Error(result.error || '取消失败')
    toast.success('订单已取消')
    goBack()
  } catch (error) {
    toast.error(error.message || '取消失败')
  }
}

onMounted(async () => {
  await Promise.all([
    loadOrder(),
    catalogStore.fetchCategories()
  ])
  startPendingOrderAutoRefresh()
  startPaymentPopupSync()
})

watch(canRefreshPaymentStatus, (enabled) => {
  if (enabled) {
    startPendingOrderAutoRefresh()
  } else {
    stopPendingOrderAutoRefresh()
  }
})

watch(
  () => `${String(route.params.id || '')}|${String(currentRole.value)}`,
  async (next, previous) => {
    if (!previous || next === previous) return
    announcedPaymentStatus = ''
    await loadOrder()
    startPendingOrderAutoRefresh()
    startPaymentPopupSync()
  }
)

onUnmounted(() => {
  if (deliveryFollowUpTimer) {
    clearTimeout(deliveryFollowUpTimer)
    deliveryFollowUpTimer = null
  }
  stopPaymentPopupSync()
  stopOrderDetail()
  detailActions.clear()
})
</script>

<style scoped>
.status-refund-pending { color: var(--status-info); background: color-mix(in srgb, var(--status-info) 10%, var(--surface-card)); }
.status-refund-failed { color: var(--status-danger); background: color-mix(in srgb, var(--status-danger) 10%, var(--surface-card)); }
.order-status small { font-size: inherit; }
.order-fulfillment-progress { margin: 8px 0; color: var(--text-secondary-semantic); font-size: 12px; }

.order-detail-page {
  min-height: 100vh;
  padding-bottom: 100px;
}

.page-container {
  max-width: 600px;
}

.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.top-back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 10px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.top-back-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

@media (max-width: 639px) {
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 10px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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

.status-card.status-external-dispute {
  background: var(--color-warning-bg);
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

.status-card.status-pending .status-icon {
  color: var(--color-warning);
}

.status-card.status-success .status-icon {
  color: var(--color-success);
}

.status-card.status-info .status-icon {
  color: var(--color-info);
}

.status-card.status-cancelled .status-icon {
  color: var(--text-tertiary);
}

.status-card.status-refunded .status-icon {
  color: var(--color-danger);
}

.status-card.status-external-dispute .status-icon {
  color: var(--color-warning);
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
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-tertiary);
  margin: 0 0 16px;
}

.card-title svg {
  flex: 0 0 auto;
  color: var(--color-primary);
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

.coupon-name {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--color-primary-light);
  color: var(--color-primary-hover);
  font-weight: 650;
}

.discount-row .info-value {
  color: var(--color-danger);
  font-weight: 700;
}

.support-heart {
  flex: 0 0 auto;
  color: var(--color-danger);
  fill: currentColor;
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

.info-value.unit-price-value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  overflow: visible;
  text-overflow: unset;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.unit-price-original {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
}

.unit-price-original del {
  text-decoration-line: line-through;
  text-decoration-thickness: 1px;
  text-decoration-color: currentColor;
}

.unit-price-current,
.unit-price-discounted {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
  white-space: nowrap;
}

.unit-price-discounted {
  color: var(--color-danger);
}

.delivery-value {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
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
  outline: 2px solid color-mix(in srgb, var(--color-primary) 40%, var(--palette-hex-ffffff));
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
  color: var(--palette-hex-cfa76f);
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
  background: var(--palette-hex-e8f5e8);
  color: var(--palette-hex-5a8c5a);
}

.order-type-badge.link {
  background: var(--palette-hex-e8f0f5);
  color: var(--palette-hex-778d9c);
}

.order-type-badge.store {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.order-type-badge.service {
  background: var(--palette-hex-ece7f8);
  color: var(--palette-hex-6f5a96);
}

/* CDK 展示框 */
.cdk-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  flex-wrap: wrap;
  margin: 0 0 16px;
}

.cdk-card-header .card-title {
  margin: 0;
  flex: 1 0 auto;
  white-space: nowrap;
}

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
  min-width: 0;
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
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  margin-left: auto;
}

.icon-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  font-size: 16px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.icon-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.icon-btn:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--color-primary) 40%, var(--palette-hex-ffffff));
  outline-offset: 2px;
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

/* markdown 渲染：换行由 <br>/块级元素承担，不再依赖 pre-wrap */
.description-content.markdown-content {
  white-space: normal;
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
  background: linear-gradient(135deg, var(--palette-hex-a5b4a3) 0%, var(--palette-hex-95a493) 100%);
  color: var(--palette-hex-ffffff);
  border-radius: 999px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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
  color: var(--palette-hex-b45309);
  font-size: 13px;
  line-height: 1.6;
}

.pay-btn {
  flex: 1;
  padding: 16px 32px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
  color: var(--palette-hex-ffffff);
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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

/* 用户链接 */
.user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  overflow: visible;
  line-height: 1.35;
}

.user-nickname {
  max-width: 100%;
  color: var(--text-primary);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.user-link {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 24px;
  min-height: 24px;
  max-width: 100%;
  color: var(--text-secondary);
  font-size: 13px;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, currentColor 45%, transparent);
  text-underline-offset: 3px;
  overflow-wrap: anywhere;
}

.user-link:hover {
  color: var(--text-primary);
  text-decoration-color: currentColor;
}

.user-link:focus-visible {
  outline: 2px solid var(--text-secondary);
  outline-offset: 3px;
  border-radius: 4px;
}

.user-unknown {
  color: var(--text-tertiary);
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
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  color: var(--text-secondary);
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

@media (max-width: 359px) {
  .cdk-card-header {
    gap: 8px;
  }

  .cdk-actions {
    gap: 6px;
  }
}

@media (max-width: 639px) {
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

  .cdk-box {
    padding: 12px;
  }
}

@media (min-width: 768px) {
  .cdk-card-header .icon-btn {
    width: 36px;
    height: 36px;
  }
}
</style>
