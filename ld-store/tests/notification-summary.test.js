import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TextEncoder } from 'node:util'
import { createPinia, setActivePinia } from 'pinia'
import { api } from '../src/utils/api'
import {
  normalizeNotificationSummary,
  useNotificationSummaryStore
} from '../src/stores/notificationSummary'

vi.mock('../src/utils/api', () => ({
  api: {
    get: vi.fn(),
    openEventStream: vi.fn()
  }
}))

describe('通知汇总状态', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('将接口计数规范为非负整数', () => {
    expect(normalizeNotificationSummary({
      totalUnread: '5',
      systemUnread: 2.8,
      buyChatUnread: -1,
      sellerPendingDeliveryCount: 'invalid',
      sellerRefundPendingCount: '3.9'
    })).toEqual({
      totalUnread: 5,
      systemUnread: 2,
      buyChatUnread: 0,
      sellerPendingDeliveryCount: 0,
      sellerRefundPendingCount: 3,
      sessionsWithUnread: 0,
      totalSessions: 0,
      generatedAt: 0
    })
  })

  it('强制刷新时只接受最新请求结果，避免旧角标回写', async () => {
    let resolveFirst
    let resolveLatest
    api.get
      .mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve }))
      .mockReturnValueOnce(new Promise(resolve => { resolveLatest = resolve }))

    const store = useNotificationSummaryStore()
    const firstRequest = store.refresh()
    const latestRequest = store.refresh({ force: true })

    resolveLatest({
      success: true,
      data: { totalUnread: 1, sellerPendingDeliveryCount: 2, sellerRefundPendingCount: 4 }
    })
    await latestRequest
    expect(store.sellerPendingDeliveryCount).toBe(2)
    expect(store.sellerRefundPendingCount).toBe(4)

    resolveFirst({
      success: true,
      data: { totalUnread: 9, sellerPendingDeliveryCount: 8, sellerRefundPendingCount: 9 }
    })
    await firstRequest
    expect(store.sellerPendingDeliveryCount).toBe(2)
    expect(store.sellerRefundPendingCount).toBe(4)
    expect(store.totalUnread).toBe(1)
  })

  it('普通并发刷新复用同一个请求', async () => {
    let resolveRequest
    api.get.mockReturnValueOnce(new Promise(resolve => { resolveRequest = resolve }))

    const store = useNotificationSummaryStore()
    const firstRequest = store.refresh()
    const sharedRequest = store.refresh()

    expect(api.get).toHaveBeenCalledTimes(1)
    resolveRequest({ success: true, data: { sellerPendingDeliveryCount: 3 } })
    await Promise.all([firstRequest, sharedRequest])
    expect(store.sellerPendingDeliveryCount).toBe(3)
  })

  it('重置后忽略退出登录前的在途响应', async () => {
    let resolveRequest
    api.get.mockReturnValueOnce(new Promise(resolve => { resolveRequest = resolve }))

    const store = useNotificationSummaryStore()
    const request = store.refresh()
    store.reset()
    resolveRequest({ success: true, data: { totalUnread: 4, sellerPendingDeliveryCount: 6 } })
    await request

    expect(store.totalUnread).toBe(0)
    expect(store.sellerPendingDeliveryCount).toBe(0)
    expect(store.sellerRefundPendingCount).toBe(0)
    expect(store.lastSuccessfulSyncAt).toBe(0)
  })

  it('已读操作立即更新唯一汇总状态且保持总数口径', () => {
    const store = useNotificationSummaryStore()
    store.setSystemUnread(3)
    store.setBuyChatSummary({ totalUnread: 4, sessionsWithUnread: 2, totalSessions: 5 })

    store.markSystemRead(1)
    expect(store.systemUnread).toBe(2)
    expect(store.totalUnread).toBe(6)

    store.markBuyChatRead(3)
    expect(store.buyChatUnread).toBe(1)
    expect(store.sessionsWithUnread).toBe(1)
    expect(store.totalUnread).toBe(3)
  })

  it('实时连接失败时启用指数退避重连', async () => {
    vi.useFakeTimers()
    const listeners = new Map()
    vi.stubGlobal('window', {
      setTimeout: (...args) => globalThis.setTimeout(...args),
      clearTimeout: timer => globalThis.clearTimeout(timer),
      setInterval: (...args) => globalThis.setInterval(...args),
      clearInterval: timer => globalThis.clearInterval(timer),
      addEventListener: (name, handler) => listeners.set(name, handler),
      removeEventListener: name => listeners.delete(name)
    })
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: (name, handler) => listeners.set(name, handler),
      removeEventListener: name => listeners.delete(name)
    })
    vi.stubGlobal('navigator', { onLine: true })
    api.get.mockResolvedValue({ success: true, data: {} })
    api.openEventStream.mockResolvedValue({ success: false, status: 0 })

    const store = useNotificationSummaryStore()
    store.startRealtime()
    await vi.advanceTimersByTimeAsync(0)

    expect(api.openEventStream).toHaveBeenCalledTimes(1)
    expect(store.connectionState).toBe('retrying')

    await vi.advanceTimersByTimeAsync(999)
    expect(api.openEventStream).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(api.openEventStream).toHaveBeenCalledTimes(2)

    store.stopRealtime()
    expect(store.connectionState).toBe('idle')
  })

  it('同源多标签页只由租约持有者建立实时连接', async () => {
    vi.useFakeTimers()
    const listeners = new Map()
    const storageValues = new Map()
    const channels = new Map()
    class TestBroadcastChannel {
      constructor(name) {
        this.name = name
        this.handlers = new Set()
        const peers = channels.get(name) || new Set()
        peers.add(this)
        channels.set(name, peers)
      }

      addEventListener(_name, handler) { this.handlers.add(handler) }
      removeEventListener(_name, handler) { this.handlers.delete(handler) }
      postMessage(data) {
        for (const peer of channels.get(this.name) || []) {
          if (peer !== this) peer.handlers.forEach(handler => handler({ data }))
        }
      }
      close() { channels.get(this.name)?.delete(this) }
    }
    const addListener = (name, handler) => {
      const handlers = listeners.get(name) || new Set()
      handlers.add(handler)
      listeners.set(name, handlers)
    }
    const removeListener = (name, handler) => listeners.get(name)?.delete(handler)
    vi.stubGlobal('BroadcastChannel', TestBroadcastChannel)
    vi.stubGlobal('window', {
      BroadcastChannel: TestBroadcastChannel,
      localStorage: {
        getItem: key => storageValues.get(key) ?? null,
        setItem: (key, value) => storageValues.set(key, value),
        removeItem: key => storageValues.delete(key)
      },
      setTimeout: (...args) => globalThis.setTimeout(...args),
      clearTimeout: timer => globalThis.clearTimeout(timer),
      setInterval: (...args) => globalThis.setInterval(...args),
      clearInterval: timer => globalThis.clearInterval(timer),
      addEventListener: addListener,
      removeEventListener: removeListener
    })
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: addListener,
      removeEventListener: removeListener
    })
    vi.stubGlobal('navigator', { onLine: true })
    api.get.mockResolvedValue({ success: true, data: {} })
    api.openEventStream.mockImplementation(() => new Promise(() => {}))

    setActivePinia(createPinia())
    const leaderStore = useNotificationSummaryStore()
    leaderStore.startRealtime()
    setActivePinia(createPinia())
    const followerStore = useNotificationSummaryStore()
    followerStore.startRealtime()
    await vi.advanceTimersByTimeAsync(0)

    expect(api.openEventStream).toHaveBeenCalledTimes(1)
    expect(followerStore.connectionState).toBe('connecting')
    leaderStore.setSystemUnread(4)
    expect(followerStore.systemUnread).toBe(4)
    expect(followerStore.totalUnread).toBe(4)

    leaderStore.stopRealtime()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(api.openEventStream).toHaveBeenCalledTimes(2)

    followerStore.stopRealtime()
  })

  it('连接上限关闭后不立即重连或放大汇总请求', async () => {
    vi.useFakeTimers()
    const listeners = new Map()
    vi.stubGlobal('BroadcastChannel', undefined)
    vi.stubGlobal('window', {
      setTimeout: (...args) => globalThis.setTimeout(...args),
      clearTimeout: timer => globalThis.clearTimeout(timer),
      setInterval: (...args) => globalThis.setInterval(...args),
      clearInterval: timer => globalThis.clearInterval(timer),
      addEventListener: (name, handler) => listeners.set(name, handler),
      removeEventListener: name => listeners.delete(name)
    })
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: (name, handler) => listeners.set(name, handler),
      removeEventListener: name => listeners.delete(name)
    })
    vi.stubGlobal('navigator', { onLine: true })
    api.get.mockResolvedValue({ success: true, data: {} })
    const encoder = new TextEncoder()
    api.openEventStream.mockResolvedValue({
      success: true,
      response: {
        body: {
          getReader() {
            let sent = false
            return {
              read: vi.fn(async () => {
                if (sent) return { done: true, value: undefined }
                sent = true
                return {
                  done: false,
                  value: encoder.encode('event: stream.closed\ndata: {"reason":"connection_limit","retryAfterMs":60000}\n\n')
                }
              }),
              cancel: vi.fn(),
              releaseLock: vi.fn()
            }
          }
        }
      }
    })

    const store = useNotificationSummaryStore()
    store.startRealtime()
    await vi.advanceTimersByTimeAsync(0)

    expect(store.connectionState).toBe('limited')
    expect(api.openEventStream).toHaveBeenCalledTimes(1)
    expect(api.get).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(59_999)
    expect(api.openEventStream).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(api.openEventStream).toHaveBeenCalledTimes(2)

    store.stopRealtime()
  })
})

