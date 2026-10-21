<template>
  <div class="home-page">
    <div class="page-container">
      <section class="home-banner" aria-labelledby="home-title">
        <div class="banner-content">
          <h1 id="home-title" class="banner-title">🍔 LD士多</h1>
          <p class="banner-subtitle">
            <a href="https://linux.do" target="_blank" rel="noopener noreferrer" class="link-linuxdo">LinuxDo社区</a>
            虚拟物品与服务 <span class="highlight-red">兑换中心</span>
          </p>
          <p class="banner-subtitle">
            快使用你的
            <a href="https://credit.linux.do/" target="_blank" rel="noopener noreferrer" class="highlight-yellow link-credit">社区积分</a>
            兑换物品吧
          </p>
        </div>
        <div ref="bannerStatsEl" class="banner-stats" :class="{ 'stats-split-rows': statsSplitRows }" aria-label="商城概览">
          <div class="stat-item"><span class="stat-value">{{ stats.products?.online || 0 }}</span><span class="stat-label">在售物品</span></div>
          <div class="stat-item"><span class="stat-value">{{ stats.products?.total || 0 }}</span><span class="stat-label">累计上架</span></div>
          <div class="stat-divider" aria-hidden="true"></div>
          <div class="stat-item"><span class="stat-value">{{ stats.orders?.today || 0 }}</span><span class="stat-label">今日成交</span></div>
          <div class="stat-row-divider" aria-hidden="true"></div>
          <div class="stat-item"><span class="stat-value">{{ stats.orders?.week || 0 }}</span><span class="stat-label">7日成交</span></div>
          <div class="stat-item"><span class="stat-value">{{ stats.orders?.total || 0 }}</span><span class="stat-label">累计成交</span></div>
          <div class="stat-divider" aria-hidden="true"></div>
          <div class="stat-item"><span class="stat-value">{{ stats.stores || 0 }}</span><span class="stat-label">入驻小店</span></div>
        </div>
      </section>

      <div class="section-tabs-wrapper">
        <LiquidTabs
          :model-value="activeSection"
          :tabs="sectionTabs"
          mode="tabs"
          aria-label="首页板块"
          @update:model-value="switchSection"
        />
      </div>

      <Suspense>
        <KeepAlive :max="4">
          <component :is="activeSectionComponent" :key="activeSection" />
        </KeepAlive>
        <template #fallback>
          <div class="section-loading-shell" role="status" aria-live="polite">
            <Skeleton type="card" :count="6" :columns="2" />
            <span class="sr-only">正在加载板块</span>
          </div>
        </template>
      </Suspense>
    </div>
  </div>
</template>

<script setup>
import { ChartNoAxesColumnIncreasing, ClipboardPenLine, ShoppingBag, Store } from '@lucide/vue'
import { computed, defineAsyncComponent, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useToast } from '@/composables/useToast'
import { useHomeStats } from '@/composables/home/useHomeStats'
import LiquidTabs from '@/components/common/LiquidTabs.vue'
import Skeleton from '@/components/common/Skeleton.vue'

defineOptions({ name: 'Home' })

const sectionComponents = {
  products: defineAsyncComponent(() => import('@/components/home/ProductsMarketplace.vue')),
  stores: defineAsyncComponent(() => import('@/components/home/StoresMarketplace.vue')),
  buy: defineAsyncComponent(() => import('@/components/home/BuyRequestMarketplace.vue')),
  hotboard: defineAsyncComponent(() => import('@/components/home/HotboardMarketplace.vue'))
}

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const toast = useToast()
const { stats, refreshStats } = useHomeStats()

const bannerStatsEl = ref(null)
const statsSplitRows = ref(true)
let statsRowObserver = null
let statsRowObserverWidth = 0

async function evaluateStatsRowFit() {
  const el = bannerStatsEl.value
  const banner = el?.parentElement
  if (!el || !banner) return
  statsSplitRows.value = false
  await nextTick()
  const bannerStyle = getComputedStyle(banner)
  const available = banner.clientWidth - parseFloat(bannerStyle.paddingLeft) - parseFloat(bannerStyle.paddingRight)
  statsSplitRows.value = el.scrollWidth > available + 1
}

function connectStatsRowObserver() {
  if (typeof window === 'undefined' || !window.ResizeObserver) return
  const banner = bannerStatsEl.value?.parentElement
  if (!banner) return
  statsRowObserver?.disconnect()
  statsRowObserver = new window.ResizeObserver((entries) => {
    const width = entries[0].contentRect.width
    if (Math.abs(width - statsRowObserverWidth) < 1) return
    statsRowObserverWidth = width
    evaluateStatsRowFit()
  })
  statsRowObserver.observe(banner)
}

const sectionScrollPositions = new Map()
let savedRouteScrollPosition = 0

const sectionTabs = computed(() => {
  const tabs = [
    { value: 'products', label: '物品广场', iconComponent: ShoppingBag },
    { value: 'buy', label: '求购广场', iconComponent: ClipboardPenLine },
    { value: 'stores', label: '小店集市', iconComponent: Store }
  ]
  if (userStore.isLoggedIn && (userStore.trustLevel || 0) >= 1) {
    tabs.push({ value: 'hotboard', label: '士多热榜', iconComponent: ChartNoAxesColumnIncreasing })
  }
  return tabs.map((tab) => ({ ...tab, id: `home-tab-${tab.value}`, panelId: `home-panel-${tab.value}` }))
})

