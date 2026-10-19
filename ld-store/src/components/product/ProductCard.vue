<template>
  <router-link
    v-if="!isBlocked"
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
    @click="handleCardClick"
  >
    <!-- 3D 光泽效果层 -->
    <div class="tilt-glare" :style="glareStyle"></div>
    
    <!-- 折扣标签 -->
    <div v-if="showFeaturedBadge" class="badge-stack badge-stack--right">
      <span v-if="showFeaturedBadge" class="selection-badge" :style="featuredBadgeStyle">{{ featuredBadgeText }}</span>
    </div>
    
    <span v-if="product.duoPromotion?.kind === 'paid'" class="duo-ad-label" title="DUO+ 推广">广告</span>
    <!-- 类型标签 -->
    <div v-if="isTestMode || isCdk || isNormal || isStore || isLegacyLink" class="badge-stack">
      <span v-if="isTestMode" class="type-tag test type-tag--stacked">
        <TestTube2 :size="12" aria-hidden="true" />
        测试
      </span>
      <span v-else-if="isCdk" class="type-tag cdk type-tag--stacked">CDK</span>
      <span v-else-if="isNormal" class="type-tag normal type-tag--stacked">普通</span>
      <span v-else-if="isStore" class="type-tag store type-tag--stacked">小店</span>
      <span v-else-if="isLegacyLink" class="type-tag link type-tag--stacked">外链</span>
    </div>
    
    <!-- 商品图片 -->
    <div class="product-cover" :style="coverStyle">
      <!-- 骨架屏占位 -->
      <div v-if="product.imageUrl && !imageLoaded" class="cover-skeleton">
        <div class="skeleton-shimmer"></div>
      </div>
      <img
        v-if="product.imageUrl"
        :src="product.imageUrl"
        :alt="product.name"
        :class="['cover-image', { loaded: imageLoaded }]"
        :loading="imageLoading"
        :fetchpriority="fetchPriority"
        @load="handleImageLoad"
        @error="handleImageError"
      />
      <component
        :is="categoryIconComponent"
        v-if="!product.imageUrl"
        :size="52"
        :stroke-width="1.6"
        aria-hidden="true"
        class="cover-placeholder"
      />
    </div>
    
    <!-- 商品信息 -->
    <div class="product-body">
      <h3 class="product-name">{{ product.name }}</h3>
      
      <div class="product-meta">
        <span class="product-category">{{ categoryName }}</span>
        <span v-if="isPlatformOrder" :class="['product-stock', stockClass]">
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
          <span class="seller-name">{{ product.sellerUsername || '匿名' }}</span>
        </template>
        <template v-else>
          <AvatarImage
            :candidates="sellerAvatarCandidates"
            :seed="sellerAvatarSeed"
            :size="128"
            alt=""
            class="seller-avatar"
          />
          <span class="seller-name">{{ product.sellerUsername || '匿名' }}</span>
          <span v-if="isPlatformOrder && soldCount > 0" class="sold-count">已售{{ soldCount }}</span>
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
        <span class="product-views" :title="viewCountLabel">
          <Eye :size="14" aria-hidden="true" />
          <span aria-hidden="true">{{ compactViewCount }}</span>
          <span class="sr-only">{{ viewCountLabel }}</span>
        </span>
      </div>
    </div>
  </router-link>
</template>

<script setup>
import { observeDuoVisibility } from '@/utils/duoVisibility'
import { reportDuo } from '@/services/shop/duoTelemetry'
import { authSession, captureAuthSession, isAuthSessionCurrent } from '@/utils/auth'

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  Eye,
  Gamepad2,
  MessageCircle,
  PackageOpen,
  Server,
  Store,
  TestTube2,
  Wrench
} from '@lucide/vue'
import { useProductStore } from '@/stores/product'
import AvatarImage from '@/components/common/AvatarImage.vue'
import { formatCompactCount, formatNumber, formatRelativeTime, formatPrice } from '@/utils/format'
import { buildAvatarCandidates } from '@/utils/avatar'
import { recordProductClick, recordProductImpression } from '@/services/shop/discoveryService'
import {
  getAvailableStock,
  getStockDisplay,
  isCdkProduct,
  isLegacyLinkProduct,
  isNormalProduct,
  isOutOfStock as isProductOutOfStock,
  isPlatformOrderProduct,
  isStoreProduct,
  isUnlimitedStock
} from '@/utils/shopProduct'

