<template>
  <div class="seller-dashboard">
    <div v-if="loading" class="dashboard-loading" aria-live="polite" aria-label="正在加载经营概览">
      <div class="skeleton brief-skeleton"></div>
      <div class="skeleton-row">
        <div v-for="index in 4" :key="index" class="skeleton kpi-skeleton"></div>
      </div>
      <div class="skeleton chart-skeleton"></div>
    </div>

    <section v-else-if="errorMessage" class="dashboard-error" role="alert">
      <AlertCircle :size="28" aria-hidden="true" />
      <h2>经营数据暂时无法加载</h2>
      <p>{{ errorMessage }}</p>
      <button type="button" @click="loadDashboard">
        <RefreshCw :size="16" aria-hidden="true" />
        重新加载
      </button>
    </section>

    <template v-else-if="dashboard">
      <section class="command-bar" aria-labelledby="command-bar-title">
        <div>
          <p>{{ todayLabel }} · 数据截至 {{ generatedTime }}</p>
          <h2 id="command-bar-title">{{ brief.eyebrow }}</h2>
          <span>{{ brief.summary }} · {{ brief.action }}</span>
        </div>
        <SellerButton variant="primary" to="/seller/products/new">
          <Plus :size="17" aria-hidden="true" />
          发布物品
        </SellerButton>
      </section>

      <section class="backlog-grid" aria-label="待处理积压">
        <router-link v-for="item in backlogCards" :key="item.key" :to="item.href" class="backlog-card" :class="item.tone">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ item.hint }}</small>
        </router-link>
      </section>

      <section v-if="isNewSeller" class="opening-checklist" aria-labelledby="opening-title">
        <div class="section-heading opening-heading">
          <div>
            <p>从零开始</p>
            <h2 id="opening-title">开张清单</h2>
          </div>
          <span>{{ completedOpeningSteps }}/4 已完成</span>
        </div>
        <ol>
          <li v-for="step in openingSteps" :key="step.label" :class="{ completed: step.completed }">
            <CircleCheck v-if="step.completed" :size="20" aria-hidden="true" />
            <span v-else class="step-number">{{ step.number }}</span>
            <div>
              <strong>{{ step.label }}</strong>
              <small>{{ step.description }}</small>
            </div>
            <router-link v-if="!step.completed" :to="step.href">去完成 <ChevronRight :size="15" aria-hidden="true" /></router-link>
            <span v-else class="completed-copy">已完成</span>
          </li>
        </ol>
      </section>

      <div class="dashboard-toolbar" aria-label="数据周期">
        <div>
          <p>经营数据</p>
          <span>{{ periodLabel }}，与紧邻的等长上期对比</span>
        </div>
        <SellerTabs class="range-switch" :model-value="selectedRange" :tabs="rangeOptions" :disabled="rangeLoading" size="sm" layout="equal" aria-label="选择统计范围" @update:model-value="changeRange" />
      </div>

      <section class="kpi-grid" aria-label="经营核心指标" :aria-busy="rangeLoading">
        <article v-for="item in kpiCards" :key="item.key" class="kpi-card">
          <div class="kpi-head">
            <span>{{ item.label }}</span>
            <component :is="item.icon" :size="19" :stroke-width="1.7" aria-hidden="true" />
          </div>
          <strong :class="{ 'is-compact': String(item.value).length > 6 }">
            <span class="kpi-value">{{ item.value }}</span>
            <small>{{ item.unit }}</small>
          </strong>
          <div class="kpi-compare" :class="item.direction">
            <TrendingUp v-if="item.direction === 'up'" :size="14" aria-hidden="true" />
            <TrendingDown v-else-if="item.direction === 'down'" :size="14" aria-hidden="true" />
            <Minus v-else :size="14" aria-hidden="true" />
            <span>{{ item.changeCopy }}</span>
          </div>
        </article>
      </section>

      <div class="dashboard-primary-grid">
        <section class="dashboard-card trend-card" aria-labelledby="trend-title">
          <div class="section-heading card-heading">
            <div>
              <p>变化</p>
              <h2 id="trend-title">经营趋势</h2>
            </div>
            <SellerTabs v-model="chartView" class="chart-view-switch" :tabs="chartViews" size="sm" aria-label="趋势图指标" />
          </div>
          <div ref="chartLoadTarget" class="seller-chart-load-boundary">
            <Suspense v-if="shouldLoadChart">
              <SellerTrendChart :trend="dashboard.trend" :view="chartView" />
              <template #fallback>
                <div class="seller-chart-async-placeholder skeleton" role="status">
                  <span class="sr-only">趋势图加载中</span>
                </div>
              </template>
            </Suspense>
            <div v-else class="seller-chart-async-placeholder skeleton" role="status">
              <span class="sr-only">趋势图将在接近视口时加载</span>
            </div>
          </div>
          <div v-if="chartView !== 'views'" class="source-summary">
            <div>
              <span>商品销售</span>
              <strong>{{ chartView === 'revenue' ? formatNumber(dashboard.sourceBreakdown.product.revenue) + ' LDC' : dashboard.sourceBreakdown.product.orders + ' 笔' }}</strong>
            </div>
            <div>
              <span>求购服务</span>
              <strong>{{ chartView === 'revenue' ? formatNumber(dashboard.sourceBreakdown.service.revenue) + ' LDC' : dashboard.sourceBreakdown.service.orders + ' 笔' }}</strong>
            </div>
          </div>
          <details class="chart-data-details">
            <summary>
              <span class="chart-data-summary-copy">
                <strong>趋势数据表</strong>
                <small>按日期查看{{ currentChartLabel }}明细</small>
              </span>
              <ChevronDown :size="18" aria-hidden="true" />
            </summary>
            <div class="chart-data-table-wrap">
              <table>
                <caption class="sr-only">{{ currentChartLabel }}逐日数据</caption>
                <thead>
                  <tr>
                    <th scope="col">日期</th>
                    <template v-if="chartView === 'revenue'">
                      <th scope="col">商品销售</th><th scope="col">求购服务</th><th scope="col">合计</th>
                    </template>
                    <template v-else-if="chartView === 'orders'">
                      <th scope="col">商品订单</th><th scope="col">求购服务</th><th scope="col">合计</th>
                    </template>
                    <th v-else scope="col">物品浏览</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in trendTableRows" :key="row.date">
                    <td>{{ row.date }}</td>
                    <template v-if="chartView === 'revenue'">
                      <td>{{ formatNumber(row.productRevenue) }}</td><td>{{ formatNumber(row.serviceRevenue) }}</td><td>{{ formatNumber(row.totalRevenue) }}</td>
                    </template>
                    <template v-else-if="chartView === 'orders'">
                      <td>{{ row.productOrders }}</td><td>{{ row.serviceOrders }}</td><td>{{ row.totalOrders }}</td>
                    </template>
                    <td v-else>{{ row.productViews }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <section class="dashboard-card tasks-card" aria-labelledby="tasks-title">
          <div class="section-heading card-heading">
            <div>
              <p>今日先做</p>
              <h2 id="tasks-title">经营待办</h2>
            </div>
            <span class="section-count">{{ sortedTasks.length }}</span>
          </div>
          <div v-if="sortedTasks.length" class="task-list">
            <router-link v-for="task in sortedTasks" :key="task.type" :to="task.href" class="task-item">
              <span class="task-priority" :class="task.priority">{{ getTaskPriorityLabel(task.priority) }}</span>
              <div>
                <strong>{{ task.title }} <em v-if="task.count">{{ task.count }}</em></strong>
                <small>{{ task.description }}</small>
              </div>
              <ChevronRight :size="17" aria-hidden="true" />
            </router-link>
          </div>
          <div v-else class="compact-empty">
            <CircleCheck :size="25" aria-hidden="true" />
            <strong>暂时没有待办</strong>
            <span>收款、库存、审核与消息状态均无异常。</span>
          </div>
        </section>
      </div>

      <div class="dashboard-secondary-grid">
        <section class="dashboard-card products-card" aria-labelledby="products-title">
          <div class="section-heading card-heading">
            <div>
              <p>期间收入排序</p>
              <h2 id="products-title">商品表现</h2>
            </div>
            <router-link to="/seller/products">全部物品 <ArrowUpRight :size="15" aria-hidden="true" /></router-link>
          </div>
          <div v-if="dashboard.topProducts.length" class="product-performance-list">
            <router-link v-for="(product, index) in dashboard.topProducts" :key="product.id" :to="product.href" class="performance-row">
              <span class="rank">{{ String(index + 1).padStart(2, '0') }}</span>
              <div class="performance-name">
                <strong>{{ product.name }}</strong>
                <span>库存 {{ product.stock }} · 浏览 {{ product.views }}</span>
              </div>
              <div class="performance-metric"><span>售出</span><strong>{{ product.soldQuantity }}</strong></div>
              <div class="performance-metric"><span>订单</span><strong>{{ product.orders }}</strong></div>
              <div class="performance-revenue"><span>收入</span><strong>{{ formatNumber(product.revenue) }} LDC</strong></div>
              <ChevronRight :size="17" aria-hidden="true" />
            </router-link>
          </div>
          <div v-else class="compact-empty wide">
            <PackageOpen :size="26" aria-hidden="true" />
            <strong>本期还没有成交商品</strong>
            <span>商品产生收入后会按表现展示前五名。</span>
          </div>
        </section>

        <section class="dashboard-card status-card" aria-labelledby="status-title">
          <div class="section-heading card-heading">
            <div><p>基础配置</p><h2 id="status-title">经营状态</h2></div>
          </div>
          <div class="business-status-list">
            <router-link v-for="item in businessStatusItems" :key="item.label" :to="item.href" class="business-status-item">
              <span class="status-icon"><component :is="item.icon" :size="18" aria-hidden="true" /></span>
              <div><strong>{{ item.label }}</strong><small>{{ item.description }}</small></div>
              <span class="status-value" :class="item.tone">{{ item.value }}</span>
            </router-link>
          </div>
        </section>
      </div>

      <section class="dashboard-card recent-card" aria-labelledby="recent-title">
        <div class="section-heading card-heading">
          <div><p>商品销售与求购服务</p><h2 id="recent-title">最近成交</h2></div>
          <router-link to="/seller/orders">订单管理 <ArrowUpRight :size="15" aria-hidden="true" /></router-link>
        </div>
        <div v-if="dashboard.recentOrders.length" class="recent-table-wrap">
          <table class="recent-table">
            <thead><tr><th scope="col">来源</th><th scope="col">订单</th><th scope="col">交易对象</th><th scope="col">时间</th><th scope="col">状态</th><th scope="col">实收</th><th scope="col"><span class="sr-only">操作</span></th></tr></thead>
            <tbody>
              <tr v-for="order in dashboard.recentOrders" :key="`${order.source}-${order.orderNo}`">
                <td><span class="source-chip" :class="order.source">{{ order.source === 'service' ? '求购服务' : '商品销售' }}</span></td>
                <td><strong>{{ order.title }}</strong><small>{{ order.orderNo }}</small></td>
                <td>{{ order.counterparty }}</td>
                <td>{{ formatDateTime(order.occurredAt) }}</td>
                <td>{{ getOrderStatus(order.status) }}</td>
                <td class="amount-cell">{{ formatNumber(order.amount) }} LDC</td>
                <td><router-link :to="order.href" :aria-label="`查看订单 ${order.orderNo}`"><ChevronRight :size="18" aria-hidden="true" /></router-link></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="compact-empty wide">
          <ClipboardList :size="26" aria-hidden="true" />
          <strong>暂无最近成交</strong>
          <span>完成商品销售或作为服务方完成求购后，订单会统一出现在这里。</span>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  AlertCircle, ArrowUpRight, ChevronDown, ChevronRight, CircleCheck, ClipboardList,
  CreditCard, Eye, Minus, PackageCheck, PackageOpen, Plus, RefreshCw, ShoppingBag,
  ShieldCheck, Sparkles, Store, TicketPercent, TrendingDown, TrendingUp, UsersRound, WalletCards
} from '@lucide/vue'
import { fetchMerchantDashboard } from '@/services/merchantDashboard'
import { useSellerFulfillmentStore } from '@/stores/sellerFulfillment'
import SellerButton from '@/components/seller/SellerButton.vue'
import SellerTabs from '@/components/seller/SellerTabs.vue'
import {
  buildMerchantBrief,
  formatChangeRate,
  formatDashboardNumber,
  getTaskPriorityLabel,
  sortMerchantTasks,
  sortTrendRowsNewestFirst
} from '@/utils/merchantDashboard'
import { normalizeTimestampMs } from '@/utils/format'

