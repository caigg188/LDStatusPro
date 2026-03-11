<template>
  <div class="user-page">
    <div class="page-container">
      <div class="user-card">
        <div class="hero">
          <div class="hero-top">
            <div class="user-info">
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
                  <h2 class="user-name">{{ username }}</h2>
                  <span :class="['trust-chip', trustLevelToneClass]">信任等级 {{ trustLevelLabel }}</span>
                </div>
                <p class="user-id">@{{ user?.username }}</p>
                <div class="badges">
                  <template v-if="dashboardLoading">
                    <span class="skeleton pill wide" />
                    <span class="skeleton pill" />
                    <span class="skeleton pill" />
                  </template>
                  <template v-else>
                    <span class="badge badge-primary">来士多已 {{ overview.daysOnStore > 0 ? `${formatNumber(overview.daysOnStore)} 天` : '刚来逛逛' }}</span>
                    <span v-if="overview.firstActivityAt" class="badge">首次记录 {{ formatDateTime(overview.firstActivityAt, true) }}</span>
                    <span v-if="overview.latestActivityAt" class="badge">最近活跃 {{ formatDateTime(overview.latestActivityAt, true) }}</span>
                  </template>
                </div>
              </div>
            </div>

            <div v-if="ldcInfo" class="balance-grid">
              <div class="balance-card">
                <span class="muted">可用余额</span>
                <strong>{{ ldcInfo.available_balance || '0.00' }}</strong>
                <span class="muted">LDC</span>
              </div>
              <div class="balance-card">
                <span class="muted">今日额度</span>
                <strong class="accent">{{ ldcInfo.remain_quota || '0.00' }}</strong>
                <span class="muted">LDC</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="dashboardLoading" class="loading-wrap">
          <div class="stats-grid">
            <div v-for="item in 6" :key="item" class="stat-card loading-card">
              <span class="skeleton pill short" />
              <span class="skeleton line tall" />
              <span class="skeleton pill mid" />
            </div>
          </div>
          <div class="distribution-panel loading-card">
            <div class="panel-head">
              <div>
                <span class="skeleton pill mid" />
                <span class="skeleton pill wide mt8" />
              </div>
              <span class="skeleton pill switcher" />
            </div>
            <div v-for="item in 3" :key="`loading-${item}`" class="distribution-item loading-item">
              <div class="row between">
                <span class="skeleton pill mid" />
                <span class="skeleton pill short" />
              </div>
              <div class="row between mt8">
                <span class="skeleton pill wide" />
                <span class="skeleton pill short" />
              </div>
              <div class="bar mt8"><span class="fill loading-fill" :style="{ width: `${56 + item * 10}%` }" /></div>
            </div>
          </div>
        </div>

        <div v-else-if="dashboardError" class="error-box">{{ dashboardError }}</div>

        <template v-else>
          <div class="stats-grid">
            <article v-for="card in statCards" :key="card.label" :class="['stat-card', card.tone]">
              <span class="muted">{{ card.label }}</span>
              <strong class="stat-value">
                {{ card.value }}
                <span v-if="card.unit" class="unit">{{ card.unit }}</span>
              </strong>
              <span class="meta">{{ card.meta }}</span>
            </article>
          </div>

          <section class="distribution-panel">
            <div class="panel-head">
              <div class="panel-intro">
                <details v-if="canShowIncomeDistribution" ref="distributionMenuRef" class="panel-title-menu">
                  <summary class="panel-title-trigger">
                    <span class="panel-title">{{ activeDistributionTitle }}</span>
                    <span class="panel-title-arrow">▾</span>
                  </summary>
                  <div class="panel-title-options">
                    <button
                      type="button"
                      :class="['panel-title-option', { active: activeDistributionScope === 'expense' }]"
                      @click.prevent="selectDistributionScope('expense')"
                    >
                      支出分布
                    </button>
                    <button
                      type="button"
                      :class="['panel-title-option', { active: activeDistributionScope === 'income' }]"
                      @click.prevent="selectDistributionScope('income')"
                    >
                      收入分布
                    </button>
                  </div>
                </details>
                <h3 v-else class="panel-title standalone">{{ activeDistributionTitle }}</h3>
                <p class="panel-subtitle">{{ activeDistributionSubtitle }}</p>
              </div>
              <div class="toolbar">
                <div class="switch-group metric-switch">
                  <button type="button" :class="['switch-btn', { active: distributionMode === 'orders' }]" @click="distributionMode = 'orders'">按订单数</button>
                  <button type="button" :class="['switch-btn', { active: distributionMode === 'amount' }]" @click="distributionMode = 'amount'">按积分</button>
                </div>
              </div>
            </div>

            <div v-if="distributionCategories.length > 0" class="distribution-list">
              <button
                v-for="item in distributionCategories"
                :key="`${activeDistributionScope}-${item.categoryId}-${item.categoryName}`"
                type="button"
                class="distribution-item"
                @click="jumpToDistributionOrders(item)"
              >
                <div class="row between">
                  <div class="row gap8">
                    <span class="distribution-icon">{{ item.categoryIcon || '📦' }}</span>
                    <span class="distribution-name">{{ item.categoryName }}</span>
                  </div>
                  <strong>{{ getDistributionValueLabel(item) }}</strong>
                </div>
                <div class="row between meta-row">
                  <span>{{ formatNumber(item.orderCount) }} 单 / {{ formatNumber(item.quantity) }} 件</span>
                  <span>{{ formatAmount(item.amount) }} LDC</span>
                </div>
                <div class="bar">
                  <span :class="['fill', activeDistributionScope]" :style="{ width: `${getDistributionWidth(item)}%` }" />
                </div>
                <div class="row between hint-row">
                  <span>{{ distributionJumpHint }}</span>
                  <span class="linkish">查看订单 →</span>
                </div>
              </button>
            </div>
            <div v-else class="empty-box">{{ activeDistributionEmptyText }}</div>
          </section>
        </template>
      </div>

      <div class="menu-section">
        <h3 class="section-title">我的服务</h3>
        <div class="menu-list">
          <component
            :is="item.to ? 'router-link' : 'a'"
            v-for="item in serviceLinks"
            :key="item.label"
            :to="item.to"
            :href="item.href"
            :target="item.target"
            :rel="item.rel"
            class="menu-item"
          >
            <span class="menu-icon">{{ item.icon }}</span>
            <span class="menu-label">{{ item.label }}</span>
            <span class="menu-arrow">→</span>
          </component>
        </div>
      </div>

      <div class="menu-section">
        <h3 class="section-title">其他</h3>
        <div class="menu-list">
          <component
            :is="item.to ? 'router-link' : 'a'"
            v-for="item in otherLinks"
            :key="item.label"
            :to="item.to"
            :href="item.href"
            :target="item.target"
            :rel="item.rel"
            class="menu-item"
          >
            <span class="menu-icon">{{ item.icon }}</span>
            <span class="menu-label">{{ item.label }}</span>
            <span class="menu-arrow">→</span>
          </component>
        </div>
      </div>

      <button class="logout-btn" @click="handleLogout">退出登录</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { useUserStore } from '@/stores/user'
