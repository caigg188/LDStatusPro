<template>
  <div class="app-container min-h-screen">
    <NavigationProgress />

    <!-- 涂鸦背景 -->
    <DoodleBackground v-if="showDecorativeShell" :isVisible="showDoodleBg" />

    <!-- 顶部导航栏 -->
    <AppHeader v-if="showHeader" />
    <AnnouncementBar v-if="showAnnouncementBar" />
    <AnnouncementPopup v-if="!isMaintenanceRoute && !isBareRoute && announcementLoaded" />

    <!-- 主内容区域 -->
    <component :is="isSellerRoute ? 'div' : 'main'" class="main-content">
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
          <router-link v-if="userStore.isLoggedIn" to="/seller/products" class="maintenance-banner__link secondary">
            我的商品
          </router-link>
          <a :href="MAINTENANCE_STATE.statusUrl" target="_blank" rel="noreferrer" class="maintenance-banner__link tertiary">
            状态页
          </a>
        </div>
      </section>
      <router-view v-if="showRouterView" v-slot="{ Component, route }">
        <transition name="fade" mode="out-in">
          <keep-alive :key="route.name === 'AuthCallback' ? 'auth-callback' : userStore.sessionKey" :include="cachedViews" :max="12">
            <component :is="Component" :key="resolveAppViewKey(route)" />
          </keep-alive>
        </transition>
      </router-view>
    </component>

    <!-- 底部导航栏（移动端） -->
    <AppFooter v-if="showDecorativeShell" />

    <!-- 涂鸦背景开关 -->
    <CornerActionMenu v-if="showDecorativeShell" v-model="showDoodleBg" />

    <!-- 全局消息提示 -->
    <Toast v-if="!isMaintenanceRoute" :below-header="showHeader" />

    <!-- 全局对话框 -->
    <Dialog v-if="!isMaintenanceRoute" />

    <!-- 全局加载遮罩 -->
    <LoadingOverlay v-if="!isMaintenanceRoute" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useNotificationSummaryStore } from '@/stores/notificationSummary'
import { announcementIdentity } from '@/utils/announcementPreferences'
import { useAnnouncement } from '@/composables/useAnnouncement'
import AppHeader from '@/components/layout/AppHeader.vue'
import AnnouncementBar from '@/components/common/AnnouncementBar.vue'
import AnnouncementPopup from '@/components/common/AnnouncementPopup.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import Toast from '@/components/common/Toast.vue'
import Dialog from '@/components/common/Dialog.vue'
import LoadingOverlay from '@/components/common/LoadingOverlay.vue'
import NavigationProgress from '@/components/common/NavigationProgress.vue'
import DoodleBackground from '@/components/common/DoodleBackground.vue'
import CornerActionMenu from '@/components/common/CornerActionMenu.vue'
import { resolveAppViewKey } from '@/utils/sellerNavigation'
import {
  MAINTENANCE_STATE,
  isFullMaintenanceMode,
  isRestrictedMaintenanceMode,
} from '@/config/maintenance'

const route = useRoute()
const userStore = useUserStore()
const notificationSummaryStore = useNotificationSummaryStore()
const { announcementLoaded, configureAnnouncements, startAnnouncements, stopAnnouncements } = useAnnouncement()
const isMaintenanceRoute = computed(() => route.name === 'Maintenance')
const isBareRoute = computed(() => route.meta.bare === true)
const isSellerRoute = computed(() => route.meta.layout === 'seller')
const isRestrictedHomeRoute = computed(() => false)
const showRestrictedMaintenanceBanner = computed(() =>
  !isMaintenanceRoute.value && !isSellerRoute.value && !isBareRoute.value && isRestrictedMaintenanceMode()
)
const showDecorativeShell = computed(() => !isMaintenanceRoute.value && !isSellerRoute.value && !isBareRoute.value)
const showHeader = computed(() => !isMaintenanceRoute.value && !isSellerRoute.value && !isBareRoute.value && userStore.sessionReady)
const showAnnouncementBar = computed(() => (
  !isMaintenanceRoute.value
  && !isSellerRoute.value
  && !isBareRoute.value
  && announcementLoaded.value
))
watch([() => announcementIdentity(userStore), isSellerRoute], ([account, seller]) => configureAnnouncements(account, seller ? 'seller' : 'storefront'), { immediate: true })
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

// 偏好是同步本地状态，必须在首次渲染前恢复，避免背景装饰先出现再消失。
initDoodlePreference()

// 监听变化并保存到本地存储
watch(showDoodleBg, (value) => {
  try {
    localStorage.setItem(DOODLE_STORAGE_KEY, String(value))
  } catch (e) {
    // localStorage 不可用时静默失败
  }
})

onUnmounted(stopAnnouncements)

// 初始化
onMounted(() => {
  // 全站维护时避免触发额外初始化链路
  if (!isFullMaintenanceMode()) {
    startAnnouncements()
  }
})

watch(
  [() => userStore.sessionReady, () => userStore.isLoggedIn, () => userStore.sessionKey],
  ([sessionReady, loggedIn]) => {
    notificationSummaryStore.stopRealtime()
    if (sessionReady && loggedIn) {
      notificationSummaryStore.startRealtime()
    } else {
      notificationSummaryStore.stopRealtime()
    }
  },
  { immediate: true, flush: 'sync' }
)

onUnmounted(() => {
  notificationSummaryStore.stopRealtime({ clear: false })
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--bg-primary);
}

.main-content {
  flex: 1;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.maintenance-banner {
  width: min(100% - 24px, 1180px);
  margin: 18px auto 0;
  padding: 24px 26px;
  border: 1px solid color-mix(in srgb, var(--palette-hex-f59e0b) 28%, var(--border-color));
  border-radius: 26px;
  background:
    linear-gradient(135deg, var(--palette-rgba-255-248-235-0p96), var(--palette-rgba-255-255-255-0p92));
  box-shadow: 0 18px 42px var(--palette-rgba-217-119-6-0p12);
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
  color: var(--palette-hex-b45309);
}

.maintenance-banner__title {
  margin: 0;
  font-size: 22px;
  color: var(--palette-hex-111827);
}

.maintenance-banner__message {
  margin: 8px 0 0;
  line-height: 1.6;
  color: var(--palette-hex-4b5563);
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
  background: var(--palette-hex-111827);
  color: var(--palette-hex-ffffff);
  font-weight: 600;
  text-decoration: none;
}

.maintenance-banner__link.secondary {
  background: var(--palette-hex-ffffff);
  color: var(--palette-hex-b45309);
  border: 1px solid var(--palette-rgba-245-158-11-0p35);
}

.maintenance-banner__link.tertiary {
  background: var(--palette-rgba-255-255-255-0p72);
  color: var(--palette-hex-374151);
  border: 1px solid var(--palette-rgba-148-163-184-0p4);
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

@media (max-width: 767px) {
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
