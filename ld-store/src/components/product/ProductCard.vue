<template>
  <router-link
    :to="`/product/${product.id}`"
    :class="['product-card', { 'out-of-stock': isOutOfStock }]"
  >
    <!-- 折扣标签 -->
    <span v-if="hasDiscount" class="discount-tag">
      -{{ discountPercent }}%
    </span>
    
    <!-- 类型标签 -->
    <span v-if="isCdk" class="type-tag cdk">CDK</span>
    <span v-else-if="isStore" class="type-tag store">小店</span>
    
    <!-- 商品图片 -->
    <div class="product-cover" :style="coverStyle">
      <img
        v-if="product.image_url"
        :src="product.image_url"
        :alt="product.name"
        class="cover-image"
        loading="lazy"
        @error="handleImageError"
      />
      <span v-else class="cover-placeholder">{{ categoryIcon }}</span>
    </div>
    
    <!-- 商品信息 -->
    <div class="product-body">
      <h3 class="product-name">{{ product.name }}</h3>
      
      <div class="product-meta">
        <span class="product-category">{{ categoryName }}</span>
        <span v-if="isCdk" :class="['product-stock', stockClass]">
          {{ stockDisplay }}
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
          <img
            :src="sellerAvatar"
            alt=""
            class="seller-avatar"
            @error="handleAvatarError"
          />
          <span class="seller-name">{{ product.seller_username || '匿名' }}</span>
          <span v-if="isCdk && soldCount > 0" class="sold-count">已售{{ soldCount }}</span>
        </template>
      </div>
      
      <!-- 价格和浏览量 -->
      <div class="product-footer">
        <div :class="['product-price', { discounted: hasDiscount }]">
          {{ finalPrice }}<span class="unit">LDC</span>
          <span v-if="hasDiscount" class="original-price">{{ originalPrice }}</span>
        </div>
        <span class="product-views">👁 {{ product.view_count || 0 }}</span>
      </div>
    </div>
  </router-link>
</template>

<script setup>
import { computed } from 'vue'
import { formatRelativeTime, formatPrice } from '@/utils/format'

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

// 商品类型
const productType = computed(() => props.product.product_type || 'link')
const isCdk = computed(() => productType.value === 'cdk')
const isStore = computed(() => productType.value === 'store')

// 价格计算
const price = computed(() => parseFloat(props.product.price) || 0)
const discount = computed(() => parseFloat(props.product.discount) || 1)
const hasDiscount = computed(() => discount.value < 1)
const discountPercent = computed(() => Math.round((1 - discount.value) * 100))
const finalPrice = computed(() => formatPrice(price.value * discount.value))
const originalPrice = computed(() => formatPrice(price.value))

// 库存
const stock = computed(() => parseInt(props.product.stock) || 0)
const availableStock = computed(() => 
  props.product.availableStock !== undefined 
    ? props.product.availableStock 
    : stock.value
)
const totalStock = computed(() => props.product.cdkStats?.total || stock.value)
const isOutOfStock = computed(() => 
  isCdk.value && stock.value !== -1 && availableStock.value <= 0
)
const isLowStock = computed(() => 
  isCdk.value && stock.value !== -1 && availableStock.value <= 5 && availableStock.value > 0
)
const stockClass = computed(() => {
  if (isOutOfStock.value) return 'out'
  if (isLowStock.value) return 'low'
  return ''
})
const stockDisplay = computed(() => {
  if (stock.value === -1) return '∞'
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
const sellerAvatar = computed(() => 
  props.product.seller_avatar || 'https://linux.do/uploads/default/optimized/4X/6/a/6/6a6affc7b1ce8140279e959d32671304db06d5ab_2_180x180.png'
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
function handleImageError(e) {
  e.target.style.display = 'none'
  const placeholder = e.target.nextElementSibling
  if (placeholder) placeholder.style.display = 'flex'
}

function handleAvatarError(e) {
  e.target.src = 'https://linux.do/favicon.ico'
}
</script>

<style scoped>
.product-card {
  display: block;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  text-decoration: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  position: relative;
}

.product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.1), 0 2px 8px -1px rgba(0, 0, 0, 0.06);
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
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  z-index: 10;
}

/* 标签 */
.discount-tag {
  position: absolute;
  top: 10px;
  right: 10px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  font-size: 12px;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: 10px;
  z-index: 5;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
  animation: pulse-discount 2s ease-in-out infinite;
}

@keyframes pulse-discount {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.type-tag {
  position: absolute;
  top: 10px;
  left: 10px;
  font-size: 10px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 8px;
  z-index: 5;
}

.type-tag.cdk {
  background: linear-gradient(135deg, #778d9c 0%, #627684 100%);
  color: white;
}

.type-tag.store {
  background: linear-gradient(135deg, #7d8d69 0%, #627151 100%);
  color: white;
}

/* 封面 */
.product-cover {
  position: relative;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  color: #3d3d3d;
  margin: 0 0 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #999;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.product-category {
  background: #f5f3f0;
  padding: 2px 6px;
  border-radius: 4px;
}

.product-stock {
  padding: 3px 8px;
  background: #e8f5e8;
  color: #16a34a;
  border-radius: 6px;
  font-weight: 600;
}

.product-stock.low {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #b45309;
  animation: pulse-low 1.5s ease-in-out infinite;
}

@keyframes pulse-low {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.product-stock.out {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #dc2626;
  font-weight: 700;
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

.store-owner-label {
  font-size: 12px;
  color: #999;
  flex-shrink: 0;
}

.seller-name {
  font-size: 12px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sold-count {
  margin-left: auto;
  font-size: 11px;
  color: #f97316;
}

/* 底部 */
.product-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.product-price {
  font-size: 18px;
  font-weight: 700;
  color: #cfa76f;
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
  color: #9ca3af;
  text-decoration: line-through;
  margin-left: 4px;
  font-weight: 400;
  background: #f3f4f6;
  padding: 1px 4px;
  border-radius: 3px;
}

.product-views {
  font-size: 12px;
  color: #999;
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