const SellerTrendChart = defineAsyncComponent(() => import('@/components/seller/SellerTrendChart.vue'))
const fulfillmentStore = useSellerFulfillmentStore()

const loading = ref(true)
const rangeLoading = ref(false)
const errorMessage = ref('')
const dashboard = ref(null)
const selectedRange = ref('30d')
const chartView = ref('revenue')
const chartLoadTarget = ref(null)
const shouldLoadChart = ref(false)
let requestSequence = 0
let chartObserver = null

const rangeOptions = [
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
  { value: '90d', label: '近 90 天' }
]
const chartViews = [
  { value: 'revenue', label: '收入' },
  { value: 'orders', label: '订单' },
  { value: 'views', label: '浏览' }
]

const brief = computed(() => buildMerchantBrief(dashboard.value))
const sortedTasks = computed(() => sortMerchantTasks(dashboard.value?.tasks || []))
const trendTableRows = computed(() => sortTrendRowsNewestFirst(dashboard.value?.trend || []))
const isNewSeller = computed(() => Number(dashboard.value?.lifetime?.orders || 0) === 0 && Number(dashboard.value?.businessStatus?.products?.approved || 0) === 0)
const todayLabel = computed(() => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date()))
const generatedTime = computed(() => formatTime(dashboard.value?.period?.generatedAt))
const periodLabel = computed(() => {
  const current = dashboard.value?.period?.current
  if (!current) return ''
  return `${formatShortDate(current.startAt)}—${formatShortDate(current.endAt)}`
})
const currentChartLabel = computed(() => chartViews.find(item => item.value === chartView.value)?.label || '经营')

