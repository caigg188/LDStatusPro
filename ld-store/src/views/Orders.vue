<template>
  <div class="orders-page" :class="{ 'seller-orders-page': sellerMode }">
    <template v-if="sellerMode">
      <SellerPageToolbar eyebrow="交易台账" description="统一处理商品订单与求购服务订单。筛选、页码与来源会保留在地址中。">
        <!-- Tab selection/focus belongs to each control; pending feedback belongs to the list. -->
        <SellerTabs :modelValue="currentRole" :tabs="roleTabs" class="seller-source-tabs" size="sm" aria-label="订单来源" @update:modelValue="switchRole" />
        <OrderStatusFilter v-if="currentRole !== 'buy'" variant="seller" :modelValue="statusFilter" class="seller-status-tabs" size="sm" aria-label="订单状态" @update:modelValue="selectStatus" />
        <AppSelect v-model="timeRange" class="seller-order-select" :options="timeRangeOptions" placeholder="选择时间范围" @change="applyFilters" />
        <form class="seller-order-search" role="search" @submit.prevent="applyFilters">
          <Search :size="17" aria-hidden="true" />
          <label class="seller-sr-only" for="seller-order-search">搜索订单</label>
          <input id="seller-order-search" v-model.trim="orderSearch" type="search" placeholder="搜索订单号、商品名" />
          <button type="submit" :disabled="loading">搜索</button>
        </form>
        <template #summary>
          <span class="seller-filter-chip">{{ currentRole === 'seller' ? '商品订单' : '求购服务' }}</span>
          <span v-if="currentRole !== 'buy' && onlyDealOrders" class="seller-filter-chip">仅看已成交</span>
          <span v-if="currentRole !== 'buy' && activeCategoryName" class="seller-filter-chip">{{ activeCategoryName }}</span>
          <button v-if="hasDirectFilters || orderSearch || (currentRole !== 'buy' && statusFilter)" type="button" class="seller-filter-clear" @click="clearSellerOrderFilters">清除筛选</button>
          <span v-if="sellerTabPending" class="seller-order-total is-switching" role="status">正在切换…</span>
          <span v-else class="seller-order-total">{{ orderPagination.total }} 笔订单</span>
        </template>
      </SellerPageToolbar>

      <SellerOrderTable class="seller-order-ledger" :class="{ 'is-filter-pending': sellerTabPending }" :aria-busy="sellerTabPending || loading" :inert="sellerTabPending ? '' : null" caption="卖家订单管理列表" :columns="sellerOrderColumns" :rows="orders" :loading="loading" :row-key="getOrderKey" :expanded-row-key="deliverFormOrderId || ''">
        <template #cell-order="{ row: order }">
          <router-link :to="getOrderDetailTarget(order)" class="seller-order-id" @click="handleOrderCardClick"><strong>{{ getOrderKey(order) }}</strong><small>{{ formatDate(order.createdAt) }}</small></router-link>
        </template>
        <template #cell-subject="{ row: order }">
          <div class="seller-order-subject">
            <router-link
              v-if="getOrderSubjectTarget(order)"
              :to="getOrderSubjectTarget(order)"
              class="seller-order-subject-link"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="`在新标签页打开${currentRole === 'buy' ? '求购' : '物品'}详情：${getOrderDisplayName(order)}`"
              :title="getOrderDisplayName(order)"
            >
              <strong>{{ getOrderDisplayName(order) }}</strong><ArrowUpRight :size="13" aria-hidden="true" />
            </router-link>
            <strong v-else :title="getOrderDisplayName(order)">{{ getOrderDisplayName(order) }}</strong>
            <small>{{ currentRole === 'buy' ? '求购服务' : `${getSellerOrderTypeText(order.productType || order.product?.productType)}${isPlatformOrder(order) ? ` · ×${getOrderQuantity(order)}` : ''}` }}</small>
          </div>
        </template>
        <template #cell-buyer="{ row: order }">
          <SellerOrderPartyIdentity :order="order" :role="isBuyRequestOrder(order) ? 'counterparty' : 'buyer'" />
        </template>
        <template #cell-amount="{ row: order }"><strong class="seller-order-amount">{{ order.totalPrice || order.amount || 0 }}</strong><small class="seller-order-unit">LDC</small></template>
        <template #cell-status="{ row: order }"><FulfillmentDeadline v-if="['paid','refund_pending'].includes(order.status)" :order="order" compact /><div class="seller-order-status"><SellerStatusBadge :tone="resolveSellerStatusTone(displayOrderStatus(order))" :label="getStatusText(displayOrderStatus(order), order)" /><small v-if="displayOrderStatus(order) !== order.status || refundStageText(order)" class="seller-order-progress">履约：{{ orderFulfillmentLabel(order) }}<span v-if="refundStageText(order)"> · {{ refundStageText(order) }}</span></small></div><small v-if="order.status === 'pending'" class="seller-order-expiry">{{ getExpireCountdownText(order) }}</small></template>
        <template #cell-actions="{ row: order }">
          <div class="seller-order-actions">
            <button v-if="showManualDeliver(order)" type="button" class="seller-row-primary" :aria-expanded="isDeliverFormVisible(order)" @click="openDeliverForm(order)"><PackageCheck :size="15" aria-hidden="true" />立即发货</button>
            <button v-if="isBuyRequestOrder(order) && (order.status === 'pending' || order.status === 'paid') && !isPaymentMaintenanceBlocked" type="button" class="seller-row-secondary" :disabled="refreshingBuyOrderId === getOrderKey(order)" @click="handleRefreshBuyOrder(order)"><RefreshCw :size="15" aria-hidden="true" />{{ refreshingBuyOrderId === getOrderKey(order) ? '刷新中' : '刷新' }}</button>
            <button v-if="currentRole === 'seller' && order.status === 'pending'" type="button" class="seller-row-danger" :disabled="cancellingOrderId === getOrderKey(order)" @click="handleCancelOrder(order)">{{ cancellingOrderId === getOrderKey(order) ? '取消中' : '取消' }}</button>
            <router-link :to="getOrderDetailTarget(order)" class="seller-row-detail" @click="handleOrderCardClick">详情<ArrowUpRight :size="14" aria-hidden="true" /></router-link>
          </div>
        </template>
        <template #mobile-row="{ row: order }">
          <div class="seller-order-mobile-head">
            <div>
              <router-link
                v-if="getOrderSubjectTarget(order)"
                :to="getOrderSubjectTarget(order)"
                class="seller-order-subject-link"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="`在新标签页打开${currentRole === 'buy' ? '求购' : '物品'}详情：${getOrderDisplayName(order)}`"
              ><strong>{{ getOrderDisplayName(order) }}</strong><ArrowUpRight :size="13" aria-hidden="true" /></router-link>
              <strong v-else>{{ getOrderDisplayName(order) }}</strong>
              <small>{{ getOrderKey(order) }}</small>
            </div>
            <div class="seller-order-status"><SellerStatusBadge :tone="resolveSellerStatusTone(displayOrderStatus(order))" :label="getStatusText(displayOrderStatus(order), order)" /><small v-if="displayOrderStatus(order) !== order.status || refundStageText(order)" class="seller-order-progress">履约：{{ orderFulfillmentLabel(order) }}<span v-if="refundStageText(order)"> · {{ refundStageText(order) }}</span></small></div>
          </div>
          <dl class="seller-order-mobile-grid"><div><dt>{{ isBuyRequestOrder(order) ? '求购方' : '买家' }}</dt><dd class="seller-order-mobile-party"><SellerOrderPartyIdentity :order="order" :role="isBuyRequestOrder(order) ? 'counterparty' : 'buyer'" /></dd></div><div><dt>金额</dt><dd>{{ order.totalPrice || order.amount || 0 }} LDC</dd></div><div><dt>时间</dt><dd>{{ formatDate(order.createdAt) }}</dd></div><div><dt>来源</dt><dd>{{ currentRole === 'buy' ? '求购服务' : '商品订单' }}</dd></div></dl>
          <p v-if="order.status === 'pending'" class="seller-order-mobile-expiry">{{ getExpireCountdownText(order) }}</p>
          <FulfillmentDeadline v-if="['paid','refund_pending'].includes(order.status)" :order="order" compact /><div class="seller-order-mobile-actions"><button v-if="showManualDeliver(order)" type="button" class="seller-row-primary" :aria-expanded="isDeliverFormVisible(order)" @click="openDeliverForm(order)"><PackageCheck :size="15" aria-hidden="true" />立即发货</button><button v-if="isBuyRequestOrder(order) && (order.status === 'pending' || order.status === 'paid') && !isPaymentMaintenanceBlocked" type="button" class="seller-row-secondary" :disabled="refreshingBuyOrderId === getOrderKey(order)" @click="handleRefreshBuyOrder(order)"><RefreshCw :size="15" aria-hidden="true" />刷新</button><button v-if="currentRole === 'seller' && order.status === 'pending'" type="button" class="seller-row-danger" :disabled="cancellingOrderId === getOrderKey(order)" @click="handleCancelOrder(order)">取消订单</button><router-link :to="getOrderDetailTarget(order)" class="seller-row-detail" @click="handleOrderCardClick">订单详情<ArrowUpRight :size="14" aria-hidden="true" /></router-link></div>
        </template>
        <template #expanded="{ row: order }">
          <ManualDeliveryEditor v-model="deliverContent" variant="seller" :input-id="`delivery-${getOrderKey(order)}`" :placeholder="getDeliverPlaceholder(order)" :hint="getDeliverHint(order)" :submitting="deliveringOrderId === getOrderKey(order)" @cancel="closeDeliverForm" @submit="submitManualDeliver(order)" />
        </template>
        <template #empty><div class="seller-orders-empty"><ShoppingBag :size="32" aria-hidden="true" /><strong>{{ currentRole === 'buy' ? '还没有求购服务订单' : '还没有商品订单' }}</strong><p>新订单出现后会在这里进入经营台账。</p></div></template>
        <template #footer><SellerPagination :page="orderPagination.page" :total-pages="orderPagination.totalPages" :total="orderPagination.total" @change="changeSellerOrderPage" /></template>
      </SellerOrderTable>
    </template>

    <div v-else class="page-container">
      <div class="page-header">
        <h1 class="page-title">{{ sellerMode ? '订单管理' : '我的订单' }}</h1>
      </div>
      
      <!-- 角色切换 -->
      <LiquidTabs
        :modelValue="currentRole"
        :tabs="roleTabs"
        class="role-tabs"
        layout="equal"
        aria-label="订单来源"
        @update:modelValue="switchRole"
      />

      <!-- 状态筛选（求购订单状态体系不同，不显示） -->
      <OrderStatusFilter
        v-if="currentRole !== 'buy'"
        :modelValue="statusFilter"
        class="status-tabs"
        layout="equal"
        size="sm"
        aria-label="订单状态"
        @update:modelValue="selectStatus"
      />

      <OrderFilterBar>
        <AppSelect
          v-model="timeRange"
          class="filter-select-wrap"
          :options="timeRangeOptions"
          placeholder="选择时间范围"
          @change="applyFilters"
        />
        <div class="filter-search">
          <input
            v-model.trim="orderSearch"
            class="filter-input"
            type="text"
            placeholder="搜索订单号、商品名"
            @keyup.enter="applyFilters"
          />
          <button class="filter-search-btn" :disabled="loading || loadingMore" @click="applyFilters">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <button v-if="orderSearch" class="filter-search-clear" :disabled="loading || loadingMore" @click="clearSearch">×</button>
        </div>
      </OrderFilterBar>
      
      <!-- 加载中 -->
      <div v-if="hasDirectFilters" class="direct-filter-bar">
        <span class="direct-filter-chip strong">{{ currentRole === 'seller' ? '商品订单' : (sellerMode ? '求购服务' : '我买的') }}</span>
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
        :icon-component="ClipboardList"
        :text="currentRole === 'buy' ? '暂无求购订单' : '暂无订单'"
        :hint="currentRole === 'buyer' ? '您还没有购买任何物品' : (currentRole === 'seller' ? '您还没有收到任何商品订单' : (sellerMode ? '您还没有作为服务方完成求购交易' : '您还没有求购订单'))"
      >
        <template #action>
          <router-link to="/" class="browse-btn">
            浏览物品
          </router-link>
        </template>
      </EmptyState>
      
      <!-- 订单列表 -->
      <BuyerOrderList v-else :orders="orders" :busy="loadingMore" v-slot="{ order }">
        <div
          class="order-card"
        >
          <router-link :to="getOrderDetailTarget(order)" class="order-header" @click="handleOrderCardClick">
            <div class="order-header-main">
              <span class="order-date">{{ formatDate(order.createdAt) }}</span>
              <span v-if="order.status === 'pending' && (isPlatformOrder(order) || isBuyRequestOrder(order))" class="order-expire-chip">
                {{ getExpireCountdownText(order) }}
              </span>
            </div>
            <span :class="['order-status', getStatusClass(displayOrderStatus(order))]">
              {{ getStatusText(displayOrderStatus(order), order) }}<small v-if="refundStageText(order)"> · {{ refundStageText(order) }}</small>
            </span>
          </router-link>

          <router-link :to="getOrderDetailTarget(order)" class="order-content" @click="handleOrderCardClick">
            <div class="product-name-row">
              <div class="product-name">{{ getOrderDisplayName(order) }}</div>
              <span v-if="isPlatformOrder(order)" class="order-quantity-badge">x{{ getOrderQuantity(order) }}</span>
            </div>
            <div class="order-info">
              <!-- <span class="order-type">{{ getOrderTypeText(order.productType || order.product?.productType) }}</span> -->
              <span class="order-seller" v-if="isBuyRequestOrder(order)">
                {{ order.myRole === 'requester' ? '服务方' : '求购方' }}: {{ order.counterpartyUsername || '未知' }}
              </span>
              <span class="order-seller" v-else-if="currentRole === 'buyer'">
                卖家: {{ order.sellerUsername || order.seller?.username || '未知' }}
              </span>
              <span class="order-seller" v-else>
                买家: {{ order.buyerUsername || order.buyer?.username || '未知' }}
              </span>
            </div>
            <div v-if="requiresBuyerContactOrder(order)" class="order-manual-hint">
              {{ currentRole === 'buyer' ? '支付后请主动联系卖家获取服务' : '该订单需手动履约，请及时处理' }}
            </div>
            <div v-if="hasOrderCoupon(order)" class="order-coupon-summary">
              <span>{{ getOrderCouponSnapshot(order).name || '优惠券' }}</span>
              <strong>{{ getOrderCouponRule(order) }} · 省 {{ getOrderCouponDiscount(order).toFixed(2) }} LDC</strong>
            </div>
          </router-link>
          
          <!-- 发货内容仅在订单详情页展示，列表卡片不直接暴露 CDK/发货内容。 -->
          <p v-if="displayOrderStatus(order) !== order.status" class="order-fulfillment-progress">履约：{{ orderFulfillmentLabel(order) }}</p>
          <FulfillmentDeadline v-if="isPlatformOrder(order) && ['paid', 'refund_pending'].includes(order.status)" :order="order" compact />

          <div class="order-footer">
            <div class="order-amount-wrap compact">
              <span class="order-amount">{{ order.totalPrice || order.amount }} LDC</span>
              <span v-if="isPlatformOrder(order)" class="order-count">· 共 {{ getOrderQuantity(order) }} 个</span>
            </div>
            <div class="order-actions">
              <!-- 图床订单 -->
              <template v-if="order.orderType === 'image'">
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
          
          <ManualDeliveryEditor v-if="isDeliverFormVisible(order)" v-model="deliverContent" :input-id="`delivery-${getOrderKey(order)}`" :placeholder="getDeliverPlaceholder(order)" :hint="getDeliverHint(order)" :submitting="deliveringOrderId === getOrderKey(order)" @cancel="closeDeliverForm" @submit="submitManualDeliver(order)" />
        </div>
      </BuyerOrderList>
      
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
import FulfillmentDeadline from '@/components/order/FulfillmentDeadline.vue'
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  ArrowUpRight,
  ClipboardList,
  ClipboardPenLine,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBag,
  ShoppingCart,
} from '@lucide/vue'
import { useRouter, useRoute } from 'vue-router'
import { useOrderStore } from '@/stores/order'
import { isMaintenanceFeatureEnabled, isRestrictedMaintenanceMode } from '@/config/maintenance'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { useOrderActions } from '@/composables/orders/useOrderActions'
import { useOrderListController } from '@/composables/orders/useOrderListController'
import AppSelect from '@/components/common/AppSelect.vue'
import OrderStatusFilter from '@/components/orders/OrderStatusFilter.vue'
import { orderStatusLabel, displayOrderStatus, refundStageText, orderFulfillmentLabel } from '@/utils/orderPresentation'
import LiquidTabs from '@/components/common/LiquidTabs.vue'
import SellerTabs from '@/components/seller/SellerTabs.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import SellerOrderPartyIdentity from '@/components/seller/SellerOrderPartyIdentity.vue'
import SellerPageToolbar from '@/components/seller/SellerPageToolbar.vue'
import SellerPagination from '@/components/seller/SellerPagination.vue'
import SellerStatusBadge from '@/components/seller/SellerStatusBadge.vue'
import BuyerOrderList from '@/components/orders/BuyerOrderList.vue'
import ManualDeliveryEditor from '@/components/orders/ManualDeliveryEditor.vue'
import OrderFilterBar from '@/components/orders/OrderFilterBar.vue'
import SellerOrderTable from '@/components/orders/SellerOrderTable.vue'
import { isValidLdcPaymentUrl } from '@/utils/security'
import { preparePaymentPopup, openPaymentPopup, watchPaymentPopup, cleanupPreparedTab } from '@/utils/newTab'
import {
  isCdkProduct,
  isNormalProduct,
  isPlatformOrderProduct,
  requiresBuyerContact
} from '@/utils/shopProduct'
import {
  ORDER_LIST_SCROLL_KEY,
  ORDER_LIST_SCROLL_SOURCE,
  readOrderScrollSnapshot,
  clearOrderScrollState
} from '@/utils/orderListScroll'
import { resolveOrderArea } from '@/utils/sellerNavigation'
import { normalizeOrderStatusFilter, toOrderApiStatusFilter } from '@/utils/orderFilters'
import { resolveOrderSubjectTarget } from '@/utils/orderNavigation'
import {
  buildSellerOrderQuery,
  buildSellerOrderTabQuery,
  isSellerOrderTabQueryMatch,
  normalizeSellerPage,
  resolveSellerStatusTone
} from '@/utils/sellerTables'
import { normalizeTimestampMs } from '@/utils/format'

