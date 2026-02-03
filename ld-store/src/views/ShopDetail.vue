<template>
  <div class="shop-detail-page">
    <div class="page-container">
      <!-- 返回按钮 -->
      <div class="back-nav">
        <button class="back-link" @click="goBack">
          <span class="back-icon">←</span>
          <span>返回</span>
        </button>
      </div>
      
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="skeleton-card">
          <div class="skeleton-image"></div>
          <div class="skeleton-content">
            <div class="skeleton-line w-70"></div>
            <div class="skeleton-line w-40"></div>
            <div class="skeleton-line w-90"></div>
          </div>
        </div>
      </div>
      
      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <div class="error-icon">😕</div>
        <h3>{{ error }}</h3>
        <button class="btn btn-primary" @click="goBack">返回</button>
      </div>
      
      <!-- 小店详情 -->
      <div v-else-if="shop" class="shop-detail">
        <!-- 小店图片 -->
        <div class="shop-image-wrapper">
          <img 
            v-if="shop.image_url" 
            :src="shop.image_url" 
            :alt="shop.name"
            class="shop-image"
            @error="handleImageError"
          />
          <div v-else class="shop-image-placeholder">
            <span>🏪</span>
          </div>
          
          <!-- 置顶标记 -->
          <div v-if="shop.is_pinned" class="pinned-badge">
            <span>📌 置顶推荐</span>
          </div>
        </div>
        
        <!-- 小店信息 -->
        <div class="shop-info-card">
          <h1 class="shop-name">{{ shop.name }}</h1>
          
          <!-- 店主信息 -->
          <div class="owner-section">
            <a 
              :href="shop.owner_linuxdo_link" 
              target="_blank" 
              rel="noopener noreferrer"
              class="owner-link"
            >
              <img 
                :src="ownerAvatarUrl" 
                :alt="shop.owner_username"
                class="owner-avatar"
                referrerpolicy="no-referrer"
                @error="handleAvatarError"
              />
              <div class="owner-info">
                <span class="owner-name">{{ shop.owner_username }}</span>
                <span class="owner-desc">店主 · 点击查看主页</span>
              </div>
              <span class="external-icon">↗</span>
            </a>
          </div>
          
          <!-- 标签 -->
          <div class="tags-section" v-if="parsedTags.length > 0">
            <span 
              v-for="tag in parsedTags" 
              :key="tag"
              class="shop-tag"
              :class="getTagClass(tag)"
            >
              {{ tag }}
            </span>
          </div>
          
          <!-- 统计信息 -->
          <div class="stats-section">
            <div class="stat-item">
              <span class="stat-icon">👀</span>
              <span class="stat-value">{{ shop.view_count || 0 }}</span>
              <span class="stat-label">浏览</span>
            </div>
          </div>
          
          <!-- 小店介绍 -->
          <div class="description-section" v-if="shop.description">
            <h3 class="section-title">📖 小店介绍</h3>
            <p class="shop-description">{{ shop.description }}</p>
          </div>
          
          <!-- 前往按钮 -->
          <div class="action-section">
            <a 
              :href="shop.shop_url" 
              target="_blank" 
              rel="noopener noreferrer"
              class="btn btn-primary btn-large"
            >
              🚀 立即前往
            </a>
            <p class="action-hint">点击将跳转到小店外部链接</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/utils/api'

const route = useRoute()
const router = useRouter()

// 默认头像 SVG (data URI)
const defaultAvatar = `data:image/svg+xml,${encodeURIComponent('<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M326.169 533.554v9.903c0 101.362 82.138 184.083 183.5 184.083s183.501-82.72 183.501-184.083v-9.903h-367.001zm277.872-70.487c22.137 0 40.196-18.06 40.196-40.196s-18.06-40.195-40.196-40.195-40.195 18.059-40.195 40.195 18.059 40.196 40.195 40.196zm-186.996 0c22.137 0 40.196-18.06 40.196-40.196s-18.06-40.195-40.196-40.195-40.195 18.059-40.195 40.195 18.059 40.196 40.195 40.196z" fill="#a686ba"/><path d="M1011.239 512c0-276.708-224.279-501.569-501.569-501.569S8.684 235.292 8.684 512c0 154.956 70.487 293.601 180.588 385.643V543.457c0-177.675 143.305-321.563 320.398-321.563s320.398 143.888 320.398 321.563v354.186C941.334 805.601 1011.239 666.956 1011.239 512z" fill="#a686ba"/><path d="M510.252 221.894c-177.093 0-320.398 143.888-320.398 321.563v354.186c86.799 72.235 198.647 115.926 320.398 115.926s233.6-43.691 320.398-115.926V543.457c0-177.675-143.305-321.563-320.398-321.563zm93.207 160.782c22.136 0 40.195 18.059 40.195 40.195s-18.059 40.196-40.195 40.196-40.196-18.06-40.196-40.196 18.06-40.195 40.196-40.195zm-186.996 0c22.136 0 40.195 18.059 40.195 40.195s-18.059 40.196-40.195 40.196-40.196-18.06-40.196-40.196 18.06-40.195 40.196-40.195zm93.207 344.865c-101.363 0-183.501-82.721-183.501-184.084v-9.903h366.418v9.903c.583 101.363-81.556 184.084-182.917 184.084z" fill="#FFF"/></svg>')}`

const shop = ref(null)
const loading = ref(true)
const error = ref('')

