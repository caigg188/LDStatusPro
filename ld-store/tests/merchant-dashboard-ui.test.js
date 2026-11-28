import { describe, expect, it } from 'vitest'
import { buildUserDropdownMenuGroups } from '../src/config/userMenu'
import {
  buildMerchantBrief,
  formatChangeRate,
  sortMerchantTasks,
  sortTrendRowsNewestFirst
} from '../src/utils/merchantDashboard'
import {
  isSellerNavigationItemActive,
  resolveAppViewKey,
  resolveLegacyPublishTarget,
  resolveOrderArea,
  resolveSellerViewKey
} from '../src/utils/sellerNavigation'
import {
  buildSellerProductPrice,
  buildSellerOrderQuery,
  buildSellerOrderTabQuery,
  createLatestRequestGuard,
  filterAndSortSellerProducts,
  isSellerOrderTabQueryMatch,
  paginateSellerRows,
  resolveSellerStatusTone
} from '../src/utils/sellerTables'

describe('买卖功能分区', () => {
  it('右上角菜单保持分组，我的物品位于第二组我的订单上方', () => {
    const groups = buildUserDropdownMenuGroups({
      messageUnread: 3,
      sellerPendingDeliveryCount: 7,
      sellerRefundPendingCount: 2
    })
    expect(groups.map(group => group.map(item => item.label))).toEqual([
      ['我的消息', '收藏与拉黑'],
      ['我的物品', '我的订单', '我的优惠券', '我的举报', '我的求购'],
      ['士多图床'],
      ['卖家后台']
    ])
    expect(groups[1][0]).toMatchObject({ path: '/seller/products', badge: '', withUnread: false })
    expect(groups[1][1]).toMatchObject({ path: '/user/orders', badge: '' })
    expect(groups.flat().some(item => item.path === '/user/report-decisions')).toBe(false)
    expect(groups[3][0].badge).toBe('9')
  })

  it('旧发布入口按类型分流且保留筛选参数', () => {
    expect(resolveLegacyPublishTarget({ type: 'buy', from: 'home' })).toEqual({
      name: 'BuyRequestPublish', query: { from: 'home' }
    })
    expect(resolveLegacyPublishTarget({ from: 'home' })).toEqual({
      name: 'SellerPublish', query: { from: 'home' }
    })
  })

  it('买家订单不产生卖家身份，卖家订单区分两类来源', () => {
    expect(resolveOrderArea({ tab: 'seller' }, false)).toBe('buyer')
    expect(resolveOrderArea({ tab: 'buy' }, false)).toBe('buy')
    expect(resolveOrderArea({ source: 'product' }, true)).toBe('seller')
    expect(resolveOrderArea({ source: 'service' }, true)).toBe('buy')
  })
})

