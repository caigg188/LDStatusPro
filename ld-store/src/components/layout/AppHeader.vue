<template>
  <header class="app-header">
    <div class="header-content">
      <!-- Logo 和标题 -->
      <router-link to="/" class="header-brand">
        <img
          src="/favicon.svg"
          alt="LD士多"
          class="header-logo"
        />
        <span class="header-title">LD士多</span>
      </router-link>
      
      <!-- 搜索框（桌面端） -->
      <div class="header-search" v-if="!isMobile">
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="搜索商品..."
          @keyup.enter="handleSearch"
        />
        <button class="search-btn" @click="handleSearch">
          🔍
        </button>
      </div>
      
      <!-- 右侧操作区 -->
      <div class="header-actions">
        <!-- 搜索按钮（移动端） -->
        <button v-if="isMobile" class="action-btn" @click="goToSearch">
          🔍
        </button>
        
        <!-- 发布按钮 -->
        <button v-if="isLoggedIn" class="action-btn publish-btn" @click="goToPublish">
          ➕
        </button>
        
        <!-- 用户信息 -->
        <template v-if="isLoggedIn">
          <div class="user-dropdown" ref="dropdownRef">
            <button class="user-info" @click="toggleDropdown">
              <img
                :src="avatar || 'https://linux.do/favicon.ico'"
                alt="avatar"
                class="user-avatar"
                @error="handleAvatarError"
              />
              <span class="user-name" v-if="!isMobile">{{ username }}</span>
              <span class="dropdown-arrow">▼</span>
            </button>
            
            <!-- 下拉菜单 -->
            <div v-if="showDropdown" class="dropdown-menu">
              <div class="dropdown-header">
                <img
                  :src="avatar || 'https://linux.do/favicon.ico'"
                  alt="avatar"
                  class="dropdown-avatar"
                  @error="handleAvatarError"
                />
                <div class="dropdown-user-info">
                  <div class="dropdown-username">{{ username }}</div>
                  <div class="dropdown-trust" v-if="trustLevel">信任等级: {{ trustLevel }}</div>
                </div>
              </div>
              
              <div class="dropdown-divider"></div>
              
              <router-link to="/user/orders" class="dropdown-item" @click="closeDropdown">
                📋 我的订单
              </router-link>
              <router-link to="/user/products" class="dropdown-item" @click="closeDropdown">
                📦 我发布的
              </router-link>
              <router-link to="/user/settings" class="dropdown-item" @click="closeDropdown">
                💳 收款设置
              </router-link>
              
              <div class="dropdown-divider"></div>
              
              <button class="dropdown-item logout" @click="handleLogout">
                🚪 退出登录
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <router-link to="/login" class="login-btn">
            登录
          </router-link>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

// 响应式状态
const searchQuery = ref('')
const isMobile = ref(false)
const showDropdown = ref(false)
const dropdownRef = ref(null)

// 计算属性
const isLoggedIn = computed(() => userStore.isLoggedIn)
const username = computed(() => userStore.username)
const avatar = computed(() => userStore.avatar)
const trustLevel = computed(() => userStore.trustLevel)

// 下拉菜单控制
function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}

function closeDropdown() {
  showDropdown.value = false
}

function handleClickOutside(e) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    showDropdown.value = false
  }
}

// 退出登录
async function handleLogout() {
  closeDropdown()
  userStore.logout()
  router.push('/')
}

// 方法
function handleSearch() {
  if (searchQuery.value.trim()) {
    router.push({ name: 'Search', query: { q: searchQuery.value.trim() } })
    searchQuery.value = ''
  }
}

function goToSearch() {
  router.push({ name: 'Search' })
}

function goToPublish() {
  router.push({ name: 'Publish' })
}

function handleAvatarError(e) {
  e.target.src = 'https://linux.do/favicon.ico'
}

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding-top: env(safe-area-inset-top, 0);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 16px;
  gap: 16px;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  flex-shrink: 0;
}

.header-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.header-title {
  font-size: 18px;
  font-weight: 700;
  color: #3d3d3d;
  letter-spacing: -0.5px;
}

.header-search {
  flex: 1;
  max-width: 400px;
  position: relative;
}

.search-input {
  width: 100%;
  padding: 10px 44px 10px 16px;
  background: #f5f3f0;
  border: 1px solid transparent;
  border-radius: 12px;
  font-size: 14px;
  color: #3d3d3d;
  transition: all 0.2s;
}

.search-input:focus {
  background: white;
  border-color: #ddd7ce;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.search-input::placeholder {
  color: #b5a898;
}

.search-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  padding: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.search-btn:hover {
  opacity: 1;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f3f0;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #ebe7e1;
}

.publish-btn {
  background: linear-gradient(135deg, #b5a898 0%, #9f8f7d 100%);
  color: white;
}

.publish-btn:hover {
  opacity: 0.9;
  background: linear-gradient(135deg, #b5a898 0%, #9f8f7d 100%);
}

/* 用户下拉菜单 */
.user-dropdown {
  position: relative;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 6px;
  background: #f5f3f0;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  transition: background 0.2s;
}

.user-info:hover {
  background: #ebe7e1;
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #3d3d3d;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-arrow {
  font-size: 10px;
  color: #999;
  margin-left: 4px;
}

/* 下拉菜单内容 */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 200px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  padding: 8px;
  z-index: 1000;
  animation: dropdownFadeIn 0.2s ease;
}

@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
}

.dropdown-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.dropdown-user-info {
  flex: 1;
  min-width: 0;
}

.dropdown-username {
  font-size: 15px;
  font-weight: 600;
  color: #3d3d3d;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-trust {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.dropdown-divider {
  height: 1px;
  background: #f0ede9;
  margin: 4px 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px;
  background: transparent;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  color: #3d3d3d;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.2s;
  text-align: left;
}

.dropdown-item:hover {
  background: #f5f3f0;
}

.dropdown-item.logout {
  color: #ad9090;
}

.dropdown-item.logout:hover {
  background: #faf5f5;
}

.login-btn {
  padding: 8px 16px;
  background: linear-gradient(135deg, #b5a898 0%, #9f8f7d 100%);
  color: white;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: opacity 0.2s;
}

.login-btn:hover {
  opacity: 0.9;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .header-content {
    padding: 10px 12px;
  }

  .header-logo {
    width: 28px;
    height: 28px;
  }

  .header-title {
    font-size: 16px;
  }

  .action-btn {
    width: 36px;
    height: 36px;
  }

  .user-info {
    padding: 4px;
  }

  .user-avatar {
    width: 32px;
    height: 32px;
  }
}
</style>