const router = useRouter()
const route = useRoute()
const orderStore = useOrderStore()
const toast = useToast()
const dialog = useDialog()

const props = defineProps({
  sellerMode: {
    type: Boolean,
    default: false
  }
})
const sellerMode = computed(() => props.sellerMode)

const pageSize = 20
const currentRole = ref(props.sellerMode ? 'seller' : 'buyer')
const sellerOrderColumns = computed(() => [
  { key: 'order', label: '订单 / 时间', width: '19%' },
  { key: 'subject', label: '商品 / 服务', width: '23%' },
  { key: 'buyer', label: currentRole.value === 'buy' ? '求购方' : '买家', width: '16%' },
  { key: 'amount', label: '金额', width: '10%' },
  { key: 'status', label: '状态', width: '14%' },
  { key: 'actions', label: '操作', width: '18%', align: 'right' }
])
const roleTabs = computed(() => props.sellerMode
  ? [
      { value: 'seller', label: '商品订单' },
      { value: 'buy', label: '求购服务' }
    ]
  : [
      { value: 'buyer', label: '我买的', iconComponent: ShoppingCart },
      { value: 'buy', label: '求购订单', iconComponent: ClipboardPenLine }
    ])
const orderSearch = ref('')
const timeRange = ref('1m')
const statusFilter = ref('')
const sellerTabPending = ref(false)
const activeCategoryId = ref(0)
const activeCategoryName = ref('')
const onlyDealOrders = ref(false)
const timeRangeOptions = [
  { value: '1m', label: '最近1个月' },
  { value: '6m', label: '最近半年' },
  { value: '1y', label: '最近一年' }
]
const deliverFormOrderId = ref(null)
const deliverContent = ref('')
const nowTs = ref(Date.now())
let countdownTimer = null
let restoredScrollKey = ''
let sellerTabDebounceTimer = null
let sellerTabIntentId = 0
let pendingSellerTabIntent = null
const SELLER_TAB_DEBOUNCE_MS = 140
const isPaymentMaintenanceBlocked = computed(() =>
  isRestrictedMaintenanceMode() && !isMaintenanceFeatureEnabled('orderPayment')
)
const orderActions = useOrderActions()
const {
  cancellingOrderId,
  deliveringOrderId,
  payingOrderId,
  refreshingOrderId,
  refreshingBuyOrderId
} = orderActions
const orderListController = useOrderListController({
  pageSize,
  buildQuery: (currentPage, signal) => ({
    ...buildOrderQueryOptions(),
    page: currentPage,
    pageSize,
    signal
  }),
  fetchPage: (queryOptions) => {
    if (currentRole.value === 'buy') return orderStore.fetchBuyRequestOrders(queryOptions)
    if (currentRole.value === 'buyer') return orderStore.fetchBuyerOrders(queryOptions)
    return orderStore.fetchSellerOrders(queryOptions)
  },
  onError: () => toast.error('加载订单失败')
})
const {
  loading,
  loadingMore,
  orders,
  page,
  hasMore,
  pagination: orderPagination
} = orderListController

