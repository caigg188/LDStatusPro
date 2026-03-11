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
      
      <!-- 搜索框和 GitHub（桌面端） -->
      <div class="header-center" v-if="!isMobile">
        <div class="header-search" ref="searchBoxRef">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜索商品..."
            @focus="openSearchPanel"
            @input="handleSearchInput"
            @keydown.esc="closeSearchPanel"
            @keyup.enter="handleSearch"
          />
          <button class="search-btn" @click="handleSearch">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          <div v-if="showSearchPanel" class="search-panel">
            <div v-if="filteredSearchHistory.length > 0" class="search-section">
              <div class="search-section-header">
                <span>搜索记录</span>
                <button class="search-clear-btn" @mousedown.prevent="clearSearchHistory">清空</button>
              </div>
              <div class="search-tags">
                <button
                  v-for="item in filteredSearchHistory"
                  :key="`history-${item}`"
                  class="search-tag history"
                  @mousedown.prevent="selectKeyword(item)"
                >
                  {{ item }}
                </button>
              </div>
            </div>
            <div v-if="filteredRecommendedKeywords.length > 0" class="search-section">
              <div class="search-section-header">
                <span>推荐搜索</span>
              </div>
              <div class="search-tags">
                <button
                  v-for="item in filteredRecommendedKeywords"
                  :key="`recommended-${item}`"
                  class="search-tag"
                  @mousedown.prevent="selectKeyword(item)"
                >
                  {{ item }}
                </button>
              </div>
            </div>
            <div
              v-if="filteredSearchHistory.length === 0 && filteredRecommendedKeywords.length === 0"
              class="search-empty"
            >
              暂无匹配结果
            </div>
          </div>
        </div>
        <router-link 
          to="/docs" 
          class="docs-btn"
          title="使用文档"
        >
          <svg height="20" width="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            <line x1="8" y1="7" x2="16" y2="7"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </router-link>
        <a 
          href="https://github.com/caigg188/LDStatusPro" 
          target="_blank" 
          rel="noopener" 
          class="github-btn"
          title="GitHub"
        >
          <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </a>
      </div>
      
      <!-- 访问统计（桌面端显示，移动端隐藏但保留用于不蒜子更新） -->
      <div class="header-visits" :class="{ 'visually-hidden': isMobile }">
        <span id="busuanzi_site_pv">-</span> 访问
        <span class="visit-sep">·</span>
        <span id="busuanzi_site_uv">-</span> 访客
      </div>
      
      <!-- 右侧操作区 -->
      <div class="header-actions">
        <!-- 主题切换 -->
        <ThemeToggle :showArrow="false" />
        
        <!-- 更多菜单（移动端） -->
        <div v-if="isMobile" class="more-dropdown" ref="moreDropdownRef">
          <button class="action-btn" @click="toggleMoreMenu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1"/>
              <circle cx="12" cy="5" r="1"/>
              <circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
          <div v-show="showMoreMenu" class="more-menu">
            <div class="more-menu-stats">
              <span class="mobile-pv">-</span> 访问
              <span class="visit-sep">·</span>
              <span class="mobile-uv">-</span> 访客
            </div>
            <div class="more-menu-divider"></div>
            <router-link to="/docs" class="more-menu-item" @click="closeMoreMenu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <span>使用文档</span>
            </router-link>
            <a href="https://github.com/caigg188/LDStatusPro" target="_blank" rel="noopener" class="more-menu-item" @click="closeMoreMenu">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </div>
        
        <!-- 发布按钮 -->
        <button v-if="isLoggedIn" class="action-btn publish-btn" @click="goToPublish">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        
        <!-- 用户信息 -->
        <template v-if="isLoggedIn">
          <div class="user-dropdown" ref="dropdownRef">
            <button class="user-info" :class="{ 'has-unread': messageUnread > 0 }" @click="toggleDropdown">
              <AvatarImage
                :src="avatar"
                :candidates="userStore.avatarCandidates"
                :seed="username || 'user'"
                :size="128"
                alt="avatar"
                class="user-avatar"
                loading-mode="eager"
              />
              <span class="user-name" v-if="!isMobile">{{ username }}</span>
              <span v-if="messageUnread > 0 && !isMobile" class="user-unread-inline">
                未读 {{ unreadDisplay }}
              </span>
              <span class="dropdown-arrow">▼</span>
              <span v-if="messageUnread > 0 && isMobile" class="user-unread-badge">
                {{ unreadDisplay }}
              </span>
            </button>
            
            <!-- 下拉菜单 -->
            <div v-show="showDropdown" class="dropdown-menu">
              <router-link to="/user" class="dropdown-header" @click="closeDropdown">
                <AvatarImage
                  :src="avatar"
                  :candidates="userStore.avatarCandidates"
                  :seed="username || 'user'"
                  :size="128"
                  alt="avatar"
                  class="dropdown-avatar"
                  loading-mode="eager"
                />
                <div class="dropdown-user-info">
                  <div class="dropdown-username">{{ username }}</div>
                  <div class="dropdown-trust" v-if="trustLevelText">信任等级: {{ trustLevelText }}</div>
                </div>
              </router-link>
              
              <div
                v-for="(group, groupIndex) in dropdownMenuGroups"
                :key="`dropdown-group-${groupIndex}`"
                class="dropdown-group"
              >
                <a
                  v-for="item in group"
                  :key="item.path"
                  :href="item.path"
                  class="dropdown-item"
                  :class="{ 'with-unread': item.withUnread }"
                  @click.prevent="navigateTo(item.path)"
                >
                  <span class="dropdown-item-icon">{{ item.icon }}</span>
                  <span class="dropdown-item-text">{{ item.label }}</span>
                  <span v-if="item.badge" class="dropdown-badge">{{ item.badge }}</span>
                </a>
              </div>
              
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import AvatarImage from '@/components/common/AvatarImage.vue'
import { storage } from '@/utils/storage'
import { api } from '@/utils/api'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// 响应式状态
const searchQuery = ref('')
const isMobile = ref(false)
const showDropdown = ref(false)
const dropdownRef = ref(null)
const showMoreMenu = ref(false)
const moreDropdownRef = ref(null)
const searchBoxRef = ref(null)
const showSearchPanel = ref(false)
const searchHistory = ref([])
const messageUnread = ref(0)
const recommendedKeywords = ['gpt', 'team', '小鸡', 'chatgpt', 'claude', 'vps', 'api', '存储', '代理']

