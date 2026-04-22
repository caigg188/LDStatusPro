import { api } from '@/utils/api'

export const productSortMapping = {
  default: { sortBy: 'updated_at', sortOrder: 'DESC' },
  newest: { sortBy: 'created_at', sortOrder: 'DESC' },
  price_asc: { sortBy: 'final_price', sortOrder: 'ASC' },
  price_desc: { sortBy: 'final_price', sortOrder: 'DESC' },
  sales: { sortBy: 'sold_count', sortOrder: 'DESC' }
}

function getPositiveInt(value, fallback, min = 1, max = Number.POSITIVE_INFINITY) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

function toRequestError(error, fallback) {
  return { success: false, error: error?.message || fallback }
}

export async function fetchCategoriesRequest() {
  return api.get('/api/shop/categories')
}

export async function fetchProductsRequest(options = {}) {
  const params = new URLSearchParams()
  const {
    page = 1,
    pageSize = 20,
    categoryId = '',
    sort = 'default',
    inStockOnly = false,
    priceMin = null,
    priceMax = null,
    search = ''
  } = options

  params.set('page', String(page))
  params.set('pageSize', String(pageSize))

  const safeCategoryId = String(categoryId || '').trim()
  if (safeCategoryId) {
    params.set('categoryId', safeCategoryId)
  }

  const safeSearch = String(search || '').trim()
  if (safeSearch) {
    params.set('search', safeSearch)
  }

  const sortConfig = productSortMapping[sort] || productSortMapping.default
  params.set('sortBy', sortConfig.sortBy)
  params.set('sortOrder', sortConfig.sortOrder)

  if (inStockOnly) {
    params.set('inStock', 'true')
  }

  if (priceMin !== null && priceMin !== undefined && String(priceMin).trim() !== '') {
    params.set('priceMin', String(priceMin))
  }

  if (priceMax !== null && priceMax !== undefined && String(priceMax).trim() !== '') {
    params.set('priceMax', String(priceMax))
  }

  return api.get(`/api/shop/products?${params.toString()}`)
}

export async function fetchProductRequest(id) {
  return api.get(`/api/shop/products/${id}`)
}

export async function fetchMerchantProfileRequest(username) {
  const safeUsername = String(username || '').trim()
  if (!safeUsername) {
    return { success: false, error: '商家用户名无效' }
  }

  try {
    return await api.get(`/api/shop/merchants/${encodeURIComponent(safeUsername)}`)
  } catch (error) {
    return toRequestError(error, '加载商家主页失败，请稍后重试')
  }
}

export async function reportProductRequest(id, payload = {}) {
  const requestPayload = typeof payload === 'string'
    ? { reason: payload }
    : {
        reason: String(payload?.reason || ''),
        reportCategory: String(payload?.reportCategory || payload?.report_category || '')
      }
  try {
    return await api.post(`/api/shop/products/${id}/report`, requestPayload)
  } catch (error) {
    return toRequestError(error, '举报商品失败，请稍后重试')
  }
}

export async function fetchMyReportsRequest(options = {}) {
  const page = getPositiveInt(options.page, 1)
  const pageSize = getPositiveInt(options.pageSize, 20, 1, 50)
  const status = String(options.status || '').trim()
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (status) params.set('status', status)

  try {
    return await api.get(`/api/shop/my-reports?${params.toString()}`)
  } catch (error) {
    return toRequestError(error, '加载我的举报失败，请稍后重试')
  }
}

export async function fetchMyReportDetailRequest(reportId) {
  try {
    return await api.get(`/api/shop/my-reports/${reportId}`)
  } catch (error) {
    return toRequestError(error, '加载举报详情失败，请稍后重试')
  }
}

export async function fetchProductCommentsRequest(productId, options = {}) {
  const page = getPositiveInt(options.page, 1)
  const pageSize = getPositiveInt(options.pageSize, 10, 1, 10)

  try {
    return await api.get(`/api/shop/products/${productId}/comments?page=${page}&pageSize=${pageSize}`)
  } catch (error) {
    return toRequestError(error, '加载评论失败，请稍后重试')
  }
}

