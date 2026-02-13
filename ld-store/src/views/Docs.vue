<template>
  <div class="docs-page">
    <div class="docs-container">
      <button v-if="isMobile" class="mobile-menu-btn" @click="showSidebar = !showSidebar">
        <span v-if="!showSidebar">☰ 目录</span>
        <span v-else>✕ 关闭</span>
      </button>

      <aside :class="['docs-sidebar', { show: showSidebar || !isMobile }]">
        <div class="sidebar-header">
          <router-link to="/docs" class="sidebar-logo">
            <span class="logo-icon">📚</span>
            <span class="logo-text">使用文档</span>
          </router-link>
        </div>

        <nav class="sidebar-nav">
          <div v-for="group in navGroups" :key="group.title" class="nav-group">
            <div class="nav-group-title">{{ group.title }}</div>
            <router-link
              v-for="item in group.items"
              :key="item.id"
              :to="`/docs/${item.id}`"
              :class="['nav-item', { active: currentSection === item.id }]"
              @click="handleNavClick"
            >
              <span class="nav-icon">{{ item.icon }}</span>
              <span class="nav-text">{{ item.title }}</span>
            </router-link>
          </div>
        </nav>

        <div class="sidebar-footer">
          <router-link to="/" class="back-home">← 返回首页</router-link>
        </div>
      </aside>

      <div
        v-if="showSidebar && isMobile"
        class="sidebar-overlay"
        @click="showSidebar = false"
      ></div>

      <main class="docs-content">
        <div class="breadcrumb">
          <router-link to="/">首页</router-link>
          <span class="sep">/</span>
          <router-link to="/docs">文档</router-link>
          <template v-if="currentSection && currentSection !== 'quick-start'">
            <span class="sep">/</span>
            <span class="current">{{ currentTitle }}</span>
          </template>
        </div>

        <article class="doc-article">
          <component :is="currentComponent" />
        </article>

        <div v-if="prevDoc || nextDoc" class="doc-pagination">
          <router-link
            v-if="prevDoc"
            :to="`/docs/${prevDoc.id}`"
            class="pagination-item prev"
          >
            <span class="pagination-label">上一篇</span>
            <span class="pagination-title">{{ prevDoc.icon }} {{ prevDoc.title }}</span>
          </router-link>
          <div v-else class="pagination-placeholder"></div>

          <router-link
            v-if="nextDoc"
            :to="`/docs/${nextDoc.id}`"
            class="pagination-item next"
          >
            <span class="pagination-label">下一篇</span>
            <span class="pagination-title">{{ nextDoc.icon }} {{ nextDoc.title }}</span>
          </router-link>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const showSidebar = ref(false)
const isMobile = ref(false)

const navGroups = [
  {
    title: '入门指南',
    items: [
      { id: 'quick-start', title: '快速开始', icon: '🚀' },
      { id: 'concepts', title: '基本概念', icon: '📚' }
    ]
  },
  {
    title: '物品管理',
    items: [
      { id: 'product-types', title: '物品类型', icon: '🧩' },
      { id: 'publish-link', title: '发布外链物品', icon: '🔗' },
      { id: 'publish-cdk', title: '发布 CDK 物品', icon: '🎟️' }
    ]
  },
  {
    title: '小店运营',
    items: [
      { id: 'shop-register', title: '小店入驻', icon: '🏪' }
    ]
  },
  {
    title: '交易流程',
    items: [
      { id: 'buy-guide', title: '购买指南', icon: '🛒' },
      { id: 'buy-request', title: '求购操作指南', icon: '🌱' }
    ]
  },
  {
    title: '常见问题',
    items: [
      { id: 'faq', title: 'FAQ', icon: '❓' }
    ]
  },
  {
    title: '规则与协议',
    items: [
      { id: 'terms', title: '服务条款', icon: '📜' }
    ]
  }
]

const flatNavItems = computed(() => navGroups.flatMap((group) => group.items))

const currentSection = computed(() => route.params.section || 'quick-start')

const currentTitle = computed(() => {
  const item = flatNavItems.value.find((i) => i.id === currentSection.value)
  return item?.title || '文档'
})

