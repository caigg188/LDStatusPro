<template>
  <div class="seller-shell">
    <a class="seller-skip-link" href="#seller-main">跳到主要内容</a>

    <div v-if="drawerOpen" class="seller-backdrop" aria-hidden="true" @click="closeDrawer"></div>

    <aside id="seller-navigation" class="seller-sidebar" :class="{ 'is-open': drawerOpen }" aria-label="卖家后台导航">
      <div class="seller-brand-row">
        <router-link to="/seller" class="seller-brand" aria-label="LD 士多卖家工作台" @click="closeDrawer">
          <span class="seller-brand-mark"><StoreLogo class="seller-brand-logo" inverted decorative /></span>
          <span>
            <strong>LD 士多</strong>
            <small>卖家工作台</small>
          </span>
        </router-link>
        <button ref="sidebarCloseButton" type="button" class="seller-icon-button sidebar-close" aria-label="关闭导航" @click="closeDrawer">
          <X :size="20" aria-hidden="true" />
        </button>
      </div>

      <nav class="seller-nav">
        <section v-for="group in navigation" :key="group.label" class="seller-nav-group">
          <h2>{{ group.label }}</h2>
          <template v-for="item in group.items" :key="item.to">
            <router-link
              v-if="!item.disabled"
              :to="item.to"
              class="seller-nav-item"
              :class="{ active: isNavigationActive(item) }"
              :title="item.label"
              @click="closeDrawer"
            >
              <component :is="item.icon" :size="18" :stroke-width="1.8" aria-hidden="true" />
              <span>{{ item.label }}</span>
              <span
                v-if="item.badge?.value || item.badge?.text"
                class="seller-nav-badge"
                :class="{ 'is-attention': item.badge?.tone === 'warning' }"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                :aria-label="item.badge?.ariaLabel || `${item.badgeLabel || item.label}有 ${item.badge.value} 项待处理`"
              >
                {{ item.badge.text || formatBadge(item.badge.value) }}
              </span>
            </router-link>
            <span
              v-else
              class="seller-nav-item is-disabled"
              aria-disabled="true"
              :title="item.disabledReason"
            >
              <component :is="item.icon" :size="18" :stroke-width="1.8" aria-hidden="true" />
              <span>{{ item.label }}</span>
            </span>
          </template>
        </section>
      </nav>

      <div class="seller-sidebar-footer">
        <router-link to="/announcements" class="seller-market-link" @click="closeDrawer">公告中心</router-link>
        <router-link to="/" class="seller-market-link" @click="closeDrawer">
          <ArrowLeft :size="17" aria-hidden="true" />
          返回物品广场
        </router-link>
        <div class="seller-account">
          <router-link to="/user" class="seller-account-main" @click="closeDrawer">
            <AvatarImage
              :src="userStore.avatar"
              :candidates="userStore.avatarCandidates"
              :seed="userStore.username || 'seller'"
              :size="80"
              alt=""
              class="seller-avatar"
              loading-mode="eager"
            />
            <span>
              <strong>{{ displayName }}</strong>
              <small>查看个人中心</small>
            </span>
          </router-link>
          <button type="button" class="seller-icon-button logout-button" title="退出登录" aria-label="退出登录" @click="logout">
            <LogOut :size="18" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>

    <div ref="sellerWorkspace" class="seller-workspace">
      <header class="seller-topbar">
        <div class="seller-topbar-title">
          <button ref="mobileMenuButton" type="button" class="seller-icon-button mobile-menu" aria-controls="seller-navigation" :aria-expanded="drawerOpen" aria-label="打开导航" @click="openDrawer">
            <Menu :size="21" aria-hidden="true" />
          </button>
          <div>
            <p>卖家后台</p>
            <h1>{{ pageTitle }}</h1>
          </div>
        </div>

        <div class="seller-topbar-actions">
          <router-link to="/" class="seller-topbar-market">
            <ArrowLeft :size="16" aria-hidden="true" />
            <span>物品广场</span>
          </router-link>
          <ThemeToggle :show-arrow="false" />
          <router-link to="/user" class="seller-topbar-profile seller-topbar-profile-desktop" aria-label="打开个人中心">
            <AvatarImage
              :src="userStore.avatar"
              :candidates="userStore.avatarCandidates"
              :seed="userStore.username || 'seller'"
              :size="72"
              alt=""
              class="seller-topbar-avatar"
              loading-mode="eager"
            />
          </router-link>
        </div>
      </header>

      <section v-if="sellingDisabled" class="seller-enforcement" role="alert" aria-live="assertive">
        <ShieldAlert :size="20" aria-hidden="true" />
        <div>
          <strong>卖家功能已被平台禁用</strong>
          <p>{{ enforcement.reason || '平台已暂停你的卖家权限。' }} 已有物品保持下架，暂时无法发布或编辑物品；购买其他商家的物品不受影响，已付款订单仍可继续履约和退款。</p>
        </div>
        <router-link to="/seller/orders?source=product">处理已付款订单</router-link>
      </section>

      <section v-if="restrictedMaintenance" class="seller-maintenance" role="status">
        <AlertTriangle :size="18" aria-hidden="true" />
        <div>
          <strong>{{ MAINTENANCE_STATE.title }}</strong>
          <p>{{ MAINTENANCE_STATE.message }}</p>
        </div>
      </section>

      <section
        v-if="showFulfillmentGate"
        class="seller-fulfillment-gate"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <ShieldAlert :size="20" aria-hidden="true" />
        <div>
          <strong>完成发货规则确认，恢复普通物品交易</strong>
          <p>你尚未确认当前 72 小时发货规则，普通物品无法发布，买家也无法下单。</p>
        </div>
        <router-link to="/seller/fulfillment">查看并确认</router-link>
      </section>

      <section
        v-else-if="!sellingDisabled && !fulfillmentLoading && fulfillmentError"
        class="seller-fulfillment-load-error"
        role="status"
      >
        <AlertTriangle :size="18" aria-hidden="true" />
        <p>暂时无法核对发货规则状态。进入履约页面可重新加载。</p>
        <router-link to="/seller/fulfillment">重新核对</router-link>
      </section>

      <main id="seller-main" ref="sellerMain" class="seller-main" tabindex="-1">
        <AnnouncementBar />
        <div class="seller-view-stage">
          <router-view v-slot="{ Component, route: childRoute }">
            <transition name="seller-route">
              <component :is="Component" :key="resolveSellerViewKey(childRoute)" />
            </transition>
          </router-view>
        </div>
      </main>
    </div>

    <nav class="seller-dock" aria-label="卖家主要功能">
      <router-link
        v-for="item in dockItems"
        :key="item.to"
        :to="item.to"
        class="seller-dock-item"
        :class="{ active: isDockActive(item) }"
      >
        <component :is="item.icon" :size="18" :stroke-width="1.8" aria-hidden="true" />
        <span>{{ item.label }}</span>
        <span v-if="item.badge?.value" class="seller-dock-badge">{{ formatBadge(item.badge.value) }}</span>
      </router-link>
      <button type="button" class="seller-dock-item" :class="{ active: drawerOpen || moreActive }" aria-controls="seller-navigation" :aria-expanded="drawerOpen" @click="openDrawer">
        <Menu :size="18" aria-hidden="true" />
        <span>我的</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import StoreLogo from '@/components/common/StoreLogo.vue'
