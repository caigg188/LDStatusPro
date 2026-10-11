<template>
  <header class="app-header">
    <div class="header-content">
      <!-- Logo 和标题 -->
      <router-link to="/" class="header-brand">
        <StoreLogo class="header-logo" decorative />
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
            aria-label="搜索商品"
            @focus="openSearchPanel"
            @input="handleSearchInput"
            @keydown.esc="closeSearchPanel"
            @keyup.enter="handleSearch"
          />
          <button type="button" class="search-btn" aria-label="搜索" @click="handleSearch">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          <div v-if="showSearchPanel" class="search-panel">
            <div v-if="filteredSearchHistory.length > 0" class="search-section">
              <div class="search-section-header">
                <span>搜索记录</span>
                <button class="search-clear-btn" @mousedown.prevent="clearHeaderSearchHistory">清空</button>
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
          title="帮助中心"
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
      
      <!-- 右侧操作区 -->
      <div class="header-actions">
        <!-- 主题切换 -->
        <ThemeToggle class="header-theme" :showArrow="false" />
        
        <!-- 更多菜单（移动端） -->
        <div v-if="isMobile" class="more-dropdown" ref="moreDropdownRef">
          <button class="action-btn" @click="goToSearch" title="搜索">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          <button type="button" class="action-btn" aria-label="更多选项" :aria-expanded="showMoreMenu" @click="toggleMoreMenu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1"/>
              <circle cx="12" cy="5" r="1"/>
              <circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
          <div v-show="showMoreMenu" class="more-menu">
            <router-link to="/docs" class="more-menu-item" @click="closeMoreMenu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <span>帮助中心</span>
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
        <button v-if="isLoggedIn" type="button" class="action-btn publish-btn" aria-label="发布商品" title="发布商品" @click="goToPublish">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        
        <!-- 用户信息 -->
        <template v-if="isLoggedIn">
          <div
            class="user-dropdown"
            ref="dropdownRef"
            @keydown="handleDropdownKeydown"
            @focusout="handleDropdownFocusOut"
          >
            <button
              ref="dropdownTriggerRef"
              type="button"
              class="user-info"
              :class="{ 'has-unread': headerAlertCount > 0, 'is-open': showDropdown }"
              :aria-expanded="showDropdown"
              aria-controls="header-user-menu"
              :aria-label="userButtonLabel"
              :title="userButtonLabel"
              @click="toggleDropdown"
            >
              <span class="user-avatar-motion">
                <AvatarImage
                  :src="avatar"
                  :candidates="userStore.avatarCandidates"
                  :seed="username || 'user'"
                  :size="128"
                  alt=""
                  class="user-avatar"
                  loading-mode="eager"
                />
              </span>
              <span v-if="!isMobile" class="user-identity">
                <span class="user-name">{{ userIdentity.displayName }}</span>
                <span v-if="userIdentity.handle" class="user-handle user-account">{{ userIdentity.handle }}</span>
              </span>
              <ChevronDown class="dropdown-arrow" :size="14" :stroke-width="2" aria-hidden="true" />
              <span v-if="headerAlertCount > 0" class="user-unread-badge" aria-hidden="true">
                {{ headerAlertDisplay }}
              </span>
            </button>
            <span class="header-alert-status" role="status" aria-live="polite" aria-atomic="true">
              {{ userAlertStatusText }}
            </span>
            
            <!-- 下拉菜单 -->
            <Transition name="user-menu">
              <nav
                v-show="showDropdown"
                id="header-user-menu"
                ref="dropdownMenuRef"
                class="dropdown-menu"
                aria-label="个人菜单"
                :aria-hidden="!showDropdown"
                :inert="!showDropdown"
              >
                <div class="dropdown-content">
                  <router-link
                    to="/user"
                    class="dropdown-header"
                    :aria-label="userProfileLabel"
                    @click="closeDropdown"
                  >
                    <AvatarImage
                      :src="avatar"
                      :candidates="userStore.avatarCandidates"
                      :seed="username || 'user'"
                      :size="128"
                      alt=""
                      class="dropdown-avatar"
                      loading-mode="eager"
                    />
                    <div class="dropdown-user-info">
                      <div class="dropdown-username" :title="userIdentity.displayName">{{ userIdentity.displayName }}</div>
                      <div class="user-meta dropdown-meta">
                        <span
                          v-if="userIdentity.trustLabel"
                          class="user-trust-badge"
                          :aria-label="`信任等级 ${userIdentity.trustLabel}`"
                        >{{ userIdentity.trustLabel }}</span>
                        <span v-if="userIdentity.handle" class="user-handle" :title="userIdentity.handle">{{ userIdentity.handle }}</span>
                      </div>
                    </div>
                  </router-link>
                  <div v-if="userAlertText" class="dropdown-alert-summary" aria-hidden="true">{{ userAlertText }}</div>

                  <div
                    v-for="(group, groupIndex) in dropdownMenuGroups"
                    :key="`dropdown-group-${groupIndex}`"
                    class="dropdown-group"
                  >
                    <router-link
                      v-for="item in group"
                      :key="item.path"
                      :to="item.path"
                      class="dropdown-item"
                      :class="{ 'with-unread': item.withUnread }"
                      @click="closeDropdown"
                    >
                      <span class="dropdown-item-icon" aria-hidden="true">
                        <component :is="item.iconComponent" :size="18" :stroke-width="2" />
                      </span>
                      <span class="dropdown-item-text">{{ item.label }}</span>
                      <span v-if="item.badge" class="dropdown-badge">{{ item.badge }}</span>
                    </router-link>
                  </div>

                  <div class="dropdown-divider"></div>

                  <button type="button" class="dropdown-item logout" @click="handleLogout">
                    <LogOut class="dropdown-item-icon" :size="18" :stroke-width="2" aria-hidden="true" />
                    <span class="dropdown-item-text">退出登录</span>
                  </button>
                </div>
              </nav>
            </Transition>
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
import { storeToRefs } from 'pinia'
import { ChevronDown, LogOut } from '@lucide/vue'
import StoreLogo from '@/components/common/StoreLogo.vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useNotificationSummaryStore } from '@/stores/notificationSummary'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import AvatarImage from '@/components/common/AvatarImage.vue'
import { storage } from '@/utils/storage'
import { DEFAULT_SEARCH_KEYWORDS, loadSearchHistory, saveSearchHistory, clearSearchHistory } from '@/utils/search'
import { buildUserDropdownMenuGroups } from '@/config/userMenu'
import { useDropdownMenu } from '@/composables/useDropdownMenu'
import { buildUserIdentity } from '@/utils/userIdentity'
import { isMobileNav } from '@/config/breakpoints'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const notificationSummaryStore = useNotificationSummaryStore()
const {
  totalUnread: messageUnread,
  sellerPendingDeliveryCount,
  sellerRefundPendingCount
} = storeToRefs(notificationSummaryStore)

