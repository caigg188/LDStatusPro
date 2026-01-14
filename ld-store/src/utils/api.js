import { storage } from './storage'
import { sanitize } from './security'

// API 基础地址
// 开发环境使用相对路径（通过 Vite 代理），生产环境使用完整 URL
// 注意：部署时需要设置 VITE_API_BASE_URL 环境变量
const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '')

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

/**
 * 发起 HTTP 请求
 */
async function request(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`
  
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
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      credentials: 'include'
    })
    
    clearTimeout(timeoutId)
    
    // 解析响应
    const contentType = response.headers.get('content-type')
    let data
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }
    
    // 检查响应状态
    if (!response.ok) {
      const errorMessage = data?.error || ERROR_MESSAGES[response.status] || `请求失败 (${response.status})`
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
    
    if (error.name === 'AbortError') {
      return { success: false, error: '请求超时，请检查网络连接' }
    }
    
    return { success: false, error: error.message || '网络错误' }
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
  all,
  BASE_URL: API_BASE
}