// 解析标签
const parsedTags = computed(() => {
  if (!shop.value?.tags) return []
  if (Array.isArray(shop.value.tags)) return shop.value.tags
  try {
    return JSON.parse(shop.value.tags)
  } catch {
    return []
  }
})

// 店主头像 URL
const ownerAvatarUrl = computed(() => {
  if (!shop.value) return ''
  const template = shop.value.owner_avatar_template
  if (!template) return defaultAvatar
  
  return template.replace('{size}', '96')
    .replace(/^\//, 'https://linux.do/')
})

// 标签样式类
const getTagClass = (tag) => {
  const tagClassMap = {
    '订阅': 'tag-subscription',
    '服务': 'tag-service',
    '小鸡': 'tag-vps',
    'AI': 'tag-ai',
    '娱乐': 'tag-entertainment',
    '公益站': 'tag-charity'
  }
  return tagClassMap[tag] || 'tag-default'
}

// 处理图片加载错误
const handleImageError = (e) => {
  e.target.style.display = 'none'
}

const handleAvatarError = (e) => {
  e.target.src = defaultAvatar
}

// 返回上一页
function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/?tab=stores')
  }
}

// 加载小店详情
async function loadShopDetail() {
  const shopId = route.params.id
  if (!shopId) {
    error.value = '小店ID无效'
    loading.value = false
    return
  }
  
  try {
    const result = await api.get(`/api/shops/${shopId}`)
    if (result.success && result.data) {
      shop.value = result.data
    } else {
      error.value = result.error?.message || '小店不存在或已下架'
    }
  } catch (e) {
    error.value = '加载失败，请稍后重试'
    console.error('Load shop detail failed:', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadShopDetail()
})
</script>

<style scoped>
.shop-detail-page {
  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: 80px;
}

.page-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 16px;
}

/* 返回导航 */
.back-nav {
  margin-bottom: 16px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 10px;
  transition: all 0.2s;
  background: transparent;
  border: none;
  cursor: pointer;
}

.back-link:hover {
  background: var(--bg-card);
  color: var(--text-primary);
}

.back-icon {
  font-size: 16px;
}

/* 加载状态 */
.loading-state,
.error-state {
  padding: 60px 20px;
  text-align: center;
}

.skeleton-card {
  background: var(--bg-card);
  border-radius: 20px;
  overflow: hidden;
  max-width: 600px;
  margin: 0 auto;
}

.skeleton-image {
  width: 100%;
  padding-top: 56.25%;
  background: var(--skeleton-gradient);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-content {
  padding: 24px;
}

.skeleton-line {
  height: 20px;
  background: var(--skeleton-gradient);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  margin-bottom: 12px;
}

.skeleton-line.w-70 { width: 70%; }
.skeleton-line.w-40 { width: 40%; }
.skeleton-line.w-90 { width: 90%; }

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.error-state {
  color: var(--text-secondary);
}

.error-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.error-state h3 {
  margin-bottom: 20px;
  color: var(--text-primary);
}

/* 小店详情 */
.shop-detail {
  background: var(--bg-card);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
}

/* 小店图片 */
.shop-image-wrapper {
  position: relative;
  width: 100%;
  padding-top: 50%;
  background: var(--bg-secondary);
}

.shop-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shop-image-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 80px;
  background: var(--bg-secondary);
}

.pinned-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  background: var(--glass-bg-heavy);
  border-radius: 12px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

/* 小店信息卡片 */
.shop-info-card {
  padding: 24px;
}

.shop-name {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 20px;
  line-height: 1.3;
}

/* 店主信息 */
.owner-section {
  margin-bottom: 20px;
}

.owner-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border-radius: 14px;
  text-decoration: none;
  transition: all 0.2s;
}

.owner-link:hover {
  background: var(--bg-tertiary);
}

.owner-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--bg-card);
  box-shadow: var(--shadow-sm);
}

.owner-info {
  flex: 1;
}

.owner-name {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.owner-desc {
  display: block;
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.external-icon {
  font-size: 18px;
  color: var(--color-primary);
}

/* 标签 */
.tags-section {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.shop-tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 20px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.shop-tag.tag-subscription {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.shop-tag.tag-service {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.shop-tag.tag-vps {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.shop-tag.tag-ai {
  background: rgba(147, 51, 234, 0.15);
  color: #a855f7;
}

.shop-tag.tag-entertainment {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.shop-tag.tag-charity {
  background: rgba(219, 39, 119, 0.15);
  color: #ec4899;
}

/* 统计信息 */
.stats-section {
  display: flex;
  gap: 24px;
  padding: 16px 0;
  border-top: 1px solid var(--border-light);
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 20px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stat-icon {
  font-size: 16px;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-label {
  font-size: 13px;
  color: var(--text-tertiary);
}

/* 小店介绍 */
.description-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px;
}

.shop-description {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0;
  white-space: pre-wrap;
}

/* 前往按钮 */
.action-section {
  text-align: center;
  padding-top: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-primary);
}

.btn-large {
  padding: 16px 40px;
  font-size: 16px;
  border-radius: 14px;
}

.action-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 12px;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .page-container {
    padding: 12px;
  }
  
  .shop-info-card {
    padding: 20px 16px;
  }
  
  .shop-name {
    font-size: 20px;
  }
  
  .owner-link {
    padding: 12px 14px;
  }
  
  .owner-avatar {
    width: 42px;
    height: 42px;
  }
  
  .shop-image-placeholder {
    font-size: 60px;
  }
  
  .btn-large {
    width: 100%;
    padding: 14px 24px;
  }
}
</style>
