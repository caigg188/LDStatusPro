/**
 * 前端安全工具函数
 * 用于防止 XSS、注入等安全问题
 */

// HTML 实体编码映射
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
}

/**
 * HTML 转义（防止 XSS）
 * @param {string} str - 需要转义的字符串
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/[&<>"'`=/]/g, char => HTML_ENTITIES[char] || char)
}

/**
 * 移除 HTML 标签
 * @param {string} str - 包含 HTML 的字符串
 * @returns {string}
 */
export function stripHtml(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/<[^>]*>/g, '')
}

/**
 * 清理输入字符串
 * 移除潜在危险字符和多余空白
 * @param {string} str - 输入字符串
 * @returns {string}
 */
export function sanitize(str) {
  if (typeof str !== 'string') return ''
  
  return str
    // 移除 NULL 字节
    .replace(/\0/g, '')
    // 移除潜在的脚本注入
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    // 移除事件处理器
    .replace(/on\w+\s*=/gi, '')
    // 规范化空白
    .trim()
}

/**
 * 验证 URL 是否安全
 * @param {string} url - URL 字符串
 * @returns {boolean}
 */
export function isValidUrl(url) {
  if (typeof url !== 'string') return false
  
  try {
    const parsed = new URL(url)
    // 只允许 http 和 https 协议
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * 验证 LDC 支付链接
 * @param {string} url - URL 字符串
 * @returns {boolean}
 */
export function isValidLdcPaymentUrl(url) {
  if (!isValidUrl(url)) return false
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'credit.linux.do'
  } catch {
    return false
  }
}

/**
 * 验证图片 URL
 * @param {string} url - URL 字符串
 * @returns {boolean}
 */
export function isValidImageUrl(url) {
  if (!url) return true // 允许为空
  if (!isValidUrl(url)) return false
  
  try {
    const parsed = new URL(url)
    // 只允许 https
    if (parsed.protocol !== 'https:') return false
    return true
  } catch {
    return false
  }
}

/**
 * 防抖函数
 * @param {Function} fn - 需要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
      timer = null
    }, delay)
  }
}

/**
 * 节流函数
 * @param {Function} fn - 需要节流的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function}
 */
export function throttle(fn, limit = 300) {
  let lastCall = 0
  return function (...args) {
    const now = Date.now()
    if (now - lastCall >= limit) {
      lastCall = now
      fn.apply(this, args)
    }
  }
}

/**
 * 生成 CSRF Token
 * @returns {string}
 */
export function generateCsrfToken() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * 安全地解析 JSON
 * @param {string} str - JSON 字符串
 * @param {any} defaultValue - 默认值
 * @returns {any}
 */
export function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str)
  } catch {
    return defaultValue
  }
}

/**
 * 检测是否为可疑输入（包含潜在注入代码）
 * @param {string} str - 输入字符串
 * @returns {boolean}
 */
export function isSuspiciousInput(str) {
  if (typeof str !== 'string') return false
  
  const patterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /\beval\s*\(/i,
    /\bexec\s*\(/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<form/i
  ]
  
  return patterns.some(pattern => pattern.test(str))
}

/**
 * 验证商品名称
 * @param {string} name - 商品名称
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateProductName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: '请输入商品名称' }
  }
  
  const trimmed = name.trim()
  
  if (trimmed.length < 2) {
    return { valid: false, error: '商品名称至少需要2个字符' }
  }
  
  if (trimmed.length > 50) {
    return { valid: false, error: '商品名称不能超过50个字符' }
  }
  
  if (isSuspiciousInput(trimmed)) {
    return { valid: false, error: '商品名称包含非法字符' }
  }
  
  return { valid: true }
}

/**
 * 验证商品描述
 * @param {string} description - 商品描述
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateProductDescription(description) {
  if (!description || typeof description !== 'string') {
    return { valid: false, error: '请输入商品描述' }
  }
  
  const trimmed = description.trim()
  
  if (trimmed.length < 10) {
    return { valid: false, error: '商品描述至少需要10个字符' }
  }
  
  if (trimmed.length > 1000) {
    return { valid: false, error: '商品描述不能超过1000个字符' }
  }
  
  if (isSuspiciousInput(trimmed)) {
    return { valid: false, error: '商品描述包含非法内容' }
  }
  
  return { valid: true }
}

/**
 * 验证价格
 * @param {number|string} price - 价格
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePrice(price) {
  const num = parseFloat(price)
  
  if (isNaN(num)) {
    return { valid: false, error: '请输入有效的价格' }
  }
  
  if (num <= 0) {
    return { valid: false, error: '价格必须大于0' }
  }
  
  if (num > 99999999) {
    return { valid: false, error: '价格超出允许范围' }
  }
  
  return { valid: true }
}

/**
 * 验证商品价格（validatePrice的别名）
 * @param {number|string} price - 价格
 * @returns {string|null} 错误信息或null
 */
export function validateProductPrice(price) {
  const result = validatePrice(price)
  return result.valid ? null : result.error
}

/**
 * 验证折扣
 * @param {number|string} discount - 折扣
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateDiscount(discount) {
  if (!discount && discount !== 0) {
    return { valid: true } // 折扣为空时使用默认值1
  }
  
  const num = parseFloat(discount)
  
  if (isNaN(num)) {
    return { valid: false, error: '请输入有效的折扣' }
  }
  
  if (num < 0.01 || num > 1) {
    return { valid: false, error: '折扣范围为0.01-1' }
  }
  
  return { valid: true }
}
