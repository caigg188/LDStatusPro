<template>
  <div class="my-shop-page">
    <div class="page-container">
      <!-- 返回按钮 -->
      <div class="back-nav">
        <router-link to="/user" class="back-link">
          <span class="back-icon">←</span>
          <span>返回个人中心</span>
        </router-link>
      </div>

      <h1 class="page-title">🏪 小店入驻</h1>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <!-- 已有小店 -->
      <div v-else-if="myShop" class="my-shop-section">
        <!-- 状态提示 -->
        <div class="status-banner" :class="statusClass">
          <span class="status-icon">{{ statusIcon }}</span>
          <div class="status-content">
            <span class="status-text">{{ statusText }}</span>
            <span v-if="myShop.reject_reason" class="reject-reason">
              拒绝原因: {{ myShop.reject_reason }}
            </span>
          </div>
        </div>

        <!-- 小店信息卡片 -->
        <div class="shop-card">
          <div class="shop-image-wrapper" v-if="myShop.image_url">
            <img :src="myShop.image_url" :alt="myShop.name" class="shop-image" />
          </div>
          <div class="shop-image-placeholder" v-else>
            <span>🏪</span>
          </div>

          <div class="shop-info">
            <h2 class="shop-name">{{ myShop.name }}</h2>
            
            <div class="shop-owner">
              <img 
                :src="ownerAvatarUrl" 
                :alt="myShop.owner_username"
                class="owner-avatar"
              />
              <span class="owner-name">{{ myShop.owner_username }}</span>
            </div>

            <div class="shop-tags" v-if="parsedTags.length > 0">
              <span 
                v-for="tag in parsedTags" 
                :key="tag"
                class="shop-tag"
                :class="getTagClass(tag)"
              >
                {{ tag }}
              </span>
            </div>

            <div class="shop-stats" v-if="myShop.status === 'active'">
              <span class="stat">👀 {{ myShop.view_count || 0 }} 浏览</span>
            </div>
          </div>
        </div>

        <!-- 编辑表单 -->
        <div class="edit-section" v-if="showEditForm">
          <h3 class="section-title">📝 编辑小店信息</h3>
          <ShopForm 
            :initial-data="myShop"
            :submitting="submitting"
            @submit="handleUpdate"
            @cancel="showEditForm = false"
          />
        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons" v-if="!showEditForm">
          <button 
            v-if="myShop.status !== 'offline'"
            class="btn btn-secondary"
            @click="showEditForm = true"
          >
            ✏️ 编辑信息
          </button>
          <button 
            v-if="myShop.status === 'active'"
            class="btn btn-danger"
            @click="handleOffline"
            :disabled="submitting"
          >
            📤 下架小店
          </button>
          <a 
            v-if="myShop.status === 'active'"
            :href="myShop.shop_url"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-primary"
          >
            🔗 访问小店
          </a>
        </div>
      </div>

      <!-- 未入驻，显示入驻表单 -->
      <div v-else class="apply-section">
        <div class="intro-card">
          <h2>📢 欢迎入驻小店集市</h2>
          <p>小店集市是 LD士多 为论坛用户提供的友情链接展示平台。</p>
          <ul class="intro-list">
            <li>🆓 完全免费入驻</li>
            <li>🏷️ 支持添加分类标签</li>
            <li>👤 展示店主 LinuxDo 身份</li>
            <li>📊 浏览量统计</li>
          </ul>
        </div>

        <h3 class="section-title">📝 填写入驻信息</h3>
        <ShopForm 
          :submitting="submitting"
          @submit="handleSubmit"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '@/utils/api'
import ShopForm from '@/components/shop/ShopForm.vue'

