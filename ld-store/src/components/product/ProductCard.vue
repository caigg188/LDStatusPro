<template>
  <router-link
    ref="cardRef"
    :to="`/product/${product.id}`"
    :class="[
      'product-card',
      {
        'out-of-stock': isOutOfStock,
        'product-card--featured': showFeaturedBadge,
        'product-card--featured-selection': isSelectionFeatured
      }
    ]"
    :style="tiltStyle"
    @mouseenter="handleMouseEnter"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
  >
    <!-- 3D 光泽效果层 -->
    <div class="tilt-glare" :style="glareStyle"></div>
    
    <!-- 折扣标签 -->
    <div v-if="showFeaturedBadge" class="badge-stack badge-stack--right">
      <span v-if="showFeaturedBadge" class="selection-badge" :style="featuredBadgeStyle">{{ featuredBadgeText }}</span>
    </div>
    
    <!-- 类型标签 -->
    <div v-if="isTestMode || isCdk || isStore" class="badge-stack">
      <span v-if="isTestMode" class="type-tag test type-tag--stacked">🧪 测试</span>
      <span v-else-if="isCdk" class="type-tag cdk type-tag--stacked">CDK</span>
      <span v-else-if="isStore" class="type-tag store type-tag--stacked">小店</span>
    </div>
    
    <!-- 商品图片 -->
    <div class="product-cover" :style="coverStyle">
      <!-- 骨架屏占位 -->
      <div v-if="product.image_url && !imageLoaded" class="cover-skeleton">
        <div class="skeleton-shimmer"></div>
      </div>
      <img
        v-if="product.image_url"
        :src="product.image_url"
        :alt="product.name"
        :class="['cover-image', { loaded: imageLoaded }]"
        loading="lazy"
        @load="handleImageLoad"
        @error="handleImageError"
      />
      <span v-if="!product.image_url" class="cover-placeholder">{{ categoryIcon }}</span>
    </div>
    
    <!-- 商品信息 -->
    <div class="product-body">
      <h3 class="product-name">{{ product.name }}</h3>
      
      <div class="product-meta">
        <span class="product-category">{{ categoryName }}</span>
        <span v-if="isCdk" :class="['product-stock', stockClass]">
          {{ stockDisplay }}
        </span>
        <span v-if="hasDiscount" class="product-stock product-discount">
          {{ discountFoldLabel }}
        </span>
        <span class="product-time">{{ updateTime }}</span>
      </div>
      
      <!-- 卖家信息 -->
      <div class="product-seller">
        <template v-if="isStore">
          <span class="store-owner-label">店主：</span>
          <span class="seller-name">{{ product.seller_username || '匿名' }}</span>
        </template>
        <template v-else>
          <AvatarImage
            :candidates="sellerAvatarCandidates"
            :seed="sellerAvatarSeed"
            :size="128"
            alt=""
            class="seller-avatar"
          />
          <span class="seller-name">{{ product.seller_username || '匿名' }}</span>
          <span v-if="isCdk && soldCount > 0" class="sold-count">已售{{ soldCount }}</span>
        </template>
      </div>
      
      <!-- 价格和浏览量 -->
      <div class="product-footer">
        <div class="price-block">
          <div class="price-row">
            <div :class="['product-price', { discounted: hasDiscount }]">
              {{ finalPrice }}<span class="unit">LDC</span>
            </div>
            <span v-if="hasDiscount" class="original-price">{{ originalPrice }} LDC</span>
          </div>
        </div>
        <span class="product-views">👁 {{ product.view_count || 0 }}</span>
      </div>
    </div>
  </router-link>
</template>

<script setup>
import { ref, computed } from 'vue'
import AvatarImage from '@/components/common/AvatarImage.vue'
import { formatRelativeTime, formatPrice } from '@/utils/format'
import { buildAvatarCandidates } from '@/utils/avatar'

const props = defineProps({
  product: {
    type: Object,
    required: true
  },
  categories: {
    type: Array,
    default: () => []
  }
})


// 图片加载状态
const imageLoaded = ref(false)

// 3D 倾斜效果
const cardRef = ref(null)
const tiltStyle = ref({})
const glareStyle = ref({})
const isHovering = ref(false)

// 配置
const maxTilt = 10 // 最大倾斜角度
const perspective = 1000 // 透视距离
const scale = 1.02 // 悬停缩放
const speed = 400 // 过渡速度

