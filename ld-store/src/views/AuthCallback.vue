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
        <button v-if="retryable" type="button" class="retry-btn" @click="completeLogin">重试校验</button>
        <router-link to="/login" class="retry-btn">
          重新登录
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { consumeOAuthState, isOAuthHandoff } from '@/utils/oauthHandoff'
import { captureOAuthEvent } from '@/observability/faro'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useToast } from '@/composables/useToast'
import { sanitizePostLoginRedirect } from '@/utils/navigation'
import { api } from '@/utils/api'
import { captureAuthSession, getAuthUser, isAuthSessionCurrent } from '@/utils/auth'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const toast = useToast()

const loading = ref(true)
const error = ref('')
const retryable = ref(false)
const baseline = captureAuthSession()
let oauthData
let active = true
let controller

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
  if (!raw || raw.length > 32768) { captureOAuthEvent('callback', 'malformed'); return null }

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

    // Only validate shape locally; expiry belongs to the server clock.
    if (isOAuthHandoff(data)) {
      const verifier = consumeOAuthState(data.s)
      if (verifier) captureOAuthEvent('callback', 'accepted', { expiresAt: data.exp })
      return verifier ? { code: data.c, state: data.s, verifier } : null
    }
    captureOAuthEvent('callback', 'malformed')
    return null
  } catch {
    captureOAuthEvent('callback', 'malformed')
    return null
  }
}

async function completeLogin() {
  if (!active || controller) return
  loading.value = true
  error.value = ''
  retryable.value = false
  if (!oauthData || (!oauthData.code && !getAuthUser(oauthData.token, oauthData.user))) {
    error.value = '登录信息无效或已过期，请重新登录'
    loading.value = false
    return
  }
  controller = new AbortController()
  const timeoutId = setTimeout(() => controller?.abort(), 8000)
  try {
    if (oauthData.code) {
      captureOAuthEvent('exchange', 'started')
      const exchange = await fetch(`${api.BASE_URL}/api/shop/auth/exchange`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...oauthData, origin: location.origin }), signal: controller.signal
      })
      const exchanged = await exchange.json().catch(() => null)
      if (!exchange.ok || !exchanged?.data?.token || !getAuthUser(exchanged.data.token, exchanged.data.user)) {
        captureOAuthEvent('exchange', exchange.status >= 500 ? 'unavailable' : 'invalid_grant', {
          status: exchange.status, requestId: exchange.headers.get('x-request-id')
        })
        error.value = exchange.status >= 500 ? '登录服务暂时不可用，请重新发起登录' : '登录校验已失效，请重新登录'
        return
      }
      if (!active) return
      oauthData = exchanged.data
      captureOAuthEvent('exchange', 'success', { status: exchange.status, requestId: exchange.headers.get('x-request-id') })
    }
    // 候选凭据只用于服务端校验，成功之前不写入当前会话。
    captureOAuthEvent('verify', 'started')
    const response = await fetch(`${api.BASE_URL}/api/shop/auth/verify`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${oauthData.token}` },
      credentials: 'include', signal: controller.signal
    })
    const payload = await response.json().catch(() => null)
    if (!active) return
    if (!isAuthSessionCurrent(baseline)) {
      captureOAuthEvent('verify', 'session_changed')
      error.value = '登录状态已在其他页面变更，请重新进入'
      return
    }
    if (!response.ok || payload?.success !== true || payload.data?.authenticated !== true
      || !payload.data?.user || !getAuthUser(oauthData.token, payload.data.user)) {
      captureOAuthEvent('verify', response.status >= 500 ? 'unavailable' : 'invalid_identity', {
        status: response.status, requestId: response.headers.get('x-request-id')
      })
      retryable.value = response.status >= 500
      error.value = retryable.value ? '登录校验服务暂时不可用，请重试' : '登录授权校验失败，请重新登录'
      return
    }
    const loginOk = userStore.login(oauthData.token, oauthData.user)
    if (!loginOk) {
      captureOAuthEvent('session', 'persist_failed')
      error.value = '登录信息无法保存，请检查浏览器存储后重新登录'
      return
    }
    captureOAuthEvent('session', 'success')
    toast.success('登录成功')
    const redirect = sanitizePostLoginRedirect(
      Array.isArray(route.query.redirect) ? route.query.redirect[0] : route.query.redirect, '/'
    )
    try { await router.replace(redirect) } catch { await router.replace('/') }
  } catch {
    if (active) {
      captureOAuthEvent(oauthData?.code ? 'exchange' : 'verify', 'network_error')
      // A lost exchange response may already have consumed the one-use grant.
      retryable.value = !oauthData?.code
      error.value = retryable.value ? '登录校验暂未完成，请检查网络后重试' : '未收到授权结果，请重新发起登录，不要刷新回调页面'
    }
  } finally {
    clearTimeout(timeoutId)
    controller = null
    loading.value = false
  }
}

onMounted(() => {
  oauthData = parseOAuthData()
  // 解析后立即从历史记录移除凭据，包含旧版 query 回调。
  const cleanUrl = new URL(window.location.href)
  cleanUrl.searchParams.delete('ldsp_oauth')
  cleanUrl.hash = ''
  history.replaceState(history.state, '', cleanUrl.pathname + cleanUrl.search)
  void completeLogin()
})
onBeforeUnmount(() => {
  active = false
  controller?.abort()
})
</script>

<style scoped>
.auth-callback {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
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
  border: 3px solid var(--palette-rgba-181-168-152-0p2);
  border-top-color: var(--palette-hex-b5a898);
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
  background: linear-gradient(135deg, var(--palette-hex-b5a898) 0%, var(--palette-hex-9f8f7d) 100%);
  color: var(--palette-hex-ffffff);
  font-size: 14px;
  font-weight: 500;
  border-radius: 10px;
  text-decoration: none;
}

.retry-btn:hover {
  opacity: 0.9;
}
</style>