// 响应式状态
const searchQuery = ref('')
const isMobile = ref(false)
const {
  isOpen: showDropdown,
  rootRef: dropdownRef,
  triggerRef: dropdownTriggerRef,
  menuRef: dropdownMenuRef,
  close: closeDropdown,
  toggle: toggleDropdown,
  handleKeydown: handleDropdownKeydown,
  handleFocusOut: handleDropdownFocusOut
} = useDropdownMenu()
const showMoreMenu = ref(false)
const moreDropdownRef = ref(null)
const searchBoxRef = ref(null)
const showSearchPanel = ref(false)
const searchHistory = ref([])
const recommendedKeywords = DEFAULT_SEARCH_KEYWORDS

// 计算属性
const isLoggedIn = computed(() => userStore.isLoggedIn)
const username = computed(() => userStore.username)
const avatar = computed(() => userStore.avatar)
const userIdentity = computed(() => buildUserIdentity({
  name: userStore.currentUser?.name,
  username: username.value,
  trustLevel: userStore.trustLevel
}))
const unreadDisplay = computed(() => (messageUnread.value > 99 ? '99+' : String(messageUnread.value || 0)))
const pendingDeliveryDisplay = computed(() => (
  sellerPendingDeliveryCount.value > 99 ? '99+' : String(sellerPendingDeliveryCount.value || 0)
))
const refundPendingDisplay = computed(() => (
  sellerRefundPendingCount.value > 99 ? '99+' : String(sellerRefundPendingCount.value || 0)
))
const headerAlertCount = computed(() => (
  messageUnread.value + sellerPendingDeliveryCount.value + sellerRefundPendingCount.value
))
const headerAlertDisplay = computed(() => (
  headerAlertCount.value > 99 ? '99+' : String(headerAlertCount.value || 0)
))
const userAlertText = computed(() => {
  const parts = []
  if (messageUnread.value > 0) parts.push(`消息 ${unreadDisplay.value}`)
  if (sellerPendingDeliveryCount.value > 0) parts.push(`待发 ${pendingDeliveryDisplay.value}`)
  if (sellerRefundPendingCount.value > 0) parts.push(`售后 ${refundPendingDisplay.value}`)
  return parts.join(' · ')
})
const userAlertStatusText = computed(() => (
  headerAlertCount.value > 0
    ? `${userAlertText.value}，共 ${headerAlertCount.value} 项未读或待处理`
    : '暂无未读消息或待处理事项'
))
const userButtonLabel = computed(() => [
  userIdentity.value.displayName,
  userIdentity.value.handle,
  userAlertText.value,
  showDropdown.value ? '收起用户菜单' : '打开用户菜单'
].filter(Boolean).join('，'))
const userProfileLabel = computed(() => [
  userIdentity.value.displayName,
  userIdentity.value.handle,
  userIdentity.value.trustLabel ? `信任等级 ${userIdentity.value.trustLabel}` : '',
  '个人中心'
].filter(Boolean).join('，'))
const dropdownMenuGroups = computed(() => buildUserDropdownMenuGroups({
  messageUnread: messageUnread.value,
  sellerPendingDeliveryCount: sellerPendingDeliveryCount.value,
  sellerRefundPendingCount: sellerRefundPendingCount.value
}))
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

