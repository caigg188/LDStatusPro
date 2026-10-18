<template>
  <div class="checkout-page">
    <section class="checkout-shell" aria-label="订单确认">
      <button type="button" class="back-button" @click="goBack">
        <ArrowLeft :size="18" aria-hidden="true" />
        <span>返回物品详情</span>
      </button>

      <div v-if="pendingSubmission || restorationBlocked" class="submission-error" role="status" aria-live="polite">
        <CircleAlert :size="20" aria-hidden="true" />
        <div>
          <strong>{{ confirmedSubmission ? '订单已创建' : '正在确认本次订单结果' }}</strong>
          <p>{{ confirmedSubmission ? '请进入订单详情查看状态并继续支付。' : '网络可能中断，订单仍可能已创建。请先确认本次结果，避免重复兑换。' }}</p>
          <p v-if="restorationBlocked">旧订单记录尚未确认，请重试查询，或前往我的订单核对。</p>
          <button type="button" class="state-action" :disabled="submitting || checkingSubmission" @click="restorationBlocked ? initializeCheckout() : recoverSubmission(true)">
            {{ checkingSubmission || submitting ? '正在确认…' : confirmedSubmission ? '进入订单详情' : '确认并继续本次订单' }}
          </button>
          <RouterLink v-if="restorationBlocked" class="state-action" to="/user/orders">查看我的订单</RouterLink>
        </div>
      </div>

      <div v-else-if="loading" class="checkout-loading" aria-live="polite">
        <div class="skeleton skeleton-product"></div>
        <div class="skeleton skeleton-receipt"></div>
      </div>

      <EmptyState
        v-else-if="!product"
        text="无法确认这笔订单"
        :hint="loadError || '物品可能已下架，请返回详情后重试。'"
      >
        <template #icon>
          <ShoppingBag :size="48" :stroke-width="1.5" aria-hidden="true" />
        </template>
        <template #action>
          <button type="button" class="state-action" @click="goBack">返回物品详情</button>
        </template>
      </EmptyState>

      <template v-else>
        <div
          v-if="submissionError"
          ref="errorSummaryRef"
          class="submission-error"
          role="alert"
          tabindex="-1"
        >
          <CircleAlert :size="20" aria-hidden="true" />
          <div>
            <strong>订单提交未完成</strong>
            <p>{{ submissionError }}</p>
          </div>
        </div>

        <FulfillmentPolicyNotice v-if="!isCdk" />
        <div class="checkout-grid">
          <div class="checkout-main-column">
            <section class="checkout-card product-card" aria-labelledby="product-card-title">
              <div class="section-heading">
                <div class="heading-icon"><ShoppingBag :size="18" aria-hidden="true" /></div>
                <div>
                  <h2 id="product-card-title">物品信息</h2>
                  <p>本单包含 1 种物品</p>
                </div>
              </div>

              <div class="product-summary">
                <div class="product-cover">
                  <img v-if="productImage" :src="productImage" :alt="productName" />
                  <ShoppingBag v-else :size="34" :stroke-width="1.4" aria-hidden="true" />
                </div>
                <div class="product-copy">
                  <div class="product-badges">
                    <span class="product-type-badge">{{ isCdk ? '自动发卡' : '手动履约' }}</span>
                  </div>
                  <h3>{{ productName }}</h3>
                  <p class="seller-name">卖家 @{{ sellerUsername }}</p>
                  <p class="delivery-copy">{{ deliveryDescription }}</p>
                </div>
                <div class="unit-price">
                  <span v-if="hasProductDiscount">{{ formatMoney(originalUnitPrice) }} LDC</span>
                  <strong>{{ formatMoney(discountedUnitPrice) }} LDC</strong>
                  <small>单价</small>
                </div>
              </div>

              <div class="quantity-row">
                <div>
                  <div class="quantity-heading">
                    <label for="checkout-quantity">兑换数量</label>
                    <span class="quantity-stock">
                      <ProductStockIndicator :product="product" size="sm" />
                    </span>
                  </div>
                  <p>{{ quantityHint }} · 数量仅用于试算，确认兑换时校验库存</p>
                </div>
                <div class="quantity-control">
                  <button
                    type="button"
                    aria-label="减少数量"
                    :disabled="quantity <= 1 || submitting"
                    @click="changeQuantity(-1)"
                  >
                    <Minus :size="17" aria-hidden="true" />
                  </button>
                  <input
                    id="checkout-quantity"
                    v-model.number="quantity"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    :max="hasQuantityMaximum ? maxSelectableQuantity : undefined"
                    :disabled="submitting"
                    @change="commitQuantity"
                    @blur="commitQuantity"
                  />
                  <button
                    type="button"
                    aria-label="增加数量"
                    :disabled="(hasQuantityMaximum && quantity >= maxSelectableQuantity) || submitting"
                    @click="changeQuantity(1)"
                  >
                    <Plus :size="17" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div
                v-if="purchaseLimit.mode === 'per_user'"
                class="purchase-limit-equation"
                :class="{ reached: purchaseLimitReached }"
                role="status"
              >
                <div class="purchase-limit-equation-heading">
                  <strong>{{ purchaseLimitTitle }}</strong>
                  <span v-if="purchaseLimit.bypassed">测试模式自购不计累计额度</span>
                  <span v-else-if="purchaseLimitReached">当前账号已达{{ purchaseLimit.periodDays > 0 ? '本周期' : '永久累计' }}限购</span>
                  <span v-else>本次最多还可兑换 {{ purchaseLimitRemaining }} 件</span>
                </div>
                <div v-if="!purchaseLimit.bypassed" class="purchase-limit-equation-values">
                  <span>已购买 <strong>{{ purchaseLimitPurchased }}</strong></span>
                  <b>+</b>
                  <span>待支付 <strong>{{ purchaseLimitReserved }}</strong></span>
                  <b>+</b>
                  <span>本次 <strong>{{ quantity }}</strong></span>
                  <b>=</b>
                  <span class="equation-total"><strong>{{ purchaseLimitTotal }}</strong> / {{ purchaseLimit.quantity }}</span>
                </div>
                <p v-if="purchaseLimitReached && purchaseLimitReleaseText" class="purchase-limit-release">
                  按当前状态，最早一笔记录将于 {{ purchaseLimitReleaseText }} 移出统计周期
                </p>
                <router-link
                  v-if="purchaseLimitReserved > 0"
                  :to="{ name: 'Orders' }"
                >
                  查看占用额度的待支付订单
                </router-link>
              </div>
            </section>

            <section class="checkout-card order-options-card" aria-labelledby="order-options-title">
              <div class="section-heading">
                <div class="heading-icon"><TicketPercent :size="18" aria-hidden="true" /></div>
                <div>
                  <h2 id="order-options-title">订单选项</h2>
                  <p>核对优惠券与交付方式</p>
                </div>
              </div>

              <div class="order-option-list">
                <button
                  type="button"
                  class="order-option-row coupon-option-row"
                  :disabled="quoteLoading || submitting"
                  aria-haspopup="dialog"
                  :aria-expanded="couponPickerOpen"
                  @click="handleCouponOptionClick"
                >
                  <span class="order-option-icon" aria-hidden="true"><TicketPercent :size="18" /></span>
                  <span class="order-option-copy">
                    <strong>优惠券</strong>
                    <small v-if="quoteLoading">正在更新优惠与金额…</small>
                    <small v-else-if="quoteError">优惠信息加载失败，点击重试</small>
                    <small v-else>{{ couponSummaryText }}</small>
                  </span>
                  <span v-if="selectedCoupon && !quoteLoading" class="order-option-saving">
                    -{{ formatMoney(couponDiscountAmount) }} LDC
                  </span>
                  <ChevronRight v-if="!quoteLoading" :size="18" class="order-option-chevron" aria-hidden="true" />
                  <RefreshCw v-else :size="17" class="spin order-option-chevron" aria-hidden="true" />
                </button>

                <p v-if="quoteError" class="coupon-error" role="status">
                  <template v-if="quoteErrorCode === 'PURCHASE_LIMIT_EXCEEDED'">{{ quoteError }}</template>
                  <template v-else>{{ quoteError }}，当前按不使用优惠券计算；可重试或继续兑换。</template>
                </p>
                <p v-else-if="couponSelectionNotice" class="coupon-selection-notice" role="status">
                  {{ couponSelectionNotice }}
                </p>

                <div class="order-option-row delivery-option-row">
                  <span class="order-option-icon" aria-hidden="true"><PackageCheck :size="18" /></span>
                  <span class="order-option-copy">
                    <strong>交付方式</strong>
                    <small>{{ deliveryNotice }}</small>
                  </span>
                </div>
              </div>
            </section>
          </div>

          <aside class="checkout-sidebar" aria-label="本单明细">
            <div class="receipt-card">
              <div class="receipt-heading">
                <div>
                  <p>预计购买凭证</p>
                  <h2>本单明细</h2>
                  <span>提交前请核对数量与金额</span>
                </div>
                <span class="receipt-heading-icon" aria-hidden="true">
                  <ReceiptText :size="22" />
                </span>
              </div>

              <dl class="receipt-lines" aria-live="polite" aria-atomic="true">
                <div>
                  <dt>数量</dt>
                  <dd>{{ quantity }} 件</dd>
                </div>
                <div class="receipt-unit-line">
                  <dt>单价</dt>
                  <dd>
                    <template v-if="hasProductDiscount">
                      <small class="receipt-unit-original">
                        原价 <del>{{ formatMoney(originalUnitPrice) }} LDC / 件</del>
                      </small>
                      <strong class="receipt-unit-discounted">
                        折后 {{ formatMoney(discountedUnitPrice) }} LDC / 件
                      </strong>
                    </template>
                    <strong v-else class="receipt-unit-current">
                      {{ formatMoney(originalUnitPrice) }} LDC / 件
                    </strong>
                  </dd>
                </div>
                <div>
                  <dt>物品小计</dt>
                  <dd>{{ formatMoney(originalSubtotal) }} LDC</dd>
                </div>
                <div class="receipt-discount-line">
                  <dt>
                    <span>优惠金额</span>
                    <small>{{ discountBreakdownText }}</small>
                  </dt>
                  <dd :class="{ saving: totalDiscountAmount > 0 }">
                    {{ totalDiscountAmount > 0 ? '-' : '' }}{{ formatMoney(totalDiscountAmount) }} LDC
                  </dd>
                </div>
              </dl>

              <div class="receipt-total" aria-live="polite" aria-atomic="true">
                <span>
                  <small>共 {{ quantity }} 件</small>
                  最终应付
                </span>
                <strong>{{ formatMoney(payableAmount) }} <small>LDC</small></strong>
              </div>

              <p v-if="selectedCoupon" class="selected-coupon-note">
                已选择「{{ selectedCoupon.campaign.name }}」
              </p>
              <p v-if="submitBlockMessage" class="submit-block-message" role="status">
                {{ submitBlockMessage }}
              </p>

              <button
                type="button"
                class="confirm-button desktop-confirm"
                :disabled="!canSubmit"
                @click="submitOrder"
              >
                <RefreshCw v-if="submitting" :size="18" class="spin" aria-hidden="true" />
                <CreditCard v-else :size="18" aria-hidden="true" />
                <span>{{ submitButtonText }}</span>
              </button>
              <p class="submit-hint">确认后才会创建订单，并为你打开 LDC 支付。</p>
            </div>
          </aside>
        </div>
      </template>
    </section>

    <div v-if="product && !pendingSubmission && !restorationBlocked" class="mobile-confirm-bar">
      <div>
        <span>最终应付 · {{ quantity }} 件</span>
        <strong>{{ formatMoney(payableAmount) }} LDC</strong>
      </div>
      <button type="button" class="confirm-button" :disabled="!canSubmit" @click="submitOrder">
        <RefreshCw v-if="submitting" :size="18" class="spin" aria-hidden="true" />
        <CreditCard v-else :size="18" aria-hidden="true" />
        <span>{{ submitButtonText }}</span>
      </button>
    </div>

    <CouponPickerDialog
      :open="couponPickerOpen"
      :coupons="availableCoupons"
      :unavailable-coupons="unavailableCoupons"
      :selected-claim-id="selectedCouponClaimId"
      @close="closeCouponPicker"
      @confirm="confirmCouponSelection"
    />
  </div>
