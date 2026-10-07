<template>
  <div class="user-page">
    <div class="page-container">
      <section class="identity-card" aria-labelledby="user-display-name">
        <div class="identity-main">
          <AvatarImage
            :src="avatar"
            :candidates="userStore.avatarCandidates"
            :seed="avatarSeed"
            :size="128"
            alt=""
            class="user-avatar"
            loading-mode="eager"
          />
          <div class="user-detail">
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
            <p class="user-id">{{ handle }}</p>
            <p class="trust-detail">{{ trustHint.detail }}<template v-if="daysOnStoreText"> · {{ daysOnStoreText }}</template></p>
            <router-link v-if="publicProfilePath" :to="publicProfilePath" class="profile-link">
              查看我的公开主页
              <ArrowUpRight :size="14" aria-hidden="true" />
            </router-link>
          </div>
        </div>
      </section>

      <section class="panel attention-panel" aria-labelledby="attention-title">
        <div class="panel-head">
          <h2 id="attention-title">需要处理</h2>
          <p>先处理未完成的支付、收货、退款和消息。</p>
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
            <span class="attention-icon" aria-hidden="true">
              <component :is="attentionIcons[item.key]" :size="18" :stroke-width="1.8" />
            </span>
            <strong>{{ formatHubNumber(item.count) }}</strong>
            <span>{{ item.label }}</span>
            <small v-if="item.hint">{{ item.hint }}</small>
          </router-link>
        </div>
        <div v-else class="empty-box">
          <p>目前没有待办。</p>
          <router-link to="/" class="empty-link">去物品广场看看</router-link>
        </div>
      </section>

      <div class="hub-split">
        <section class="panel" aria-labelledby="recent-title">
          <div class="panel-head row-head">
            <div>
              <h2 id="recent-title">最近订单</h2>
              <p>继续支付、查看交付或跟进退款。</p>
            </div>
            <router-link to="/user/orders" class="text-link">查看全部</router-link>
          </div>
          <div v-if="attentionLoading" class="recent-list" aria-live="polite">
            <div v-for="item in 3" :key="item" class="recent-card">
              <span class="skeleton pill mid" />
              <span class="skeleton line" />
            </div>
          </div>
          <div v-else-if="recentOrders.length" class="recent-list">
            <article v-for="order in recentOrders" :key="order.orderNo || order.id" class="recent-card">
              <div class="recent-copy">
                <strong>{{ order.productName }}</strong>
                <span>{{ formatHubAmount(order.amount) }} LDC · {{ recentOrderStatusLabel(order) }}</span>
              </div>
              <router-link :to="orderAction(order).to" class="recent-action">
                {{ orderAction(order).label }}
              </router-link>
            </article>
          </div>
          <div v-else class="empty-box">
            <p>还没有购买记录。</p>
            <router-link to="/" class="empty-link">去逛逛物品</router-link>
          </div>
        </section>

        <section class="panel" aria-labelledby="records-title">
          <div class="panel-head">
            <h2 id="records-title">我的记录</h2>
            <p>订单、优惠券、求购和收藏都在这里。</p>
          </div>
          <div class="record-grid">
            <router-link
              v-for="item in recordLinks"
              :key="item.key"
              :to="item.to"
              class="record-card"
            >
              <span class="record-icon" aria-hidden="true">
                <component :is="recordIcons[item.key]" :size="18" :stroke-width="1.8" />
              </span>
              <span class="record-label">{{ item.label }}</span>
              <span v-if="item.badge" class="record-badge">{{ item.badge }}</span>
            </router-link>
          </div>
        </section>
      </div>

      <router-link
        v-if="showSellerChannel"
        to="/seller"
        class="seller-channel"
        :aria-label="sellerChannelAriaLabel"
      >
        <span class="seller-icon" aria-hidden="true">
          <Store :size="18" :stroke-width="1.8" />
        </span>
        <span>
          <strong>卖家后台</strong>
          <small>{{ sellerChannelHint }}</small>
        </span>
        <span class="seller-go">进入卖家后台</span>
      </router-link>

      <details class="panel spending-panel">
        <summary>
          <span>
            <strong>消费画像</strong>
            <small>{{ spendingSummary }}</small>
          </span>
          <span class="summary-arrow" aria-hidden="true">▾</span>
        </summary>
        <div v-if="dashboardLoading" class="distribution-list" aria-live="polite">
          <div v-for="item in 3" :key="item" class="distribution-item">
            <span class="skeleton pill mid" />
            <span class="skeleton bar-skeleton" />
          </div>
        </div>
        <p v-else-if="dashboardError" class="error-box" role="alert">{{ dashboardError }}</p>
        <div v-else-if="distributionCategories.length" class="distribution-toolbar">
          <div class="switch-group">
            <button type="button" :class="['switch-btn', { active: distributionMode === 'orders' }]" @click="distributionMode = 'orders'">按订单数</button>
            <button type="button" :class="['switch-btn', { active: distributionMode === 'amount' }]" @click="distributionMode = 'amount'">按积分</button>
          </div>
        </div>
        <div v-if="!dashboardLoading && !dashboardError && distributionCategories.length" class="distribution-list">
          <button
            v-for="item in distributionCategories"
            :key="`${item.categoryId}-${item.categoryName}`"
            type="button"
            class="distribution-item"
            @click="jumpToDistributionOrders(item)"
          >
            <div class="row between">
              <span class="distribution-name">{{ item.categoryIcon || '📦' }} {{ item.categoryName }}</span>
              <strong>{{ distributionMode === 'orders' ? `${formatHubNumber(item.orderCount)} 单` : `${formatHubAmount(item.amount)} LDC` }}</strong>
            </div>
            <div class="row between meta-row">
              <span>{{ formatHubNumber(item.orderCount) }} 单 / {{ formatHubNumber(item.quantity) }} 件</span>
              <span>{{ formatHubAmount(item.amount) }} LDC</span>
            </div>
            <div class="bar"><span class="fill" :style="{ width: `${distributionWidth(item, distributionMaxValue, distributionMode)}%` }" /></div>
            <span class="hint-row">查看该分类已成交订单 →</span>
          </button>
        </div>
        <div v-else-if="!dashboardLoading && !dashboardError" class="empty-box">还没有已成交的购买记录，后续消费会自动出现在这里。</div>
      </details>

      <section class="menu-section" aria-labelledby="tools-title">
        <h2 id="tools-title" class="section-title">工具</h2>
        <div class="menu-list">
          <router-link v-for="item in toolLinks" :key="item.label" :to="item.to" class="menu-item">
            <span class="menu-icon" aria-hidden="true">
              <component :is="item.icon" :size="18" :stroke-width="1.8" />
            </span>
            <span class="menu-label">{{ item.label }}</span>
            <span class="menu-arrow" aria-hidden="true">→</span>
          </router-link>
        </div>
      </section>

      <section class="menu-section" aria-labelledby="account-title">
        <h2 id="account-title" class="section-title">账号与社区</h2>
        <div class="menu-list">
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
            <span class="menu-icon" aria-hidden="true">
              <component :is="item.icon" :size="18" :stroke-width="1.8" />
            </span>
            <span class="menu-label">{{ item.label }}</span>
            <span class="menu-arrow" aria-hidden="true">→</span>
          </component>
        </div>
      </section>

      <button class="logout-btn" type="button" @click="handleLogout">退出登录</button>
    </div>
  </div>
