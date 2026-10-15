export const HELP_UPDATED_AT = '2026-09-06'

export const HELP_GROUPS = Object.freeze([
  { id: 'start', title: '快速开始' },
  { id: 'buyer', title: '买家使用' },
  { id: 'seller', title: '卖家经营' },
  { id: 'support', title: '工具与支持' }
])

export const HELP_ARTICLES = Object.freeze([
  {
    id: 'quick-start',
    updatedAt: '2026-10-15',
    group: 'start',
    title: '快速开始',
    summary: '按你现在要完成的任务，快速进入购买、卖家经营或问题处理路线。',
    audience: ['所有用户'],
    keywords: ['入门', '新手', '登录', '购买', '卖家', '开店', '帮助'],
    icon: 'Compass',
    loader: () => import('@/components/docs/DocQuickStart.vue'),
    related: ['concepts', 'buy-guide', 'seller-center']
  },
  {
    id: 'concepts',
    group: 'start',
    title: '认识 LD 士多',
    summary: '了解 LDC、买家与卖家身份，以及物品广场、求购广场和小店集市。',
    audience: ['新用户'],
    keywords: ['LDC', '积分', '买家', '卖家', '物品广场', '求购广场', '小店集市', '订单状态'],
    icon: 'Map',
    loader: () => import('@/components/docs/DocConcepts.vue'),
    related: ['product-types', 'buy-guide', 'seller-center']
  },
  {
    id: 'product-types',
    group: 'start',
    title: '选择物品与卡密类型',
    summary: '对比普通物品、独立卡密和共享卡密的库存、发货与适用场景。',
    audience: ['买家', '卖家'],
    keywords: ['普通物品', '自动发卡', 'CDK', '独立卡密', '共享卡密', '共享库存', '9999', '发货'],
    icon: 'PackageSearch',
    loader: () => import('@/components/docs/DocProductTypes.vue'),
    related: ['publish-product', 'inventory-management', 'buy-guide']
  },
  {
    id: 'buy-guide',
    updatedAt: '2026-10-15',
    group: 'buyer',
    title: '购买物品与查看订单',
    summary: '从浏览筛选到支付、收货、联系卖家和查看订单动态。',
    audience: ['买家'],
    keywords: ['购买', '兑换', '支付', '订单', '普通物品', '自动发卡', 'CDK', '联系卖家', '发货'],
    icon: 'ShoppingBag',
    loader: () => import('@/components/docs/DocBuyGuide.vue'),
    related: ['refunds', 'buyer-coupons', 'product-types']
  },
  {
    id: 'refunds',
    updatedAt: '2026-10-15',
    group: 'buyer',
    title: '退款、协商与争议',
    summary: '7 天在线申请窗口、72 小时响应、平台内部复核与 Credit 争议路径。',
    audience: ['买家', '卖家'],
    keywords: ['退款', '售后', '全额退款', '联系卖家', '拒绝退款', '退款异常', '退款争议', 'Credit 争议', '订单争议'],
    icon: 'RotateCcw',
    loader: () => import('@/components/docs/DocRefunds.vue'),
    related: ['buy-guide', 'seller-orders', 'account-safety']
  },
  {
    id: 'shipping-deadline',
    updatedAt: '2026-10-15',
    group: 'buyer',
    title: '发货时限与超时退款',
    summary: '普通物品 48 小时下架、72 小时自动退款，以及超时计次和异常处理规则。',
    audience: ['买家', '卖家'],
    keywords: ['72小时', '48小时', '发货截止', '自动退款', '未发货', '卖家限制', '超时记录', '主动退款'],
    icon: 'TimerReset',
    loader: () => import('@/components/docs/DocShippingDeadline.vue'),
    related: ['seller-orders', 'refunds', 'buy-guide']
  },
  {
    id: 'collections-blocks',
    group: 'buyer',
    title: '收藏与不感兴趣',
    summary: '收藏想稍后查看的物品，隐藏不感兴趣的物品，并随时恢复展示。',
    audience: ['买家'],
    keywords: ['收藏', '拉黑', '不感兴趣', '隐藏物品', '恢复展示', '取消拉黑', '屏蔽商品'],
    icon: 'EyeOff',
    loader: () => import('@/components/docs/DocCollectionsBlocks.vue'),
    related: ['buy-guide', 'account-safety', 'faq']
  },
  {
    id: 'buyer-coupons',
    group: 'buyer',
    title: '领取和使用优惠券',
    summary: '看懂商品券、店铺券、减额券、折扣券以及订单占用状态。',
    audience: ['买家'],
    keywords: ['优惠券', '商品券', '店铺券', '领取链接', '满减', '折扣', '占用', '释放', '一单一券'],
    icon: 'TicketPercent',
    loader: () => import('@/components/docs/DocBuyerCoupons.vue'),
    related: ['buy-guide', 'seller-coupons', 'faq']
  },
  {
    id: 'buy-request',
    group: 'buyer',
    title: '发布求购与洽谈',
    summary: '发布需求、保护身份、在线洽谈、支付并在完成后联系服务方。',
    audience: ['求购方', '服务方'],
    keywords: ['求购', '洽谈', '服务方', '求购订单', '公开身份', '联系方式', '调价', '消息'],
    icon: 'MessagesSquare',
    loader: () => import('@/components/docs/DocBuyRequest.vue'),
    related: ['account-safety', 'buy-guide', 'seller-orders']
  },
  {
    id: 'account-safety',
    group: 'buyer',
    title: '账号功能与交易保障',
    summary: '管理收藏与拉黑、消息、评论和举报，并在发生纠纷时保留记录。',
    audience: ['所有用户'],
    keywords: ['个人中心', '收藏', '拉黑', '不感兴趣', '评论', '回复', '评分', '消息', '举报', '纠纷', '争议', '安全'],
    icon: 'ShieldCheck',
    loader: () => import('@/components/docs/DocAccountSafety.vue'),
    related: ['collections-blocks', 'buy-request', 'faq']
  },
  {
    id: 'seller-center',
    group: 'seller',
    title: '卖家后台与经营概览',
    summary: '使用独立卖家后台查看收入、订单、买家、浏览、待办和经营状态。',
    audience: ['卖家'],
    keywords: ['卖家后台', '经营概览', '收入', '订单', '买家', '浏览', '待办', '开店', '经营状态'],
    icon: 'LayoutDashboard',
    loader: () => import('@/components/docs/DocSellerCenter.vue'),
    related: ['payment-settings', 'publish-product', 'seller-orders']
  },
  {
    id: 'seller-notifications',
    group: 'seller',
    title: '配置通知',
    summary: '绑定 Telegram 卖家工作台，查询经营信息、处理退款与商品下架，并接收重要提醒。',
    audience: ['卖家'],
    keywords: ['Telegram', 'TG', '机器人', '卖家工作台', '绑定', '通知设置', '消息延迟', '退款处理', '商品下架', '经营概览', '暂停通知', '解除绑定'],
    icon: 'BellRing',
    loader: () => import('@/components/docs/DocSellerNotifications.vue'),
    related: ['seller-center', 'seller-orders', 'shipping-deadline']
  },
  {
    id: 'publish-product',
    group: 'seller',
    title: '发布物品与通过审核',
    summary: '完成收款准备、填写物品资料、选择交付方式并提交审核。',
    audience: ['卖家'],
    keywords: ['发布物品', '普通物品', '自动发卡', 'CDK', '图片', '价格', '折扣', '库存', '测试模式', '审核'],
    icon: 'PackagePlus',
    loader: () => import('@/components/docs/DocPublishProduct.vue'),
    related: ['payment-settings', 'product-types', 'inventory-management']
  },
  {
    id: 'inventory-management',
    group: 'seller',
    title: '管理物品与卡密库存',
    summary: '筛选和编辑物品，管理独立卡密库存，并安全切换共享卡密模式。',
    audience: ['卖家'],
    keywords: ['我的物品', '库存', '低库存', '售罄', '独立卡密', '共享卡密', '共享库存', '切换模式', '补货', '导出'],
    icon: 'Boxes',
    loader: () => import('@/components/docs/DocInventoryManagement.vue'),
    related: ['product-types', 'publish-product', 'seller-orders']
  },
  {
    id: 'seller-orders',
    group: 'seller',
    title: '处理卖家订单与发货',
    summary: '区分商品订单和求购服务，筛选待处理订单并完成手动履约。',
    audience: ['卖家', '服务方'],
    keywords: ['卖家订单', '商品订单', '求购服务', '待发货', '手动发货', '自动发货', '订单搜索', '买家', '提醒'],
    icon: 'ClipboardCheck',
    loader: () => import('@/components/docs/DocSellerOrders.vue'),
    related: ['refunds', 'seller-center', 'inventory-management']
  },
  {
    id: 'seller-coupons',
    group: 'seller',
    title: '创建和管理优惠券',
    summary: '设置券的范围、优惠、门槛、数量和有效期，并分享领取链接。',
    audience: ['卖家'],
    keywords: ['优惠券管理', '创建优惠券', '商品券', '店铺券', '固定减额', '单件折扣', '发行量', '领取链接', '核销', '让利'],
    icon: 'BadgePercent',
    loader: () => import('@/components/docs/DocSellerCoupons.vue'),
    related: ['buyer-coupons', 'seller-center', 'seller-growth']
  },
  {
    id: 'seller-growth',
    group: 'seller',
    title: '小店与推广服务',
    summary: '管理小店资料，并使用士多甄选、士多优选提升物品曝光。',
    audience: ['卖家'],
    keywords: ['小店', '小店入驻', '小店管理', '商家服务', '士多甄选', '士多优选', '置顶', '名额', '分类', '推广'],
    icon: 'Store',
    loader: () => import('@/components/docs/DocSellerGrowth.vue'),
    related: ['seller-center', 'publish-product', 'seller-coupons']
  },
  {
    id: 'payment-settings',
    group: 'seller',
    title: '配置 LDC 收款',
    summary: '创建 LDC 应用、保存收款凭证、复制通知与回调地址并完成测试。',
    audience: ['卖家'],
    keywords: ['收款配置', 'Client ID', 'Client Key', 'PID', '通知地址', '通知 URL', '回调地址', '回调 URL', '测试通知', 'LDC 应用'],
    icon: 'CreditCard',
    loader: () => import('@/components/docs/DocPaymentSettings.vue'),
    related: ['seller-center', 'publish-product', 'faq']
  },
  {
    id: 'image-host',
    group: 'support',
    title: '使用士多图床',
    summary: '上传物品图片、复制链接、查看历史记录并管理已上传图片。',
    audience: ['所有用户'],
    keywords: ['士多图床', '图片上传', '图片链接', 'Markdown', '上传历史', '删除图片', '图片大小', '物品图片'],
    icon: 'Image',
    loader: () => import('@/components/docs/DocImageHost.vue'),
    related: ['publish-product', 'account-safety', 'faq']
  },
  {
    id: 'faq',
    group: 'support',
    title: '常见问题与排查',
    summary: '按支付、发货、优惠券、库存、审核和收款问题快速排查。',
    audience: ['所有用户'],
    keywords: ['FAQ', '常见问题', '支付失败', '没有发货', '优惠券不可用', '审核失败', '库存异常', '联系管理员'],
    icon: 'CircleHelp',
    loader: () => import('@/components/docs/DocFaq.vue'),
    related: ['refunds', 'buy-guide', 'payment-settings']
  },
  {
    id: 'terms',
    updatedAt: '2026-10-15',
    group: 'support',
    title: '服务条款',
    summary: '了解平台性质、用户责任、禁止行为、风险与争议处理规则。',
    audience: ['所有用户'],
    keywords: ['服务条款', '平台规则', '禁止发布', '免责声明', '隐私', '争议', '违规'],
    icon: 'ScrollText',
    loader: () => import('@/components/docs/DocTerms.vue'),
    related: ['account-safety', 'faq', 'concepts']
  }
])