import AvatarImage from '@/components/common/AvatarImage.vue'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'

const EMPTY_OVERVIEW = Object.freeze({ daysOnStore: 0, firstActivityAt: '', latestActivityAt: '', totalPurchaseOrders: 0, totalPurchaseQuantity: 0, totalSpent: 0, totalSellOrders: 0, totalSellQuantity: 0, totalRevenue: 0, publishedProductCount: 0, approvedProductCount: 0, activeProductCount: 0, favoriteCount: 0, distinctPurchasedProducts: 0, distinctBuyers: 0, purchasedCategoryCount: 0 })
const EMPTY_DISTRIBUTION = Object.freeze({ categories: [], totals: { orderCount: 0, quantity: 0, amount: 0 } })
const EMPTY_MERCHANT = Object.freeze({ configured: false })

const serviceLinks = [
  { icon: '📦', label: '我的订单', to: '/user/orders' },
  { icon: '⭐', label: '我的收藏', to: '/user/favorites' },
  { icon: '🧾', label: '我的求购', to: '/user/buy-requests' },
  { icon: '💬', label: '我的消息', to: '/user/messages' },
  { icon: '🛍️', label: '我的物品', to: '/user/products' },
  { icon: '➕', label: '发布物品', to: '/publish' },
  { icon: '⚙️', label: '收款设置', to: '/user/settings' },
  { icon: '🏪', label: '小店入驻', to: '/user/my-shop' }
]