const hasDirectFilters = computed(() =>
  currentRole.value !== 'buy' && (activeCategoryId.value > 0 || onlyDealOrders.value)
)

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
}

function parseRouteBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

function syncRouteState() {
  currentRole.value = resolveOrderArea(route.query, props.sellerMode)
  activeCategoryId.value = currentRole.value === 'buy' ? 0 : parsePositiveInt(route.query.categoryId)
  activeCategoryName.value = activeCategoryId.value > 0
    ? String(route.query.categoryName || `分类 #${activeCategoryId.value}`).trim()
    : ''
  onlyDealOrders.value = currentRole.value === 'buy' ? false : parseRouteBoolean(route.query.dealOnly)
  statusFilter.value = currentRole.value === 'buy' ? '' : normalizeOrderStatusFilter(route.query.status)
  timeRange.value = ['1m', '6m', '1y'].includes(String(route.query.timeRange || '').trim())
    ? String(route.query.timeRange).trim()
    : '1m'
  orderSearch.value = String(route.query.search || '').trim()
  page.value = props.sellerMode ? normalizeSellerPage(route.query.page) : page.value
}

function getSellerOrderTypeText(type) {
  return String(type || '').toLowerCase() === 'cdk' ? '自动发卡' : '普通物品'
}

function getOrderScrollSnapshot() {
  return {
    tab: currentRole.value,
    categoryId: activeCategoryId.value,
    categoryName: activeCategoryName.value,
    dealOnly: onlyDealOrders.value ? '1' : '',
    search: orderSearch.value.trim(),
    timeRange: timeRange.value,
    status: statusFilter.value,
    page: page.value,
    scrollY: window.scrollY || 0,
    ts: Date.now(),
    source: ''
  }
}