// 下拉菜单控制
watch(showDropdown, (isOpen) => {
  if (!isOpen) return
  showMoreMenu.value = false
  closeSearchPanel()
  if (dropdownMenuRef.value) dropdownMenuRef.value.scrollTop = 0
})

watch(() => route.fullPath, () => closeDropdown())
watch(isLoggedIn, (loggedIn) => {
  if (!loggedIn) closeDropdown()
})

// 更多菜单控制
function toggleMoreMenu() {
  showMoreMenu.value = !showMoreMenu.value
  showDropdown.value = false
}

function closeMoreMenu() {
  showMoreMenu.value = false
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
function loadHeaderSearchHistory() {
  searchHistory.value = loadSearchHistory(storage)
}

function saveHeaderSearchHistory(keyword) {
  searchHistory.value = saveSearchHistory(storage, keyword)
}

function clearHeaderSearchHistory() {
  searchHistory.value = []
  clearSearchHistory(storage)
}

function openSearchPanel() {
  loadHeaderSearchHistory()
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
  saveHeaderSearchHistory(keyword)
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
  router.push({ name: 'SellerPublish' })
}

function checkMobile() {
  isMobile.value = isMobileNav(window.innerWidth)
  if (isMobile.value) {
    closeSearchPanel()
  }
}

onMounted(() => {
  loadHeaderSearchHistory()
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
  z-index: 200;
  /* 固定导航使用高不透明表面，避免滚动时持续重采样整个页面。 */
  background: var(--glass-bg-heavy);
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
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 12px var(--page-gutter);
  gap: var(--grid-gap);
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  flex-shrink: 0;
  min-height: var(--header-control-size);
}

.header-logo {
  width: 32px;
  height: 32px;
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
  min-width: 0;
  max-width: 450px;
  gap: 8px;
}

.header-search {
  flex: 1;
  min-width: 0;
  height: var(--header-control-size);
  position: relative;
}

.search-input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: var(--header-control-size);
  padding: 0 40px 0 12px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.4;
  color: var(--text-primary);
  transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
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
  right: 0;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--header-control-size);
  height: var(--header-control-size);
  padding: 0;
  border-radius: 10px;
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
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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

.docs-btn,
.github-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--header-control-size);
  height: var(--header-control-size);
  flex-shrink: 0;
  background: var(--input-bg);
  border: none;
  border-radius: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease;
  text-decoration: none;
}