</template>

<script setup>
import { normalizeResourceId } from '@/utils/resourceId'
import FulfillmentPolicyNotice from '@/components/order/FulfillmentPolicyNotice.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  CreditCard,
  Minus,
  PackageCheck,
  Plus,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  TicketPercent,
} from '@lucide/vue'
import { useProductStore } from '@/stores/product'
import { getCheckoutSubmissionError, useCheckoutSubmission } from '@/composables/orders/useCheckoutSubmission'
import { useOrderStore } from '@/stores/order'
import { useUserStore } from '@/stores/user'
import { shouldPreserveCheckoutDraft, useCheckoutStore } from '@/stores/checkout'
import { useToast } from '@/composables/useToast'
import { isMaintenanceFeatureEnabled, isRestrictedMaintenanceMode } from '@/config/maintenance'
import { quoteOrderRequest } from '@/services/shop/couponService'
import { clampCheckoutQuantity, resolveCheckoutQuantityMaximum } from '@/utils/checkoutQuantity'
import { formatPrice } from '@/utils/format'
import { createSubmissionGate } from '@/utils/submissionGate'
import {
  COUPON_SELECTION_AUTO,
  COUPON_SELECTION_MANUAL,
  evaluateFinalQuote,
  resolveCouponSelection,
  resolveCouponSelectionAfterQuoteFailure,
} from '@/utils/checkoutCoupon'
import {
  getAvailableStock,
  isCdkProduct,
  isOutOfStock as isProductOutOfStock,
  isPlatformOrderProduct,
  isUnlimitedStock,
} from '@/utils/shopProduct'
import { cleanupPreparedTab, openPaymentPopup, preparePaymentPopup } from '@/utils/newTab'
import { trackPaymentPopup } from '@/utils/paymentReturn'
import CouponPickerDialog from '@/components/checkout/CouponPickerDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ProductStockIndicator from '@/components/product/ProductStockIndicator.vue'
import {
  formatPurchaseLimitLabel,
  formatPurchaseLimitReleaseTime,
  formatPurchaseLimitTitle,
  getPurchaseLimit,
  getPurchaseLimitMaximum,
  isPurchaseLimitReached
} from '@/utils/purchaseLimit'

