import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useUserStore } from '@/stores/user'
import { useUiStore } from '@/stores/ui'
import { AUTH_EXPIRED_EVENT } from '@/utils/auth'
import './styles/main.css'

// 创建应用实例
const app = createApp(App)
const pinia = createPinia()

// 使用 Pinia 状态管理
app.use(pinia)

// 使用路由
app.use(router)

// 全局认证失效处理：清理登录态 + 提示 + 跳转登录
if (typeof window !== 'undefined' && !window.__LD_STORE_AUTH_EXPIRED_HANDLER__) {
  window.__LD_STORE_AUTH_EXPIRED_HANDLER__ = true
  window.addEventListener(AUTH_EXPIRED_EVENT, () => {
    const userStore = useUserStore(pinia)
    const uiStore = useUiStore(pinia)
    const hadSession = !!userStore.token || !!userStore.user

    userStore.logout()
    if (hadSession) {
      uiStore.showToast('登录已过期，请重新登录', 'warning', 3200)
    }

    const currentRoute = router.currentRoute.value
    if (currentRoute?.name === 'Login' || currentRoute?.name === 'AuthCallback') return

    const redirect = currentRoute?.fullPath && currentRoute.fullPath !== '/login'
      ? currentRoute.fullPath
      : '/'

    router.replace({
      name: 'Login',
      query: { redirect, reason: 'expired' }
    }).catch(() => {})
  })
}

// 全局错误处理
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue Error:', err, info)
}

// 挂载应用
app.mount('#app')