const docComponents = {
  'quick-start': defineAsyncComponent(() => import('@/components/docs/DocQuickStart.vue')),
  'concepts': defineAsyncComponent(() => import('@/components/docs/DocConcepts.vue')),
  'product-types': defineAsyncComponent(() => import('@/components/docs/DocProductTypes.vue')),
  'publish-link': defineAsyncComponent(() => import('@/components/docs/DocPublishLink.vue')),
  'publish-cdk': defineAsyncComponent(() => import('@/components/docs/DocPublishCdk.vue')),
  'shop-register': defineAsyncComponent(() => import('@/components/docs/DocShopRegister.vue')),
  'buy-guide': defineAsyncComponent(() => import('@/components/docs/DocBuyGuide.vue')),
  'buy-request': defineAsyncComponent(() => import('@/components/docs/DocBuyRequest.vue')),
  'faq': defineAsyncComponent(() => import('@/components/docs/DocFaq.vue')),
  'terms': defineAsyncComponent(() => import('@/components/docs/DocTerms.vue'))
}

const currentComponent = computed(() => {
  return docComponents[currentSection.value] || docComponents['quick-start']
})

const currentIndex = computed(() => {
  return flatNavItems.value.findIndex((i) => i.id === currentSection.value)
})

const prevDoc = computed(() => {
  if (currentIndex.value > 0) return flatNavItems.value[currentIndex.value - 1]
  return null
})

const nextDoc = computed(() => {
  if (currentIndex.value < flatNavItems.value.length - 1) {
    return flatNavItems.value[currentIndex.value + 1]
  }
  return null
})

function handleNavClick() {
  if (isMobile.value) showSidebar.value = false
}

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

watch(
  () => route.params.section,
  (newSection) => {
    const item = flatNavItems.value.find((i) => i.id === newSection)
    if (item) {
      document.title = `${item.title} - 使用文档 - LD士多`
    } else {
      document.title = '使用文档 - LD士多'
    }
  },
  { immediate: true }
)

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  if (!route.params.section) {
    router.replace('/docs/quick-start')
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
.docs-page {
  min-height: 100vh;
  background: var(--bg-primary);
}

.docs-container {
  display: flex;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100vh;
}

.mobile-menu-btn {
  position: fixed;
  top: 70px;
  left: 12px;
  z-index: 200;
  padding: 10px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
}

.mobile-menu-btn:hover {
  background: var(--bg-secondary);
}

.docs-sidebar {
  position: sticky;
  top: 60px;
  width: 260px;
  height: calc(100vh - 60px);
  flex-shrink: 0;
  background: var(--bg-card);
  border-right: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-light);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  overflow-y: auto;
}

.nav-group {
  margin-bottom: 20px;
}

.nav-group-title {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin: 2px 0;
  border-radius: 10px;
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 14px;
  transition: all 0.2s;
}

.nav-item:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--color-success-bg);
  color: var(--color-success);
  font-weight: 500;
}

.nav-icon {
  font-size: 16px;
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-light);
}

.back-home {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-tertiary);
  text-decoration: none;
  transition: color 0.2s;
}

.back-home:hover {
  color: var(--text-secondary);
}

.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  z-index: 149;
}

.docs-content {
  flex: 1;
  padding: 24px 40px 60px;
  max-width: 900px;
  min-width: 0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  font-size: 13px;
  color: var(--text-tertiary);
}

.breadcrumb a {
  color: var(--color-info);
  text-decoration: none;
}

.breadcrumb a:hover {
  color: var(--color-success);
}

.breadcrumb .sep {
  color: var(--border-medium);
}

.breadcrumb .current {
  color: var(--text-secondary);
}

.doc-article {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.doc-pagination {
  display: flex;
  gap: 16px;
  margin-top: 32px;
}

.pagination-item {
  flex: 1;
  padding: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  text-decoration: none;
  transition: all 0.2s;
}

.pagination-item:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.pagination-item.prev {
  text-align: left;
}

.pagination-item.next {
  text-align: right;
}

.pagination-label {
  display: block;
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 4px;
}

.pagination-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.pagination-placeholder {
  flex: 1;
}

@media (max-width: 768px) {
  .docs-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 150;
    width: 280px;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    height: 100vh;
    background: var(--bg-card);
  }

  .docs-sidebar.show {
    transform: translateX(0);
  }

  .docs-content {
    padding: 80px 16px 60px;
  }

  .doc-article {
    padding: 20px;
  }

  .doc-pagination {
    flex-direction: column;
  }
}

@media (min-width: 769px) {
  .mobile-menu-btn {
    display: none;
  }
}
</style>