defineOptions({ name: 'OrderConfirm' })

const route = useRoute()
const router = useRouter()
const productStore = useProductStore()
const orderStore = useOrderStore()
const userStore = useUserStore()
const checkoutStore = useCheckoutStore()
const toast = useToast()
const submissionGate = createSubmissionGate()

const loading = ref(true)
const product = ref(null)
const loadError = ref('')
const quantity = ref(1)
const couponQuote = ref(null)
const quoteLoading = ref(false)
const quoteError = ref('')
const quoteErrorCode = ref('')
const selectedCouponClaimId = ref(null)
const couponSelectionMode = ref(COUPON_SELECTION_AUTO)
const couponSelectionNotice = ref('')
const couponPickerOpen = ref(false)
const submitting = ref(false)
const submissionError = ref('')
const errorSummaryRef = ref(null)

const productId = computed(() => {
  const parsed = normalizeResourceId(route.params.productId)
  return !!parsed ? parsed : 0
})
const checkoutSessionKey = userStore.sessionKey
const isCheckoutActive = () => checkoutActive && userStore.ensureValidSession() && userStore.sessionKey === checkoutSessionKey
const submission = useCheckoutSubmission({
  owner: JSON.stringify([userStore.user?.site || 'linux.do', String(userStore.user?.id || '')]),
  productId: productId.value,
  create: input => orderStore.createOrder(input.productId, input.quantity, input.couponClaimId, input.token, input.expectedAmount),
  lookup: (token, legacy) => orderStore.getOrderSubmission(token, legacy),
})
const { pending: pendingSubmission, checking: checkingSubmission, confirmed: confirmedSubmission, restorationBlocked } = submission
let checkoutActive = true

const productName = computed(() => String(product.value?.name || '未命名物品'))
const productImage = computed(() => String(product.value?.imageUrl || ''))
const sellerUsername = computed(() => String(product.value?.sellerUsername || '未知'))
const isCdk = computed(() => isCdkProduct(product.value))
const isPlatformOrder = computed(() => isPlatformOrderProduct(product.value))
const originalUnitPrice = computed(() => Number(product.value?.price || 0))
const productDiscount = computed(() => Number(product.value?.discount || 1))
const discountedUnitPrice = computed(() => originalUnitPrice.value * productDiscount.value)
const hasProductDiscount = computed(() => productDiscount.value < 1)
const originalSubtotal = computed(() => Number(couponQuote.value?.originalPrice ?? originalUnitPrice.value * quantity.value))
const availableStock = computed(() => getAvailableStock(product.value))
const hasUnlimitedStock = computed(() => isUnlimitedStock(product.value))
const isOutOfStock = computed(() => isProductOutOfStock(product.value))

const purchaseLimit = computed(() => getPurchaseLimit(couponQuote.value || product.value))
const purchaseLimitReached = computed(() => isPurchaseLimitReached(purchaseLimit.value))
const purchaseLimitMaximum = computed(() => getPurchaseLimitMaximum(purchaseLimit.value))
const purchaseLimitPurchased = computed(() => Number(purchaseLimit.value.purchasedQuantity || 0))
const purchaseLimitReserved = computed(() => Number(purchaseLimit.value.reservedQuantity || 0))
const purchaseLimitRemaining = computed(() => Number(
  purchaseLimit.value.remainingQuantity ?? purchaseLimit.value.quantity ?? 0
))
const purchaseLimitTitle = computed(() => formatPurchaseLimitTitle(purchaseLimit.value))
const purchaseLimitReleaseText = computed(() => (
  purchaseLimit.value.periodDays > 0
    ? formatPurchaseLimitReleaseTime(purchaseLimit.value.nextAvailableAt)
    : ''
))
const purchaseLimitTotal = computed(() => (
  purchaseLimitPurchased.value + purchaseLimitReserved.value + quantity.value
))

