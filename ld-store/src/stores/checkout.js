import { normalizeResourceId } from '@/utils/resourceId'
import { useSessionScope } from '@/composables/useSessionScope'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { normalizeCouponSelectionMode } from '@/utils/checkoutCoupon'
import { CHECKOUT_QUANTITY_PLATFORM_MAXIMUM } from '@/utils/checkoutQuantity'

export const ORDER_CONFIRM_DRAFT_KEY = 'ld-store-order-confirm-draft'
export const ORDER_CONFIRM_DRAFT_TTL_MS = 30 * 60 * 1000

export function shouldPreserveCheckoutDraft(to, productId) {
  const currentProductId = normalizeResourceId(productId)
  return String(to?.name || '') === 'ProductDetail'
    && !!currentProductId
    && normalizeResourceId(to?.params?.id) === currentProductId
}

function getSessionStorage() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function toPositiveInt(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback
  return parsed
}

function toCheckoutQuantity(value, fallback = 1) {
  return Math.min(toPositiveInt(value, fallback), CHECKOUT_QUANTITY_PLATFORM_MAXIMUM)
}

function normalizeCouponClaimId(value) {
  if (value === null || value === undefined || value === '') return null
  return normalizeResourceId(value) || null
}

export function normalizeOrderConfirmDraft(value) {
  if (!value || typeof value !== 'object') return null

  const productId = normalizeResourceId(value.productId)
  if (!productId) return null

  const updatedAt = Number(value.updatedAt || 0)
  if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > ORDER_CONFIRM_DRAFT_TTL_MS) {
    return null
  }

  const couponClaimId = normalizeCouponClaimId(value.couponClaimId)
  return {
    productId,
    quantity: toCheckoutQuantity(value.quantity, 1),
    couponClaimId,
    couponSelectionMode: normalizeCouponSelectionMode(value.couponSelectionMode, couponClaimId),
    sourceFullPath: String(value.sourceFullPath || ''),
    sourceScrollY: Math.max(0, Number(value.sourceScrollY) || 0),
    restoreOnReturn: value.restoreOnReturn === true,
    updatedAt,
  }
}

export function readStoredOrderConfirmDraft(storage = getSessionStorage()) {
  if (!storage) return null
  try {
    const draft = normalizeOrderConfirmDraft(JSON.parse(storage.getItem(ORDER_CONFIRM_DRAFT_KEY) || 'null'))
    if (!draft) storage.removeItem(ORDER_CONFIRM_DRAFT_KEY)
    return draft
  } catch {
    try { storage.removeItem(ORDER_CONFIRM_DRAFT_KEY) } catch { /* ignore storage failures */ }
    return null
  }
}

function persistDraft(draft, storage = getSessionStorage()) {
  if (!storage) return
  try {
    if (draft) storage.setItem(ORDER_CONFIRM_DRAFT_KEY, JSON.stringify(draft))
    else storage.removeItem(ORDER_CONFIRM_DRAFT_KEY)
  } catch {
    // Session storage is an enhancement; navigation must keep working without it.
  }
}

export const useCheckoutStore = defineStore('checkout', () => {
  const draft = ref(readStoredOrderConfirmDraft())
  useSessionScope(() => clearCheckout())

  function getDraft(productId = null) {
    const current = normalizeOrderConfirmDraft(draft.value)
    if (!current) {
      draft.value = null
      persistDraft(null)
      return null
    }
    if (productId !== null && current.productId !== normalizeResourceId(productId)) return null
    return current
  }

  function setDraft(nextDraft) {
    const currentProductId = normalizeResourceId(nextDraft?.productId)
    if (!currentProductId) return null

    const current = getDraft(currentProductId)
    const couponClaimId = normalizeCouponClaimId(
      Object.prototype.hasOwnProperty.call(nextDraft, 'couponClaimId')
        ? nextDraft.couponClaimId
        : current?.couponClaimId
    )
    const normalized = {
      productId: currentProductId,
      quantity: toCheckoutQuantity(nextDraft.quantity ?? current?.quantity, 1),
      couponClaimId,
      couponSelectionMode: normalizeCouponSelectionMode(
        nextDraft.couponSelectionMode ?? current?.couponSelectionMode,
        couponClaimId
      ),
      sourceFullPath: String(nextDraft.sourceFullPath ?? current?.sourceFullPath ?? ''),
      sourceScrollY: Math.max(0, Number(nextDraft.sourceScrollY ?? current?.sourceScrollY) || 0),
      restoreOnReturn: nextDraft.restoreOnReturn ?? current?.restoreOnReturn ?? false,
      updatedAt: Date.now(),
    }

    draft.value = normalized
    persistDraft(normalized)
    return normalized
  }

  function startCheckout({ productId, quantity, sourceFullPath = '', sourceScrollY = 0 }) {
    const normalizedProductId = normalizeResourceId(productId)
    if (!normalizedProductId) return null

    const activeDraft = getDraft()
    const switchesProduct = Boolean(activeDraft && activeDraft.productId !== normalizedProductId)
    const current = switchesProduct ? null : activeDraft
    return setDraft({
      productId: normalizedProductId,
      // A checkout draft belongs to one product. Never let a quantity supplied by
      // a stale caller become the starting quantity of another product.
      quantity: switchesProduct ? 1 : quantity,
      couponClaimId: current?.couponClaimId ?? null,
      couponSelectionMode: current?.couponSelectionMode ?? 'auto',
      sourceFullPath: sourceFullPath || current?.sourceFullPath || '',
      sourceScrollY,
      restoreOnReturn: false,
    })
  }

  function updateCheckout(productId, changes = {}) {
    const current = getDraft(productId)
    return setDraft({
      productId,
      quantity: current?.quantity ?? 1,
      couponClaimId: current?.couponClaimId ?? null,
      couponSelectionMode: current?.couponSelectionMode ?? 'auto',
      sourceFullPath: current?.sourceFullPath ?? '',
      sourceScrollY: current?.sourceScrollY ?? 0,
      restoreOnReturn: current?.restoreOnReturn ?? false,
      ...changes,
    })
  }

  function markReturnToProduct(productId) {
    return updateCheckout(productId, { restoreOnReturn: true })
  }

  function consumeProductReturn(productId) {
    const current = getDraft(productId)
    if (!current?.restoreOnReturn) return null
    updateCheckout(productId, { restoreOnReturn: false })
    return current
  }

  function clearCheckout(productId = null) {
    if (productId !== null && getDraft(productId) === null) return
    draft.value = null
    persistDraft(null)
  }

  return {
    draft,
    getDraft,
    startCheckout,
    updateCheckout,
    markReturnToProduct,
    consumeProductReturn,
    clearCheckout,
  }
})
