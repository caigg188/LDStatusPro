<template>
  <div class="login-page">
    <div class="login-container">
      <!-- Logo -->
      <div class="login-header">
        <img
          src="/favicon.svg"
          alt="LD士多"
          class="login-logo"
        />
        <h1 class="login-title">LD士多</h1>
        <p class="login-subtitle">LDC 积分兑换商城</p>
      </div>
      
      <!-- 登录说明 -->
      <div class="login-info">
        <p>使用 Linux.do 账号登录，即可：</p>
        <ul class="login-features">
          <li>🛒 使用 LDC 积分兑换商品</li>
          <li>📦 发布和管理您的商品</li>
          <li>📋 查看订单和交易记录</li>
          <li>💰 设置收款信息接收付款</li>
        </ul>
      </div>
      
      <!-- 登录按钮 -->
      <button
        class="login-btn"
        :disabled="loading"
        @click="handleLogin"
      >
        <img
          src="https://linux.do/uploads/default/optimized/4X/6/a/6/6a6affc7b1ce8140279e959d32671304db06d5ab_2_180x180.png"
          alt=""
          class="login-btn-icon"
        />
        <span>{{ loading ? '正在跳转...' : '使用 Linux.do 账号登录' }}</span>
      </button>
      
      <!-- 提示 -->
      <p class="login-tip">
        登录即表示您同意我们的服务条款
      </p>
      
      <!-- 返回首页 -->
      <router-link to="/" class="back-link">
        ← 返回首页
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
  background: linear-gradient(135deg, #faf9f7 0%, #f5f3f0 100%);
}

.login-container {
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.login-header {
  margin-bottom: 32px;
}

.login-logo {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  margin-bottom: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.login-title {
  font-size: 28px;
  font-weight: 700;
  color: #3d3d3d;
  margin: 0 0 8px;
}

.login-subtitle {
  font-size: 14px;
  color: #999;
  margin: 0;
}

.login-info {
  background: white;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  text-align: left;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.login-info p {
  font-size: 14px;
  color: #666;
  margin: 0 0 16px;
}

.login-features {
  list-style: none;
  padding: 0;
  margin: 0;
}

.login-features li {
  font-size: 14px;
  color: #3d3d3d;
  padding: 8px 0;
  border-bottom: 1px solid #f0ede9;
}

.login-features li:last-child {
  border-bottom: none;
}

.login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  padding: 16px 24px;
  background: linear-gradient(135deg, #b5a898 0%, #9f8f7d 100%);
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 16px;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(181, 168, 152, 0.4);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-btn-icon {
  font-size: 20px;
  line-height: 1;
}

.login-tip {
  font-size: 12px;
  color: #999;
  margin: 0 0 24px;
}

.back-link {
  font-size: 14px;
  color: #b5a898;
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}
</style>
