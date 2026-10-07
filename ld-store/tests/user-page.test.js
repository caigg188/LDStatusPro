import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse, compileTemplate } from '@vue/compiler-sfc'

const source = readFileSync(new globalThis.URL('../src/views/User.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)

describe('personal hub page', () => {
  it('keeps the User template compilable', () => {
    expect(compileTemplate({
      source: descriptor.template.content,
      filename: 'User.vue',
      id: 'user-page'
    }).errors).toEqual([])
  })

  it('is a buyer task hub instead of a wallet or lifetime-stat dump', () => {
    expect(source).toContain('需要处理')
    expect(source).toContain('最近订单')
    expect(source).toContain('我的记录')
    expect(source).toContain('卖家后台')
    expect(source).toContain('帮助中心')
    expect(source).toContain('公开主页')
    expect(source).not.toContain('可用余额')
    expect(source).not.toContain('今日额度')
    expect(source).not.toContain('fetchLdcInfo')
    expect(source).not.toContain('累计购买订单')
    expect(source).not.toContain('按订单数')
    expect(source).toContain('spendingInsight')
  })
})