it('keeps the new stream watchdog when an aborted old stream finishes later', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('window', {
    setTimeout: (...args) => globalThis.setTimeout(...args), clearTimeout: timer => globalThis.clearTimeout(timer),
    setInterval: (...args) => globalThis.setInterval(...args), clearInterval: timer => globalThis.clearInterval(timer),
    addEventListener: () => {}, removeEventListener: () => {}
  })
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} })
  vi.stubGlobal('navigator', { onLine: true })
  setActivePinia(createPinia())
  api.get.mockResolvedValue({ success: true, data: {} })
  const pending = []
  api.openEventStream.mockImplementation(async () => ({ success: true, response: { body: {
    getReader: () => ({ read: () => new Promise(resolve => pending.push(resolve)), cancel: () => Promise.resolve(), releaseLock: () => {} })
  } } }))
  const store = useNotificationSummaryStore()
  try {
    store.startRealtime(); await vi.advanceTimersByTimeAsync(0)
    store.stopRealtime(); store.startRealtime(); await vi.advanceTimersByTimeAsync(0)
    expect(pending).toHaveLength(2)
    const timers = vi.getTimerCount()
    pending[0]({ done: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(timers)
    expect(store.connectionState).toBe('open')
  } finally {
    store.stopRealtime()
    pending[1]?.({ done: true })
    await vi.advanceTimersByTimeAsync(0)
    vi.useRealTimers(); vi.unstubAllGlobals()
  }
})
