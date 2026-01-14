import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  // Toast
  const toasts = ref([])
  let toastId = 0

  function showToast(message, type = 'info', duration = 3000) {
    const id = ++toastId
    toasts.value.push({ id, message, type, duration })
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
    
    return id
  }

  function removeToast(id) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
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
    showCancel: true,
    onConfirm: null,
    onCancel: null
  })

  function showDialog(options) {
    return new Promise((resolve) => {
      dialog.value = {
        visible: true,
        title: options.title || '提示',
        content: options.content || '',
        type: options.type || 'confirm',
        icon: options.icon || '',
        danger: options.danger || false,
        confirmText: options.confirmText || '确定',
        cancelText: options.cancelText || '取消',
        showCancel: options.showCancel !== false,
        onConfirm: () => {
          dialog.value.visible = false
          resolve(true)
        },
        onCancel: () => {
          dialog.value.visible = false
          resolve(false)
        }
      }
    })
  }

  function hideDialog() {
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

  return {
    // Toast
    toasts,
    showToast,
    removeToast,
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
    hideLoading
  }
})
