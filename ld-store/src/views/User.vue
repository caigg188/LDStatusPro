<template>
  <div class="user-page">
    <div class="page-container">
      <header class="identity" aria-labelledby="user-display-name">
        <AvatarImage
          :src="avatar"
          :candidates="userStore.avatarCandidates"
          :seed="avatarSeed"
          :size="128"
          alt=""
          class="user-avatar"
          loading-mode="eager"
        />
        <div class="identity-copy">
          <div class="name-row">
            <h1 id="user-display-name" class="user-name">{{ username }}</h1>
            <router-link
              class="trust-chip"
              :class="trustHint.tone"
              to="/docs/concepts"
              :aria-label="`信任等级 ${trustHint.label}，${trustHint.detail}`"
            >
              {{ trustHint.label }}
            </router-link>
          </div>
          <p class="identity-meta">
            <span>{{ handle }}</span>
            <span v-if="daysOnStoreText">{{ daysOnStoreText }}</span>
            <span>{{ trustHint.detail }}</span>
            <router-link v-if="publicProfilePath" :to="publicProfilePath" class="profile-link">
              公开主页
              <ArrowUpRight :size="14" aria-hidden="true" />
            </router-link>
          </p>
        </div>
      </header>

      <section class="panel" aria-labelledby="attention-title">
        <div class="panel-head">
          <h2 id="attention-title">需要处理</h2>
          <p>{{ attentionSubtitle }}</p>
        </div>
        <div v-if="attentionLoading" class="attention-grid" aria-live="polite">
          <span v-for="item in 4" :key="item" class="skeleton attention-skeleton" />
        </div>
        <p v-else-if="attentionError" class="error-box" role="alert">{{ attentionError }}</p>
        <div v-else-if="visibleAttentionItems.length" class="attention-grid">
          <router-link
            v-for="item in visibleAttentionItems"
            :key="item.key"
            :to="item.to"
            class="attention-card"
          >
            <span class="icon-well" aria-hidden="true">
              <component :is="attentionIcons[item.key]" :size="18" :stroke-width="1.8" />
            </span>
            <strong>{{ formatHubNumber(item.count) }}</strong>
            <span class="attention-label">{{ item.label }}</span>
            <small v-if="item.hint">{{ item.hint }}</small>
          </router-link>
        </div>
        <p v-else class="quiet-empty">
          目前没有待办。
          <router-link to="/" class="text-link">去物品广场看看</router-link>
        </p>
      </section>

      <div class="hub-split">
        <section class="panel" aria-labelledby="recent-title">
          <div class="panel-head row-head">
            <div>
              <h2 id="recent-title">最近订单</h2>
              <p>继续未完成的支付、交付或退款。</p>
            </div>
            <router-link to="/user/orders" class="text-link">查看全部</router-link>
          </div>
          <div v-if="attentionLoading" class="recent-list" aria-live="polite">
            <div v-for="item in 3" :key="item" class="recent-card is-skeleton">
              <span class="skeleton pill mid" />
              <span class="skeleton line" />
            </div>
          </div>
          <nav v-else-if="recentOrders.length" class="recent-list" aria-label="最近购买订单">
            <router-link
              v-for="order in recentOrders"
              :key="order.orderNo || order.id"
              :to="orderAction(order).to"
              class="recent-card"
              :aria-label="`${order.productName}，${recentOrderStatusLabel(order)}，${orderAction(order).label}`"
            >
              <div class="recent-copy">
                <strong>{{ order.productName }}</strong>
                <span>{{ formatHubAmount(order.amount) }} LDC</span>
              </div>
              <span :class="['status-pill', `is-${recentOrderStatusTone(order)}`]">{{ recentOrderStatusLabel(order) }}</span>
              <span class="recent-go">
                {{ orderAction(order).label }}
                <ChevronRight :size="16" aria-hidden="true" />
              </span>
            </router-link>
          </nav>
          <p v-else class="quiet-empty">
            还没有购买记录。
            <router-link to="/" class="text-link">去逛逛物品</router-link>
          </p>
        </section>

        <section class="panel" aria-labelledby="records-title">
          <div class="panel-head">
            <h2 id="records-title">我的记录</h2>
            <p>订单、优惠券、求购和收藏都在这里。</p>
          </div>
          <nav class="record-grid" aria-label="个人记录入口">
            <router-link
              v-for="item in recordLinks"
              :key="item.key"
              :to="item.to"
              class="record-card"
            >
              <span class="icon-well" aria-hidden="true">
                <component :is="recordIcons[item.key]" :size="16" :stroke-width="1.9" />
              </span>
              <span class="record-label">{{ item.label }}</span>
              <span v-if="item.badge" class="record-badge">{{ item.badge }}</span>
            </router-link>
          </nav>
        </section>
      </div>

      <router-link
        v-if="showSellerChannel"
        to="/seller"
        class="seller-strip"
        :aria-label="sellerChannelAriaLabel"
      >
        <span class="icon-well" aria-hidden="true">
          <Store :size="18" :stroke-width="1.8" />
        </span>
        <span class="seller-copy">
          <strong>卖家后台</strong>
          <small>{{ sellerChannelHint }}</small>
        </span>
        <span class="seller-go">
          进入
          <ChevronRight :size="16" aria-hidden="true" />
        </span>
      </router-link>

      <details class="panel spending-panel">
        <summary>
          <span class="spending-summary">
            <strong>消费画像</strong>
            <small>{{ spendingSummary }}</small>
          </span>
          <ChevronRight class="summary-arrow" :size="18" aria-hidden="true" />
        </summary>
        <div v-if="dashboardLoading" class="distribution-list" aria-live="polite">
          <div v-for="item in 3" :key="item" class="distribution-item is-skeleton">
            <span class="skeleton pill mid" />
            <span class="skeleton bar-skeleton" />
          </div>
        </div>
        <p v-else-if="dashboardError" class="error-box" role="alert">{{ dashboardError }}</p>
        <div v-else-if="spendingShares.length" class="distribution-list">
          <p v-if="spendingInsight" class="spending-insight">{{ spendingInsight }}</p>
          <button
            v-for="item in spendingShares"
            :key="`${item.categoryId}-${item.categoryName}`"
            type="button"
            class="distribution-item"
            :aria-label="`查看${item.categoryName}已成交订单，占 ${item.share}%`"
            @click="jumpToDistributionOrders(item)"
          >
            <div class="row between">
              <span class="distribution-name">{{ item.categoryName }}</span>
              <strong>{{ item.share }}% · {{ formatHubAmount(item.amount) }} LDC</strong>
            </div>
            <div class="bar" aria-hidden="true">
              <span class="fill" :class="{ 'has-value': item.share > 0 }" :style="{ width: `${item.share}%` }" />
            </div>
          </button>
        </div>
        <p v-else class="quiet-empty">还没有已成交的购买记录，后续消费会自动出现在这里。</p>
      </details>

      <section class="more-panel" aria-label="工具与账号">
        <div class="more-grid">
          <div>
            <h2 class="section-title">工具</h2>
            <nav class="menu-list" aria-label="工具">
              <router-link v-for="item in toolLinks" :key="item.label" :to="item.to" class="menu-item">
                <span class="icon-well" aria-hidden="true">
                  <component :is="item.icon" :size="17" :stroke-width="1.8" />
                </span>
                <span class="menu-label">{{ item.label }}</span>
                <ChevronRight :size="16" class="menu-arrow" aria-hidden="true" />
              </router-link>
            </nav>
          </div>
          <div>
            <h2 class="section-title">账号与社区</h2>
            <nav class="menu-list" aria-label="账号与社区">
              <component
                :is="item.to ? 'router-link' : 'a'"
                v-for="item in accountLinks"
                :key="item.label"
                :to="item.to"
                :href="item.href"
                :target="item.target"
                :rel="item.rel"
                class="menu-item"
              >
                <span class="icon-well" aria-hidden="true">
                  <component :is="item.icon" :size="17" :stroke-width="1.8" />
                </span>
                <span class="menu-label">{{ item.label }}</span>
                <ChevronRight :size="16" class="menu-arrow" aria-hidden="true" />
              </component>
            </nav>
          </div>
        </div>
        <button class="logout-btn" type="button" @click="handleLogout">
          <LogOut :size="17" aria-hidden="true" />
          退出登录
        </button>
      </section>
    </div>
  </div>
