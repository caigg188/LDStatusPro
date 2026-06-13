import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage } from '@/utils/storage'
import { isTokenExpired, parseJwtPayload } from '@/utils/auth'
import { buildAvatarCandidates, buildFallbackAvatar } from '@/utils/avatar'

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeAuthUser(userData, tokenPayload) {
  const userObject = isPlainObject(userData) ? { ...userData } : {}
  const payload = isPlainObject(tokenPayload) ? tokenPayload : {}
  const normalized = { ...userObject }

  if (normalized.id === undefined || normalized.id === null || normalized.id === '') {
    normalized.id = payload.sub ?? payload.id ?? null
  }
  if (!normalized.username) {
    normalized.username = payload.username || ''
  }
  if (normalized.name === undefined || normalized.name === null || normalized.name === '') {
    normalized.name = payload.name || ''
  }
  if (!normalized.avatar) {
    normalized.avatar = payload.avatar || ''
  }
  if (!normalized.avatar_url) {
    normalized.avatar_url = userObject.avatarUrl || payload.avatar_url || payload.avatarUrl || ''
  }
  if (!normalized.avatar_template) {
    normalized.avatar_template = userObject.avatarTemplate || payload.avatar_template || payload.avatarTemplate || ''
  }
  if (!normalized.animated_avatar) {
    normalized.animated_avatar = userObject.animatedAvatar || payload.animated_avatar || payload.animatedAvatar || ''
  }
  if (normalized.trust_level === undefined || normalized.trust_level === null || normalized.trust_level === '') {
    normalized.trust_level = userObject.trustLevel ?? payload.trust_level ?? payload.trustLevel ?? null
  }
  if (!normalized.site) {
    normalized.site = payload.site || ''
  }

  return normalized.id || normalized.username ? normalized : null
}

export const useUserStore = defineStore('user', () => {
  // 状态
  const token = ref(null)
  const user = ref(null)
  const loading = ref(false)
  const ldcInfo = ref(null)
  const sessionReady = ref(false)

  // 计算属性
  const tokenPayload = computed(() => parseJwtPayload(token.value))
  const currentUser = computed(() => normalizeAuthUser(user.value, tokenPayload.value))
  const isLoggedIn = computed(() => {
    if (!token.value || !currentUser.value) return false
    return !isTokenExpired(token.value)
  })
  const username = computed(() => currentUser.value?.username || '')
  const avatarSeed = computed(() =>
    currentUser.value?.name || currentUser.value?.username || currentUser.value?.id || 'user'
  )
  const avatarCandidates = computed(() =>
    buildAvatarCandidates([
      currentUser.value?.animated_avatar,
      currentUser.value?.avatar,
      currentUser.value?.avatar_url,
      currentUser.value?.avatar_template,
      tokenPayload.value?.animated_avatar,
      tokenPayload.value?.avatar,
      tokenPayload.value?.avatar_url,
      tokenPayload.value?.avatar_template
    ], 128)
  )
  const avatar = computed(() =>
    avatarCandidates.value[0] || buildFallbackAvatar(avatarSeed.value, 128)
  )
  const trustLevel = computed(() => {
    const value = currentUser.value?.trust_level ?? currentUser.value?.trustLevel
    if (value === undefined || value === null || value === '') return null
    const parsed = Number.parseInt(value, 10)
    return Number.isInteger(parsed) ? parsed : null
  })

  function markSessionReady() {
    sessionReady.value = true
  }

  // 恢复会话
  async function restoreSession() {
    const savedToken = storage.get('token')
    const savedUser = storage.get('user')

    if (!savedToken) {
      if (savedUser) logout()
      markSessionReady()
      return false
    }

    if (isTokenExpired(savedToken)) {
      logout()
      markSessionReady()
      return false
    }

    const hydratedUser = normalizeAuthUser(savedUser, parseJwtPayload(savedToken))
    if (!hydratedUser) {
      logout()
      markSessionReady()
      return false
    }

    token.value = savedToken
    user.value = hydratedUser
    storage.set('user', hydratedUser)
    markSessionReady()
    return true
  }

  // 登录
  async function login(authToken, userData) {
    const hydratedUser = normalizeAuthUser(userData, parseJwtPayload(authToken))
    if (!authToken || !hydratedUser || isTokenExpired(authToken)) {
      logout()
      return false
    }

    token.value = authToken
    user.value = hydratedUser
    storage.set('token', authToken)
    storage.set('user', hydratedUser)
    markSessionReady()
    return true
  }

  // 登出
  function logout() {
    token.value = null
    user.value = null
    sessionReady.value = true
    storage.remove('token')
    storage.remove('user')
  }

  // 更新用户信息
  function updateUser(data) {
    user.value = normalizeAuthUser({ ...user.value, ...data }, tokenPayload.value)
    storage.set('user', user.value)
  }

  function ensureValidSession() {
    if (!token.value || !currentUser.value) return false
    if (isTokenExpired(token.value)) {
      logout()
      return false
    }
    return true
  }

  async function fetchLdcInfo() {
    ldcInfo.value = null
    return null
  }

  return {
    // 状态
    token,
    user,
    loading,
    ldcInfo,
    sessionReady,
    // 计算属性
    isLoggedIn,
    username,
    avatar,
    avatarCandidates,
    trustLevel,
    // 方法
    restoreSession,
    login,
    logout,
    updateUser,
    ensureValidSession,
    fetchLdcInfo
  }
})