import AnnouncementBar from '@/components/common/AnnouncementBar.vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import {
  AlertTriangle,
  ArrowLeft,
  BadgePercent,
  CreditCard,
  Bell,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShoppingBag,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Store,
  ShieldAlert,
  X
} from '@lucide/vue'
import { useUserStore } from '@/stores/user'
import { useNotificationSummaryStore } from '@/stores/notificationSummary'
import { useMerchantEnforcementStore } from '@/stores/merchantEnforcement'
import { useSellerFulfillmentStore } from '@/stores/sellerFulfillment'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import AvatarImage from '@/components/common/AvatarImage.vue'
import { MAINTENANCE_STATE, isRestrictedMaintenanceMode } from '@/config/maintenance'
import { isMobileNav } from '@/config/breakpoints'
import { isSellerNavigationItemActive, resolveSellerViewKey } from '@/utils/sellerNavigation'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const notificationSummaryStore = useNotificationSummaryStore()
const merchantEnforcementStore = useMerchantEnforcementStore()
const sellerFulfillmentStore = useSellerFulfillmentStore()
const {
  sellerPendingDeliveryCount: pendingDeliveryCount,
  sellerRefundPendingCount: refundPendingCount
} = storeToRefs(notificationSummaryStore)
const { enforcement, sellingDisabled } = storeToRefs(merchantEnforcementStore)
const {
  loaded: fulfillmentLoaded,
  loading: fulfillmentLoading,
  error: fulfillmentError,
  status: fulfillmentStatus,
  needsAcknowledgement: fulfillmentNeedsAcknowledgement
} = storeToRefs(sellerFulfillmentStore)
const drawerOpen = ref(false)
const mobileMenuButton = ref(null)
const sidebarCloseButton = ref(null)
const sellerMain = ref(null)
const sellerWorkspace = ref(null)
let enforcementPollTimer = 0