function getOrderScrollKey(snapshot = getOrderScrollSnapshot()) {
  return [
    snapshot.tab,
    snapshot.categoryId || 0,
    snapshot.categoryName || '',
    snapshot.dealOnly || '',
    snapshot.search || '',
    snapshot.timeRange || '',
    snapshot.status || ''
  ].join('|')
}

function saveScrollState(source = '') {
  try {
    sessionStorage.setItem(ORDER_LIST_SCROLL_KEY, JSON.stringify({
      ...getOrderScrollSnapshot(),
      source
    }))
  } catch {
    // ignore sessionStorage errors
  }
}

async function restoreScrollState() {
  try {
    const snapshot = readOrderScrollSnapshot()
    if (!snapshot) return
    if (snapshot?.source !== ORDER_LIST_SCROLL_SOURCE) return
    const snapshotKey = getOrderScrollKey(snapshot)
    const currentKey = getOrderScrollKey()
    if (snapshotKey !== currentKey || restoredScrollKey === snapshotKey) return
    restoredScrollKey = snapshotKey
    clearOrderScrollState()

    // 恢复滚动深度：顺序拉取到快照所在页（订单中途被取消/退款时 hasMore 提前为 false，自然截断）
    const targetPage = Math.max(1, Number(snapshot.page) || 1)
    while (page.value < targetPage && hasMore.value) {
      page.value++
      await loadOrders(true)
    }

    await nextTick()
    window.scrollTo(0, Number(snapshot.scrollY) || 0)
  } catch {
    // ignore sessionStorage errors
  }
}

function settleSellerTabIntent(intent) {
  if (!intent || pendingSellerTabIntent?.id !== intent.id) return
  if (sellerTabDebounceTimer) {
    window.clearTimeout(sellerTabDebounceTimer)
    sellerTabDebounceTimer = null
  }
  pendingSellerTabIntent = null
  sellerTabPending.value = false
}

function isCurrentSellerTabIntent(intent) {
  if (sellerTabPending.value && pendingSellerTabIntent) {
    return pendingSellerTabIntent.source === intent.source
      && pendingSellerTabIntent.status === intent.status
  }
  return isSellerOrderTabQueryMatch(route.query, intent)
}

function getActiveSellerTabIntent() {
  const source = currentRole.value === 'buy' ? 'service' : 'product'
  return { source, status: source === 'service' ? '' : statusFilter.value }
}

function cancelPendingSellerTabNavigation() {
  if (pendingSellerTabIntent) settleSellerTabIntent(pendingSellerTabIntent)
}

function scheduleSellerTabNavigation({ source, status = '' }) {
  const intent = {
    id: ++sellerTabIntentId,
    source: source === 'service' ? 'service' : 'product',
    status: source === 'service' ? '' : status
  }
  pendingSellerTabIntent = intent
  sellerTabPending.value = true
  if (sellerTabDebounceTimer) window.clearTimeout(sellerTabDebounceTimer)
  sellerTabDebounceTimer = window.setTimeout(() => {
    sellerTabDebounceTimer = null
    void commitSellerTabNavigation(intent)
  }, SELLER_TAB_DEBOUNCE_MS)
}

async function commitSellerTabNavigation(intent) {
  if (pendingSellerTabIntent?.id !== intent.id) return
  const nextQuery = buildSellerOrderTabQuery(route.query, intent)
  if (sameQuery(route.query, nextQuery)) {
    settleSellerTabIntent(intent)
    return
  }

  try {
    await router.replace({ query: nextQuery })
  } catch {
    // 路由异常时恢复 URL 对应状态，避免选中项停留在未生效的意图上。
  }

  if (pendingSellerTabIntent?.id !== intent.id) return
  if (isSellerOrderTabQueryMatch(route.query, intent)) {
    settleSellerTabIntent(intent)
    return
  }
  settleSellerTabIntent(intent)
  syncRouteState()
}

// 切换角色
function switchRole(role) {
  if (props.sellerMode) {
    const normalizedRole = role === 'buy' ? 'buy' : 'seller'
    const intent = {
      source: normalizedRole === 'buy' ? 'service' : 'product',
      status: normalizedRole === 'buy' ? '' : statusFilter.value
    }
    if (normalizedRole === currentRole.value && isCurrentSellerTabIntent(intent)) return

    currentRole.value = normalizedRole
    page.value = 1
    closeDeliverForm()
    scheduleSellerTabNavigation(intent)
    return
  }

  const nextQuery = { ...route.query }
  if (role === currentRole.value) return
  nextQuery.tab = role
  delete nextQuery.source
  if (role === 'buy') {
    delete nextQuery.categoryId
    delete nextQuery.categoryName
    delete nextQuery.dealOnly
    delete nextQuery.status
  }
  delete nextQuery.page
  router.replace({ query: nextQuery }).catch(() => {})
}

// 选择状态筛选（写入 URL，由 watcher 统一重载）
function selectStatus(status) {
  const normalizedStatus = normalizeOrderStatusFilter(status)
  if (props.sellerMode) {
    if (currentRole.value === 'buy') return
    const intent = { source: 'product', status: normalizedStatus }
    if (normalizedStatus === statusFilter.value && isCurrentSellerTabIntent(intent)) return

    statusFilter.value = normalizedStatus
    page.value = 1
    closeDeliverForm()
    scheduleSellerTabNavigation(intent)
    return
  }

  if (statusFilter.value === normalizedStatus && String(route.query.status || '') === normalizedStatus) return
  const nextQuery = { ...route.query }
  if (normalizedStatus) nextQuery.status = normalizedStatus
  else delete nextQuery.status
  delete nextQuery.page
  router.replace({ query: nextQuery }).catch(() => {})
}

