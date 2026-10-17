<template>
  <div class="merchant-services-page top-service-theme" :class="{ 'has-purchase-bar': activeTab === 'service' && !focusedOrder && products.length > 0 }">
    <div class="services-content" :inert="orderDialogOpen ? '' : null">
    <SellerPageToolbar eyebrow="推广" description="选择展示范围与推广时长，支付确认后开始服务。">
      <template #actions><router-link to="/seller/duo-plus" class="text-button">DUO+ 曝光推广</router-link>
        <SellerButton variant="ghost" @click="activeTab = 'board'">查看名额<ArrowRight :size="16" aria-hidden="true" /></SellerButton>
      </template>
    </SellerPageToolbar>

    <div v-if="pendingOrders.length" class="pending-banner">
      <Clock3 :size="19" aria-hidden="true" /><div><strong>你有 {{ pendingOrders.length }} 笔待支付订单</strong><span>名额正在保留，未付款可取消。</span></div>
      <button type="button" @click="showPendingOrders">去处理<ArrowRight :size="16" aria-hidden="true" /></button>
    </div>

    <SellerTabs v-model="activeTab" :tabs="serviceTabs" mode="tabs" layout="equal" aria-label="推广功能" />
    <div v-show="activeTab === 'service'" id="merchant-panel-service" role="tabpanel" aria-labelledby="merchant-tab-service" tabindex="0" class="service-panel">
      <div class="panel-toolbar"><span>选好物品，再决定推广方式</span><button type="button" class="text-button" :disabled="optionsLoading || submitting" @click="loadOptions"><RefreshCw :size="16" aria-hidden="true" />{{ optionsLoading ? '更新中…' : '刷新名额与方案' }}</button></div>
      <div v-if="optionsError" class="inline-alert" role="alert"><span>{{ optionsError }}。{{ optionsLoaded ? '当前展示上次的数据，更新成功后才能下单。' : '请重新加载后选择服务。' }}</span><button type="button" :disabled="optionsLoading" @click="loadOptions">重新加载</button></div>
      <div v-if="selectionNotice" class="inline-notice" role="status">{{ selectionNotice }}</div>
      <div v-if="purchaseError || uncertainProductId" class="inline-alert" role="alert"><span>{{ purchaseError || '正在核对订单，请勿重复下单。' }}</span><button v-if="uncertainProductId" type="button" :disabled="optionsLoading" @click="reconcileCreation">重新核对</button><button type="button" @click="activeTab = 'orders'">查看购买记录</button></div>

      <div v-if="!optionsLoaded && optionsLoading" class="purchase-loading" role="status" aria-label="正在加载物品与服务方案"><div></div><div></div><span>正在加载可推广物品…</span></div>
      <div v-else-if="optionsLoaded && !products.length && !focusedOrder" class="empty-state"><Package :size="32" aria-hidden="true" /><h3>先准备一件已上架的物品</h3><p>物品上架后，就可以在这里选择推广方案。</p><router-link to="/seller/products" class="secondary-button">前往物品管理<ArrowRight :size="16" aria-hidden="true" /></router-link></div>
      <div v-else-if="optionsLoaded || focusedOrder" class="purchase-layout">
        <div class="purchase-form">
          <TopServiceProductPicker :products="products" :model-value="selectedProductId" :disabled="submitting || !!uncertainProductId || optionsLoading" @change="selectProduct" @retry-images="loadProductImages" />
          <div v-if="selectedProduct?.currentTopOrder" class="existing-order-note"><CircleHelp :size="18" aria-hidden="true" /><p>这件物品已有服务订单，同一时间不能重复开通。请在订单进度中处理，或更换其他物品。</p><button type="button" class="text-button" @click="focusOrder(selectedProduct.currentTopOrder)">查看已有订单</button></div>
          <TopServicePlans v-else-if="selectedProduct" :packages="packages" :product="selectedProduct" :selected-type="selectedPackageType" :selected-days="selectedDurationDays" :disabled="submitting || !!uncertainProductId || optionsLoading || !!optionsError" @service="selectService" @duration="selectDuration" />
          <p v-if="!selectedProduct" class="next-choice-note">选好物品后，再查看它可用的展示范围与推广时长。</p>
          <details class="service-rules"><summary>购买与名额规则<ChevronDown :size="16" aria-hidden="true" /></summary><ul><li>页面余量已扣除仍在支付期限内的待支付占位，是否成功保留名额以下单结果为准。</li><li>士多优选使用所属分类的独立名额；士多甄选是否覆盖“全部”分类，取决于物品所属分类。入站、卡券使用独立甄选池。</li><li>所有付费服务绑定下单时的分类。改到其他分类会暂停展示，但仍占用原名额；切回原分类可在有效期内恢复。</li><li>同一物品同一时间只能有一笔进行中的服务订单。已生效服务不支持卖家自行取消。</li><li>服务到期自动结束，并发送系统提醒。管理员设置的非有偿置顶不占用付费名额。</li><li>士多优选如需包年，请联系管理员。</li></ul><button type="button" class="text-button" @click="activeTab = 'board'">查看名额看板<ArrowRight :size="16" aria-hidden="true" /></button></details>
        </div>
        <aside ref="purchaseAside" class="purchase-aside" tabindex="-1" aria-label="本次推广订单">
          <TopServiceOrderCard v-if="focusedOrder" :order="focusedOrder" :now="orderClockMs" :action="orderActions[focusedOrder.orderNo]" :notice="orderNotice" :feedback="orderFeedback" :error="focusError" :fallback-url="fallbackPaymentUrl" @pay="repayOrder" @refresh="refreshOrder" @cancel="cancelOrder" @restart="restartPurchase" />
          <div v-else-if="focusLoading || focusError" class="inline-alert" role="status"><span>{{ focusError || '正在恢复订单…' }}</span><button v-if="focusError" type="button" @click="focusOrder(String(route.query.orderNo || ''))">重试</button></div>
          <TopServiceSummary v-else :product="selectedProduct" :config="selectedConfig" :service="selectedGroup" :reason="submitReason" :submitting="submitting" @submit="submitOrder" />
        </aside>
      </div>
    </div>

    <div v-show="activeTab === 'board'" id="merchant-panel-board" role="tabpanel" aria-labelledby="merchant-tab-board" tabindex="0" class="service-panel board-shell">
      <TopServiceQuotaBoard v-if="boardVisited" ref="boardRef" @purchase="startNewPurchase" />
    </div>

    <div v-show="activeTab === 'orders'" id="merchant-panel-orders" role="tabpanel" aria-labelledby="merchant-tab-orders" tabindex="0" class="service-panel orders-panel">
      <header class="records-heading"><div><h2>购买记录</h2><p>支付进度、服务有效期和需要处理的订单，都在这里。</p></div><button type="button" class="text-button" @click="startNewPurchase">开通新服务<ArrowRight :size="16" aria-hidden="true" /></button></header>
      <form class="records-filters" @submit.prevent="loadOrders(1)">
        <label class="record-search"><span class="sr-only">搜索订单号或物品名称</span><Search :size="18" aria-hidden="true" /><input v-model="orderSearch" type="search" placeholder="订单号或物品名称" /></label>
        <label><span class="sr-only">订单状态</span><select v-model="orderFilterStatus" @change="loadOrders(1)"><option value="">全部状态</option><option value="pending">待支付</option><option value="active">服务有效期内</option><option value="suspended">平台暂停</option><option value="expired">支付超时 / 服务结束</option><option value="cancelled">已取消</option></select></label>
        <button class="secondary-button" type="submit" :disabled="ordersLoading"><RefreshCw :size="16" aria-hidden="true" />{{ ordersLoading ? '查询中…' : '查询订单' }}</button>
      </form>
      <div v-if="ordersError" class="inline-alert" role="alert"><span>{{ ordersError }}，当前记录可能未更新。</span><button type="button" :disabled="ordersLoading" @click="loadOrders(pagination.page)">重试</button></div>
      <div v-if="ordersLoading && !orders.length" class="empty-state" role="status">正在读取购买记录…</div>
      <div v-else-if="!orders.length && !ordersError" class="empty-state"><ReceiptText :size="30" aria-hidden="true" /><h3>{{ orderSearch || orderFilterStatus ? '暂无匹配记录' : '还没有推广订单' }}</h3><p>{{ orderSearch || orderFilterStatus ? '试试其他关键词，或清除筛选条件。' : '开通服务后，可在这里跟进支付和展示状态。' }}</p><button type="button" class="secondary-button" @click="orderSearch || orderFilterStatus ? clearOrderFilters() : startNewPurchase()">{{ orderSearch || orderFilterStatus ? '清除筛选' : '选择推广物品' }}</button></div>
      <div v-else class="records-list" :aria-busy="ordersLoading">
        <article v-for="order in orders" :key="order.orderNo" class="record-row" :class="{ focused: focusedOrder?.orderNo === order.orderNo }">
          <div class="record-product"><strong>{{ order.productName }}</strong><span>{{ order.orderNo }}</span></div>
          <div class="record-package"><strong>{{ order.packageName }} · {{ order.durationDays ? `${order.durationDays} 天` : '永久' }}</strong><span>{{ order.createdAt }}</span></div>
          <div class="record-status"><SellerStatusBadge :label="getTopServiceOrderPresentation(order, orderClockMs).label" :tone="getTopServiceOrderPresentation(order, orderClockMs).tone" /><strong>{{ Number(order.amount || 0).toFixed(2) }} <small>LDC</small></strong></div>
          <button type="button" class="secondary-button" :aria-label="`查看 ${order.productName} 的订单 ${order.orderNo}`" @click="openRecord(order, $event)">查看订单<ArrowRight :size="15" aria-hidden="true" /></button>
        </article>
      </div>
      <SellerPagination :page="pagination.page" :total="pagination.total" :total-pages="pagination.totalPages" @change="loadOrders" />
    </div>
    </div>
    <TopServiceOrderDialog :open="orderDialogOpen" :return-focus="recordTrigger" @close="clearFocus">
      <TopServiceOrderCard v-if="focusedOrder" embedded :order="focusedOrder" :now="orderClockMs" :action="orderActions[focusedOrder.orderNo]" :notice="orderNotice" :feedback="orderFeedback" :error="focusError" :fallback-url="fallbackPaymentUrl" @pay="repayOrder" @refresh="refreshOrder" @cancel="cancelOrder" @restart="restartPurchase" />
      <div v-else class="inline-alert" role="status"><span>{{ focusError || '正在读取订单详情…' }}</span><button v-if="focusError" type="button" @click="focusOrder(String(route.query.orderNo || ''))">重新加载</button></div>
    </TopServiceOrderDialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, ChevronDown, CircleHelp, Clock3, LayoutGrid, Megaphone, Package, ReceiptText, RefreshCw, Search } from '@lucide/vue'