const displayName = computed(() => userStore.user?.name || userStore.username || '卖家')
const pageTitle = computed(() => String(route.meta.title || '卖家后台').split(' - ')[0])
const restrictedMaintenance = computed(() => isRestrictedMaintenanceMode())
const orderBadge = computed(() => ({ value: pendingDeliveryCount.value }))
const refundBadge = computed(() => ({ value: refundPendingCount.value }))
const fulfillmentRestricted = computed(() => Boolean(fulfillmentStatus.value?.activeRestriction))
const fulfillmentBadge = computed(() => fulfillmentNeedsAcknowledgement.value
  ? { text: '待确认', tone: 'warning', ariaLabel: '发货与履约规则待确认' }
  : null)

const navigation = computed(() => [
  {
    label: '工作台',
    items: [
      { label: '经营概览', to: '/seller', exact: true, activeRouteNames: ['SellerDashboard'], icon: LayoutDashboard }
    ]
  },
  {
    label: '交易',
    items: [
      { label: '订单管理', to: '/seller/orders', activeRouteNames: ['SellerOrders', 'SellerOrderDetail'], icon: ShoppingBag, badge: orderBadge.value },
      { label: '退款售后', to: '/seller/refunds', activeRouteNames: ['SellerRefunds'], icon: RotateCcw, badge: refundBadge.value, badgeLabel: '退款售后' }
    ]
  },
  {
    label: '商品',
    items: [
      { label: '我的物品', to: '/seller/products', activeRouteNames: ['SellerProducts', 'SellerEdit', 'SellerPublish'], icon: Package }
    ]
  },
  {
    label: '经营',
    items: [
      { label: '优惠券管理', to: '/seller/coupons', activeRouteNames: ['SellerCoupons'], icon: BadgePercent },
      { label: 'DUO+', to: '/seller/duo-plus', activeRouteNames: ['SellerDuoPlus'], icon: Sparkles },
      { label: '推广', to: '/seller/services', activeRouteNames: ['SellerServices'], icon: Sparkles },
      { label: '小店管理', to: '/seller/store', activeRouteNames: ['SellerStore'], icon: Store }
    ]
  },
  {
    label: '设置',
    items: [
      { label: '发货与履约', to: '/seller/fulfillment', activeRouteNames: ['SellerFulfillment'], icon: ShieldCheck, badge: fulfillmentBadge.value },
      { label: '通知设置', to: '/seller/notifications', activeRouteNames: ['SellerNotifications'], icon: Bell },
      { label: '收款设置', to: '/seller/payment', activeRouteNames: ['SellerPayment'], icon: CreditCard }
    ]
  }
])
const dockItems = computed(() => [
  { label: '概览', to: '/seller', exact: true, activeRouteNames: ['SellerDashboard'], icon: LayoutDashboard },
  { label: '订单', to: '/seller/orders', activeRouteNames: ['SellerOrders', 'SellerOrderDetail'], icon: ShoppingBag, badge: orderBadge.value },
  { label: '物品', to: '/seller/products', activeRouteNames: ['SellerProducts', 'SellerEdit', 'SellerPublish'], icon: Package }
])
const moreActive = computed(() => !dockItems.value.some(item => isNavigationActive(item)))
const showFulfillmentGate = computed(() => (
  !sellingDisabled.value
  && !fulfillmentRestricted.value
  && fulfillmentLoaded.value
  && fulfillmentNeedsAcknowledgement.value
  && route.name !== 'SellerFulfillment'
))