let currentX = 0
let currentY = 0
let targetX = 0
let targetY = 0
let currentScale = 1
let currentShadow = 0 // 阴影强度 0-1
let animationFrame = null

function lerp(start, end, factor) {
  return start + (end - start) * factor
}

function updateTilt() {
  if (!isHovering.value) return
  
  currentX = lerp(currentX, targetX, 0.08)
  currentY = lerp(currentY, targetY, 0.08)
  currentScale = lerp(currentScale, scale, 0.06)
  currentShadow = lerp(currentShadow, 1, 0.05) // 阴影缓慢增强
  
  const rotateX = currentY * maxTilt
  const rotateY = -currentX * maxTilt
  
  // 计算阴影偏移（基于倾斜方向）
  const shadowX = -currentX * 8
  const shadowY = currentY * 8 + 15
  const shadowBlur = 20 + currentShadow * 25
  const shadowConfig = getCardShadowConfig()
  const shadowAlpha = shadowConfig.primaryBase + currentShadow * shadowConfig.primaryBoost
  const liftY = shadowConfig.secondaryBaseY + currentShadow * shadowConfig.secondaryBoostY
  const liftBlur = shadowConfig.secondaryBaseBlur + currentShadow * shadowConfig.secondaryBoostBlur
  const liftAlpha = shadowConfig.secondaryBaseAlpha + currentShadow * shadowConfig.secondaryBoostAlpha
  const accentShadow = shadowConfig.accentShadow ? `, ${shadowConfig.accentShadow}` : ''
  
  tiltStyle.value = {
    transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${currentScale}, ${currentScale}, ${currentScale})`,
    boxShadow: `${shadowX}px ${shadowY}px ${shadowBlur}px rgba(${shadowConfig.primaryRgb}, ${shadowAlpha.toFixed(3)}), 0 ${liftY}px ${liftBlur}px rgba(${shadowConfig.secondaryRgb}, ${liftAlpha.toFixed(3)})${accentShadow}`
  }
  
  // 光泽跟随
  const glareX = (currentX + 1) * 50
  const glareY = (currentY + 1) * 50
  glareStyle.value = {
    background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.25) 0%, transparent 60%)`,
    opacity: currentShadow
  }
  
  animationFrame = requestAnimationFrame(updateTilt)
}

function handleMouseEnter() {
  // 检查是否触摸设备
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
    boxShadow: getCardShadowConfig().restingShadow,
    transition: `transform ${speed}ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow ${speed}ms cubic-bezier(0.23, 1, 0.32, 1)`
  }
  glareStyle.value = { opacity: 0 }
}

// 商品类型
const productType = computed(() => props.product.product_type || 'link')
const isCdk = computed(() => productType.value === 'cdk')
const isStore = computed(() => productType.value === 'store')
const isTestMode = computed(() => !!props.product.is_test_mode || !!props.product.isTestMode)
const showFeaturedBadge = computed(() => !!props.product.is_pinned && !!props.product.pin_is_paid)
const featuredPinType = computed(() => {
  const rawPinType = String(props.product.pin_type || props.product.pinType || '').trim().toLowerCase()

  if (rawPinType === 'category' || rawPinType === 'global') {
    return rawPinType
  }

  return showFeaturedBadge.value ? 'global' : ''
})
const isSelectionFeatured = computed(() => showFeaturedBadge.value && featuredPinType.value === 'global')
const featuredBadgeText = computed(() => (
  featuredPinType.value === 'category' ? '士多优选' : '士多甄选'
))
const featuredBadgeStyle = computed(() => {
  const seed = getAnimationSeed(props.product.id ?? props.product.name ?? 'selection-badge')
  const duration = 3.1 + (seed % 5) * 0.18
  const phase = ((seed % 100) / 100) * duration
  const drift = -12 + (seed % 7) * 4

  return {
    '--featured-wave-duration': `${duration.toFixed(2)}s`,
    '--featured-wave-delay': `${(-phase).toFixed(2)}s`,
    '--featured-wave-drift': `${drift}%`
  }
})

// 价格计算
const price = computed(() => parseFloat(props.product.price) || 0)
const discount = computed(() => parseFloat(props.product.discount) || 1)
const hasDiscount = computed(() => discount.value < 1)
const discountFoldLabel = computed(() => `${Number((discount.value * 10).toFixed(1))}折`)
const finalPrice = computed(() => formatPrice(price.value * discount.value))
const originalPrice = computed(() => formatPrice(price.value))

function toSafeInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getAnimationSeed(value) {
  const raw = String(value ?? '')
  let hash = 2166136261

  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return Math.abs(hash >>> 0) || 1
}
function getCardShadowConfig() {
  if (showFeaturedBadge.value) {
    return {
      primaryRgb: '168, 126, 35',
      secondaryRgb: '107, 77, 20',
      primaryBase: 0.14,
      primaryBoost: 0.12,
      secondaryBaseY: 6,
      secondaryBoostY: 8,
      secondaryBaseBlur: 12,
      secondaryBoostBlur: 16,
      secondaryBaseAlpha: 0.08,
      secondaryBoostAlpha: 0.08,
      accentShadow: '0 0 0 1px rgba(255, 241, 205, 0.52) inset',
      restingShadow: '0 10px 24px rgba(156, 117, 31, 0.14), 0 1px 0 rgba(255, 255, 255, 0.68) inset, 0 0 0 1px rgba(255, 241, 205, 0.52) inset'
    }
  }

  return {
    primaryRgb: '0, 0, 0',
    secondaryRgb: '0, 0, 0',
    primaryBase: 0.06,
    primaryBoost: 0.1,
    secondaryBaseY: 4,
    secondaryBoostY: 6,
    secondaryBaseBlur: 8,
    secondaryBoostBlur: 12,
    secondaryBaseAlpha: 0.05,
    secondaryBoostAlpha: 0.05,
    accentShadow: '',
    restingShadow: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.08)'
  }
}

// 库存
const stock = computed(() => toSafeInt(props.product.stock, 0))
const cdkAvailableStock = computed(() => {
  if (props.product.availableStock !== undefined && props.product.availableStock !== null && props.product.availableStock !== '') {
    return Math.max(0, toSafeInt(props.product.availableStock, 0))
  }
  if (props.product.cdkStats?.available !== undefined && props.product.cdkStats?.available !== null) {
    return Math.max(0, toSafeInt(props.product.cdkStats.available, 0))
  }
  return null
})
const cdkTotalStock = computed(() => {
  if (props.product.cdkStats?.total !== undefined && props.product.cdkStats?.total !== null) {
    return Math.max(0, toSafeInt(props.product.cdkStats.total, 0))
  }
  return null
})
const isUnlimitedStock = computed(() => {
  if (isCdk.value && (cdkAvailableStock.value !== null || cdkTotalStock.value !== null)) {
    // CDK 商品如果返回了库存统计，优先以统计为准，避免 0 库存误显示为无限
    return false
  }
  return stock.value === -1
})
const availableStock = computed(() => {
  if (isCdk.value && cdkAvailableStock.value !== null) return cdkAvailableStock.value
  if (isUnlimitedStock.value) return -1
  return Math.max(0, stock.value)
})
const totalStock = computed(() => {
  if (isCdk.value && cdkTotalStock.value !== null) return cdkTotalStock.value
  if (availableStock.value === -1) return -1
  return Math.max(0, stock.value)
})
const isOutOfStock = computed(() => 
  isCdk.value && !isUnlimitedStock.value && availableStock.value <= 0
)

// 库存状态样式类
// ≤0: out（售罄）, ≤2: danger（红色）, 3-5: warning（黄色）, >5: normal（绿色）
const stockClass = computed(() => {
  if (!isCdk.value || isUnlimitedStock.value) return 'normal' // 无限库存显示绿色
  if (availableStock.value <= 0) return 'out'
  if (availableStock.value <= 2) return 'danger'
  if (availableStock.value <= 5) return 'warning'
  return 'normal'
})
const stockDisplay = computed(() => {
  if (isUnlimitedStock.value) return '∞'
  // 如果库存是0，直接显示0，不显示无限符号
  if (totalStock.value <= 0) return `${Math.max(0, availableStock.value)}`
  return `${availableStock.value}/${totalStock.value}`
})

// 销量
const soldCount = computed(() => parseInt(props.product.sold_count) || 0)

// 分类
const category = computed(() => 
  props.categories.find(c => c.id === props.product.category_id)
)
const categoryIcon = computed(() => 
  props.product.category_icon || category.value?.icon || '📦'
)
const categoryName = computed(() => 
  props.product.category_name || category.value?.name || '其他'
)

// 卖家头像
const sellerAvatarSeed = computed(() =>
  props.product.seller_username || props.product.seller_user_id || 'seller'
)

