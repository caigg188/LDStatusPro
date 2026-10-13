import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchNotificationSummaryRequest, openNotificationStreamRequest } from '@/services/shop/messageService'
import { authSession } from '@/utils/auth'
import { consumeSseStream } from '@/utils/sse'
import { createNotificationTabCoordinator } from '@/utils/notificationTabCoordinator'

const FALLBACK_INTERVAL_MS = 60_000
const HIDDEN_DISCONNECT_MS = 60_000
const CONNECT_TIMEOUT_MS = 15_000
const STREAM_STALE_MS = 70_000
const STREAM_WATCHDOG_INTERVAL_MS = 15_000
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000]
const CONNECTION_LIMIT_RETRY_MS = 60_000
const RECOVERY_SNAPSHOT_MIN_INTERVAL_MS = 60_000

function normalizeCount(value) {
  const count = Number(value)
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
}

export function normalizeNotificationSummary(data = {}) {
  return {
    totalUnread: normalizeCount(data.totalUnread),
    systemUnread: normalizeCount(data.systemUnread),
    buyChatUnread: normalizeCount(data.buyChatUnread),
    sellerPendingDeliveryCount: normalizeCount(data.sellerPendingDeliveryCount),
    sellerRefundPendingCount: normalizeCount(data.sellerRefundPendingCount),
    sessionsWithUnread: normalizeCount(data.sessionsWithUnread),
    totalSessions: normalizeCount(data.totalSessions),
    generatedAt: normalizeCount(data.generatedAt)
  }
}