export async function createProductCommentRequest(productId, payload = {}) {
  const requestPayload = typeof payload === 'string'
    ? { content: payload }
    : {
        content: String(payload?.content || ''),
        ...(payload?.rating === null || payload?.rating === undefined || payload?.rating === ''
          ? {}
          : { rating: payload.rating })
      }
  try {
    return await api.post(`/api/shop/products/${productId}/comments`, requestPayload)
  } catch (error) {
    return toRequestError(error, '发布评论失败，请稍后重试')
  }
}

export async function deleteProductCommentRequest(commentId) {
  try {
    return await api.delete(`/api/shop/comments/${commentId}`)
  } catch (error) {
    return toRequestError(error, '删除评论失败，请稍后重试')
  }
}

export async function reportProductCommentRequest(commentId, reason) {
  try {
    return await api.post(`/api/shop/comments/${commentId}/report`, { reason })
  } catch (error) {
    return toRequestError(error, '举报评论失败，请稍后重试')
  }
}

export async function voteProductCommentRequest(commentId, voteType = '') {
  try {
    return await api.post(`/api/shop/comments/${commentId}/vote`, { voteType })
  } catch (error) {
    return toRequestError(error, '评论投票失败，请稍后重试')
  }
}

export async function fetchProductCommentRepliesRequest(commentId, options = {}) {
  const page = getPositiveInt(options.page, 1)
  const pageSize = getPositiveInt(options.pageSize, 10, 1, 20)

  try {
    return await api.get(`/api/shop/comments/${commentId}/replies?page=${page}&pageSize=${pageSize}`)
  } catch (error) {
    return toRequestError(error, '加载评论回复失败，请稍后重试')
  }
}

export async function createProductCommentReplyRequest(commentId, content) {
  try {
    return await api.post(`/api/shop/comments/${commentId}/replies`, { content })
  } catch (error) {
    return toRequestError(error, '发布回复失败，请稍后重试')
  }
}

export async function addFavoriteRequest(productId) {
  try {
    return await api.post(`/api/shop/products/${productId}/favorite`)
  } catch (error) {
    return toRequestError(error, '收藏商品失败，请稍后重试')
  }
}

export async function removeFavoriteRequest(productId) {
  try {
    return await api.delete(`/api/shop/products/${productId}/favorite`)
  } catch (error) {
    return toRequestError(error, '取消收藏失败，请稍后重试')
  }
}

export async function getProductRestockSubscriptionStatusRequest(productId) {
  try {
    return await api.get(`/api/shop/products/${productId}/restock-subscription`)
  } catch (error) {
    return toRequestError(error, '获取补货订阅状态失败，请稍后重试')
  }
}

export async function subscribeProductRestockRequest(productId) {
  try {
    return await api.post(`/api/shop/products/${productId}/restock-subscription`)
  } catch (error) {
    return toRequestError(error, '订阅补货提醒失败，请稍后重试')
  }
}

export function normalizeFavoritesOptions(options = {}) {
  const page = getPositiveInt(options.page, 1)
  const pageSize = getPositiveInt(options.pageSize, 20, 1, 50)
  const search = String(options.search || '').trim()

  return { page, pageSize, search }
}

export async function fetchFavoritesRequest(options = {}) {
  const normalized = normalizeFavoritesOptions(options)
  const params = new URLSearchParams()
  params.set('page', String(normalized.page))
  params.set('pageSize', String(normalized.pageSize))
  if (normalized.search) {
    params.set('search', normalized.search)
  }

  return {
    ...normalized,
    result: await api.get(`/api/shop/favorites?${params.toString()}`)
  }
}

export async function fetchPublicStatsRequest() {
  return api.get('/api/shop/stats')
}

export async function fetchUserDashboardRequest() {
  return api.get('/api/shop/user/dashboard')
}