const props = defineProps({
  product: {
    type: Object,
    required: true
  },
  categories: {
    type: Array,
    default: () => []
  },
  imageLoading: {
    type: String,
    default: 'lazy',
    validator: (value) => ['eager', 'lazy'].includes(value)
  },
  fetchPriority: {
    type: String,
    default: 'auto',
    validator: (value) => ['high', 'auto', 'low'].includes(value)
  }
})

const productStore = useProductStore()
const isBlocked = computed(() => productStore.isProductBlocked(props.product.id))


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
let currentGlareOpacity = 0
let animationFrame = null
let resetTimer = null
let impressionTimer = null
let impressionObserver = null
let impressionRecorded = false
let stopDuoObserver = () => {}

function cardElement() {
  return cardRef.value?.$el || cardRef.value || null
}

function handleCardClick() {
  recordProductClick(props.product)
  if (props.product.duoPromotion?.kind === 'paid') void reportDuo(props.product.duoPromotion.token, 'click')
}

function setupImpressionObserver() {
  impressionObserver?.disconnect()
  if (impressionTimer) window.clearTimeout(impressionTimer)
  impressionTimer = null
  impressionRecorded = false
  const element = cardElement()
  const token = props.product?.discoveryToken
  if (!element || !token || typeof IntersectionObserver === 'undefined') return
  impressionObserver = new IntersectionObserver((entries) => {
    const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)
    if (!visible) {
      if (impressionTimer) window.clearTimeout(impressionTimer)
      impressionTimer = null
      return
    }
    if (impressionRecorded || impressionTimer) return
    impressionTimer = window.setTimeout(() => {
      impressionTimer = null
      if (impressionRecorded || document.visibilityState !== 'visible') return
      impressionRecorded = true
      recordProductImpression(props.product)
      impressionObserver?.disconnect()
    }, 500)
  }, { threshold: [0.5] })
  impressionObserver.observe(element)
}
function handleDiscoveryVisibility() { if (!impressionRecorded) setupImpressionObserver() }
onMounted(() => { setupImpressionObserver(); document.addEventListener('visibilitychange', handleDiscoveryVisibility) })
onUnmounted(() => document.removeEventListener('visibilitychange', handleDiscoveryVisibility))
watch(() => props.product?.discoveryToken, setupImpressionObserver, { flush: 'post' })
function setupDuoObserver() {
  stopDuoObserver()
  const token = props.product?.duoPromotion?.token, element = cardElement(), session = captureAuthSession()
  const observation = props.product?.duoObservation && props.product?.discoveryToken
  if ((!token && !observation) || !element || typeof IntersectionObserver === 'undefined') return
  stopDuoObserver = observeDuoVisibility(element, () => {
    if (!isAuthSessionCurrent(session)) return
    if (token) void reportDuo(token, 'impression', session)
    if (observation) void reportDuo(observation, 'observation', session)
  })
}
onMounted(setupDuoObserver)
watch([() => props.product?.duoPromotion?.token, () => props.product?.duoObservation, () => props.product?.discoveryToken, () => authSession.value.revision], setupDuoObserver, { flush: 'post' })
onUnmounted(() => stopDuoObserver())


function lerp(start, end, factor) {
  return start + (end - start) * factor
}