const otherLinks = [
  { icon: '🖼️', label: '士多图床', to: '/ld-image' },
  { icon: '💳', label: 'LDC 官网', href: 'https://credit.linux.do/home', target: '_blank', rel: 'noopener' },
  { icon: '🌐', label: 'Linux.do 社区', href: 'https://linux.do', target: '_blank', rel: 'noopener' },
  { icon: '📊', label: 'LDStatus Pro', href: 'https://ldspro.qzz.io/', target: '_blank', rel: 'noopener' },
  { icon: '🐙', label: 'GitHub', href: 'https://github.com/caigg188/LDStatusPro', target: '_blank', rel: 'noopener' }
]

const router = useRouter()
const userStore = useUserStore()
const shopStore = useShopStore()
const dialog = useDialog()
const toast = useToast()

const dashboardLoading = ref(true)
const dashboardError = ref('')
const dashboard = ref(null)
const distributionScope = ref('expense')
const distributionMode = ref('amount')
const distributionMenuRef = ref(null)

const user = computed(() => userStore.user)
const username = computed(() => user.value?.name || user.value?.username || '用户')
const trustLevelNumber = computed(() => {
  const level = Number(userStore.trustLevel)
  return Number.isFinite(level) ? Math.max(0, Math.floor(level)) : null
})
const trustLevelLabel = computed(() => trustLevelNumber.value === null ? 'TL?' : `TL${trustLevelNumber.value}`)
const trustLevelToneClass = computed(() => {
  const level = trustLevelNumber.value
  if (level === null) return 'trust-unknown'
  if (level >= 4) return 'trust-elite'
  if (level === 3) return 'trust-high'
  if (level === 2) return 'trust-mid'
  if (level === 1) return 'trust-basic'
  return 'trust-new'
})
const avatarSeed = computed(() => user.value?.name || user.value?.username || user.value?.id || 'user')
const avatar = computed(() => userStore.avatar)
const ldcInfo = computed(() => userStore.ldcInfo)
const overview = computed(() => dashboard.value?.overview || EMPTY_OVERVIEW)
const merchant = computed(() => dashboard.value?.merchant || EMPTY_MERCHANT)
const spendingDistribution = computed(() => dashboard.value?.spendingDistribution || EMPTY_DISTRIBUTION)
const incomeDistribution = computed(() => dashboard.value?.incomeDistribution || EMPTY_DISTRIBUTION)
const canShowIncomeDistribution = computed(() => merchant.value.configured === true || incomeDistribution.value.categories.length > 0)
const activeDistributionScope = computed(() => distributionScope.value === 'income' && canShowIncomeDistribution.value ? 'income' : 'expense')
const activeDistribution = computed(() => activeDistributionScope.value === 'income' ? incomeDistribution.value : spendingDistribution.value)
const activeDistributionTitle = computed(() => activeDistributionScope.value === 'income' ? '收入分布' : '支出分布')
const activeDistributionSubtitle = computed(() => activeDistributionScope.value === 'income' ? '按分类查看你卖出的已成交订单数、售出数量与积分收入' : '按分类查看你买入的已成交订单数、购买数量与积分花费')
const distributionJumpHint = computed(() => activeDistributionScope.value === 'income' ? '点击查看该分类我卖的已成交订单' : '点击查看该分类我买的已成交订单')
const activeDistributionEmptyText = computed(() => activeDistributionScope.value === 'income' ? '暂时还没有可展示的收入分布，后续成交后会自动出现在这里。' : '还没有已成交的购买记录，后续消费会自动出现在这里。')

const statCards = computed(() => ([
  { label: '累计购买订单', value: formatNumber(overview.value.totalPurchaseOrders), meta: `共买入 ${formatNumber(overview.value.totalPurchaseQuantity)} 件`, tone: 'tone-sage' },
  { label: '累计卖出订单', value: formatNumber(overview.value.totalSellOrders), meta: `共卖出 ${formatNumber(overview.value.totalSellQuantity)} 件`, tone: 'tone-stone' },
  { label: '累计花费积分', value: formatAmount(overview.value.totalSpent), unit: 'LDC', meta: `覆盖 ${formatNumber(overview.value.purchasedCategoryCount)} 个分类`, tone: 'tone-gold' },
  { label: '累计收入积分', value: formatAmount(overview.value.totalRevenue), unit: 'LDC', meta: `服务过 ${formatNumber(overview.value.distinctBuyers)} 位买家`, tone: 'tone-moss' },
  { label: '在售物品', value: formatNumber(overview.value.activeProductCount), meta: `累计发布 ${formatNumber(overview.value.publishedProductCount)} 件`, tone: 'tone-plain' },
  { label: '收藏夹', value: formatNumber(overview.value.favoriteCount), meta: `买过 ${formatNumber(overview.value.distinctPurchasedProducts)} 个物品`, tone: 'tone-plain' }
]))