function buildOrderQueryOptions() {
  if (props.sellerMode) {
    return buildSellerOrderQuery({
      page: page.value,
      pageSize,
      source: currentRole.value === 'buy' ? 'service' : 'product',
      search: orderSearch.value,
      timeRange: timeRange.value,
      displayStatus: toOrderApiStatusFilter(statusFilter.value),
      categoryId: activeCategoryId.value,
      dealOnly: onlyDealOrders.value
    })
  }
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
  if (currentRole.value !== 'buy' && statusFilter.value) {
    options.displayStatus = toOrderApiStatusFilter(statusFilter.value)
  }
  if (currentRole.value === 'buy') {
    options.role = props.sellerMode ? 'provider' : 'requester'
  }
  return options
}

// 加载订单
async function loadOrders(append = false) {
  return orderListController.load(append)
}

// 加载更多
function loadMore() {
  void orderListController.loadMore()
}

function sameQuery(a, b) {
  const ka = Object.keys(a).sort()
  const kb = Object.keys(b).sort()
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k])
}

async function applyFilters() {
  let nextQuery = { ...route.query }
  const search = orderSearch.value.trim()
  if (search) nextQuery.search = search
  else delete nextQuery.search
  if (timeRange.value && timeRange.value !== '1m') nextQuery.timeRange = timeRange.value
  else delete nextQuery.timeRange
  if (props.sellerMode) {
    nextQuery = buildSellerOrderTabQuery(nextQuery, getActiveSellerTabIntent())
    cancelPendingSellerTabNavigation()
  }
  if (sameQuery(route.query, nextQuery)) {
    // URL 无变化（如默认值下再点一次搜索），直接手动重载，避免 replace 无导航
    page.value = 1
    await loadOrders()
    return
  }
  // 由 route watcher 统一重载（过滤条件已随 query 进入 URL，返回/刷新均可保留）
  await router.replace({ query: nextQuery }).catch(() => {})
}

async function clearSearch() {
  if (!orderSearch.value) return
  orderSearch.value = ''
  await applyFilters()
}

async function clearDirectFilters() {
  let nextQuery = { ...route.query }
  if (props.sellerMode) nextQuery.source = currentRole.value === 'buy' ? 'service' : 'product'
  else nextQuery.tab = currentRole.value
  delete nextQuery.categoryId
  delete nextQuery.categoryName
  delete nextQuery.dealOnly
  if (props.sellerMode) {
    nextQuery = buildSellerOrderTabQuery(nextQuery, getActiveSellerTabIntent())
    cancelPendingSellerTabNavigation()
  }
  await router.replace({ query: nextQuery }).catch(() => {})
}

async function clearSellerOrderFilters() {
  orderSearch.value = ''
  statusFilter.value = ''
  timeRange.value = '1m'
  const nextQuery = { source: currentRole.value === 'buy' ? 'service' : 'product' }
  cancelPendingSellerTabNavigation()
  await router.replace({ query: nextQuery }).catch(() => {})
}

async function changeSellerOrderPage(nextPage) {
  const nextQuery = { ...route.query }
  if (nextPage > 1) nextQuery.page = String(nextPage)
  else delete nextQuery.page
  await router.replace({ query: nextQuery }).catch(() => {})
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function getOrderKey(order) {
  return order.orderNo || order.id
}

function getOrderCouponSnapshot(order) {
  const value = order?.couponSnapshot
  if (!value) return {}
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return {} }
}

function hasOrderCoupon(order) {
  return !!(order?.couponClaimId ?? getOrderCouponSnapshot(order).campaignId)
}

function getOrderCouponDiscount(order) {
  return Number(order?.couponDiscountAmount ?? getOrderCouponSnapshot(order).couponDiscountAmount ?? 0)
}

function getOrderCouponRule(order) {
  const snapshot = getOrderCouponSnapshot(order)
  if (snapshot.discountType === 'fixed_amount') return `减 ${Number(snapshot.fixedAmount || 0).toFixed(2)}`
  if (snapshot.discountType === 'percentage') {
    const bps = Number(snapshot.percentageBps || 0)
    return `${(bps / 1000).toFixed(bps % 1000 === 0 ? 0 : 1)} 折 · 优惠 ${snapshot.discountedQuantity || 1} 件`
  }
  return '优惠券'
}

function parseDateTimeToTimestamp(value) {
  return normalizeTimestampMs(value)
}

function getOrderExpireTimestamp(order) {
  const directExpire = order.payExpiredAt || order.expireAt
  const directTs = parseDateTimeToTimestamp(directExpire)
  if (!Number.isNaN(directTs) && directTs > 0) return directTs

  const createdTs = parseDateTimeToTimestamp(order.createdAt)
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
  return order.paidAt || order.paidTime
}

function isPaidOvertime(order) {
  if (order.status !== 'paid') return false
  const paidAt = getOrderPaidAt(order)
  const paidTs = parseDateTimeToTimestamp(paidAt)
  if (!paidTs || Number.isNaN(paidTs)) return false
  return Date.now() - paidTs >= 30 * 60 * 1000
}

function showManualDeliver(order) {
  if (order.orderActions?.canDeliver === false) return false
  if (currentRole.value !== 'seller') return false
  if (isNormalOrder(order)) return order.status === 'paid' && order.fulfillment?.canDeliver !== false && (!order.fulfillment?.deadlineAt || Date.parse(order.fulfillment.deadlineAt) > nowTs.value)
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

// 订单卡片路由目标（供 <router-link> 使用：Ctrl/⌘/中键点击时浏览器原生新标签页打开）
function getOrderDetailTarget(order) {
  // 图床订单跳转到图床页面
  if (order.orderType === 'image') {
    return '/ld-image'
  }

  if (isBuyRequestOrder(order)) {
    const orderNo = getOrderKey(order)
    if (!orderNo) return props.sellerMode ? '/seller/orders?source=service' : '/user/orders?tab=buy'
    if (props.sellerMode) return `/seller/orders/${encodeURIComponent(orderNo)}?source=service`
    return `/user/buy-orders/${encodeURIComponent(orderNo)}`
  }

  const orderNo = getOrderKey(order)
  if (!orderNo) return props.sellerMode ? '/seller/orders' : '/user/orders'
  if (props.sellerMode) return { path: `/seller/orders/${orderNo}`, query: { source: 'product' } }
  return { path: `/order/${orderNo}`, query: { role: currentRole.value } }
}

// 卡片点击：仅保存滚动快照，不 preventDefault（router-link 自行处理站内跳转 / 新标签）
function handleOrderCardClick() {
  saveScrollState(ORDER_LIST_SCROLL_SOURCE)
}

// 查看订单详情（底部按钮走站内跳转）
function viewOrderDetail(order) {
  saveScrollState(ORDER_LIST_SCROLL_SOURCE)

  // 图床订单跳转到图床页面
  if (order.orderType === 'image') {
    router.push('/ld-image')
    return
  }

  if (isBuyRequestOrder(order)) {
    const orderNo = getOrderKey(order)
    if (!orderNo) {
      router.push(props.sellerMode ? '/seller/orders?source=service' : '/user/orders?tab=buy')
      return
    }
    router.push(props.sellerMode
      ? `/seller/orders/${encodeURIComponent(orderNo)}?source=service`
      : `/user/buy-orders/${encodeURIComponent(orderNo)}`)
    return
  }

  const orderNo = getOrderKey(order)
  router.push(props.sellerMode
    ? `/seller/orders/${orderNo}?source=product`
    : `/order/${orderNo}?role=${currentRole.value}`)
}

// 状态文字（求购订单状态体系不同，paid 语义为「已支付」；商城/图床订单 paid 即「待发货」）
function getStatusText(status, orderData) {
  if (orderData && isBuyRequestOrder(orderData)) {
    const buyMap = {
      pending: '待支付',
      paid: '已支付',
      completed: '已完成',
      cancelled: '已取消',
      expired: '已过期'
    }
    return buyMap[status] || status || '未知'
  }
  const paymentState = orderData?.payment_init_status || orderData?.paymentInitStatus
  if (status === 'pending' && ['pending', 'creating', 'unknown'].includes(paymentState)) return paymentState === 'unknown' ? '支付确认中' : '正在创建'
  return orderStatusLabel(status)
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
    refund_pending: 'status-refund-pending',
    refund_failed: 'status-refund-failed',
    external_dispute: 'status-external-dispute',
    delivered: 'status-delivered',
    expired: 'status-expired',
    uploaded: 'status-completed',
    failed: 'status-cancelled'
  }
  return map[status] || ''
}