</template>

<script setup>
import {
  ArrowUpRight,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  ClipboardPenLine,
  Clock3,
  ExternalLink,
  Flag,
  Heart,
  Image as ImageIcon,
  LogOut,
  Megaphone,
  MessageCircle,
  RotateCcw,
  Store,
  TicketPercent,
  Truck
} from '@lucide/vue'
import { computed, h, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useCatalogStore } from '@/stores/catalog'
import { useNotificationSummaryStore } from '@/stores/notificationSummary'
import { useUserStore } from '@/stores/user'
import AvatarImage from '@/components/common/AvatarImage.vue'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'
import { buildUserIdentity } from '@/utils/userIdentity'
import {
  EMPTY_ATTENTION,
  EMPTY_DISTRIBUTION,
  EMPTY_MERCHANT,
  EMPTY_OVERVIEW,
  activeAttentionItems,
  buildAttentionItems,
  buildRecordLinks,
  buildSpendingShares,
  buildTrustHint,
  formatHubAmount,
  formatHubNumber,
  recentOrderAction,
  recentOrderStatusLabel,
  recentOrderStatusTone,
  sellerChannelCopy,
  shouldShowSellerChannel,
  spendingInsightText,
  spendingSummaryText
} from '@/utils/userHub'

const attentionIcons = {
  pay: Clock3,
  delivery: Truck,
  refund: RotateCcw,
  messages: MessageCircle,
  coupons: TicketPercent,
  reports: Flag
}
const recordIcons = {
  orders: ClipboardList,
  coupons: TicketPercent,
  favorites: Heart,
  buyRequests: ClipboardPenLine,
  messages: MessageCircle,
  reports: Flag
}
const GithubMark = (props) => h('svg', {
  width: props.size ?? 17,
  height: props.size ?? 17,
  viewBox: '0 0 98 96',
  fill: 'currentColor',
  'aria-hidden': 'true'
}, [
  h('path', {
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z'
  })
])
GithubMark.props = ['size']