const maxSelectableQuantity = computed(() => {
  return resolveCheckoutQuantityMaximum({
    purchaseLimitMaximum: purchaseLimitMaximum.value,
    purchaseLimitReached: purchaseLimitReached.value,
    unlimitedStock: hasUnlimitedStock.value,
    availableStock: availableStock.value,
  })
})
const hasQuantityMaximum = computed(() => Number.isInteger(maxSelectableQuantity.value))

const quantityHint = computed(() => {
  const hints = []
  if (purchaseLimit.value.mode !== 'none') {
    hints.push(formatPurchaseLimitLabel(purchaseLimit.value, { loggedIn: true }))
  }
  return hints.length ? hints.join(' · ') : '可按需要调整本次兑换数量'
})

const couponOptions = computed(() => Array.isArray(couponQuote.value?.coupons) ? couponQuote.value.coupons : [])
const availableCoupons = computed(() => couponOptions.value.filter(coupon => coupon.eligible))
const unavailableCoupons = computed(() => couponOptions.value.filter(coupon => !coupon.eligible))
const selectedCoupon = computed(() => (
  availableCoupons.value.find(coupon => coupon.claimId === selectedCouponClaimId.value) || null
))
const productSubtotal = computed(() => Number(
  couponQuote.value?.productSubtotal ?? discountedUnitPrice.value * quantity.value
))
const productDiscountAmount = computed(() => Math.max(0, originalSubtotal.value - productSubtotal.value))
const couponDiscountAmount = computed(() => Number(selectedCoupon.value?.couponDiscountAmount || 0))
const totalDiscountAmount = computed(() => productDiscountAmount.value + couponDiscountAmount.value)
const payableAmount = computed(() => Number(selectedCoupon.value?.payableAmount ?? productSubtotal.value))
const discountBreakdownText = computed(() => {
  const parts = []
  if (productDiscountAmount.value > 0) parts.push(`物品优惠 ${formatMoney(productDiscountAmount.value)}`)
  if (couponDiscountAmount.value > 0) parts.push(`优惠券 ${formatMoney(couponDiscountAmount.value)}`)
  return parts.length ? parts.join(' + ') : '本单暂无优惠'
})
const couponSummaryText = computed(() => {
  if (selectedCoupon.value) {
    const prefix = couponSelectionMode.value === COUPON_SELECTION_AUTO ? '已自动选择' : '已选择'
    return `${prefix}「${selectedCoupon.value.campaign.name}」`
  }
  if (availableCoupons.value.length) return `${availableCoupons.value.length} 张可用，当前不使用`
  return '暂无可用券'
})

const deliveryDescription = computed(() => (
  isCdk.value
    ? '支付成功后，系统会自动将卡密发放到订单详情。'
    : '支付成功后，请通过订单记录联系卖家完成交付。'
))
const deliveryNotice = computed(() => (
  isCdk.value
    ? '卡密将在支付结果确认后自动发放。请勿重复创建订单，交付内容可在订单详情中查看。'
    : '普通物品由卖家手动履约。支付完成后请主动联系卖家，站内订单会保留交易与交付记录。'
))

const viewerTrustLevel = computed(() => {
  const parsed = Number.parseInt(userStore.trustLevel, 10)
  return Number.isInteger(parsed) ? parsed : 0
})
const purchaseTrustLevel = computed(() => {
  const parsed = Number(product.value?.purchaseTrustLevel ?? 0)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 4) : 0
})
const isSeller = computed(() => (
  String(userStore.user?.id || '') === String(product.value?.sellerUserId ?? '')
))
const isTestMode = computed(() => !!product.value?.isTestMode)
const isOrderCreationMaintenanceBlocked = computed(() => (
  isRestrictedMaintenanceMode() && !isMaintenanceFeatureEnabled('orderCreate')
))
const submitBlockMessage = computed(() => {
  if (!isPlatformOrder.value) return '该物品不支持站内兑换。'
  if (isOrderCreationMaintenanceBlocked.value) return '当前处于受限维护状态，暂时无法创建订单。'
  if (isOutOfStock.value) return '物品已经售罄，请返回详情订阅补货。'
  if (purchaseLimitReached.value) {
    return `当前账号${formatPurchaseLimitLabel(purchaseLimit.value, { loggedIn: true })}。`
  }
  if (product.value?.canPurchase === false) return '该物品当前暂停销售。'
  if (purchaseTrustLevel.value > viewerTrustLevel.value) return `当前账号需达到 TL${purchaseTrustLevel.value} 才能兑换。`
  if (isTestMode.value && !isSeller.value) return '该物品处于测试模式，仅卖家可兑换。'
  if (!isTestMode.value && isSeller.value) return '不能兑换自己发布的物品。'
  return ''
})
const canSubmit = computed(() => (
  !loading.value
  && !pendingSubmission.value
  && !restorationBlocked.value
  && !submitting.value
  && !quoteLoading.value
  && !submitBlockMessage.value
  && quantity.value >= 1
  && (!hasQuantityMaximum.value || quantity.value <= maxSelectableQuantity.value)
))
const submitButtonText = computed(() => (
  submitting.value
    ? '正在创建订单…'
    : '确认兑换'
))

function formatMoney(value) {
  return formatPrice(Number(value) || 0)
}

function clampQuantity(value) {
  return clampCheckoutQuantity(value, maxSelectableQuantity.value)
}

function commitQuantity() {
  const nextQuantity = clampQuantity(quantity.value)
  const changed = nextQuantity !== quantity.value
  quantity.value = nextQuantity
  checkoutStore.updateCheckout(productId.value, { quantity: nextQuantity })
  scheduleQuote()
  if (changed) toast.info(`兑换数量已调整为 ${nextQuantity}`)
}

function changeQuantity(delta) {
  quantity.value = clampQuantity(quantity.value + delta)
  checkoutStore.updateCheckout(productId.value, { quantity: quantity.value })
  scheduleQuote()
}