// 订单类型
function getOrderDisplayName(order) {
  if (isBuyRequestOrder(order)) {
    return order.requestTitle || order.product?.name || '求购订单'
  }
  return order.product?.name || order.productName
}

// 格式化日期
function formatDate(date) {
  const ms = normalizeTimestampMs(date)
  if (!Number.isFinite(ms)) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(ms))
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
  const type = order.orderType
  return type === 'buy_request'
}

function getOrderQuantity(order) {
  const quantity = Number(order?.quantity ?? order?.productQuantity ?? 1)
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1
}

function getOrderProductId(order) {
  const value = Number(order?.productId ?? order?.product?.id ?? 0)
  return Number.isInteger(value) && value > 0 ? value : 0
}

function getOrderSubjectTarget(order) {
  return resolveOrderSubjectTarget(order)
}

function canReviewOrder(order) {
  if (currentRole.value !== 'buyer') return false
  if (!isCdkOrder(order)) return false
  if (order?.status !== 'delivered') return false
  if (order?.commentEnabled === false) return false
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
  if (!orderNo || orderActions.isBusy('payment', orderNo)) return

  const loadingId = toast.loading('正在获取支付链接...')
  const preparedWindow = preparePaymentPopup()

  try {
    const result = await orderActions.run('payment', orderNo, () => isBuyRequestOrder(order)
      ? orderStore.getBuyOrderPaymentUrl(orderNo)
      : orderStore.getPaymentUrl(orderNo))
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
      const refOrder = order
      watchPaymentPopup(popup, () => {
        if (isBuyRequestOrder(refOrder)) {
          handleRefreshBuyOrder(refOrder)
        } else {
          handleRefreshOrder(refOrder)
        }
        toast.info('支付窗口已关闭，已自动检查订单状态')
      })
    }
    toast.update(loadingId, { type: 'success', message: '支付窗口已打开' })
  } catch (error) {
    cleanupPreparedTab(preparedWindow)
    toast.update(loadingId, { type: 'error', message: error?.message || '获取支付链接失败' })
  }
}

async function handleRefreshOrder(order) {
  if (isPaymentMaintenanceBlocked.value) {
    toast.warning('因 LinuxDo Credit 积分服务维护中，当前暂不支持支付或补查')
    return
  }

  const orderNo = getOrderKey(order)
  if (!orderNo || orderActions.isBusy('refresh', orderNo)) return

  try {
    const result = await orderActions.run('refresh', orderNo, () => orderStore.refreshOrderStatus(orderNo))
    if (!result) return
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
  }
}

async function handleRefreshBuyOrder(order) {
  if (isPaymentMaintenanceBlocked.value) {
    toast.warning('因 LinuxDo Credit 积分服务维护中，当前暂不支持支付或补查')
    return
  }

  const orderNo = getOrderKey(order)
  if (!orderNo || orderActions.isBusy('buyRefresh', orderNo)) return

  try {
    const result = await orderActions.run('buyRefresh', orderNo, () => orderStore.refreshBuyOrderStatus(orderNo))
    if (!result) return
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
  }
}

// 取消订单

async function handleCancelOrder(order) {
  const productName = order.product?.name || order.productName || '该物品'
  const confirmed = await dialog.confirm(`确定要取消订单「${productName}」吗？`, {
    title: '取消订单',
    confirmText: '确定取消',
    cancelText: '再想想'
  })

  if (!confirmed) return

  const orderNo = getOrderKey(order)
  if (!orderNo || orderActions.isBusy('cancel', orderNo)) return

  const loadingId = toast.loading('正在取消订单...')

  try {
    const result = await orderActions.run('cancel', orderNo, () => orderStore.cancelOrder(orderNo))
    if (!result) return
    if (!result.success) throw new Error(result.error || '取消失败')
    toast.update(loadingId, { type: 'success', message: '订单已取消' })
    // 刷新订单列表
    await loadOrders()
  } catch (error) {
    toast.update(loadingId, { type: 'error', message: error.message || '取消失败' })
  }
}

// 手动发货
async function submitManualDeliver(order) {
  const orderNo = getOrderKey(order)
  if (!orderNo || orderActions.isBusy('deliver', orderNo)) return
  const content = deliverContent.value.trim()
  if (!content) {
    toast.warning('请输入发货内容')
    return
  }
  
  const loadingId = toast.loading('正在发货...')
  
  try {
    const result = await orderActions.run('deliver', orderNo, () => orderStore.deliverOrder(orderNo, content))
    if (!result) return
    if (result?.success === false) {
      toast.update(loadingId, {
        type: 'error',
        message: result?.error?.message || result?.error || '发货失败'
      })
      return
    }
    toast.update(loadingId, { type: 'success', message: result?.data?.message || result?.message || '发货成功' })
    closeDeliverForm()
    await loadOrders()
  } catch (error) {
    toast.update(loadingId, {
      type: 'error',
      message: '发货失败: ' + (error.message || '未知错误')
    })
  }
}

onMounted(() => {
  countdownTimer = setInterval(() => {
    nowTs.value = Date.now()
  }, 1000)
})

watch(
  () => [
    route.query.tab,
    route.query.source,
    route.query.categoryId,
    route.query.categoryName,
    route.query.dealOnly,
    route.query.status,
    route.query.timeRange,
    route.query.search,
    route.query.page
  ].join('|'),
  async () => {
    if (props.sellerMode && pendingSellerTabIntent) {
      if (!isSellerOrderTabQueryMatch(route.query, pendingSellerTabIntent)) return
      settleSellerTabIntent(pendingSellerTabIntent)
    }
    restoredScrollKey = ''
    syncRouteState()
    if (!props.sellerMode) page.value = 1
    closeDeliverForm()
    await loadOrders()
    if (!props.sellerMode) await restoreScrollState()
  },
  { immediate: true }
)