import SellerButton from '@/components/seller/SellerButton.vue'
import SellerPageToolbar from '@/components/seller/SellerPageToolbar.vue'
import SellerTabs from '@/components/seller/SellerTabs.vue'
import SellerPagination from '@/components/seller/SellerPagination.vue'
import SellerStatusBadge from '@/components/seller/SellerStatusBadge.vue'
import TopServiceProductPicker from '@/components/seller/TopServiceProductPicker.vue'
import TopServicePlans from '@/components/seller/TopServicePlans.vue'
import TopServiceSummary from '@/components/seller/TopServiceSummary.vue'
import TopServiceOrderCard from '@/components/seller/TopServiceOrderCard.vue'
import TopServiceQuotaBoard from '@/components/seller/TopServiceQuotaBoard.vue'
import TopServiceOrderDialog from '@/components/seller/TopServiceOrderDialog.vue'
import { useTopServicePurchase } from '@/composables/useTopServicePurchase'
import { getTopServiceOrderPresentation } from '@/utils/topServiceOrder'
import '@/styles/top-service.css'

const route = useRoute()
const router = useRouter()
const serviceTabs = [
  { value: 'service', label: '置顶服务', description: '选择物品与推广方案', iconComponent: Megaphone },
  { value: 'board', label: '名额看板', description: '查看余量与占用', iconComponent: LayoutGrid },
  { value: 'orders', label: '购买记录', description: '跟进支付与服务状态', iconComponent: ReceiptText }
].map(tab => ({ ...tab, id: `merchant-tab-${tab.value}`, panelId: `merchant-panel-${tab.value}` }))
const normalizeTab = value => serviceTabs.some(tab => tab.value === value) ? value : 'service'
const activeTab = ref(normalizeTab(route.query.tab))
const boardVisited = ref(activeTab.value === 'board')
const boardRef = ref(null)
const recordTrigger = ref(null)
const purchaseAside = ref(null)
const {
  packages, products, optionsLoading, optionsLoaded, optionsError, selectionNotice, selectedProductId,
  selectedProduct, selectedPackageType, selectedDurationDays, selectedGroup, selectedConfig, submitting, uncertainProductId,
  purchaseError, submitReason, pendingOrders, focusedOrder, focusLoading, focusError, orderNotice,
  orderFeedback, fallbackPaymentUrl, orderClockMs, orderActions, orders, ordersLoading, ordersError,
  orderSearch, orderFilterStatus, pagination, loadOptions, selectProduct, selectService, selectDuration,
  submitOrder, reconcileCreation, loadOrders, focusOrder, clearFocus, refreshOrder, repayOrder, cancelOrder, loadProductImages
} = useTopServicePurchase()
const orderDialogOpen = computed(() => activeTab.value === 'orders' && !!(focusedOrder.value || focusLoading.value || focusError.value))

