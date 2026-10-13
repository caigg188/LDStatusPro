import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authSession, clearAuthSession, setAuthSession, syncAuthSession, parseJwtPayload } from '@/utils/auth'
import { buildAvatarCandidates, buildFallbackAvatar } from '@/utils/avatar'

export const useUserStore = defineStore('user', () => {
  // 状态
  const token = computed(() => authSession.value.token)
  const user = computed(() => authSession.value.user)
  const loading = ref(false)
  const ldcInfo = ref(null)
  const sessionReady = ref(false)

  // 计算属性
  const tokenPayload = computed(() => parseJwtPayload(token.value))
  const currentUser = computed(() => user.value)
  const isLoggedIn = computed(() => !!token.value && !!currentUser.value)
  const sessionKey = computed(() => JSON.stringify([currentUser.value?.site, currentUser.value?.id, authSession.value.revision]))
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

  function restoreSession() {
    syncAuthSession()
    sessionReady.value = true
    return isLoggedIn.value
  }

  function login(authToken, userData) {
    const success = setAuthSession(authToken, userData)
    sessionReady.value = true
    return success
  }

  function logout() {
    clearAuthSession()
    ldcInfo.value = null
    sessionReady.value = true
  }

  const ensureValidSession = restoreSession

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
    sessionKey,
    currentUser,
    username,
    avatar,
    avatarCandidates,
    trustLevel,
    // 方法
    restoreSession,
    login,
    logout,
    ensureValidSession,
    fetchLdcInfo
  }
})