// 计算属性
const isLoggedIn = computed(() => userStore.isLoggedIn)
const username = computed(() => userStore.username)
const avatar = computed(() => userStore.avatar)
const trustLevel = computed(() => userStore.trustLevel)
const trustLevelText = computed(() => (
  trustLevel.value === null || trustLevel.value === undefined ? '' : `TL${trustLevel.value}`
))
const unreadDisplay = computed(() => (messageUnread.value > 99 ? '99+' : String(messageUnread.value || 0)))
const dropdownMenuGroups = computed(() => ([
  [
    {
      path: '/user/messages',
      icon: '💬',
      label: '我的消息',
      withUnread: messageUnread.value > 0,
      badge: messageUnread.value > 0 ? unreadDisplay.value : ''
    },
    {
      path: '/user/favorites',
      icon: '⭐',
      label: '我的收藏',
      withUnread: false,
      badge: ''
    }
  ],
  [
    {
      path: '/user/orders',
      icon: '📋',
      label: '我的订单',
      withUnread: false,
      badge: ''
    },
    {
      path: '/user/products',
      icon: '📦',
      label: '我的物品',
      withUnread: false,
      badge: ''
    },
    {
      path: '/user/buy-requests',
      icon: '🌱',
      label: '我的求购',
      withUnread: false,
      badge: ''
    }
  ],
  [
    {
      path: '/user/settings',
      icon: '💳',
      label: '收款设置',
      withUnread: false,
      badge: ''
    },
    {
      path: '/user/my-shop',
      icon: '🏪',
      label: '小店入驻',
      withUnread: false,
      badge: ''
    },
    {
      path: '/ld-image',
      icon: '🖼️',
      label: '士多图床',
      withUnread: false,
      badge: ''
    },
    {
      path: '/merchant-services',
      icon: '🧰',
      label: '商家服务',
      withUnread: false,
      badge: ''
    }
  ]
]))
const shouldPollMessageUnread = computed(() => (
  isLoggedIn.value
  && String(route.name || '') !== 'MyMessages'
))
const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase())
const filteredSearchHistory = computed(() => {
  if (!normalizedSearchQuery.value) {
    return searchHistory.value.slice(0, 8)
  }
  return searchHistory.value
    .filter(item => item.toLowerCase().includes(normalizedSearchQuery.value))
    .slice(0, 8)
})
const filteredRecommendedKeywords = computed(() => {
  const historySet = new Set(searchHistory.value.map(item => item.toLowerCase()))
  if (!normalizedSearchQuery.value) {
    return recommendedKeywords.filter(item => !historySet.has(item.toLowerCase()))
  }
  return recommendedKeywords.filter(item => (
    item.toLowerCase().includes(normalizedSearchQuery.value)
    && !historySet.has(item.toLowerCase())
  ))
})