</template>

<script setup>
import {
  ArrowUpRight,
  CircleHelp,
  ClipboardList,
  ClipboardPenLine,
  Clock3,
  Flag,
  Heart,
  ExternalLink,
  Image as ImageIcon,
  Megaphone,
  MessageCircle,
  RotateCcw,
  Store,
  TicketPercent,
  Truck
} from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
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
  buildTrustHint,
  distributionWidth,
  formatHubAmount,
  formatHubNumber,
  recentOrderAction,
  recentOrderStatusLabel,
  sellerChannelCopy,
  shouldShowSellerChannel,
  sortDistributionCategories,
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
const toolLinks = [
  { icon: ImageIcon, label: '士多图床', to: '/ld-image' },
  { icon: CircleHelp, label: '帮助中心', to: '/docs' },
  { icon: Megaphone, label: '公告中心', to: '/announcements' }
]
const accountLinks = [
  { icon: Heart, label: '支持士多', to: '/support' },
  { icon: ExternalLink, label: 'Linux.do 社区', href: 'https://linux.do', target: '_blank', rel: 'noopener' },
  { icon: ExternalLink, label: 'GitHub', href: 'https://github.com/caigg188/LDStatusPro', target: '_blank', rel: 'noopener' }
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
const distributionMode = ref('amount')

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
const distributionCategories = computed(() => sortDistributionCategories(
  spendingDistribution.value.categories,
  distributionMode.value
))
const distributionMaxValue = computed(() => distributionCategories.value.reduce((maxValue, item) => {
  const nextValue = distributionMode.value === 'orders' ? Number(item.orderCount || 0) : Number(item.amount || 0)
  return Math.max(maxValue, nextValue)
}, 0))

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
  padding-bottom: 80px;
  background: var(--bg-primary);
  color-scheme: light;
  --user-card-border: var(--palette-hex-dfd6ca);
  --user-card-bg: var(--palette-hex-fcfaf6);
  --user-card-shadow: 0 14px 32px var(--palette-rgba-61-61-61-0p06);
  --user-subtle-bg: var(--palette-hex-f5f3ef);
  --user-subtle-strong-bg: var(--palette-hex-f0ede8);
  --user-subtle-border: var(--palette-hex-e4dbcf);
  --user-hover-border: var(--palette-hex-cad6cb);
  --user-hover-shadow: 0 10px 22px var(--palette-rgba-61-61-61-0p06);
  --user-empty-bg: var(--palette-hex-f8f5ef);
  --user-track-bg: var(--palette-hex-e7dfd3);
  --user-accent: var(--palette-hex-7f9681);
  --user-avatar-border: var(--palette-rgba-255-255-255-0p92);
  --user-avatar-shadow: 0 10px 24px var(--palette-rgba-61-61-61-0p12);
  --user-switch-shell-bg: var(--palette-hex-f4f0e9);
  --user-skeleton-bg: var(--palette-hex-e2e8f0);
  --user-skeleton-shine: var(--palette-rgba-255-255-255-0p68);
  --user-menu-bg: var(--palette-hex-fcfaf6);
  --user-menu-hover-bg: var(--palette-hex-f4f0e9);
  --user-menu-border: var(--palette-hex-e4dbcf);
  --user-logout-bg: var(--palette-hex-fcfaf6);
  --user-attention-bg: var(--palette-hex-edf2ea);
  --user-badge-bg: var(--palette-hex-738a76);
}