function isNavigationActive(item) {
  const refundDetail = route.name === 'SellerOrderDetail' && route.query.from === 'refunds'
  if (refundDetail && item.to === '/seller/refunds') return true
  if (refundDetail && item.to === '/seller/orders') return false
  return isSellerNavigationItemActive(route, item)
}

function isDockActive(item) {
  return isNavigationActive(item)
}

function formatBadge(value) {
  return Number(value) > 99 ? '99+' : String(value)
}

function openDrawer() {
  drawerOpen.value = true
  nextTick(() => sidebarCloseButton.value?.focus())
}

function closeDrawer({ restoreFocus = false } = {}) {
  const wasOpen = drawerOpen.value
  drawerOpen.value = false
  if (wasOpen && restoreFocus) nextTick(() => mobileMenuButton.value?.focus())
}

function handleKeydown(event) {
  if (event.key === 'Escape') closeDrawer({ restoreFocus: true })
}

function logout() {
  notificationSummaryStore.reset()
  merchantEnforcementStore.reset()
  sellerFulfillmentStore.reset()
  userStore.logout()
  router.replace('/')
}

watch(() => route.path, async () => {
  closeDrawer()
  const enforcementRefresh = merchantEnforcementStore.refresh()
  void sellerFulfillmentStore.refresh()
  await enforcementRefresh
  if (sellingDisabled.value && ['SellerPublish', 'SellerEdit'].includes(String(route.name || ''))) {
    await router.replace({ name: 'SellerProducts', query: { sellingDisabled: '1' } })
  }
  await nextTick()
  sellerWorkspace.value?.scrollTo({ top: 0, left: 0 })
  sellerMain.value?.focus({ preventScroll: true })
})
watch(drawerOpen, value => {
  document.body.style.overflow = value && isMobileNav(window.innerWidth) ? 'hidden' : ''
})

onMounted(() => {
  document.documentElement.classList.add('seller-console')
  document.addEventListener('keydown', handleKeydown)
  void Promise.all([
    merchantEnforcementStore.refresh({ force: true }),
    sellerFulfillmentStore.refresh({ force: true })
  ])
  enforcementPollTimer = window.setInterval(() => {
    void merchantEnforcementStore.refresh({ force: true })
  }, 30_000)
})

onUnmounted(() => {
  document.documentElement.classList.remove('seller-console')
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
  if (enforcementPollTimer) window.clearInterval(enforcementPollTimer)
})
</script>

