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
              <AvatarImage
                :candidates="ownerAvatarCandidates"
                :seed="ownerAvatarSeed"
                :size="48"
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
            {{ submitting ? '下架中...' : '📤 下架小店' }}
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
import AvatarImage from '@/components/common/AvatarImage.vue'
import ShopForm from '@/components/shop/ShopForm.vue'
import { buildAvatarCandidates } from '@/utils/avatar'

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
const ownerAvatarSeed = computed(() =>
  myShop.value?.owner_username || myShop.value?.owner_user_id || myShop.value?.name || 'shop'
)

const ownerAvatarCandidates = computed(() => {
  if (!myShop.value) return []
  return buildAvatarCandidates(myShop.value.owner_avatar_template, 48)
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
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 10px;
  transition: all 0.2s;
}

.back-link:hover {
  background: var(--bg-card);
  color: var(--text-primary);
}

.back-icon {
  font-size: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 24px;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-primary);
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
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.status-banner.status-active {
  background: var(--color-success-light);
  color: var(--color-success);
}

.status-banner.status-rejected {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.status-banner.status-offline {
  background: var(--bg-secondary);
  color: var(--text-tertiary);
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
  background: var(--bg-card);
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
}

.shop-image-wrapper {
  width: 100%;
  padding-top: 40%;
  position: relative;
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
  width: 100%;
  padding: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60px;
  background: var(--bg-tertiary);
}

.shop-info {
  padding: 20px;
}

.shop-name {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
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
  color: var(--text-secondary);
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
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.shop-tag.tag-subscription { background: var(--color-success-light); color: var(--color-success); }
.shop-tag.tag-service { background: var(--color-info-light); color: var(--color-info); }
.shop-tag.tag-vps { background: var(--color-warning-light); color: var(--color-warning); }
.shop-tag.tag-ai { background: #f3e8ff; color: #7c3aed; }
.shop-tag.tag-entertainment { background: #ffe4e6; color: #be123c; }
.shop-tag.tag-charity { background: #fce7f3; color: #be185d; }

.shop-stats {
  font-size: 13px;
  color: var(--text-tertiary);
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
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-primary);
}

.btn-secondary {
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--color-primary);
}

.btn-danger {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.btn-danger:hover:not(:disabled) {
  filter: brightness(0.95);
}

/* 入驻介绍 */
.intro-card {
  background: var(--color-success-light);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}

.intro-card h2 {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-success);
  margin: 0 0 12px;
}

.intro-card p {
  font-size: 14px;
  color: var(--color-success);
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
  color: var(--color-success);
}

/* 区块标题 */
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px;
}

.edit-section {
  background: var(--bg-card);
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
