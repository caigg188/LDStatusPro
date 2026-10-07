import { createApp, h, computed, watch } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory, RouterView, RouterLink } from 'vue-router'
import Announcements from '../../../src/views/Announcements.vue'
import CornerActionMenu from '../../../src/components/common/CornerActionMenu.vue'
import AnnouncementBar from '../../../src/components/common/AnnouncementBar.vue'
import AnnouncementPopup from '../../../src/components/common/AnnouncementPopup.vue'
import SellerLayout from '../../../src/layouts/SellerLayout.vue'
import SellerPage from './SellerPage.vue'
import { useAnnouncement } from '../../../src/composables/useAnnouncement'
import { useUserStore } from '../../../src/stores/user'
import '../../../src/styles/tokens.css'
import '../../../src/styles/main.css'
import '../../../src/styles/seller.css'
const rule = {
  id: 11, title: '普通物品 72 小时发货保障规则已上线', summary: '了解发货时限、退款与卖家责任，让每一笔交易都有据可依。',
  content: '为了让买卖双方拥有更明确的交易预期，士多现已上线普通物品发货保障规则。\n\n## 发货时间，心中有数\n请在付款后 **72 小时内** 完成发货，并保留相应的履约记录。\n\n- 及时更新订单状态，方便买家了解进展。\n- 如遇特殊情况，请主动与买家沟通。\n- 及时处理售后问题，维护彼此的信任。\n\n> 规则细节与适用范围，请查看完整的发货说明。\n\n## 规则一览\n| 场景 | 时间要求 | 处理说明 |\n|---|---|---|\n| 普通物品发货 | 付款后 72 小时内 | 请保留完整的履约记录，便于后续查询与争议处理。 |\n| 订单售后 | 及时沟通处理 | 在订单页查看当前状态，与买家沟通进展。 |\n\n感谢你和我们一起，让士多成为值得信赖的社区小店。',
  mode: 'popup', type: 'info', contentType: 'markdown', publicationStatus: 'published', enabled: true,
  status: 'active', audience: 'all', placements: ['storefront', 'seller'], contentVersion: 1, reminderVersion: 1,
  revision: 1, sortOrder: 0, startsAt: Date.now() - 86400000, expiresAt: Date.now() + 86400000,
  createdAt: Date.now() - 86400000, popupDismissKey: 'popup-preview',
  actionLabel: '查看发货规则', actionUrl: '/docs/shipping-deadline', requiresAcknowledgement: true
}
const announcements = [
  rule,
  { ...rule, id: 12, title: '记住士多的新地址，下次见', mode: 'banner', content: '收藏士多官网，随时回来看看。', summary: '把熟悉的小店加入书签，发现物品，也发现新的可能。请收藏士多官网，随时回来看看最新物品、公告与活动。', requiresAcknowledgement: false },
  { ...rule, id: 13, title: '本次服务维护已完成', mode: 'center', status: 'expired', summary: '服务已恢复，可以正常浏览物品、查看订单。', content: '本次服务维护现已完成。\n\n感谢你的耐心等待。', expiresAt: Date.now() - 86400000, createdAt: Date.now() - 86400000 * 8, requiresAcknowledgement: false, actionUrl: '', actionLabel: '' }
]
// All requests are handled here: previews never contact APIs, payments or telemetry.
globalThis.fetch = async (input) => {
  const url = new globalThis.URL(String(input), globalThis.location.origin)
  if (url.pathname.endsWith('/merchant/enforcement')) return new globalThis.Response(JSON.stringify({ success: true, data: { enforcement: { status: 'active', sellingAllowed: true }, history: [] } }), { headers: { 'content-type': 'application/json' } })
  const scenario = new globalThis.URLSearchParams(globalThis.location.search).get('feed')
  if (scenario === 'error' && url.pathname.endsWith('/announcements')) throw new Error('隔离预览：公告加载失败')
  let items = announcements
  const search = url.searchParams.get('search') || ''
  const status = url.searchParams.get('status')
  if (url.pathname.endsWith('/center')) items = items.filter(item => (!status || item.status === status) && `${item.title}${item.content}`.includes(search))
  else items = items.filter(item => item.status === 'active' && item.placements.includes(url.searchParams.get('placement') || 'storefront'))
  if (scenario === 'empty' && url.pathname.endsWith('/announcements')) items = []
  const id = Number(url.pathname.split('/').pop())
  return new globalThis.Response(JSON.stringify({ success: true, data: { items, item: announcements.find(item => item.id === id) || rule, pagination: { page: 1, pageSize: 20, total: items.length, totalPages: 1 }, timestamp: Date.now() } }), { headers: { 'content-type': 'application/json' } })
}
const router = createRouter({ history: createWebHistory(), scrollBehavior: () => ({ top: 0 }), routes: [
  { path: '/', name: 'Home', component: { render: () => h('main', {}, [
    h('p', {}, '士多首页 · 隔离预览'),
    h('nav', { 'aria-label': '首页板块' }, ['products', 'hotboard', 'buy', 'stores'].map((section, index) =>
      h(RouterLink, { to: { path: '/', query: { section } }, replace: true, style: { display: 'inline-flex', padding: '12px' } }, () => ['物品广场', '士多热榜', '求购广场', '小店集市'][index])))
  ]) } },
  { path: '/announcements', component: Announcements }, { path: '/announcements/:id', component: Announcements },
  { path: '/seller', component: SellerLayout, meta: { layout: 'seller' }, children: [
    { path: '', name: 'SellerDashboard', component: SellerPage, meta: { title: '经营概览' } },
    { path: 'orders', name: 'SellerOrders', component: SellerPage, meta: { title: '订单管理' } }
  ] },
  { path: '/:pathMatch(.*)*', component: { render: () => h('main', {}, '隔离预览入口') } }
] })
const app = createApp({ setup() {
  useUserStore().sessionReady = true
  const state = useAnnouncement()
  const seller = computed(() => router.currentRoute.value.meta.layout === 'seller')
  watch(seller, value => state.configureAnnouncements('guest', value ? 'seller' : 'storefront'), { immediate: true })
  state.startAnnouncements()
  return () => h('div', [
    h('button', { onClick: () => { globalThis.sessionStorage.clear(); globalThis.localStorage.clear(); globalThis.location.reload() } }, '重置隔离预览'),
    h('button', { onClick: () => globalThis.document.documentElement.classList.toggle('dark') }, '切换预览主题'),
    !seller.value && h(AnnouncementBar), state.announcementLoaded.value && h(AnnouncementPopup), h(RouterView), !seller.value && h(CornerActionMenu)
  ])
} })
app.use(createPinia()).use(router).mount('#app')