const toolLinks = [
  { icon: ImageIcon, label: '士多图床', to: '/ld-image' },
  { icon: CircleHelp, label: '帮助中心', to: '/docs' },
  { icon: Megaphone, label: '公告中心', to: '/announcements' }
]
const accountLinks = [
  { icon: Heart, label: '支持士多', to: '/support' },
  { icon: ExternalLink, label: 'Linux.do 社区', href: 'https://linux.do', target: '_blank', rel: 'noopener' },
  { icon: GithubMark, label: 'GitHub', href: 'https://github.com/caigg188/LDStatusPro', target: '_blank', rel: 'noopener' }
]

const router = useRouter()
const userStore = useUserStore()
const catalogStore = useCatalogStore()
const notificationSummaryStore = useNotificationSummaryStore()
const { totalUnread: messageUnread, sellerPendingDeliveryCount, sellerRefundPendingCount } = storeToRefs(notificationSummaryStore)
const dialog = useDialog()
const toast = useToast()

const dashboardLoading = ref(true)
const dashboardError = ref('')
const dashboard = ref(null)
const attentionLoading = ref(true)
const attentionError = ref('')
const attention = ref(EMPTY_ATTENTION)

const user = computed(() => userStore.user)
const identity = computed(() => buildUserIdentity({
  name: user.value?.name,
  username: user.value?.username,
  trustLevel: userStore.trustLevel
}))
const username = computed(() => identity.value.displayName)
const handle = computed(() => identity.value.handle || `@${user.value?.username || 'user'}`)
const trustHint = computed(() => buildTrustHint(userStore.trustLevel))
const avatarSeed = computed(() => user.value?.name || user.value?.username || user.value?.id || 'user')
const avatar = computed(() => userStore.avatar)
const publicProfilePath = computed(() => {
  const account = String(user.value?.username || '').trim()
  return account ? `/merchant/${encodeURIComponent(account)}` : ''
})
const overview = computed(() => dashboard.value?.overview || EMPTY_OVERVIEW)
const merchant = computed(() => dashboard.value?.merchant || EMPTY_MERCHANT)
const spendingDistribution = computed(() => dashboard.value?.spendingDistribution || EMPTY_DISTRIBUTION)
const daysOnStoreText = computed(() => {
  const days = Number(overview.value.daysOnStore || 0)
  if (dashboardLoading.value) return ''
  return days > 0 ? `来士多已 ${formatHubNumber(days)} 天` : '刚来逛逛'
})
const attentionItems = computed(() => buildAttentionItems({
  attention: attention.value,
  messageUnread: messageUnread.value
}))
const visibleAttentionItems = computed(() => activeAttentionItems(attentionItems.value))
const attentionSubtitle = computed(() => {
  if (attentionLoading.value) return '正在查看未完成的事项'
  if (attentionError.value) return '待办暂时无法刷新'
  const count = visibleAttentionItems.value.length
  if (count === 0) return '没有需要马上处理的事项'
  return `有 ${formatHubNumber(count)} 件未完成事项`
})
const recordLinks = computed(() => buildRecordLinks({
  unusedCouponCount: attention.value.unusedCouponCount,
  messageUnread: messageUnread.value,
  pendingReportCount: attention.value.pendingReportCount
}))
const recentOrders = computed(() => Array.isArray(attention.value.recentOrders) ? attention.value.recentOrders : [])
const showSellerChannel = computed(() => shouldShowSellerChannel({
  overview: overview.value,
  merchant: merchant.value,
  sellerPendingDeliveryCount: sellerPendingDeliveryCount.value,
  sellerRefundPendingCount: sellerRefundPendingCount.value
}))
const sellerChannelHint = computed(() => sellerChannelCopy({
  sellerPendingDeliveryCount: sellerPendingDeliveryCount.value,
  sellerRefundPendingCount: sellerRefundPendingCount.value
}))
const sellerChannelAriaLabel = computed(() => {
  const hint = sellerChannelHint.value
  return hint ? `进入卖家后台，${hint}` : '进入卖家后台'
})
const spendingSummary = computed(() => spendingSummaryText(overview.value))
const spendingShares = computed(() => buildSpendingShares(spendingDistribution.value))
const spendingInsight = computed(() => spendingInsightText(spendingShares.value))

