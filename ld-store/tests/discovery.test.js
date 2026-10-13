import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDiscoveryRequestHeaders, getDiscoverySessionId } from '../src/utils/discovery'
import {
  clearDiscoveryTokenForProduct,
  getDiscoveryTokenForProduct,
  rememberDiscoveryToken,
  recordSearchOutcome,
} from '../src/services/shop/discoveryService'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('../src/utils/api', () => ({ api: { post } }))

function createMemoryStorage() {
  const values = new Map()
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
    removeItem(key) { values.delete(key) },
  }
}

describe('商城发现会话与归因', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    post.mockResolvedValue({ success: true, data: { accepted: 3, rejected: 0 } })
    vi.stubGlobal('window', {
      sessionStorage: createMemoryStorage(),
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    })
    vi.stubGlobal('navigator', { globalPrivacyControl: false, doNotTrack: '0' })
    vi.stubGlobal('crypto', { randomUUID: () => '9ec0bb58-d9eb-4e53-9dc7-a9c4c0a54a26' })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('零结果提交和改写携带同一个响应签名上下文', async () => {
    recordSearchOutcome({ query: 'empty', searchToken: 's1.payload.signature', zeroResult: true, reformulation: true })
    await vi.advanceTimersByTimeAsync(600)
    const events = post.mock.calls.at(-1)[1].events
    expect(events.map(event => event.type)).toEqual(['search_reformulation', 'search_submit', 'search_zero_result'])
    expect(events.every(event => event.searchToken === 's1.payload.signature')).toBe(true)
    expect(events.every(event => !event.discoveryToken)).toBe(true)
  })

  it('同一标签页复用匿名 UUID，并且只给商城请求添加发现头', () => {
    expect(getDiscoverySessionId()).toBe('9ec0bb58-d9eb-4e53-9dc7-a9c4c0a54a26')
    expect(getDiscoverySessionId()).toBe('9ec0bb58-d9eb-4e53-9dc7-a9c4c0a54a26')
    expect(getDiscoveryRequestHeaders('/api/shop/products')).toEqual({
      'X-Discovery-Session': '9ec0bb58-d9eb-4e53-9dc7-a9c4c0a54a26',
    })
    expect(getDiscoveryRequestHeaders('/api/auth/me')).toEqual({})
  })

  it('GPC/DNT 开启时不创建会话，只发送退出标记', () => {
    vi.stubGlobal('navigator', { globalPrivacyControl: true, doNotTrack: '1' })
    expect(getDiscoverySessionId()).toBe('')
    expect(getDiscoveryRequestHeaders('/api/shop/products')).toEqual({ 'X-Discovery-Privacy': 'opt-out' })
  })

  it('点击商品后按商品保存签名令牌，并可在下单成功后清理', () => {
    expect(rememberDiscoveryToken({ id: 42, discoveryToken: 'd1.payload.signature' })).toBe('d1.payload.signature')
    expect(getDiscoveryTokenForProduct(42)).toBe('d1.payload.signature')
    clearDiscoveryTokenForProduct(42)
    expect(getDiscoveryTokenForProduct(42)).toBe('')
  })
})
