<template>
  <Teleport to="body">
    <Transition name="coupon-picker">
      <div
        v-if="open"
        class="coupon-picker-layer"
        @click.self="cancel"
      >
        <section
          ref="dialogRef"
          class="coupon-picker-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="coupon-picker-title"
          @keydown="handleKeydown"
        >
          <header class="coupon-picker-header">
            <div>
              <p>每笔订单最多使用一张</p>
              <h2 id="coupon-picker-title">选择优惠券</h2>
            </div>
            <button ref="closeButtonRef" type="button" class="coupon-picker-close" aria-label="关闭优惠券选择" @click="cancel">
              <X :size="20" aria-hidden="true" />
            </button>
          </header>

          <div class="coupon-picker-body">
            <div class="coupon-picker-list" role="radiogroup" aria-label="可用优惠券">
              <label :class="['coupon-picker-choice', { selected: pendingClaimId === null }]">
                <input v-model="pendingClaimId" type="radio" name="coupon-picker-choice" :value="null" />
                <span class="coupon-picker-radio" aria-hidden="true"></span>
                <span class="coupon-picker-copy">
                  <strong>不使用优惠券</strong>
                  <small>按物品当前折后价格结算</small>
                </span>
                <span v-if="pendingClaimId === null" class="coupon-picker-selected">
                  <Check :size="16" aria-hidden="true" />
                  已选择
                </span>
              </label>

              <label
                v-for="coupon in coupons"
                :key="coupon.claimId"
                :class="['coupon-picker-choice', { selected: pendingClaimId === coupon.claimId }]"
              >
                <input v-model="pendingClaimId" type="radio" name="coupon-picker-choice" :value="coupon.claimId" />
                <span class="coupon-picker-radio" aria-hidden="true"></span>
                <span class="coupon-picker-copy">
                  <strong>{{ coupon.campaign.name }}</strong>
                  <small>{{ couponRuleText(coupon) }} · {{ couponScopeText(coupon) }}</small>
                  <small>有效期至 {{ formatCouponDate(coupon.campaign.expiresAt) }}</small>
                </span>
                <span class="coupon-picker-saving">减 {{ formatMoney(coupon.couponDiscountAmount) }} LDC</span>
              </label>
            </div>

            <p v-if="!coupons.length" class="coupon-picker-empty">当前没有适用于这件物品的优惠券。</p>

            <details v-if="unavailableCoupons.length" class="coupon-picker-unavailable">
              <summary>查看 {{ unavailableCoupons.length }} 张不可用优惠券</summary>
              <div class="coupon-picker-unavailable-list">
                <div v-for="coupon in unavailableCoupons" :key="coupon.claimId" class="coupon-picker-unavailable-item">
                  <div>
                    <strong>{{ coupon.campaign.name }}</strong>
                    <small>{{ couponRuleText(coupon) }} · {{ couponScopeText(coupon) }}</small>
                  </div>
                  <span>{{ coupon.reason || '当前不可使用' }}</span>
                </div>
              </div>
            </details>
          </div>

          <footer class="coupon-picker-footer">
            <button type="button" class="coupon-picker-cancel" @click="cancel">取消</button>
            <button type="button" class="coupon-picker-confirm" @click="confirmSelection">确认使用</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Check, X } from '@lucide/vue'
import { formatCouponDate, formatCouponRule } from '@/services/shop/couponService'
import { formatPrice } from '@/utils/format'

const props = defineProps({
  open: { type: Boolean, default: false },
  coupons: { type: Array, default: () => [] },
  unavailableCoupons: { type: Array, default: () => [] },
  selectedClaimId: { type: [String, Number], default: null },
})

const emit = defineEmits(['close', 'confirm'])
const dialogRef = ref(null)
const closeButtonRef = ref(null)
const pendingClaimId = ref(null)
let returnFocusElement = null
let previousBodyOverflow = ''

function formatMoney(value) {
  return formatPrice(Number(value) || 0)
}

function couponRuleText(coupon) {
  const base = formatCouponRule(coupon?.campaign)
  return coupon?.campaign?.discountType === 'fixed_amount' ? `${base}（整单一次）` : base
}

function couponScopeText(coupon) {
  return coupon?.campaign?.scopeType === 'product' ? '指定物品券' : '店铺券'
}

function cancel() {
  emit('close')
}

function confirmSelection() {
  emit('confirm', pendingClaimId.value)
}

function getFocusableElements() {
  return Array.from(dialogRef.value?.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])'
  ) || []).filter(element => element.offsetParent !== null)
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
    return
  }
  if (event.key !== 'Tab') return

  const focusable = getFocusableElements()
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function restorePageState() {
  document.body.style.overflow = previousBodyOverflow
  nextTick(() => returnFocusElement?.focus?.())
}

watch(
  () => props.open,
  async open => {
    if (!open) {
      restorePageState()
      return
    }
    pendingClaimId.value = props.selectedClaimId ?? null
    returnFocusElement = document.activeElement
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    await nextTick()
    closeButtonRef.value?.focus()
  }
)

onBeforeUnmount(() => {
  if (props.open) document.body.style.overflow = previousBodyOverflow
})
</script>

<style scoped>
.coupon-picker-layer {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: var(--overlay-bg);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.coupon-picker-dialog {
  width: min(100%, 620px);
  max-height: min(82dvh, 760px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-light);
  border-radius: 24px;
  background: var(--dropdown-bg);
  box-shadow: var(--dropdown-shadow);
}

.coupon-picker-header,
.coupon-picker-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px;
}