function updateTilt() {
  if (!isHovering.value) return
  
  currentX = lerp(currentX, targetX, 0.08)
  currentY = lerp(currentY, targetY, 0.08)
  currentScale = lerp(currentScale, scale, 0.06)
  currentGlareOpacity = lerp(currentGlareOpacity, 1, 0.05)
  
  const rotateX = currentY * maxTilt
  const rotateY = -currentX * maxTilt
  
  tiltStyle.value = {
    transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${currentScale}, ${currentScale}, ${currentScale})`,
    willChange: 'transform'
  }
  
  // 光泽跟随
  const glareX = (currentX + 1) * 50
  const glareY = (currentY + 1) * 50
  glareStyle.value = {
    background: `radial-gradient(circle at ${glareX}% ${glareY}%, var(--palette-rgba-255-255-255-0p25) 0%, transparent 60%)`,
    opacity: currentGlareOpacity
  }
  
  animationFrame = requestAnimationFrame(updateTilt)
}

function handleMouseEnter() {
  // 触摸设备和减少动态效果偏好下不创建临时 3D 合成层。
  if (
    'ontouchstart' in window
    || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) return
  if (resetTimer) window.clearTimeout(resetTimer)
  tiltStyle.value = { willChange: 'transform' }
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
  currentGlareOpacity = 0
  
  tiltStyle.value = {
    transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
    transition: `transform ${speed}ms cubic-bezier(0.23, 1, 0.32, 1)`
  }
  glareStyle.value = { opacity: 0 }

  // 回弹结束后释放合成层；列表中的所有卡片永久占层会导致滚动时频繁重栅格化。
  resetTimer = window.setTimeout(() => {
    if (!isHovering.value) tiltStyle.value = {}
  }, speed)
}

onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  if (resetTimer) window.clearTimeout(resetTimer)
  if (impressionTimer) window.clearTimeout(impressionTimer)
  impressionObserver?.disconnect()
})

// 商品类型
const isCdk = computed(() => isCdkProduct(props.product))
const isNormal = computed(() => isNormalProduct(props.product))
const isStore = computed(() => isStoreProduct(props.product))
const isLegacyLink = computed(() => isLegacyLinkProduct(props.product))
const isPlatformOrder = computed(() => isPlatformOrderProduct(props.product))
const isTestMode = computed(() => !!props.product.isTestMode)
const showFeaturedBadge = computed(() => !!props.product.isPinned && !!props.product.pinIsPaid)
const featuredPinType = computed(() => {
  const rawPinType = String(props.product.pinType || '').trim().toLowerCase()

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

function getAnimationSeed(value) {
  const raw = String(value ?? '')
  let hash = 2166136261

  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return Math.abs(hash >>> 0) || 1
}

// 库存
const availableStock = computed(() => getAvailableStock(props.product))
const hasUnlimitedStock = computed(() => isUnlimitedStock(props.product))
const isOutOfStock = computed(() => isProductOutOfStock(props.product))

// 库存状态样式类
// ≤0: out（售罄）, ≤2: danger（红色）, 3-5: warning（黄色）, >5: normal（绿色）
const stockClass = computed(() => {
  if (!isPlatformOrder.value || hasUnlimitedStock.value) return 'normal'
  if (availableStock.value <= 0) return 'out'
  if (availableStock.value <= 2) return 'danger'
  if (availableStock.value <= 5) return 'warning'
  return 'normal'
})
const stockDisplay = computed(() => getStockDisplay(props.product))

// 销量
const soldCount = computed(() => parseInt(props.product.soldCount) || 0)

// 浏览量：视觉上使用紧凑 k 单位，辅助技术与悬浮提示保留完整数字
const viewCount = computed(() => {
  const parsed = Number(props.product.viewCount)
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0
})
const compactViewCount = computed(() => formatCompactCount(viewCount.value))
const viewCountLabel = computed(() => `${formatNumber(viewCount.value)} 次浏览`)

// 分类
const category = computed(() => 
  props.categories.find(c => String(c.id) === String(props.product.categoryId))
)
const categoryName = computed(() => 
  props.product.categoryName || category.value?.name || '其他'
)
const categoryIcons = {
  '公益站': Server,
  '服务': Wrench,
  '咨询': MessageCircle,
  '小店': Store,
  '游戏': Gamepad2
}
const categoryIconComponent = computed(() => categoryIcons[categoryName.value] || PackageOpen)

// 卖家头像
const sellerAvatarSeed = computed(() =>
  props.product.sellerUsername || props.product.sellerUserId || 'seller'
)

const sellerAvatarCandidates = computed(() =>
  buildAvatarCandidates(props.product.sellerAvatar, 128)
)

// 更新时间
const updateTime = computed(() => 
  formatRelativeTime(props.product.updatedAt || props.product.createdAt)
)

// 封面样式
const colors = [
  'linear-gradient(135deg, var(--palette-hex-e0f2fe), var(--palette-hex-bae6fd))',
  'linear-gradient(135deg, var(--palette-hex-fce7f3), var(--palette-hex-fbcfe8))',
  'linear-gradient(135deg, var(--palette-hex-d1fae5), var(--palette-hex-a7f3d0))',
  'linear-gradient(135deg, var(--palette-hex-fef3c7), var(--palette-hex-fde68a))',
  'linear-gradient(135deg, var(--palette-hex-ede9fe), var(--palette-hex-ddd6fe))',
  'linear-gradient(135deg, var(--palette-hex-ffedd5), var(--palette-hex-fed7aa))',
  'linear-gradient(135deg, var(--palette-hex-e0e7ff), var(--palette-hex-c7d2fe))',
  'linear-gradient(135deg, var(--palette-hex-f5f5f4), var(--palette-hex-e7e5e4))'
]
const coverStyle = computed(() => {
  if (props.product.imageUrl) return {}
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
.duo-ad-label { position:absolute; z-index:2; right:10px; bottom:10px; padding:2px 7px; border:1px solid var(--border-color); border-radius:5px; color:var(--text-secondary); background:var(--bg-card); font-size:12px; line-height:1.5; }

.product-card {
  --product-featured-border: var(--palette-rgba-197-151-49-0p24);
  --product-featured-shadow:
    0 10px 24px var(--palette-rgba-156-117-31-0p14),
    0 1px 0 var(--palette-rgba-255-255-255-0p68) inset,
    0 0 0 1px var(--palette-rgba-255-241-205-0p52) inset;
  --product-featured-cover-shadow: inset 0 -1px 0 var(--palette-rgba-190-149-55-0p18);
  --product-featured-title: var(--palette-hex-b88622);
  --product-featured-meta: var(--palette-hex-8a6b37);
  --product-featured-category-bg: var(--palette-hex-f3efe2);
  --product-featured-category-text: var(--palette-hex-8b6520);
  --product-featured-category-ring: var(--palette-hex-eae3d3);
  --product-featured-avatar-ring: var(--palette-hex-c9b87a);
  --product-selection-text: var(--palette-hex-fff9ef);
  --product-selection-bg:
    linear-gradient(135deg, var(--palette-hex-ffe49a) 0%, var(--palette-hex-d69727) 28%, var(--palette-hex-8f5d12) 100%);
  --product-selection-shadow:
    0 0 0 1px var(--palette-rgba-255-240-199-0p3),
    0 0 14px var(--palette-rgba-255-199-73-0p35),
    0 6px 18px var(--palette-rgba-179-119-16-0p28);
  display: flex;
  flex-direction: column;
  height: 100%;
  container-type: inline-size;
  background-color: var(--product-card-bg, var(--bg-card));
  border-radius: var(--card-radius);
  overflow: hidden;
  text-decoration: none;
  box-shadow: var(--product-card-shadow, var(--shadow-sm));
  border: 1px solid var(--product-card-border, var(--border-light));
  position: relative;
  isolation: isolate;
  transition: background-color 0.28s ease, border-color 0.28s ease;
}

:global(html.dark .product-card) {
  --product-card-discount-bg: var(--palette-hex-3a2225);
  --product-card-discount-text: var(--palette-hex-fecaca);
  --product-card-discount-ring: var(--palette-hex-3f282c);
  --product-card-price-discounted: var(--palette-hex-f87171);
  --product-featured-border: var(--palette-hex-3d3526);
  --product-featured-shadow:
    0 12px 28px var(--palette-rgba-0-0-0-0p24),
    0 0 0 1px var(--palette-hex-3d3526) inset;
  --product-featured-cover-shadow: inset 0 -1px 0 var(--palette-hex-3d3526);
  --product-featured-title: var(--palette-hex-efc775);
  --product-featured-meta: var(--palette-hex-d9c29a);
  --product-featured-category-bg: var(--palette-hex-363024);
  --product-featured-category-text: var(--palette-hex-f4d490);
  --product-featured-category-ring: var(--palette-hex-3d3526);
  --product-featured-avatar-ring: var(--palette-hex-4a3d28);
  --product-selection-text: var(--palette-hex-fff6df);
  --product-selection-bg:
    linear-gradient(135deg, var(--palette-hex-c79224) 0%, var(--palette-hex-8f661a) 40%, var(--palette-hex-5b3d11) 100%);
  --product-selection-shadow:
    0 0 0 1px var(--palette-rgba-244-201-109-0p18),
    0 0 14px var(--palette-rgba-199-146-36-0p24),
    0 6px 18px var(--palette-rgba-0-0-0-0p24);
}

.product-card--featured {
  background-color: var(--product-card-bg, var(--bg-card));
  border-color: var(--product-featured-border);
  box-shadow: var(--product-featured-shadow);
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
  background: var(--product-card-overlay, var(--overlay-bg));
  color: var(--palette-hex-ffffff);
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  z-index: 10;
}

.type-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 8px;
}

.type-tag svg {
  flex-shrink: 0;
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
  background: linear-gradient(135deg, var(--palette-hex-8b5cf6) 0%, var(--palette-hex-7c3aed) 100%);
  color: var(--palette-hex-ffffff);
  box-shadow: 0 2px 6px var(--palette-rgba-139-92-246-0p35);
}

.type-tag.normal {
  background: linear-gradient(135deg, var(--palette-hex-2563eb) 0%, var(--palette-hex-1d4ed8) 100%);
  color: var(--palette-hex-ffffff);
  box-shadow: 0 2px 6px var(--palette-rgba-37-99-235-0p28);
}

.type-tag.test {
  background: linear-gradient(135deg, var(--palette-hex-06b6d4) 0%, var(--palette-hex-0891b2) 100%);
  color: var(--palette-hex-ffffff);
  box-shadow: 0 2px 6px var(--palette-rgba-6-182-212-0p35);
}

.type-tag.store {
  background: linear-gradient(135deg, var(--palette-hex-7d8d69) 0%, var(--palette-hex-627151) 100%);
  color: var(--palette-hex-ffffff);
}

.type-tag.link {
  background: linear-gradient(135deg, var(--palette-hex-f59e0b) 0%, var(--palette-hex-d97706) 100%);
  color: var(--palette-hex-ffffff);
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
  color: var(--product-selection-text);
  overflow: hidden;
  isolation: isolate;
  background: var(--product-selection-bg);
  box-shadow: var(--product-selection-shadow);
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
    var(--palette-rgba-255-251-236-0p05) 32%,
    var(--palette-rgba-255-255-255-0p82) 50%,
    var(--palette-rgba-255-247-204-0p16) 68%,
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
    var(--palette-rgba-255-255-255-0p46) 0%,
    var(--palette-rgba-255-247-212-0p22) 18%,
    var(--palette-rgba-255-221-128-0p12) 36%,
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
  height: var(--card-cover-h);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--product-card-cover-bg, var(--bg-secondary));
}

.product-card--featured .product-cover {
  box-shadow: var(--product-featured-cover-shadow);
}

/* 骨架屏 */
.cover-skeleton {
  position: absolute;
  inset: 0;
  background: var(--product-card-skeleton-bg, var(--skeleton-base));
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
  color: var(--text-muted);
  opacity: 0.72;
}

/* 内容 */
.product-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: var(--card-pad);
  min-width: 0;
}


.product-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
  line-height: 1.4;
  min-height: 2.8em;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.product-card--featured-selection .product-name {
  color: var(--product-featured-title);
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
  background: var(--product-card-category-bg, var(--bg-secondary));
  padding: 2px 6px;
  border-radius: 4px;
}

.product-card--featured .product-category {
  background: var(--product-featured-category-bg);
  color: var(--product-featured-category-text);
  box-shadow: inset 0 0 0 1px var(--product-featured-category-ring);
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
  background: var(--product-card-discount-bg, var(--palette-hex-fce8ec));
  color: var(--product-card-discount-text, var(--palette-hex-e11d48));
  box-shadow: inset 0 0 0 1px var(--product-card-discount-ring, var(--palette-hex-f5c6d0));
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
  box-shadow: 0 0 0 1px var(--product-featured-avatar-ring);
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: flex-end;
  gap: 8px 10px;
  min-width: 0;
  margin-top: auto;
  padding-top: 2px;
}

.price-block {
  min-width: 0;
  overflow: hidden;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
  row-gap: 4px;
}

.product-price {
  font-size: var(--text-price);
  font-weight: 700;
  color: var(--product-card-price, var(--color-warning));
  line-height: 1;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.product-card--featured .store-owner-label,
.product-card--featured .seller-name,
.product-card--featured .product-time,
.product-card--featured .product-views {
  color: var(--product-featured-meta);
}

.product-price .unit {
  font-size: 12px;
  font-weight: 500;
  margin-left: 2px;
}

.product-price.discounted {
  color: var(--product-card-price-discounted, var(--palette-hex-ef4444));
}

.original-price {
  font-size: 11px;
  color: var(--text-tertiary);
  text-decoration: line-through;
  font-weight: 400;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.product-views {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.product-views svg {
  flex-shrink: 0;
}

@container (max-width: 230px) {
  .product-footer {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    gap: 7px;
  }

  .product-views {
    justify-self: start;
  }
}

@media (max-width: 639px) {
  .product-name {
    font-size: 13px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .selection-badge::before,
  .selection-badge::after,
  .skeleton-shimmer {
    animation: none;
  }

  .tilt-glare,
  .cover-image,
  .product-card {
    transition: none;
  }
}
</style>