const sellerAvatarCandidates = computed(() =>
  buildAvatarCandidates(props.product.seller_avatar, 128)
)

// 更新时间
const updateTime = computed(() => 
  formatRelativeTime(props.product.updated_at || props.product.created_at)
)

// 封面样式
const colors = [
  'linear-gradient(135deg, #e0f2fe, #bae6fd)',
  'linear-gradient(135deg, #fce7f3, #fbcfe8)',
  'linear-gradient(135deg, #d1fae5, #a7f3d0)',
  'linear-gradient(135deg, #fef3c7, #fde68a)',
  'linear-gradient(135deg, #ede9fe, #ddd6fe)',
  'linear-gradient(135deg, #ffedd5, #fed7aa)',
  'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
  'linear-gradient(135deg, #f5f5f4, #e7e5e4)'
]
const coverStyle = computed(() => {
  if (props.product.image_url) return {}
  const index = props.product.id ? Math.abs(props.product.id) % colors.length : 0
  return { background: colors[index] }
})

// 事件处理
function handleImageLoad() {
  imageLoaded.value = true
}

function handleImageError(e) {
  imageLoaded.value = true // 隐藏骨架屏
  e.target.style.display = 'none'
}

</script>

<style scoped>
.product-card {
  display: block;
  background: var(--bg-card);
  border-radius: 16px;
  overflow: hidden;
  text-decoration: none;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  position: relative;
  transform-style: preserve-3d;
  will-change: transform, box-shadow;
  transition: background 0.28s ease, border-color 0.28s ease;
}

.product-card--featured {
  background: var(--bg-card);
  border-color: rgba(197, 151, 49, 0.24);
  box-shadow:
    0 10px 24px rgba(156, 117, 31, 0.14),
    0 1px 0 rgba(255, 255, 255, 0.68) inset,
    0 0 0 1px rgba(255, 241, 205, 0.52) inset;
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

.product-card--featured .product-cover,
.product-card--featured .product-body {
  position: relative;
  z-index: 1;
}

.product-card.out-of-stock {
  opacity: 0.7;
}

.product-card.out-of-stock::after {
  content: '已售罄';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-15deg);
  background: var(--overlay-bg);
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  z-index: 10;
}

.type-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 8px;
}