.coupon-picker-header {
  border-bottom: 1px solid var(--border-light);
}

.coupon-picker-header p,
.coupon-picker-header h2 {
  margin: 0;
}

.coupon-picker-header p {
  margin-bottom: 3px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.coupon-picker-header h2 {
  color: var(--text-primary);
  font-size: 20px;
}

.coupon-picker-close {
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-light);
  border-radius: 13px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.coupon-picker-body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 18px 22px;
}

.coupon-picker-list,
.coupon-picker-unavailable-list {
  display: grid;
  gap: 10px;
}

.coupon-picker-choice {
  min-height: 82px;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 14px 15px;
  border: 1px solid var(--border-light);
  border-radius: 16px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: border-color .2s ease, background .2s ease, box-shadow .2s ease;
}

.coupon-picker-choice:hover {
  border-color: var(--border-heavy);
}

.coupon-picker-choice.selected {
  border-color: var(--color-primary-hover);
  background: var(--color-primary-light);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 18%, transparent);
}

.coupon-picker-choice input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.coupon-picker-radio {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-heavy);
  border-radius: 50%;
  background: var(--bg-card);
}

.coupon-picker-choice.selected .coupon-picker-radio {
  border: 6px solid var(--color-primary-hover);
}

.coupon-picker-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.coupon-picker-copy strong {
  color: var(--text-primary);
  font-size: 14px;
  overflow-wrap: anywhere;
}

.coupon-picker-copy small {
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.45;
}

.coupon-picker-saving,
.coupon-picker-selected {
  color: var(--color-danger);
  font-size: 13px;
  font-weight: 750;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.coupon-picker-selected {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--color-primary-hover);
}

.coupon-picker-empty {
  margin: 10px 0 0;
  padding: 14px;
  border-radius: 14px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 13px;
}

.coupon-picker-unavailable {
  margin-top: 16px;
  border-top: 1px dashed var(--border-medium);
}

.coupon-picker-unavailable summary {
  min-height: 44px;
  display: flex;
  align-items: center;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.coupon-picker-unavailable-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 13px;
  background: var(--bg-secondary);
  opacity: .72;
}

.coupon-picker-unavailable-item div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.coupon-picker-unavailable-item strong {
  color: var(--text-primary);
  font-size: 13px;
}

.coupon-picker-unavailable-item small,
.coupon-picker-unavailable-item > span {
  color: var(--text-tertiary);
  font-size: 12px;
}

.coupon-picker-unavailable-item > span {
  max-width: 44%;
  text-align: right;
}

.coupon-picker-footer {
  justify-content: flex-end;
  border-top: 1px solid var(--border-light);
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
}

.coupon-picker-cancel,
.coupon-picker-confirm {
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  border-radius: 13px;
  font-weight: 700;
}

.coupon-picker-cancel {
  border: 1px solid var(--border-medium);
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.coupon-picker-confirm {
  min-width: 150px;
  background: var(--publish-btn-bg);
  box-shadow: var(--publish-btn-shadow);
  color: var(--publish-btn-color);
}

.coupon-picker-close:focus-visible,
.coupon-picker-choice:has(input:focus-visible),
.coupon-picker-unavailable summary:focus-visible,
.coupon-picker-cancel:focus-visible,
.coupon-picker-confirm:focus-visible {
  outline: 2px solid var(--color-primary-hover);
  outline-offset: 3px;
}

.coupon-picker-enter-active,
.coupon-picker-leave-active {
  transition: opacity .18s ease;
}

.coupon-picker-enter-active .coupon-picker-dialog,
.coupon-picker-leave-active .coupon-picker-dialog {
  transition: transform .22s ease, opacity .18s ease;
}

.coupon-picker-enter-from,
.coupon-picker-leave-to {
  opacity: 0;
}

.coupon-picker-enter-from .coupon-picker-dialog,
.coupon-picker-leave-to .coupon-picker-dialog {
  opacity: 0;
  transform: translateY(12px) scale(.985);
}

@media (max-width: 639px) {
  .coupon-picker-layer {
    place-items: end stretch;
    padding: 0;
  }

  .coupon-picker-dialog {
    width: 100%;
    max-height: 86dvh;
    border-radius: 24px 24px 0 0;
  }

  .coupon-picker-header,
  .coupon-picker-footer {
    padding-inline: 16px;
  }

  .coupon-picker-body {
    padding-inline: 14px;
  }

  .coupon-picker-choice {
    grid-template-columns: 20px minmax(0, 1fr);
  }

  .coupon-picker-saving,
  .coupon-picker-selected {
    grid-column: 2;
    justify-self: start;
  }

  .coupon-picker-footer {
    display: grid;
    grid-template-columns: minmax(0, .7fr) minmax(0, 1.3fr);
  }

  .coupon-picker-confirm {
    min-width: 0;
  }

  .coupon-picker-unavailable-item {
    flex-direction: column;
    gap: 6px;
  }

  .coupon-picker-unavailable-item > span {
    max-width: none;
    text-align: left;
  }
}

@media (prefers-reduced-motion: reduce) {
  .coupon-picker-layer,
  .coupon-picker-dialog,
  .coupon-picker-choice {
    transition: none;
  }
}
</style>