watch(() => route.query.tab, value => { activeTab.value = normalizeTab(value) })
watch(activeTab, value => {
  if (route.query.tab !== value) {
    // Tab changes and order selection can happen in the same click. Preserve the
    // newly focused order rather than merging a route snapshot that is one tick old.
    const query = { ...route.query, tab: value }
    if (focusedOrder.value) query.orderNo = focusedOrder.value.orderNo
    else if (!focusLoading.value) delete query.orderNo
    void router.replace({ query })
  }
  if (value === 'orders') void loadOrders(1)
  if (value === 'board') { boardVisited.value = true; void boardRef.value?.refresh() }
})
watch(() => focusedOrder.value?.status, (status, previous) => {
  if (status && previous && status !== previous && boardVisited.value) void boardRef.value?.refresh()
})
watch(() => focusedOrder.value?.orderNo, async orderNo => {
  if (!orderNo || activeTab.value !== 'service') return
  await nextTick()
  purchaseAside.value?.focus({ preventScroll: true })
  if (window.matchMedia('(max-width: 980px)').matches) purchaseAside.value?.scrollIntoView({ block: 'start', behavior: 'auto' })
})
function showPendingOrders(event) { recordTrigger.value = event?.currentTarget || null; orderFilterStatus.value = 'pending'; activeTab.value = 'orders'; if (pendingOrders.value[0]) void focusOrder(pendingOrders.value[0]); if (route.query.tab === 'orders') void loadOrders(1) }
function openRecord(order, event) { recordTrigger.value = event?.currentTarget || null; void focusOrder(order) }
function clearOrderFilters() { orderFilterStatus.value = ''; orderSearch.value = ''; void loadOrders(1) }
function startNewPurchase() { clearFocus(); activeTab.value = 'service'; void selectProduct('') }
async function restartPurchase() { clearFocus(); activeTab.value = 'service'; await selectProduct(''); void loadOptions() }
onMounted(() => { if (activeTab.value === 'orders') void loadOrders(1) })
</script>

