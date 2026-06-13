<template>
  <router-link 
    ref="cardRef"
    :to="`/shop/${shop.id}`" 
    class="shop-card"
    :class="{ pinned: shop.is_pinned }"
    :style="tiltStyle"
    @mouseenter="handleMouseEnter"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
  >
    <!-- 3D 光泽效果层 -->
    <div class="tilt-glare" :style="glareStyle"></div>
    
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
        <AvatarImage
          :candidates="ownerAvatarCandidates"
          :seed="ownerAvatarSeed"
          :size="48"
          :alt="shop.owner_username"
          class="owner-avatar"
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
import AvatarImage from '@/components/common/AvatarImage.vue'
import { buildAvatarCandidates } from '@/utils/avatar'

const props = defineProps({
  shop: {
    type: Object,
    required: true
  }
})

// 3D 倾斜效果
const cardRef = ref(null)
const tiltStyle = ref({})
const glareStyle = ref({})
const isHovering = ref(false)

const maxTilt = 12
const perspective = 800
const scale = 1.03
const speed = 400

let currentX = 0
let currentY = 0
let targetX = 0
let targetY = 0
let currentScale = 1
let currentShadow = 0
let animationFrame = null

function lerp(start, end, factor) {
  return start + (end - start) * factor
}

function updateTilt() {
  if (!isHovering.value) return
  
  currentX = lerp(currentX, targetX, 0.08)
  currentY = lerp(currentY, targetY, 0.08)
  currentScale = lerp(currentScale, scale, 0.06)
  currentShadow = lerp(currentShadow, 1, 0.05)
  
  const rotateX = currentY * maxTilt
  const rotateY = -currentX * maxTilt
  
  // 计算阴影偏移
  const shadowX = -currentX * 10
  const shadowY = currentY * 10 + 18
  const shadowBlur = 24 + currentShadow * 30
  const shadowAlpha = 0.08 + currentShadow * 0.12
  
  tiltStyle.value = {
    transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${currentScale}, ${currentScale}, ${currentScale})`,
    boxShadow: `${shadowX}px ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowAlpha}), 0 ${5 + currentShadow * 7}px ${10 + currentShadow * 14}px rgba(0, 0, 0, ${0.05 + currentShadow * 0.05})`
  }
  
  // 光泽跟随
  const glareX = (currentX + 1) * 50
  const glareY = (currentY + 1) * 50
  glareStyle.value = {
    background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.3) 0%, transparent 60%)`,
    opacity: currentShadow
  }
  
  animationFrame = requestAnimationFrame(updateTilt)
}

function handleMouseEnter() {
  if ('ontouchstart' in window) return
  isHovering.value = true
  animationFrame = requestAnimationFrame(updateTilt)
}

function handleMouseMove(e) {
  if (!cardRef.value || !isHovering.value) return
  const rect = cardRef.value.$el.getBoundingClientRect()
  targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1
  targetY = ((e.clientY - rect.top) / rect.height) * 2 - 1
}

function handleMouseLeave() {
  isHovering.value = false
  if (animationFrame) cancelAnimationFrame(animationFrame)
  
  currentX = 0
  currentY = 0
  targetX = 0
  targetY = 0
  currentScale = 1
  currentShadow = 0
  
  tiltStyle.value = {
    transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
    transition: `transform ${speed}ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow ${speed}ms cubic-bezier(0.23, 1, 0.32, 1)`
  }
  glareStyle.value = { opacity: 0 }
}

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
const ownerAvatarSeed = computed(() =>
  props.shop.owner_username || props.shop.owner_user_id || props.shop.name || 'shop'
)

const ownerAvatarCandidates = computed(() =>
  buildAvatarCandidates(props.shop.owner_avatar_template, 48)
)

// 处理图片加载错误
const handleImageError = (e) => {
  e.target.style.display = 'none'
  e.target.parentElement.classList.add('show-placeholder')
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
  background: var(--bg-card);
  border-radius: 16px;
  overflow: hidden;
  text-decoration: none;
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-sm);
  position: relative;
  transform-style: preserve-3d;
  will-change: transform, box-shadow;
}

.shop-card:hover {
  border-color: var(--border-medium);
}

.shop-card.pinned {
  border-color: var(--color-primary);
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-card) 100%);
}

/* 3D 光泽层 */
.tilt-glare {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 20;
  opacity: 0;
  transition: opacity 0.3s ease;
}

/* 小店图片 */
.shop-image {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 比例 */
  background: var(--bg-secondary);
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
  background: var(--bg-secondary);
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
  background: var(--glass-bg-heavy);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 14px;
  box-shadow: var(--shadow-sm);
}

/* 小店信息 */
.shop-info {
  padding: 14px 16px 16px;
}

.shop-name {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
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
  border: 1px solid var(--border-light);
}

.owner-name {
  font-size: 13px;
  color: var(--text-secondary);
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
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

/* 标签颜色 */
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
  background: rgba(124, 58, 237, 0.12);
  color: #a78bfa;
}

.shop-tag.tag-entertainment {
  background: rgba(190, 18, 60, 0.12);
  color: #fb7185;
}

.shop-tag.tag-charity {
  background: rgba(190, 24, 93, 0.12);
  color: #f472b6;
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