let messageUnreadTimer = null

// 下拉菜单控制
function toggleDropdown() {
  showDropdown.value = !showDropdown.value
  showMoreMenu.value = false
}

function closeDropdown() {
  showDropdown.value = false
}

// 更多菜单控制
function toggleMoreMenu() {
  showMoreMenu.value = !showMoreMenu.value
  showDropdown.value = false
  // 打开菜单时同步统计数据
  if (showMoreMenu.value) {
    setTimeout(syncBusuanziToMobile, 50)
  }
}

function closeMoreMenu() {
  showMoreMenu.value = false
}

function navigateTo(path) {
  closeDropdown()
  closeMoreMenu()
  closeSearchPanel()
  router.push(path)
}

function handleClickOutside(e) {
  if (searchBoxRef.value && !searchBoxRef.value.contains(e.target)) {
    closeSearchPanel()
  }
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    showDropdown.value = false
  }
  if (moreDropdownRef.value && !moreDropdownRef.value.contains(e.target)) {
    showMoreMenu.value = false
  }
}

// 退出登录
async function handleLogout() {
  closeDropdown()
  closeSearchPanel()
  userStore.logout()
  router.push('/')
}

// 方法
function loadSearchHistory() {
  const history = storage.get('search_history', [])
  if (Array.isArray(history)) {
    searchHistory.value = history
      .filter(item => typeof item === 'string' && item.trim())
      .slice(0, 10)
  } else {
    searchHistory.value = []
  }
}

function saveSearchHistory(keyword) {
  if (!keyword) return
  const history = searchHistory.value.filter(item => item !== keyword)
  history.unshift(keyword)
  searchHistory.value = history.slice(0, 10)
  storage.set('search_history', searchHistory.value)
}

function clearSearchHistory() {
  searchHistory.value = []
  storage.remove('search_history')
}

function openSearchPanel() {
  loadSearchHistory()
  showSearchPanel.value = true
}

function closeSearchPanel() {
  showSearchPanel.value = false
}

function handleSearchInput() {
  if (!showSearchPanel.value) {
    showSearchPanel.value = true
  }
}

function selectKeyword(keyword) {
  searchQuery.value = keyword
  handleSearch()
}

function handleSearch() {
  const keyword = searchQuery.value.trim()
  if (!keyword) return
  saveSearchHistory(keyword)
  closeSearchPanel()
  router.push({ name: 'Search', query: { q: keyword } })
  searchQuery.value = ''
}