// 默认头像 SVG (data URI)
const defaultAvatar = `data:image/svg+xml,${encodeURIComponent('<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M326.169 533.554v9.903c0 101.362 82.138 184.083 183.5 184.083s183.501-82.72 183.501-184.083v-9.903h-367.001zm277.872-70.487c22.137 0 40.196-18.06 40.196-40.196s-18.06-40.195-40.196-40.195-40.195 18.059-40.195 40.195 18.059 40.196 40.195 40.196zm-186.996 0c22.137 0 40.196-18.06 40.196-40.196s-18.06-40.195-40.196-40.195-40.195 18.059-40.195 40.195 18.059 40.196 40.195 40.196z" fill="#a686ba"/><path d="M1011.239 512c0-276.708-224.279-501.569-501.569-501.569S8.684 235.292 8.684 512c0 154.956 70.487 293.601 180.588 385.643V543.457c0-177.675 143.305-321.563 320.398-321.563s320.398 143.888 320.398 321.563v354.186C941.334 805.601 1011.239 666.956 1011.239 512z" fill="#a686ba"/><path d="M510.252 221.894c-177.093 0-320.398 143.888-320.398 321.563v354.186c86.799 72.235 198.647 115.926 320.398 115.926s233.6-43.691 320.398-115.926V543.457c0-177.675-143.305-321.563-320.398-321.563zm93.207 160.782c22.136 0 40.195 18.059 40.195 40.195s-18.059 40.196-40.195 40.196-40.196-18.06-40.196-40.196 18.06-40.195 40.196-40.195zm-186.996 0c22.136 0 40.195 18.059 40.195 40.195s-18.059 40.196-40.195 40.196-40.196-18.06-40.196-40.196 18.06-40.195 40.196-40.195zm93.207 344.865c-101.363 0-183.501-82.721-183.501-184.084v-9.903h366.418v9.903c.583 101.363-81.556 184.084-182.917 184.084z" fill="#FFF"/></svg>')}`

const loading = ref(true)
const submitting = ref(false)
const myShop = ref(null)
const showEditForm = ref(false)

// 解析标签
const parsedTags = computed(() => {
  if (!myShop.value?.tags) return []
  if (Array.isArray(myShop.value.tags)) return myShop.value.tags
  try {
    return JSON.parse(myShop.value.tags)
  } catch {
    return []
  }
})