const openingSteps = computed(() => {
  const status = dashboard.value?.businessStatus || {}
  return [
    { number: 1, label: '配置收款', description: '填写并验证 LDC 收款信息', completed: Boolean(status.merchant?.configured && status.merchant?.verified), href: '/seller/payment' },
    { number: 2, label: '发布物品', description: '提交第一件可以售卖的物品', completed: Number(status.products?.total || 0) > 0, href: '/seller/products/new' },
    { number: 3, label: '等待审核', description: '审核通过后物品会进入广场', completed: Number(status.products?.approved || 0) > 0, href: '/seller/products' },
    { number: 4, label: '开始推广', description: '完善小店并按需使用商家服务', completed: Number(status.services?.activeCount || 0) > 0 || Boolean(status.shop?.configured), href: '/seller/services' }
  ]
})
const completedOpeningSteps = computed(() => openingSteps.value.filter(step => step.completed).length)

const backlogCards = computed(() => {
  const tasks = dashboard.value?.tasks || []
  const countOf = (...types) => tasks.filter(task => types.includes(task.type)).reduce((sum, task) => sum + Number(task.count || 0), 0)
  const hrefOf = (type, fallback) => tasks.find(task => task.type === type)?.href || fallback
  const delivery = countOf('pending_delivery')
  const refunds = countOf('refund_action_required')
  const stock = countOf('out_of_stock', 'low_stock')
  const review = countOf('pending_review', 'rejected_products')
  return [
    { key: 'delivery', label: '待发货', value: delivery, hint: delivery ? '优先履约' : '暂无积压', href: hrefOf('pending_delivery', '/seller/orders?source=product&status=paid'), tone: delivery ? 'warn' : 'ok' },
    { key: 'refunds', label: '待退款', value: refunds, hint: refunds ? '需在时限内决定' : '暂无待办', href: hrefOf('refund_action_required', '/seller/refunds?status=action_required'), tone: refunds ? 'danger' : 'ok' },
    { key: 'stock', label: '库存预警', value: stock, hint: stock ? '售罄或偏低' : '库存正常', href: hrefOf('out_of_stock', hrefOf('low_stock', '/seller/products?stock=low')), tone: stock ? 'warn' : 'ok' },
    { key: 'review', label: '审核中', value: review, hint: review ? '含未通过项' : '没有待审', href: hrefOf('rejected_products', hrefOf('pending_review', '/seller/products?status=pending')), tone: review ? 'warn' : 'ok' }
  ]
})

