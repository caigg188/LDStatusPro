import { api } from '@/utils/api'

function toRequestError(error, fallback) {
  return { success: false, error: error?.message || fallback }
}

function getTimeoutOptions(options = {}) {
  const timeout = Number(options?.timeout || 0)
  if (Number.isFinite(timeout) && timeout > 0) {
    return { timeout }
  }
  return {}
}

export async function fetchMyProductsRequest() {
  return api.get('/api/shop/my-products')
}

export async function createProductRequest(data, options = {}) {
  try {
    return await api.post('/api/shop/products', data, getTimeoutOptions(options))
  } catch (error) {
    return toRequestError(error, '创建商品失败，请稍后重试')
  }
}

export async function getProductSubmissionStatusRequest(submissionToken) {
  const safeToken = String(submissionToken || '').trim()
  if (!safeToken) {
    return { success: false, error: '提交凭证无效' }
  }

  try {
    return await api.get(`/api/shop/product-submission-status?token=${encodeURIComponent(safeToken)}`)
  } catch (error) {
    return toRequestError(error, '获取提交状态失败，请稍后重试')
  }
}

export async function updateProductRequest(id, data, options = {}) {
  try {
    return await api.put(`/api/shop/my-products/${id}`, data, getTimeoutOptions(options))
  } catch (error) {
    return toRequestError(error, '更新商品失败，请稍后重试')
  }
}

export async function offlineProductRequest(id) {
  try {
    return await api.post(`/api/shop/my-products/${id}/offline`)
  } catch (error) {
    return toRequestError(error, '下架商品失败，请稍后重试')
  }
}

export async function deleteProductRequest(id) {
  try {
    return await api.delete(`/api/shop/my-products/${id}`)
  } catch (error) {
    return toRequestError(error, '删除商品失败，请稍后重试')
  }
}

export async function fetchMyProductDetailRequest(id) {
  return api.get(`/api/shop/my-products/${id}`)
}

export async function fetchCdkListRequest(productId, options = {}) {
  const page = Number.parseInt(options.page, 10) || 1
  const params = new URLSearchParams({ page: String(page) })
  if (options.status) {
    params.set('status', options.status)
  }

  try {
    return await api.get(`/api/shop/products/${productId}/cdk?${params.toString()}`)
  } catch (error) {
    return toRequestError(error, '加载 CDK 列表失败，请稍后重试')
  }
}

export async function addCdkRequest(productId, codes) {
  try {
    return await api.post(`/api/shop/products/${productId}/cdk`, { codes })
  } catch (error) {
    return toRequestError(error, '添加 CDK 失败，请稍后重试')
  }
}

export async function deleteCdkRequest(productId, cdkId) {
  try {
    return await api.delete(`/api/shop/products/${productId}/cdk/${cdkId}`)
  } catch (error) {
    return toRequestError(error, '删除 CDK 失败，请稍后重试')
  }
}

export async function clearCdkRequest(productId) {
  try {
    return await api.post(`/api/shop/products/${productId}/cdk/clear`)
  } catch (error) {
    return toRequestError(error, '清空 CDK 失败，请稍后重试')
  }
}