:global(html.dark .user-page) {
  color-scheme: dark;
  --user-card-border: var(--palette-hex-302a24);
  --user-card-bg: var(--palette-hex-1f1b18);
  --user-card-shadow: 0 18px 42px var(--palette-rgba-0-0-0-0p26);
  --user-subtle-bg: var(--palette-hex-2b2520);
  --user-subtle-strong-bg: var(--palette-hex-302923);
  --user-subtle-border: var(--palette-hex-302a24);
  --user-hover-border: var(--palette-hex-424443);
  --user-hover-shadow: 0 12px 28px var(--palette-rgba-0-0-0-0p24);
  --user-empty-bg: var(--palette-hex-261c1c);
  --user-track-bg: var(--palette-hex-41372f);
  --user-accent: var(--palette-hex-8fb090);
  --user-avatar-border: var(--palette-hex-352e24);
  --user-avatar-shadow: 0 12px 28px var(--palette-rgba-0-0-0-0p28);
  --user-switch-shell-bg: var(--palette-hex-3c342c);
  --user-skeleton-bg: var(--palette-hex-413931);
  --user-skeleton-shine: var(--palette-rgba-255-255-255-0p08);
  --user-menu-bg: var(--palette-hex-221d19);
  --user-menu-hover-bg: var(--palette-hex-312a24);
  --user-menu-border: var(--palette-hex-302a24);
  --user-logout-bg: var(--palette-hex-1f1b18);
  --user-attention-bg: var(--palette-hex-2f322a);
  --user-badge-bg: var(--palette-hex-8fb090);
}

