// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RefundEventTimeline from '../src/components/order/RefundEventTimeline.vue'

describe('售后记录时间排序', () => {
  it('混合 UTC 墙钟、ISO 和秒时间戳仍按真实时间排序，同一时间按 ID 倒序', () => {
    const wrapper = mount(RefundEventTimeline, {
      props: { events: [
        { id: 1, action: 'refund_request', message: '旧记录', createdAt: '2026-10-07 23:58:17' },
        { id: 2, action: 'refund_contact', message: '较新记录', createdAt: Date.parse('2026-10-08T00:00:00Z') / 1000 },
        { id: 4, action: 'refund_approve', message: '最新记录', createdAt: '2026-10-08T00:01:00Z' },
        { id: 3, action: 'refund_contact', message: '同秒记录', createdAt: '2026-10-08 00:01:00' },
        { id: 5, action: 'refund_contact', message: '未知时间', createdAt: '' }
      ] }
    })
    expect(wrapper.findAll('article p').map(item => item.text())).toEqual(['最新记录', '同秒记录', '较新记录', '旧记录', '未知时间'])
    expect(wrapper.findAll('time').map(item => item.text())).toEqual([
      '2026-10-08 08:01', '2026-10-08 08:01', '2026-10-08 08:00', '2026-10-08 07:58', '—'
    ])
    expect(wrapper.findAll('time')[3].attributes('datetime')).toBe('2026-10-07T23:58:17.000Z')
    wrapper.unmount()
  })
})