function orderAction(order) {
  return recentOrderAction(order)
}

function jumpToDistributionOrders(item) {
  const categoryId = Number.parseInt(item?.categoryId, 10)
  if (!Number.isInteger(categoryId) || categoryId <= 0) return
  router.push({
    path: '/user/orders',
    query: {
      tab: 'buyer',
      categoryId: String(categoryId),
      categoryName: item.categoryName || `分类 #${categoryId}`,
      dealOnly: '1'
    }
  })
}

async function loadDashboard() {
  dashboardLoading.value = true
  dashboardError.value = ''
  try {
    const result = await catalogStore.fetchUserDashboard()
    if (result.success) {
      dashboard.value = result.data
      return
    }
    dashboard.value = null
    dashboardError.value = result.error || '个人统计加载失败，请稍后重试'
  } catch (error) {
    dashboard.value = null
    dashboardError.value = error.message || '个人统计加载失败，请稍后重试'
  } finally {
    dashboardLoading.value = false
  }
}

async function loadAttention() {
  attentionLoading.value = true
  attentionError.value = ''
  try {
    const result = await catalogStore.fetchUserAttention()
    if (result.success) {
      attention.value = { ...EMPTY_ATTENTION, ...result.data, recentOrders: result.data?.recentOrders || [] }
      return
    }
    attention.value = EMPTY_ATTENTION
    attentionError.value = result.error || '待办事项加载失败，请稍后重试'
  } catch (error) {
    attention.value = EMPTY_ATTENTION
    attentionError.value = error.message || '待办事项加载失败，请稍后重试'
  } finally {
    attentionLoading.value = false
  }
}

