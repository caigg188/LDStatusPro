/**
 * 格式化工具函数
 */

/**
 * 格式化价格
 * @param {number} price - 价格
 * @param {number} decimals - 小数位数
 * @returns {string}
 */
export function formatPrice(price, decimals = 2) {
  const num = parseFloat(price) || 0
  return num.toFixed(decimals)
}

/**
 * 格式化相对时间
 * @param {number|string|Date} timestamp - 时间戳或日期
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return ''

  const date = normalizeTimestampMs(timestamp)
  if (!Number.isFinite(date)) return ''
  const now = Date.now()
  const diff = Math.max(0, now - date)
  
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day
  const month = 30 * day
  const year = 365 * day
  
  if (diff < minute) {
    return '刚刚'
  } else if (diff < hour) {
    const minutes = Math.floor(diff / minute)
    return `${minutes}分钟前`
  } else if (diff < day) {
    const hours = Math.floor(diff / hour)
    return `${hours}小时前`
  } else if (diff < week) {
    const days = Math.floor(diff / day)
    return `${days}天前`
  } else if (diff < month) {
    const weeks = Math.floor(diff / week)
    return `${weeks}周前`
  } else if (diff < year) {
    const months = Math.floor(diff / month)
    return `${months}个月前`
  } else {
    return formatDate(date)
  }
}

/**
 * 格式化日期
 * @param {number|string|Date} timestamp - 时间戳或日期
 * @param {string} format - 格式化模板
 * @returns {string}
 */
