import { describe, expect, it } from 'vitest'
import {
  formatCompactCount,
  formatMessageTime,
  formatStandardDateTime,
  normalizeTimestampMs
} from '../src/utils/format'

describe('紧凑计数格式', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1 k'],
    [1050, '1.1 k'],
    [23099, '23.1 k'],
    [45623, '45.6 k'],
    [100000, '100 k'],
    ['1200', '1.2 k'],
    [-12, '0'],
    ['invalid', '0']
  ])('将 %s 格式化为 %s', (value, expected) => {
    expect(formatCompactCount(value)).toBe(expected)
  })
})

describe('消息时间格式', () => {
  it('统一识别秒和毫秒时间戳', () => {
    expect(normalizeTimestampMs(1_786_583_396)).toBe(1_786_583_396_000)
    expect(normalizeTimestampMs('1786583396000')).toBe(1_786_583_396_000)
  })

  it('把无时区墙钟时间按 UTC 解析', () => {
    expect(normalizeTimestampMs('2026-10-07 07:58:17.092')).toBe(Date.parse('2026-10-07T07:58:17.092Z'))
    expect(formatStandardDateTime('2026-10-07 07:58:17.092')).toBe('2026-10-07 15:58:17')
  })

  it('固定显示北京时间标准格式并保留秒数', () => {
    expect(formatStandardDateTime('2026-08-13T01:09:56.000Z')).toBe('2026-08-13 09:09:56')
    expect(formatStandardDateTime(1_786_583_396)).toBe('2026-08-13 09:09:56')
  })

  it('消息时间同时包含相对时间和精确时间', () => {
    expect(formatMessageTime('2026-08-13T01:09:56.000Z')).toMatch(/ · 2026-08-13 09:09:56$/)
    expect(formatMessageTime('无效时间')).toBe('时间未知')
  })
})