export const HELP_SEARCH_ENTRIES = Object.freeze([
  { articleId: 'refunds', anchor: 'application-window', title: '7 天申请窗口与后续售后', keywords: ['七天', '超过7天', '七天后', '退款申请期限', '卡密无效'] },
  { articleId: 'seller-notifications', anchor: 'connect-telegram', title: '绑定 Telegram 机器人接收通知', keywords: ['TG绑定', '连接机器人', 'Start', '通知设置'] },
  { articleId: 'seller-notifications', anchor: 'workspace', title: '用 Telegram 处理退款和下架商品', keywords: ['卖家工作台', '同意退款', '拒绝退款', '商品搜索', '商品下架', '经营概览'] },
  { articleId: 'seller-notifications', anchor: 'not-received', title: 'Telegram 机器人没有响应怎么排查', keywords: ['机器人没响应', '消息延迟', '屏蔽机器人', '已暂停', '渠道异常', 'menu'] },
  { articleId: 'shipping-deadline', anchor: 'timeline', title: '普通物品 48 与 72 小时规则', keywords: ['未发货自动退款', '物品下架', '发货倒计时'] },
  { articleId: 'shipping-deadline', anchor: 'seller-restriction', title: '3 笔超时退款与 7 天卖家限制', keywords: ['封禁卖家', '168小时', '申诉撤销'] },
  { articleId: 'shipping-deadline', anchor: 'refund-results', title: '自动退款失败或待核对怎么办', keywords: ['余额不足', '结果未知', 'credit处理'] },
  { articleId: 'collections-blocks', anchor: 'block-product', title: '将物品标记为不感兴趣', keywords: ['拉黑商品', '隐藏商品', '屏蔽物品', '二次确认'] },
  { articleId: 'collections-blocks', anchor: 'restore-product', title: '恢复已隐藏的物品', keywords: ['取消拉黑', '恢复展示', '找回商品'] },
  { articleId: 'product-types', anchor: 'independent-cdk', title: '独立卡密如何发货', keywords: ['独立库存', '一单一码', '卡密库存'] },
  { articleId: 'product-types', anchor: 'shared-cdk', title: '共享卡密与共享库存', keywords: ['同一个卡密', '无限库存', '库存9999', '共享CDK'] },
  { articleId: 'inventory-management', anchor: 'switch-cdk-mode', title: '切换独立卡密与共享卡密', keywords: ['迁移卡密', '暂停库存', '恢复库存', '重新审核'] },
  { articleId: 'buyer-coupons', anchor: 'coupon-reservation', title: '优惠券被订单占用与自动释放', keywords: ['订单占用中', '取消释放', '过期释放', 'reserved'] },
  { articleId: 'buyer-coupons', anchor: 'coupon-rules', title: '多件购买时优惠券如何计算', keywords: ['一单一券', '只优惠一件', '减额一次'] },
  { articleId: 'seller-coupons', anchor: 'coupon-types', title: '商品券、店铺券与两种优惠方式', keywords: ['固定减额', '单件折扣', '店铺范围'] },
  { articleId: 'seller-coupons', anchor: 'manage-campaign', title: '查看领取、占用、核销和累计让利', keywords: ['增加发行量', '暂停领取', '恢复领取', '领完'] },
  { articleId: 'seller-center', anchor: 'dashboard', title: '查看卖家经营概览与待办', keywords: ['实收积分', '成交订单', '服务买家', '物品浏览'] },
  { articleId: 'seller-orders', anchor: 'pending-delivery', title: '处理待发货订单', keywords: ['卖家提醒', '普通物品发货', '补发CDK'] },
  { articleId: 'payment-settings', anchor: 'callback-urls', title: '配置通知地址和回调地址', keywords: ['notify', 'return url', '自动发货失败'] },
  { articleId: 'payment-settings', anchor: 'test-payment', title: '测试 LDC 收款通知', keywords: ['验证凭证', '测试回调', 'Client Key'] },
  { articleId: 'buy-request', anchor: 'buy-request-order', title: '求购订单支付与联系方式解锁', keywords: ['求购订单', '刷新状态', '服务方', '私信入口'] },
  { articleId: 'buy-guide', anchor: 'order-status', title: '查看购买订单状态', keywords: ['待支付', '支付中', '待发货', '已发货', '已完成'] },
  { articleId: 'refunds', anchor: 'buyer-request', title: '买家申请订单全额退款', keywords: ['申请退款', '退LDC', '联系卖家', '售后申请'] },
  { articleId: 'refunds', anchor: 'seller-handle', title: '卖家处理退款待办', keywords: ['卖家退款', '同意退款', '拒绝退款', '协商中'] },
  { articleId: 'refunds', anchor: 'credit-dispute', title: '平台内部复核与 Credit 争议', keywords: ['credit争议', '交易争议', '卖家拒绝', '平台介入', '管理员复核', '拒绝退款', '内部复核'] },
  { articleId: 'refunds', anchor: 'refund-exceptions', title: '退款执行失败或结果待核实', keywords: ['退款失败', '结果待核实', '不要重复退款', '退款异常'] },
  { articleId: 'seller-growth', anchor: 'promotion-services', title: '士多甄选和士多优选', keywords: ['推广名额', '置顶服务', '分类绑定'] },
  { articleId: 'image-host', anchor: 'upload-image', title: '上传物品图片并复制链接', keywords: ['图片地址', 'HTTPS图片', '图床历史'] }
])

