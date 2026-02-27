<template>
  <div class="login-page">
    <div class="login-container">
      <!-- Logo -->
      <div class="login-header">
        <div class="login-logo-wrapper">
          <img
            src="/favicon.svg"
            alt="LD士多"
            class="login-logo"
          />
        </div>
        <h1 class="login-title">LD士多</h1>
        <p class="login-subtitle">LDC 积分兑换商城</p>
      </div>
      
      <!-- 登录说明 -->
      <div class="login-info">
        <p class="login-info-title">使用 Linux.do 账号登录，即可：</p>
        <ul class="login-features">
          <li>
            <span class="feature-icon">🛒</span>
            <span>使用 LDC 积分兑换物品</span>
          </li>
          <li>
            <span class="feature-icon">📦</span>
            <span>发布和管理您的物品</span>
          </li>
          <li>
            <span class="feature-icon">📋</span>
            <span>查看订单和交易记录</span>
          </li>
          <li>
            <span class="feature-icon">💰</span>
            <span>设置收款信息接收付款</span>
          </li>
        </ul>
      </div>
      
      <!-- 服务条款勾选 -->
      <div class="terms-checkbox">
        <label class="checkbox-wrapper">
          <input 
            type="checkbox" 
            v-model="agreedToTerms"
            class="checkbox-input"
          />
          <span class="checkbox-custom"></span>
          <span class="checkbox-label">
            我已阅读并同意
            <router-link to="/docs/terms" class="terms-link" target="_blank">《服务条款》</router-link>
          </span>
        </label>
      </div>
      
      <!-- 登录按钮 -->
      <button
        class="login-btn"
        :disabled="loading || !agreedToTerms"
        :class="{ 'btn-disabled': !agreedToTerms }"
        @click="handleLogin"
      >
        <span class="login-btn-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        </span>
        <span>{{ loading ? '正在跳转...' : (agreedToTerms ? '使用 Linux.do 账号登录' : '请先同意服务条款') }}</span>
      </button>
      
      <!-- 提示 -->
      <p class="login-tip">
        <span class="tip-icon">📋</span>
        请仔细阅读<router-link to="/docs/terms" class="terms-link-inline">服务条款</router-link>，了解平台规则和使用须知
      </p>
      
      <!-- CF 拦截提示 -->
      <div class="cf-tip">
        <span class="cf-tip-icon">💡</span>
        <span>如遇到获取登录链接失败等问题，可能是被 CF 拦截，请更换节点后重试</span>
      </div>
      
      <!-- 返回首页 -->
      <router-link to="/" class="back-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="back-icon">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        返回首页
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/utils/api'
import { useToast } from '@/composables/useToast'
import { sanitizePostLoginRedirect } from '@/utils/navigation'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(false)
const redirect = ref('/')
const agreedToTerms = ref(false)

onMounted(() => {
  // 保存重定向地址
  if (route.query.redirect) {
    redirect.value = sanitizePostLoginRedirect(
      Array.isArray(route.query.redirect) ? route.query.redirect[0] : route.query.redirect,
      '/'
    )
  }
})

async function handleLogin() {
  loading.value = true
  
  try {
    // 构建 OAuth 完成后的返回地址（包含重定向信息）
    const safeRedirect = sanitizePostLoginRedirect(redirect.value, '/')
    const returnUrl = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(safeRedirect)}`
    
    // 获取 OAuth 登录地址
    // 后端使用 /api/auth/init 端点，支持 site 和 return_url 参数
    const result = await api.get(`/api/auth/init?site=linux.do&return_url=${encodeURIComponent(returnUrl)}`)
    
    // 返回格式: { success: true, data: { auth_url: "...", state: "..." } }
    const authUrl = result.data?.auth_url || result.auth_url
    if (result.success && authUrl) {
      // 跳转到 OAuth 授权页面
      window.location.href = authUrl
    } else {
      toast.error(result.error?.message || '获取登录地址失败')
      loading.value = false
    }
  } catch (e) {
    toast.error('登录失败：' + e.message)
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--bg-primary);
}

.login-container {
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.login-header {
  margin-bottom: 32px;
}

.login-logo-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  background: var(--bg-card);
  border-radius: 24px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-light);
}

.login-logo {
  width: 56px;
  height: 56px;
  object-fit: contain;
}

.login-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px;
  letter-spacing: 1px;
}

.login-subtitle {
  font-size: 14px;
  color: var(--text-tertiary);
  margin: 0;
}

.login-info {
  background: var(--bg-card);
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 24px;
  text-align: left;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
}

.login-info-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0 0 16px;
}

.login-features {
  list-style: none;
  padding: 0;
  margin: 0;
}

.login-features li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: var(--text-primary);
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);
}

.login-features li:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.login-features li:first-child {
  padding-top: 0;
}

.feature-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 16px 24px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
  color: white;
  font-size: 15px;
  font-weight: 600;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 16px;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-primary);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.login-btn-icon svg {
  width: 100%;
  height: 100%;
}

/* 服务条款勾选框 */
.terms-checkbox {
  margin-bottom: 16px;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.checkbox-custom {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-medium);
  border-radius: 6px;
  background: var(--bg-card);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.checkbox-input:checked + .checkbox-custom {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.checkbox-input:checked + .checkbox-custom::after {
  content: '✓';
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.checkbox-input:focus + .checkbox-custom {
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.2);
}

.checkbox-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.terms-link {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}

.terms-link:hover {
  text-decoration: underline;
}

.login-btn.btn-disabled {
  background: var(--bg-secondary);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.login-btn.btn-disabled:hover {
  transform: none;
  box-shadow: none;
}

.login-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0 0 16px;
}

.tip-icon {
  font-size: 14px;
}

.terms-link-inline {
  color: var(--color-primary);
  text-decoration: none;
}

.terms-link-inline:hover {
  text-decoration: underline;
}

.cf-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
  border-radius: 10px;
  margin-bottom: 24px;
  text-align: left;
}

.cf-tip-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.cf-tip span:last-child {
  font-size: 12px;
  color: var(--color-warning);
  line-height: 1.5;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--color-primary);
  text-decoration: none;
  transition: color 0.2s;
}

.back-link:hover {
  color: var(--color-primary-hover);
}

.back-icon {
  width: 16px;
  height: 16px;
}
</style>