onUnmounted(() => {
  if (sellerTabDebounceTimer) {
    clearTimeout(sellerTabDebounceTimer)
    sellerTabDebounceTimer = null
  }
  pendingSellerTabIntent = null
  orderListController.stop()
  orderActions.clear()
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
})
</script>

<style scoped>
.seller-order-status { min-width: 0; }
.seller-order-progress { display: block; margin-top: 4px; color: var(--text-secondary-semantic); font-size: 11px; line-height: 1.5; }

.status-refund-pending { color: var(--status-info); background: color-mix(in srgb, var(--status-info) 10%, var(--surface-card)); }
.status-refund-failed { color: var(--status-danger); background: color-mix(in srgb, var(--status-danger) 10%, var(--surface-card)); }
.order-status small { font-size: inherit; }
.order-fulfillment-progress { margin: 8px 0; color: var(--text-secondary-semantic); font-size: 12px; }

.orders-page {
  min-height: 100vh;
  padding-bottom: 80px;
}

.page-container {
  max-width: 600px;
}

.page-header {
  margin-bottom: var(--section-gap);
}

.page-title {
  font-size: var(--text-display);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

/* 角色切换 */
.role-tabs {
  width: 100%;
  margin-bottom: 16px;
}

/* 状态筛选 */
.status-tabs {
  width: 100%;
  min-width: 0;
  margin-bottom: 16px;
}

.orders-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.filter-search {
  flex: 1;
  position: relative;
  min-width: 0;
  display: flex;
  align-items: center;
}

.filter-input {
  width: 100%;
  height: 42px;
  padding: 0 14px;
  padding-right: 40px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
}

.filter-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.filter-search-btn {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
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

.filter-search-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.filter-search-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.filter-search-clear {
  position: absolute;
  right: 38px;
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

.filter-search-clear:hover {
  background: var(--border-color);
  color: var(--text-secondary);
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
  background: var(--palette-hex-f3eee8);
  color: var(--palette-hex-7c6f62);
  font-size: 13px;
  font-weight: 500;
}

.direct-filter-chip.strong {
  background: var(--palette-hex-e8ede7);
  color: var(--palette-hex-5d715b);
}

.direct-filter-clear {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border-light);
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
}

.filter-select-wrap {
  flex-shrink: 0;
  min-width: 118px;
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
  color: var(--palette-hex-ffffff);
  border-radius: 12px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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
  border: 1px solid var(--border-light);
  border-radius: 18px;
  padding: 18px 20px;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.order-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-hover);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}

/* 卡片链接化（router-link 渲染为 <a>） */
.order-header,
.order-content {
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.order-header-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.order-date {
  font-size: 13px;
  color: var(--text-tertiary);
}

.order-expire-chip {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--color-warning-light);
  color: var(--color-warning);
  font-size: 12px;
  font-weight: 600;
}

.order-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
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

.status-external-dispute {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.status-expired {
  background: var(--bg-tertiary);
  color: var(--text-quaternary);
}

.order-content {
  display: block;
  margin-bottom: 14px;
}

.product-name-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.product-name {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.5;
  margin-bottom: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-quantity-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.order-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 13px;
  color: var(--text-tertiary);
}

.order-seller {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
}

.order-manual-hint {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--bg-secondary);
  font-size: 12px;
  color: var(--color-primary);
}

.order-coupon-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 9px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--color-primary-light);
  color: var(--color-primary-hover);
  font-size: 11px;
}

.order-coupon-summary span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-coupon-summary strong {
  flex: 0 0 auto;
  color: var(--color-danger);
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
  margin: 14px 0;
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 14px;
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
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.cdk-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-light);
}

.order-amount-wrap {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.order-amount-wrap.compact {
  flex-wrap: wrap;
}

.order-amount {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-warning);
  line-height: 1.2;
}

.order-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.order-action {
  font-size: 13px;
  color: var(--color-primary);
  font-weight: 600;
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
  color: var(--palette-hex-b45309);
  font-size: 12px;
  line-height: 1.6;
  text-align: right;
}

.action-btn {
  min-height: 34px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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
  background: linear-gradient(135deg, var(--color-info) 0%, var(--palette-hex-3b82f6) 100%);
  color: var(--palette-hex-ffffff);
}

.action-btn.deliver-btn:hover:not(:disabled) {
  opacity: 0.92;
}

.action-btn.pay-btn {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
  color: var(--palette-hex-ffffff);
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
  color: var(--palette-hex-ffffff);
}

.action-btn.enter-btn:hover:not(:disabled) {
  opacity: 0.92;
}

.action-btn.review-btn {
  background: linear-gradient(135deg, var(--palette-hex-8da6a8) 0%, var(--palette-hex-789497) 100%);
  color: var(--palette-hex-ffffff);
  box-shadow: 0 4px 12px var(--palette-rgba-120-148-151-0p24);
}

.action-btn.review-btn:hover:not(:disabled) {
  box-shadow: 0 6px 14px var(--palette-rgba-120-148-151-0p3);
  filter: brightness(0.97);
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
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.load-more-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 639px) {
  /* role-tabs via LiquidTabs */
  .role-tabs {
    margin-bottom: 12px;
  }

  /* orders-filters single row */
  .orders-filters {
    gap: 6px;
    flex-wrap: nowrap;
  }

  .filter-search {
    flex: 1;
    min-width: 0;
  }

  .filter-input {
    height: 36px;
    box-sizing: border-box;
    padding: 0 10px;
    padding-right: 34px;
    border-radius: 10px;
    font-size: 13px;
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
  }

  .filter-input:focus {
    outline: none;
    background: var(--input-focus-bg);
    border-color: var(--input-focus-border);
    box-shadow: 0 2px 8px var(--glass-shadow-light);
  }

  .filter-input::placeholder {
    color: var(--text-placeholder);
  }

  .filter-search-btn {
    width: 28px;
    height: 28px;
  }

  .filter-search-clear {
    right: 34px;
    width: 20px;
    height: 20px;
    font-size: 12px;
  }

  .filter-select-wrap {
    flex-shrink: 0;
    min-width: unset;
  }

  .filter-select-wrap :deep(.select-trigger) {
    height: 36px;
    box-sizing: border-box;
    min-height: unset;
    min-width: unset;
    width: auto;
    padding: 0 28px 0 10px;
    font-size: 13px;
  }

  .filter-select-wrap :deep(.select-arrow) {
    right: 8px;
    width: 14px;
    height: 14px;
  }

  /* compact order-card */
  .order-card {
    padding: 12px 14px;
    border-radius: 14px;
  }

  .order-header {
    margin-bottom: 8px;
    gap: 8px;
  }

  .order-date {
    font-size: 12px;
  }

  .order-expire-chip {
    min-height: 22px;
    padding: 0 8px;
    font-size: 11px;
  }

  .order-status {
    min-height: 24px;
    padding: 0 8px;
    font-size: 11px;
  }

  .order-content {
    margin-bottom: 8px;
  }

  .product-name-row {
    gap: 8px;
    margin-bottom: 4px;
  }

  .product-name {
    font-size: 14px;
  }

  .order-quantity-badge {
    min-height: 22px;
    padding: 0 8px;
    font-size: 11px;
  }

  .order-info {
    font-size: 12px;
    gap: 6px;
  }

  .order-manual-hint {
    margin-top: 6px;
    padding: 6px 8px;
    font-size: 11px;
  }

  .order-coupon-summary {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
    margin-top: 6px;
    padding: 6px 8px;
  }

  .order-footer {
    padding-top: 8px;
    gap: 8px;
  }

  .order-amount {
    font-size: 15px;
  }

  .order-count {
    font-size: 11px;
  }

  .order-actions {
    gap: 6px;
  }

  .action-btn {
    min-height: 28px;
    padding: 0 10px;
    border-radius: 8px;
    font-size: 12px;
  }

  .maintenance-order-hint {
    margin-top: 6px;
    font-size: 11px;
  }

  .cdk-display {
    margin: 8px 0;
    padding: 10px;
    border-radius: 10px;
  }

  .cdk-label {
    font-size: 11px;
    margin-bottom: 6px;
  }

  .cdk-code {
    padding: 8px 10px;
    font-size: 12px;
  }

  .cdk-btn {
    width: 30px;
    height: 30px;
    font-size: 12px;
  }

  .order-header {
    align-items: center;
  }

  .product-name {
    white-space: normal;
  }

  .order-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .order-amount-wrap {
    width: 100%;
    box-sizing: border-box;
  }

  .order-actions {
    justify-content: flex-start;
  }

  .deliver-form {
    margin-top: 8px;
    padding: 8px;
  }

  .deliver-input {
    min-height: 56px;
    font-size: 12px;
  }

  .deliver-hint {
    font-size: 11px;
  }
}

