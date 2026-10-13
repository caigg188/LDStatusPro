import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useUserStore } from '@/stores/user'
import { useUiStore } from '@/stores/ui'
import { initTheme } from '@/composables/useTheme'
import { AUTH_EXPIRED_EVENT, authSession, startAuthSessionSync, stopAuthSessionSync } from '@/utils/auth'
import { captureStorefrontError, initializeStorefrontTelemetry } from '@/observability/faro'
import { initializeMxaAnalytics } from '@/observability/mxa'
import './styles/tokens.css'
import './styles/main.css'
import './styles/markdown-content.css'
import './styles/seller.css'

// 可选客户端基础设施异步启动；初始化失败不得阻塞商城渲染或业务请求。
void initializeStorefrontTelemetry(router)
void initializeMxaAnalytics()

// 创建应用实例
const app = createApp(App)
const pinia = createPinia()

// 使用 Pinia 状态管理
app.use(pinia)

// 在首次挂载前同步恢复本地 UI 与会话状态，避免先渲染空壳再整体补上页面。
initTheme()
const globalUserStore = useUserStore(pinia)
globalUserStore.restoreSession()

const globalUiStore = useUiStore(pinia)

// 路由模块或数据分包首次加载时提供轻量反馈，不阻塞页面交互。
router.beforeEach(() => {
  globalUiStore.startRouteLoading()
  return true
})
router.afterEach(() => {
  globalUiStore.finishRouteLoading()
})
router.onError((error, to) => {
  globalUiStore.finishRouteLoading()
  captureStorefrontError(error, {
    source: 'router',
    route: to?.matched?.[to.matched.length - 1]?.path || to?.name || 'unknown'
  })
})

// 使用路由
app.use(router)

const CHUNK_RETRY_MARK_KEY = 'ld_store_chunk_retry_mark'

function isDynamicImportError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  if (!message) return false

  return (
    message.includes('failed to fetch dynamically imported module')
    || message.includes('error loading dynamically imported module')
    || message.includes('importing a module script failed')
    || message.includes('chunkloaderror')
    || (message.includes('loading') && message.includes('chunk'))
  )
}

function getRetryMark(targetPath) {
  return `path:${String(targetPath || '')}`
}

// 全局动态分包兜底：首次失败自动强刷，二次失败给出提示，避免首页空白无提示
if (typeof window !== 'undefined' && !window.__LD_STORE_CHUNK_ERROR_HANDLER__) {
  window.__LD_STORE_CHUNK_ERROR_HANDLER__ = true

  router.onError((error, to) => {
    if (!isDynamicImportError(error)) return

    const targetPath = to?.fullPath || `${window.location.pathname}${window.location.search}${window.location.hash}`
    const retryMark = getRetryMark(targetPath)
    let previousMark = ''

    try {
      previousMark = sessionStorage.getItem(CHUNK_RETRY_MARK_KEY) || ''
    } catch {
      previousMark = ''
    }

    if (previousMark !== retryMark) {
      try {
        sessionStorage.setItem(CHUNK_RETRY_MARK_KEY, retryMark)
      } catch {
        // ignore sessionStorage errors
      }

      const retryUrl = new URL(window.location.href)
      retryUrl.searchParams.set('__chunk_retry', String(Date.now()))
      window.location.replace(retryUrl.toString())
      return
    }

    try {
      sessionStorage.removeItem(CHUNK_RETRY_MARK_KEY)
    } catch {
      // ignore sessionStorage errors
    }

    const uiStore = useUiStore(pinia)
    uiStore.showDialog({
      title: '页面资源加载失败',
      content: '站点刚完成更新或网络缓存异常，页面资源未能同步完成。点击确定后将为你重新加载最新页面。',
      type: 'alert',
      confirmText: '重新加载',
      showCancel: false
    }).then(() => {
      const retryUrl = new URL(window.location.href)
      retryUrl.searchParams.set('__chunk_retry_manual', String(Date.now()))
      window.location.replace(retryUrl.toString())
    })
  })

  router.afterEach(() => {
    try {
      sessionStorage.removeItem(CHUNK_RETRY_MARK_KEY)
    } catch {
      // ignore sessionStorage errors
    }
  })
}

// 全局认证失效处理：清理登录态 + 提示 + 跳转登录
if (typeof window !== 'undefined' && !window.__LD_STORE_AUTH_EXPIRED_HANDLER__) {
  window.__LD_STORE_AUTH_EXPIRED_HANDLER__ = true
  window.addEventListener(AUTH_EXPIRED_EVENT, event => {
    // 失效事件已由会话管理器清理对应凭据；不能再次清理后来登录的会话。
    if (event.detail?.revision !== authSession.value.revision || authSession.value.token) return
    globalUiStore.showToast('登录已过期，请重新登录', 'warning', 3200)
    const currentRoute = router.currentRoute.value
    if (currentRoute?.name === 'Login' || currentRoute?.name === 'AuthCallback') return
    router.replace({ name: 'Login', query: { redirect: currentRoute?.fullPath || '/', reason: 'expired' } }).catch(() => {})
  })
}

// storage 事件负责跨标签页同步，focus/visibility 负责休眠恢复时校准。
watch(authSession, session => {
  const currentRoute = router.currentRoute.value
  if (!session.token && session.reason === 'storage' && currentRoute.matched.some(record => record.meta.requiresAuth)) {
    router.replace({ name: 'Login', query: { redirect: currentRoute.fullPath } }).catch(() => {})
  }
}, { flush: 'sync' })
startAuthSessionSync()
if (import.meta.hot) import.meta.hot.dispose(stopAuthSessionSync)

// 全局错误处理
app.config.errorHandler = (err, vm, info) => {
  captureStorefrontError(err, {
    source: 'vue',
    component: vm?.$options?.name || vm?.$options?.__name || 'anonymous',
    info
  })
  console.error('Vue Error:', err, info)
}

// 挂载应用
app.mount('#app')