<style scoped>
.merchant-services-page { color:var(--seller-ink); min-width:0; }
.services-heading { display:flex; align-items:center; justify-content:space-between; gap:24px; padding:4px 0 24px; }
.page-eyebrow { margin:0 0 9px; color:var(--seller-jade-strong); font-size:12px; font-weight:650; }
.services-heading h2 { margin:0; font-family:"Noto Serif SC","Songti SC",serif; font-size:clamp(23px,2.2vw,30px); font-weight:600; line-height:1.5; }
.services-heading p:last-child,.records-heading p { margin:9px 0 0; color:var(--seller-muted); font-size:14px; line-height:1.75; }
.text-button,.secondary-button { display:inline-flex; justify-content:center; align-items:center; gap:7px; min-height:44px; padding:10px 12px; border:1px solid var(--seller-border); border-radius:9px; color:var(--seller-ink); background:var(--seller-surface); font-size:13px; line-height:1.5; cursor:pointer; }
.text-button { background:transparent; border-color:transparent; color:var(--seller-jade-strong); }
button:disabled { opacity:.6; cursor:not-allowed; }
.pending-banner { display:flex; gap:12px; align-items:center; padding:14px 18px; margin-bottom:20px; border:1px solid var(--seller-border); border-radius:10px; background:color-mix(in srgb,var(--service-gold-soft) 60%,var(--seller-surface)); }
.pending-banner>svg { flex:0 0 auto; color:var(--service-gold-ink); }
.pending-banner>div { display:flex; flex-wrap:wrap; gap:6px 14px; flex:1; font-size:13px; line-height:1.6; }
.pending-banner span { color:var(--seller-muted); }
.pending-banner strong { font-weight:600; }
.pending-banner button { display:flex; align-items:center; flex:0 0 auto; gap:7px; min-height:44px; color:var(--seller-jade-strong); font-size:13px; background:transparent; }
.service-panel { margin-top:22px; outline-offset:5px; }
.panel-toolbar { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-bottom:16px; color:var(--seller-muted); font-size:13px; }
.purchase-layout { display:grid; grid-template-columns:minmax(0,1fr) 344px; gap:24px; align-items:start; }
.purchase-form { min-width:0; padding:26px; border:1px solid var(--seller-border); border-radius:14px; background:var(--seller-surface); }
.purchase-aside { min-width:0; position:sticky; top:92px; }
.existing-order-note { display:flex; flex-wrap:wrap; align-items:flex-start; gap:12px; margin-top:24px; padding:16px; border-radius:10px; background:var(--seller-jade-soft); }
.existing-order-note p { flex:1; min-width:150px; margin:0; font-size:14px; line-height:1.8; }
.existing-order-note>svg { margin-top:4px; color:var(--seller-jade-strong); }
.next-choice-note { padding:22px 0 0; margin:22px 0 0; border-top:1px solid var(--seller-border); color:var(--seller-muted); font-size:14px; line-height:1.8; }
.service-rules { margin-top:28px; border-top:1px solid var(--seller-border); padding-top:8px; }
.service-rules summary { display:flex; align-items:center; justify-content:space-between; min-height:48px; cursor:pointer; list-style:none; font-size:13px; font-weight:600; }
.service-rules summary::-webkit-details-marker { display:none; }
.service-rules[open] summary svg { transform:rotate(180deg); }
.service-rules ul { margin:8px 0; padding-left:19px; font-size:13px; color:var(--seller-muted); line-height:1.9; }
.service-rules li+li { margin-top:8px; }
.inline-alert,.inline-notice { display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px; padding:14px 16px; border:1px solid var(--seller-border-strong); border-radius:9px; color:var(--seller-ink); background:var(--seller-surface); font-size:13px; line-height:1.8; }
.inline-alert>span { flex:1; min-width:160px; }
.inline-alert button { min-height:44px; padding:8px 12px; border:1px solid var(--seller-border); border-radius:8px; color:var(--seller-jade-strong); background:var(--seller-surface-strong); }
.empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:52px 20px; color:var(--seller-muted); border:1px dashed var(--seller-border); border-radius:12px; font-size:14px; text-align:center; }
.empty-state h3 { margin:6px 0 0; font-size:18px; color:var(--seller-ink); }
.empty-state p { margin:0 0 6px; line-height:1.8; }
.purchase-loading { min-height:360px; display:grid; grid-template-columns:2fr 1fr; gap:24px; position:relative; }
.purchase-loading>div { border-radius:12px; background:var(--seller-surface-soft); }
.purchase-loading>span { position:absolute; left:24px; top:24px; color:var(--seller-muted); font-size:14px; }
.records-heading { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-bottom:20px; }
.records-heading h2 { margin:0; font-size:22px; }
.records-filters { display:flex; align-items:stretch; flex-wrap:wrap; gap:12px; margin:20px 0; }
.record-search { display:flex; gap:10px; align-items:center; flex:1; min-width:180px; padding:0 12px; border:1px solid var(--seller-border); border-radius:9px; background:var(--seller-surface-strong); color:var(--seller-muted); }
.record-search input { width:100%; min-width:0; min-height:44px; background:transparent; border:0; color:var(--seller-ink); font-size:14px; }
.records-filters select { min-height:46px; max-width:100%; padding:8px 12px; border:1px solid var(--seller-border); border-radius:9px; background:var(--seller-surface-strong); color:var(--seller-ink); font-size:13px; }
.purchase-aside:focus-visible { outline:2px solid var(--seller-jade); outline-offset:4px; border-radius:14px; }
.records-list { display:grid; gap:10px; }
.record-row { display:grid; grid-template-columns:minmax(0,1fr) 190px 145px auto; gap:18px; align-items:center; padding:18px; border:1px solid var(--seller-border); border-radius:10px; background:var(--seller-surface); }
.record-row.focused { border-color:var(--seller-jade); }
.record-product,.record-package,.record-status { display:grid; gap:8px; min-width:0; }
.record-product strong { font-size:14px; line-height:1.65; overflow-wrap:anywhere; }
.record-product span,.record-package span { font-size:12px; color:var(--seller-muted); overflow-wrap:anywhere; font-variant-numeric:tabular-nums; }
.record-package strong,.record-status>strong { font-size:13px; font-weight:600; }
.record-status small { font-size:12px; font-weight:400; }
:deep(.seller-pagination-controls button) { min-width:44px; height:44px; }
@media(max-width:1180px) { .purchase-layout { grid-template-columns:minmax(0,1fr) 310px; gap:18px; } .purchase-form { padding:22px; } .record-row { grid-template-columns:minmax(0,1fr) 140px auto; } .record-package { grid-column:1; grid-row:2; } .record-status { grid-column:2; grid-row:1/3; } .record-row>button { grid-column:3; grid-row:1/3; } }
@media(max-width:980px) { .purchase-layout { grid-template-columns:1fr; } .purchase-aside { position:static; } }
@media(max-width:767px) {
  :global(html:has(.merchant-services-page.has-purchase-bar)) { scroll-padding-bottom:calc(150px + var(--seller-dock-offset, 0px)); }
  .has-purchase-bar :deep(button),.has-purchase-bar :deep(input),.has-purchase-bar :deep(summary) { scroll-margin-bottom:calc(150px + var(--seller-dock-offset, 0px)); }
  .merchant-services-page.has-purchase-bar { padding-bottom:168px; scroll-padding-bottom:calc(150px + var(--seller-dock-offset, 0px)); }
  .services-heading { align-items:flex-start; gap:10px; padding-bottom:18px; }
  .services-heading h2 { font-size:22px; }
  .services-heading>.text-button { display:none; }
  .services-heading p:last-child { font-size:13px; }
  .panel-toolbar { font-size:12px; gap:5px; }
  .panel-toolbar .text-button { padding-inline:4px; font-size:12px; }
  .purchase-form { padding:20px 16px; }
  .pending-banner { padding:10px 12px; }
  .pending-banner>div { display:grid; gap:2px; }
  .records-heading { align-items:flex-start; }
  .records-heading p { font-size:13px; }
  .records-heading .text-button { flex:0 0 auto; }
  .records-filters { gap:8px; }
  .record-search { flex-basis:100%; }
  .records-filters>label:not(.record-search) { flex:1; min-width:0; }
  .records-filters select { width:100%; }
  .record-row { grid-template-columns:minmax(0,1fr) auto; padding:16px; gap:14px; }
  .record-product { grid-column:1/-1; }
  .record-package { grid-column:1; grid-row:2; }
  .record-status { grid-column:1; grid-row:3; justify-items:start; }
  .record-row>button { grid-column:2; grid-row:3; }
}
@media(prefers-reduced-motion:reduce) { *,*::before,*::after { transition:none!important; animation:none!important; scroll-behavior:auto!important; } }
</style>
