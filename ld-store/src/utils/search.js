export const SEARCH_HISTORY_KEY = 'search_history'

export const DEFAULT_SEARCH_KEYWORDS = [
  'ChatGPT',
  'Claude',
  'VPS',
  '小鸡',
  'API',
  '存储',
  '代理',
  '咨询'
]

function normalizeKeyword(keyword) {
  return String(keyword || '').trim()
}

export function loadSearchHistory(storage, limit = 10) {
  const history = storage.get(SEARCH_HISTORY_KEY, [])
  if (!Array.isArray(history)) return []
  return history
    .map(normalizeKeyword)
    .filter(Boolean)
    .slice(0, limit)
}

export function saveSearchHistory(storage, keyword, limit = 10) {
  const normalizedKeyword = normalizeKeyword(keyword)
  if (!normalizedKeyword) return []

  const history = loadSearchHistory(storage, limit).filter(item => item !== normalizedKeyword)
  history.unshift(normalizedKeyword)
  const nextHistory = history.slice(0, limit)
  storage.set(SEARCH_HISTORY_KEY, nextHistory)
  return nextHistory
}

export function clearSearchHistory(storage) {
  storage.remove(SEARCH_HISTORY_KEY)
}