export const HELP_LEGACY_ALIASES = Object.freeze({
  'quick-start': { name: 'Docs', hash: '' },
  'publish-link': { name: 'DocsSection', params: { section: 'publish-product' }, hash: '#normal-product' },
  'publish-cdk': { name: 'DocsSection', params: { section: 'publish-product' }, hash: '#auto-delivery' },
  'shop-register': { name: 'DocsSection', params: { section: 'seller-growth' }, hash: '#shop-management' }
})

const articleMap = new Map(HELP_ARTICLES.map(article => [article.id, article]))

export function getHelpArticle(id) {
  return articleMap.get(id) || null
}

export function getHelpArticlesByGroup(groupId) {
  return HELP_ARTICLES.filter(article => article.group === groupId)
}

export function resolveLegacyHelpLocation(section, query = {}) {
  const target = HELP_LEGACY_ALIASES[String(section || '')]
  return target ? { ...target, query, replace: true } : null
}

export function resolveHelpArticleId(section) {
  const normalized = String(section || '').trim()
  if (!normalized || normalized === 'quick-start') return 'quick-start'
  return articleMap.has(normalized) ? normalized : 'quick-start'
}

export function getHelpPath(articleId) {
  return articleId === 'quick-start' ? '/docs' : `/docs/${articleId}`
}