.page-container {
  max-width: 1080px;
}

.identity-card,
.panel,
.seller-channel,
.menu-list,
.logout-btn {
  border: 1px solid var(--user-card-border);
  background: var(--user-card-bg);
  box-shadow: var(--user-card-shadow);
  isolation: isolate;
}

.identity-card,
.panel,
.seller-channel {
  margin-bottom: var(--section-gap);
  padding: var(--detail-pad);
  border-radius: var(--card-radius);
}

.identity-main,
.user-detail,
.recent-card,
.seller-channel,
.menu-item,
.row {
  display: flex;
}

.identity-main,
.user-detail {
  min-width: 0;
}

.identity-main {
  align-items: center;
  gap: 16px;
}

.user-avatar {
  width: 72px;
  height: 72px;
  border: 3px solid var(--user-avatar-border);
  border-radius: 50%;
  object-fit: cover;
  box-shadow: var(--user-avatar-shadow);
}

.user-detail {
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.user-name {
  margin: 0;
  font-size: var(--text-display);
  font-weight: 700;
  color: var(--text-primary);
}

.user-id,
.trust-detail {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 13px;
}

.profile-link,
.text-link,
.empty-link,
.recent-action,
.seller-go,
.linkish,
.hint-row {
  color: var(--user-accent);
  font-weight: 600;
}

.profile-link,
.text-link,
.empty-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  min-height: 32px;
  font-size: 13px;
}

.trust-chip,
.switch-btn,
.menu-item,
.logout-btn,
.distribution-item,
.attention-card,
.record-card,
.seller-channel,
.recent-action {
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.trust-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 999px;
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
  margin-bottom: 16px;
}

.panel-head h2,
.spending-panel strong {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.panel-head p,
.spending-panel small,
.meta-row,
.empty-box,
.error-box,
.seller-channel small {
  margin: 6px 0 0;
  color: var(--text-tertiary);
  font-size: 13px;
  line-height: 1.5;
}

.row-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.attention-grid,
.record-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.attention-card,
.record-card,
.recent-card,
.distribution-item {
  border: 1px solid var(--user-subtle-border);
  border-radius: 16px;
  background: var(--user-subtle-bg);
  text-decoration: none;
}

.attention-card,
.record-card {
  display: grid;
  gap: 4px;
  min-height: 92px;
  padding: 14px;
  color: var(--text-primary);
}

.attention-card {
  background: var(--user-attention-bg);
}

.attention-card strong,
.recent-copy strong {
  font-size: 22px;
  line-height: 1.1;
}

.attention-card span,
.record-label,
.recent-copy span {
  color: var(--text-secondary);
  font-size: 13px;
}

.attention-card small {
  color: var(--user-accent);
  font-size: 12px;
}

.attention-icon,
.record-icon,
.seller-icon,
.menu-icon {
  display: inline-flex;
  color: var(--user-accent);
}

.record-card {
  position: relative;
  align-content: start;
}

.record-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  min-width: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--user-badge-bg);
  color: var(--palette-hex-ffffff);
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}

.hub-split,
.recent-list,
.distribution-list {
  display: grid;
  gap: 12px;
}

.recent-card {
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
}

.recent-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.recent-copy strong {
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-action {
  flex-shrink: 0;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--user-attention-bg);
  font-size: 13px;
  line-height: 36px;
}

.seller-channel {
  align-items: center;
  gap: 12px;
  color: var(--text-primary);
  text-decoration: none;
}

.seller-channel span:nth-child(2) {
  display: grid;
  flex: 1;
  min-width: 0;
}

.seller-go {
  margin-left: auto;
  font-size: 13px;
}

.spending-panel summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  list-style: none;
}

.spending-panel summary::-webkit-details-marker {
  display: none;
}

.spending-panel summary span:first-child,
.seller-channel span:nth-child(2) {
  min-width: 0;
}

.summary-arrow {
  color: var(--user-accent);
}

.distribution-toolbar {
  display: flex;
  justify-content: flex-end;
  margin: 14px 0 12px;
}

