// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { safeParse } from 'valibot'
import RefundDeadlineNotice from '../src/components/order/RefundDeadlineNotice.vue'
import { RefundSchema, SellerRefundListResponseSchema } from '../src/contracts/commerce'
import { buildRefundStages } from '../src/utils/refund'
const wrappers = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.useRealTimers() })
function render(props) { const wrapper = mount(RefundDeadlineNotice, { props }); wrappers.push(wrapper); return wrapper }
describe('refund deadline presentation', () => {
  it('uses server time and Beijing deadline, including while negotiating', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-05T00:00:00Z'))
    const wrapper = render({ refund: { status: 'negotiating', decisionDeadlineAt: '2026-09-05T04:00:00Z' }, serverNow: '2026-09-05T02:00:00Z' })
    expect(wrapper.text()).toContain('2026/09/05 12:00（北京时间）')
    expect(wrapper.text()).toContain('剩余 2 小时 0 分钟')
    expect(wrapper.text()).toContain('协商、发货均不延长时限')
    expect(wrapper.classes()).toContain('is-urgent')
  })
  it('shows expiry as waiting for processing rather than refunded', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-05T04:00:00Z'))
    const wrapper = render({ refund: { status: 'requested', decisionDeadlineAt: '2026-09-05T04:00:00Z' } })
    expect(wrapper.text()).toContain('已到期，等待系统处理')
    expect(wrapper.text()).not.toContain('退款成功')
  })
  it('stops displaying an active countdown after rejection', () => {
    const wrapper = render({ refund: { status: 'rejected', decisionDeadlineAt: '2026-09-09T04:00:00Z' } })
    expect(wrapper.text()).toBe('')
  })
  it('attributes automatic and administrator decisions accurately in progress stages', () => {
    expect(buildRefundStages('processing', true, 'buyer', 'response_timeout')[1].description).toBe('系统已自动同意退款')
    expect(buildRefundStages('refunded', true, 'buyer', 'admin_override')[1].description).toBe('管理员已同意退款')
  })
  it('checks new response fields while accepting older refund payloads', () => {
    const original = { id: 1, orderNo: 'TEST-1', status: 'requested', refundAmount: 10, events: [] }
    expect(safeParse(RefundSchema, original).success).toBe(true)
    expect(safeParse(RefundSchema, { ...original, decisionDeadlineAt: null, overdue: false, allowedActions: { approve: true, reject: true, contact: true } }).success).toBe(true)
    expect(safeParse(RefundSchema, { ...original, overdue: 'false' }).success).toBe(false)
  })
  it('uses order numbers for public refunds without requiring internal refund IDs', () => {
    const refund = { orderNo: 'LS_PUBLIC_REFUND', status: 'requested', refundAmount: 10, events: [] }
    expect(safeParse(RefundSchema, refund).success).toBe(true)
    expect(safeParse(SellerRefundListResponseSchema, { refunds: [refund], summary: {},
      pagination: { total: 1, page: 1, pageSize: 20, totalPages: 1 } }).success).toBe(true)
  })
})
