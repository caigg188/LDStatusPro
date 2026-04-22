import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import {
  MAINTENANCE_STATE,
  ensureMaintenanceStatusLoaded,
  isFullMaintenanceMode,
  isRestrictedMaintenanceMode,
} from '@/config/maintenance'
import { storage } from '@/utils/storage'
import HomeView from '@/views/Home.vue'

// 路由配置
const routes = [
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
    meta: { title: '我的收藏 - LD士多', requiresAuth: true }
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
    name: 'MyProducts',
    component: () => import('@/views/MyProducts.vue'),
    meta: { title: '我的商品 - LD士多', requiresAuth: true }
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
    name: 'Settings',
    component: () => import('@/views/Settings.vue'),
    meta: { title: 'LDC收款配置 - LD士多', requiresAuth: true }
  },
  {
    path: '/shop/:id',
    name: 'ShopDetail',
    component: () => import('@/views/ShopDetail.vue'),
    meta: { title: '小店详情 - LD士多' }
  },
  {
    path: '/user/my-shop',
    name: 'MyShop',
    component: () => import('@/views/MyShop.vue'),
    meta: { title: '小店入驻 - LD士多', requiresAuth: true }
  },
  {
    path: '/publish',
    name: 'Publish',
    component: () => import('@/views/Publish.vue'),
    meta: { title: '发布商品 - LD士多', requiresAuth: true }
  },
  {
    path: '/edit/:id',
    name: 'Edit',
    component: () => import('@/views/Edit.vue'),
    meta: { title: '编辑商品 - LD士多', requiresAuth: true }
  },
  {
    path: '/order/:id',
    name: 'OrderDetail',
    component: () => import('@/views/OrderDetail.vue'),
    meta: { title: '订单详情 - LD士多', requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录 - LD士多' }
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
    meta: { title: '使用文档 - LD士多' }
  },
  {
    path: '/docs/:section',
    name: 'DocsSection',
    component: () => import('@/views/Docs.vue'),
    meta: { title: '使用文档 - LD士多' }
  },

  {
    path: '/support',
    name: 'Support',
    component: () => import('@/views/Support.vue'),
    meta: { title: '支持 LDStatus Pro - LD士多' }
  },
  {
    path: '/merchant-services',
    name: 'MerchantServices',
    component: () => import('@/views/MerchantServices.vue'),
    meta: { title: '商家服务 - LD士多', requiresAuth: true }
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
const fullMaintenanceAllowedRoutes = new Set(['Maintenance', 'Login', 'AuthCallback'])
const restrictedMaintenanceAllowedRoutes = new Set([
  'Home',
  'Login',
  'AuthCallback',
  'Orders',
  'MyProducts',
  'OrderDetail',
  'BuyOrderDetail',
])

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
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
    return { top: 0 }
  }
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  await ensureMaintenanceStatusLoaded()

  const routeName = String(to.name || '')

  if (isFullMaintenanceMode()) {
    if (!fullMaintenanceAllowedRoutes.has(routeName)) {
      next({ name: 'Maintenance', replace: true })
      return
    }
  } else if (isRestrictedMaintenanceMode()) {
    if (!restrictedMaintenanceAllowedRoutes.has(routeName)) {
      next({ name: 'Home', replace: true })
      return
    }
  } else if (routeName === 'Maintenance') {
    next({ name: 'Home', replace: true })
    return
  }

  // 更新页面标题
  if (routeName === 'Maintenance') {
    document.title = MAINTENANCE_STATE.title
  } else if (to.meta.title) {
    document.title = to.meta.title
  }

  // 检查是否需要登录
  if (to.meta.requiresAuth) {
    const userStore = useUserStore()
    const hadStoredToken = !!storage.get('token')

    await userStore.restoreSession()

    // 如果用户未登录，跳转到登录页
    if (!userStore.ensureValidSession()) {
      const query = { redirect: to.fullPath }
      if (hadStoredToken) {
        query.reason = 'expired'
      }

      next({
        name: 'Login',
        query
      })
      return
    }
  }

  next()
})

export default router
