<template>
  <div class="docs-page">
    <div class="docs-container">
      <!-- 移动端菜单按钮 -->
      <button class="mobile-menu-btn" @click="showSidebar = !showSidebar" v-if="isMobile">
        <span v-if="!showSidebar">☰ 目录</span>
        <span v-else>✕ 关闭</span>
      </button>
      
      <!-- 侧边栏导航 -->
      <aside :class="['docs-sidebar', { show: showSidebar || !isMobile }]">
        <div class="sidebar-header">
          <router-link to="/docs" class="sidebar-logo">
            <span class="logo-icon">📚</span>
            <span class="logo-text">使用文档</span>
          </router-link>
        </div>
        
        <nav class="sidebar-nav">
          <div 
            v-for="group in navGroups" 
            :key="group.title" 
            class="nav-group"
          >
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
          <router-link to="/" class="back-home">
            ← 返回首页
          </router-link>
        </div>
      </aside>
      
      <!-- 遮罩层（移动端） -->
      <div 
        v-if="showSidebar && isMobile" 
        class="sidebar-overlay"
        @click="showSidebar = false"
      ></div>
      
      <!-- 主内容区域 -->
      <main class="docs-content">
        <!-- 面包屑导航 -->
        <div class="breadcrumb">
          <router-link to="/">首页</router-link>
          <span class="sep">/</span>
          <router-link to="/docs">文档</router-link>
          <template v-if="currentSection && currentSection !== 'quick-start'">
            <span class="sep">/</span>
            <span class="current">{{ currentTitle }}</span>
          </template>
        </div>
        
        <!-- 文档内容 -->
        <article class="doc-article">
          <component :is="currentComponent" />
        </article>
        
        <!-- 上一篇/下一篇导航 -->
        <div class="doc-pagination" v-if="prevDoc || nextDoc">
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

// 响应式状态
const showSidebar = ref(false)
const isMobile = ref(false)

// 导航数据
const navGroups = [
  {
    title: '入门指南',
    items: [
      { id: 'quick-start', title: '快速开始', icon: '🚀' },
      { id: 'concepts', title: '基本概念', icon: '💡' }
    ]
  },
  {
    title: '商品管理',
    items: [
      { id: 'product-types', title: '物品类型', icon: '📦' },
      { id: 'publish-link', title: '发布外链物品', icon: '🔗' },
      { id: 'publish-cdk', title: '发布CDK物品', icon: '🎫' }
    ]
  },
  {
    title: '小店运营',
    items: [
      { id: 'shop-register', title: '小店入驻', icon: '🏪' }
    ]
  },
  {
    title: '购买流程',
    items: [
      { id: 'buy-guide', title: '购买指南', icon: '🛒' }
    ]
  },
  {
    title: '常见问题',
    items: [
      { id: 'faq', title: 'FAQ', icon: '❓' }
    ]
  }
]

// 扁平化导航列表（用于翻页）
const flatNavItems = computed(() => {
  return navGroups.flatMap(group => group.items)
})

// 当前章节
const currentSection = computed(() => {
  return route.params.section || 'quick-start'
})

// 当前标题
const currentTitle = computed(() => {
  const item = flatNavItems.value.find(i => i.id === currentSection.value)
  return item?.title || '文档'
})

// 动态组件
const docComponents = {
  'quick-start': defineAsyncComponent(() => import('@/components/docs/DocQuickStart.vue')),
  'concepts': defineAsyncComponent(() => import('@/components/docs/DocConcepts.vue')),
  'product-types': defineAsyncComponent(() => import('@/components/docs/DocProductTypes.vue')),
  'publish-link': defineAsyncComponent(() => import('@/components/docs/DocPublishLink.vue')),
  'publish-cdk': defineAsyncComponent(() => import('@/components/docs/DocPublishCdk.vue')),
  'shop-register': defineAsyncComponent(() => import('@/components/docs/DocShopRegister.vue')),
  'buy-guide': defineAsyncComponent(() => import('@/components/docs/DocBuyGuide.vue')),
  'faq': defineAsyncComponent(() => import('@/components/docs/DocFaq.vue'))
}

const currentComponent = computed(() => {
  return docComponents[currentSection.value] || docComponents['quick-start']
})

// 上一篇/下一篇
const currentIndex = computed(() => {
  return flatNavItems.value.findIndex(i => i.id === currentSection.value)
})

const prevDoc = computed(() => {
  if (currentIndex.value > 0) {
    return flatNavItems.value[currentIndex.value - 1]
  }
  return null
})

const nextDoc = computed(() => {
  if (currentIndex.value < flatNavItems.value.length - 1) {
    return flatNavItems.value[currentIndex.value + 1]
  }
  return null
})

// 方法
function handleNavClick() {
  if (isMobile.value) {
    showSidebar.value = false
  }
}

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

// 监听路由变化
watch(() => route.params.section, (newSection) => {
  // 更新页面标题
  const item = flatNavItems.value.find(i => i.id === newSection)
  if (item) {
    document.title = `${item.title} - 使用文档 - LD士多`
  }
})

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  
  // 如果访问 /docs，重定向到 /docs/quick-start
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
  background: #faf9f7;
}

.docs-container {
  display: flex;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100vh;
}

/* 移动端菜单按钮 */
.mobile-menu-btn {
  position: fixed;
  top: 70px;
  left: 12px;
  z-index: 200;
  padding: 10px 16px;
  background: white;
  border: 1px solid #e0dcd6;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.2s;
}

.mobile-menu-btn:hover {
  background: #f5f3f0;
}

/* 侧边栏 */
.docs-sidebar {
  position: sticky;
  top: 60px;
  width: 260px;
  height: calc(100vh - 60px);
  flex-shrink: 0;
  background: white;
  border-right: 1px solid #f0ede9;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #f0ede9;
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
  color: #3d3d3d;
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
  color: #999;
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
  color: #666;
  font-size: 14px;
  transition: all 0.2s;
}

.nav-item:hover {
  background: #f5f3f0;
  color: #3d3d3d;
}

.nav-item.active {
  background: linear-gradient(135deg, #f0f9f0 0%, #e8f5e8 100%);
  color: #5a8c5a;
  font-weight: 500;
}

.nav-icon {
  font-size: 16px;
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid #f0ede9;
}

.back-home {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #999;
  text-decoration: none;
  transition: color 0.2s;
}

.back-home:hover {
  color: #666;
}

/* 遮罩层 */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 149;
}

/* 主内容区域 */
.docs-content {
  flex: 1;
  padding: 24px 40px 60px;
  max-width: 900px;
  min-width: 0;
}

/* 面包屑 */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  font-size: 13px;
  color: #999;
}

.breadcrumb a {
  color: #778d9c;
  text-decoration: none;
}

.breadcrumb a:hover {
  color: #5a8c5a;
}

.breadcrumb .sep {
  color: #d5cfc5;
}

.breadcrumb .current {
  color: #666;
}

/* 文档内容 */
.doc-article {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

/* 文档翻页 */
.doc-pagination {
  display: flex;
  gap: 16px;
  margin-top: 32px;
}

.pagination-item {
  flex: 1;
  padding: 20px;
  background: white;
  border: 1px solid #f0ede9;
  border-radius: 14px;
  text-decoration: none;
  transition: all 0.2s;
}

.pagination-item:hover {
  border-color: #b5a898;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
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
  color: #999;
  margin-bottom: 4px;
}

.pagination-title {
  font-size: 15px;
  font-weight: 600;
  color: #3d3d3d;
}

.pagination-placeholder {
  flex: 1;
}

/* 移动端适配 */
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
