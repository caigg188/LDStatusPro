import type { ApiResult } from '@/utils/api'
import type { ProductEditorProductType, ProductUpdatePayload } from '@/contracts/commerce'

export interface ReconciliationResult<T> {
  confirmed: boolean
  value: T | null
}

export interface ReconciliationOptions {
  retries: number
  intervalMs: number
  wait?: (milliseconds: number) => Promise<void>
}

type UnknownRecord = Record<string, unknown>

const defaultWait = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds))

export function isUncertainMutationResult(result: ApiResult<unknown>): boolean {
  if (result.success || result.errorCode === 'SESSION_CHANGED') return false
  if (result.status === 0 || result.kind === 'network' || result.kind === 'abort') return true
  const message = result.error.toLowerCase()
  return ['超时', '网络', 'failed to fetch', 'network', 'abort'].some(value => message.includes(value))
}

export async function reconcileByPolling<T>(
  lookup: () => Promise<T | null>,
  matches: (value: T) => boolean,
  options: ReconciliationOptions
): Promise<ReconciliationResult<T>> {
  const wait = options.wait ?? defaultWait
  for (let attempt = 0; attempt < options.retries; attempt += 1) {
    const value = await lookup()
    if (value !== null && matches(value)) return { confirmed: true, value }
    if (attempt < options.retries - 1) await wait(options.intervalMs)
  }
  return { confirmed: false, value: null }
}

function numberEquals(first: unknown, second: unknown, epsilon = 1e-8): boolean {
  return Math.abs(Number(first || 0) - Number(second || 0)) <= epsilon
}

export function hasExpectedProductState(
  product: UnknownRecord | null,
  expected: ProductUpdatePayload,
  productType: ProductEditorProductType
): boolean {
  if (!product) return false
  const limitConfig = (product.purchase_limit_config || product.purchaseLimitConfig || {}) as UnknownRecord
  const pairs: Array<[unknown, unknown]> = [
    [product.name, expected.name],
    [product.description, expected.description],
    [product.image_url || product.imageUrl, expected.imageUrl]
  ]
  if (pairs.some(([actual, target]) => String(actual || '').trim() !== String(target || '').trim())) return false
  if (Number(product.category_id || product.categoryId || 0) !== Number(expected.categoryId || 0)) return false
  if (!numberEquals(product.price, expected.price) || !numberEquals(product.discount || 1, expected.discount || 1)) return false
  if (productType === 'normal' && Number(product.stock || 0) !== Number(expected.stock || 0)) return false
  if (Number(product.purchase_trust_level ?? product.purchaseTrustLevel ?? 0) !== Number(expected.purchaseTrustLevel || 0)) return false
  if (String(limitConfig.mode || product.purchase_limit_type || product.purchaseLimitType || 'none') !== expected.purchaseLimitType) return false
  if (Number(limitConfig.quantity ?? product.max_purchase_quantity ?? product.maxPurchaseQuantity ?? 0) !== Number(expected.maxPurchaseQuantity || 0)) return false
  if (Number(limitConfig.periodDays ?? limitConfig.period_days ?? product.purchase_limit_period_days ?? product.purchaseLimitPeriodDays ?? 0) !== Number(expected.purchaseLimitPeriodDays || 0)) return false

  if (productType === 'cdk') {
    const shared = Boolean(product.sharedCdkEnabled || Number(product.shared_cdk_enabled || 0) === 1)
    if (shared !== Boolean(expected.sharedCdkEnabled)) return false
    if (String(product.shared_cdk_code || product.sharedCdkCode || '') !== String(expected.sharedCdkCode || '')) return false
    if (expected.isTestMode !== undefined && Boolean(product.is_test_mode || product.isTestMode) !== expected.isTestMode) return false
  }
  return true
}

export function createSubmissionToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `pub_${crypto.randomUUID().replace(/-/g, '')}`
  }
  return `pub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`
}
