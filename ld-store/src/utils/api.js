import { storage } from './storage'
import { MAINTENANCE_MODE } from '@/config/maintenance'

// API 基础地址
// 开发环境使用相对路径（通过 Vite 代理），生产环境使用完整 URL
const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? '' : 'https://api2.ldspro.qzz.io')
const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE || (import.meta.env.DEV ? '' : 'https://api1.ldspro.qzz.io')
const IMAGE_API_BASE = import.meta.env.VITE_IMAGE_API_BASE || (import.meta.env.DEV ? '' : 'https://api.ldspro.qzz.io')

// Linux.do LDC API 基础地址
export const LDC_API_BASE = 'https://linux.do'

// 请求超时时间
const TIMEOUT = 15000

// HTTP 错误码映射
const ERROR_MESSAGES = {
  400: '请求参数错误',
  401: '登录已过期，请重新登录',
  403: '没有权限执行此操作',
  404: '请求的资源不存在',
  429: '请求过于频繁，请稍后再试',
  500: '服务器内部错误',
  502: '服务暂时不可用',
  503: '服务正在维护中',
}

const NETWORK_ERROR_MESSAGE = '网络连接异常，请检查网络后重试'
const UNKNOWN_ERROR_MESSAGE = '请求失败，请稍后重试'

function normalizeMessage(value) {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function normalizeServerErrorMessage(status, data) {
  const fallback = ERROR_MESSAGES[status] || `请求失败 (${status})`
  if (!data) return fallback

  if (typeof data === 'string') {
    const msg = normalizeMessage(data)
    return msg || fallback
  }

  if (typeof data === 'object') {
    const candidates = [
      data?.error?.message,
      data?.error,
      data?.message,
    ]
    for (const item of candidates) {
      const msg = normalizeMessage(item)
      if (msg) return msg
    }
  }

  return fallback
}

function normalizeNetworkErrorMessage(error, timeoutMessage) {
  if (!error) return NETWORK_ERROR_MESSAGE
  if (error.name === 'AbortError') return timeoutMessage
  const text = normalizeMessage(error.message).toLowerCase()
  if (!text) return NETWORK_ERROR_MESSAGE
  if (
    text.includes('failed to fetch')
    || text.includes('networkerror')
    || text.includes('network error')
    || text.includes('load failed')
    || text.includes('network request failed')
  ) {
    return NETWORK_ERROR_MESSAGE
  }
  return normalizeMessage(error.message) || UNKNOWN_ERROR_MESSAGE
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null)
  }
  return response.text().catch(() => '')
}

function isWriteMethod(method) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
}

function maintenanceBlockedResponse() {
  return {
    success: false,
    error: '站点维护中，暂时关闭新增和修改操作',
    status: 503
  }
}

/**
 * 发起 HTTP 请求
 */
async function request(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  if (MAINTENANCE_MODE && isWriteMethod(method)) {
    return maintenanceBlockedResponse()
  }

  const base = url.startsWith('/api/image')
    ? IMAGE_API_BASE
    : (url.startsWith('/api/auth') ? AUTH_API_BASE : API_BASE)
  const fullUrl = url.startsWith('http') ? url : `${base}${url}`
  
  // 获取 token
  const token = storage.get('token')
  
  // 默认请求头
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers
  }
  
  // 添加认证头
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  // 创建 AbortController 用于超时控制
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || TIMEOUT)
  
  try {
    const response = await fetch(fullUrl, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      credentials: 'include'
    })
    
    clearTimeout(timeoutId)
    
    // 解析响应
    const data = await parseResponseBody(response)
    
    // 检查响应状态
    if (!response.ok) {
      const errorMessage = normalizeServerErrorMessage(response.status, data)
      return {
        success: false,
        error: errorMessage,
        status: response.status
      }
    }
    
    // 处理嵌套的响应格式
    if (data?.success && data.data?.success && data.data?.data) {
      return { success: true, data: data.data.data }
    }
    
    return data
  } catch (error) {
    clearTimeout(timeoutId)
    return {
      success: false,
      error: normalizeNetworkErrorMessage(error, '请求超时，请检查网络连接'),
      status: 0
    }
  }
}

/**
 * GET 请求
 */
function get(url, options = {}) {
  return request(url, { ...options, method: 'GET' })
}

/**
 * POST 请求
 */
function post(url, body, options = {}) {
  return request(url, { ...options, method: 'POST', body })
}

/**
 * PUT 请求
 */
function put(url, body, options = {}) {
  return request(url, { ...options, method: 'PUT', body })
}

/**
 * DELETE 请求
 */
function del(url, options = {}) {
  return request(url, { ...options, method: 'DELETE' })
}

/**
 * 上传文件（FormData 请求）
 */
async function upload(url, formData, options = {}) {
  if (MAINTENANCE_MODE) {
    return maintenanceBlockedResponse()
  }

  const base = url.startsWith('/api/image') ? IMAGE_API_BASE : API_BASE
  const fullUrl = url.startsWith('http') ? url : `${base}${url}`
  
  // 获取 token
  const token = storage.get('token')
  
  // 不要设置 Content-Type，让浏览器自动添加 multipart/form-data 及 boundary
  const headers = {
    'Accept': 'application/json',
    ...options.headers
  }
  
  // 添加认证头
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  // 创建 AbortController 用于超时控制（上传可能需要更长时间）
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 60000)
  
  try {
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: formData, // 直接传 FormData，不要 JSON.stringify
      signal: controller.signal,
      credentials: 'include'
    })
    
    clearTimeout(timeoutId)
    
    // 解析响应
    const data = await parseResponseBody(response)
    
    // 检查响应状态
    if (!response.ok) {
      const errorMessage = normalizeServerErrorMessage(response.status, data)
      return {
        success: false,
        error: errorMessage,
        status: response.status
      }
    }
    
    return data
  } catch (error) {
    clearTimeout(timeoutId)
    return {
      success: false,
      error: normalizeNetworkErrorMessage(error, '上传超时，请检查网络连接'),
      status: 0
    }
  }
}

/**
 * 并发请求
 */
async function all(requests) {
  return Promise.all(requests)
}

export const api = {
  request,
  get,
  post,
  put,
  delete: del,
  upload,
  all,
  BASE_URL: API_BASE
}