async function handleCouponOptionClick() {
  if (quoteLoading.value || submitting.value) return
  if (quoteError.value) {
    const quoteOk = await loadQuote()
    if (!isCheckoutActive()) return
    if (!quoteOk) return
  }
  couponPickerOpen.value = true
}

function closeCouponPicker() {
  couponPickerOpen.value = false
}

function confirmCouponSelection(claimId) {
  const normalizedClaimId = availableCoupons.value.some(coupon => coupon.claimId === claimId)
    ? claimId
    : null
  selectedCouponClaimId.value = normalizedClaimId
  couponSelectionMode.value = COUPON_SELECTION_MANUAL
  couponSelectionNotice.value = normalizedClaimId === null
    ? '已选择不使用优惠券。'
    : '优惠券已应用，金额明细已更新。'
  checkoutStore.updateCheckout(productId.value, {
    couponClaimId: normalizedClaimId,
    couponSelectionMode: COUPON_SELECTION_MANUAL,
  })
  closeCouponPicker()
}

let quoteTimer = null
let latestQuoteRequestId = 0

async function loadQuote() {
  if (quoteTimer) {
    window.clearTimeout(quoteTimer)
    quoteTimer = null
  }
  if (!productId.value || !product.value) return false

  const requestId = ++latestQuoteRequestId
  const requestedCouponClaimId = selectedCouponClaimId.value
  const requestedSelectionMode = couponSelectionMode.value
  quoteLoading.value = true
  quoteError.value = ''
  quoteErrorCode.value = ''
  couponSelectionNotice.value = ''

  let result
  try {
    result = await quoteOrderRequest(productId.value, clampQuantity(quantity.value))
  } catch (error) {
    result = { success: false, error: error?.message || '优惠券报价暂时不可用' }
  }
  if (requestId !== latestQuoteRequestId) return false

  if (result?.success) {
    couponQuote.value = result.data
    const selection = resolveCouponSelection({
      coupons: result.data?.coupons,
      mode: requestedSelectionMode,
      selectedClaimId: requestedCouponClaimId,
    })
    selectedCouponClaimId.value = selection.selectedClaimId
    couponSelectionMode.value = selection.mode
    if (selection.replacedManualSelection) {
      couponSelectionNotice.value = selection.selectedClaimId === null
        ? '之前选择的优惠券已不可用，当前没有其他可用券。'
        : '之前选择的优惠券已不可用，已为你改用当前最优惠券。'
    }
    checkoutStore.updateCheckout(productId.value, {
      couponClaimId: selection.selectedClaimId,
      couponSelectionMode: selection.mode,
    })
  } else {
    couponQuote.value = null
    const selection = resolveCouponSelectionAfterQuoteFailure({
      mode: requestedSelectionMode,
      selectedClaimId: requestedCouponClaimId,
    })
    selectedCouponClaimId.value = selection.selectedClaimId
    couponSelectionMode.value = selection.mode
    checkoutStore.updateCheckout(productId.value, {
      couponClaimId: null,
      couponSelectionMode: couponSelectionMode.value,
    })
    quoteError.value = result?.error || '优惠券报价暂时不可用'
    quoteErrorCode.value = result?.errorCode || ''
    if (result?.status === 409 && result?.errorCode === 'PURCHASE_LIMIT_EXCEEDED') {
      await loadProduct({ force: true })
    }
  }

  quoteLoading.value = false
  return result?.success === true
}

function scheduleQuote() {
  if (!product.value) return
  if (quoteTimer) window.clearTimeout(quoteTimer)
  // Invalidate an already-running quote immediately. Otherwise it may finish
  // during the debounce window and briefly overwrite the newly selected amount.
  latestQuoteRequestId++
  quoteLoading.value = true
  quoteTimer = window.setTimeout(() => { void loadQuote() }, 180)
}

async function loadProduct({ force = true } = {}) {
  const result = await productStore.fetchProduct(productId.value, force)
  const nextProduct = result.success ? result.data.product : null
  if (!nextProduct) {
    product.value = null
    loadError.value = '物品不存在、已下架或暂时无法读取。'
    return false
  }
  product.value = nextProduct
  quantity.value = clampQuantity(quantity.value)
  checkoutStore.updateCheckout(productId.value, { quantity: quantity.value })
  return true
}

async function initializeCheckout() {
  const restored = await submission.restore()
  if (!isCheckoutActive()) return
  if (!restored) { loading.value = false; return }
  if (pendingSubmission.value) {
    await recoverSubmission(false)
    loading.value = false
    return
  }
  if (!productId.value) {
    loadError.value = '物品编号无效。'
    loading.value = false
    return
  }

  const existingDraft = checkoutStore.getDraft(productId.value)
  quantity.value = existingDraft?.quantity || 1
  selectedCouponClaimId.value = existingDraft?.couponClaimId ?? null
  couponSelectionMode.value = existingDraft?.couponSelectionMode || COUPON_SELECTION_AUTO

  if (!existingDraft) {
    checkoutStore.startCheckout({ productId: productId.value, quantity: quantity.value })
  }

  const loaded = await loadProduct({ force: true })
  loading.value = false
  if (!loaded) return
  await loadQuote()
}

async function focusSubmissionError() {
  await nextTick()
  errorSummaryRef.value?.focus()
}

async function refreshAfterSubmitFailure() {
  await loadProduct({ force: true })
  await loadQuote()
}