<style scoped>
.seller-shell {
  --seller-paper: var(--surface-paper-canvas);
  --seller-bg: var(--seller-paper);
  --seller-surface: var(--surface-paper-card);
  --seller-surface-soft: var(--surface-paper-soft);
  --seller-surface-muted: var(--surface-paper-muted);
  --seller-surface-strong: var(--surface-paper-strong);
  --seller-navy: var(--action-paper-primary);
  --seller-navy-soft: var(--action-paper-primary-hover);
  --seller-ink: var(--text-paper-primary);
  --seller-muted: var(--text-paper-secondary);
  --seller-jade: var(--action-paper-accent);
  --seller-jade-strong: var(--action-paper-accent-strong);
  --seller-jade-soft: var(--action-paper-accent-soft);
  --seller-border: var(--border-paper-default);
  --seller-border-strong: var(--border-paper-strong);
  --seller-success: var(--status-paper-success);
  --seller-danger: var(--status-paper-danger);
  --seller-warning: var(--status-paper-warning);
  --seller-shadow-sm: var(--elevation-paper-sm);
  --seller-shadow-md: var(--elevation-paper-md);
  --seller-on-navy: var(--palette-hex-ffffff);
  --seller-dock-offset: 0px;
  --bg-primary: var(--seller-paper);
  --bg-secondary: var(--seller-surface-soft);
  --bg-tertiary: var(--palette-hex-e5e1d8);
  --bg-card: var(--seller-surface);
  --bg-card-hover: var(--palette-hex-ffffff);
  --text-primary: var(--seller-ink);
  --text-secondary: var(--seller-muted);
  --text-tertiary: var(--palette-hex-899198);
  --border-light: var(--seller-border);
  --border-medium: var(--palette-hex-c5beb1);
  --border-color: var(--seller-border);
  --color-primary: var(--seller-jade);
  --color-primary-hover: var(--palette-hex-5f7968);
  --color-primary-light: var(--seller-jade-soft);
  --input-bg: var(--palette-hex-efede6);
  --input-focus-bg: var(--seller-surface);
  --dropdown-bg: var(--seller-surface);
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: 100dvh;
  min-height: 100dvh;
  max-height: 100dvh;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  overflow-x: clip;
  overflow-y: hidden;
  background: var(--seller-paper);
  color: var(--seller-ink);
  font-family: var(--font-sans);
}

html.dark .seller-shell {
  --bg-tertiary: var(--palette-hex-25343f);
  --bg-card-hover: var(--palette-hex-1b2933);
  --text-tertiary: var(--palette-hex-818d92);
  --border-medium: var(--palette-hex-3a4a55);
  --color-primary-hover: var(--palette-hex-a4c4ac);
  --input-bg: var(--palette-hex-1b2832);
}

.seller-skip-link {
  position: fixed;
  z-index: 2000;
  top: 12px;
  left: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--seller-surface);
  color: var(--seller-ink);
  transform: translateY(-150%);
  transition: transform 160ms ease;
}

.seller-skip-link:focus { transform: translateY(0); }

.seller-sidebar {
  position: sticky;
  top: 0;
  height: 100dvh;
  z-index: 60;
  display: flex;
  flex-direction: column;
  padding: 20px 16px 16px;
  overflow-y: auto;
  color: var(--palette-hex-e9edf0);
  background: var(--seller-navy);
  border-right: 1px solid var(--palette-rgba-255-255-255-0p07);
}

.seller-brand-row,
.seller-brand,
.seller-account,
.seller-account-main,
.seller-topbar,
.seller-topbar-title,
.seller-topbar-actions,
.seller-maintenance { display: flex; align-items: center; }

.seller-brand-row { justify-content: space-between; margin-bottom: 24px; }
.seller-brand { min-width: 0; gap: 11px; color: var(--seller-on-navy); }
.seller-brand-mark { width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid var(--palette-rgba-255-255-255-p16); border-radius: 11px; background: var(--palette-rgba-255-255-255-p07); }
.seller-brand-logo { width: 28px; height: 28px; }
.seller-brand strong { display: block; font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif; font-size: 17px; letter-spacing: .05em; }
.seller-brand small { display: block; margin-top: 2px; color: var(--palette-rgba-233-237-240-p58); font-size: 11px; letter-spacing: .12em; }

.seller-icon-button { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 10px; color: inherit; transition: background 180ms ease, color 180ms ease; }
.seller-icon-button:hover { background: var(--palette-rgba-255-255-255-p08); }
.seller-icon-button:focus-visible,
.seller-nav-item:focus-visible,
.seller-market-link:focus-visible,
.seller-topbar-market:focus-visible,
.seller-topbar-profile:focus-visible { outline: 3px solid var(--seller-jade); outline-offset: 2px; }
.sidebar-close { display: none; }