describe('卖家后台稳定壳层与列表工具', () => {
  it('所有卖家子路由共用固定壳层 key，查询参数不改变内层 key', () => {
    expect(resolveAppViewKey({ path: '/seller/orders', meta: { layout: 'seller' } })).toBe('seller-layout')
    expect(resolveAppViewKey({ path: '/seller/products', meta: { layout: 'seller' } })).toBe('seller-layout')
    expect(resolveSellerViewKey({ name: 'SellerOrders', fullPath: '/seller/orders?page=1' })).toBe('SellerOrders')
    expect(resolveSellerViewKey({ name: 'SellerOrders', fullPath: '/seller/orders?page=2' })).toBe('SellerOrders')
  })

  it('帮助中心子文章共用稳定壳层 key，切换文章时不卸载整页', () => {
    expect(resolveAppViewKey({ name: 'Docs', path: '/docs' })).toBe('docs-help-center')
    expect(resolveAppViewKey({ name: 'DocsSection', path: '/docs/buy-guide' })).toBe('docs-help-center')
    expect(resolveAppViewKey({ name: 'DocsSection', path: '/docs/payment-settings' })).toBe('docs-help-center')
  })

  it('退款售后保持独立卖家页面 key，订单详情仍复用订单详情页', () => {
    expect(resolveAppViewKey({ name: 'SellerRefunds', path: '/seller/refunds', meta: { layout: 'seller' } })).toBe('seller-layout')
    expect(resolveSellerViewKey({ name: 'SellerRefunds', path: '/seller/refunds' })).toBe('SellerRefunds')
  })

  it('商品导航把发布和编辑都归到我的物品', () => {
    const productsItem = {
      to: '/seller/products',
      activeRouteNames: ['SellerProducts', 'SellerEdit', 'SellerPublish']
    }

    expect(isSellerNavigationItemActive({ name: 'SellerProducts', path: '/seller/products' }, productsItem)).toBe(true)
    expect(isSellerNavigationItemActive({ name: 'SellerPublish', path: '/seller/products/new' }, productsItem)).toBe(true)
    expect(isSellerNavigationItemActive({ name: 'SellerEdit', path: '/seller/products/12/edit' }, productsItem)).toBe(true)
  })

  it('卖家订单分页参数按商品与求购服务来源正确构造', () => {
    expect(buildSellerOrderQuery({
      page: '3', source: 'product', search: ' LD-10 ', status: 'paid', categoryId: 8, dealOnly: true
    })).toEqual({
      page: 3, pageSize: 20, search: 'LD-10', timeRange: '1m', categoryId: 8, dealOnly: true, status: 'paid'
    })
    expect(buildSellerOrderQuery({ page: 2, source: 'service', status: 'paid', categoryId: 8 })).toEqual({
      page: 2, pageSize: 20, search: '', timeRange: '1m', role: 'provider'
    })
  })

  it('快速切换订单来源与状态时只保留最后一次路由意图', () => {
    const serviceQuery = buildSellerOrderTabQuery({
      source: 'product', status: 'paid', categoryId: '8', dealOnly: '1', page: '3', search: 'LD'
    }, { source: 'service', status: 'delivered' })
    expect(serviceQuery).toEqual({ source: 'service', search: 'LD' })
    expect(isSellerOrderTabQueryMatch(serviceQuery, { source: 'service', status: '' })).toBe(true)

    const deliveredQuery = buildSellerOrderTabQuery(serviceQuery, {
      source: 'product', status: 'delivered'
    })
    expect(deliveredQuery).toEqual({ source: 'product', status: 'delivered', search: 'LD' })
    expect(isSellerOrderTabQueryMatch(deliveredQuery, { source: 'product', status: 'paid' })).toBe(false)
  })

  it('并行订单请求只允许最后一次结果更新列表', () => {
    const guard = createLatestRequestGuard()
    const first = guard.begin()
    const latest = guard.begin()
    expect(guard.isLatest(first)).toBe(false)
    expect(guard.isLatest(latest)).toBe(true)
    guard.invalidate()
    expect(guard.isLatest(latest)).toBe(false)
  })

  it('物品搜索、库存筛选、排序与分页保持确定性', () => {
    const products = [
      { id: 1, name: 'Alpha', stock: 3, price: 10, status: 'active', product_type: 'normal', view_count: 2 },
      { id: 2, name: 'Beta', stock: 9, price: 30, status: 'active', product_type: 'normal', view_count: 12 },
      { id: 3, name: 'Gamma', stock: 0, price: 20, status: 'offline', product_type: 'normal', view_count: 4 }
    ]
    const lowStock = filterAndSortSellerProducts(products, { stock: 'low', sort: 'price-desc' })
    expect(lowStock.map(product => product.id)).toEqual([1])
    expect(filterAndSortSellerProducts(products, { search: '2', sort: 'views' }).map(product => product.id)).toEqual([2])
    expect(paginateSellerRows(products, 2, 2)).toMatchObject({ page: 2, total: 3, totalPages: 2, rows: [products[2]] })
  })

  it('状态映射同时包含文字语义所需的稳定色调', () => {
    expect(resolveSellerStatusTone('pending_review')).toBe('warning')
    expect(resolveSellerStatusTone('rejected')).toBe('danger')
    expect(resolveSellerStatusTone('completed')).toBe('success')
    expect(resolveSellerStatusTone('offline')).toBe('neutral')
    expect(resolveSellerStatusTone('ai_approved')).toBe('success')
    expect(resolveSellerStatusTone('manual_approved')).toBe('success')
    expect(resolveSellerStatusTone('offline_manual')).toBe('neutral')
  })

  it('物品价格同时保留原价、折后价与折扣标签', () => {
    expect(buildSellerProductPrice({ price: 100, discount: 0.85 })).toEqual({
      original: 100,
      current: 85,
      discount: 0.85,
      hasDiscount: true,
      discountLabel: '8.5折'
    })
    expect(buildSellerProductPrice({ price: '29.9' })).toMatchObject({
      original: 29.9,
      current: 29.9,
      hasDiscount: false,
      discountLabel: '无折扣'
    })
  })
})

describe('经营概览展示口径', () => {
  it('正确显示零基数变化率', () => {
    expect(formatChangeRate(null)).toBe('上期无数据')
    expect(formatChangeRate(0)).toBe('与上期持平')
    expect(formatChangeRate(12.34)).toContain('+12.3%')
  })

  it('待办先按优先级、再按数量排序', () => {
    const tasks = sortMerchantTasks([
      { type: 'a', priority: 'low', count: 9 },
      { type: 'b', priority: 'high', count: 1 },
      { type: 'c', priority: 'high', count: 4 }
    ])
    expect(tasks.map(task => task.type)).toEqual(['c', 'b', 'a'])
  })

  it('趋势明细按日期从近到远展示且不修改图表原始数据', () => {
    const trend = [
      { date: '2026-08-18', totalRevenue: 18 },
      { date: '2026-08-20', totalRevenue: 20 },
      { date: '2026-08-19', totalRevenue: 19 }
    ]

    expect(sortTrendRowsNewestFirst(trend).map(row => row.date)).toEqual([
      '2026-08-20',
      '2026-08-19',
      '2026-08-18'
    ])
    expect(trend.map(row => row.date)).toEqual(['2026-08-18', '2026-08-20', '2026-08-19'])
  })

  it('无成交时给出确定性建议且不伪造数据', () => {
    const brief = buildMerchantBrief({
      kpis: { orders: { current: 0 }, revenue: { current: 0 } },
      lifetime: { orders: 0 },
      tasks: [],
      businessStatus: { products: { total: 2 } }
    })
    expect(brief.eyebrow).toBe('今日尚无成交')
    expect(brief.summary).toContain('真实零值')
  })
})