async function submitOrder() {
  if (!canSubmit.value || submitting.value || !submissionGate.tryLock()) return

  // Open synchronously from the user gesture and lock the CTA before any await.
  // This both avoids popup blockers and prevents a fast double-click creating
  // two orders while the final quote validation is still running.
  const preparedWindow = preparePaymentPopup()
  submitting.value = true
  submissionError.value = ''
  const normalizedQuantity = clampQuantity(quantity.value)
  quantity.value = normalizedQuantity
  const requestedCouponClaimId = selectedCouponClaimId.value
  const amountBeforeValidation = payableAmount.value

  try {
    const quoteOk = await loadQuote()
    if (!isCheckoutActive()) { cleanupPreparedTab(preparedWindow); return }
    if (!quoteOk) {
      cleanupPreparedTab(preparedWindow)
      submissionError.value = quoteError.value || '最终额度与金额校验失败，请刷新后重试。'
      await refreshAfterSubmitFailure()
      await focusSubmissionError()
      return
    }
    const finalQuoteState = evaluateFinalQuote({
      requestedCouponClaimId,
      currentCouponClaimId: selectedCouponClaimId.value,
      amountBeforeValidation,
      currentPayableAmount: payableAmount.value,
      quoteSucceeded: quoteOk,
    })
    if (finalQuoteState.selectedCouponInvalidated) {
      cleanupPreparedTab(preparedWindow)
      submissionError.value = quoteError.value || '所选优惠券状态已变化，请重新选择。'
      await refreshAfterSubmitFailure()
      await focusSubmissionError()
      return
    }

    if (finalQuoteState.confirmationRequired) {
      cleanupPreparedTab(preparedWindow)
      submissionError.value = '物品价格或优惠券刚刚发生变化，已为你更新本单金额，请确认后再次兑换。'
      await refreshAfterSubmitFailure()
      await focusSubmissionError()
      return
    }

    const result = await submission.submit({
      productId: productId.value, quantity: normalizedQuantity,
      couponClaimId: selectedCouponClaimId.value, expectedAmount: payableAmount.value,
    })
    if (!isCheckoutActive()) { cleanupPreparedTab(preparedWindow); return }
    if (result?.success && result.data?.orderNo) {
      await finishCreatedOrder(result.data, preparedWindow)
      return
    }

    cleanupPreparedTab(preparedWindow)
    submissionError.value = getCheckoutSubmissionError(result)
    if (!pendingSubmission.value) await refreshAfterSubmitFailure()
    await focusSubmissionError()
  } catch (error) {
    cleanupPreparedTab(preparedWindow)
    submissionError.value = error?.message || '创建订单失败，请重新确认'
    if (!pendingSubmission.value) await refreshAfterSubmitFailure()
    await focusSubmissionError()
  } finally {
    submitting.value = false
    submissionGate.unlock()
  }
}

async function finishCreatedOrder(order, preparedWindow = null) {
  if (!isCheckoutActive()) { cleanupPreparedTab(preparedWindow); return }
  try {
    if (order.paymentUrl && !['cancelled', 'expired', 'paid', 'delivered', 'completed'].includes(order.status) && preparedWindow && !preparedWindow.closed) {
      const { popup, isPopup } = openPaymentPopup(order.paymentUrl, preparedWindow)
      if (!isPopup) cleanupPreparedTab(preparedWindow)
      if (isPopup && popup) trackPaymentPopup(order.orderNo, popup)
    } else {
      cleanupPreparedTab(preparedWindow)
      if (['cancelled', 'expired'].includes(order.status)) toast.info('本次订单已取消，可重新确认商品后下单')
      else if (order.paymentUrl) toast.info('订单已创建，请在订单详情继续支付')
      else if (['pending', 'creating', 'unknown'].includes(order.paymentState)) toast.info('订单已保存，支付结果确认中，请勿重复兑换')
    }
  } catch {
    cleanupPreparedTab(preparedWindow)
    toast.info('订单已创建，请在订单详情继续支付')
  }
  try {
    await router.replace({ name: 'OrderDetail', params: { id: order.orderNo }, query: { role: 'buyer' } })
    if (userStore.ensureValidSession() && userStore.sessionKey === checkoutSessionKey && router.currentRoute.value.name === 'OrderDetail') {
      if (['cancelled', 'expired', 'paid', 'delivered', 'completed'].includes(order.status) || !['pending', 'creating', 'unknown'].includes(order.paymentState)) submission.complete()
      checkoutStore.clearCheckout(productId.value)
    }
  } catch {
    toast.warning('订单已创建，详情页暂时无法打开，请再次进入订单详情')
  }
}

async function recoverSubmission(retry = false) {
  const result = await submission.recover(retry)
  if (!isCheckoutActive()) return
  if (result.success && ['cancelled', 'expired'].includes(result.data.status)) {
    submission.complete()
    toast.info('原订单已取消，请重新确认后提交')
    await initializeCheckout()
  } else if (result.success) await finishCreatedOrder(result.data)
  else if (!pendingSubmission.value) {
    submissionError.value = result.error || '本单需要重新确认，请核对最新金额。'
    await initializeCheckout()
  }
}

function resolveProductFallback() {
  const draft = checkoutStore.getDraft(productId.value)
  if (draft?.sourceFullPath && draft.sourceFullPath.startsWith(`/product/${productId.value}`)) {
    return draft.sourceFullPath
  }
  return {
    name: 'ProductDetail',
    params: { id: productId.value },
  }
}

function goBack() {
  checkoutStore.markReturnToProduct(productId.value)
  const draft = checkoutStore.getDraft(productId.value)
  const historyBackPath = String(window.history.state?.back || '')
  if (draft?.sourceFullPath && historyBackPath === draft.sourceFullPath) {
    router.back()
    return
  }
  router.replace(resolveProductFallback())
}

onBeforeRouteLeave(to => {
  if (shouldPreserveCheckoutDraft(to, productId.value)) {
    checkoutStore.markReturnToProduct(productId.value)
    return
  }
  checkoutStore.clearCheckout(productId.value)
})

onMounted(initializeCheckout)
onBeforeUnmount(() => {
  checkoutActive = false
  submission.stop()
  if (quoteTimer) window.clearTimeout(quoteTimer)
  latestQuoteRequestId++
})
</script>

<style scoped>
.checkout-page {
  min-height: calc(100dvh - 72px);
  padding: var(--section-gap) var(--page-gutter) 112px;
}

.checkout-shell {
  width: min(100%, 1120px);
  margin: 0 auto;
}

.back-button,
.state-action {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid var(--border-medium);
  border-radius: 13px;
  background: var(--glass-bg);
  color: var(--text-secondary);
  font-weight: 650;
  transition: border-color .2s ease, color .2s ease, background .2s ease;
}

.back-button:hover,
.state-action:hover {
  border-color: var(--border-heavy);
  background: var(--bg-card);
  color: var(--text-primary);
}

.checkout-shell > .back-button {
  margin-bottom: 24px;
}

