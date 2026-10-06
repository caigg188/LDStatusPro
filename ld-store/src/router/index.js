import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useMerchantEnforcementStore } from '@/stores/merchantEnforcement'
import {
  MAINTENANCE_STATE,
  ensureMaintenanceStatusLoaded,
} from '@/config/maintenance'
import { storage } from '@/utils/storage'
import { resolveGuestOnlyRedirect } from '@/utils/navigation'
import HomeView from '@/views/Home.vue'
import { resolveLegacyPublishTarget } from '@/utils/sellerNavigation'
import { getHelpArticle, resolveLegacyHelpLocation } from '@/config/helpCenter'
import {
  resolveMaintenanceRedirect,
  startBackgroundMaintenanceRefresh,
} from '@/utils/maintenanceNavigation'

function resolveHelpRoute(to) {
  const section = String(to.params.section || '')
  const legacyTarget = resolveLegacyHelpLocation(section, to.query)
  if (legacyTarget) return legacyTarget
  if (!getHelpArticle(section)) {
    return { name: 'Docs', query: to.query, replace: true }
  }
  return true
}

// 路由配置
const routes = [
  { path: '/announcements', name: 'Announcements', component: () => import('@/views/Announcements.vue'), meta: { title: '公告中心 - LD士多' } },
  { path: '/announcements/:id', name: 'AnnouncementDetail', component: () => import('@/views/Announcements.vue'), meta: { title: '公告详情 - LD士多' } },
  {
    path: '/',
    name: 'Home',
    component: HomeView,
    meta: { title: 'LD士多 - LinuxDo站点积分兑换中心' }
  },
  {
    path: '/product/:id',
    name: 'ProductDetail',
    component: () => import('@/views/ProductDetail.vue'),
    meta: { title: '商品详情 - LD士多' }
  },
  {
    path: '/checkout/:productId',
    name: 'OrderConfirm',
    component: () => import('@/views/OrderConfirm.vue'),
    meta: { title: '确认订单 - LD士多', requiresAuth: true }
  },
  {
    path: '/merchant/:username',
    name: 'MerchantProfile',
    component: () => import('@/views/MerchantProfile.vue'),
    meta: { title: '商家主页 - LD士多' }
  },
  {
    path: '/category/:name',
    name: 'Category',
    component: () => import('@/views/Category.vue'),
    meta: { title: '分类商品 - LD士多' }
  },
  {
    path: '/search',
    name: 'Search',
    component: () => import('@/views/Search.vue'),
    meta: { title: '搜索 - LD士多' }
  },
  {
    path: '/buy-request/:id',
    name: 'BuyRequestDetail',
    component: () => import('@/views/BuyRequestDetail.vue'),
    meta: { title: '求购详情 - LD士多' }
  },
  {
    path: '/user',
    name: 'User',
    component: () => import('@/views/User.vue'),
    meta: { title: '个人中心 - LD士多', requiresAuth: true }
  },
  {
    path: '/user/orders',
    name: 'Orders',
    component: () => import('@/views/Orders.vue'),
    meta: { title: '我的订单 - LD士多', requiresAuth: true }
  },
  {
    path: '/user/favorites',
    name: 'MyFavorites',
    component: () => import('@/views/MyFavorites.vue'),
    meta: { title: '收藏与拉黑 - LD士多', requiresAuth: true }
  },
  {
    path: '/coupon/:token',
    name: 'CouponClaim',
    component: () => import('@/views/CouponClaim.vue'),
    meta: { title: '领取优惠券 - LD士多' }
  },
  {
    path: '/user/coupons',
    name: 'MyCoupons',
    component: () => import('@/views/MyCoupons.vue'),
    meta: { title: '我的优惠券 - LD士多', requiresAuth: true }
  },
  {
    path: '/user/coupons/manage',
    redirect: { name: 'SellerCoupons' }
  },
  {
    path: '/user/buy-orders/:orderNo',
    name: 'BuyOrderDetail',
    component: () => import('@/views/BuyOrderDetail.vue'),
    meta: { title: '求购订单详情 - LD士多', requiresAuth: true }
  },
  {
    path: '/user/reports',
    name: 'MyReports',
    component: () => import('@/views/MyReports.vue'),
    meta: { title: '我的举报 - LD士多', requiresAuth: true }
  },
  {
    path: '/user/reports/:id',
    name: 'MyReportDetail',
    component: () => import('@/views/MyReportDetail.vue'),
    meta: { title: '举报详情 - LD士多', requiresAuth: true }
  },
  {
    path: '/user/products',
    redirect: { name: 'SellerProducts' }
  },
  {
    path: '/user/buy-requests',
    name: 'MyBuyRequests',
    component: () => import('@/views/MyBuyRequests.vue'),
    meta: { title: '我的求购 - LD士多', requiresAuth: true }
  },
  {
    path: '/user/messages',
    name: 'MyMessages',
    component: () => import('@/views/MyBuyChats.vue'),
    meta: { title: '我的消息 - LD士多', requiresAuth: true }
  },
  {
    path: '/user/buy-chats',
    redirect: '/user/messages'
  },
  {
    path: '/user/settings',
    redirect: { name: 'SellerPayment' }
  },
  {
    path: '/shop/:id',
    name: 'ShopDetail',
    component: () => import('@/views/ShopDetail.vue'),
    meta: { title: '小店详情 - LD士多' }
  },
  {
    path: '/user/my-shop',
    redirect: { name: 'SellerStore' }
  },
  {
    path: '/publish',
    redirect: to => resolveLegacyPublishTarget(to.query)
  },
  {
    path: '/buy-requests/new',
    name: 'BuyRequestPublish',
    component: () => import('@/views/Publish.vue'),
    props: { initialMode: 'buy', lockedMode: true },
    meta: { title: '发布求购 - LD士多', requiresAuth: true }
  },
  {
    path: '/edit/:id',
    redirect: to => ({ name: 'SellerEdit', params: to.params, query: to.query })
  },
  {
    path: '/order/:id',
    name: 'OrderDetail',
    component: () => import('@/views/OrderDetail.vue'),
    meta: { title: '订单详情 - LD士多', requiresAuth: true }
  },
  {
    path: '/pay/signal',
    name: 'PaymentSignal',
    component: () => import('@/views/PaymentSignal.vue'),
    meta: { title: '支付结果 - LD士多', bare: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录 - LD士多', guestOnly: true }
  },
  {
    path: '/auth/callback',
    name: 'AuthCallback',
    component: () => import('@/views/AuthCallback.vue'),
    meta: { title: '登录中...' }
  },
  {
    path: '/ld-image',
    name: 'LdImage',
    component: () => import('@/views/LdImage.vue'),
    meta: { title: '士多图床 - LD士多' }
  },
  {
    path: '/docs',
    name: 'Docs',
    component: () => import('@/views/Docs.vue'),
    meta: { title: '帮助中心 - LD士多' }
  },
  {
    path: '/docs/:section',
    name: 'DocsSection',
    component: () => import('@/views/Docs.vue'),
    beforeEnter: resolveHelpRoute,
    meta: { title: '帮助中心 - LD士多' }
  },

  {
    path: '/support',
    name: 'Support',
    component: () => import('@/views/Support.vue'),
    meta: { title: '支持 LDStatus Pro - LD士多' }
  },
  {
    path: '/merchant-services',
    redirect: { name: 'SellerServices' }
  },
  {
    path: '/seller',
    component: () => import('@/layouts/SellerLayout.vue'),
    meta: { requiresAuth: true, layout: 'seller' },
    children: [
      {
        path: '',
        name: 'SellerDashboard',
        component: () => import('@/views/seller/SellerDashboard.vue'),
        meta: { title: '经营概览 - LD士多卖家后台' }
      },
      {
        path: 'orders',
        name: 'SellerOrders',
        component: () => import('@/views/Orders.vue'),
        props: { sellerMode: true },
        meta: { title: '订单管理 - LD士多卖家后台' }
      },
      {
        path: 'orders/:id',
        name: 'SellerOrderDetail',
        component: () => import('@/views/seller/SellerOrderDetail.vue'),
        meta: { title: '订单详情 - LD士多卖家后台', orderRole: 'seller' }
      },
      {
        path: 'refunds',
        name: 'SellerRefunds',
        component: () => import('@/views/seller/SellerRefunds.vue'),
        meta: { title: '退款售后 - LD士多卖家后台' }
      },
      {
        path: 'fulfillment',
        name: 'SellerFulfillment',
        component: () => import('@/views/seller/SellerFulfillment.vue'),
        meta: { title: '发货与履约 - LD士多卖家后台' }
      },
      {
        path: 'products',
        name: 'SellerProducts',
        component: () => import('@/views/MyProducts.vue'),
        meta: { title: '我的物品 - LD士多卖家后台' }
      },
      {
        path: 'products/new',
        name: 'SellerPublish',
        component: () => import('@/views/Publish.vue'),
        props: { initialMode: 'product', lockedMode: true },
        meta: { title: '发布物品 - LD士多卖家后台', requiresSelling: true }
      },
      {
        path: 'products/:id/edit',
        name: 'SellerEdit',
        component: () => import('@/views/Edit.vue'),
        meta: { title: '编辑物品 - LD士多卖家后台', requiresSelling: true }
      },
      {
        path: 'coupons',
        name: 'SellerCoupons',
        component: () => import('@/views/CouponManage.vue'),
        meta: { title: '优惠券管理 - LD士多卖家后台' }
      },
      {
        path: 'services',
        name: 'SellerServices',
        component: () => import('@/views/MerchantServices.vue'),
        meta: { title: '推广 - LD士多卖家后台' }
      },
      {
        path: 'store',
        name: 'SellerStore',
        component: () => import('@/views/MyShop.vue'),
        meta: { title: '小店管理 - LD士多卖家后台' }
      },
      {
        path: 'notifications',
        name: 'SellerNotifications',
        component: () => import('@/views/SellerNotifications.vue'),
        meta: { title: '通知设置 - LD士多卖家后台' }
      },
      {
        path: 'payment',
        name: 'SellerPayment',
        component: () => import('@/views/Settings.vue'),
        meta: { title: '收款设置 - LD士多卖家后台' }
      }
    ]
  },
  {
    path: '/maintenance',
    name: 'Maintenance',
    component: () => import('@/views/Maintenance.vue'),
    meta: { title: '系统维护中 - LD士多' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '页面未找到 - LD士多' }
  }
]

// 需要保持滚动位置的页面
const keepScrollRoutes = ['Home', 'Category']

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (to.meta?.layout === 'seller') return false
    // 如果是返回操作且有保存的位置，恢复滚动位置
    if (savedPosition) {
      return new Promise((resolve) => {
        // 延迟恢复，确保页面内容已渲染
        setTimeout(() => {
          resolve(savedPosition)
        }, 100)
      })
    }
    // 从详情页返回到列表页时，不滚动
    if (keepScrollRoutes.includes(to.name) && 
        (from.name === 'ProductDetail' || from.name === 'ShopDetail')) {
      return false
    }
    // 其他情况滚动到顶部
    return { left: 0, top: 0 }
  }
})