.seller-nav { width: 100%; min-width: 0; display: grid; gap: 20px; }
.seller-nav-group { width: 100%; min-width: 0; }
.seller-nav-group h2 { margin: 0 0 7px 12px; color: var(--palette-rgba-233-237-240-p42); font-size: 11px; font-weight: 600; letter-spacing: .16em; }
.seller-nav-item { width: 100%; min-width: 0; min-height: 44px; justify-self: stretch; box-sizing: border-box; display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; color: var(--palette-rgba-240-244-246-p76); font-size: 14px; line-height: 1; transition: background 180ms ease, color 180ms ease, transform 180ms ease; }
.seller-nav-item > svg { display: block; align-self: center; justify-self: center; }
.seller-nav-item > span:not(.seller-nav-badge) { min-width: 0; align-self: center; line-height: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.seller-nav-item:hover { color: var(--seller-on-navy); background: var(--palette-rgba-255-255-255-p06); transform: translateX(2px); }
.seller-nav-item.active { color: var(--seller-on-navy); background: var(--palette-rgba-145-178-154-p18); box-shadow: inset 3px 0 0 var(--seller-jade); }
.seller-nav-item.is-disabled { color: var(--palette-rgba-240-244-246-p34); cursor: not-allowed; }
.seller-nav-badge { min-width: 22px; height: 22px; padding: 0 6px; display: grid; place-items: center; border-radius: 999px; background: var(--palette-hex-e8d4b8); color: var(--palette-hex-3d3021); font: 700 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.seller-nav-badge.is-attention { min-width: auto; padding-inline: 7px; font-family: inherit; }

.seller-sidebar-footer { margin-top: auto; padding-top: 20px; }
.seller-market-link { min-height: 44px; display: flex; align-items: center; gap: 8px; padding: 8px 10px; color: var(--palette-rgba-233-237-240-p7); font-size: 13px; }
.seller-market-link:hover { color: var(--seller-on-navy); }
.seller-account { gap: 8px; margin-top: 10px; padding: 10px; border: 1px solid var(--palette-rgba-255-255-255-p09); border-radius: 13px; background: var(--palette-rgba-255-255-255-p04); }
.seller-account-main { min-width: 0; flex: 1; gap: 9px; color: var(--seller-on-navy); }
.seller-avatar { width: 36px; height: 36px; border-radius: 10px; }
.seller-account-main span { min-width: 0; }
.seller-account-main strong,
.seller-account-main small { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.seller-account-main strong { font-size: 13px; }
.seller-account-main small { margin-top: 2px; color: var(--palette-rgba-233-237-240-p48); font-size: 11px; }
.logout-button { flex: 0 0 38px; width: 38px; height: 38px; color: var(--palette-rgba-255-255-255-p62); }
.logout-button:hover { color: var(--seller-on-navy); background: var(--palette-rgba-165-83-77-p28); }

.seller-workspace {
  min-width: 0;
  min-height: 0;
  overflow-x: clip;
  overflow-y: auto;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}
.seller-topbar { position: sticky; top: 0; z-index: 40; justify-content: space-between; min-height: 72px; padding: 10px clamp(18px, 3vw, 38px); border-bottom: 1px solid color-mix(in srgb, var(--seller-border) 78%, transparent); background: color-mix(in srgb, var(--seller-paper) 90%, transparent); backdrop-filter: blur(14px); }
.seller-topbar-title { gap: 10px; }
.seller-topbar-title p { margin: 0 0 2px; color: var(--seller-jade); font-size: 11px; font-weight: 700; letter-spacing: .14em; }
.seller-topbar-title h1 { margin: 0; color: var(--seller-ink); font-family: var(--font-sans); font-size: 20px; font-weight: 600; }
.seller-topbar-actions { gap: 8px; }
.seller-topbar-market { min-height: 44px; display: flex; align-items: center; gap: 7px; padding: 0 12px; border: 1px solid var(--seller-border); border-radius: 10px; color: var(--seller-muted); font-size: 13px; background: var(--seller-surface); }
.seller-topbar-market:hover { color: var(--seller-ink); border-color: var(--seller-jade); }
.seller-topbar-profile { width: 44px; height: 44px; padding: 3px; border: 1px solid var(--seller-border); border-radius: 11px; background: var(--seller-surface); }
.seller-topbar-avatar { width: 100%; height: 100%; border-radius: 8px; }
.seller-topbar-actions :deep(.theme-btn) { width: 44px; height: 44px; }
.mobile-menu { display: none; color: var(--seller-ink); }

.seller-maintenance { gap: 10px; margin: 18px clamp(18px, 3vw, 38px) 0; padding: 13px 16px; border: 1px solid color-mix(in srgb, var(--seller-warning) 45%, var(--seller-border)); border-radius: 12px; color: var(--seller-warning); background: color-mix(in srgb, var(--seller-warning) 9%, var(--seller-surface)); }
.seller-maintenance p { margin: 2px 0 0; color: var(--seller-muted); font-size: 13px; }
.seller-fulfillment-gate,
.seller-fulfillment-load-error { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; margin: 18px clamp(18px, 3vw, 38px) 0; padding: 14px 16px; border: 1px solid color-mix(in srgb, var(--seller-warning) 48%, var(--seller-border)); border-radius: 12px; color: var(--seller-warning); background: color-mix(in srgb, var(--seller-warning) 9%, var(--seller-surface)); }
.seller-fulfillment-gate strong { display: block; color: var(--seller-ink); font-size: 14px; }
.seller-fulfillment-gate p,
.seller-fulfillment-load-error p { margin: 3px 0 0; color: var(--seller-muted); font-size: 13px; line-height: 1.6; }
.seller-fulfillment-gate a,
.seller-fulfillment-load-error a { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; border: 1px solid var(--seller-navy); border-radius: 10px; color: var(--seller-on-navy); background: var(--seller-navy); font-size: 13px; font-weight: 700; }
html.dark .seller-fulfillment-gate a,
html.dark .seller-fulfillment-load-error a { border-color: var(--seller-jade); color: var(--palette-hex-0d151d); background: var(--seller-jade); }
.seller-fulfillment-gate a:focus-visible,
.seller-fulfillment-load-error a:focus-visible { outline: 3px solid var(--seller-jade-strong); outline-offset: 3px; }
.seller-enforcement { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 12px; margin: 18px clamp(18px, 3vw, 38px) 0; padding: 14px 16px; border: 1px solid color-mix(in srgb, var(--seller-danger) 52%, var(--seller-border)); border-radius: 12px; color: var(--seller-danger); background: color-mix(in srgb, var(--seller-danger) 10%, var(--seller-surface)); }
.seller-enforcement strong { display: block; font-size: 14px; }
.seller-enforcement p { max-width: 78ch; margin: 3px 0 0; color: var(--seller-ink); font-size: 13px; line-height: 1.65; }
.seller-enforcement a { min-height: 44px; display: inline-flex; align-items: center; padding: 0 12px; border: 1px solid color-mix(in srgb, var(--seller-danger) 45%, var(--seller-border)); border-radius: 10px; color: var(--seller-danger); background: var(--seller-surface); font-size: 13px; font-weight: 600; }
.seller-enforcement a:focus-visible { outline: 3px solid var(--seller-danger); outline-offset: 2px; }
.seller-main { width: min(100%, 1480px); margin: 0 auto; padding: clamp(20px, 3vw, 38px); outline: none; }
.seller-main > :deep(.announcement-bar),
.seller-main > :deep(.announcement-refresh-status) { width: 100%; margin: 0 0 var(--space-5); }
/* Only outgoing/incoming route views share a grid cell during transitions. */
.seller-view-stage { min-height: calc(100dvh - 148px); display: grid; isolation: isolate; }
.seller-view-stage > * { min-width: 0; grid-area: 1 / 1; }
.seller-route-enter-active { transition: opacity 180ms ease, transform 180ms ease; }
.seller-route-leave-active { transition: opacity 120ms ease; }
.seller-route-enter-from { opacity: 0; transform: translateY(6px); }
.seller-route-leave-to { opacity: 0; }
.seller-backdrop { display: none; }
.seller-dock { display: none; }

@media (max-width: 1023px) and (min-width: 768px) {
  .seller-shell { grid-template-columns: 72px minmax(0, 1fr); }
  .seller-sidebar { width: 72px; padding: 16px 8px; }
  .seller-brand > span:last-child,
  .seller-nav-group h2,
  .seller-nav-item > span:not(.seller-nav-badge),
  .seller-market-link,
  .seller-account-main span { display: none; }
  .seller-brand { justify-content: center; }
  .seller-nav-item { grid-template-columns: 20px; justify-content: center; padding: 10px 0; }
  .seller-nav-item.active { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--seller-jade) 55%, transparent); }
  .seller-nav-badge { position: absolute; top: 4px; right: 6px; min-width: 16px; height: 16px; padding: 0 4px; font-size: 9px; }
  .seller-nav-item { position: relative; }
  .seller-account { justify-content: center; padding: 8px; }
  .seller-account-main { justify-content: center; }
  .logout-button { display: none; }
  .seller-topbar-market span { display: none; }
  .seller-topbar-market { width: 44px; padding: 0; justify-content: center; }
}

@media (max-width: 767px) {
  .seller-shell { grid-template-columns: minmax(0, 1fr); }
  .seller-sidebar { position: fixed; left: 0; width: min(86vw, 288px); transform: translateX(-105%); box-shadow: none; transition: transform 220ms ease; }
  .seller-sidebar.is-open { transform: translateX(0); }
  .seller-backdrop { position: fixed; inset: 0; z-index: 50; display: block; background: var(--palette-rgba-7-15-23-p48); backdrop-filter: blur(2px); }
  .sidebar-close { display: grid; }
  .mobile-menu,
  .seller-topbar-market,
  .seller-topbar-profile-desktop { display: none; }
  .seller-dock {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 45;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
    padding: 8px 10px max(8px, env(safe-area-inset-bottom));
    border-top: 1px solid var(--seller-border);
    background: color-mix(in srgb, var(--seller-paper) 92%, transparent);
    backdrop-filter: blur(14px);
  }
  .seller-dock-item {
    position: relative;
    min-height: 48px;
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 3px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--seller-muted);
    font: inherit;
    font-size: 11px;
    font-weight: 650;
    cursor: pointer;
  }
  .seller-dock-item.active { color: var(--seller-ink); background: color-mix(in srgb, var(--seller-jade) 12%, transparent); }
  .seller-dock-badge {
    position: absolute;
    top: 2px;
    right: calc(50% - 22px);
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--seller-danger);
    color: var(--text-inverse);
    font-size: 9px;
  }
  .seller-shell {
    /* 1px border + 8px padding + 48px item + bottom inset. Keep in sync with .seller-dock. */
    --seller-dock-offset: calc(57px + max(8px, env(safe-area-inset-bottom)));
  }
  .seller-topbar { min-height: 56px; padding: 8px 14px; }
  .seller-topbar-title p { display: none; }
  .seller-main { padding: 18px 14px calc(var(--seller-dock-offset) + 24px); }
  .seller-view-stage { min-height: calc(100dvh - 168px); }
  .seller-maintenance { margin: 14px 14px 0; }
  .seller-fulfillment-gate,
  .seller-fulfillment-load-error { grid-template-columns: auto minmax(0, 1fr); align-items: start; margin: 14px 14px 0; }
  .seller-fulfillment-gate a,
  .seller-fulfillment-load-error a { grid-column: 1 / -1; width: 100%; }
  .seller-enforcement { grid-template-columns: auto minmax(0, 1fr); margin: 14px 14px 0; }
  .seller-enforcement a { grid-column: 1 / -1; justify-content: center; }
}

@media (prefers-reduced-motion: reduce) {
  .seller-sidebar,
  .seller-nav-item,
  .seller-route-enter-active,
  .seller-route-leave-active { transition: none !important; }
}
</style>