.switch-group {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  border: 1px solid var(--user-subtle-border);
  border-radius: 999px;
  background: var(--user-switch-shell-bg);
}

.switch-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.switch-btn.active {
  color: var(--palette-hex-ffffff);
  background: var(--user-accent);
}

.distribution-item {
  width: 100%;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
}

.distribution-item:hover,
.attention-card:hover,
.record-card:hover,
.recent-card:hover,
.seller-channel:hover,
.menu-item:hover {
  transform: translateY(-1px);
  border-color: var(--user-hover-border);
  box-shadow: var(--user-hover-shadow);
}

.distribution-name {
  font-weight: 600;
  color: var(--text-primary);
}

.row.between {
  justify-content: space-between;
  gap: 8px;
}

.meta-row {
  margin: 8px 0;
  font-size: 12px;
}

.hint-row {
  display: block;
  margin-top: 8px;
  font-size: 12px;
}

.bar,
.bar-skeleton {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--user-track-bg);
}

.fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--user-accent);
}

.error-box,
.empty-box {
  padding: 16px;
  border-radius: 16px;
}

.error-box {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.empty-box {
  text-align: center;
  background: var(--user-empty-bg);
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
  border-radius: 999px;
}

.attention-skeleton {
  height: 92px;
  border-radius: 16px;
}

.pill {
  height: 14px;
}

.pill.mid {
  width: 112px;
}

.line {
  width: 72%;
  height: 18px;
  margin-top: 10px;
  border-radius: 10px;
}

.menu-section {
  margin-bottom: 20px;
}

.section-title {
  margin: 0 0 12px 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.menu-list {
  overflow: hidden;
  border-radius: 16px;
}

.menu-item {
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--user-menu-border);
  color: var(--text-primary);
  text-decoration: none;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  margin-right: 14px;
}

.menu-label {
  flex: 1;
  font-size: 15px;
}

.menu-arrow {
  color: var(--text-tertiary);
}

.logout-btn {
  width: 100%;
  margin-top: 8px;
  padding: 16px;
  border-radius: 16px;
  color: var(--color-danger);
  font-size: 15px;
  cursor: pointer;
}

.logout-btn:hover {
  border-color: var(--color-danger);
  background: var(--color-danger-light);
}

@keyframes skeleton-shimmer {
  100% { transform: translateX(100%); }
}

@media (min-width: 768px) {
  .hub-split {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    gap: 16px;
    margin-bottom: var(--section-gap);
  }

  .hub-split > .panel {
    margin-bottom: 0;
  }
}

@media (max-width: 767px) {
  .identity-card,
  .panel,
  .seller-channel {
    padding: 18px;
    border-radius: 20px;
  }

  .attention-grid,
  .record-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 639px) {
  .identity-card,
  .panel,
  .seller-channel {
    padding: 12px;
    border-radius: 18px;
  }

  .identity-main {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    gap: 10px;
  }

  .user-avatar {
    width: 56px;
    height: 56px;
    border-width: 2px;
  }

  .user-name {
    font-size: 18px;
  }

  .attention-grid {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .attention-card,
  .attention-skeleton {
    flex: 0 0 132px;
    min-height: 86px;
  }

  .record-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .record-card {
    min-height: 86px;
  }

  .menu-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .menu-item {
    min-height: 86px;
    padding: 12px;
    border: 1px solid var(--user-menu-border);
    border-radius: 14px;
    background: var(--user-menu-bg);
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .menu-item:last-child {
    border-bottom: 1px solid var(--user-menu-border);
  }

  .menu-list > .menu-item:last-child:nth-child(odd) {
    grid-column: 1 / -1;
    min-height: 0;
    flex-direction: row;
    align-items: center;
  }

  .menu-icon {
    margin-right: 0;
  }

  .menu-arrow {
    margin-top: auto;
    align-self: flex-end;
  }

  .menu-list > .menu-item:last-child:nth-child(odd) .menu-arrow {
    margin-top: 0;
    margin-left: auto;
    align-self: center;
  }

  .logout-btn {
    margin-top: 12px;
    padding: 14px;
  }
}

@media (max-width: 359px) {
  .record-grid,
  .menu-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
