import { describe, expect, it } from 'vitest'
import {
  EMPTY_ATTENTION,
  activeAttentionItems,
  buildAttentionItems,
  buildRecordLinks,
  buildTrustHint,
  remainingDeadlineLabel,
  recentOrderAction,
  recentOrderStatusTone,
  sellerChannelCopy,
  shouldShowSellerChannel,
  spendingSummaryText
} from '../src/utils/userHub'

describe('personal hub presentation', () => {
  it('only keeps attention items that need action', () => {
    const items = buildAttentionItems({
      attention: {
        ...EMPTY_ATTENTION,
        pendingPaymentCount: 2,
        awaitingDeliveryCount: 1,
        nextFulfillmentDeadlineAt: new Date(Date.now() + 11 * 3600 * 1000).toISOString()
      },
      messageUnread: 4,
      now: Date.now()
    })
    const active = activeAttentionItems(items)
    expect(active.map(item => item.key)).toEqual(['pay', 'delivery', 'messages'])
    expect(active.find(item => item.key === 'delivery')?.hint).toMatch(/^剩 \d+ 小时$/)
  })

  it('hides a row of zeros and explains trust level gates', () => {
    expect(activeAttentionItems(buildAttentionItems())).toEqual([])
    expect(buildTrustHint(0)).toMatchObject({ label: 'TL0', detail: '暂不能查看士多热榜' })
    expect(buildTrustHint(3)).toMatchObject({ label: 'TL3', detail: '可查看士多热榜' })
  })

  it('puts live badges on records and seller copy', () => {
    const records = buildRecordLinks({ unusedCouponCount: 3, messageUnread: 12, pendingReportCount: 1 })
    expect(records.find(item => item.key === 'coupons')?.badge).toBe('3')
    expect(records.find(item => item.key === 'messages')?.badge).toBe('12')
    expect(records.find(item => item.key === 'orders')?.badge).toBe('')
    expect(sellerChannelCopy({ sellerPendingDeliveryCount: 2, sellerRefundPendingCount: 1 })).toBe('待发 2 · 售后 1')
  })

  it('shows the seller channel when the account has sold or has backlog', () => {
    expect(shouldShowSellerChannel({ overview: { publishedProductCount: 1 } })).toBe(true)
    expect(shouldShowSellerChannel({ merchant: { configured: true } })).toBe(true)
    expect(shouldShowSellerChannel({ sellerPendingDeliveryCount: 1 })).toBe(true)
    expect(shouldShowSellerChannel()).toBe(false)
  })

  it('routes recent orders by the next buyer action', () => {
    expect(recentOrderAction({ orderNo: 'A1', status: 'pending' })).toEqual({
      label: '去支付',
      to: { path: '/order/A1', query: { role: 'buyer' } }
    })
    expect(recentOrderAction({ orderNo: 'A2', status: 'refund_pending' }).label).toBe('查看退款')
    expect(recentOrderStatusTone({ status: 'pending' })).toBe('warn')
    expect(recentOrderStatusTone({ status: 'paid' })).toBe('info')
    expect(recentOrderStatusTone({ status: 'completed' })).toBe('ok')
    expect(spendingSummaryText({ totalPurchaseOrders: 36, totalSpent: 1280.5 })).toBe('累计 36 单 · 1,280.5 LDC')
    expect(remainingDeadlineLabel(new Date(Date.now() - 1000).toISOString())).toBe('已到期')
  })
})