onMounted(() => {
  void Promise.allSettled([loadDashboard(), loadAttention()])
})

async function handleLogout() {
  const confirmed = await dialog.confirm('确定要退出登录吗？', { title: '退出登录', icon: '🚪', danger: true })
  if (!confirmed) return
  userStore.logout()
  toast.success('已退出登录')
  router.replace('/')
}
</script>

<style scoped>
.user-page {
  min-height: 100vh;
  padding-bottom: 88px;
  background: var(--bg-primary);
  color-scheme: light;
  font-family: var(--font-sans);
  --hub-title: 15px;
  --hub-body: 13px;
  --hub-meta: 12px;
  --hub-record: 13px;
  --user-card-border: var(--palette-hex-dfd6ca);
  --user-card-bg: var(--palette-hex-fcfaf6);
  --user-card-shadow: 0 10px 24px var(--palette-rgba-61-61-61-0p05);
  --user-subtle-bg: var(--palette-hex-f5f3ef);
  --user-subtle-border: var(--palette-hex-e4dbcf);
  --user-hover-border: var(--palette-hex-cad6cb);
  --user-empty-bg: var(--palette-hex-f8f5ef);
  --user-track-bg: var(--palette-hex-e7dfd3);
  --user-accent: var(--palette-hex-7f9681);
  --user-accent-text: var(--palette-hex-5f7565);
  --user-avatar-border: var(--palette-rgba-255-255-255-0p92);
  --user-skeleton-bg: var(--palette-hex-e2e8f0);
  --user-skeleton-shine: var(--palette-rgba-255-255-255-0p68);
  --user-menu-hover-bg: var(--palette-hex-f4f0e9);
  --user-attention-bg: var(--palette-hex-edf2ea);
  --user-badge-bg: var(--palette-hex-738a76);
  --user-status-ok-bg: var(--status-success-surface);
  --user-status-ok-text: var(--status-success);
  --user-status-warn-bg: var(--status-warning-surface);
  --user-status-warn-text: var(--status-warning);
  --user-status-info-bg: var(--status-info-surface);
  --user-status-info-text: var(--status-info);
  --user-status-danger-bg: var(--status-danger-surface);
  --user-status-danger-text: var(--status-danger);
}

:global(html.dark .user-page) {
  color-scheme: dark;
  --user-card-border: var(--palette-hex-302a24);
  --user-card-bg: var(--palette-hex-1f1b18);
  --user-card-shadow: 0 14px 32px var(--palette-rgba-0-0-0-0p24);
  --user-subtle-bg: var(--palette-hex-2b2520);
  --user-subtle-border: var(--palette-hex-302a24);
  --user-hover-border: var(--palette-hex-424443);
  --user-empty-bg: var(--palette-hex-261c1c);
  --user-track-bg: var(--palette-hex-41372f);
  --user-accent: var(--palette-hex-8fb090);
  --user-accent-text: var(--palette-hex-d7ead3);
  --user-avatar-border: var(--palette-hex-352e24);
  --user-skeleton-bg: var(--palette-hex-413931);
  --user-skeleton-shine: var(--palette-rgba-255-255-255-0p08);
  --user-menu-hover-bg: var(--palette-hex-312a24);
  --user-attention-bg: var(--palette-hex-2f322a);
  --user-badge-bg: var(--palette-hex-8fb090);
}

