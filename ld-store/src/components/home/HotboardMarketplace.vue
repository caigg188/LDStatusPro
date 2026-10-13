<template>
  <section id="home-panel-hotboard" class="section-content" role="tabpanel" aria-labelledby="home-tab-hotboard" tabindex="0">
    <div v-if="loading && !data" class="products-loading"><Skeleton type="card" :count="4" :columns="2" /></div>
    <div v-else-if="error && !data" class="hotboard-error"><EmptyState icon="📊" :text="error" hint="请稍后重试" /></div>

    <div v-else-if="data" class="hotboard-container">
      <div class="hotboard-hero">
        <div class="hotboard-hero-head">
          <div class="hotboard-hero-title"><span aria-hidden="true">📊</span><span>士多热榜</span></div>
          <span class="hotboard-hero-tl">TL{{ data.trustLevel }}</span>
        </div>
        <div class="hotboard-hero-stats">
          <div class="hotboard-hero-stat"><span class="hotboard-hero-stat-value">{{ formatNumber(Number(data.totalStats?.totalViews || 0)) }}</span><span class="hotboard-hero-stat-label">今日物品总浏览</span></div>
          <div class="hotboard-hero-stat-divider"></div>
          <div class="hotboard-hero-stat"><span class="hotboard-hero-stat-value">{{ formatNumber(Number(data.totalStats?.totalOrders || 0)) }}</span><span class="hotboard-hero-stat-label">今日总单数</span></div>
          <div class="hotboard-hero-stat-divider"></div>
          <div class="hotboard-hero-stat"><span class="hotboard-hero-stat-value">{{ formatNumber(Number(data.totalStats?.totalSoldQuantity ?? data.totalStats?.totalSold ?? 0)) }}</span><span class="hotboard-hero-stat-label">今日售出件数</span></div>
        </div>
        <p class="hotboard-hero-hint">{{ loading ? '正在更新热榜…' : (error || '数据基于北京时间今日 · 页面停留时约2分钟刷新') }}</p>
      </div>

      <div v-if="data.sellerTop?.length" class="hotboard-section">
        <h3 class="hotboard-section-title">🔥 今日热卖卖家</h3>
        <div class="hotboard-seller-list">
          <router-link v-for="seller in data.sellerTop" :key="`${seller.site}:${seller.userId || seller.username}`" :to="merchantProfilePath(seller)" class="hotboard-seller-item" :class="`seller-rank-${seller.rank}`">
            <span class="hotboard-seller-medal" aria-hidden="true">{{ seller.rank === 1 ? '🥇' : (seller.rank === 2 ? '🥈' : '🥉') }}</span>
            <AvatarImage :candidates="[seller.avatar]" :seed="seller.username" :size="44" :alt="seller.username" class="hotboard-seller-avatar" />
            <span class="hotboard-seller-name">{{ seller.username }}</span>
          </router-link>
        </div>
      </div>

      <div v-if="data.viewTop?.length" class="hotboard-section">
        <h3 class="hotboard-section-title">👀 今日浏览榜</h3>
        <div class="hotboard-product-list">
          <HotboardProductRow v-for="item in data.viewTop" :key="item.id" :item="item" metric="views" />
        </div>
      </div>

      <div v-if="data.soldTop?.length" class="hotboard-section">
        <h3 class="hotboard-section-title">🛍️ 今日热卖榜</h3>
        <div class="hotboard-product-list">
          <HotboardProductRow v-for="item in data.soldTop" :key="item.id" :item="item" metric="sales" />
        </div>
      </div>

      <div v-if="trendChartModel.length" class="hotboard-section">
        <h3 class="hotboard-section-title">📈 分类成交分布</h3>
        <div class="hotboard-cat-bars">
          <div v-for="cat in trendChartModel" :key="cat.categoryId" class="hotboard-cat-row">
            <span class="hotboard-cat-label">{{ cat.categoryIcon }} {{ cat.categoryName }}</span>
            <div class="hotboard-cat-bar-track"><div class="hotboard-cat-bar-fill" :style="{ width: getCatBarWidth(cat) + '%', background: cat.color }"></div></div>
            <span class="hotboard-cat-value">{{ formatTrendShare(cat) }}</span>
          </div>
        </div>

        <div v-if="hourlyTrendPoints.length" class="hotboard-hourly-section">
          <div class="hotboard-hourly-heading">
            <div><p class="hotboard-hourly-title">逐时订单走势</p><p class="hotboard-hourly-subtitle">北京时间 · 每小时相对趋势</p></div>
            <span class="hotboard-hourly-meta"><span class="hotboard-hourly-live-dot" aria-hidden="true"></span>更新至 {{ trendEndHourLabel }}</span>
          </div>
          <div class="hotboard-trend-plot">
            <div class="hotboard-trend-chart-wrap">
              <svg
                class="hotboard-trend-chart"
                viewBox="0 0 960 320"
                preserveAspectRatio="none"
                role="img"
                :aria-label="trendChartAriaLabel"
                @pointermove="updateTrendHover"
                @pointerleave="hoveredTrendHour = null"
              >
                <title>{{ trendChartAriaLabel }}</title>
                <defs>
                  <linearGradient id="hotboard-trend-stroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="var(--palette-hex-6ca7a3)"/><stop offset="48%" stop-color="var(--palette-hex-6f98bd)"/><stop offset="100%" stop-color="var(--palette-hex-8f82c4)"/></linearGradient>
                  <linearGradient id="hotboard-trend-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--palette-hex-719cb9)" stop-opacity=".2"/><stop offset="100%" stop-color="var(--palette-hex-719cb9)" stop-opacity="0"/></linearGradient>
                </defs>
                <rect x="0" y="0" width="960" height="320" fill="transparent" class="hotboard-trend-hit-area" />
                <rect :x="trendProgressX" y="0" :width="Math.max(0, TVB_W - trendProgressX)" height="320" class="hotboard-trend-future" />
                <line v-for="y in trendGridY" :key="`grid-y-${y}`" x1="0" :y1="y" x2="960" :y2="y" class="hotboard-trend-grid-line" vector-effect="non-scaling-stroke" />
                <line v-for="hour in trendGridHours" :key="`grid-x-${hour}`" :x1="trendTimeX(hour)" y1="0" :x2="trendTimeX(hour)" y2="320" class="hotboard-trend-grid-line vertical" vector-effect="non-scaling-stroke" />
                <path v-if="hourlyTrendAreaPath" :d="hourlyTrendAreaPath" fill="url(#hotboard-trend-area)" class="hotboard-trend-area" />
                <path v-if="hourlyTrendPath" :d="hourlyTrendPath" fill="none" stroke="url(#hotboard-trend-stroke)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" class="hotboard-trend-path" />
                <line v-if="hoveredTrendHour !== null" :x1="trendX(hoveredTrendHour)" y1="0" :x2="trendX(hoveredTrendHour)" y2="320" class="hotboard-trend-hover-line" vector-effect="non-scaling-stroke" />
              </svg>
              <div v-if="trendHoverSummary" class="hotboard-trend-tooltip" :style="trendHoverTooltipStyle" aria-hidden="true"><strong>{{ trendHoverSummary.label }}</strong><span>整体相对走势</span></div>
              <div class="hotboard-trend-axis" aria-hidden="true"><span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <EmptyState v-else icon="📊" text="暂无热榜数据" hint="今日还没有足够的浏览和成交数据" />
  </section>
