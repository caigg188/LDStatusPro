<template>
  <div class="app-container min-h-screen">
    <!-- 涂鸦背景 -->
    <DoodleBackground v-if="!isMaintenanceRoute" :isVisible="showDoodleBg" />
    
    <!-- 顶部导航栏 -->
    <AppHeader v-if="!isMaintenanceRoute" />
    
    <!-- 主内容区域 -->
    <main class="main-content">
      <router-view v-slot="{ Component, route }">
        <transition name="fade" mode="out-in">
          <keep-alive :include="cachedViews">
            <component :is="Component" :key="route.path" />
          </keep-alive>
        </transition>
      </router-view>
    </main>
    
    <!-- 底部导航栏（移动端） -->
    <AppFooter v-if="!isMaintenanceRoute" />
    
    <!-- 涂鸦背景开关 -->
    <CornerActionMenu v-if="!isMaintenanceRoute" v-model="showDoodleBg" />
    
    <!-- 全局消息提示 -->
    <Toast />
    
    <!-- 全局对话框 -->
    <Dialog />
    
    <!-- 全局加载遮罩 -->
    <LoadingOverlay />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { initTheme } from '@/composables/useTheme'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import Toast from '@/components/common/Toast.vue'
import Dialog from '@/components/common/Dialog.vue'
import LoadingOverlay from '@/components/common/LoadingOverlay.vue'
import DoodleBackground from '@/components/common/DoodleBackground.vue'
import CornerActionMenu from '@/components/common/CornerActionMenu.vue'

const route = useRoute()
const userStore = useUserStore()
const isMaintenanceRoute = computed(() => route.name === 'Maintenance')

// 需要缓存的页面组件名称
// Home = 首页(物品广场), Category = 分类页(小店集市等)
const cachedViews = ref(['Home', 'Category'])

// 涂鸦背景状态（默认开启，从本地存储读取）
const DOODLE_STORAGE_KEY = 'ld-store-doodle-bg'
const showDoodleBg = ref(true)

// 从本地存储恢复涂鸦背景偏好
function initDoodlePreference() {
  try {
    const saved = localStorage.getItem(DOODLE_STORAGE_KEY)
    if (saved !== null) {
      showDoodleBg.value = saved === 'true'
    }
  } catch (e) {
    // localStorage 不可用时静默失败
  }
}

// 监听变化并保存到本地存储
watch(showDoodleBg, (value) => {
  try {
    localStorage.setItem(DOODLE_STORAGE_KEY, String(value))
  } catch (e) {
    // localStorage 不可用时静默失败
  }
})

// 初始化主题
initTheme()

// 初始化
onMounted(async () => {
  // 恢复涂鸦背景偏好
  initDoodlePreference()
  // 尝试恢复用户会话
  await userStore.restoreSession()
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--bg-primary);
  transition: background-color 0.3s ease;
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