.docs-btn:hover,
.github-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.header-theme {
  display: flex;
  align-items: center;
  height: var(--header-control-size);
}

/* Scope the shared theme button size to this header only. */
.header-theme :deep(.theme-btn) {
  width: var(--header-control-size);
  height: var(--header-control-size);
  border-radius: 10px;
  transition: background 160ms ease, color 160ms ease;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  width: var(--header-control-size);
  height: var(--header-control-size);
  flex-shrink: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--input-bg);
  border: none;
  border-radius: 10px;
  font-size: 16px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease, box-shadow 160ms ease;
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
  --user-menu-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --user-menu-spring: cubic-bezier(0.22, 1.4, 0.36, 1);
  --user-menu-viewport-offset: calc(var(--header-profile-size) + 44px);
}

.user-info {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: var(--header-user-width);
  height: var(--header-profile-size);
  padding: 4px 12px 4px 8px;
  background: var(--input-bg);
  border: none;
  border-radius: 999px;
  cursor: pointer;
  touch-action: manipulation;
  transform: scale(1);
  transition: background 160ms ease, transform 380ms var(--user-menu-spring);
}

.user-info.has-unread {
  box-shadow: inset 0 0 0 1px var(--palette-rgba-220-38-38-0p28);
}

.header-alert-status {
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

.user-info:hover,
.user-info.is-open {
  background: var(--bg-tertiary);
}

.user-info:active {
  transform: scale(0.965);
  transition: background 80ms ease, transform 80ms ease-out;
}

.search-btn:focus-visible,
.docs-btn:focus-visible,
.github-btn:focus-visible,
.action-btn:focus-visible,
.login-btn:focus-visible,
.header-theme :deep(.theme-btn:focus-visible),
.user-info:focus-visible,
.dropdown-header:focus-visible,
.dropdown-item:focus-visible {
  outline: 2px solid var(--text-secondary);
  outline-offset: 2px;
}

.dropdown-header:focus-visible,
.dropdown-item:focus-visible {
  outline-offset: -2px;
  background: var(--bg-secondary);
}

.user-avatar-motion {
  display: flex;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  transform: rotate(0deg);
  transition: transform 300ms var(--user-menu-spring);
}

.user-info.is-open .user-avatar-motion {
  transform: rotate(30deg);
  transition-duration: 420ms;
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.user-identity {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  flex: 1;
  min-width: 0;
  text-align: left;
}

.user-name {
  display: block;
  min-width: 0;
  font-size: 13px;
  line-height: 16px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 11px;
  line-height: 14px;
  color: var(--text-secondary);
}

.user-trust-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-height: 14px;
  padding: 0 4px;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 9px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 12px;
  letter-spacing: 0.02em;
}

.user-handle {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-account {
  font-size: 12px;
  line-height: 15px;
  color: var(--text-secondary);
}

.user-unread-badge {
  position: absolute;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--palette-hex-ef4444);
  color: var(--palette-hex-ffffff);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-align: center;
  padding: 0 5px;
  border: 2px solid var(--bg-primary);
  box-shadow: 0 2px 8px var(--palette-rgba-220-38-38-0p35);
}

.dropdown-arrow {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--text-tertiary);
  margin-left: 0;
  transition: transform 340ms var(--user-menu-spring), color 160ms ease;
}

.user-info.is-open .dropdown-arrow {
  transform: rotate(180deg);
  color: var(--text-primary);
}

