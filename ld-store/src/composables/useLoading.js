import { useUiStore } from '@/stores/ui'

/**
 * 全局加载状态组合式函数
 */
export function useLoading() {
  const uiStore = useUiStore()

  // 显示加载
  function show(text = '加载中...') {
    uiStore.showLoading(text)
  }

  // 隐藏加载
  function hide() {
    uiStore.hideLoading()
  }

  // 执行异步操作并显示加载状态
  async function withLoading(fn, text = '加载中...') {
    show(text)
    try {
      return await fn()
    } finally {
      hide()
    }
  }

  return {
    show,
    hide,
    withLoading
  }
}
