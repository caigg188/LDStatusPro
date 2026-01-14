<template>
  <div class="user-page">
    <div class="page-container">
      <!-- 用户卡片 -->
      <div class="user-card">
        <div class="user-info">
          <img
            :src="avatar"
            alt=""
            class="user-avatar"
            @error="handleAvatarError"
          />
          <div class="user-detail">
            <h2 class="user-name">{{ username }}</h2>
            <p class="user-id">@{{ user?.username }}</p>
          </div>
        </div>
        
        <!-- LDC 余额 -->
        <div class="balance-section" v-if="ldcInfo">
          <div class="balance-item">
            <span class="balance-label">可用余额</span>
            <span class="balance-value">{{ ldcInfo.available_balance || '0.00' }}</span>
            <span class="balance-unit">LDC</span>
          </div>
          <div class="balance-item">
            <span class="balance-label">今日额度</span>
            <span class="balance-value secondary">{{ ldcInfo.remain_quota || '0.00' }}</span>
            <span class="balance-unit">LDC</span>
          </div>
        </div>
        
        <button class="refresh-btn" @click="refreshLdcInfo" :disabled="refreshing">
          {{ refreshing ? '刷新中...' : '🔄 刷新余额' }}
        </button>
      </div>
      
      <!-- 功能菜单 -->
      <div class="menu-section">
        <h3 class="section-title">我的服务</h3>
        
        <div class="menu-list">
          <router-link to="/user/orders" class="menu-item">
            <span class="menu-icon">📋</span>
            <span class="menu-label">我的订单</span>
            <span class="menu-arrow">→</span>
          </router-link>
          
          <router-link to="/user/products" class="menu-item">
            <span class="menu-icon">📦</span>
            <span class="menu-label">我的商品</span>
            <span class="menu-arrow">→</span>
          </router-link>
          
          <router-link to="/publish" class="menu-item">
            <span class="menu-icon">➕</span>
            <span class="menu-label">发布商品</span>
            <span class="menu-arrow">→</span>
          </router-link>
          
          <router-link to="/user/settings" class="menu-item">
            <span class="menu-icon">⚙️</span>
            <span class="menu-label">收款设置</span>
            <span class="menu-arrow">→</span>
          </router-link>
        </div>
      </div>
      
      <!-- 其他菜单 -->
      <div class="menu-section">
        <h3 class="section-title">其他</h3>
        
        <div class="menu-list">
          <a
            href="https://credit.linux.do/home"
            target="_blank"
            rel="noopener"
            class="menu-item"
          >
            <span class="menu-icon">🏦</span>
            <span class="menu-label">LDC 官网</span>
            <span class="menu-arrow">↗</span>
          </a>
          
          <a
            href="https://linux.do"
            target="_blank"
            rel="noopener"
            class="menu-item"
          >
            <span class="menu-icon">🌐</span>
            <span class="menu-label">Linux.do 社区</span>
            <span class="menu-arrow">↗</span>
          </a>
          
          <a
            href="https://linux.do/t/topic/13716"
            target="_blank"
            rel="noopener"
            class="menu-item"
          >
            <span class="menu-icon">📊</span>
            <span class="menu-label">LDStatus Pro</span>
            <span class="menu-arrow">↗</span>
          </a>
        </div>
      </div>
      
      <!-- 退出登录 -->
      <button class="logout-btn" @click="handleLogout">
        退出登录
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const userStore = useUserStore()
const dialog = useDialog()
const toast = useToast()

const refreshing = ref(false)

// 计算属性
const user = computed(() => userStore.user)
const username = computed(() => user.value?.name || user.value?.username || '用户')
const avatar = computed(() => userStore.avatar || 'https://linux.do/favicon.ico')
const ldcInfo = computed(() => userStore.ldcInfo)

// 加载 LDC 信息
onMounted(async () => {
  await userStore.fetchLdcInfo()
})

// 刷新 LDC 信息
async function refreshLdcInfo() {
  refreshing.value = true
  await userStore.refreshLdcInfo()
  toast.success('余额已刷新')
  refreshing.value = false
}

// 头像加载失败
function handleAvatarError(e) {
  e.target.src = 'https://linux.do/favicon.ico'
}

// 退出登录
async function handleLogout() {
  const confirmed = await dialog.confirm('确定要退出登录吗？', {
    title: '退出登录',
    icon: '🚪',
    danger: true
  })
  
  if (confirmed) {
    userStore.logout()
    toast.success('已退出登录')
    router.replace('/')
  }
}
</script>

<style scoped>
.user-page {
  min-height: 100vh;
  padding-bottom: 80px;
  background: #faf9f7;
}

.page-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
}

/* 用户卡片 */
.user-card {
  background: white;
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.user-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #f5f3f0;
}

.user-detail {
  flex: 1;
}

.user-name {
  font-size: 20px;
  font-weight: 700;
  color: #3d3d3d;
  margin: 0 0 4px;
}

.user-id {
  font-size: 14px;
  color: #999;
  margin: 0;
}

/* 余额 */
.balance-section {
  display: flex;
  gap: 20px;
  padding: 20px;
  background: linear-gradient(135deg, #f9f7f5 0%, #f5f3f0 100%);
  border-radius: 16px;
  margin-bottom: 16px;
}

.balance-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.balance-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.balance-value {
  font-size: 24px;
  font-weight: 700;
  color: #cfa76f;
}

.balance-value.secondary {
  color: #778d9c;
}

.balance-unit {
  font-size: 12px;
  color: #999;
}

.refresh-btn {
  width: 100%;
  padding: 12px;
  background: #f5f3f0;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #ebe7e1;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 菜单区域 */
.menu-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #999;
  margin: 0 0 12px 4px;
}

.menu-list {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  text-decoration: none;
  color: #3d3d3d;
  border-bottom: 1px solid #f5f3f0;
  transition: background 0.2s;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover {
  background: #faf9f7;
}

.menu-icon {
  font-size: 20px;
  margin-right: 14px;
}

.menu-label {
  flex: 1;
  font-size: 15px;
}

.menu-arrow {
  font-size: 16px;
  color: #999;
}

/* 退出按钮 */
.logout-btn {
  width: 100%;
  padding: 16px;
  background: white;
  border: 1px solid #f0ede9;
  border-radius: 16px;
  font-size: 15px;
  color: #ad9090;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 20px;
}

.logout-btn:hover {
  border-color: #ad9090;
  background: #faf8f8;
}
</style>
