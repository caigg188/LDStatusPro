import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/utils/api'
import { storage } from '@/utils/storage'

export const useUserStore = defineStore('user', () => {
  // 状态
  const token = ref(null)
  const user = ref(null)
  const loading = ref(false)

  // 计算属性
  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const username = computed(() => user.value?.username || '')
  const avatar = computed(() => user.value?.avatar || user.value?.avatar_url || '')
  const trustLevel = computed(() => user.value?.trust_level || user.value?.trustLevel || null)

  // 恢复会话
  async function restoreSession() {
    const savedToken = storage.get('token')
    const savedUser = storage.get('user')

    if (savedToken && savedUser) {
      token.value = savedToken
      user.value = savedUser
      
      // JWT token 包含过期时间，可以检查是否需要重新登录
      // 这里简单地恢复本地存储的用户信息
      // 如需验证 token 有效性，可调用 /api/auth/verify
    }
  }

  // 登录
  async function login(authToken, userData) {
    token.value = authToken
    user.value = userData
    storage.set('token', authToken)
    storage.set('user', userData)
  }

  // 登出
  function logout() {
    token.value = null
    user.value = null
    storage.remove('token')
    storage.remove('user')
  }

  // 更新用户信息
  function updateUser(data) {
    user.value = { ...user.value, ...data }
    storage.set('user', user.value)
  }

  return {
    // 状态
    token,
    user,
    loading,
    // 计算属性
    isLoggedIn,
    username,
    avatar,
    trustLevel,
    // 方法
    restoreSession,
    login,
    logout,
    updateUser
  }
})