.badge-stack {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

.badge-stack--right {
  left: auto;
  right: 10px;
  align-items: flex-end;
}

.type-tag--stacked {
  position: static;
  width: fit-content;
}

.type-tag.cdk {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  box-shadow: 0 2px 6px rgba(139, 92, 246, 0.35);
}

.type-tag.test {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  color: white;
  box-shadow: 0 2px 6px rgba(6, 182, 212, 0.35);
}

.type-tag.store {
  background: linear-gradient(135deg, #7d8d69 0%, #627151 100%);
  color: white;
}

.selection-badge {
  display: inline-flex;
  align-items: center;
  position: relative;
  width: fit-content;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #fff9ef;
  overflow: hidden;
  isolation: isolate;
  background:
    linear-gradient(135deg, #ffe49a 0%, #d69727 28%, #8f5d12 100%);
  box-shadow:
    0 0 0 1px rgba(255, 240, 199, 0.3),
    0 0 14px rgba(255, 199, 73, 0.35),
    0 6px 18px rgba(179, 119, 16, 0.28);
}

.selection-badge::before,
.selection-badge::after {
  content: '';
  position: absolute;
  opacity: 0;
  pointer-events: none;
  mix-blend-mode: screen;
  animation-delay: var(--featured-wave-delay, 0s);
}

.selection-badge::before {
  inset: -22% -35%;
  background: linear-gradient(
    112deg,
    transparent 18%,
    rgba(255, 251, 236, 0.05) 32%,
    rgba(255, 255, 255, 0.82) 50%,
    rgba(255, 247, 204, 0.16) 68%,
    transparent 82%
  );
  transform: translate3d(-118%, 0, 0) skewX(-16deg) scaleX(0.94);
  filter: blur(0.4px);
  animation: featured-badge-wave-core var(--featured-wave-duration, 3.4s) linear infinite;
}

.selection-badge::after {
  inset: -46% -20%;
  background: radial-gradient(
    circle at calc(30% + var(--featured-wave-drift, 0%)) 50%,
    rgba(255, 255, 255, 0.46) 0%,
    rgba(255, 247, 212, 0.22) 18%,
    rgba(255, 221, 128, 0.12) 36%,
    transparent 72%
  );
  transform: translate3d(-10%, 0, 0) scale(0.96);
  filter: blur(2.4px);
  animation: featured-badge-wave-glow var(--featured-wave-duration, 3.4s) linear infinite;
}

@keyframes featured-badge-wave-core {
  0%,
  64%,
  100% {
    transform: translate3d(-118%, 0, 0) skewX(-16deg) scaleX(0.94);
    opacity: 0;
  }

  12% {
    opacity: 0;
  }

  20% {
    transform: translate3d(-78%, 0, 0) skewX(-16deg) scaleX(0.97);
    opacity: 0.14;
  }

  28% {
    transform: translate3d(-26%, 0, 0) skewX(-16deg) scaleX(1);
    opacity: 0.72;
  }

  36% {
    transform: translate3d(18%, 0, 0) skewX(-16deg) scaleX(1.02);
    opacity: 0.64;
  }

  44% {
    transform: translate3d(70%, 0, 0) skewX(-16deg) scaleX(0.98);
    opacity: 0.12;
  }
}

@keyframes featured-badge-wave-glow {
  0%,
  64%,
  100% {
    transform: translate3d(-10%, 0, 0) scale(0.96);
    opacity: 0;
  }

  16% {
    opacity: 0.04;
  }

  30% {
    transform: translate3d(0, 0, 0) scale(1.04);
    opacity: 0.22;
  }

  40% {
    transform: translate3d(8%, 0, 0) scale(1.08);
    opacity: 0.16;
  }

  48% {
    transform: translate3d(14%, 0, 0) scale(1.11);
    opacity: 0.04;
  }
}

/* 封面 */
.product-cover {
  position: relative;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--bg-secondary);
}

.product-card--featured .product-cover {
  box-shadow: inset 0 -1px 0 rgba(190, 149, 55, 0.18);
}

/* 骨架屏 */
.cover-skeleton {
  position: absolute;
  inset: 0;
  background: var(--skeleton-base);
  z-index: 1;
}

.skeleton-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--skeleton-shine) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transform: scale(1.02);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.cover-image.loaded {
  opacity: 1;
  transform: scale(1);
}

.cover-placeholder {
  font-size: 48px;
  opacity: 0.8;
}

/* 内容 */
.product-body {
  padding: 12px;
}


.product-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.product-card--featured-selection .product-name {
  color: #b88622;
}

.product-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.product-category {
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
}

.product-card--featured .product-category {
  background: rgba(184, 140, 34, 0.1);
  color: #8b6520;
  box-shadow: inset 0 0 0 1px rgba(184, 140, 34, 0.16);
}

.product-stock {
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 600;
  white-space: nowrap;
}

/* 库存充足 (>5) - 绿色 */
.product-stock.normal {
  background: var(--color-success-bg);
  color: var(--color-success);
}

/* 库存紧张 (3-5) - 黄色 */
.product-stock.warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

/* 库存告急 (≤2) - 红色 */
.product-stock.danger {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

/* 售罄 (0) - 红色加粗 */
.product-stock.out {
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-weight: 700;
}

.product-discount {
  background: rgba(244, 63, 94, 0.12);
  color: #e11d48;
  box-shadow: inset 0 0 0 1px rgba(225, 29, 72, 0.14);
}

.product-time {
  margin-left: auto;
}

/* 卖家 */
.product-seller {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.seller-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.product-card--featured .seller-avatar {
  box-shadow: 0 0 0 1px rgba(199, 160, 73, 0.45);
}

.store-owner-label {
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.seller-name {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sold-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--color-warning);
}

/* 底部 */
.product-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.price-block {
  min-width: 0;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  flex-wrap: nowrap;
}

.product-price {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-warning);
  line-height: 1;
  white-space: nowrap;
}

.product-card--featured .store-owner-label,
.product-card--featured .seller-name,
.product-card--featured .product-time,
.product-card--featured .product-views {
  color: #8a6b37;
}

.product-price .unit {
  font-size: 12px;
  font-weight: 500;
  margin-left: 2px;
}

.product-price.discounted {
  color: #ef4444;
}

.original-price {
  font-size: 11px;
  color: var(--text-tertiary);
  text-decoration: line-through;
  font-weight: 400;
  white-space: nowrap;
}

.product-views {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .product-cover {
    height: 120px;
  }

  .product-name {
    font-size: 13px;
  }

  .product-price {
    font-size: 16px;
  }
}
</style>