</template>

<script setup>
import { merchantProfilePath } from '@/utils/merchantIdentity'
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue'
import { fetchMarketplaceHotboard } from '@/services/homeMarketplaceService'
import { formatNumber } from '@/utils/format'
import Skeleton from '@/components/common/Skeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import AvatarImage from '@/components/common/AvatarImage.vue'
import HotboardProductRow from './HotboardProductRow.vue'

defineOptions({ name: 'HotboardMarketplace' })

const CACHE_TTL = 2 * 60 * 1000
const TREND_COLORS = ['var(--palette-hex-b5a898)', 'var(--palette-hex-7eb89a)', 'var(--palette-hex-e8a860)', 'var(--palette-hex-778d9c)', 'var(--palette-hex-c98b8b)', 'var(--palette-hex-8ba5c9)', 'var(--palette-hex-b8a0d0)', 'var(--palette-hex-6ca7a3)']
const data = ref(null)
const loading = ref(false)
const error = ref('')
const cacheTime = ref(0)
const hoveredTrendHour = ref(null)
let refreshTimer = null
let activeRequest = null
let requestId = 0
let isActive = false

async function loadHotboard(force = false) {
  if (!force && data.value && Date.now() - cacheTime.value < CACHE_TTL) return
  if (loading.value) return
  activeRequest?.abort()
  activeRequest = new AbortController()
  const currentRequestId = ++requestId
  loading.value = true
  if (!data.value) error.value = ''
  try {
    const result = await fetchMarketplaceHotboard({ signal: activeRequest.signal })
    if (currentRequestId !== requestId || result.aborted) return
    if (result.success && result.data) {
      data.value = result.data
      cacheTime.value = Date.now()
      error.value = ''
    } else {
      error.value = result.error?.message || result.error || '加载热榜失败'
    }
  } catch (requestError) {
    if (currentRequestId === requestId) {
      error.value = data.value ? '热榜更新失败，当前显示上次数据' : '加载热榜失败，请稍后重试'
      console.error('Load hotboard failed:', requestError)
    }
  } finally {
    if (currentRequestId === requestId) loading.value = false
  }
}

