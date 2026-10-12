import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateApiResult } from './apiContract'
import {
  CategoriesResponseSchema,
  MarketplaceBuyRequestsResponseSchema,
  ProductListResponseSchema
} from './catalog'
import type { ApiResult } from '@/utils/api'

function success(data: unknown, status = 200): ApiResult<unknown> {
  return { success: true, status, data }
}

function validPagination(overrides: Record<string, unknown> = {}) {
  return {
    total: 1,
    page: 1,
    page_size: 20,
    total_pages: 1,
    ...overrides
  }
}

describe('catalog service contracts', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes legacy aliases to camelCase and retains additive fields', () => {
    const result = validateApiResult(
      success({
        products: [{
          id: 7,
          name: '测试物品',
          image_url: '/cover.png',
          seller_username: 'seller',
          future_server_field: 'kept'
        }],
        pagination: validPagination(),
        ranking_context: {
          surface: 'home',
          version: 'catalog-v2',
          fallback: false,
          slate_id: 'slate-1'
        }
      }),
      ProductListResponseSchema,
      { endpoint: '/api/shop/products', schemaName: 'ProductListResponse' }
    )

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.products[0]).toMatchObject({
      id: 7,
      name: '测试物品',
      imageUrl: '/cover.png',
      sellerUsername: 'seller',
      futureServerField: 'kept'
    })
    expect(result.data.products[0]).not.toHaveProperty('image_url')
    expect(result.data.pagination).toMatchObject({ pageSize: 20, totalPages: 1 })
    expect(result.data.rankingContext).toMatchObject({ slateId: 'slate-1' })
  })

  it.each([true, false])('prefers an explicit camelCase value in either serialized order: %s', (snakeFirst) => {
    const result = validateApiResult(
      success({
        categories: [{
          id: 2,
          name: '服务',
          ...(snakeFirst
            ? { visibility_trust_level: 1, visibilityTrustLevel: 3 }
            : { visibilityTrustLevel: 3, visibility_trust_level: 1 })
        }]
      }),
      CategoriesResponseSchema,
      { endpoint: '/api/shop/categories', schemaName: 'CategoriesResponse' }
    )

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.categories[0].visibilityTrustLevel).toBe(3)
  })

  it('accepts unknown additive response fields', () => {
    const result = validateApiResult(
      success({
        categories: [{ id: 1, name: 'AI', serverHint: { version: 2 } }],
        rollout: 'next'
      }),
      CategoriesResponseSchema,
      { endpoint: '/api/shop/categories', schemaName: 'CategoriesResponse' }
    )

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.rollout).toBe('next')
  })

  it.each([
    [{ name: '缺少 ID' }],
    [{ id: { invalid: true }, name: '错误 ID' }],
    [{ id: 1, name: 99 }]
  ])('rejects a product with missing or invalid core fields: %j', (products) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = validateApiResult(
      success({ products, pagination: validPagination() }, 206),
      ProductListResponseSchema,
      { endpoint: '/api/shop/products', schemaName: 'ProductListResponse' }
    )

    expect(result).toMatchObject({
      success: false,
      status: 206,
      kind: 'contract',
      errorCode: 'INVALID_RESPONSE',
      aborted: false
    })
  })

  it.each([
    { page: 0 },
    { page_size: 0 },
    { total_pages: -1 },
    { total: '1' }
  ])('rejects illegal pagination: %j', (override) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = validateApiResult(
      success({ products: [], pagination: validPagination(override) }),
      ProductListResponseSchema,
      { endpoint: '/api/shop/products', schemaName: 'ProductListResponse' }
    )

    expect(result).toMatchObject({ success: false, kind: 'contract', errorCode: 'INVALID_RESPONSE' })
  })

  it('rejects unknown marketplace transaction status values', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = validateApiResult(
      success({
        requests: [{ id: 1, title: '求购服务', status: 'secret_state' }],
        pagination: validPagination()
      }),
      MarketplaceBuyRequestsResponseSchema,
      { endpoint: '/api/shop/buy-requests', schemaName: 'MarketplaceBuyRequestsResponse' }
    )

    expect(result).toMatchObject({ success: false, kind: 'contract', errorCode: 'INVALID_RESPONSE' })
  })

  it('normalizes PostgreSQL count strings for marketplace buy-request pagination', () => {
    const result = validateApiResult(
      success({
        requests: [{ id: 1, title: '求购服务', status: 'open' }],
        pagination: validPagination({ total: '130' })
      }),
      MarketplaceBuyRequestsResponseSchema,
      { endpoint: '/api/shop/buy-requests', schemaName: 'MarketplaceBuyRequestsResponse' }
    )

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.pagination.total).toBe(130)
  })

  it('rejects malformed PostgreSQL count strings for marketplace buy requests', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = validateApiResult(
      success({
        requests: [],
        pagination: validPagination({ total: '130 rows' })
      }),
      MarketplaceBuyRequestsResponseSchema,
      { endpoint: '/api/shop/buy-requests', schemaName: 'MarketplaceBuyRequestsResponse' }
    )

    expect(result).toMatchObject({ success: false, kind: 'contract', errorCode: 'INVALID_RESPONSE' })
  })

  it('logs only endpoint, schema and issue paths for invalid payloads', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    validateApiResult(
      success({ products: [{ name: '缺少 ID', privateNote: 'never-log-me' }], pagination: validPagination() }),
      ProductListResponseSchema,
      { endpoint: '/api/shop/products', schemaName: 'ProductListResponse' }
    )

    expect(warning).toHaveBeenCalledOnce()
    const serialized = JSON.stringify(warning.mock.calls[0])
    expect(serialized).toContain('/api/shop/products')
    expect(serialized).toContain('ProductListResponse')
    expect(serialized).not.toContain('never-log-me')
  })

  it('preserves an existing transport failure without reparsing it', () => {
    const failure: ApiResult<unknown> = {
      success: false,
      status: 503,
      error: '维护中',
      aborted: false,
      kind: 'maintenance'
    }
    expect(validateApiResult(
      failure,
      ProductListResponseSchema,
      { endpoint: '/api/shop/products', schemaName: 'ProductListResponse' }
    )).toBe(failure)
  })
})
