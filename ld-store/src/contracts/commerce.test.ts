import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateApiResult } from './apiContract'
import {
  BuyRequestListResponseSchema,
  CdkListResponseSchema,
  MerchantConfigSchema,
  OrderListResponseSchema,
  OrderRefundResponseSchema,
  SellerRefundListResponseSchema,
  SystemMessagesResponseSchema
} from './commerce'
import type { ApiResult } from '@/utils/api'

function success(data: unknown, status = 200): ApiResult<unknown> {
  return { success: true, status, data }
}

function pagination(overrides: Record<string, unknown> = {}) {
  return { total: 1, page: 1, page_size: 20, total_pages: 1, ...overrides }
}

describe('commerce service contracts', () => {
  afterEach(() => vi.restoreAllMocks())

  it('consumes a historical order with a single server field for name and type', () => {
    const result = validateApiResult(success({
      orders: [{
        order_no: 'LS-LEGACY', status: 'delivered', product_name: '京东E卡-10元', product_type: 'normal',
        order_type: 'normal', requires_buyer_contact: true,
        product: { id: 7, name: '京东E卡-10元', product_type: 'normal' }
      }],
      pagination: pagination()
    }), OrderListResponseSchema, { endpoint: '/api/shop/orders', schemaName: 'OrderListResponse' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.orders[0]).toMatchObject({
      productName: '京东E卡-10元', productType: 'normal', orderType: 'normal', requiresBuyerContact: true,
      product: { name: '京东E卡-10元', productType: 'normal' }
    })
    expect(result.data.orders[0]).not.toHaveProperty('product_name')
  })

  it('normalizes order aliases once and keeps additive server fields', () => {
    const result = validateApiResult(
      success({
        orders: [{ order_no: 'LD-100', status: 'paid', delivery_content: '兑换码', future_flag: true }],
        pagination: pagination()
      }),
      OrderListResponseSchema,
      { endpoint: '/api/shop/orders', schemaName: 'OrderListResponse' }
    )

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.orders[0]).toMatchObject({
      orderNo: 'LD-100',
      status: 'paid',
      deliveryContent: '兑换码',
      futureFlag: true
    })
    expect(result.data.pagination).toMatchObject({ pageSize: 20, totalPages: 1 })
  })

  it('accepts LD image order states and normalizes the historical pending alias', () => {
    const result = validateApiResult(
      success({
        orders: [
          { order_no: 'LI-100', status: 'uploaded', order_type: 'image' },
          { order_no: 'LI-101', status: 'failed', order_type: 'image' },
          { order_no: 'LD-102', status: 'pending_payment' }
        ],
        pagination: pagination({ total: 3 })
      }),
      OrderListResponseSchema,
      { endpoint: '/api/shop/orders', schemaName: 'OrderListResponse' }
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.orders.map((order) => order.status)).toEqual(['uploaded', 'failed', 'pending'])
    }
  })

  it('normalizes PostgreSQL count strings in system-message pagination', () => {
    const result = validateApiResult(
      success({
        messages: [{ id: 123092 }],
        pagination: pagination({ total: '108', total_pages: 6 }),
        summary: { total_unread: 0 }
      }),
      SystemMessagesResponseSchema,
      { endpoint: '/api/shop/messages/system', schemaName: 'SystemMessagesResponse' }
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.pagination.total).toBe(108)
      expect(result.data.pagination.totalPages).toBe(6)
    }
  })

  it.each(['-1', '1.5', '108 messages'])(
    'rejects an invalid system-message count string: %s',
    (total) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = validateApiResult(
        success({
          messages: [],
          pagination: pagination({ total }),
          summary: { total_unread: 0 }
        }),
        SystemMessagesResponseSchema,
        { endpoint: '/api/shop/messages/system', schemaName: 'SystemMessagesResponse' }
      )

      expect(result).toMatchObject({ success: false, kind: 'contract', errorCode: 'INVALID_RESPONSE' })
    }
  )

  it('normalizes PostgreSQL count strings in the seller buy-request list', () => {
    const result = validateApiResult(
      success({
        requests: [{ id: 94, title: '求购服务', status: 'open' }],
        pagination: pagination({ total: '130', total_pages: 7 })
      }),
      BuyRequestListResponseSchema,
      { endpoint: '/api/shop/buy-requests/my', schemaName: 'BuyRequestListResponse' }
    )

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.pagination.total).toBe(130)
  })

  it('accepts legacy expired and disabled CDK inventory states', () => {
    const result = validateApiResult(
      success({
        cdks: [
          { id: 1, status: 'expired' },
          { id: 2, status: 'disabled' }
        ],
        stats: {},
        pagination: pagination({ total: 2 })
      }),
      CdkListResponseSchema,
      { endpoint: '/api/shop/products/:id/cdk', schemaName: 'CdkListResponse' }
    )

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.cdks.map((item) => item.status)).toEqual(['expired', 'disabled'])
  })

  it('preserves external disputes as a distinct server-authoritative state', () => {
    const result = validateApiResult(
      success({
        role: 'buyer',
        eligibility: { can_apply: false, code: 'EXTERNAL_DISPUTE', message: '请按说明处理' },
        refund: {
          id: 2,
          order_no: 'LD-200',
          status: 'external_dispute',
          refund_amount: '10.00',
          events: []
        },
        dispute_guide_url: '/help/dispute'
      }),
      OrderRefundResponseSchema,
      { endpoint: '/api/shop/orders/:orderNo/refund', schemaName: 'OrderRefundResponse' }
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.eligibility.canApply).toBe(false)
      expect(result.data.refund?.status).toBe('external_dispute')
      expect(result.data.refund?.refundAmount).toBe('10.00')
    }
  })

  it.each(['mystery', 'approved', 'done'])('rejects an unknown refund state: %s', (status) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = validateApiResult(
      success({
        refunds: [{ id: 1, order_no: 'LD-300', status, refund_amount: 8 }],
        summary: {},
        pagination: pagination()
      }, 206),
      SellerRefundListResponseSchema,
      { endpoint: '/api/shop/refunds/seller', schemaName: 'SellerRefundListResponse' }
    )

    expect(result).toMatchObject({
      success: false,
      status: 206,
      kind: 'contract',
      errorCode: 'INVALID_RESPONSE',
      aborted: false
    })
  })

  it.each([{ page: 0 }, { page_size: '20' }, { total_pages: -1 }])(
    'rejects illegal order pagination: %j',
    (override) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = validateApiResult(
        success({ orders: [], pagination: pagination(override) }),
        OrderListResponseSchema,
        { endpoint: '/api/shop/orders', schemaName: 'OrderListResponse' }
      )

      expect(result).toMatchObject({ success: false, kind: 'contract', errorCode: 'INVALID_RESPONSE' })
    }
  )

  it('rejects a merchant configuration missing its core flags without logging payload data', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = validateApiResult(
      success({ configured: true, ldc_pid: 'private-merchant-id' }),
      MerchantConfigSchema,
      { endpoint: '/api/shop/merchant/config', schemaName: 'MerchantConfig' }
    )

    expect(result).toMatchObject({ success: false, kind: 'contract', errorCode: 'INVALID_RESPONSE' })
    expect(JSON.stringify(warning.mock.calls[0])).not.toContain('private-merchant-id')
  })

  it('accepts an unconfigured merchant with a null masked payment identifier', () => {
    const result = validateApiResult(
      success({
        configured: false,
        is_active: false,
        is_verified: false,
        verified_at: null,
        ldc_pid: null,
        stats: {
          total_orders: 0,
          total_revenue: 0,
          this_month_orders: 0,
          this_month_revenue: 0
        }
      }),
      MerchantConfigSchema,
      { endpoint: '/api/shop/merchant/config', schemaName: 'MerchantConfig' }
    )

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.ldcPid).toBeNull()
  })
})