function stopRefresh() {
  if (refreshTimer) window.clearInterval(refreshTimer)
  refreshTimer = null
}

function startRefresh() {
  stopRefresh()
  if (!isActive || document.visibilityState !== 'visible') return
  refreshTimer = window.setInterval(() => loadHotboard(true), CACHE_TTL)
}

function handleVisibilityChange() {
  if (!isActive) return
  if (document.visibilityState === 'visible') {
    loadHotboard()
    startRefresh()
  } else {
    stopRefresh()
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  loadHotboard()
})

onActivated(() => {
  isActive = true
  loadHotboard()
  startRefresh()
})

onDeactivated(() => {
  isActive = false
  requestId++
  activeRequest?.abort()
  stopRefresh()
})

onUnmounted(() => {
  activeRequest?.abort()
  stopRefresh()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

const TVB_W = 960
const TVB_H = 320
const TVB_PAD_Y = 18
const TVB_PLOT_H = TVB_H - TVB_PAD_Y * 2
const trendGridY = [TVB_PAD_Y, TVB_H / 2, TVB_H - TVB_PAD_Y]
const trendGridHours = [0, 6, 12, 18, 24]
const TREND_VALUE_MAX = 100
const shareFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 })
const safeArray = (value) => Array.isArray(value) ? value : []
const rawTrendCategories = computed(() => safeArray(data.value?.categoryTrend))
const rawHourlyTrend = computed(() => safeArray(data.value?.hourlyTrend))
const trendHours = computed(() => {
  const endHour = Number(data.value?.trendEndHour)
  const lastHour = Number.isFinite(endHour) ? Math.min(23, Math.max(0, Math.floor(endHour))) : 23
  return Array.from({ length: lastHour + 1 }, (_, hour) => hour)
})
const trendChartModel = computed(() => rawTrendCategories.value.map((cat, index) => ({
  ...cat,
  color: TREND_COLORS[index % TREND_COLORS.length],
  orderShareBps: Math.min(10000, Math.max(0, Number(cat.orderShareBps) || 0))
})).sort((a, b) => b.orderShareBps - a.orderShareBps))
const hourlyTrendPoints = computed(() => {
  const byHour = new Map(rawHourlyTrend.value.map((point) => [Number(point?.hour), point]))
  return rawHourlyTrend.value.length ? trendHours.value.map((hour) => ({ hour, trendValue: Math.min(100, Math.max(0, Number(byHour.get(hour)?.trendValue) || 0)) })) : []
})
const hourlyTrendPath = computed(() => trendCurve(hourlyTrendPoints.value))
const hourlyTrendAreaPath = computed(() => {
  const points = hourlyTrendPoints.value
  if (!points.length || !hourlyTrendPath.value) return ''
  return `${hourlyTrendPath.value} L ${trendX(points.at(-1).hour)} ${TVB_H - TVB_PAD_Y} L ${trendX(points[0].hour)} ${TVB_H - TVB_PAD_Y} Z`
})
const trendEndHourLabel = computed(() => {
  const current = data.value?.currentBeijingTime
  if (current && Number.isFinite(Number(current.hour))) return `${String(Number(current.hour)).padStart(2, '0')}:${String(Number(current.minute) || 0).padStart(2, '0')}`
  return `${String((trendHours.value.at(-1) || 0) + 1).padStart(2, '0')}:00`
})
const trendChartAriaLabel = computed(() => `北京时间逐时订单整体走势，显示至 ${trendEndHourLabel.value}。图表使用平滑归一化相对趋势，不包含分时订单数。`)
const trendProgressX = computed(() => {
  const hour = Number(data.value?.trendEndHour)
  return Number.isFinite(hour) ? Math.min(TVB_W, Math.max(0, hour / 24 * TVB_W)) : TVB_W
})
const trendHoverSummary = computed(() => hoveredTrendHour.value === null ? null : ({ label: `${String(hoveredTrendHour.value).padStart(2, '0')}:00–${String(hoveredTrendHour.value + 1).padStart(2, '0')}:00` }))
const trendHoverTooltipStyle = computed(() => ({ left: `${Math.min(88, Math.max(12, ((hoveredTrendHour.value || 0) + .5) / 24 * 100))}%` }))