.checkout-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 22px;
  align-items: start;
}

.checkout-main-column {
  min-width: 0;
  display: grid;
  gap: 18px;
}

.checkout-card,
.receipt-card,
.submission-error {
  border: 1px solid var(--border-light);
  background: var(--glass-bg-heavy);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.checkout-card {
  padding: var(--detail-pad);
  border-radius: var(--card-radius);
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}

.heading-icon {
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--color-primary-light);
  color: var(--color-primary-hover);
}

.section-heading h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 17px;
  line-height: 1.3;
}

.section-heading p {
  margin: 3px 0 0;
  color: var(--text-tertiary);
  font-size: 13px;
}

.product-summary {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  margin-top: 22px;
  padding: 18px;
  border-radius: 18px;
  background: var(--bg-secondary);
}

.product-cover {
  width: 104px;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--border-light);
  border-radius: 16px;
  background: var(--bg-card);
  color: var(--text-tertiary);
}

.product-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-copy {
  min-width: 0;
}

.product-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 8px;
}

.product-type-badge {
  min-height: 26px;
  display: inline-flex;
  align-items: center;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 650;
}

.product-copy h3 {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--text-primary);
  font-size: 19px;
  line-height: 1.4;
}

.seller-name,
.delivery-copy {
  margin: 6px 0 0;
  color: var(--text-tertiary);
  font-size: 13px;
  line-height: 1.5;
}

.delivery-copy {
  color: var(--text-secondary);
}

.unit-price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.unit-price > span {
  color: var(--text-tertiary);
  font-size: 12px;
  text-decoration: line-through;
}

.unit-price strong {
  margin-top: 2px;
  color: var(--text-primary);
  font-size: 18px;
}

.unit-price small {
  color: var(--text-tertiary);
  font-size: 12px;
}

.quantity-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border-light);
}

.quantity-row label {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
}

.quantity-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.quantity-stock {
  display: inline-flex;
  align-items: center;
  padding-left: 10px;
  border-left: 1px solid var(--border-medium);
}

.quantity-row p {
  margin: 4px 0 0;
  color: var(--text-tertiary);
  font-size: 12px;
}

.purchase-limit-equation {
  margin-top: 14px;
  padding: 13px 14px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--border-light));
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-primary) 6%, var(--bg-card));
}

.purchase-limit-equation.reached {
  border-color: color-mix(in srgb, var(--color-danger) 28%, var(--border-light));
  background: color-mix(in srgb, var(--color-danger) 6%, var(--bg-card));
}