export function formatDate(timestamp, format = 'YYYY-MM-DD') {
  if (!timestamp) return ''

  const timestampMs = normalizeTimestampMs(timestamp)
  if (!Number.isFinite(timestampMs)) return ''

  const date = new Date(timestampMs + 8 * 60 * 60 * 1000)

  if (isNaN(date.getTime())) return ''

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

/**
 * 格式化日期时间
 * @param {number|string|Date} timestamp - 时间戳或日期
 * @returns {string}
 */
export function formatDateTime(timestamp) {
  return formatDate(timestamp, 'YYYY-MM-DD HH:mm')
}

/**
 * 将秒/毫秒时间戳、Date 或日期字符串统一转换为毫秒时间戳。
 * @param {number|string|Date} timestamp - 时间戳或日期
 * @returns {number}
 */
const NAIVE_DATE_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/
const HAS_EXPLICIT_ZONE = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/

export function normalizeTimestampMs(timestamp) {
  if (timestamp instanceof Date) return timestamp.getTime()

  if (typeof timestamp === 'number') {
    if (!Number.isFinite(timestamp)) return Number.NaN
    return timestamp > 0 && timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp
  }

  const text = String(timestamp || '').trim()
  if (!text) return Number.NaN
  if (/^\d{10}(?:\d{3})?$/.test(text)) {
    const numeric = Number(text)
    return text.length === 10 ? numeric * 1000 : numeric
  }

  if (HAS_EXPLICIT_ZONE.test(text)) {
    const withT = text.includes('T') ? text : text.replace(' ', 'T')
    const zoned = withT.replace(/([+-])(\d{2})$/, '$1$2:00').replace(/([+-])(\d{2})(\d{2})$/, '$1$2:$3')
    const ms = Date.parse(zoned)
    return Number.isFinite(ms) ? ms : Number.NaN
  }

  const naive = text.match(NAIVE_DATE_TIME)
  if (naive) {
    const time = naive[2].length === 5 ? `${naive[2]}:00` : naive[2]
    return Date.parse(`${naive[1]}T${time}Z`)
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
    return Date.parse(`${text}Z`)
  }

  return new Date(text).getTime()
}

/**
 * 使用北京时间和固定格式显示精确时间，避免浏览器产生斜杠日期或省略秒数。
 * @param {number|string|Date} timestamp - 时间戳或日期
 * @returns {string}
 */
export function formatStandardDateTime(timestamp) {
  if (!timestamp) return ''

  const timestampMs = normalizeTimestampMs(timestamp)
  if (!Number.isFinite(timestampMs)) return ''

  const date = new Date(timestampMs + 8 * 60 * 60 * 1000)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 消息时间同时保留易扫读的相对时间与可核对的精确时间。
 * @param {number|string|Date} timestamp - 时间戳或日期
 * @returns {string}
 */
export function formatMessageTime(timestamp) {
  const relative = formatRelativeTime(timestamp)
  const exact = formatStandardDateTime(timestamp)
  if (relative && exact) return `${relative} · ${exact}`
  return exact || relative || '时间未知'
}

/**
 * 格式化数字（添加千分位）
 * @param {number} num - 数字
 * @returns {string}
 */
export function formatNumber(num) {
  if (typeof num !== 'number') return '0'
  return num.toLocaleString('zh-CN')
}

/**
 * 紧凑格式化非负计数，千位以上使用 k，最多保留一位小数
 * @param {number|string} value - 原始计数
 * @returns {string}
 */
export function formatCompactCount(value) {
  const parsed = Number(value)
  const count = Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0

  if (count < 1000) return String(count)

  const thousands = Math.round(count / 100) / 10
  return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)} k`
}

/**
 * 格式化库存显示
 * @param {number} stock - 库存数量
 * @param {number} available - 可用库存
 * @returns {string}
 */
export function formatStock(stock, available) {
  if (stock === -1) return '9999'
  return `${available}/${stock}`
}

/**
 * 格式化订单状态
 * @param {string} status - 状态码
 * @returns {{ text: string, color: string, icon: string }}
 */
export function formatOrderStatus(status) {
  const statusMap = {
    'pending': { text: '待支付', color: 'warning', icon: '⏳' },
    'paying': { text: '支付中', color: 'info', icon: '💳' },
    'paid': { text: '待发货', color: 'warning', icon: '📦' },
    'delivered': { text: '已发货', color: 'success', icon: '✅' },
    'refunded': { text: '已退款', color: 'info', icon: '↩️' },
    'external_dispute': { text: '已转 Credit 处理', color: 'warning', icon: 'shield-alert' },
    'expired': { text: '已过期', color: 'default', icon: '⌛' },
    'cancelled': { text: '已取消', color: 'danger', icon: '❌' }
  }
  
  return statusMap[status] || { text: status, color: 'default', icon: '📋' }
}

/**
 * 格式化商品状态
 * @param {string} status - 状态码
 * @returns {{ text: string, color: string }}
 */
export function formatProductStatus(status) {
  const statusMap = {
    'ai_approved': { text: '在售（AI通过）', color: 'success' },
    'manual_approved': { text: '在售（人工通过）', color: 'success' },
    'approved': { text: '在售', color: 'success' },
    'pending_ai': { text: '待AI审核', color: 'warning' },
    'pending_manual': { text: '待人工审核', color: 'warning' },
    'pending': { text: '待审核', color: 'warning' },
    'ai_rejected': { text: 'AI拒绝', color: 'danger' },
    'manual_rejected': { text: '人工拒绝', color: 'danger' },
    'rejected': { text: '已拒绝', color: 'danger' },
    'offline_manual': { text: '已下架', color: 'default' },
    'offline': { text: '已下架', color: 'default' }
  }
  
  return statusMap[status] || { text: status, color: 'default' }
}

/**
 * 格式化商品类型
 * @param {string} type - 类型码
 * @returns {{ text: string, icon: string }}
 */
export function formatProductType(type) {
  const typeMap = {
    'link': { text: '链接', icon: '🔗' },
    'cdk': { text: 'CDK', icon: '🎫' },
    'store': { text: '小店', icon: '🏪' }
  }
  
  return typeMap[type] || { text: '链接', icon: '🔗' }
}

/**
 * 截断文本
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @param {string} suffix - 后缀
 * @returns {string}
 */
export function truncateText(text, maxLength = 50, suffix = '...') {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength) + suffix
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
