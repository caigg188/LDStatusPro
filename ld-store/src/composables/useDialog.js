import { useUiStore } from '@/stores/ui'

/**
 * 对话框组合式函数
 */
export function useDialog() {
  const uiStore = useUiStore()

  // 显示确认对话框
  function confirm(content, options = {}) {
    return uiStore.confirm(content, {
      title: '确认',
      ...options
    })
  }

  // 显示警告确认对话框
  function confirmDanger(content, options = {}) {
    return uiStore.confirm(content, {
      title: '确认',
      danger: true,
      ...options
    })
  }

  // 显示提示对话框
  function alert(content, options = {}) {
    return uiStore.alert(content, {
      title: '提示',
      ...options
    })
  }

  // 显示成功提示
  function success(content, options = {}) {
    return uiStore.alert(content, {
      title: '成功',
      icon: '✅',
      ...options
    })
  }

  // 显示错误提示
  function error(content, options = {}) {
    return uiStore.alert(content, {
      title: '错误',
      icon: '❌',
      ...options
    })
  }

  return {
    confirm,
    confirmDanger,
    alert,
    success,
    error
  }
}
