<template>
  <div class="app-container min-h-screen bg-morandi-50">
    <!-- 顶部导航栏 -->
    <AppHeader />
    
    <!-- 主内容区域 -->
    <main class="main-content">
      <router-view v-slot="{ Component, route }">
        <transition name="fade" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </main>
    
    <!-- 底部导航栏（移动端） -->
    <AppFooter />
    
    <!-- 全局消息提示 -->
    <Toast />
    
    <!-- 全局对话框 -->
    <Dialog />
    
    <!-- 全局加载遮罩 -->
    <LoadingOverlay />
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import Toast from '@/components/common/Toast.vue'
import Dialog from '@/components/common/Dialog.vue'
import LoadingOverlay from '@/components/common/LoadingOverlay.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// 初始化
onMounted(async () => {
  // 尝试恢复用户会话
  await userStore.restoreSession()
})

// 路由变化时滚动到顶部
watch(() => route.path, () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

/* 页面切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