export function normalizeHelpQuery(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s_/|·，。！？、：:（）()【】-]+/g, '')
}

function scoreText(text, normalizedQuery, exactScore, includeScore) {
  const normalized = normalizeHelpQuery(text)
  if (!normalized) return 0
  if (normalized === normalizedQuery) return exactScore
  if (normalized.includes(normalizedQuery)) return includeScore
  if (normalizedQuery.includes(normalized) && normalized.length >= 2) return Math.floor(includeScore * 0.7)
  return 0
}

export function searchHelpCenter(query, limit = 8) {
  const normalizedQuery = normalizeHelpQuery(query)
  if (!normalizedQuery) return []

  const results = []
  for (const article of HELP_ARTICLES) {
    const titleScore = scoreText(article.title, normalizedQuery, 140, 105)
    const keywordScore = Math.max(0, ...article.keywords.map(keyword => scoreText(keyword, normalizedQuery, 125, 92)))
    const summaryScore = scoreText(article.summary, normalizedQuery, 70, 48)
    const score = Math.max(titleScore, keywordScore, summaryScore)
    if (score > 0) {
      results.push({
        key: `article:${article.id}`,
        articleId: article.id,
        articleTitle: article.title,
        title: article.title,
        summary: article.summary,
        path: getHelpPath(article.id),
        score,
        kind: 'article'
      })
    }
  }

  for (const entry of HELP_SEARCH_ENTRIES) {
    const article = articleMap.get(entry.articleId)
    if (!article) continue
    const titleScore = scoreText(entry.title, normalizedQuery, 160, 120)
    const keywordScore = Math.max(0, ...entry.keywords.map(keyword => scoreText(keyword, normalizedQuery, 150, 112)))
    const score = Math.max(titleScore, keywordScore)
    if (score > 0) {
      results.push({
        key: `section:${entry.articleId}:${entry.anchor}`,
        articleId: entry.articleId,
        articleTitle: article.title,
        title: entry.title,
        summary: article.summary,
        path: `${getHelpPath(entry.articleId)}#${entry.anchor}`,
        score: score + 10,
        kind: 'section'
      })
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'zh-CN'))
    .slice(0, Math.max(1, Number(limit) || 8))
}
