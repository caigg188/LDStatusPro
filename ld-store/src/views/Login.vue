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
            <span>使用 LDC 积分兑换商品</span>
          </li>
          <li>
            <span class="feature-icon">📦</span>
            <span>发布和管理您的商品</span>
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
      
      <!-- 登录按钮 -->
      <button
        class="login-btn"
        :disabled="loading"
        @click="handleLogin"
      >
        <span class="login-btn-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        </span>
        <span>{{ loading ? '正在跳转...' : '使用 Linux.do 账号登录' }}</span>
      </button>
      
      <!-- 提示 -->
      <p class="login-tip">
        登录即表示您同意我们的服务条款
      </p>
      
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

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loading = ref(false)
const redirect = ref('/')

onMounted(() => {
  // 保存重定向地址
  if (route.query.redirect) {
    redirect.value = route.query.redirect
  }
})

async function handleLogin() {
  loading.value = true
  
  try {
    // 构建 OAuth 完成后的返回地址（包含重定向信息）
    const returnUrl = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect.value)}`
    
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
  background: linear-gradient(135deg, #faf9f7 0%, #f0ede9 50%, #e8e4df 100%);
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
  background: white;
  border-radius: 24px;
  margin-bottom: 20px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
}

.login-logo {
  width: 56px;
  height: 56px;
  object-fit: contain;
}

.login-title {
  font-size: 28px;
  font-weight: 700;
  color: #3d3d3d;
  margin: 0 0 8px;
  letter-spacing: 1px;
}

.login-subtitle {
  font-size: 14px;
  color: #999;
  margin: 0;
}

.login-info {
  background: white;
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 24px;
  text-align: left;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.login-info-title {
  font-size: 14px;
  font-weight: 500;
  color: #666;
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
  color: #3d3d3d;
  padding: 10px 0;
  border-bottom: 1px solid #f5f3f0;
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
  background: linear-gradient(135deg, #b5a898 0%, #9f8f7d 100%);
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
  box-shadow: 0 6px 20px rgba(181, 168, 152, 0.4);
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

.login-tip {
  font-size: 12px;
  color: #bbb;
  margin: 0 0 28px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #b5a898;
  text-decoration: none;
  transition: color 0.2s;
}

.back-link:hover {
  color: #9f8f7d;
}

.back-icon {
  width: 16px;
  height: 16px;
}
</style>
