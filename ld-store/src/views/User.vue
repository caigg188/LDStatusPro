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
            referrerpolicy="no-referrer"
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
          
          <router-link to="/user/favorites" class="menu-item">
            <span class="menu-icon">⭐</span>
            <span class="menu-label">我的收藏</span>
            <span class="menu-arrow">→</span>
          </router-link>

          <router-link to="/user/buy-requests" class="menu-item">
            <span class="menu-icon">🌱</span>
            <span class="menu-label">我的求购</span>
            <span class="menu-arrow">→</span>
          </router-link>

          <router-link to="/user/buy-chats" class="menu-item">
            <span class="menu-icon">💬</span>
            <span class="menu-label">聊天洽谈</span>
            <span class="menu-arrow">→</span>
          </router-link>

          <router-link to="/user/products" class="menu-item">
            <span class="menu-icon">📦</span>
            <span class="menu-label">我的物品</span>
            <span class="menu-arrow">→</span>
          </router-link>
          
          <router-link to="/publish" class="menu-item">
            <span class="menu-icon">➕</span>
            <span class="menu-label">发布物品</span>
            <span class="menu-arrow">→</span>
          </router-link>
          
          <router-link to="/user/settings" class="menu-item">
            <span class="menu-icon">⚙️</span>
            <span class="menu-label">收款设置</span>
            <span class="menu-arrow">→</span>
          </router-link>
          
          <router-link to="/user/my-shop" class="menu-item">
            <span class="menu-icon">🏪</span>
            <span class="menu-label">小店入驻</span>
            <span class="menu-arrow">→</span>
          </router-link>
        </div>
      </div>
      
      <!-- 其他菜单 -->
      <div class="menu-section">
        <h3 class="section-title">其他</h3>
        
        <div class="menu-list">
          <router-link to="/ld-image" class="menu-item">
            <span class="menu-icon">🖼️</span>
            <span class="menu-label">士多图床</span>
            <span class="menu-arrow">→</span>
          </router-link>
          
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
            href="https://ldspro.qzz.io/"
            target="_blank"
            rel="noopener"
            class="menu-item"
          >
            <span class="menu-icon">📊</span>
            <span class="menu-label">LDStatus Pro</span>
            <span class="menu-arrow">↗</span>
          </a>
          
          <a
            href="https://github.com/caigg188/LDStatusPro"
            target="_blank"
            rel="noopener"
            class="menu-item"
          >
            <span class="menu-icon">🐙</span>
            <span class="menu-label">GitHub</span>
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
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const userStore = useUserStore()
const dialog = useDialog()
const toast = useToast()

// 计算属性
const user = computed(() => userStore.user)
const username = computed(() => user.value?.name || user.value?.username || '用户')
const avatar = computed(() => userStore.avatar || 'https://linux.do/favicon.ico')
const ldcInfo = computed(() => userStore.ldcInfo)

// 加载 LDC 信息
onMounted(async () => {
  await userStore.fetchLdcInfo()
})

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
  background: var(--bg-primary);
}

.page-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
}

/* 用户卡片 */
.user-card {
  background: var(--bg-card);
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
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
  border: 3px solid var(--border-light);
}

.user-detail {
  flex: 1;
}

.user-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
}

.user-id {
  font-size: 14px;
  color: var(--text-tertiary);
  margin: 0;
}

/* 余额 */
.balance-section {
  display: flex;
  gap: 20px;
  padding: 20px;
  background: var(--bg-tertiary);
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
  color: var(--text-tertiary);
  margin-bottom: 4px;
}

.balance-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-warning);
}

.balance-value.secondary {
  color: var(--color-info);
}

.balance-unit {
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 菜单区域 */
.menu-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-tertiary);
  margin: 0 0 12px 4px;
}

.menu-list {
  background: var(--bg-card);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  text-decoration: none;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-light);
  transition: background 0.2s;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover {
  background: var(--bg-secondary);
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
  color: var(--text-tertiary);
}

/* 退出按钮 */
.logout-btn {
  width: 100%;
  padding: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  font-size: 15px;
  color: var(--color-danger);
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 20px;
}

.logout-btn:hover {
  border-color: var(--color-danger);
  background: var(--color-danger-light);
}
</style>
