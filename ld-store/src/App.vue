<template>
  <div class="app-container min-h-screen">
    <!-- 涂鸦背景 -->
    <DoodleBackground v-if="showDecorativeShell" :isVisible="showDoodleBg" />

    <!-- 顶部导航栏 -->
    <AppHeader v-if="showHeader" />
    <AnnouncementBar v-if="showAnnouncementBar" />
    <AnnouncementPopup v-if="showAnnouncementBar" />

    <!-- 主内容区域 -->
    <main class="main-content">
      <section
        v-if="showRestrictedMaintenanceBanner"
        :class="['maintenance-banner', { 'maintenance-banner--standalone': isRestrictedHomeRoute }]"
      >
        <div class="maintenance-banner__content">
          <p class="maintenance-banner__eyebrow">受限维护中</p>
          <h2 class="maintenance-banner__title">{{ MAINTENANCE_STATE.title }}</h2>
          <p class="maintenance-banner__message">{{ MAINTENANCE_STATE.message }}</p>
        </div>
        <div class="maintenance-banner__actions">
          <router-link v-if="!userStore.isLoggedIn" to="/login" class="maintenance-banner__link">
            登录查看订单
          </router-link>
          <router-link v-if="userStore.isLoggedIn" to="/user/orders" class="maintenance-banner__link">
            我的订单
          </router-link>
          <router-link v-if="userStore.isLoggedIn" to="/user/products" class="maintenance-banner__link secondary">
            我的商品
          </router-link>
          <a :href="MAINTENANCE_STATE.statusUrl" target="_blank" rel="noreferrer" class="maintenance-banner__link tertiary">
            状态页
          </a>
        </div>
      </section>
      <router-view v-if="showRouterView" v-slot="{ Component, route }">
        <transition name="fade" mode="out-in">
          <keep-alive :include="cachedViews">
            <component :is="Component" :key="route.path" />
          </keep-alive>
        </transition>
      </router-view>
    </main>

    <!-- 底部导航栏（移动端） -->
    <AppFooter v-if="showDecorativeShell" />

    <!-- 涂鸦背景开关 -->
    <CornerActionMenu v-if="showDecorativeShell" v-model="showDoodleBg" />

    <!-- 全局消息提示 -->
    <Toast v-if="!isMaintenanceRoute" />

    <!-- 全局对话框 -->
    <Dialog v-if="!isMaintenanceRoute" />

    <!-- 全局加载遮罩 -->
    <LoadingOverlay v-if="!isMaintenanceRoute" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { initTheme } from '@/composables/useTheme'
import { useAnnouncement } from '@/composables/useAnnouncement'
import AppHeader from '@/components/layout/AppHeader.vue'
import AnnouncementBar from '@/components/common/AnnouncementBar.vue'
import AnnouncementPopup from '@/components/common/AnnouncementPopup.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import Toast from '@/components/common/Toast.vue'
import Dialog from '@/components/common/Dialog.vue'
import LoadingOverlay from '@/components/common/LoadingOverlay.vue'
import DoodleBackground from '@/components/common/DoodleBackground.vue'
import CornerActionMenu from '@/components/common/CornerActionMenu.vue'
import {
  MAINTENANCE_STATE,
  ensureMaintenanceStatusLoaded,
  isFullMaintenanceMode,
  isRestrictedMaintenanceMode,
} from '@/config/maintenance'

const route = useRoute()
const userStore = useUserStore()
const { announcementLoaded, fetchAnnouncements } = useAnnouncement()
const isMaintenanceRoute = computed(() => route.name === 'Maintenance')
const isRestrictedHomeRoute = computed(() => false)
const showRestrictedMaintenanceBanner = computed(() =>
  !isMaintenanceRoute.value && isRestrictedMaintenanceMode()
)
const hideRouteContent = computed(() => false)
const showDecorativeShell = computed(() => !isMaintenanceRoute.value)
const showHeader = computed(() => !isMaintenanceRoute.value && userStore.sessionReady)
const showAnnouncementBar = computed(() => (
  !isMaintenanceRoute.value
  && announcementLoaded.value
))
const showRouterView = computed(() => userStore.sessionReady)

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
  await ensureMaintenanceStatusLoaded()
  // 恢复涂鸦背景偏好
  initDoodlePreference()
  // 全站维护时直接展示公告页，避免触发额外初始化链路
  if (!isFullMaintenanceMode()) {
    await userStore.restoreSession()
    await fetchAnnouncements().catch(() => [])
  } else {
    userStore.sessionReady = true
  }
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

.maintenance-banner {
  width: min(100% - 24px, 1180px);
  margin: 18px auto 0;
  padding: 24px 26px;
  border: 1px solid color-mix(in srgb, #f59e0b 28%, var(--border-color));
  border-radius: 26px;
  background:
    linear-gradient(135deg, rgba(255, 248, 235, 0.96), rgba(255, 255, 255, 0.92));
  box-shadow: 0 18px 42px rgba(217, 119, 6, 0.12);
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: space-between;
}

.maintenance-banner--standalone {
  margin-top: 28px;
  min-height: clamp(320px, 58vh, 520px);
  padding: 36px 34px;
  align-items: center;
}

.maintenance-banner--standalone .maintenance-banner__content {
  max-width: 720px;
  text-align: center;
}

.maintenance-banner--standalone .maintenance-banner__actions {
  justify-content: center;
}

.maintenance-banner__content {
  min-width: 0;
}

.maintenance-banner__eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #b45309;
}

.maintenance-banner__title {
  margin: 0;
  font-size: 22px;
  color: #111827;
}

.maintenance-banner__message {
  margin: 8px 0 0;
  line-height: 1.6;
  color: #4b5563;
}

.maintenance-banner__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.maintenance-banner__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 96px;
  padding: 10px 14px;
  border-radius: 999px;
  background: #111827;
  color: #ffffff;
  font-weight: 600;
  text-decoration: none;
}

.maintenance-banner__link.secondary {
  background: #ffffff;
  color: #b45309;
  border: 1px solid rgba(245, 158, 11, 0.35);
}

.maintenance-banner__link.tertiary {
  background: rgba(255, 255, 255, 0.72);
  color: #374151;
  border: 1px solid rgba(148, 163, 184, 0.4);
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

@media (max-width: 768px) {
  .maintenance-banner {
    width: min(100% - 20px, 1180px);
    margin-top: 12px;
    padding: 20px 18px;
    border-radius: 18px;
    flex-direction: column;
  }

  .maintenance-banner--standalone {
    min-height: calc(100vh - 120px);
    padding: 28px 22px;
    justify-content: center;
  }

  .maintenance-banner__title {
    font-size: 18px;
  }

  .maintenance-banner__actions {
    width: 100%;
    justify-content: stretch;
  }

  .maintenance-banner__link {
    flex: 1 1 0;
  }
}
</style>