// 店主头像 URL
const ownerAvatarUrl = computed(() => {
  if (!myShop.value) return ''
  const template = myShop.value.owner_avatar_template
  if (!template) return defaultAvatar
  
  return template.replace('{size}', '48')
    .replace(/^\//, 'https://linux.do/')
})

// 状态相关计算属性
const statusClass = computed(() => {
  if (!myShop.value) return ''
  const classMap = {
    pending: 'status-pending',
    active: 'status-active',
    rejected: 'status-rejected',
    offline: 'status-offline'
  }
  return classMap[myShop.value.status] || ''
})

const statusIcon = computed(() => {
  if (!myShop.value) return ''
  const iconMap = {
    pending: '⏳',
    active: '✅',
    rejected: '❌',
    offline: '📤'
  }
  return iconMap[myShop.value.status] || ''
})

const statusText = computed(() => {
  if (!myShop.value) return ''
  const textMap = {
    pending: '审核中，请耐心等待',
    active: '已上架',
    rejected: '审核未通过',
    offline: '已下架'
  }
  return textMap[myShop.value.status] || ''
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

// 加载我的小店
async function loadMyShop() {
  try {
    const result = await api.get('/api/shops/my')
    if (result.success && result.data) {
      myShop.value = result.data
    }
  } catch (e) {
    console.error('Load my shop failed:', e)
  } finally {
    loading.value = false
  }
}

// 提交入驻申请
async function handleSubmit(formData) {
  submitting.value = true
  try {
    const result = await api.post('/api/shops', formData)
    if (result.success) {
      alert('入驻申请已提交，请等待审核！')
      await loadMyShop()
    } else {
      alert(result.error?.message || result.error || '提交失败')
    }
  } catch (e) {
    alert('提交失败: ' + e.message)
  } finally {
    submitting.value = false
  }
}

// 更新小店信息
async function handleUpdate(formData) {
  submitting.value = true
  try {
    const result = await api.put('/api/shops/my', formData)
    if (result.success) {
      alert(result.message || '更新成功！')
      showEditForm.value = false
      await loadMyShop()
    } else {
      alert(result.error?.message || result.error || '更新失败')
    }
  } catch (e) {
    alert('更新失败: ' + e.message)
  } finally {
    submitting.value = false
  }
}

// 下架小店
async function handleOffline() {
  if (!confirm('确定要下架小店吗？下架后将不再显示在小店集市中。')) {
    return
  }
  
  submitting.value = true
  try {
    const result = await api.post('/api/shops/my/offline')
    if (result.success) {
      alert('小店已下架')
      await loadMyShop()
    } else {
      alert(result.error?.message || result.error || '下架失败')
    }
  } catch (e) {
    alert('下架失败: ' + e.message)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadMyShop()
})
</script>

<style scoped>
.my-shop-page {
  min-height: 100vh;
  background: #f8f6f3;
  padding-bottom: 80px;
}

.page-container {
  max-width: 700px;
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
  color: #666;
  text-decoration: none;
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 10px;
  transition: all 0.2s;
}

.back-link:hover {
  background: white;
  color: #3d3d3d;
}

.back-icon {
  font-size: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #3d3d3d;
  margin: 0 0 24px;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #666;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(181, 168, 152, 0.3);
  border-top-color: #b5a898;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 状态横幅 */
.status-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  border-radius: 14px;
  margin-bottom: 20px;
}

.status-banner.status-pending {
  background: #fef3c7;
  color: #b45309;
}

.status-banner.status-active {
  background: #d1fae5;
  color: #166534;
}

.status-banner.status-rejected {
  background: #fee2e2;
  color: #dc2626;
}

.status-banner.status-offline {
  background: #f3f4f6;
  color: #6b7280;
}

.status-icon {
  font-size: 24px;
}

.status-content {
  flex: 1;
}

.status-text {
  display: block;
  font-weight: 600;
  font-size: 15px;
}

.reject-reason {
  display: block;
  font-size: 13px;
  margin-top: 4px;
  opacity: 0.9;
}

/* 小店卡片 */
.shop-card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.shop-image-wrapper {
  width: 100%;
  padding-top: 40%;
  position: relative;
  background: #f8f6f3;
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
  width: 100%;
  padding: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60px;
  background: linear-gradient(135deg, #f8f6f3 0%, #f0ede9 100%);
}

.shop-info {
  padding: 20px;
}

.shop-name {
  font-size: 20px;
  font-weight: 600;
  color: #3d3d3d;
  margin: 0 0 14px;
}

.shop-owner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.owner-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.owner-name {
  font-size: 14px;
  color: #666;
}

.shop-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.shop-tag {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 12px;
  background: #f5f3f0;
  color: #666;
}

.shop-tag.tag-subscription { background: #e8f5e8; color: #166534; }
.shop-tag.tag-service { background: #e0f2fe; color: #0369a1; }
.shop-tag.tag-vps { background: #fef3c7; color: #b45309; }
.shop-tag.tag-ai { background: #f3e8ff; color: #7c3aed; }
.shop-tag.tag-entertainment { background: #ffe4e6; color: #be123c; }
.shop-tag.tag-charity { background: #fce7f3; color: #be185d; }

.shop-stats {
  font-size: 13px;
  color: #999;
}

.shop-stats .stat {
  margin-right: 16px;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #b5a898 0%, #a09080 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(181, 168, 152, 0.4);
}

.btn-secondary {
  background: white;
  color: #666;
  border: 1px solid #e0dcd6;
}

.btn-secondary:hover:not(:disabled) {
  background: #f8f6f3;
  border-color: #b5a898;
}

.btn-danger {
  background: #fee2e2;
  color: #dc2626;
}

.btn-danger:hover:not(:disabled) {
  background: #fecaca;
}

/* 入驻介绍 */
.intro-card {
  background: linear-gradient(135deg, #e8f5e8 0%, #d1fae5 100%);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}

.intro-card h2 {
  font-size: 18px;
  font-weight: 600;
  color: #166534;
  margin: 0 0 12px;
}

.intro-card p {
  font-size: 14px;
  color: #166534;
  margin: 0 0 16px;
  opacity: 0.9;
}

.intro-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.intro-list li {
  font-size: 13px;
  color: #166534;
}

/* 区块标题 */
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #3d3d3d;
  margin: 0 0 16px;
}

.edit-section {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .page-container {
    padding: 12px;
  }
  
  .page-title {
    font-size: 20px;
  }
  
  .intro-list {
    grid-template-columns: 1fr;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}
</style>