.purchase-limit-equation-heading,
.purchase-limit-equation-values {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.purchase-limit-equation-heading {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.purchase-limit-equation-heading strong {
  color: var(--text-primary);
  font-size: 14px;
}

.purchase-limit-equation-values {
  flex-wrap: wrap;
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.purchase-limit-equation-values strong {
  color: var(--text-primary);
}

.purchase-limit-release {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.purchase-limit-equation > a {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  margin-top: 6px;
  color: var(--color-primary-hover);
  font-size: 12px;
  font-weight: 700;
}

.quantity-control {
  height: 46px;
  display: grid;
  grid-template-columns: 44px 58px 44px;
  overflow: hidden;
  border: 1px solid var(--border-medium);
  border-radius: 14px;
  background: var(--bg-card);
}

.quantity-control button {
  min-width: 44px;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  transition: background .15s ease, color .15s ease;
}

.quantity-control button:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.quantity-control button:disabled {
  cursor: not-allowed;
  opacity: .38;
}

.quantity-control input {
  width: 58px;
  border-inline: 1px solid var(--border-light);
  color: var(--text-primary);
  text-align: center;
  font-weight: 750;
  -moz-appearance: textfield;
}

.quantity-control input::-webkit-outer-spin-button,
.quantity-control input::-webkit-inner-spin-button {
  margin: 0;
  -webkit-appearance: none;
}

.order-option-list {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.order-option-row {
  width: 100%;
  min-height: 76px;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto 18px;
  gap: 12px;
  align-items: center;
  padding: 14px 15px;
  border: 1px solid var(--border-light);
  border-radius: 16px;
  background: var(--bg-secondary);
  color: inherit;
  text-align: left;
}

button.order-option-row {
  cursor: pointer;
  transition: border-color .2s ease, background .2s ease, box-shadow .2s ease;
}

button.order-option-row:hover:not(:disabled) {
  border-color: var(--border-heavy);
  background: var(--bg-tertiary);
}

button.order-option-row:disabled {
  cursor: progress;
}

.delivery-option-row {
  grid-template-columns: 38px minmax(0, 1fr);
}

.order-option-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--color-primary-light);
  color: var(--color-primary-hover);
}

.order-option-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.order-option-copy strong {
  overflow-wrap: anywhere;
  color: var(--text-primary);
  font-size: 14px;
}

.order-option-copy small {
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.5;
}

.order-option-saving {
  color: var(--color-danger);
  font-size: 13px;
  font-weight: 750;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.order-option-chevron {
  color: var(--text-tertiary);
}

.coupon-error,
.coupon-selection-notice {
  margin: 0;
  padding: 11px 13px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.55;
}

.coupon-error {
  color: var(--color-warning);
  background: var(--color-warning-bg);
}

.coupon-selection-notice {
  color: var(--color-success);
  background: var(--color-success-bg);
}

.checkout-sidebar {
  min-width: 0;
}

.receipt-card {
  position: sticky;
  top: 92px;
  overflow: hidden;
  padding: 24px;
  border-radius: 22px;
}

.receipt-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 5px;
  background: var(--publish-btn-bg);
}

.receipt-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  color: var(--color-primary-hover);
}

.receipt-heading p {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em;
}

.receipt-heading h2 {
  margin: 3px 0 0;
  color: var(--text-primary);
  font-size: 21px;
}

.receipt-heading > div > span {
  display: block;
  margin-top: 5px;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.4;
}

.receipt-heading-icon {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: var(--color-primary-light);
  color: var(--color-primary-hover);
}

.receipt-lines {
  display: grid;
  gap: 0;
  margin: 20px 0 0;
  padding: 12px 0;
  border-block: 1px dashed var(--border-medium);
}

.receipt-lines div {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  min-height: 38px;
  padding: 8px 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.receipt-lines div + div {
  border-top: 1px solid color-mix(in srgb, var(--border-light) 70%, transparent);
}

.receipt-lines dt {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.receipt-lines dt small,
.receipt-lines dd small {
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 500;
  line-height: 1.4;
}

.receipt-lines dd {
  margin: 0;
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 3px;
  color: var(--text-primary);
  font-weight: 650;
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.receipt-lines dd.saving {
  color: var(--color-danger);
}

.receipt-lines dd .receipt-unit-original {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-size: 12px;
  white-space: nowrap;
}

.receipt-unit-original del {
  text-decoration-line: line-through;
  text-decoration-thickness: 1px;
  text-decoration-color: currentColor;
}

.receipt-unit-current,
.receipt-unit-discounted {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
  white-space: nowrap;
}

.receipt-unit-discounted {
  color: var(--color-danger);
}

.receipt-discount-line dt small {
  max-width: 175px;
}

.receipt-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 14px;
  padding: 16px;
  border-radius: 16px;
  background: var(--color-primary-light);
}

.receipt-total > span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 650;
}

.receipt-total > span small {
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 550;
}

.receipt-total strong {
  color: var(--text-primary);
  font-size: 30px;
  line-height: 1;
  letter-spacing: -.035em;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.receipt-total strong small {
  font-size: 13px;
  letter-spacing: 0;
}

.selected-coupon-note,
.submit-block-message,
.submit-hint {
  margin: 14px 0 0;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.selected-coupon-note {
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.submit-block-message {
  padding: 10px;
  border-radius: 10px;
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.confirm-button {
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border-radius: 14px;
  background: var(--publish-btn-bg);
  box-shadow: var(--publish-btn-shadow);
  color: var(--publish-btn-color);
  font-size: 14px;
  font-weight: 750;
  transition: filter .2s ease, box-shadow .2s ease, transform .15s ease;
}

.confirm-button:hover:not(:disabled) {
  box-shadow: var(--publish-btn-hover-shadow);
  filter: brightness(1.03);
}

.confirm-button:active:not(:disabled) {
  transform: translateY(1px);
}

.confirm-button:disabled {
  cursor: not-allowed;
  opacity: .45;
  box-shadow: none;
}

.desktop-confirm {
  width: 100%;
  margin-top: 20px;
}

.mobile-confirm-bar {
  display: none;
}

.submission-error {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 18px;
  padding: 16px 18px;
  border-color: color-mix(in srgb, var(--color-danger) 32%, var(--border-light));
  border-radius: 16px;
  color: var(--color-danger);
}

.submission-error svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.submission-error strong {
  color: var(--text-primary);
}

.submission-error p {
  margin: 3px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.checkout-loading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 22px;
}

.skeleton {
  border-radius: 22px;
  background: var(--skeleton-gradient);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

.skeleton-product { min-height: 520px; }
.skeleton-receipt { min-height: 390px; }

.spin {
  animation: spin .85s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes shimmer { to { background-position: -200% 0; } }

.back-button:focus-visible,
.state-action:focus-visible,
.quantity-control button:focus-visible,
.quantity-control input:focus-visible,
.coupon-option-row:focus-visible,
.confirm-button:focus-visible {
  outline: 2px solid var(--color-primary-hover);
  outline-offset: 3px;
}

@media (max-width: 767px) {
  .checkout-page {
    padding: 20px 12px calc(126px + env(safe-area-inset-bottom, 0px));
  }

  .checkout-shell > .back-button {
    margin-bottom: 18px;
  }

  .checkout-grid,
  .checkout-loading {
    grid-template-columns: 1fr;
  }

  .checkout-card {
    padding: 18px;
    border-radius: 19px;
  }

  .product-summary {
    grid-template-columns: 82px minmax(0, 1fr);
    padding: 14px;
  }

  .product-cover {
    width: 82px;
  }

  .unit-price {
    grid-column: 2;
    align-items: flex-start;
  }

  .receipt-card {
    position: static;
    width: min(100%, 560px);
    margin-inline: auto;
  }

  .desktop-confirm,
  .receipt-card .submit-hint {
    display: none;
  }

  .mobile-confirm-bar {
    position: fixed;
    z-index: 100;
    right: 0;
    bottom: 0;
    left: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
    border-top: 1px solid var(--border-light);
    background: var(--glass-bg-heavy);
    box-shadow: 0 -10px 30px var(--palette-rgba-0-0-0-p08);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }

  .mobile-confirm-bar > div {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .mobile-confirm-bar > div span {
    color: var(--text-tertiary);
    font-size: 11px;
  }

  .mobile-confirm-bar > div strong {
    color: var(--text-primary);
    font-size: 18px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .mobile-confirm-bar .confirm-button {
    min-width: 148px;
    padding-inline: 18px;
    white-space: nowrap;
  }
}

@media (max-width: 639px) {
  .product-summary {
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 12px;
  }

  .product-cover { width: 72px; }
  .product-copy h3 { font-size: 16px; }
  .delivery-copy { display: none; }

  .quantity-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .quantity-control {
    width: 142px;
    height: 44px;
    align-self: flex-end;
    grid-template-columns: 44px 54px 44px;
    border-radius: 12px;
  }

  .quantity-control input { width: 54px; }

  .coupon-option-row {
    grid-template-columns: 34px minmax(0, 1fr) 18px;
  }

  .order-option-icon {
    width: 34px;
    height: 34px;
  }

  .order-option-saving {
    grid-column: 2;
    justify-self: start;
  }

  .coupon-option-row .order-option-chevron {
    grid-column: 3;
    grid-row: 1 / span 2;
  }

  .mobile-confirm-bar > div strong { font-size: 16px; }
  .mobile-confirm-bar .confirm-button { min-width: 136px; padding-inline: 13px; }
}

@media (prefers-reduced-motion: reduce) {
  .back-button,
  .state-action,
  .order-option-row,
  .confirm-button,
  .quantity-control button,
  .skeleton {
    transition: none;
    animation: none;
  }
}
</style>