function goToSearch() {
  closeSearchPanel()
  router.push({ name: 'Search' })
}

function goToPublish() {
  closeSearchPanel()
  router.push({ name: 'Publish' })
}

function checkMobile() {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value) {
    closeSearchPanel()
  }
}

// 同步不蒜子统计数据到移动端
function syncBusuanziToMobile() {
  const pvSource = document.getElementById('busuanzi_site_pv')
  const uvSource = document.getElementById('busuanzi_site_uv')
  const pvTargets = document.querySelectorAll('.mobile-pv')
  const uvTargets = document.querySelectorAll('.mobile-uv')
  
  if (pvSource) {
    pvTargets.forEach(el => el.textContent = pvSource.textContent)
  }
  if (uvSource) {
    uvTargets.forEach(el => el.textContent = uvSource.textContent)
  }
}

let busuanziObserver = null
async function fetchMessageUnread(force = false) {
  if (!isLoggedIn.value) {
    messageUnread.value = 0
    return
  }
  if (!force && document.visibilityState === 'hidden') {
    return
  }

  try {
    const result = await api.get('/api/shop/messages/unread-summary')
    if (!result.success) return
    messageUnread.value = Number(result.data?.totalUnread || 0)
  } catch (_) {
    // ignore polling errors
  }
}

function startMessageUnreadPolling() {
  stopMessageUnreadPolling()
  if (!shouldPollMessageUnread.value) {
    return
  }
  messageUnreadTimer = setInterval(() => {
    fetchMessageUnread()
  }, 10000)
}

function stopMessageUnreadPolling() {
  if (messageUnreadTimer) {
    clearInterval(messageUnreadTimer)
    messageUnreadTimer = null
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && shouldPollMessageUnread.value) {
    fetchMessageUnread(true)
  }
}

onMounted(() => {
  loadSearchHistory()
  checkMobile()
  fetchMessageUnread(true)
  startMessageUnreadPolling()
  window.addEventListener('resize', checkMobile)
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  
  // 监听桌面端不蒜子元素变化，同步到移动端
  const pvElement = document.getElementById('busuanzi_site_pv')
  if (pvElement) {
    busuanziObserver = new MutationObserver(syncBusuanziToMobile)
    busuanziObserver.observe(pvElement, { childList: true, characterData: true, subtree: true })
  }
  // 延迟初始同步
  setTimeout(syncBusuanziToMobile, 1500)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  busuanziObserver?.disconnect()
  stopMessageUnreadPolling()
})

watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    fetchMessageUnread(true)
    startMessageUnreadPolling()
  } else {
    stopMessageUnreadPolling()
    messageUnread.value = 0
  }
})

watch(
  () => route.name,
  () => {
    if (shouldPollMessageUnread.value) {
      fetchMessageUnread(true)
      startMessageUnreadPolling()
      return
    }

    stopMessageUnreadPolling()
  }
)
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  /* 液态玻璃效果 */
  background: var(--glass-bg);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 1px solid var(--glass-border);
  box-shadow: 
    0 1px 3px var(--glass-shadow-light),
    inset 0 1px 0 var(--glass-inset-shadow);
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
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.header-center {
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 450px;
  gap: 8px;
}

.header-search {
  flex: 1;
  position: relative;
}

.search-input {
  width: 100%;
  padding: 10px 44px 10px 16px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 12px;
  font-size: 14px;
  color: var(--text-primary);
  transition: all 0.2s;
}

.search-input:focus {
  background: var(--input-focus-bg);
  border-color: var(--input-focus-border);
  box-shadow: 0 2px 8px var(--glass-shadow-light);
}

.search-input::placeholder {
  color: var(--text-placeholder);
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

.search-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 100%;
  background: var(--dropdown-bg);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  box-shadow: var(--dropdown-shadow);
  padding: 10px;
  z-index: 1010;
  animation: dropdownFadeIn 0.18s ease;
}

.search-section + .search-section {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-light);
}