function getCatBarWidth(cat) { return cat.orderShareBps / 100 }
function formatTrendShare(cat) { return `${shareFormatter.format(getCatBarWidth(cat))}%` }
function trendX(hour) { return (hour + .5) / 24 * TVB_W }
function trendTimeX(hour) { return hour / 24 * TVB_W }
function trendY(value) { return TVB_PAD_Y + TVB_PLOT_H - Math.max(0, Number(value) || 0) / TREND_VALUE_MAX * TVB_PLOT_H }

function trendCurve(points) {
  if (!points.length) return ''
  const coordinates = points.map((point) => ({ x: trendX(point.hour), y: trendY(point.trendValue) }))
  if (coordinates.length === 1) return `M ${coordinates[0].x} ${coordinates[0].y}`
  const slopes = coordinates.slice(0, -1).map((point, index) => (coordinates[index + 1].y - point.y) / (coordinates[index + 1].x - point.x))
  const tangents = coordinates.map((_, index) => {
    if (index === 0) return slopes[0]
    if (index === coordinates.length - 1) return slopes.at(-1)
    const previous = slopes[index - 1]
    const next = slopes[index]
    return previous === 0 || next === 0 || previous * next < 0 ? 0 : (2 * previous * next) / (previous + next)
  })
  const precise = (value) => Number(value.toFixed(2))
  let path = `M ${precise(coordinates[0].x)} ${precise(coordinates[0].y)}`
  for (let index = 0; index < coordinates.length - 1; index++) {
    const current = coordinates[index]
    const next = coordinates[index + 1]
    const distance = next.x - current.x
    const minY = Math.min(current.y, next.y)
    const maxY = Math.max(current.y, next.y)
    const clampY = (value) => Math.min(maxY, Math.max(minY, value))
    path += ` C ${precise(current.x + distance / 3)} ${precise(clampY(current.y + tangents[index] * distance / 3))}, ${precise(next.x - distance / 3)} ${precise(clampY(next.y - tangents[index + 1] * distance / 3))}, ${precise(next.x)} ${precise(next.y)}`
  }
  return path
}

function updateTrendHover(event) {
  const bounds = event.currentTarget.getBoundingClientRect()
  if (!bounds.width) return
  const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
  hoveredTrendHour.value = Math.min(trendHours.value.at(-1) || 0, Math.max(0, Math.round(ratio * 24 - .5)))
}
</script>