const kpiCards = computed(() => {
  const kpis = dashboard.value?.kpis || {}
  const source = [
    { key: 'revenue', label: '实收积分', unit: 'LDC', icon: WalletCards, digits: 2 },
    { key: 'orders', label: '成交订单', unit: '笔', icon: ShoppingBag, digits: 0 },
    { key: 'buyers', label: '服务买家', unit: '人', icon: UsersRound, digits: 0 },
    { key: 'views', label: '物品浏览', unit: '次', icon: Eye, digits: 0 }
  ]
  return source.map(item => {
    const value = kpis[item.key] || {}
    const rate = value.changeRate
    return {
      ...item,
      value: formatDashboardNumber(value.current, item.digits),
      changeCopy: formatChangeRate(rate),
      direction: rate === null || Number(rate) === 0 ? 'flat' : (Number(rate) > 0 ? 'up' : 'down')
    }
  })
})

const businessStatusItems = computed(() => {
  const status = dashboard.value?.businessStatus || {}
  const merchantReady = Boolean(status.merchant?.configured && status.merchant?.verified)
  const shopReady = Boolean(status.shop?.configured)
  const fulfillment = fulfillmentStore.status
  const fulfillmentMeta = !fulfillmentStore.loaded
    ? fulfillmentStore.error
      ? { value: '核对失败', tone: 'warn', description: '点击进入后重新加载当前规则状态' }
      : { value: '核对中', tone: 'neutral', description: '正在读取当前规则状态' }
    : fulfillment?.activeRestriction
      ? { value: '交易受限', tone: 'danger', description: '已有订单仍可履约和处理售后' }
      : fulfillmentStore.needsAcknowledgement
        ? { value: '待确认', tone: 'warn', description: '普通物品暂时无法发布和成交' }
        : fulfillment?.enabled
          ? { value: '已确认', tone: 'good', description: '当前发货规则已确认' }
          : { value: '未启用', tone: 'neutral', description: '当前无需确认发货规则' }
  return [
    { label: '收款配置', icon: CreditCard, href: '/seller/payment', value: merchantReady ? '已验证' : (status.merchant?.configured ? '待验证' : '未配置'), tone: merchantReady ? 'good' : 'warn', description: merchantReady ? '平台订单可正常收款' : '完成验证后再开始稳定经营' },
    { label: '发货与履约', icon: ShieldCheck, href: '/seller/fulfillment', ...fulfillmentMeta },
    { label: '小店状态', icon: Store, href: '/seller/store', value: shopReady ? getShopStatus(status.shop?.status) : '未开通', tone: status.shop?.status === 'active' ? 'good' : 'neutral', description: shopReady ? (status.shop?.name || '已建立小店资料') : '建立聚合展示页与商家名片' },
    { label: '生效优惠券', icon: TicketPercent, href: '/seller/coupons', value: `${Number(status.coupons?.activeCount || 0)} 张`, tone: Number(status.coupons?.activeCount || 0) > 0 ? 'good' : 'neutral', description: '当前可被买家领取和使用' },
    { label: '推广', icon: Sparkles, href: '/seller/services', value: `${Number(status.services?.activeCount || 0)} 项`, tone: Number(status.services?.expiringSoon || 0) > 0 ? 'warn' : 'neutral', description: Number(status.services?.expiringSoon || 0) > 0 ? `${status.services.expiringSoon} 项将在 7 天内到期` : '推广和经营增值服务状态' },
    { label: '在营物品', icon: PackageCheck, href: '/seller/products', value: `${Number(status.products?.approved || 0)} 件`, tone: Number(status.products?.approved || 0) > 0 ? 'good' : 'neutral', description: `共提交 ${Number(status.products?.total || 0)} 件物品` }
  ]
})