.search-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.search-clear-btn {
  padding: 0;
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
}

.search-clear-btn:hover {
  color: var(--text-secondary);
}

.search-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.search-tag {
  padding: 4px 10px;
  border: none;
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.search-tag:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.search-tag.history {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.search-empty {
  padding: 8px 4px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
}

.docs-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-left: 8px;
  background: var(--input-bg);
  border: none;
  border-radius: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.docs-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.github-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-left: 8px;
  background: var(--input-bg);
  border: none;
  border-radius: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.github-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.header-visits {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.header-visits.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.header-visits .visit-sep {
  color: var(--text-tertiary);
  margin: 0 2px;
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
  background: var(--input-bg);
  border: none;
  border-radius: 10px;
  font-size: 16px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.publish-btn {
  background: var(--publish-btn-bg);
  color: var(--publish-btn-color);
  box-shadow: var(--publish-btn-shadow);
}

.publish-btn:hover {
  background: var(--publish-btn-hover-bg);
  color: var(--publish-btn-color);
  box-shadow: var(--publish-btn-hover-shadow);
}

/* 用户下拉菜单 */
.user-dropdown {
  position: relative;
}

.user-info {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 6px;
  background: var(--input-bg);
  border: none;
  border-radius: 20px;
  cursor: pointer;
  transition: background 0.2s;
}

.user-info.has-unread {
  box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.28);
}

.user-info:hover {
  background: var(--bg-tertiary);
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
  color: var(--text-primary);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-unread-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 46px;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(220, 38, 38, 0.12);
  color: #dc2626;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.user-unread-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  padding: 0 5px;
  border: 2px solid var(--bg-primary);
  box-shadow: 0 2px 8px rgba(220, 38, 38, 0.35);
}

.dropdown-arrow {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-left: 4px;
}

/* 下拉菜单内容 */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 220px;
  background: var(--dropdown-bg);
  border-radius: 16px;
  box-shadow: var(--dropdown-shadow);
  border: 1px solid var(--border-light);
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
  text-decoration: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown-header:hover {
  background: var(--bg-secondary);
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
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-trust {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.dropdown-divider {
  height: 1px;
  background: var(--border-light);
  margin: 4px 0;
}

.dropdown-group + .dropdown-group {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border-light);
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
  color: var(--text-primary);
  text-decoration: none;
  cursor: pointer;
  transition: background 0.2s;
  text-align: left;
}

.dropdown-item-icon {
  flex-shrink: 0;
  width: 18px;
  text-align: center;
}

.dropdown-item-text {
  flex: 1;
  min-width: 0;
}

.dropdown-item:hover {
  background: var(--bg-secondary);
}

.dropdown-item.with-unread {
  background: rgba(220, 38, 38, 0.06);
}

.dropdown-badge {
  margin-left: auto;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: #dc2626;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.dropdown-item.logout {
  color: var(--color-danger);
}

.dropdown-item.logout:hover {
  background: var(--color-danger-bg);
}

.login-btn {
  padding: 8px 16px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
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

/* 更多菜单（移动端） */
.more-dropdown {
  position: relative;
}

.more-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 180px;
  background: var(--dropdown-bg);
  border-radius: 12px;
  box-shadow: var(--dropdown-shadow);
  padding: 8px;
  z-index: 1000;
  border: 1px solid var(--border-light);
}

.more-menu-stats {
  padding: 10px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
}

.more-menu-stats .visit-sep {
  margin: 0 6px;
  color: var(--text-muted);
}

.more-menu-divider {
  height: 1px;
  background: var(--border-light);
  margin: 4px 0;
}

.more-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-primary);
  text-decoration: none;
  cursor: pointer;
  transition: background 0.2s;
}

.more-menu-item:hover {
  background: var(--bg-secondary);
}

.more-menu-item svg {
  flex-shrink: 0;
  color: var(--text-secondary);
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

  .dropdown-arrow {
    display: none;
  }
}
</style>
