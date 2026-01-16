<template>
  <router-link 
    :to="`/shop/${shop.id}`" 
    class="shop-card"
    :class="{ pinned: shop.is_pinned }"
  >
    <!-- 小店图片 -->
    <div class="shop-image">
      <img 
        v-if="shop.image_url" 
        :src="shop.image_url" 
        :alt="shop.name"
        @error="handleImageError"
      />
      <div v-else class="shop-image-placeholder">
        <span>🏪</span>
      </div>
      
      <!-- 置顶标记 -->
      <div v-if="shop.is_pinned" class="pinned-badge">
        <span>📌</span>
      </div>
    </div>
    
    <!-- 小店信息 -->
    <div class="shop-info">
      <!-- 小店名称 -->
      <h3 class="shop-name">{{ shop.name }}</h3>
      
      <!-- 店主信息 -->
      <div class="shop-owner">
        <img 
          :src="ownerAvatarUrl" 
          :alt="shop.owner_username"
          class="owner-avatar"
          @error="handleAvatarError"
        />
        <span class="owner-name">{{ shop.owner_username }}</span>
      </div>
      
      <!-- 标签 -->
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
    </div>
  </router-link>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  shop: {
    type: Object,
    required: true
  }
})

// 默认头像 SVG (data URI)
const defaultAvatar = `data:image/svg+xml,${encodeURIComponent('<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M326.169 533.554v9.903c0 101.362 82.138 184.083 183.5 184.083s183.501-82.72 183.501-184.083v-9.903h-367.001zm277.872-70.487c22.137 0 40.196-18.06 40.196-40.196s-18.06-40.195-40.196-40.195-40.195 18.059-40.195 40.195 18.059 40.196 40.195 40.196zm-186.996 0c22.137 0 40.196-18.06 40.196-40.196s-18.06-40.195-40.196-40.195-40.195 18.059-40.195 40.195 18.059 40.196 40.195 40.196z" fill="#a686ba"/><path d="M1011.239 512c0-276.708-224.279-501.569-501.569-501.569S8.684 235.292 8.684 512c0 154.956 70.487 293.601 180.588 385.643V543.457c0-177.675 143.305-321.563 320.398-321.563s320.398 143.888 320.398 321.563v354.186C941.334 805.601 1011.239 666.956 1011.239 512z" fill="#a686ba"/><path d="M510.252 221.894c-177.093 0-320.398 143.888-320.398 321.563v354.186c86.799 72.235 198.647 115.926 320.398 115.926s233.6-43.691 320.398-115.926V543.457c0-177.675-143.305-321.563-320.398-321.563zm93.207 160.782c22.136 0 40.195 18.059 40.195 40.195s-18.059 40.196-40.195 40.196-40.196-18.06-40.196-40.196 18.06-40.195 40.196-40.195zm-186.996 0c22.136 0 40.195 18.059 40.195 40.195s-18.059 40.196-40.195 40.196-40.196-18.06-40.196-40.196 18.06-40.195 40.196-40.195zm93.207 344.865c-101.363 0-183.501-82.721-183.501-184.084v-9.903h366.418v9.903c.583 101.363-81.556 184.084-182.917 184.084z" fill="#FFF"/></svg>')}`

// 解析标签
const parsedTags = computed(() => {
  if (!props.shop.tags) return []
  if (Array.isArray(props.shop.tags)) return props.shop.tags
  try {
    return JSON.parse(props.shop.tags)
  } catch {
    return []
  }
})

// 店主头像 URL
const ownerAvatarUrl = computed(() => {
  const template = props.shop.owner_avatar_template
  if (!template) return defaultAvatar
  
  // 替换模板中的 {size} 为实际尺寸
  return template.replace('{size}', '48')
    // 如果是相对路径，补全域名
    .replace(/^\//,  'https://linux.do/')
})

// 处理图片加载错误
const handleImageError = (e) => {
  e.target.style.display = 'none'
  e.target.parentElement.classList.add('show-placeholder')
}

const handleAvatarError = (e) => {
  e.target.src = defaultAvatar
}

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
</script>

<style scoped>
.shop-card {
  display: block;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  text-decoration: none;
  transition: all 0.3s ease;
  border: 1px solid #f0ede9;
}

.shop-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
  border-color: #e0dcd6;
}

.shop-card.pinned {
  border-color: #b5a898;
  background: linear-gradient(135deg, #faf9f7 0%, white 100%);
}

/* 小店图片 */
.shop-image {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 比例 */
  background: #f8f6f3;
  overflow: hidden;
}

.shop-image img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shop-image-placeholder,
.shop-image.show-placeholder::after {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f8f6f3 0%, #f0ede9 100%);
  font-size: 48px;
}

.shop-image.show-placeholder::after {
  content: '🏪';
}

/* 置顶标记 */
.pinned-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 小店信息 */
.shop-info {
  padding: 14px 16px 16px;
}

.shop-name {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 600;
  color: #3d3d3d;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 店主信息 */
.shop-owner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.owner-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #f0ede9;
}

.owner-name {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

/* 标签 */
.shop-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.shop-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 12px;
  background: #f5f3f0;
  color: #666;
}

/* 标签颜色 */
.shop-tag.tag-subscription {
  background: #e8f5e8;
  color: #166534;
}

.shop-tag.tag-service {
  background: #e0f2fe;
  color: #0369a1;
}

.shop-tag.tag-vps {
  background: #fef3c7;
  color: #b45309;
}

.shop-tag.tag-ai {
  background: #f3e8ff;
  color: #7c3aed;
}

.shop-tag.tag-entertainment {
  background: #ffe4e6;
  color: #be123c;
}

.shop-tag.tag-charity {
  background: #fce7f3;
  color: #be185d;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .shop-info {
    padding: 12px 14px 14px;
  }
  
  .shop-name {
    font-size: 15px;
    margin-bottom: 8px;
  }
  
  .owner-avatar {
    width: 22px;
    height: 22px;
  }
  
  .owner-name {
    font-size: 12px;
  }
  
  .shop-tags {
    gap: 4px;
  }
  
  .shop-tag {
    padding: 2px 8px;
    font-size: 10px;
  }
}
</style>