.seller-orders-page { min-height: auto; padding-bottom: 24px; background: transparent; }
.seller-source-tabs { flex: 0 0 auto; }
.seller-status-tabs { flex: 1 1 360px; }
.seller-order-ledger { transition: opacity 140ms ease; }
.seller-order-ledger.is-filter-pending { opacity: .58; pointer-events: none; }
.seller-order-select { min-width: 142px; }
.seller-order-search { min-width: min(100%, 286px); height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 6px 0 12px; border: 1px solid var(--seller-border); border-radius: 10px; color: var(--seller-muted); background: var(--seller-surface); }
.seller-order-search:focus-within { border-color: var(--seller-jade); box-shadow: 0 0 0 3px color-mix(in srgb, var(--seller-jade) 18%, transparent); }
.seller-order-search input { min-width: 0; flex: 1; border: 0; outline: 0; color: var(--seller-ink); background: transparent; font-size: 14px; }
.seller-order-search button { min-width: 52px; min-height: 34px; border-radius: 8px; color: var(--palette-hex-ffffff); background: var(--seller-navy); font-size: 12px; font-weight: 700; }
.seller-filter-chip { min-height: 30px; display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; color: var(--seller-muted); background: var(--seller-jade-soft); font-size: 12px; }
.seller-filter-clear { min-height: 30px; padding: 4px 10px; color: var(--seller-jade); font-size: 12px; font-weight: 700; }
.seller-order-total { margin-left: auto; color: var(--seller-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.seller-order-total.is-switching { color: var(--seller-jade); font-weight: 700; }
.seller-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.seller-order-id, .seller-order-subject { min-width: 0; display: block; }
.seller-order-id strong, .seller-order-id small, .seller-order-subject strong, .seller-order-subject small { display: block; }
.seller-order-id strong { overflow: hidden; color: var(--seller-ink); font: 650 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; text-overflow: ellipsis; white-space: nowrap; }
.seller-order-id small, .seller-order-subject small, .seller-order-unit { margin-top: 5px; color: var(--seller-muted); font-size: 10px; }
.seller-order-subject strong { overflow: hidden; color: var(--seller-ink); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.seller-order-subject-link { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 5px; color: var(--seller-ink); text-decoration: none; }
.seller-order-subject-link svg { flex: 0 0 auto; color: var(--seller-jade); }
.seller-order-subject-link:hover strong { color: var(--seller-jade); text-decoration: underline; text-underline-offset: 3px; }
.seller-order-subject-link:focus-visible { border-radius: 5px; outline: 2px solid var(--seller-jade); outline-offset: 3px; }
.seller-order-amount, .seller-order-unit { display: block; font-variant-numeric: tabular-nums; }
.seller-order-amount { color: var(--seller-ink); font: 700 14px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; }
.seller-order-expiry { display: block; margin-top: 6px; color: var(--seller-warning); font-size: 10px; line-height: 1.35; }
.seller-order-actions { display: flex; align-items: center; justify-content: flex-end; gap: 7px; flex-wrap: wrap; }
.seller-row-primary, .seller-row-secondary, .seller-row-danger, .seller-row-detail { min-height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 10px; border: 1px solid var(--seller-border); border-radius: 9px; color: var(--seller-muted); background: var(--seller-surface); font-size: 12px; font-weight: 700; }
.seller-row-primary { color: var(--palette-hex-ffffff); border-color: var(--seller-navy); background: var(--seller-navy); }
.seller-row-danger { color: var(--seller-danger); border-color: color-mix(in srgb, var(--seller-danger) 22%, var(--seller-border)); }
.seller-row-detail { border-color: transparent; color: var(--seller-jade); }
.seller-order-mobile-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.seller-order-mobile-head > div { min-width: 0; }
.seller-order-mobile-head strong, .seller-order-mobile-head small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.seller-order-mobile-head strong { color: var(--seller-ink); font-size: 14px; }
.seller-order-mobile-head small { margin-top: 5px; color: var(--seller-muted); font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
.seller-order-mobile-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 15px; }
.seller-order-mobile-grid div { min-width: 0; padding: 10px; border-radius: 9px; background: var(--seller-surface-soft); }
.seller-order-mobile-grid dt { color: var(--seller-muted); font-size: 10px; }
.seller-order-mobile-grid dd { margin: 4px 0 0; overflow: hidden; color: var(--seller-ink); font-size: 12px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.seller-order-mobile-grid dd.seller-order-mobile-party { overflow: visible; text-overflow: clip; white-space: normal; }
.seller-order-mobile-expiry { margin: 10px 0 0; color: var(--seller-warning); font-size: 11px; }
.seller-order-mobile-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; }
.seller-order-mobile-actions > * { min-width: 0; min-height: 44px; flex: 1 1 calc(50% - 4px); }
.seller-orders-empty { display: grid; justify-items: center; gap: 8px; color: var(--seller-muted); }
.seller-orders-empty strong { color: var(--seller-ink); font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif; font-size: 18px; }
.seller-orders-empty p { margin: 0; font-size: 13px; }

@media (max-width: 767px) {
  .seller-status-tabs {
    width: 100%;
    min-height: 54px;
    flex: 0 0 auto;
    align-self: stretch;
  }
  .seller-order-search, .seller-order-select { width: 100%; }
  .seller-order-total { margin-left: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .seller-order-ledger { transition: none; }
}
</style>
