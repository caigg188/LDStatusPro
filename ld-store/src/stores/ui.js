import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { authSession, captureAuthSession, isAuthSessionCurrent } from '@/utils/auth'

export const TOAST_TYPES = Object.freeze(['success', 'error', 'warning', 'info', 'loading'])
export const TOAST_DURATIONS = Object.freeze({
  success: 3000,
  error: 5000,
  warning: 5000,
  info: 4000,
  loading: 0
})
export const MAX_ACTIVE_TOASTS = 3

export const useUiStore = defineStore('ui', () => {
  // Toast
  const toasts = ref([])
  const toastTimers = new Map()
  const pausedToastIds = new Set()
  let toastId = 0

  function normalizeToastType(type) {
    return TOAST_TYPES.includes(type) ? type : 'info'
  }

  function resolveToastDuration(type, duration) {
    if (duration === undefined) return TOAST_DURATIONS[type]
    const normalized = Number(duration)
    return Number.isFinite(normalized) ? Math.max(0, normalized) : TOAST_DURATIONS[type]
  }

  function clearToastTimer(id) {
    const timer = toastTimers.get(id)
    if (timer?.handle) clearTimeout(timer.handle)
    toastTimers.delete(id)
  }

  function startToastTimer(id, remaining) {
    clearToastTimer(id)
    if (remaining <= 0) return

    const timer = {
      handle: null,
      remaining,
      startedAt: 0
    }

    if (!pausedToastIds.has(id)) {
      timer.startedAt = Date.now()
      timer.handle = setTimeout(() => removeToast(id), remaining)
    }

    toastTimers.set(id, timer)
  }

  function showToast(message, type = 'info', duration) {
    const normalizedType = normalizeToastType(type)
    const normalizedMessage = String(message ?? '')
    const normalizedDuration = resolveToastDuration(normalizedType, duration)
    const duplicate = toasts.value.find(toast => (
      toast.type === normalizedType && toast.message === normalizedMessage
    ))

    if (duplicate) {
      duplicate.duration = normalizedDuration
      duplicate.timerRevision = (duplicate.timerRevision || 0) + 1
      duplicate.paused = pausedToastIds.has(duplicate.id)
      startToastTimer(duplicate.id, normalizedDuration)
      return duplicate.id
    }

    while (toasts.value.length >= MAX_ACTIVE_TOASTS) {
      removeToast(toasts.value[0].id)
    }

    const id = ++toastId
    toasts.value.push({
      id,
      message: normalizedMessage,
      type: normalizedType,
      duration: normalizedDuration,
      timerRevision: 1,
      paused: false
    })
    startToastTimer(id, normalizedDuration)
    return id
  }

  function updateToast(id, updates = {}) {
    const index = toasts.value.findIndex(toast => toast.id === id)
    if (index < 0) {
      if (updates.message === undefined) return null
      return showToast(updates.message, updates.type || 'info', updates.duration)
    }

    const current = toasts.value[index]
    const nextType = normalizeToastType(updates.type ?? current.type)
    const nextMessage = updates.message === undefined
      ? current.message
      : String(updates.message ?? '')
    const nextDuration = resolveToastDuration(nextType, updates.duration)

    toasts.value[index] = {
      ...current,
      message: nextMessage,
      type: nextType,
      duration: nextDuration,
      timerRevision: (current.timerRevision || 0) + 1,
      paused: pausedToastIds.has(id)
    }
    startToastTimer(id, nextDuration)
    return id
  }

  function pauseToast(id) {
    const toast = toasts.value.find(item => item.id === id)
    if (!toast) return

    pausedToastIds.add(id)
    toast.paused = true
    const timer = toastTimers.get(id)
    if (!timer?.handle) return

    clearTimeout(timer.handle)
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt))
    timer.startedAt = 0
    timer.handle = null
    if (timer.remaining <= 0) removeToast(id)
  }

  function resumeToast(id) {
    pausedToastIds.delete(id)
    const toast = toasts.value.find(item => item.id === id)
    if (!toast) return

    toast.paused = false
    const timer = toastTimers.get(id)
    if (!timer || timer.handle) return
    if (timer.remaining <= 0) {
      removeToast(id)
      return
    }

    startToastTimer(id, timer.remaining)
  }

  function removeToast(id) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
    pausedToastIds.delete(id)
    clearToastTimer(id)
  }

  function clearToasts() {
    toasts.value.forEach(toast => clearToastTimer(toast.id))
    pausedToastIds.clear()
    toasts.value = []
  }

  // Dialog
  const dialog = ref({
    visible: false,
    title: '',
    content: '',
    type: 'confirm', // confirm, alert, custom
    icon: '',
    danger: false,
    confirmText: '确定',
    cancelText: '取消',
    secondaryText: '',
    showCancel: true,
    onConfirm: null,
    onCancel: null,
    onSecondary: null
  })

  watch(authSession, () => { if (dialog.value.visible) dialog.value.onCancel?.() }, { flush: 'sync' })

  function showDialog(options) {
    const session = captureAuthSession()
    if (session.changed) return Promise.resolve(false)
    if (dialog.value.visible) dialog.value.onCancel?.()
    return new Promise((resolve) => {
      dialog.value = {
        visible: true,
        title: options.title || '提示',
        content: String(options.content ?? ''),
        type: options.type || 'confirm',
        icon: options.icon || '',
        danger: options.danger || false,
        confirmText: options.confirmText || '确定',
        cancelText: options.cancelText || '取消',
        secondaryText: options.secondaryText || '',
        showCancel: options.showCancel !== false,
        onConfirm: () => {
          dialog.value.visible = false
          resolve(true)
        },
        onCancel: () => {
          dialog.value.visible = false
          resolve(false)
        },
        onSecondary: () => {
          dialog.value.visible = false
          resolve(false)
          if (isAuthSessionCurrent(session) && typeof options.onSecondary === 'function') {
            options.onSecondary()
          }
        }
      }
    }).then(result => result && isAuthSessionCurrent(session))
  }

  function hideDialog() {
    dialog.value.onCancel?.()
    dialog.value.visible = false
  }

  function alert(content, options = {}) {
    return showDialog({
      ...options,
      content,
      type: 'alert',
      showCancel: false
    })
  }

  function confirm(content, options = {}) {
    return showDialog({
      ...options,
      content,
      type: 'confirm'
    })
  }

  // Loading Overlay
  const globalLoading = ref(false)
  const loadingText = ref('加载中...')

  function showLoading(text = '加载中...') {
    loadingText.value = text
    globalLoading.value = true
  }

  function hideLoading() {
    globalLoading.value = false
  }

  // Route navigation progress (kept separate from the blocking global overlay)
  const routeLoading = ref(false)
  let activeRouteLoads = 0

  function startRouteLoading() {
    activeRouteLoads += 1
    routeLoading.value = true
  }

  function finishRouteLoading() {
    activeRouteLoads = Math.max(0, activeRouteLoads - 1)
    routeLoading.value = activeRouteLoads > 0
  }

  return {
    // Toast
    toasts,
    showToast,
    updateToast,
    pauseToast,
    resumeToast,
    removeToast,
    clearToasts,
    // Dialog
    dialog,
    showDialog,
    hideDialog,
    alert,
    confirm,
    // Loading
    globalLoading,
    loadingText,
    showLoading,
    hideLoading,
    // Route navigation
    routeLoading,
    startRouteLoading,
    finishRouteLoading
  }
})
