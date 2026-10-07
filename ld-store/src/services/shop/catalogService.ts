import { api, type ApiFailure, type ApiResult, type JsonValue } from '@/utils/api'
import { validateApiResult } from '@/contracts/apiContract'
import {
  ActionAcknowledgementSchema,
  CategoriesResponseSchema,
  CommentCreatedResponseSchema,
  CommentRepliesResponseSchema,
  CommentReplyCreatedResponseSchema,
  CommentVoteResponseSchema,
  ProductCollectionResponseSchema,
  ProductCommentsResponseSchema,
  ProductDetailResponseSchema,
  ProductListCoreResponseSchema,
  ProductReportCreatedResponseSchema,
  ProductReportDetailResponseSchema,
  ProductReportsResponseSchema,
  PublicStatsResponseSchema,
  RestockSubscriptionResponseSchema,
  RankingContextSchema,
  UserDashboardResponseSchema,
  UserAttentionResponseSchema,
  MerchantProfileResponseSchema,
  type ProductListResponse
} from '@/contracts/catalog'
import { beginCatalogRotation, rememberCatalogSlate } from '@/utils/catalogRotation'
import { ExternalProductLinkResponseSchema } from '@/contracts/commerce'

export const productSortMapping: Record<string, { sortBy: string; sortOrder: 'ASC' | 'DESC' }> = {
  default: { sortBy: 'updated_at', sortOrder: 'DESC' },
  newest: { sortBy: 'created_at', sortOrder: 'DESC' },
  price_asc: { sortBy: 'final_price', sortOrder: 'ASC' },
  price_desc: { sortBy: 'final_price', sortOrder: 'DESC' },
  sales: { sortBy: 'sold_count', sortOrder: 'DESC' }
}

interface CatalogListOptions {
  page?: number
  pageSize?: number
  categoryId?: string | number
  sort?: string
  inStockOnly?: boolean
  priceMin?: string | number | null
  priceMax?: string | number | null
  search?: string
  cursor?: string
  cursorRetry?: boolean
  rotationId?: string
  previousSlateId?: string
  rankingContext?: unknown
  signal?: AbortSignal
}

interface PagedRequestOptions {
  page?: number
  pageSize?: number
  status?: string
  signal?: AbortSignal
}

interface ProductReportPayload {
  reason?: string
  reportCategory?: string
  report_category?: string
}

interface ProductCommentPayload {
  content?: string
  rating?: string | number | null
}

