import {
  ClipboardList,
  ClipboardPenLine,
  Flag,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Package,
  Store,
  TicketPercent
} from '@lucide/vue'

export function buildUserDropdownMenuGroups({
  messageUnread = 0,
  sellerPendingDeliveryCount = 0,
  sellerRefundPendingCount = 0
} = {}) {
  const unread = Number(messageUnread || 0)
  const pending = Number(sellerPendingDeliveryCount || 0)
  const refunds = Number(sellerRefundPendingCount || 0)
  const badge = value => value > 99 ? '99+' : String(value || '')
  const item = (path, iconComponent, label, count = 0) => ({
    path,
    iconComponent,
    label,
    withUnread: count > 0,
    badge: count > 0 ? badge(count) : ''
  })

  return [
    [
      item('/user/messages', MessageCircle, '我的消息', unread),
      item('/user/favorites', Heart, '收藏与拉黑')
    ],
    [
      item('/seller/products', Package, '我的物品'),
      item('/user/orders', ClipboardList, '我的订单'),
      item('/user/coupons', TicketPercent, '我的优惠券'),
      item('/user/reports', Flag, '我的举报'),
      item('/user/buy-requests', ClipboardPenLine, '我的求购')
    ],
    [item('/ld-image', ImageIcon, '士多图床')],
    [item('/seller', Store, '卖家后台', pending + refunds)]
  ]
}