.page-container {
  max-width: 1080px;
}

.identity,
.panel,
.seller-strip,
.menu-list,
.logout-btn {
  border: 1px solid var(--user-card-border);
  background: var(--user-card-bg);
  isolation: isolate;
}

.identity,
.panel,
.seller-strip {
  margin-bottom: var(--section-gap);
  padding: 16px 18px;
  border-radius: var(--card-radius);
  box-shadow: var(--user-card-shadow);
}

.identity,
.identity-copy,
.name-row,
.identity-meta,
.recent-card,
.seller-strip,
.seller-copy,
.menu-item,
.row,
.logout-btn,
.recent-go,
.spending-panel summary,
.spending-summary {
  display: flex;
}

.identity,
.recent-card,
.seller-strip,
.menu-item {
  align-items: center;
  gap: var(--space-3);
}

.identity-copy,
.seller-copy,
.recent-copy,
.spending-summary {
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.user-avatar {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border: 2px solid var(--user-avatar-border);
  border-radius: 50%;
  object-fit: cover;
}

.name-row {
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.user-name,
.panel-head h2,
.spending-panel strong,
.seller-copy strong,
.recent-copy strong,
.distribution-name {
  margin: 0;
  color: var(--text-primary);
}

.user-name {
  font-size: var(--text-subtitle);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0.01em;
}

.identity-meta {
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin: 0;
  color: var(--text-tertiary);
  font-size: var(--hub-meta);
  line-height: 1.4;
}

.identity-meta > * + *::before {
  content: '·';
  margin-right: 10px;
  color: var(--user-subtle-border);
}

.profile-link,
.text-link,
.recent-go,
.seller-go {
  color: var(--user-accent-text);
  font-weight: 600;
}

.profile-link,
.text-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 28px;
  font-size: var(--hub-body);
}

.trust-chip,
.menu-item,
.logout-btn,
.distribution-item,
.attention-card,
.record-card,
.seller-strip,
.recent-card {
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard);
}

.trust-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}

.trust-chip.trust-unknown { color: var(--palette-hex-667085); background: var(--palette-hex-eef1f5); border-color: var(--palette-hex-d8dee7); }
.trust-chip.trust-new { color: var(--palette-hex-7b6c5f); background: var(--palette-hex-f2ebe2); border-color: var(--palette-hex-dfd3c5); }
.trust-chip.trust-basic { color: var(--palette-hex-6d7b66); background: var(--palette-hex-edf2ea); border-color: var(--palette-hex-d4ded0); }
.trust-chip.trust-mid { color: var(--palette-hex-617a71); background: var(--palette-hex-e7efeb); border-color: var(--palette-hex-d0ddd7); }
.trust-chip.trust-high { color: var(--palette-hex-587168); background: var(--palette-hex-e2ebe7); border-color: var(--palette-hex-c4d4ce); }
.trust-chip.trust-elite { color: var(--palette-hex-4e685f); background: var(--palette-hex-dce7e3); border-color: var(--palette-hex-bfcec8); }

:global(html.dark .user-page .trust-chip.trust-unknown) { color: var(--palette-hex-d7dce4); background: var(--palette-hex-2f3134); border-color: var(--palette-hex-343026); }
:global(html.dark .user-page .trust-chip.trust-new) { color: var(--palette-hex-ecd4b8); background: var(--palette-hex-413427); border-color: var(--palette-hex-3a3022); }
:global(html.dark .user-page .trust-chip.trust-basic) { color: var(--palette-hex-d7ead3); background: var(--palette-hex-343b2e); border-color: var(--palette-hex-33362e); }
:global(html.dark .user-page .trust-chip.trust-mid) { color: var(--palette-hex-d3ebe3); background: var(--palette-hex-323b36); border-color: var(--palette-hex-323530); }
:global(html.dark .user-page .trust-chip.trust-high) { color: var(--palette-hex-d6ede3); background: var(--palette-hex-323b34); border-color: var(--palette-hex-333530); }
:global(html.dark .user-page .trust-chip.trust-elite) { color: var(--palette-hex-d6f0e6); background: var(--palette-hex-313833); border-color: var(--palette-hex-333631); }

