/**
 * 本地存储工具
 * 使用 localStorage，带有命名空间和过期时间支持
 */

const NAMESPACE = 'ld_store_'
const DEFAULT_EXPIRE = 7 * 24 * 60 * 60 * 1000 // 7天

/**
 * 设置存储项
 * @param {string} key - 键名
 * @param {any} value - 值
 * @param {number} expire - 过期时间（毫秒），0 表示不过期
 */
function set(key, value, expire = DEFAULT_EXPIRE) {
  try {
    const item = {
      value,
      timestamp: Date.now(),
      expire: expire > 0 ? Date.now() + expire : 0
    }
    localStorage.setItem(NAMESPACE + key, JSON.stringify(item))
    return true
  } catch (e) {
    console.error('Storage set error:', e)
    return false
  }
}

/**
 * 获取存储项
 * @param {string} key - 键名
 * @param {any} defaultValue - 默认值
 * @returns {any}
 */
function get(key, defaultValue = null) {
  try {
    const data = localStorage.getItem(NAMESPACE + key)
    if (!data) return defaultValue
    
    const item = JSON.parse(data)
    
    // 检查是否过期
    if (item.expire && item.expire < Date.now()) {
      remove(key)
      return defaultValue
    }
    
    return item.value
  } catch (e) {
    console.error('Storage get error:', e)
    return defaultValue
  }
}

/**
 * 移除存储项
 * @param {string} key - 键名
 */
function remove(key) {
  try {
    localStorage.removeItem(NAMESPACE + key)
    return true
  } catch (e) {
    console.error('Storage remove error:', e)
    return false
  }
}

/**
 * 清除所有存储项（仅限命名空间内）
 */
function clear() {
  try {
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith(NAMESPACE)) {
        localStorage.removeItem(key)
      }
    })
    return true
  } catch (e) {
    console.error('Storage clear error:', e)
    return false
  }
}

/**
 * 检查存储项是否存在且未过期
 * @param {string} key - 键名
 * @returns {boolean}
 */
function has(key) {
  return get(key) !== null
}

/**
 * 获取所有存储键（仅限命名空间内）
 * @returns {string[]}
 */
function keys() {
  const result = []
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(NAMESPACE)) {
        result.push(key.replace(NAMESPACE, ''))
      }
    })
  } catch (e) {
    console.error('Storage keys error:', e)
  }
  return result
}

export const storage = {
  set,
  get,
  remove,
  clear,
  has,
  keys,
  NAMESPACE
}
