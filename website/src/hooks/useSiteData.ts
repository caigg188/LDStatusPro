import { useState, useEffect } from 'react'

const API_BASE = 'https://api.ldspro.qzz.io'

// 缓存键
const CACHE_KEYS = {
  settings: 'ldsp_site_settings',
  updateLogs: 'ldsp_site_update_logs',
  faqs: 'ldsp_site_faqs'
}

// 缓存过期时间（5 分钟）
const CACHE_TTL = 5 * 60 * 1000

interface CacheItem<T> {
  data: T
  timestamp: number
}

function getCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key)
    if (!cached) return null
    
    const item: CacheItem<T> = JSON.parse(cached)
    if (Date.now() - item.timestamp > CACHE_TTL) {
      localStorage.removeItem(key)
      return null
    }
    
    return item.data
  } catch {
    return null
  }
}

function setCache<T>(key: string, data: T): void {
  try {
    const item: CacheItem<T> = { data, timestamp: Date.now() }
    localStorage.setItem(key, JSON.stringify(item))
  } catch {
    // localStorage 可能被禁用或已满
  }
}

// 站点设置类型
export interface SiteSettings {
  plugin_version: string
  hero_badge_text: string
  install_button_text: string
  [key: string]: string
}

// 更新日志类型
export interface UpdateLog {
  id: number
  version: string
  date: string
  badge: string
  badge_color: string
  title: string
  highlights: string[]
  sort_order: number
}

// FAQ 类型
export interface FAQ {
  id: number
  question: string
  answer: string
  icon: string
  icon_color: string
  sort_order: number
}

// 默认数据（API 不可用时的回退）
const DEFAULT_SETTINGS: SiteSettings = {
  plugin_version: '3.4.2',
  hero_badge_text: 'v3.4.2 全新发布',
  install_button_text: '立即安装 v3.4.2'
}

const DEFAULT_UPDATE_LOGS: UpdateLog[] = [
  {
    id: 1,
    version: 'v3.4.2',
    date: '2025-12-16',
    badge: '最新',
    badge_color: 'from-green-500 to-emerald-500',
    title: '工单系统上线，UI全面优化，兼容性稳定性提升',
    highlights: [
      'UI配色全面优化，使用更高级沉稳的配色方案',
      '加入工单系统，用户可更方便提交问题与建议',
      '0级和1级用户也可以正常查看信任等级升级进度',
      '全面提高客户端的兼容性和稳定性'
    ],
    sort_order: 0
  }
]

const DEFAULT_FAQS: FAQ[] = [
  {
    id: 1,
    question: '安装这个脚本安全吗？会不会盗号？',
    answer: '完全安全！LDStatus Pro 是开源项目，代码公开透明，你可以在 GitHub 查看全部源码。脚本使用官方 OAuth 认证登录，不会获取你的密码。所有数据存储在浏览器本地或你自己授权的云端账号中。',
    icon: 'Shield',
    icon_color: 'text-green-400',
    sort_order: 0
  }
]

// 通用数据获取 Hook
function useFetch<T>(endpoint: string, cacheKey: string, defaultData: T): { data: T; loading: boolean; error: string | null } {
  const [data, setData] = useState<T>(() => getCache<T>(cacheKey) || defaultData)
  const [loading, setLoading] = useState(!getCache<T>(cacheKey))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cached = getCache<T>(cacheKey)
    if (cached) {
      setData(cached)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    
    fetch(`${API_BASE}${endpoint}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (json.success && json.data) {
          setData(json.data)
          setCache(cacheKey, json.data)
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.warn(`[SiteData] Failed to fetch ${endpoint}:`, err.message)
          setError(err.message)
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [endpoint, cacheKey])

  return { data, loading, error }
}

// 获取站点设置
export function useSiteSettings() {
  return useFetch<SiteSettings>('/api/site/settings', CACHE_KEYS.settings, DEFAULT_SETTINGS)
}

// 获取更新日志
export function useUpdateLogs() {
  return useFetch<UpdateLog[]>('/api/site/update-logs', CACHE_KEYS.updateLogs, DEFAULT_UPDATE_LOGS)
}

// 获取 FAQ
export function useFaqs() {
  return useFetch<FAQ[]>('/api/site/faqs', CACHE_KEYS.faqs, DEFAULT_FAQS)
}