<style scoped>
.section-content, .products-loading { min-height: 420px; }.section-content { animation: fade-in .3s ease; }.products-loading { padding: 20px 0; }
.hotboard-container { display: flex; flex-direction: column; gap: 16px; }
.hotboard-hero, .hotboard-section { position: relative; background: var(--glass-bg-heavy); border: 1px solid var(--glass-border-light); box-shadow: var(--shadow-sm); overflow: hidden; }
.hotboard-hero { border-radius: var(--card-radius); padding: var(--banner-pad); }.hotboard-section { border-radius: var(--card-radius); padding: var(--card-pad) 18px; }
.hotboard-hero::before, .hotboard-section::before { content: ''; position: absolute; inset: 0 0 auto; height: 45%; background: linear-gradient(180deg, var(--glass-shine), transparent); pointer-events: none; }
.hotboard-hero-head, .hotboard-hero-stats, .hotboard-seller-list, .hotboard-seller-item, .hotboard-product-item, .hotboard-cat-row, .hotboard-hourly-heading, .hotboard-hourly-meta { display: flex; align-items: center; position: relative; z-index: 1; }
.hotboard-hero-head, .hotboard-hourly-heading { justify-content: space-between; }.hotboard-hero-title { display: flex; gap: 8px; font-size: var(--text-subtitle); font-weight: 700; }.hotboard-hero-tl { padding: 3px 10px; border-radius: 20px; background: var(--color-primary-bg); color: var(--color-primary); font-size: 11px; font-weight: 600; }
.hotboard-hero-stats { margin-top: 20px; }.hotboard-hero-stat { flex: 1; min-width: 60px; display: flex; flex-direction: column; align-items: center; }.hotboard-hero-stat-divider { width: 1px; height: 32px; background: var(--border-light); }.hotboard-hero-stat-value { font-size: var(--text-stat); font-weight: 700; color: var(--color-primary); }.hotboard-hero-stat-label, .hotboard-hero-hint, .hotboard-hourly-subtitle { font-size: 11px; color: var(--text-tertiary); }.hotboard-hero-hint { margin: 14px 0 0; position: relative; z-index: 1; }
.hotboard-section-title { margin: 0 0 14px; font-size: 15px; position: relative; z-index: 1; }.hotboard-seller-list { gap: 10px; flex-wrap: wrap; }.hotboard-seller-item { flex: 1; min-width: 150px; gap: 12px; padding: 14px 20px; border: 1px solid var(--glass-border-light); border-radius: 14px; background: var(--glass-bg-medium); color: inherit; text-decoration: none; transition: transform .2s ease; }.hotboard-seller-item:hover { transform: translateY(-3px); box-shadow: 0 6px 20px var(--glass-shadow); }.hotboard-seller-medal { width: 28px; font-size: 22px; }.hotboard-seller-avatar { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; }.hotboard-seller-name { overflow: hidden; text-overflow: ellipsis; font-size: 15px; font-weight: 600; }
.hotboard-product-list, .hotboard-cat-bars { display: flex; flex-direction: column; gap: 8px; position: relative; z-index: 1; }
.hotboard-cat-row { gap: 10px; }.hotboard-cat-label { min-width: 70px; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }.hotboard-cat-bar-track { flex: 1; height: 20px; background: var(--bg-tertiary); border-radius: 10px; overflow: hidden; }.hotboard-cat-bar-fill { min-width: 4px; height: 100%; border-radius: 10px; opacity: .75; }.hotboard-cat-value { min-width: 58px; text-align: right; font-size: 12px; color: var(--text-secondary); }
.hotboard-hourly-section { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--border-light); }.hotboard-hourly-title { margin: 0; font-size: 15px; }.hotboard-hourly-subtitle { margin: 3px 0 0; }.hotboard-hourly-meta { min-height: 28px; gap: 6px; padding: 5px 10px; border: 1px solid var(--border-light); border-radius: 999px; background: var(--bg-secondary); color: var(--text-tertiary); font-size: 11px; }.hotboard-hourly-live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-success); }
.hotboard-trend-plot { --chart-height: 216px; margin-top: 14px; padding: 14px 16px 8px; border: 1px solid var(--border-light); border-radius: 14px; background: var(--bg-secondary); overflow: hidden; }.hotboard-trend-chart-wrap { position: relative; }.hotboard-trend-chart { display: block; width: 100%; height: var(--chart-height); touch-action: pan-y; }.hotboard-trend-future { fill: var(--bg-tertiary); opacity: .36; }.hotboard-trend-hit-area { pointer-events: all; }.hotboard-trend-grid-line { stroke: var(--border-light); stroke-width: 1; opacity: .72; }.hotboard-trend-grid-line.vertical { opacity: .36; stroke-dasharray: 2 5; }.hotboard-trend-path { pointer-events: none; }.hotboard-trend-area { pointer-events: none; }.hotboard-trend-hover-line { stroke: var(--text-tertiary); stroke-width: 1; stroke-dasharray: 3 4; pointer-events: none; }.hotboard-trend-tooltip { position: absolute; top: 10px; transform: translateX(-50%); display: flex; flex-direction: column; min-width: 132px; padding: 8px 10px; border: 1px solid var(--border-light); border-radius: 9px; background: var(--bg-primary); box-shadow: var(--shadow-sm); pointer-events: none; }.hotboard-trend-tooltip span, .hotboard-trend-axis { color: var(--text-tertiary); font-size: 10px; }.hotboard-trend-axis { display: flex; justify-content: space-between; margin-top: 6px; }.hotboard-error { padding: 20px; }
a:focus-visible, section:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
@media (max-width: 639px) { .hotboard-hero { padding: 18px 16px 16px; }.hotboard-section { padding: 14px 16px; }.hotboard-seller-list { flex-direction: column; }.hotboard-seller-item { width: 100%; min-width: 0; }.hotboard-hourly-heading { align-items: flex-start; flex-direction: column; gap: 8px; }.hotboard-trend-plot { --chart-height: 188px; padding: 12px 10px 7px; } }
@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .section-content { animation: none; }.hotboard-seller-item { transition: none; }.hotboard-seller-item:hover { transform: none; } }
</style>
