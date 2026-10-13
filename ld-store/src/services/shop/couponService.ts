import { api, type JsonValue } from '@/utils/api'
import { merchantProfilePath } from '@/utils/merchantIdentity'
import {
  CouponCampaignSchema,
  CouponClaimResponseSchema,
  CouponListResponseSchema,
  OrderQuoteResponseSchema,
  PublicCouponResponseSchema
} from '@/contracts/commerce'
import { validateServiceResult } from '@/services/serviceContract'

type QueryParams = Record<string, string | number | boolean | null | undefined>

function buildQuery(params: QueryParams = {}): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export async function getCouponRequest(token: string) {
  return validateServiceResult(
    await api.get(`/api/shop/coupons/${encodeURIComponent(token)}`, { auth: 'optional' }),
    PublicCouponResponseSchema,
    '/api/shop/coupons/:token',
    'PublicCouponResponse'
  )
}

export async function claimCouponRequest(token: string) {
  return validateServiceResult(
    await api.post(`/api/shop/coupons/${encodeURIComponent(token)}/claim`, undefined, { auth: 'required' }),
    CouponClaimResponseSchema,
    '/api/shop/coupons/:token/claim',
    'CouponClaimResponse'
  )
}

export async function fetchMyCouponsRequest(status = 'unused', page = 1, pageSize = 20) {
  return validateServiceResult(
    await api.get(`/api/shop/my-coupons${buildQuery({ status, page, pageSize })}`, { auth: 'required' }),
    CouponListResponseSchema,
    '/api/shop/my-coupons',
    'CouponListResponse'
  )
}

export async function quoteOrderRequest(productId: string | number, quantity = 1) {
  return validateServiceResult(
    await api.post('/api/shop/orders/quote', { productId, quantity }, { auth: 'required' }),
    OrderQuoteResponseSchema,
    '/api/shop/orders/quote',
    'OrderQuoteResponse'
  )
}

export async function fetchSellerCouponsRequest(params: QueryParams = {}) {
  return validateServiceResult(
    await api.get(`/api/shop/merchant/coupons${buildQuery(params)}`, { auth: 'required' }),
    CouponListResponseSchema,
    '/api/shop/merchant/coupons',
    'CouponListResponse'
  )
}

export async function getSellerCouponRequest(id: string | number) {
  return validateServiceResult(
    await api.get(`/api/shop/merchant/coupons/${id}`, { auth: 'required' }),
    CouponCampaignSchema,
    '/api/shop/merchant/coupons/:id',
    'CouponCampaign'
  )
}

export async function fetchSellerCouponClaimsRequest(id: string | number, params: QueryParams = {}) {
  return validateServiceResult(
    await api.get(`/api/shop/merchant/coupons/${id}/claims${buildQuery(params)}`, { auth: 'required' }),
    CouponListResponseSchema,
    '/api/shop/merchant/coupons/:id/claims',
    'CouponClaimListResponse'
  )
}

export async function createCouponRequest(data: Record<string, JsonValue>) {
  return validateServiceResult(
    await api.post('/api/shop/merchant/coupons', data, { auth: 'required' }),
    CouponCampaignSchema,
    '/api/shop/merchant/coupons',
    'CouponCampaign'
  )
}

export async function increaseCouponQuotaRequest(id: string | number, totalQuantity: number) {
  return validateServiceResult(
    await api.request(`/api/shop/merchant/coupons/${id}/quota`, { auth: 'required', method: 'PATCH', body: { totalQuantity } }),
    CouponCampaignSchema,
    '/api/shop/merchant/coupons/:id/quota',
    'CouponCampaign'
  )
}

export async function closeCouponRequest(id: string | number) {
  return validateServiceResult(
    await api.post(`/api/shop/merchant/coupons/${id}/close`, undefined, { auth: 'required' }),
    CouponCampaignSchema,
    '/api/shop/merchant/coupons/:id/close',
    'CouponCampaign'
  )
}

export async function setCouponClaimingRequest(id: string | number, enabled: boolean) {
  return validateServiceResult(
    await api.request(`/api/shop/merchant/coupons/${id}/claiming`, {
      auth: 'required',
      method: 'PATCH',
      body: { enabled: Boolean(enabled) }
    }),
    CouponCampaignSchema,
    '/api/shop/merchant/coupons/:id/claiming',
    'CouponCampaign'
  )
}

export function formatCouponRule(campaign: Record<string, unknown> = {}): string {
  if (campaign.discountType === 'fixed_amount') {
    return `减 ${Number(campaign.fixedAmount || 0).toFixed(2)} LDC`
  }
  const bps = Number(campaign.percentageBps || 0)
  return `${(bps / 1000).toFixed(bps % 1000 === 0 ? 0 : 1)} 折 · 仅优惠 1 件`
}

export function formatCouponDate(value: unknown): string {
  if (!value) return '—'
  const date = new Date(value as string | number | Date)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date).replaceAll('/', '-')
}

export function getCouponUsePath(campaign: Record<string, unknown> = {}): string {
  if (campaign.scopeType === 'product' && campaign.productId) return `/product/${campaign.productId}`
  return merchantProfilePath({ username: campaign.sellerUsername, site: campaign.sellerSite, userId: campaign.sellerUserId }) || '/'
}