.panel-head {
  margin-bottom: 12px;
}

.panel-head h2,
.spending-panel strong {
  font-size: var(--hub-title);
  font-weight: 700;
  line-height: 1.3;
}

.panel-head p,
.spending-panel small,
.quiet-empty,
.error-box,
.seller-copy small,
.recent-copy span,
.attention-label {
  margin: 2px 0 0;
  color: var(--text-tertiary);
  font-size: var(--hub-meta);
  line-height: 1.45;
}

.row-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.icon-well {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 10px;
  background: var(--user-attention-bg);
  color: var(--user-accent-text);
}

.icon-well svg {
  display: block;
}

.attention-grid,
.record-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.attention-card,
.record-card,
.recent-card,
.distribution-item {
  border: 1px solid var(--user-subtle-border);
  border-radius: var(--radius-md);
  background: var(--user-subtle-bg);
  text-decoration: none;
  color: var(--text-primary);
}

.attention-card {
  display: grid;
  align-content: start;
  gap: 6px;
  min-height: 88px;
  padding: 12px;
}

.attention-card strong {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.attention-card small {
  color: var(--user-accent-text);
  font-size: var(--hub-meta);
}

.record-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 10px 12px;
}

.record-card .icon-well {
  width: 28px;
  height: 28px;
  border-radius: 8px;
}

.record-label {
  flex: 1;
  min-width: 0;
  font-size: var(--hub-record);
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: 0.02em;
  color: var(--text-primary);
}