function enforceCurrentMaintenanceRoute() {
  const currentRoute = router.currentRoute.value
  if (!currentRoute?.name) return

  const redirect = resolveMaintenanceRedirect(currentRoute.name, MAINTENANCE_STATE.mode)
  if (!redirect) return

  const target = router.resolve(redirect)
  if (target.fullPath === currentRoute.fullPath) return
  router.replace(redirect).catch(() => {})
}

function refreshMaintenanceStatus() {
  startBackgroundMaintenanceRefresh(
    () => ensureMaintenanceStatusLoaded(),
    enforceCurrentMaintenanceRoute
  )
}

// 路由守卫
router.beforeEach(async (to) => {
  if (to.name === 'Orders' && String(to.query.tab || '').toLowerCase() === 'seller') {
    const query = { ...to.query }
    delete query.tab
    return { name: 'SellerOrders', query: { ...query, source: 'product' }, replace: true }
  }

  if (to.name === 'OrderDetail' && String(to.query.role || '').toLowerCase() === 'seller') {
    const query = { ...to.query, source: 'product' }
    delete query.role
    return { name: 'SellerOrderDetail', params: { id: to.params.id }, query, replace: true }
  }

  // 导航只使用当前缓存状态做同步判定；缓存刷新在后台进行，避免网络请求阻塞 URL 更新。
  // 本地强制维护会在 ensureMaintenanceStatusLoaded() 调用时同步写入状态，因此仍能即时拦截。
  refreshMaintenanceStatus()

  const routeName = String(to.name || '')
  const maintenanceRedirect = resolveMaintenanceRedirect(routeName, MAINTENANCE_STATE.mode)
  if (maintenanceRedirect) return maintenanceRedirect

  // 更新页面标题
  if (routeName === 'Maintenance') {
    document.title = MAINTENANCE_STATE.title
  } else if (to.meta.title) {
    document.title = to.meta.title
  }

  if (to.meta.guestOnly) {
    const userStore = useUserStore()
    userStore.restoreSession()
    const guestOnlyRedirect = resolveGuestOnlyRedirect(to, userStore.ensureValidSession())
    if (guestOnlyRedirect) return guestOnlyRedirect
  }

  // 检查是否需要登录
  if (to.meta.requiresAuth) {
    const userStore = useUserStore()
    const hadStoredToken = !!storage.get('token')

    userStore.restoreSession()

    // 如果用户未登录，跳转到登录页
    if (!userStore.ensureValidSession()) {
      const query = { redirect: to.fullPath }
      if (hadStoredToken) {
        query.reason = 'expired'
      }

      return {
        name: 'Login',
        query
      }
    }

    if (to.meta.requiresSelling) {
      const enforcementStore = useMerchantEnforcementStore()
      await enforcementStore.refresh({ force: true })
      if (enforcementStore.sellingDisabled) {
        return {
          name: 'SellerProducts',
          query: { sellingDisabled: '1' },
          replace: true
        }
      }
    }
  }

  return true
})

export default router
