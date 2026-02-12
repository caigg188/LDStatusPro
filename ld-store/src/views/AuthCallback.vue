<template>
  <div class="auth-callback">
    <div class="callback-container">
      <div v-if="loading" class="callback-loading">
        <div class="spinner"></div>
        <p>正在登录...</p>
      </div>
      
      <div v-else-if="error" class="callback-error">
        <span class="error-icon">❌</span>
        <p class="error-text">{{ error }}</p>
        <router-link to="/login" class="retry-btn">
          重新登录
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useToast } from '@/composables/useToast'
import { sanitizeRedirect } from '@/utils/navigation'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const toast = useToast()

const loading = ref(true)
const error = ref('')

/**
 * 解析 URL hash 中的 OAuth 数据
 * 后端回调通过 URL hash 传递登录结果: #ldsp_oauth=base64(json)
 */
function getRawOAuthParam() {
  const extract = (source) => {
    if (!source) return null
    const match = source.match(/(?:^|&)ldsp_oauth=([^&]*)/)
    return match ? match[1] : null
  }

  // 优先从 hash 读取；兼容某些场景参数落在 query 的情况
  const fromHash = extract(window.location.hash.slice(1))
  if (fromHash) return fromHash

  return extract(window.location.search.slice(1))
}

function parseOAuthData() {
  const raw = getRawOAuthParam()
  if (!raw) return null

  try {
    // 兼容历史/异常编码: + 被转空格、URL-safe base64、缺失 padding
    const restored = decodeURIComponent(raw).replace(/\s/g, '+')
    const normalized = restored.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)

    // base64 解码并解析 JSON
    let decoded
    try {
      decoded = decodeURIComponent(atob(padded))
    } catch {
      decoded = atob(padded)
    }
    const data = JSON.parse(decoded)

    // 验证数据结构
    // data: { t: token, u: user, j: isJoined, ts: timestamp }
    if (data.t && data.u) {
      return {
        token: data.t,
        user: data.u,
        isJoined: data.j === 1,
        timestamp: data.ts
      }
    }
    return null
  } catch (e) {
    console.error('[AuthCallback] Failed to parse OAuth data:', e)
    return null
  }
}

onMounted(async () => {
  try {
    // 优先从 URL hash 解析登录数据（后端回调传递）
    const oauthData = parseOAuthData()
    
    if (oauthData) {
      // 使用从 hash 获取的登录数据
      await userStore.login(oauthData.token, oauthData.user)
      
      toast.success('登录成功')
      
      // 清除 hash 以免影响后续导航
      history.replaceState(null, '', window.location.pathname + window.location.search)
      
      // 跳转到之前的页面
      const redirect = sanitizeRedirect(
        Array.isArray(route.query.redirect) ? route.query.redirect[0] : route.query.redirect,
        '/'
      )
      router.replace(redirect)
    } else {
      // 没有找到 OAuth 数据
      error.value = '登录授权失败，请重试'
      loading.value = false
    }
  } catch (e) {
    console.error('[AuthCallback] Error:', e)
    error.value = e.message || '登录失败，请重试'
    loading.value = false
  }
})
</script>

<style scoped>
.auth-callback {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
}

.callback-container {
  text-align: center;
  padding: 40px;
}

.callback-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(181, 168, 152, 0.2);
  border-top-color: #b5a898;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.callback-loading p {
  font-size: 16px;
  color: var(--text-secondary);
  margin: 0;
}

.callback-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.error-icon {
  font-size: 48px;
}

.error-text {
  font-size: 16px;
  color: var(--text-secondary);
  margin: 0;
}

.retry-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, #b5a898 0%, #9f8f7d 100%);
  color: white;
  font-size: 14px;
  font-weight: 500;
  border-radius: 10px;
  text-decoration: none;
}

.retry-btn:hover {
  opacity: 0.9;
}
</style>