const distributionCategories = computed(() => {
  const items = Array.isArray(activeDistribution.value.categories) ? [...activeDistribution.value.categories] : []
  return items.sort((left, right) => {
    const primary = distributionMode.value === 'orders'
      ? Number(right.orderCount || 0) - Number(left.orderCount || 0)
      : Number(right.amount || 0) - Number(left.amount || 0)
    if (primary !== 0) return primary
    return Number(right.quantity || 0) - Number(left.quantity || 0)
  })
})

const distributionMaxValue = computed(() => distributionCategories.value.reduce((maxValue, item) => {
  const nextValue = distributionMode.value === 'orders' ? Number(item.orderCount || 0) : Number(item.amount || 0)
  return Math.max(maxValue, nextValue)
}, 0))

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Math.max(Number(value) || 0, 0))
}

function formatAmount(value) {
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Math.max(Number(value) || 0, 0))
}

function formatDateTime(value, short = false) {
  const text = String(value || '').trim()
  return text ? (short ? text.slice(0, 10) : text.slice(0, 16)) : ''
}

function getDistributionWidth(item) {
  const currentValue = distributionMode.value === 'orders' ? Number(item.orderCount || 0) : Number(item.amount || 0)
  const maxValue = distributionMaxValue.value
  if (maxValue <= 0 || currentValue <= 0) return 0
  return Math.max(10, Math.min((currentValue / maxValue) * 100, 100))
}

function getDistributionValueLabel(item) {
  return distributionMode.value === 'orders' ? `${formatNumber(item.orderCount)} 单` : `${formatAmount(item.amount)} LDC`
}

function selectDistributionScope(scope) {
  if (!['expense', 'income'].includes(scope)) return
  distributionScope.value = scope
  if (distributionMenuRef.value) {
    distributionMenuRef.value.open = false
  }
}