/* 下拉菜单内容 */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: min(240px, calc(100vw - 24px));
  max-height: calc(100vh - var(--user-menu-viewport-offset) - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  max-height: calc(100dvh - var(--user-menu-viewport-offset) - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: var(--dropdown-bg);
  border-radius: 16px;
  box-shadow: var(--dropdown-shadow);
  border: 1px solid var(--border-light);
  padding: 8px;
  z-index: 1000;
  transform-origin: calc(100% - 22px) -8px;
}

/* A quiet two-layer reveal from the capsule. Content settles before the surface. */
.user-menu-enter-active {
  transition: opacity 180ms ease-out, transform 320ms var(--user-menu-spring);
}

.user-menu-leave-active {
  pointer-events: none;
  transition: opacity 120ms ease-in, transform 140ms cubic-bezier(0.4, 0, 1, 1);
}

.user-menu-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.985);
}

.user-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.99);
}

.user-menu-enter-active .dropdown-content {
  transition: opacity 160ms ease-out 24ms, transform 180ms var(--user-menu-ease) 24ms;
}

.user-menu-leave-active .dropdown-content {
  transition: opacity 100ms ease-in, transform 120ms ease-in;
}

.user-menu-enter-from .dropdown-content,
.user-menu-leave-to .dropdown-content {
  opacity: 0;
  transform: translateY(-3px);
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
  gap: 10px;
  padding: 10px;
  text-decoration: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown-header:hover {
  background: var(--bg-secondary);
}

.dropdown-avatar {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
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
  overflow-wrap: anywhere;
  line-height: 20px;
}

.dropdown-meta {
  align-items: flex-start;
  font-size: 12px;
  line-height: 18px;
  margin-top: 4px;
}

.dropdown-meta .user-handle {
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
  overflow-wrap: anywhere;
}

.dropdown-meta .user-trust-badge {
  font-size: 10px;
  line-height: 14px;
}

.dropdown-alert-summary {
  margin: 0 10px 6px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 16px;
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
  min-height: 44px;
  padding: 12px;
  background: transparent;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  color: var(--text-primary);
  text-decoration: none;
  cursor: pointer;
  transition: background 140ms ease;
  text-align: left;
  touch-action: manipulation;
}

.dropdown-item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
}

.dropdown-item-text {
  flex: 1;
  min-width: 0;
}

.dropdown-item:hover {
  background: var(--bg-secondary);
}

.dropdown-item:active,
.dropdown-header:active {
  background: var(--bg-tertiary);
}

.dropdown-item.with-unread {
  background: var(--palette-rgba-220-38-38-0p06);
}

.dropdown-badge {
  margin-left: auto;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--palette-hex-dc2626);
  color: var(--palette-hex-ffffff);
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--header-control-size);
  padding: 0 16px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
  color: var(--palette-hex-ffffff);
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
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

@media (max-width: 1279px), (min-width: 768px) and (max-height: 800px) and (pointer: fine) {
  .user-identity {
    display: none;
  }

  .user-info {
    padding: 8px;
    justify-content: center;
  }
}

/* 移动端适配 */
@media (max-width: 767px) {
  .header-content {
    padding: 10px var(--page-gutter);
  }

  .header-logo {
    width: 28px;
    height: 28px;
  }

  .header-title {
    font-size: 16px;
  }

  .header-actions {
    gap: 4px;
    flex-wrap: nowrap;
  }

  .user-info {
    width: var(--header-profile-size);
    padding: 8px;
    justify-content: center;
  }

  .user-avatar {
    width: 28px;
    height: 28px;
  }

  .dropdown-arrow {
    display: none;
  }

  .user-dropdown {
    --user-menu-viewport-offset: 84px;
  }
}

@media (max-width: 359px) {
  .header-title {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .user-info,
  .user-info:active,
  .user-avatar-motion,
  .user-info.is-open .user-avatar-motion,
  .dropdown-arrow,
  .dropdown-header,
  .dropdown-item {
    transition: none;
  }

  .user-info:active,
  .user-info.is-open .user-avatar-motion {
    transform: none;
  }

  .user-menu-enter-active,
  .user-menu-leave-active {
    transition: opacity 80ms linear;
  }

  .user-menu-enter-from,
  .user-menu-leave-to,
  .user-menu-enter-from .dropdown-content,
  .user-menu-leave-to .dropdown-content {
    transform: none;
  }

  .user-menu-enter-active .dropdown-content,
  .user-menu-leave-active .dropdown-content {
    opacity: 1;
    transition: none;
  }
}
</style>
