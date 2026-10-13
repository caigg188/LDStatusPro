import { api, type ApiRequestOptions, type ApiResult, type JsonValue } from '@/utils/api'
import {
  CdkListResponseSchema,
  CommerceActionResponseSchema,
  ProductEditorDetailResponseSchema,
  ProductImageLookupResponseSchema,
  ProductInventoryResponseSchema,
  ProductMutationResponseSchema,
  ProductSubmissionStatusResponseSchema,
  type ProductCreatePayload,
  type ProductUpdatePayload
} from '@/contracts/commerce'
import { validateServiceResult, withServiceFailure } from '@/services/serviceContract'

interface InventoryListOptions {
  status?: string
  productType?: string
  category?: string | number
  page?: number
  pageSize?: number
  signal?: AbortSignal
  timeout?: number
}

interface CdkListOptions {
  page?: number
  pageSize?: number
  status?: string
  batchNo?: string
  signal?: AbortSignal
}

interface TimeoutOptions {
  timeout?: number
  signal?: AbortSignal
}

interface CdkExportPayload {
  blob: Blob
  filename: string
}

function requestOptions(options: TimeoutOptions = {}): ApiRequestOptions {
  const timeout = Number(options.timeout || 0)
  return {
    auth: 'required',
    ...(Number.isFinite(timeout) && timeout > 0 ? { timeout } : {}),
    ...(options.signal ? { signal: options.signal } : {})
  }
}

function inventoryQuery(options: InventoryListOptions): string {
  const params = new URLSearchParams()
  if (options.status) params.set('status', String(options.status))
  if (options.productType) params.set('productType', String(options.productType))
  if (options.category) params.set('category', String(options.category))
  if (options.page) params.set('page', String(options.page))
  if (options.pageSize) params.set('pageSize', String(options.pageSize))
  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function fetchMyProductsRequest(options: InventoryListOptions = {}) {
  return validateServiceResult(
    await api.get(`/api/shop/my-products${inventoryQuery(options)}`, { auth: 'required', signal: options.signal, timeout: options.timeout }),
    ProductInventoryResponseSchema,
    '/api/shop/my-products',
    'ProductInventoryResponse'
  )
}

export async function fetchProductImagesRequest(options: InventoryListOptions = {}) {
  return validateServiceResult(
    await api.get(`/api/shop/my-products${inventoryQuery(options)}`, { auth: 'required', signal: options.signal, timeout: options.timeout }),
    ProductImageLookupResponseSchema,
    '/api/shop/my-products',
    'ProductImageLookupResponse'
  )
}

export async function createProductRequest(data: ProductCreatePayload | Record<string, JsonValue>, options: TimeoutOptions = {}) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post('/api/shop/products', data as JsonValue, requestOptions(options)),
    ProductMutationResponseSchema,
    '/api/shop/products',
    'ProductMutationResponse'
  ), '创建商品失败，请稍后重试')
}

export async function getProductSubmissionStatusRequest(submissionToken: string) {
  const safeToken = String(submissionToken || '').trim()
  if (!safeToken) {
    return withServiceFailure(async () => {
      throw new Error('提交凭证无效')
    }, '提交凭证无效')
  }

  return withServiceFailure(async () => validateServiceResult(
    await api.get(`/api/shop/product-submission-status?token=${encodeURIComponent(safeToken)}`, { auth: 'required' }),
    ProductSubmissionStatusResponseSchema,
    '/api/shop/product-submission-status',
    'ProductSubmissionStatusResponse'
  ), '获取提交状态失败，请稍后重试')
}

export async function updateProductRequest(
  id: string | number,
  data: ProductUpdatePayload | Record<string, JsonValue>,
  options: TimeoutOptions = {}
) {
  return withServiceFailure(async () => validateServiceResult(
    await api.put(`/api/shop/my-products/${id}`, data as JsonValue, requestOptions(options)),
    ProductMutationResponseSchema,
    '/api/shop/my-products/:id',
    'ProductMutationResponse'
  ), '更新商品失败，请稍后重试')
}

export async function offlineProductRequest(id: string | number) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post(`/api/shop/my-products/${id}/offline`, undefined, { auth: 'required' }),
    ProductMutationResponseSchema,
    '/api/shop/my-products/:id/offline',
    'ProductMutationResponse'
  ), '下架商品失败，请稍后重试')
}

export async function deleteProductRequest(id: string | number) {
  return withServiceFailure(async () => validateServiceResult(
    await api.delete(`/api/shop/my-products/${id}`, { auth: 'required' }),
    CommerceActionResponseSchema,
    '/api/shop/my-products/:id',
    'CommerceActionResponse'
  ), '删除商品失败，请稍后重试')
}

export async function fetchMyProductDetailRequest(id: string | number) {
  return validateServiceResult(
    await api.get(`/api/shop/my-products/${id}`, { auth: 'required' }),
    ProductEditorDetailResponseSchema,
    '/api/shop/my-products/:id',
    'ProductEditorDetailResponse'
  )
}

export async function fetchCdkListRequest(productId: string | number, options: CdkListOptions = {}) {
  const page = Number.parseInt(String(options.page || 1), 10) || 1
  const params = new URLSearchParams({ page: String(page) })
  if (options.pageSize) params.set('pageSize', String(options.pageSize))
  if (options.status) params.set('status', options.status)
  if (options.batchNo) params.set('batchNo', options.batchNo)

  return withServiceFailure(async () => validateServiceResult(
    await api.get(`/api/shop/products/${productId}/cdk?${params.toString()}`, { auth: 'required', signal: options.signal }),
    CdkListResponseSchema,
    '/api/shop/products/:id/cdk',
    'CdkListResponse'
  ), '加载 CDK 列表失败，请稍后重试')
}

export async function addCdkRequest(productId: string | number, codes: string[]) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post(`/api/shop/products/${productId}/cdk`, { codes }, { auth: 'required' }),
    CommerceActionResponseSchema,
    '/api/shop/products/:id/cdk',
    'CommerceActionResponse'
  ), '添加 CDK 失败，请稍后重试')
}

export async function deleteCdkRequest(productId: string | number, cdkId: string | number) {
  return withServiceFailure(async () => validateServiceResult(
    await api.delete(`/api/shop/products/${productId}/cdk/${cdkId}`, { auth: 'required' }),
    CommerceActionResponseSchema,
    '/api/shop/products/:id/cdk/:cdkId',
    'CommerceActionResponse'
  ), '删除 CDK 失败，请稍后重试')
}

export async function clearCdkRequest(productId: string | number) {
  return withServiceFailure(async () => validateServiceResult(
    await api.post(`/api/shop/products/${productId}/cdk/clear`, undefined, { auth: 'required' }),
    CommerceActionResponseSchema,
    '/api/shop/products/:id/cdk/clear',
    'CommerceActionResponse'
  ), '清空 CDK 失败，请稍后重试')
}

export async function exportCdkRequest(productId: string | number, status = 'all'): Promise<ApiResult<CdkExportPayload>> {
  const result = await api.download(`/api/shop/products/${productId}/cdk/export?status=${encodeURIComponent(status)}&format=txt`)
  if (!result.success) return result
  const filename = result.data.disposition.match(/filename="([^"]+)"/)?.[1] || `${productId}-cdk.txt`
  return { ...result, data: { blob: result.data.blob, filename } }
}
