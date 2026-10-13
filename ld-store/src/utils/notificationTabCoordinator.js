const DEFAULT_CHANNEL_NAME = 'ld-store-notification-summary-v1'
const DEFAULT_LEASE_KEY = 'ld-store-notification-leader-v1'
const DEFAULT_LEASE_DURATION_MS = 15_000
const DEFAULT_RENEW_INTERVAL_MS = 5_000

function createTabId() {
  try {
    return globalThis.crypto?.randomUUID?.() || `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
  } catch {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function parseLease(value) {
  if (!value) return null
  try {
    const lease = JSON.parse(value)
    if (!lease?.tabId || !Number.isFinite(Number(lease.expiresAt))) return null
    return { tabId: String(lease.tabId), expiresAt: Number(lease.expiresAt) }
  } catch {
    return null
  }
}

/**
 * 用 localStorage 租约选出同源标签页中的唯一通知连接持有者，BroadcastChannel
 * 只负责转发汇总和业务事件。存储或频道不可用时安全降级为当前标签页直连。
 */
export function createNotificationTabCoordinator({
  channelName = DEFAULT_CHANNEL_NAME,
  leaseKey = DEFAULT_LEASE_KEY,
  leaseDurationMs = DEFAULT_LEASE_DURATION_MS,
  renewIntervalMs = DEFAULT_RENEW_INTERVAL_MS,
  onLeadershipChange = () => {},
  onMessage = () => {},
  now = () => Date.now()
} = {}) {
  const tabId = createTabId()
  let started = false
  let eligible = true
  let leader = false
  let roleKnown = false
  let storage = null
  let channel = null
  let renewTimer = null

  const windowLike = globalThis.window
  const setIntervalLike = windowLike?.setInterval?.bind(windowLike) || globalThis.setInterval
  const clearIntervalLike = windowLike?.clearInterval?.bind(windowLike) || globalThis.clearInterval

  function readLease() {
    if (!storage) return null
    try {
      return parseLease(storage.getItem(leaseKey))
    } catch {
      storage = null
      return null
    }
  }

  function writeLease() {
    if (!storage) return false
    try {
      storage.setItem(leaseKey, JSON.stringify({ tabId, expiresAt: now() + leaseDurationMs }))
      return readLease()?.tabId === tabId
    } catch {
      storage = null
      return false
    }
  }

  function setLeader(nextLeader) {
    const next = Boolean(nextLeader)
    if (roleKnown && leader === next) return
    roleKnown = true
    leader = next
    onLeadershipChange(leader)
  }

  function broadcast(message) {
    if (!started || !channel) return
    try {
      channel.postMessage({ ...message, sourceTabId: tabId })
    } catch {
      // 频道异常不影响当前标签页的 REST/SSE 降级路径。
    }
  }

  function tryAcquireLeadership() {
    if (!started || !eligible) {
      setLeader(false)
      return false
    }
    if (!storage) {
      setLeader(true)
      return true
    }

    const current = readLease()
    if (current && current.tabId !== tabId && current.expiresAt > now()) {
      setLeader(false)
      return false
    }

    const acquired = writeLease()
    setLeader(acquired)
    return acquired
  }

  function relinquishLeadership({ announce = true } = {}) {
    const wasLeader = leader
    if (storage) {
      try {
        if (readLease()?.tabId === tabId) storage.removeItem(leaseKey)
      } catch {
        storage = null
      }
    }
    setLeader(false)
    if (announce && wasLeader) broadcast({ type: 'coordinator.released' })
  }

  function renewOrAcquire() {
    if (!started || !eligible) return
    if (!storage) {
      setLeader(true)
      return
    }
    if (!leader) {
      tryAcquireLeadership()
      return
    }

    const current = readLease()
    if (current && current.tabId !== tabId && current.expiresAt > now()) {
      setLeader(false)
      return
    }
    if (!writeLease()) setLeader(false)
  }

  function handleStorage(event) {
    if (!started || event?.key !== leaseKey) return
    const current = readLease()
    if (leader && current?.tabId && current.tabId !== tabId && current.expiresAt > now()) {
      setLeader(false)
      return
    }
    if (eligible && (!current || current.expiresAt <= now())) tryAcquireLeadership()
  }

  function handleChannelMessage(event) {
    if (!started) return
    const message = event?.data
    if (!message || message.sourceTabId === tabId) return
    if (message.type === 'coordinator.released' && eligible) tryAcquireLeadership()
    onMessage(message)
  }

  function start({ isEligible = true } = {}) {
    if (started) return
    started = true
    eligible = Boolean(isEligible)
    try {
      storage = windowLike?.localStorage || globalThis.localStorage || null
    } catch {
      storage = null
    }
    try {
      const BroadcastChannelLike = windowLike?.BroadcastChannel || globalThis.BroadcastChannel
      channel = typeof BroadcastChannelLike === 'function' ? new BroadcastChannelLike(channelName) : null
      if (channel) channel.addEventListener('message', handleChannelMessage)
    } catch {
      channel = null
    }
    windowLike?.addEventListener?.('storage', handleStorage)
    renewTimer = setIntervalLike(renewOrAcquire, renewIntervalMs)
    tryAcquireLeadership()
  }

  function stop() {
    if (!started) return
    relinquishLeadership()
    started = false
    if (renewTimer) clearIntervalLike(renewTimer)
    renewTimer = null
    windowLike?.removeEventListener?.('storage', handleStorage)
    try {
      channel?.removeEventListener?.('message', handleChannelMessage)
      channel?.close?.()
    } catch {
      // noop
    }
    channel = null
    roleKnown = false
  }

  function setEligible(nextEligible) {
    eligible = Boolean(nextEligible)
    if (!started) return
    if (!eligible) {
      relinquishLeadership()
      return
    }
    tryAcquireLeadership()
  }

  return {
    tabId,
    start,
    stop,
    setEligible,
    broadcast,
    requestState: () => broadcast({ type: 'state.request' }),
    isLeader: () => leader
  }
}