function formatNumber(value, digits = 2) {
  return formatDashboardNumber(value, digits)
}

function formatBeijing(value, options) {
  const ms = normalizeTimestampMs(value)
  if (!Number.isFinite(ms)) return '—'
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, ...options }).format(new Date(ms))
}

function formatShortDate(value) {
  return formatBeijing(value, { month: '2-digit', day: '2-digit' })
}

function formatTime(value) {
  return formatBeijing(value, { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(value) {
  return formatBeijing(value, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function getOrderStatus(status) {
  return ({ paid: '待履约', delivered: '已发货', completed: '已完成' })[status] || status || '未知'
}

function getShopStatus(status) {
  return ({ active: '营业中', pending: '审核中', disabled: '已停用', rejected: '未通过' })[status] || '已配置'
}

async function loadDashboard({ preserve = false } = {}) {
  const sequence = ++requestSequence
  if (preserve) rangeLoading.value = true
  else loading.value = true
  errorMessage.value = ''
  try {
    const result = await fetchMerchantDashboard(selectedRange.value)
    if (sequence !== requestSequence) return
    if (!result?.success) throw new Error(result?.error || '请稍后重试')
    dashboard.value = result.data
  } catch (error) {
    if (sequence === requestSequence) errorMessage.value = error?.message || '请检查网络连接后重试'
  } finally {
    if (sequence === requestSequence) {
      loading.value = false
      rangeLoading.value = false
    }
  }
}

function changeRange(range) {
  if (range === selectedRange.value || rangeLoading.value) return
  selectedRange.value = range
  loadDashboard({ preserve: true })
}

function setupDeferredChart() {
  if (shouldLoadChart.value || !chartLoadTarget.value) return
  chartObserver?.disconnect()
  if (typeof IntersectionObserver !== 'function') {
    shouldLoadChart.value = true
    return
  }
  chartObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return
    shouldLoadChart.value = true
    chartObserver?.disconnect()
    chartObserver = null
  }, { rootMargin: '200px 0px' })
  chartObserver.observe(chartLoadTarget.value)
}

onMounted(() => { void loadDashboard(); void fulfillmentStore.refresh() })
watch(dashboard, async (value) => {
  if (!value) return
  await nextTick()
  setupDeferredChart()
})
onUnmounted(() => chartObserver?.disconnect())
</script>

<style scoped>
.seller-dashboard { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 22px; color: var(--seller-ink); }
.dashboard-card, .opening-checklist { min-width: 0; border: 1px solid var(--seller-border); border-radius: 14px; background: var(--seller-surface); box-shadow: var(--seller-shadow-sm); }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.section-heading p { margin: 0 0 4px; color: var(--seller-jade); font-size: 11px; font-weight: 700; letter-spacing: .14em; }
.section-heading h2 { margin: 0; font: 600 16px/1.3 var(--font-sans); }
.section-heading > a { min-height: 40px; display: inline-flex; align-items: center; gap: 5px; color: var(--seller-muted); font-size: 13px; }
.section-heading > a:hover { color: var(--seller-jade); }
.card-heading { padding: 21px 22px 12px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }

.command-bar { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.command-bar p { margin: 0 0 4px; color: var(--seller-muted); font-size: 12px; }
.command-bar h2 { margin: 0; font: 600 18px/1.35 var(--font-sans); }
.command-bar span { display: block; margin-top: 4px; color: var(--seller-muted); font-size: 13px; line-height: 1.5; }
.backlog-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.backlog-card { min-width: 0; padding: 16px; border: 1px solid var(--seller-border); border-radius: 12px; background: var(--seller-surface); box-shadow: var(--seller-shadow-sm); color: var(--seller-ink); }
.backlog-card span, .backlog-card small { display: block; color: var(--seller-muted); font-size: 12px; }
.backlog-card strong { display: block; margin: 8px 0 6px; font: 650 28px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
.backlog-card.warn strong { color: var(--seller-warning); }
.backlog-card.danger strong { color: var(--seller-danger); }
.backlog-card:hover { border-color: var(--seller-jade); }

.opening-checklist { padding: 22px; }
.opening-heading { align-items: center; margin-bottom: 16px; }
.opening-heading > span { color: var(--seller-muted); font: 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.opening-checklist ol { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
.opening-checklist li { min-height: 100px; display: grid; grid-template-columns: 24px minmax(0,1fr); align-content: start; gap: 9px; padding: 15px; border: 1px solid var(--seller-border); border-radius: 11px; background: color-mix(in srgb, var(--seller-paper) 55%, var(--seller-surface)); }
.opening-checklist li.completed { color: var(--seller-jade); }
.step-number { width: 22px; height: 22px; display: grid; place-items: center; border: 1px solid var(--seller-border); border-radius: 50%; color: var(--seller-muted); font: 700 11px/1 ui-monospace, monospace; }
.opening-checklist strong, .opening-checklist small { display: block; }
.opening-checklist strong { color: var(--seller-ink); font-size: 14px; }
.opening-checklist small { margin-top: 4px; color: var(--seller-muted); font-size: 12px; line-height: 1.5; }
.opening-checklist li > a, .completed-copy { grid-column: 2; min-height: 28px; display: inline-flex; align-items: center; align-self: end; gap: 2px; color: var(--seller-jade); font-size: 12px; font-weight: 650; }

.dashboard-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
.dashboard-toolbar p { margin: 0; font: 600 16px/1.4 var(--font-sans); }
.dashboard-toolbar span { display: block; margin-top: 3px; color: var(--seller-muted); font-size: 12px; }
.range-switch { width: auto; flex-shrink: 0; }

.kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; transition: opacity 160ms ease; }
.kpi-grid[aria-busy="true"] { opacity: .55; }
.kpi-card { min-width: 0; padding: 19px 20px; border: 1px solid var(--seller-border); border-radius: 14px; background: var(--seller-surface); box-shadow: var(--seller-shadow-sm); }
.kpi-head { display: flex; justify-content: space-between; align-items: center; color: var(--seller-muted); font-size: 13px; }
.kpi-head svg { color: var(--seller-jade); }
.kpi-card > strong { display: flex; align-items: baseline; gap: 7px; margin: 17px 0 12px; overflow: hidden; color: var(--seller-ink); font: 650 clamp(25px,3vw,34px)/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: -.04em; }
.kpi-value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kpi-card > strong small { color: var(--seller-muted); font: 500 11px/1 system-ui, sans-serif; letter-spacing: 0; }
.kpi-compare { display: flex; align-items: center; gap: 5px; color: var(--seller-muted); font-size: 11px; }
.kpi-compare svg { flex: 0 0 auto; }
.kpi-compare span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kpi-compare.up { color: var(--seller-jade); }
.kpi-compare.down { color: var(--seller-danger); }

.dashboard-primary-grid { display: grid; grid-template-columns: minmax(0,1.9fr) minmax(290px,.8fr); gap: 16px; }
.dashboard-secondary-grid { display: grid; grid-template-columns: minmax(0,1.5fr) minmax(300px,.7fr); gap: 16px; }
.trend-card { min-width: 0; }
.seller-chart-load-boundary { min-height: 300px; }
.seller-chart-async-placeholder { min-height: 300px; border-radius: 0; }
.chart-view-switch button { padding: 0 10px; }
.source-summary { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1px; margin: 0 22px 16px; overflow: hidden; border: 1px solid var(--seller-border); border-radius: 10px; background: var(--seller-border); }
.source-summary > div { padding: 11px 13px; background: var(--seller-surface); }
.source-summary span, .source-summary strong { display: block; }
.source-summary span { color: var(--seller-muted); font-size: 11px; }
.source-summary strong { margin-top: 3px; font: 650 13px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; }
.chart-data-details { margin: 0 22px 20px; overflow: hidden; border: 1px solid var(--seller-border); border-radius: 10px; background: color-mix(in srgb, var(--seller-paper) 48%, var(--seller-surface)); }
.chart-data-details summary { min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; list-style: none; color: var(--seller-ink); cursor: pointer; font-size: 12px; }
.chart-data-details summary::-webkit-details-marker { display: none; }
.chart-data-details summary:hover { background: color-mix(in srgb, var(--seller-jade) 6%, transparent); }
.chart-data-details summary:focus-visible { outline: 3px solid var(--seller-jade); outline-offset: -3px; }
.chart-data-summary-copy { min-width: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px 9px; }
.chart-data-summary-copy strong { font-size: 13px; }
.chart-data-summary-copy small { color: var(--seller-muted); font-size: 11px; font-weight: 400; }
.chart-data-details summary > svg { flex: 0 0 auto; color: var(--seller-muted); transition: transform 160ms ease; }
.chart-data-details[open] summary { border-bottom: 1px solid var(--seller-border); }
.chart-data-details[open] summary > svg { transform: rotate(180deg); }
.chart-data-table-wrap { max-height: 280px; overflow: auto; }
.chart-data-table-wrap table, .recent-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.chart-data-table-wrap th, .chart-data-table-wrap td { padding: 9px; border-bottom: 1px solid var(--seller-border); text-align: right; font-variant-numeric: tabular-nums; }
.chart-data-table-wrap th:first-child, .chart-data-table-wrap td:first-child { text-align: left; }

.section-count { min-width: 28px; height: 28px; display: grid; place-items: center; border-radius: 999px; color: var(--seller-navy); background: var(--seller-jade-soft); font: 700 11px/1 ui-monospace, monospace; }
.task-list { padding: 0 14px 16px; }
.task-item { min-height: 68px; display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 10px; padding: 10px 8px; border-bottom: 1px solid var(--seller-border); color: var(--seller-ink); }
.task-item:last-child { border-bottom: 0; }
.task-item:hover > svg { color: var(--seller-jade); transform: translateX(2px); }
.task-item > svg { color: var(--seller-muted); transition: transform 160ms ease; }
.task-priority { min-width: 36px; padding: 5px 6px; border-radius: 6px; color: var(--seller-muted); background: var(--seller-surface-soft); text-align: center; font-size: 10px; }
.task-priority.high { color: var(--seller-danger); background: color-mix(in srgb, var(--seller-danger) 10%, var(--seller-surface)); }
.task-priority.medium { color: var(--seller-warning); background: color-mix(in srgb, var(--seller-warning) 10%, var(--seller-surface)); }
.task-item strong, .task-item small { display: block; }
.task-item strong { font-size: 13px; }
.task-item strong em { margin-left: 4px; color: var(--seller-danger); font: 700 12px/1 ui-monospace, monospace; }
.task-item small { margin-top: 4px; color: var(--seller-muted); font-size: 11px; line-height: 1.4; }

.product-performance-list { padding: 0 12px 16px; }
.performance-row { min-height: 68px; display: grid; grid-template-columns: 30px minmax(130px,1.5fr) .5fr .5fr .8fr 18px; align-items: center; gap: 10px; padding: 8px 10px; border-bottom: 1px solid var(--seller-border); color: var(--seller-ink); }
.performance-row:last-child { border-bottom: 0; }
.performance-row:hover { background: color-mix(in srgb, var(--seller-jade) 5%, transparent); }
.rank { color: var(--seller-jade); font: 650 12px/1 ui-monospace, monospace; }
.performance-name { min-width: 0; }
.performance-name strong, .performance-name span, .performance-metric span, .performance-metric strong, .performance-revenue span, .performance-revenue strong { display: block; }
.performance-name strong { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 13px; }
.performance-name span, .performance-metric span, .performance-revenue span { margin-bottom: 3px; color: var(--seller-muted); font-size: 10px; }
.performance-metric strong, .performance-revenue strong { font: 650 12px/1.3 ui-monospace, monospace; }
.performance-revenue { text-align: right; }
.performance-revenue strong { color: var(--seller-jade); }
.business-status-list { padding: 0 14px 16px; }
.business-status-item { min-height: 64px; display: grid; grid-template-columns: 34px minmax(0,1fr) auto; align-items: center; gap: 10px; padding: 8px; border-bottom: 1px solid var(--seller-border); color: var(--seller-ink); }
.business-status-item:last-child { border-bottom: 0; }
.status-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; color: var(--seller-jade); background: var(--seller-jade-soft); }
.business-status-item strong, .business-status-item small { display: block; }
.business-status-item strong { font-size: 12px; }
.business-status-item small { max-width: 210px; margin-top: 3px; overflow: hidden; color: var(--seller-muted); font-size: 10px; white-space: nowrap; text-overflow: ellipsis; }
.status-value { color: var(--seller-muted); font-size: 11px; font-weight: 650; }
.status-value.good { color: var(--seller-jade); }
.status-value.warn { color: var(--seller-warning); }
.status-value.danger { color: var(--seller-danger); }

.recent-table-wrap { position: relative; width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; overflow-x: auto; overscroll-behavior-inline: contain; padding: 0 16px 18px; }
.recent-table { min-width: 820px; }
.recent-table th { padding: 9px 10px; color: var(--seller-muted); font-size: 10px; font-weight: 650; letter-spacing: .06em; text-align: left; }
.recent-table td { padding: 12px 10px; border-top: 1px solid var(--seller-border); color: var(--seller-muted); }
.recent-table td strong, .recent-table td small { display: block; }
.recent-table td strong { max-width: 240px; overflow: hidden; color: var(--seller-ink); font-size: 12px; white-space: nowrap; text-overflow: ellipsis; }
.recent-table td small { max-width: 180px; margin-top: 4px; overflow: hidden; font: 10px/1.2 ui-monospace, monospace; text-overflow: ellipsis; }
.source-chip { display: inline-flex; padding: 5px 7px; border-radius: 6px; color: var(--seller-navy); background: var(--seller-jade-soft); font-size: 10px; font-weight: 650; white-space: nowrap; }
.source-chip.service { color: var(--seller-warning); background: color-mix(in srgb, var(--seller-warning) 10%, var(--seller-surface)); }
.amount-cell { color: var(--seller-ink) !important; font: 650 12px/1 ui-monospace, monospace; white-space: nowrap; }
.recent-table td > a { width: 44px; height: 44px; display: grid; place-items: center; color: var(--seller-muted); }

.compact-empty { min-height: 220px; display: grid; place-items: center; align-content: center; gap: 8px; padding: 24px; color: var(--seller-muted); text-align: center; }
.compact-empty.wide { min-height: 180px; }
.compact-empty svg { color: var(--seller-jade); }
.compact-empty strong { color: var(--seller-ink); font-size: 14px; }
.compact-empty span { max-width: 380px; font-size: 12px; line-height: 1.5; }

.dashboard-error { min-height: 380px; display: grid; place-items: center; align-content: center; gap: 10px; padding: 30px; border: 1px solid var(--seller-border); border-radius: 14px; color: var(--seller-muted); text-align: center; background: var(--seller-surface); }
.dashboard-error svg { color: var(--seller-warning); }
.dashboard-error h2 { margin: 0; color: var(--seller-ink); font: 600 18px/1.3 var(--font-sans); }
.dashboard-error p { margin: 0; font-size: 13px; }
.dashboard-error button { min-height: 44px; display: inline-flex; align-items: center; gap: 7px; margin-top: 6px; padding: 0 16px; border-radius: 10px; color: var(--seller-on-navy); background: var(--seller-navy); }
.dashboard-loading { display: grid; gap: 16px; }
.skeleton { border-radius: 14px; background: linear-gradient(90deg, var(--seller-surface-soft), var(--seller-surface), var(--seller-surface-soft)); background-size: 200% 100%; animation: skeleton-move 1.4s ease infinite; }
.brief-skeleton { height: 88px; }.skeleton-row { display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.kpi-skeleton{height:112px}.chart-skeleton{height:420px}
@keyframes skeleton-move { to { background-position: -200% 0; } }

@media (max-width: 1180px) {
  .dashboard-primary-grid, .dashboard-secondary-grid { grid-template-columns: minmax(0,1fr); }
}
@media (max-width: 900px) {
  .backlog-grid, .opening-checklist ol, .kpi-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
}
@media (max-width: 640px) {
  .seller-dashboard { gap: 16px; }
  .command-bar { align-items: stretch; flex-direction: column; }
  .opening-checklist { padding: 17px; }
  .opening-checklist ol { grid-template-columns: minmax(0,1fr); }
  .kpi-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
  .kpi-card { min-height: 132px; padding: 14px 13px; }
  .kpi-head { gap: 8px; font-size: 12px; }
  .kpi-head svg { width: 17px; height: 17px; flex: 0 0 auto; }
  .kpi-card > strong { gap: 4px; margin: 14px 0 11px; font-size: clamp(21px,6.2vw,25px); }
  .kpi-card > strong.is-compact { align-items: flex-start; flex-direction: column; gap: 5px; font-size: clamp(16px,4.8vw,20px); }
  .kpi-card > strong.is-compact .kpi-value { width: 100%; }
  .kpi-card > strong small { flex: 0 0 auto; font-size: 10px; }
  .kpi-compare { gap: 4px; font-size: 10px; }
  .kpi-compare svg { width: 12px; height: 12px; }
  .opening-checklist li { min-height: 86px; }
  .dashboard-toolbar { align-items: flex-start; flex-direction: column; }
  .range-switch { width: 100%; }
  .card-heading { padding: 18px 17px 10px; }
  .section-heading h2 { font-size: 19px; }
  .source-summary, .chart-data-details { margin-left: 17px; margin-right: 17px; }
  .performance-row { grid-template-columns: 28px minmax(0,1fr) auto 16px; }
  .performance-metric { display: none; }
  .performance-revenue { min-width: 82px; }
  .skeleton-row { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
  .kpi-skeleton { height: 132px; }
  .seller-chart-async-placeholder { min-height: 248px; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .kpi-grid, .chart-data-details summary > svg { transition: none; }
}
</style>