function normalizeSection(value) {
  return sectionTabs.value.some((tab) => tab.value === value) ? value : 'products'
}

const activeSection = ref(normalizeSection(String(route.query.section || '').trim()))
const activeSectionComponent = computed(() => sectionComponents[activeSection.value] || sectionComponents.products)

async function activateSection(section, { updateUrl = true, restoreScroll = true } = {}) {
  const normalized = normalizeSection(section)
  const previous = activeSection.value
  if (previous !== normalized) sectionScrollPositions.set(previous, window.scrollY)
  activeSection.value = normalized

  if (updateUrl && String(route.query.section || '').trim() !== normalized) {
    await router.replace({ query: { ...route.query, section: normalized } }).catch(() => {})
  }

  if (restoreScroll && previous !== normalized) {
    await nextTick()
    window.scrollTo(0, sectionScrollPositions.get(normalized) || 0)
  }
}

function switchSection(section) {
  return activateSection(section)
}

watch(
  () => route.query.section,
  (section) => {
    const rawSection = String(section || '').trim()
    const normalized = normalizeSection(rawSection)
    activateSection(normalized, { updateUrl: false })
    if (rawSection && rawSection !== normalized) {
      router.replace({ query: { ...route.query, section: normalized } }).catch(() => {})
    }
  }
)

watch(sectionTabs, (tabs) => {
  if (!tabs.some((tab) => tab.value === activeSection.value)) activateSection('products')
})

onMounted(async () => {
  evaluateStatsRowFit()
  connectStatsRowObserver()
  watch(stats, () => evaluateStatsRowFit())
  const result = await refreshStats()
  if (!result.success) toast.warning(result.error)
  const rawSection = String(route.query.section || '').trim()
  if (rawSection && rawSection !== activeSection.value) {
    await router.replace({ query: { ...route.query, section: activeSection.value } }).catch(() => {})
  }
})

onBeforeUnmount(() => statsRowObserver?.disconnect())

onActivated(async () => {
  if (savedRouteScrollPosition > 0) {
    await nextTick()
    window.scrollTo(0, savedRouteScrollPosition)
  }
})

onDeactivated(() => {
  savedRouteScrollPosition = window.scrollY
  sectionScrollPositions.set(activeSection.value, window.scrollY)
})
</script>

<style scoped>
.home-page { min-height: 100vh; padding-bottom: 80px; }
.home-banner { position: relative; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--section-gap); margin: 12px 0 var(--section-gap); padding: var(--banner-pad); overflow: hidden; border: 1px solid var(--glass-border-light); border-radius: var(--card-radius); background: var(--glass-bg-heavy); box-shadow: 0 8px 32px var(--glass-shadow), 0 2px 8px var(--glass-shadow-light), inset 0 1px 0 var(--glass-shine-strong); }
.home-banner::before { content: ''; position: absolute; inset: 0 0 auto; height: 50%; border-radius: inherit; background: linear-gradient(180deg, var(--glass-shine), var(--palette-rgba-255-255-255-p05) 60%, transparent); pointer-events: none; }
.banner-content, .banner-stats { position: relative; z-index: 1; }.banner-content { flex-shrink: 0; }.banner-title { margin: 0 0 4px; color: var(--text-primary); font-size: var(--text-display); font-weight: 700; }.banner-subtitle { margin: 0; color: var(--text-tertiary); font-size: 14px; }.highlight-yellow { color: var(--color-warning); font-weight: 700; }.highlight-red { color: var(--color-danger); font-weight: 700; }.link-credit, .link-linuxdo { text-decoration: none; }.link-linuxdo { color: var(--text-primary); font-weight: 700; }.link-linuxdo:hover { color: var(--color-primary); }
.banner-stats, .stat-item { display: flex; align-items: center; }.banner-stats { gap: 16px; flex-wrap: wrap; justify-content: flex-end; }.stat-divider { width: 1px; height: 36px; margin: 0 4px; background: var(--border-light); }.stat-row-divider { display: none; }.stat-item { min-width: 50px; flex-direction: column; }.stat-value { color: var(--color-primary); font-size: var(--text-stat); font-weight: 700; line-height: 1.2; }.stat-label { color: var(--text-tertiary); font-size: 11px; white-space: nowrap; }
.section-tabs-wrapper { display: flex; justify-content: center; margin-bottom: var(--section-gap); }.section-loading-shell { min-height: 420px; padding: 20px 0; }.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
@media (max-width: 767px) { .home-banner { flex-direction: column; align-items: stretch; gap: 16px; }.banner-stats { justify-content: center; gap: 12px; padding-top: 16px; border-top: 1px solid var(--border-light); } }
/* ≤639px 保持单行 nowrap 且子项不收缩，脚本用 scrollWidth 溢出判断是否切换 stats-split-rows 两行 */
@media (max-width: 639px) { .banner-stats { flex-wrap: nowrap; gap: 8px; min-width: 0; }.stat-item, .stat-divider { flex-shrink: 0; }.banner-stats.stats-split-rows { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 8px; }.stats-split-rows .stat-divider { display: none; }.stats-split-rows .stat-row-divider { display: block; grid-column: 1 / -1; height: 1px; background: var(--border-light); } }
@media (prefers-reduced-motion: reduce) { .link-credit, .link-linuxdo { transition: none; } }
</style>