export const useNotificationSummaryStore = defineStore('notification-summary', () => {
  const totalUnread = ref(0)
  const systemUnread = ref(0)
  const buyChatUnread = ref(0)
  const sellerPendingDeliveryCount = ref(0)
  const sellerRefundPendingCount = ref(0)
  const sessionsWithUnread = ref(0)
  const totalSessions = ref(0)
  const connectionState = ref('idle')
  const lastSuccessfulSyncAt = ref(0)
  const isRealtimeConnected = computed(() => ['open', 'shared'].includes(connectionState.value))

  let activeRequest = null
  let latestRequestId = 0
  let streamController = null
  let streamGeneration = 0
  let reconnectAttempt = 0
  let reconnectTimer = null
  let fallbackTimer = null
  let hiddenTimer = null
  let connectTimer = null
  let streamWatchdogTimer = null
  let lastStreamActivityAt = 0
  let lastRecoverySnapshotAt = 0
  let streamCloseReason = ''
  let streamCloseRetryAfterMs = 0
  let tabCoordinator = null
  let isConnectionOwner = true
  let started = false
  let listenersAttached = false
  const eventSubscribers = new Set()

  function currentSummary() {
    return {
      totalUnread: totalUnread.value,
      systemUnread: systemUnread.value,
      buyChatUnread: buyChatUnread.value,
      sellerPendingDeliveryCount: sellerPendingDeliveryCount.value,
      sellerRefundPendingCount: sellerRefundPendingCount.value,
      sessionsWithUnread: sessionsWithUnread.value,
      totalSessions: totalSessions.value,
      generatedAt: lastSuccessfulSyncAt.value
    }
  }

  function broadcast(message) {
    if (isConnectionOwner) tabCoordinator?.broadcast(message)
  }

  function broadcastSummary() {
    broadcast({ type: 'summary.updated', data: currentSummary() })
  }

  function setConnectionState(nextState) {
    connectionState.value = nextState
    broadcast({ type: 'connection.state', state: nextState })
  }

  function commitSummary(data, { trackSync = true, share = true } = {}) {
    const summary = normalizeNotificationSummary(data)
    totalUnread.value = summary.totalUnread
    systemUnread.value = summary.systemUnread
    buyChatUnread.value = summary.buyChatUnread
    sellerPendingDeliveryCount.value = summary.sellerPendingDeliveryCount
    sellerRefundPendingCount.value = summary.sellerRefundPendingCount
    sessionsWithUnread.value = summary.sessionsWithUnread
    totalSessions.value = summary.totalSessions
    if (trackSync) lastSuccessfulSyncAt.value = summary.generatedAt || Date.now()
    if (share) broadcastSummary()
  }

  function applyServerSummary(data) {
    latestRequestId += 1
    commitSummary(data)
  }

  function setSystemUnread(value) {
    latestRequestId += 1
    systemUnread.value = normalizeCount(value)
    totalUnread.value = systemUnread.value + buyChatUnread.value
    broadcastSummary()
  }

  function setBuyChatSummary(data = {}) {
    latestRequestId += 1
    buyChatUnread.value = normalizeCount(data.totalUnread ?? data.buyChatUnread)
    sessionsWithUnread.value = normalizeCount(data.sessionsWithUnread)
    if (data.totalSessions !== undefined) totalSessions.value = normalizeCount(data.totalSessions)
    totalUnread.value = systemUnread.value + buyChatUnread.value
    broadcastSummary()
  }

  function markSystemRead(count = 1) {
    latestRequestId += 1
    systemUnread.value = Math.max(0, systemUnread.value - normalizeCount(count))
    totalUnread.value = systemUnread.value + buyChatUnread.value
    broadcastSummary()
  }

  function markAllSystemRead() {
    latestRequestId += 1
    systemUnread.value = 0
    totalUnread.value = buyChatUnread.value
    broadcastSummary()
  }

  function markBuyChatRead(count = 0) {
    latestRequestId += 1
    buyChatUnread.value = Math.max(0, buyChatUnread.value - normalizeCount(count))
    if (count > 0) sessionsWithUnread.value = Math.max(0, sessionsWithUnread.value - 1)
    totalUnread.value = systemUnread.value + buyChatUnread.value
    broadcastSummary()
  }

  async function refresh({ force = false } = {}) {
    if (!force && activeRequest) return activeRequest
    const requestId = ++latestRequestId
    const request = fetchNotificationSummaryRequest()
      .then(result => {
        if (result?.success && requestId === latestRequestId) commitSummary(result.data)
        return result
      })
      .catch(() => null)
    activeRequest = request
    try {
      return await request
    } finally {
      if (activeRequest === request) activeRequest = null
    }
  }

  function emitDomainEvent(event, { share = true } = {}) {
    for (const subscriber of [...eventSubscribers]) {
      try {
        subscriber(event)
      } catch {
        // 页面订阅者异常不得中断全局消息流。
      }
    }
    if (share) broadcast({ type: 'domain.event', event })
  }

  function handleSseEvent(frame) {
    let data = {}
    try {
      data = frame.data ? JSON.parse(frame.data) : {}
    } catch {
      return
    }
    if (frame.event === 'summary.updated') {
      applyServerSummary(data)
      return
    }
    if (frame.event === 'ready') {
      reconnectAttempt = 0
      return
    }
    if (frame.event === 'stream.closed') {
      streamCloseReason = String(data.reason || 'server_closed')
      streamCloseRetryAfterMs = normalizeCount(data.retryAfterMs)
      return
    }
    if (['system-message.changed', 'buy-message.created', 'seller-task.changed'].includes(frame.event)) {
      emitDomainEvent({ type: frame.event, data })
    }
  }

  function clearReconnectTimer() {
    if (reconnectTimer) window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  function clearFallbackTimer() {
    if (fallbackTimer) window.clearInterval(fallbackTimer)
    fallbackTimer = null
  }

  function clearStreamTimers() {
    if (connectTimer) window.clearTimeout(connectTimer)
    if (streamWatchdogTimer) window.clearInterval(streamWatchdogTimer)
    connectTimer = null
    streamWatchdogTimer = null
    lastStreamActivityAt = 0
  }

  function startStreamWatchdog(controller) {
    clearStreamTimers()
    lastStreamActivityAt = Date.now()
    streamWatchdogTimer = window.setInterval(() => {
      if (streamController !== controller || controller.signal.aborted) return
      if (Date.now() - lastStreamActivityAt > STREAM_STALE_MS) controller.abort()
    }, STREAM_WATCHDOG_INTERVAL_MS)
  }

  function startFallbackPolling() {
    if (!isConnectionOwner || fallbackTimer || typeof window === 'undefined') return
    fallbackTimer = window.setInterval(() => {
      if (!started || !isConnectionOwner || connectionState.value === 'open' || document.visibilityState === 'hidden' || !navigator.onLine) return
      refresh({ force: true })
    }, FALLBACK_INTERVAL_MS)
  }

  function scheduleReconnect(minimumDelayMs = 0) {
    if (!started || !isConnectionOwner || typeof window === 'undefined' || document.visibilityState === 'hidden' || !navigator.onLine) return
    clearReconnectTimer()
    const backoffDelay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]
    const delay = Math.max(backoffDelay, normalizeCount(minimumDelayMs))
    reconnectAttempt += 1
    setConnectionState(minimumDelayMs >= CONNECTION_LIMIT_RETRY_MS ? 'limited' : 'retrying')
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      connectStream()
    }, delay)
  }

  function refreshRecoverySnapshot() {
    if (!isConnectionOwner) return
    const now = Date.now()
    if (now - lastRecoverySnapshotAt < RECOVERY_SNAPSHOT_MIN_INTERVAL_MS) return
    if (lastSuccessfulSyncAt.value > 0 && now - lastSuccessfulSyncAt.value < RECOVERY_SNAPSHOT_MIN_INTERVAL_MS) return
    lastRecoverySnapshotAt = now
    void refresh({ force: true })
  }

  function abortStream(nextState = 'idle') {
    streamGeneration += 1
    clearStreamTimers()
    const controller = streamController
    streamController = null
    if (controller && !controller.signal.aborted) controller.abort()
    setConnectionState(nextState)
  }

  async function connectStream() {
    if (!started || !isConnectionOwner || streamController || typeof window === 'undefined') return
    if (document.visibilityState === 'hidden' || !navigator.onLine) return

    clearReconnectTimer()
    const generation = ++streamGeneration
    const controller = new AbortController()
    streamController = controller
    streamCloseReason = ''
    streamCloseRetryAfterMs = 0
    setConnectionState('connecting')

    connectTimer = window.setTimeout(() => {
      if (streamController === controller && !controller.signal.aborted) controller.abort()
    }, CONNECT_TIMEOUT_MS)

    const result = await openNotificationStreamRequest(controller.signal)
    if (generation !== streamGeneration) return
    if (connectTimer) window.clearTimeout(connectTimer)
    connectTimer = null
    if (controller.signal.aborted) {
      streamController = null
      if (started && isConnectionOwner && document.visibilityState !== 'hidden' && navigator.onLine) {
        startFallbackPolling()
        refreshRecoverySnapshot()
        scheduleReconnect()
      }
      return
    }
    if (!result?.success) {
      streamController = null
      if (result?.status === 401) {
        setConnectionState('idle')
        return
      }
      startFallbackPolling()
      refreshRecoverySnapshot()
      scheduleReconnect()
      return
    }

    setConnectionState('open')
    clearFallbackTimer()
    startStreamWatchdog(controller)
    try {
      await consumeSseStream(result.response.body, {
        signal: controller.signal,
        onEvent: handleSseEvent,
        onActivity: () => { lastStreamActivityAt = Date.now() }
      })
    } catch {
      // 连接中断统一在 finally 中进入低频兜底与重连。
    } finally {
      if (generation === streamGeneration) {
        clearStreamTimers()
        streamController = null
        if (started && isConnectionOwner && document.visibilityState !== 'hidden' && navigator.onLine) {
          startFallbackPolling()
          refreshRecoverySnapshot()
          const retryAfterMs = streamCloseReason === 'connection_limit'
            ? Math.max(CONNECTION_LIMIT_RETRY_MS, streamCloseRetryAfterMs)
            : streamCloseRetryAfterMs
          scheduleReconnect(retryAfterMs)
        }
      }
    }
  }

  function handleCoordinatorMessage(message) {
    if (!message || typeof message !== 'object') return
    if (message.type === 'state.request') {
      if (isConnectionOwner) {
        broadcastSummary()
        broadcast({ type: 'connection.state', state: connectionState.value })
      }
      return
    }
    if (isConnectionOwner) return

    if (message.type === 'summary.updated') {
      latestRequestId += 1
      commitSummary(message.data, { share: false })
      return
    }
    if (message.type === 'domain.event') {
      emitDomainEvent(message.event, { share: false })
      return
    }
    if (message.type === 'connection.state') {
      connectionState.value = message.state === 'open' ? 'shared' : String(message.state || 'shared')
    }
  }

  function handleLeadershipChange(isLeader) {
    if (!started) return
    if (isLeader) {
      isConnectionOwner = true
      setConnectionState('idle')
      startFallbackPolling()
      connectStream()
      return
    }

    isConnectionOwner = false
    clearReconnectTimer()
    clearFallbackTimer()
    abortStream('shared')
    tabCoordinator?.requestState()
  }

  function startTabCoordinator() {
    const identity = JSON.stringify([authSession.value.user?.site, authSession.value.user?.id])
    tabCoordinator = createNotificationTabCoordinator({
      channelName: `ld-store-notification-summary-v2:${identity}`,
      leaseKey: `ld-store-notification-leader-v2:${identity}`,
      onLeadershipChange: handleLeadershipChange,
      onMessage: handleCoordinatorMessage
    })
    tabCoordinator.start({
      isEligible: document.visibilityState !== 'hidden' && navigator.onLine
    })
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      if (hiddenTimer) window.clearTimeout(hiddenTimer)
      hiddenTimer = window.setTimeout(() => {
        hiddenTimer = null
        if (document.visibilityState === 'hidden') {
          tabCoordinator?.setEligible(false)
          if (!tabCoordinator) abortStream('paused')
        }
      }, HIDDEN_DISCONNECT_MS)
      return
    }
    if (hiddenTimer) window.clearTimeout(hiddenTimer)
    hiddenTimer = null
    tabCoordinator?.setEligible(navigator.onLine)
    tabCoordinator?.requestState()
    if (!tabCoordinator) {
      refreshRecoverySnapshot()
      connectStream()
    }
  }

  function handleOnline() {
    tabCoordinator?.setEligible(document.visibilityState !== 'hidden')
    tabCoordinator?.requestState()
    if (!tabCoordinator) {
      refreshRecoverySnapshot()
      connectStream()
    }
  }

  function handleOffline() {
    tabCoordinator?.setEligible(false)
    if (!tabCoordinator) abortStream('offline')
  }

  function attachLifecycleListeners() {
    if (listenersAttached || typeof window === 'undefined') return
    listenersAttached = true
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  function detachLifecycleListeners() {
    if (!listenersAttached || typeof window === 'undefined') return
    listenersAttached = false
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }

  function startRealtime() {
    if (started || typeof window === 'undefined') return
    started = true
    attachLifecycleListeners()
    void refresh({ force: true })
    startTabCoordinator()
  }

  function stopRealtime({ clear = true } = {}) {
    started = false
    tabCoordinator?.stop()
    tabCoordinator = null
    isConnectionOwner = true
    clearReconnectTimer()
    clearFallbackTimer()
    if (hiddenTimer) window.clearTimeout(hiddenTimer)
    hiddenTimer = null
    detachLifecycleListeners()
    abortStream('idle')
    reconnectAttempt = 0
    streamCloseReason = ''
    streamCloseRetryAfterMs = 0
    lastRecoverySnapshotAt = 0
    if (clear) reset()
  }

  function subscribeEvents(handler) {
    if (typeof handler !== 'function') return () => {}
    eventSubscribers.add(handler)
    return () => eventSubscribers.delete(handler)
  }

  function reset() {
    latestRequestId += 1
    activeRequest = null
    commitSummary({}, { trackSync: false })
    lastSuccessfulSyncAt.value = 0
  }

  return {
    totalUnread,
    systemUnread,
    buyChatUnread,
    sellerPendingDeliveryCount,
    sellerRefundPendingCount,
    sessionsWithUnread,
    totalSessions,
    connectionState,
    isRealtimeConnected,
    lastSuccessfulSyncAt,
    refresh,
    reset,
    startRealtime,
    stopRealtime,
    subscribeEvents,
    setSystemUnread,
    setBuyChatSummary,
    markSystemRead,
    markAllSystemRead,
    markBuyChatRead
  }
})