function jumpToDistributionOrders(item) {
  const categoryId = Number.parseInt(item?.categoryId, 10)
  if (!Number.isInteger(categoryId) || categoryId <= 0) return
  router.push({
    path: '/user/orders',
    query: {
      tab: activeDistributionScope.value === 'income' ? 'seller' : 'buyer',
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
    const result = await shopStore.fetchUserDashboard()
    if (result) {
      dashboard.value = result
      return
    }
    dashboard.value = null
    dashboardError.value = shopStore.consumeLastError?.() || '个人统计加载失败，请稍后重试'
  } catch (error) {
    dashboard.value = null
    dashboardError.value = error.message || '个人统计加载失败，请稍后重试'
  } finally {
    dashboardLoading.value = false
  }
}

onMounted(async () => {
  const tasks = [loadDashboard()]
  if (typeof userStore.fetchLdcInfo === 'function') tasks.push(userStore.fetchLdcInfo())
  const results = await Promise.allSettled(tasks)
  if (results[0]?.status === 'rejected') {
    toast.error(results[0].reason?.message || '个人统计加载失败，请稍后重试')
  }
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
  background: #f5f2ec;
}

.page-container {
  max-width: 760px;
  margin: 0 auto;
  padding: 16px;
}

.user-card {
  margin-bottom: 20px;
  padding: 24px;
  border: 1px solid #dfd6ca;
  border-radius: 24px;
  background: rgba(252, 250, 246, 0.98);
  box-shadow: 0 14px 32px rgba(61, 61, 61, 0.06);
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-bottom: 20px;
}

.hero-top {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(208px, 240px);
  gap: 16px;
  align-items: start;
}

.user-info,
.row {
  display: flex;
  align-items: center;
}

.user-info {
  gap: 16px;
  min-width: 0;
}

.row.gap8 {
  gap: 8px;
}

.row.between {
  justify-content: space-between;
}

.user-avatar {
  width: 72px;
  height: 72px;
  border: 3px solid rgba(255, 255, 255, 0.92);
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 10px 24px rgba(61, 61, 61, 0.12);
}

.user-detail {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.user-name {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.user-id {
  margin: 6px 0 10px;
  font-size: 14px;
  color: var(--text-tertiary);
}

.trust-chip,
.badge,
.switch-btn,
.menu-item,
.logout-btn,
.distribution-item,
.panel-title-trigger,
.panel-title-option {
  transition: all 0.2s ease;
}

.trust-chip,
.badge {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 12px;
}

.trust-chip {
  font-weight: 600;
}

.trust-chip.trust-unknown {
  color: #667085;
  background: #eef1f5;
  border-color: #d8dee7;
}

.trust-chip.trust-new {
  color: #7b6c5f;
  background: #f2ebe2;
  border-color: #dfd3c5;
}

.trust-chip.trust-basic {
  color: #6d7b66;
  background: #edf2ea;
  border-color: #d4ded0;
}

.trust-chip.trust-mid {
  color: #617a71;
  background: #e7efeb;
  border-color: #d0ddd7;
}

.trust-chip.trust-high {
  color: #587168;
  background: #e2ebe7;
  border-color: #c4d4ce;
}

.trust-chip.trust-elite {
  color: #4e685f;
  background: #dce7e3;
  border-color: #bfcec8;
}

.badges {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  min-width: 0;
}

.badge {
  color: var(--text-secondary);
  background: #f0ece6;
  border-color: #e1d8cc;
  white-space: nowrap;
}

.badge-primary {
  color: #617862;
  background: #edf2ea;
  border-color: #d4ded0;
}

.balance-grid,
.stats-grid {
  display: grid;
  gap: 12px;
}

.balance-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.balance-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 104px;
  padding: 16px 18px;
  border: 1px solid #e5ddd1;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.8);
}

.balance-card strong {
  font-size: 28px;
  line-height: 1;
  color: #a57950;
}

.balance-card strong.accent {
  color: #738a76;
}

.muted,
.meta,
.hint-row,
.panel-subtitle,
.empty-box,
.error-box {
  font-size: 13px;
}

.muted {
  color: var(--text-tertiary);
}

.meta {
  color: var(--text-secondary);
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
  color: var(--text-tertiary);
  background: #f8f5ef;
}

.stats-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 118px;
  padding: 18px;
  border: 1px solid #e4dbcf;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.86);
}

.stat-value {
  font-size: 28px;
  line-height: 1.1;
  color: var(--text-primary);
}

.unit {
  margin-left: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.tone-sage {
  background: #eef3ed;
}

.tone-stone {
  background: #f2ede7;
}

.tone-gold {
  background: #f5eee3;
}

.tone-moss {
  background: #eaf1ea;
}

.tone-plain {
  background: #f7f4ee;
}

.distribution-panel {
  padding: 18px;
  border: 1px solid #e1d8cc;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.78);
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
}

.panel-intro {
  min-width: 0;
}

.panel-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.panel-title.standalone {
  display: inline-block;
}

.panel-title-menu {
  position: relative;
}

.panel-title-menu[open] .panel-title-trigger {
  border-color: #cfd9cf;
  background: #eef3ed;
}

.panel-title-menu summary::-webkit-details-marker {
  display: none;
}

.panel-title-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  list-style: none;
  cursor: pointer;
}

.panel-title-arrow {
  color: #718874;
  font-size: 14px;
}

.panel-title-options {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 5;
  display: grid;
  gap: 6px;
  min-width: 132px;
  padding: 8px;
  border: 1px solid #d8dfd7;
  border-radius: 14px;
  background: rgba(252, 250, 246, 0.98);
  box-shadow: 0 12px 28px rgba(61, 61, 61, 0.08);
}

.panel-title-option {
  padding: 9px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
}

.panel-title-option:hover,
.panel-title-option.active {
  color: #5f7565;
  background: #edf2ea;
}

.panel-subtitle {
  margin: 6px 0 0;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.toolbar {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.switch-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border: 1px solid #ddd4c7;
  border-radius: 999px;
  background: #f7f3ec;
}

.metric-switch {
  background: #f4f0e9;
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
  color: #fff;
  background: #7f9681;
  box-shadow: none;
}

.distribution-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.distribution-item {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid #e2d9cd;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  text-align: left;
  cursor: pointer;
}

.distribution-item:hover {
  transform: translateY(-1px);
  border-color: #cad6cb;
  box-shadow: 0 10px 22px rgba(61, 61, 61, 0.06);
}

.distribution-icon {
  font-size: 18px;
}

.distribution-name {
  font-weight: 600;
  color: var(--text-primary);
}

.meta-row {
  margin: 10px 0;
  color: var(--text-tertiary);
  font-size: 12px;
}

.hint-row {
  margin-top: 10px;
  color: var(--text-tertiary);
}

.linkish {
  color: #6f856f;
  font-weight: 600;
}

.bar {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e7dfd3;
}

.fill {
  display: block;
  height: 100%;
  border-radius: 999px;
}

.fill.expense {
  background: #b7aa9b;
}

.fill.income {
  background: #7f9681;
}

.loading-wrap {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.loading-card {
  background: rgba(255, 255, 255, 0.82);
}

.loading-item {
  cursor: default;
}

.loading-item:hover {
  transform: none;
  box-shadow: none;
  border-color: #e2d9cd;
}

.loading-fill {
  background: #cbbfb0;
}

.skeleton {
  position: relative;
  overflow: hidden;
  background: rgba(226, 232, 240, 0.72);
}

.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.68), transparent);
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.pill {
  display: block;
  height: 14px;
  border-radius: 999px;
}

.pill.wide {
  width: 132px;
}

.pill.mid {
  width: 112px;
}

.pill.short {
  width: 72px;
}

.line {
  display: block;
  height: 18px;
  border-radius: 10px;
}

.line.tall {
  height: 28px;
}

.mt8 {
  margin-top: 8px;
}

.switcher {
  width: 92px;
  height: 32px;
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
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
  text-decoration: none;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover {
  background: var(--bg-secondary);
}

.menu-icon {
  margin-right: 14px;
  font-size: 20px;
}

.menu-label {
  flex: 1;
  font-size: 15px;
}

.menu-arrow {
  font-size: 16px;
  color: var(--text-tertiary);
}

.logout-btn {
  width: 100%;
  margin-top: 20px;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: var(--bg-card);
  color: var(--color-danger);
  font-size: 15px;
  cursor: pointer;
}

.logout-btn:hover {
  border-color: var(--color-danger);
  background: var(--color-danger-light);
}

@keyframes skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}

@media (max-width: 720px) {
  .page-container {
    padding: 12px;
  }

  .user-card {
    padding: 18px;
    border-radius: 20px;
  }

  .hero-top {
    grid-template-columns: minmax(0, 1fr);
  }

  .badges {
    flex-wrap: wrap;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panel-head {
    flex-direction: column;
  }

  .toolbar {
    width: 100%;
    align-items: flex-start;
  }
}

@media (max-width: 520px) {
  .page-container {
    padding: 10px;
  }

  .user-card {
    padding: 14px;
    border-radius: 18px;
  }

  .hero {
    gap: 14px;
    margin-bottom: 16px;
  }

  .user-info {
    gap: 12px;
    align-items: flex-start;
  }

  .user-avatar {
    width: 56px;
    height: 56px;
    border-width: 2px;
  }

  .user-name {
    font-size: 20px;
  }

  .user-id {
    margin-bottom: 8px;
    font-size: 13px;
  }

  .trust-chip,
  .badge {
    min-height: 28px;
    padding: 0 10px;
    font-size: 11px;
  }

  .balance-grid,
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .balance-card {
    min-height: 86px;
    padding: 12px;
    border-radius: 14px;
  }

  .balance-card strong {
    font-size: 22px;
  }

  .stat-card {
    min-height: 94px;
    padding: 14px;
    gap: 6px;
    border-radius: 16px;
  }

  .stat-value {
    font-size: 24px;
  }

  .meta,
  .muted,
  .hint-row,
  .panel-subtitle,
  .empty-box,
  .error-box,
  .meta-row {
    font-size: 12px;
  }

  .row.between,
  .hint-row {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 6px;
  }

  .distribution-panel {
    padding: 14px;
    border-radius: 18px;
  }

  .distribution-item {
    padding: 12px;
    border-radius: 16px;
  }

  .switch-group {
    width: auto;
  }

  .switch-btn {
    padding: 8px 12px;
    font-size: 12px;
  }
}

@media (max-width: 360px) {
  .balance-grid,
  .stats-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .panel-title-options {
    min-width: 100%;
  }
}
</style>