.record-badge {
  flex-shrink: 0;
  min-width: 18px;
  min-height: 18px;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  background: var(--user-badge-bg);
  color: var(--text-inverse);
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.hub-split,
.recent-list,
.distribution-list,
.more-grid {
  display: grid;
  gap: var(--grid-gap);
}

.hub-split > .panel {
  display: flex;
  flex-direction: column;
}

.hub-split .panel-head {
  flex-shrink: 0;
}

.record-grid {
  flex: 1 1 auto;
}

.recent-card {
  min-height: 60px;
  padding: 10px 12px;
  gap: 10px;
}

.recent-card.is-skeleton,
.distribution-item.is-skeleton {
  display: grid;
  gap: 8px;
}

.recent-copy strong {
  overflow: hidden;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-pill {
  flex-shrink: 0;
  min-height: 24px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: var(--user-subtle-bg);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 650;
  line-height: 24px;
}

.status-pill.is-ok { background: var(--user-status-ok-bg); color: var(--user-status-ok-text); }
.status-pill.is-warn { background: var(--user-status-warn-bg); color: var(--user-status-warn-text); }
.status-pill.is-info { background: var(--user-status-info-bg); color: var(--user-status-info-text); }
.status-pill.is-danger { background: var(--user-status-danger-bg); color: var(--user-status-danger-text); }

.recent-go,
.seller-go {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  font-size: var(--hub-meta);
  font-weight: 600;
  white-space: nowrap;
}

.seller-strip {
  min-height: 64px;
  padding-inline: var(--space-4);
}

.seller-go {
  margin-left: auto;
}

.spending-panel summary {
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 44px;
  cursor: pointer;
  list-style: none;
}

.spending-panel summary::-webkit-details-marker {
  display: none;
}

.summary-arrow {
  flex-shrink: 0;
  color: var(--user-accent);
  transform: rotate(90deg);
}

.spending-panel[open] .summary-arrow {
  transform: rotate(-90deg);
}

.spending-insight {
  margin: 4px 0 8px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 650;
  line-height: 1.45;
}

.distribution-item {
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
}

.distribution-name {
  font-size: 14px;
  font-weight: 600;
}

.distribution-item strong {
  font-size: var(--hub-meta);
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.attention-card:hover,
.record-card:hover,
.recent-card:hover,
.seller-strip:hover,
.menu-item:hover,
.distribution-item:hover {
  border-color: var(--user-hover-border);
  background: var(--user-menu-hover-bg);
}

.row.between {
  justify-content: space-between;
  gap: 8px;
}

.bar,
.bar-skeleton {
  height: 6px;
  overflow: hidden;
  margin-top: 8px;
  border-radius: var(--radius-pill);
  background: var(--user-track-bg);
}

.fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--user-accent);
}

.fill.has-value {
  min-width: 4px;
}

.error-box,
.quiet-empty {
  padding: 12px 0 4px;
}

.error-box {
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.quiet-empty {
  color: var(--text-tertiary);
}

.skeleton {
  position: relative;
  overflow: hidden;
  background: var(--user-skeleton-bg);
}

.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, var(--user-skeleton-shine), transparent);
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.attention-skeleton,
.pill,
.line,
.bar-skeleton {
  display: block;
  border-radius: var(--radius-md);
}

.attention-skeleton {
  min-height: 88px;
}

.pill {
  height: 14px;
  border-radius: var(--radius-pill);
}

.pill.mid { width: 112px; }
.line { width: 64%; height: 16px; }

.more-panel {
  margin-top: 8px;
}

.section-title {
  margin: 0 0 8px 2px;
  font-size: var(--hub-meta);
  font-weight: 650;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
}

.menu-list {
  overflow: hidden;
  border-radius: var(--radius-lg);
}

.menu-item {
  min-height: 48px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--user-card-border);
  color: var(--text-primary);
  text-decoration: none;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-label {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
}

.menu-arrow {
  color: var(--text-tertiary);
}

.logout-btn {
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  margin-top: var(--space-4);
  border-radius: var(--radius-lg);
  color: var(--color-danger);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.logout-btn:hover {
  border-color: var(--color-danger);
  background: var(--color-danger-light);
}

.user-page :is(a, button, summary):focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}

@keyframes skeleton-shimmer {
  100% { transform: translateX(100%); }
}

@media (min-width: 768px) {
  .identity,
  .panel,
  .seller-strip {
    padding: 18px 20px;
  }

  .user-avatar { width: 64px; height: 64px; }
  .attention-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .more-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (min-width: 1024px) {
  .hub-split {
    grid-template-columns: minmax(0, 1.15fr) minmax(300px, 0.85fr);
    align-items: stretch;
    margin-bottom: var(--section-gap);
  }

  .hub-split > .panel {
    margin-bottom: 0;
  }

  .record-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: 1fr;
    gap: 10px;
  }

  .record-card {
    min-height: 60px;
    height: 100%;
    padding: 12px 14px;
  }

  .record-card .icon-well {
    width: 32px;
    height: 32px;
    border-radius: 10px;
  }

  .record-label {
    font-size: 14px;
  }

  .attention-grid {
    grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
  }
}

@media (max-width: 767px) {
  .identity,
  .panel,
  .seller-strip {
    padding: 14px;
  }

  .attention-card,
  .attention-skeleton {
    min-height: 84px;
  }

  .record-card {
    min-height: 48px;
  }

  .recent-card,
  .seller-strip,
  .menu-item,
  .logout-btn {
    min-height: 44px;
  }

  .seller-strip {
    min-height: 56px;
  }
}

@media (max-width: 639px) {
  .recent-card {
    flex-wrap: wrap;
  }

  .status-pill {
    order: 2;
  }

  .recent-go {
    order: 3;
    margin-left: auto;
  }
}

@media (max-width: 359px) {
  .attention-grid,
  .record-grid,
  .more-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .trust-chip,
  .menu-item,
  .logout-btn,
  .distribution-item,
  .attention-card,
  .record-card,
  .seller-strip,
  .recent-card,
  .summary-arrow,
  .skeleton::after {
    transition: none;
    animation: none;
    transform: none;
  }
}
</style>