function getPositiveInt(value: unknown, fallback: number, min = 1, max = Number.POSITIVE_INFINITY): number {
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

function toRequestError(error: unknown, fallback: string): ApiFailure {
  return {
    success: false,
    status: 0,
    error: error instanceof Error ? error.message || fallback : fallback,
    aborted: false,
    kind: 'network'
  }
}

function validateProductListResult(result: ApiResult<unknown>): ApiResult<ProductListResponse> {
  const coreResult = validateApiResult(
    result,
    ProductListCoreResponseSchema,
    { endpoint: '/api/shop/products', schemaName: 'ProductListResponse' }
  )
  if (!coreResult.success || coreResult.data.rankingContext === undefined) {
    return coreResult as ApiResult<ProductListResponse>
  }

  const rankingResult = validateApiResult(
    { success: true, status: coreResult.status, data: coreResult.data.rankingContext },
    RankingContextSchema,
    { endpoint: '/api/shop/products', schemaName: 'RankingContext' }
  )
  if (!rankingResult.success) {
    const data = { ...coreResult.data }
    delete data.rankingContext
    return { ...coreResult, data } as ApiResult<ProductListResponse>
  }

  return {
    ...coreResult,
    data: { ...coreResult.data, rankingContext: rankingResult.data }
  } as ApiResult<ProductListResponse>
}

export async function fetchCategoriesRequest() {
  return validateApiResult(
    await api.get('/api/shop/categories', { auth: 'optional' }),
    CategoriesResponseSchema,
    { endpoint: '/api/shop/categories', schemaName: 'CategoriesResponse' }
  )
}

export async function fetchProductsRequest(options: CatalogListOptions = {}): Promise<ApiResult<ProductListResponse>> {
  const params = new URLSearchParams()
  const {
    page = 1,
    pageSize = 20,
    categoryId = '',
    sort = 'default',
    inStockOnly = false,
    priceMin = null,
    priceMax = null,
    search = '',
    cursor = '',
    cursorRetry = true
  } = options

  if (!cursor) params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  if (cursor) params.set('cursor', String(cursor))

  const safeCategoryId = String(categoryId || '').trim()
  if (safeCategoryId) {
    params.set('categoryId', safeCategoryId)
  }

  const safeSearch = String(search || '').trim()
  if (safeSearch) {
    params.set('search', safeSearch)
  }

  const sortConfig = productSortMapping[sort] || productSortMapping.default
  if (sort !== 'default') {
    params.set('sortBy', sortConfig.sortBy)
    params.set('sortOrder', sortConfig.sortOrder)
  }
  if (sort === 'default' || safeSearch) params.set('ranking', 'auto')
  const rotating = sort === 'default' && !safeSearch && !cursor && Number(page) === 1
  if (rotating) {
    const rotation = options.rotationId ? options : beginCatalogRotation(options)
    if (rotation.rotationId) params.set('rotationId', rotation.rotationId)
    if (rotation.previousSlateId) params.set('previousSlateId', rotation.previousSlateId)
  }

  if (inStockOnly) {
    params.set('inStock', 'true')
  }

  if (priceMin !== null && priceMin !== undefined && String(priceMin).trim() !== '') {
    params.set('priceMin', String(priceMin))
  }

  if (priceMax !== null && priceMax !== undefined && String(priceMax).trim() !== '') {
    params.set('priceMax', String(priceMax))
  }

  const result = validateProductListResult(
    await api.get(`/api/shop/products?${params.toString()}`, { auth: 'optional', signal: options.signal })
  )
  if (rotating && result?.success) rememberCatalogSlate(options, result.data?.rankingContext?.slateId)
  if (cursor && cursorRetry && result?.status === 409 && result?.errorCode === 'RANKING_CURSOR_STALE') {
    const restarted = await fetchProductsRequest({ ...options, cursor: '', page: 1, cursorRetry: false })
    if (restarted?.success && restarted.data) {
      return { ...restarted, data: { ...restarted.data, cursorRestarted: true } }
    }
    return restarted
  }
  return result
}

export async function fetchProductRequest(id: string | number) {
  return validateApiResult(
    await api.get(`/api/shop/products/${id}`, { auth: 'optional' }),
    ProductDetailResponseSchema,
    { endpoint: '/api/shop/products/:id', schemaName: 'ProductDetailResponse' }
  )
}

export async function fetchExternalProductLinkRequest(id: string | number) {
  return validateApiResult(
    await api.get(`/api/shop/products/${encodeURIComponent(String(id))}/external-link`, { auth: 'optional' }),
    ExternalProductLinkResponseSchema,
    { endpoint: '/api/shop/products/:id/external-link', schemaName: 'ExternalProductLinkResponse' }
  )
}

export async function fetchMerchantProfileRequest(username: string) {
  const safeUsername = String(username || '').trim()
  if (!safeUsername) {
    return toRequestError(undefined, '商家用户名无效')
  }

  try {
    return validateApiResult(
      await api.get(`/api/shop/merchants/${encodeURIComponent(safeUsername)}`, { auth: 'optional' }),
      MerchantProfileResponseSchema,
      { endpoint: '/api/shop/merchants/:username', schemaName: 'MerchantProfileResponse' }
    )
  } catch (error) {
    return toRequestError(error, '加载商家主页失败，请稍后重试')
  }
}

export async function reportProductRequest(id: string | number, payload: string | ProductReportPayload = {}) {
  const requestPayload = typeof payload === 'string'
    ? { reason: payload }
    : {
        reason: String(payload?.reason || ''),
        reportCategory: String(payload?.reportCategory || payload?.report_category || '')
      }
  try {
    return validateApiResult(
      await api.post(`/api/shop/products/${id}/report`, requestPayload as JsonValue, { auth: 'required' }),
      ProductReportCreatedResponseSchema,
      { endpoint: '/api/shop/products/:id/report', schemaName: 'ProductReportCreatedResponse' }
    )
  } catch (error) {
    return toRequestError(error, '举报商品失败，请稍后重试')
  }
}

export async function fetchMyReportsRequest(options: PagedRequestOptions = {}) {
  const page = getPositiveInt(options.page, 1)
  const pageSize = getPositiveInt(options.pageSize, 20, 1, 50)
  const status = String(options.status || '').trim()
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (status) params.set('status', status)

  try {
    return validateApiResult(
      await api.get(`/api/shop/my-reports?${params.toString()}`, { auth: 'required' }),
      ProductReportsResponseSchema,
      { endpoint: '/api/shop/my-reports', schemaName: 'ProductReportsResponse' }
    )
  } catch (error) {
    return toRequestError(error, '加载我的举报失败，请稍后重试')
  }
}

export async function fetchMyReportDetailRequest(reportId: string | number) {
  try {
    return validateApiResult(
      await api.get(`/api/shop/my-reports/${reportId}`, { auth: 'required' }),
      ProductReportDetailResponseSchema,
      { endpoint: '/api/shop/my-reports/:id', schemaName: 'ProductReportDetailResponse' }
    )
  } catch (error) {
    return toRequestError(error, '加载举报详情失败，请稍后重试')
  }
}

export async function fetchProductCommentsRequest(productId: string | number, options: PagedRequestOptions = {}) {
  const page = getPositiveInt(options.page, 1)
  const pageSize = getPositiveInt(options.pageSize, 10, 1, 10)

  try {
    return validateApiResult(
      await api.get(`/api/shop/products/${productId}/comments?page=${page}&pageSize=${pageSize}`, { auth: 'optional', signal: options.signal }),
      ProductCommentsResponseSchema,
      { endpoint: '/api/shop/products/:id/comments', schemaName: 'ProductCommentsResponse' }
    )
  } catch (error) {
    return toRequestError(error, '加载评论失败，请稍后重试')
  }
}

export async function createProductCommentRequest(productId: string | number, payload: string | ProductCommentPayload = {}) {
  const requestPayload = typeof payload === 'string'
    ? { content: payload }
    : {
        content: String(payload?.content || ''),
        ...(payload?.rating === null || payload?.rating === undefined || payload?.rating === ''
          ? {}
          : { rating: payload.rating })
      }
  try {
    return validateApiResult(
      await api.post(`/api/shop/products/${productId}/comments`, requestPayload, { auth: 'required' }),
      CommentCreatedResponseSchema,
      { endpoint: '/api/shop/products/:id/comments', schemaName: 'CommentCreatedResponse' }
    )
  } catch (error) {
    return toRequestError(error, '发布评论失败，请稍后重试')
  }
}

export async function deleteProductCommentRequest(commentId: string | number) {
  try {
    return validateApiResult(
      await api.delete(`/api/shop/comments/${commentId}`, { auth: 'required' }),
      ActionAcknowledgementSchema,
      { endpoint: '/api/shop/comments/:id', schemaName: 'ActionAcknowledgement' }
    )
  } catch (error) {
    return toRequestError(error, '删除评论失败，请稍后重试')
  }
}

export async function reportProductCommentRequest(commentId: string | number, reason: string) {
  try {
    return validateApiResult(
      await api.post(`/api/shop/comments/${commentId}/report`, { reason }, { auth: 'required' }),
      ProductReportCreatedResponseSchema,
      { endpoint: '/api/shop/comments/:id/report', schemaName: 'CommentReportCreatedResponse' }
    )
  } catch (error) {
    return toRequestError(error, '举报评论失败，请稍后重试')
  }
}

export async function voteProductCommentRequest(commentId: string | number, voteType = '') {
  try {
    return validateApiResult(
      await api.post(`/api/shop/comments/${commentId}/vote`, { voteType }, { auth: 'required' }),
      CommentVoteResponseSchema,
      { endpoint: '/api/shop/comments/:id/vote', schemaName: 'CommentVoteResponse' }
    )
  } catch (error) {
    return toRequestError(error, '评论投票失败，请稍后重试')
  }
}

export async function fetchProductCommentRepliesRequest(commentId: string | number, options: PagedRequestOptions = {}) {
  const page = getPositiveInt(options.page, 1)
  const pageSize = getPositiveInt(options.pageSize, 10, 1, 20)

  try {
    return validateApiResult(
      await api.get(`/api/shop/comments/${commentId}/replies?page=${page}&pageSize=${pageSize}`, { auth: 'optional', signal: options.signal }),
      CommentRepliesResponseSchema,
      { endpoint: '/api/shop/comments/:id/replies', schemaName: 'CommentRepliesResponse' }
    )
  } catch (error) {
    return toRequestError(error, '加载评论回复失败，请稍后重试')
  }
}

export async function createProductCommentReplyRequest(commentId: string | number, content: string) {
  try {
    return validateApiResult(
      await api.post(`/api/shop/comments/${commentId}/replies`, { content }, { auth: 'required' }),
      CommentReplyCreatedResponseSchema,
      { endpoint: '/api/shop/comments/:id/replies', schemaName: 'CommentReplyCreatedResponse' }
    )
  } catch (error) {
    return toRequestError(error, '发布回复失败，请稍后重试')
  }
}

export async function addFavoriteRequest(productId: string | number) {
  try {
    return validateApiResult(
      await api.post(`/api/shop/products/${productId}/favorite`, undefined, { auth: 'required' }),
      ActionAcknowledgementSchema,
      { endpoint: '/api/shop/products/:id/favorite', schemaName: 'ActionAcknowledgement' }
    )
  } catch (error) {
    return toRequestError(error, '收藏商品失败，请稍后重试')
  }
}

export async function removeFavoriteRequest(productId: string | number) {
  try {
    return validateApiResult(
      await api.delete(`/api/shop/products/${productId}/favorite`, { auth: 'required' }),
      ActionAcknowledgementSchema,
      { endpoint: '/api/shop/products/:id/favorite', schemaName: 'ActionAcknowledgement' }
    )
  } catch (error) {
    return toRequestError(error, '取消收藏失败，请稍后重试')
  }
}

export async function blockProductRequest(productId: string | number) {
  try {
    return validateApiResult(
      await api.post(`/api/shop/products/${productId}/block`, undefined, { auth: 'required' }),
      ActionAcknowledgementSchema,
      { endpoint: '/api/shop/products/:id/block', schemaName: 'ActionAcknowledgement' }
    )
  } catch (error) {
    return toRequestError(error, '设置不感兴趣失败，请稍后重试')
  }
}

export async function unblockProductRequest(productId: string | number) {
  try {
    return validateApiResult(
      await api.delete(`/api/shop/products/${productId}/block`, { auth: 'required' }),
      ActionAcknowledgementSchema,
      { endpoint: '/api/shop/products/:id/block', schemaName: 'ActionAcknowledgement' }
    )
  } catch (error) {
    return toRequestError(error, '恢复商品展示失败，请稍后重试')
  }
}

export async function getProductRestockSubscriptionStatusRequest(productId: string | number) {
  try {
    return validateApiResult(
      await api.get(`/api/shop/products/${productId}/restock-subscription`, { auth: 'required' }),
      RestockSubscriptionResponseSchema,
      { endpoint: '/api/shop/products/:id/restock-subscription', schemaName: 'RestockSubscriptionResponse' }
    )
  } catch (error) {
    return toRequestError(error, '获取补货订阅状态失败，请稍后重试')
  }
}

export async function subscribeProductRestockRequest(productId: string | number) {
  try {
    return validateApiResult(
      await api.post(`/api/shop/products/${productId}/restock-subscription`, undefined, { auth: 'required' }),
      RestockSubscriptionResponseSchema,
      { endpoint: '/api/shop/products/:id/restock-subscription', schemaName: 'RestockSubscriptionResponse' }
    )
  } catch (error) {
    return toRequestError(error, '订阅补货提醒失败，请稍后重试')
  }
}

export function normalizeFavoritesOptions(options: PagedRequestOptions & { search?: string } = {}) {
  const page = getPositiveInt(options.page, 1)
  const pageSize = getPositiveInt(options.pageSize, 20, 1, 50)
  const search = String(options.search || '').trim()

  return { page, pageSize, search }
}

export async function fetchFavoritesRequest(options: PagedRequestOptions & { search?: string } = {}) {
  const normalized = normalizeFavoritesOptions(options)
  const params = new URLSearchParams()
  params.set('page', String(normalized.page))
  params.set('pageSize', String(normalized.pageSize))
  if (normalized.search) {
    params.set('search', normalized.search)
  }

  return validateApiResult(
    await api.get(`/api/shop/favorites?${params.toString()}`, { auth: 'required' }),
    ProductCollectionResponseSchema,
    { endpoint: '/api/shop/favorites', schemaName: 'ProductCollectionResponse' }
  )
}

export async function fetchBlockedProductsRequest(options: PagedRequestOptions & { search?: string } = {}) {
  const normalized = normalizeFavoritesOptions(options)
  const params = new URLSearchParams()
  params.set('page', String(normalized.page))
  params.set('pageSize', String(normalized.pageSize))
  if (normalized.search) {
    params.set('search', normalized.search)
  }

  return validateApiResult(
    await api.get(`/api/shop/blocked-products?${params.toString()}`, { auth: 'required' }),
    ProductCollectionResponseSchema,
    { endpoint: '/api/shop/blocked-products', schemaName: 'ProductCollectionResponse' }
  )
}

export async function fetchPublicStatsRequest() {
  return validateApiResult(
    await api.get('/api/shop/stats', { auth: 'none' }),
    PublicStatsResponseSchema,
    { endpoint: '/api/shop/stats', schemaName: 'PublicStatsResponse' }
  )
}

export async function fetchUserDashboardRequest() {
  return validateApiResult(
    await api.get('/api/shop/user/dashboard', { auth: 'required' }),
    UserDashboardResponseSchema,
    { endpoint: '/api/shop/user/dashboard', schemaName: 'UserDashboardResponse' }
  )
}

export async function fetchUserAttentionRequest() {
  return validateApiResult(
    await api.get('/api/shop/user/attention', { auth: 'required' }),
    UserAttentionResponseSchema,
    { endpoint: '/api/shop/user/attention', schemaName: 'UserAttentionResponse' }
  )
}
