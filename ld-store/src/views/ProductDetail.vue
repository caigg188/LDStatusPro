<template>
  <div class="detail-page">
    <div class="page-container">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <Skeleton type="detail" />
      </div>
      
      <!-- 物品详情 -->
      <template v-else-if="product">
        <!-- 顶部导航 -->
        <div class="detail-nav">
          <button class="back-btn" @click="goBack">
            ← 返回
          </button>
                    <div class="nav-right">
            <div class="nav-tags">
                          <span class="nav-category">{{ categoryIcon }} {{ categoryName }}</span>
                          <span v-if="isCdk" class="nav-type cdk">🎫 CDK自动发货</span>
                          <span v-else-if="isStore" class="nav-type store">🏬 友情小店</span>
                        </div>
            <button
              class="nav-report-btn"
              :disabled="reportSubmitting"
              @click="openReportModal"
            >
              &#128680; &#20030;&#25253;
            </button>
          </div>
        </div>
        
        <!-- 主内容区 -->
        <div class="detail-main">
          <!-- 左侧：图片 -->
          <div class="detail-media">
            <div class="media-wrapper" :style="coverStyle" @click="openImagePreview">
              <img
                v-if="product.image_url"
                :src="product.image_url"
                :alt="product.name"
                class="media-image"
                @error="handleImageError"
              />
              <span v-else class="media-placeholder">{{ categoryIcon }}</span>
              <!-- 折扣标签 -->
              <span v-if="hasDiscount" class="discount-tag">
                -{{ discountPercent }}%
              </span>
            </div>
          </div>
          
          <!-- 右侧：信息 -->
          <div class="detail-info-panel">
            <!-- 物品名称 -->
            <h1 class="detail-name">{{ product.name }}</h1>
            
            <!-- 价格区域 -->
            <div v-if="!isStore" class="price-section">
              <div :class="['price-main', { discounted: hasDiscount }]">
                {{ finalPrice }} <span class="unit">LDC</span>
              </div>
              <div v-if="hasDiscount" class="price-original">{{ originalPrice }} LDC</div>
            </div>
            
            <!-- 测试模式提示 -->
            <div v-if="isTestMode" class="test-mode-banner">
              <span class="test-badge">🧪 测试模式</span>
              <span class="test-desc">{{ isSeller ? '只有您可以购买此物品' : '该物品为测试模式，仅卖家可购买' }}</span>
            </div>
            
            <!-- 物品状态信息 -->
            <div class="status-row">
              <div class="status-item">
                <span class="status-icon">👁</span>
                <span class="status-text">{{ product.view_count || 0 }} 浏览</span>
              </div>
              <div v-if="isCdk" class="status-item">
                <span class="status-icon">📦</span>
                <span :class="['status-text', { low: isOutOfStock }]">库存 {{ stockDisplay }}</span>
              </div>
              <div v-if="isCdk && soldCount > 0" class="status-item hot">
                <span class="status-icon">🔥</span>
                <span class="status-text">已售 {{ soldCount }}</span>
              </div>
              <div class="status-item">
                <span class="status-icon">📅</span>
                <span class="status-text">{{ updateTime }}</span>
              </div>
            </div>
            
            <div
              v-if="isCdk && !isOutOfStock && canPurchase && (!isTestMode || isSeller)"
              class="quantity-section"
            >
              <div class="quantity-title">购买数量</div>
              <div class="quantity-controls">
                <button type="button" class="qty-btn" @click="decreaseQuantity">-</button>
                <input
                  v-model.number="selectedQuantity"
                  type="number"
                  min="1"
                  :max="maxSelectableQuantity"
                  class="qty-input"
                  @input="handleQuantityInput"
                />
                <button type="button" class="qty-btn" @click="increaseQuantity">+</button>
              </div>
              <div class="quantity-summary">预计支付 {{ totalPrice }} LDC</div>
              <div v-if="quantityHint" class="quantity-hint">{{ quantityHint }}</div>
            </div>

            <div class="seller-card" @click="goToSeller">
              <img
                :src="sellerAvatar"
                alt=""
                class="seller-avatar"
                referrerpolicy="no-referrer"
                @error="handleAvatarError"
              />
              <div class="seller-content">
                <div class="seller-name">@{{ product.seller_username || '未知' }}</div>
                <div class="seller-hint">点击前往 Linux.do 联系 →</div>
              </div>
            </div>
            
            
            
            <div class="action-section desktop-only">
              <template v-if="isStore">
                                            <a
                                              :href="product.payment_link"
                                              target="_blank"
                                              rel="noopener"
                                              class="buy-btn store"
                                            >
                                              🏪 立即前往
                                            </a>
                                          </template>
                                          <template v-else-if="isCdk">
                                            <button
                                              v-if="isOutOfStock"
                                              class="buy-btn disabled"
                                              disabled
                                            >
                                              😢 已售罄
                                            </button>
                                            <button
                                              v-else-if="isTestMode && !isSeller"
                                              class="buy-btn disabled test-only"
                                              disabled
                                            >
                                              🧪 测试物品
                                            </button>
                                            <button
                                              v-else-if="!canPurchase"
                                              class="buy-btn disabled"
                                              disabled
                                            >
                                              🚫 暂停销售
                                            </button>
                                            <button
                                              v-else
                                              class="buy-btn"
                                              :class="{ test: isTestMode && isSeller }"
                                              :disabled="purchasing"
                                              @click="handleBuyCdk"
                                            >
                                              {{ purchasing ? '创建订单中...' : buyButtonText }}
                                            </button>
                                          </template>
                                          <template v-else>
                                            <button
                                              class="buy-btn"
                                              @click="handleBuyLink"
                                            >
                                              🛒 立即兑换
                                            </button>
                                          </template>
            </div>
          </div>
        </div>

        <!-- 物品描述区域 -->
        <div class="detail-description">
          <h2 class="section-title">📝 物品详情</h2>
          <div class="description-content">{{ product.description || '暂无描述' }}</div>
        </div>
        
        <!-- 底部购买按钮（移动端固定底部） -->
                <div class="action-bottom mobile-only">
          <template v-if="isStore">
                                <a
                                  :href="product.payment_link"
                                  target="_blank"
                                  rel="noopener"
                                  class="buy-btn store"
                                >
                                  🏪 立即前往
                                </a>
                              </template>
                              <template v-else-if="isCdk">
                                <button
                                  v-if="isOutOfStock"
                                  class="buy-btn disabled"
                                  disabled
                                >
                                  😢 已售罄
                                </button>
                                <button
                                  v-else-if="isTestMode && !isSeller"
                                  class="buy-btn disabled test-only"
                                  disabled
                                >
                                  🧪 测试物品
                                </button>
                                <button
                                  v-else-if="!canPurchase"
                                  class="buy-btn disabled"
                                  disabled
                                >
                                  🚫 暂停销售
                                </button>
                                <button
                                  v-else
                                  class="buy-btn"
                                  :class="{ test: isTestMode && isSeller }"
                                  :disabled="purchasing"
                                  @click="handleBuyCdk"
                                >
                                  {{ purchasing ? '创建订单中...' : buyButtonText }}
                                </button>
                              </template>
                              <template v-else>
                                <button
                                  class="buy-btn"
                                  @click="handleBuyLink"
                                >
                                  🛒 立即兑换
                                </button>
                              </template>
        </div>
      </template>
      
      <!-- 错误状态 -->
      <EmptyState
        v-else
        icon="😢"
        text="物品不存在"
        hint="该物品可能已下架或被删除"
      >
        <template #action>
          <router-link to="/" class="btn btn-primary mt-4">
            返回首页
          </router-link>
        </template>
      </EmptyState>
    </div>
    
    <!-- 图片预览弹窗 -->
    <Teleport to="body">
      <div 
        v-if="showImagePreview && product?.image_url" 
        class="image-preview-overlay"
        @click.self="closeImagePreview"
      >
        <button class="preview-close" @click="closeImagePreview">✕</button>
        <img 
          :src="product.image_url" 
          :alt="product.name" 
          class="preview-image"
        />
        <div class="preview-hint">点击空白处或按 ESC 关闭</div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="showReportModal"
        class="report-modal-overlay"
        @click.self="closeReportModal"
      >
        <div class="report-modal">
          <div class="report-modal-header">
            <h3>举报物品</h3>
            <button class="report-modal-close" @click="closeReportModal">&times;</button>
          </div>
          <p class="report-modal-desc">请描述你遇到的问题（例如收款配置错误、测试模式未关闭、支付链接异常等）。</p>
          <textarea
            v-model="reportReason"
            class="report-textarea"
            maxlength="500"
            placeholder="请填写举报原因（5-500字）"
          ></textarea>
          <div class="report-quick-list">
            <button
              v-for="item in quickReportReasons"
              :key="item"
              class="report-quick-item"
              @click="applyQuickReason(item)"
            >
              {{ item }}
            </button>
          </div>
          <div class="report-modal-footer">
            <span class="report-count">{{ reportReason.trim().length }}/500</span>
            <div class="report-actions">
              <button class="report-cancel-btn" @click="closeReportModal">取消</button>
              <button
                class="report-submit-btn"
                :disabled="reportSubmitting || reportReason.trim().length < 5"
                @click="submitReport"
              >
                {{ reportSubmitting ? '提交中...' : '提交举报' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { useUserStore } from '@/stores/user'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { formatRelativeTime, formatPrice } from '@/utils/format'
import { escapeHtml } from '@/utils/security'
import { prepareNewTab, openInNewTab, cleanupPreparedTab } from '@/utils/newTab'
import Skeleton from '@/components/common/Skeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const shopStore = useShopStore()
const userStore = useUserStore()
const toast = useToast()
const dialog = useDialog()

// 状态
const loading = ref(true)
const product = ref(null)
const purchasing = ref(false)
const showImagePreview = ref(false)
const showReportModal = ref(false)
const reportReason = ref('')
const reportSubmitting = ref(false)
const selectedQuantity = ref(1)

const quickReportReasons = [
  '收款配置缺失，无法生成支付链接',
  '商品仍处于测试模式，无法正常购买',
  '支付链接无效或跳转异常',
  '价格或描述与实际不符',
  '疑似无法交付或存在欺诈风险'
]

// 物品类型
const productType = computed(() => product.value?.product_type || 'link')
const isCdk = computed(() => productType.value === 'cdk')
const isStore = computed(() => productType.value === 'store')

// 测试模式相关
const isTestMode = computed(() => !!product.value?.is_test_mode || !!product.value?.isTestMode)
const isSeller = computed(() => {
  if (!product.value || !userStore.user) return false
  return String(userStore.user.id) === String(product.value.seller_user_id)
})

// 价格计算
const price = computed(() => parseFloat(product.value?.price) || 0)
const discount = computed(() => parseFloat(product.value?.discount) || 1)
const hasDiscount = computed(() => discount.value < 1)
const discountPercent = computed(() => Math.round((1 - discount.value) * 100))
const finalPrice = computed(() => formatPrice(price.value * discount.value))
const originalPrice = computed(() => formatPrice(price.value))

// 库存
const stock = computed(() => parseInt(product.value?.stock) || 0)
const availableStock = computed(() => 
  product.value?.availableStock !== undefined 
    ? product.value.availableStock 
    : stock.value
)
const totalStock = computed(() => product.value?.cdkStats?.total || stock.value)
const isOutOfStock = computed(() => 
  isCdk.value && stock.value !== -1 && availableStock.value <= 0
)
const stockClass = computed(() => isOutOfStock.value ? 'low' : '')
const stockDisplay = computed(() => {
  if (stock.value === -1) return '∞'
  return `${availableStock.value}/${totalStock.value}`
})
// canPurchase 逻辑：后端返回明确的 false 时才禁用，未返回或为 undefined/null 时默认可购买
const canPurchase = computed(() => {
  // 如果后端没有返回这个字段（undefined），默认允许购买
  if (product.value?.canPurchase === undefined) return true
  return product.value.canPurchase !== false
})
const soldCount = computed(() => parseInt(product.value?.sold_count) || 0)
const maxPurchaseQuantity = computed(() => {
  const raw = Number(product.value?.max_purchase_quantity ?? product.value?.maxPurchaseQuantity ?? 0)
  if (!Number.isInteger(raw) || raw < 0) return 0
  return raw
})

const maxSelectableQuantity = computed(() => {
  const limits = [1000]

  if (maxPurchaseQuantity.value > 0) {
    limits.push(maxPurchaseQuantity.value)
  }

  if (stock.value !== -1) {
    limits.push(Math.max(0, Number(availableStock.value) || 0))
  } else {
    const available = Number(availableStock.value)
    if (Number.isFinite(available) && available > 0) {
      limits.push(available)
    }
  }

  const minLimit = Math.min(...limits)
  return minLimit > 0 ? minLimit : 1
})

const totalPrice = computed(() =>
  formatPrice(price.value * discount.value * selectedQuantity.value)
)

const buyButtonText = computed(() => {
  if (selectedQuantity.value > 1) {
    return `🛒 立即兑换 ${selectedQuantity.value} 个 (${totalPrice.value} LDC)`
  }
  return `🛒 立即兑换 (${totalPrice.value} LDC)`
})

const quantityHint = computed(() => {
  const hints = []

  if (maxPurchaseQuantity.value > 0) {
    hints.push(`单次最多购买 ${maxPurchaseQuantity.value} 个`)
  }

  if (stock.value !== -1) {
    const canBuyNow = Math.max(0, Number(availableStock.value) || 0)
    hints.push(`当前可购买 ${canBuyNow} 个`)
  }

  return hints.join('，')
})

// 分类
const categoryIcon = computed(() => product.value?.category_icon || '📦')
const categoryName = computed(() => product.value?.category_name || '其他')

// 默认头像 SVG (data URI)
const defaultAvatar = `data:image/svg+xml,${encodeURIComponent('<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M326.169 533.554v9.903c0 101.362 82.138 184.083 183.5 184.083s183.501-82.72 183.501-184.083v-9.903h-367.001zm277.872-70.487c22.137 0 40.196-18.06 40.196-40.196s-18.06-40.195-40.196-40.195-40.195 18.059-40.195 40.195 18.059 40.196 40.195 40.196zm-186.996 0c22.137 0 40.196-18.06 40.196-40.196s-18.06-40.195-40.196-40.195-40.195 18.059-40.195 40.195 18.059 40.196 40.195 40.196z" fill="#a686ba"/><path d="M1011.239 512c0-276.708-224.279-501.569-501.569-501.569S8.684 235.292 8.684 512c0 154.956 70.487 293.601 180.588 385.643V543.457c0-177.675 143.305-321.563 320.398-321.563s320.398 143.888 320.398 321.563v354.186C941.334 805.601 1011.239 666.956 1011.239 512z" fill="#a686ba"/><path d="M510.252 221.894c-177.093 0-320.398 143.888-320.398 321.563v354.186c86.799 72.235 198.647 115.926 320.398 115.926s233.6-43.691 320.398-115.926V543.457c0-177.675-143.305-321.563-320.398-321.563zm93.207 160.782c22.136 0 40.195 18.059 40.195 40.195s-18.059 40.196-40.195 40.196-40.196-18.06-40.196-40.196 18.06-40.195 40.196-40.195zm-186.996 0c22.136 0 40.195 18.059 40.195 40.195s-18.059 40.196-40.195 40.196-40.196-18.06-40.196-40.196 18.06-40.195 40.196-40.195zm93.207 344.865c-101.363 0-183.501-82.721-183.501-184.084v-9.903h366.418v9.903c.583 101.363-81.556 184.084-182.917 184.084z" fill="#FFF"/></svg>')}`

// 卖家
const sellerAvatar = computed(() => 
  product.value?.seller_avatar || defaultAvatar
)

// 时间
const updateTime = computed(() => 
  formatRelativeTime(product.value?.updated_at || product.value?.created_at)
)

// 封面样式
const colors = [
  'linear-gradient(135deg, #e0f2fe, #bae6fd)',
  'linear-gradient(135deg, #fce7f3, #fbcfe8)',
  'linear-gradient(135deg, #d1fae5, #a7f3d0)',
  'linear-gradient(135deg, #fef3c7, #fde68a)',
  'linear-gradient(135deg, #ede9fe, #ddd6fe)',
  'linear-gradient(135deg, #ffedd5, #fed7aa)'
]
const coverStyle = computed(() => {
  if (product.value?.image_url) return {}
  const id = product.value?.id || 0
  return { background: colors[id % colors.length] }
})

// 加载物品
onMounted(async () => {
  const productId = route.params.id
  if (!productId) {
    loading.value = false
    return
  }
  
  // 获取分类
  await shopStore.fetchCategories()
  
  // 获取物品详情
  const data = await shopStore.fetchProduct(productId)
  if (data) {
    product.value = data
    // 更新页面标题
    document.title = `${data.name} - LD士多`
  }
  
  loading.value = false
})

onUnmounted(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', handleEscKey)
})

watch(
  () => [
    product.value?.id,
    maxSelectableQuantity.value,
    isCdk.value,
    isOutOfStock.value,
    canPurchase.value
  ],
  () => {
    if (!isCdk.value || isOutOfStock.value || !canPurchase.value) {
      selectedQuantity.value = 1
      return
    }
    selectedQuantity.value = clampQuantity(selectedQuantity.value)
  },
  { immediate: true }
)

// 方法
function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

function goToSeller() {
  if (product.value?.seller_username) {
    window.open(`https://linux.do/u/${product.value.seller_username}`, '_blank')
  }
}

function handleImageError(e) {
  e.target.style.display = 'none'
}

function handleAvatarError(e) {
  e.target.src = 'https://linux.do/favicon.ico'
}

function clampQuantity(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 1
  const intValue = Math.floor(parsed)
  if (intValue < 1) return 1
  if (intValue > maxSelectableQuantity.value) return maxSelectableQuantity.value
  return intValue
}

function handleQuantityInput() {
  selectedQuantity.value = clampQuantity(selectedQuantity.value)
}

function increaseQuantity() {
  selectedQuantity.value = clampQuantity(selectedQuantity.value + 1)
}

function decreaseQuantity() {
  selectedQuantity.value = clampQuantity(selectedQuantity.value - 1)
}

// 图片预览
// 图片预览
function openImagePreview() {
  if (product.value?.image_url) {
    showImagePreview.value = true
    syncModalState()
  }
}

function closeImagePreview() {
  showImagePreview.value = false
  syncModalState()
}

function handleEscKey(e) {
  if (e.key === 'Escape') {
    if (showReportModal.value) {
      closeReportModal()
      return
    }
    if (showImagePreview.value) {
      closeImagePreview()
    }
  }
}

function syncModalState() {
  const opened = showImagePreview.value || showReportModal.value
  document.body.style.overflow = opened ? 'hidden' : ''
  document.removeEventListener('keydown', handleEscKey)
  if (opened) {
    document.addEventListener('keydown', handleEscKey)
  }
}

async function openReportModal() {
  if (!product.value) return

  if (isSeller.value) {
    toast.error('不能举报自己的商品')
    return
  }

  if (!userStore.isLoggedIn) {
    const confirmed = await dialog.confirm('举报商品需要先登录，是否前往登录？', {
      title: '需要登录',
      icon: '🔐',
      confirmText: '去登录',
      cancelText: '取消'
    })
    if (confirmed) {
      router.push({ name: 'Login', query: { redirect: route.fullPath } })
    }
    return
  }

  showReportModal.value = true
  syncModalState()
}

function closeReportModal() {
  showReportModal.value = false
  reportReason.value = ''
  syncModalState()
}

function applyQuickReason(text) {
  const current = reportReason.value.trim()
  if (!current) {
    reportReason.value = text
    return
  }
  if (!current.includes(text)) {
    reportReason.value = `${current}；${text}`
  }
}

async function submitReport() {
  if (!product.value?.id || reportSubmitting.value) return

  const reason = reportReason.value.trim()
  if (reason.length < 5 || reason.length > 500) {
    toast.error('举报原因需为 5-500 个字符')
    return
  }

  reportSubmitting.value = true
  try {
    const result = await shopStore.reportProduct(product.value.id, reason)
    if (result?.success) {
      toast.success('举报已提交，感谢反馈')
      closeReportModal()
      return
    }
    const message = typeof result?.error === 'object'
      ? (result.error.message || result.error.code || '举报提交失败')
      : (result?.error || result?.message || '举报提交失败')
    toast.error(message)
  } catch (error) {
    toast.error(`举报提交失败：${error.message}`)
  } finally {
    reportSubmitting.value = false
  }
}

async function handleBuyCdk() {
  // 检查登录
  if (!userStore.isLoggedIn) {
    const confirmed = await dialog.confirm('请先登录后再兑换物品', {
      title: '需要登录',
      icon: '🔐',
      confirmText: '去登录'
    })
    if (confirmed) {
      router.push({ name: 'Login', query: { redirect: route.fullPath } })
    }
    return
  }
  
  if (isOutOfStock.value || !canPurchase.value) {
    toast.error('当前商品暂不可购买')
    return
  }

  const quantity = clampQuantity(selectedQuantity.value)
  selectedQuantity.value = quantity
  const totalAmount = formatPrice(price.value * discount.value * quantity)

  // 确认兑换
  const confirmed = await dialog.confirm(
    `确认兑换「${escapeHtml(product.value.name)}」？<br><br>📦 数量：<strong>${quantity}</strong><br>💰 总价：<strong>${totalAmount} LDC</strong><br><br>支付后系统将自动发放 CDK 到您的订单中。`,
    { title: '确认兑换', icon: '🛒' }
  )
  
  if (!confirmed) return
  
  // Pre-open a blank tab to keep navigation tied to the user gesture (better for mobile Safari).
  const preparedWindow = prepareNewTab()
  let paymentOpened = false
  
  purchasing.value = true
  
  try {
    const result = await shopStore.createOrder(product.value.id, quantity)
    
    if (result.success && result.data?.paymentUrl) {
      // 跳转支付
      paymentOpened = openInNewTab(result.data.paymentUrl, preparedWindow)
      if (!paymentOpened) {
        cleanupPreparedTab(preparedWindow)
      }
      
      // 提示用户
      await dialog.alert(
        `订单已创建：<strong>${result.data.orderNo}</strong><br><br>📝 请在新窗口中完成支付<br>⏰ 订单有效期 <strong>5分钟</strong>，请尽快完成支付<br>✅ 支付完成后 CDK 将自动发放<br>📋 可在「我的订单」中查看状态`,
        { title: '订单创建成功', icon: '🎉' }
      )
    } else {
      cleanupPreparedTab(preparedWindow)
      // 提取错误消息，处理对象格式的 error
      const errorMsg = typeof result.error === 'object' 
        ? (result.error.message || result.error.code || '创建订单失败')
        : (result.error || '创建订单失败')
      toast.error(errorMsg)
    }
  } catch (e) {
    cleanupPreparedTab(preparedWindow)
    toast.error('创建订单失败：' + e.message)
  } finally {
    purchasing.value = false
  }
}

// 外链物品兑换
async function handleBuyLink() {
  const confirmed = await dialog.confirm(
    `<div style="text-align: left; line-height: 1.8;">
      <p>⚠️ <strong>外链物品提示</strong></p>
      <p style="margin-top: 12px;">此物品为外链物品，点击「继续兑换」后将跳转到卖家设置的支付链接。</p>
      <ul style="margin: 12px 0; padding-left: 20px; color: var(--text-secondary);">
        <li>您将直接向卖家支付 LDC</li>
        <li>交易不会在平台留下支付记录</li>
        <li>兑换后请联系卖家获取服务</li>
      </ul>
      <p style="color: var(--text-tertiary); font-size: 13px;">💡 建议：交易前可先与卖家沟通确认</p>
    </div>`,
    { 
      title: '外链物品提示', 
      icon: '🔗',
      confirmText: '继续兑换',
      cancelText: '取消'
    }
  )
  
  if (confirmed && product.value?.payment_link) {
    const preparedWindow = prepareNewTab()
    const opened = openInNewTab(product.value.payment_link, preparedWindow)
    if (!opened) {
      cleanupPreparedTab(preparedWindow)
    }
  }
}
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  background: var(--bg-primary);
}

.page-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
  padding-bottom: 100px;
}

.loading-state {
  padding: 40px 0;
}

/* 顶部导航 */
.detail-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.back-btn {
  padding: 10px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.nav-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.nav-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.nav-report-btn {
  padding: 8px 14px;
  border: 1px solid #f3d6dc;
  border-radius: 20px;
  background: #fdf0f2;
  color: #a85a64;
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-report-btn:hover {
  background: #f9e2e7;
  border-color: #eec0c9;
  color: #8f4550;
}

.nav-report-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.nav-category {
  padding: 8px 14px;
  background: var(--bg-secondary);
  border-radius: 20px;
  font-size: 13px;
  color: var(--text-secondary);
}

.nav-type {
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.nav-type.cdk {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.nav-type.store {
  background: var(--color-success-bg);
  color: var(--color-success);
}

/* 主内容区 - 桌面端左右布局 */
.detail-main {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  background: var(--bg-card);
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  margin-bottom: 20px;
}

@media (min-width: 768px) {
  .detail-main {
    grid-template-columns: 1fr 1fr;
    padding: 32px;
  }
}

/* 媒体区域 */
.detail-media {
  display: flex;
  justify-content: center;
  align-items: center;
}

.media-wrapper {
  position: relative;
  width: 100%;
  max-width: 400px;
  min-height: 200px;
  max-height: 500px;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.3s;
}

.media-wrapper:hover {
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.media-wrapper::after {
  content: '🔍 点击查看大图';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.5));
  color: white;
  font-size: 12px;
  text-align: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.media-wrapper:has(.media-image):hover::after {
  opacity: 1;
}

/* 图片预览弹窗 */
.image-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.preview-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 10;
}

.preview-close:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.preview-image {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  animation: zoomIn 0.3s ease;
}

@keyframes zoomIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.preview-hint {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.report-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.report-modal {
  width: min(640px, 96vw);
  max-height: 90vh;
  overflow: auto;
  background: var(--bg-card);
  border-radius: 16px;
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-md);
  padding: 16px;
}

.report-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.report-modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.report-modal-close {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 22px;
  cursor: pointer;
}

.report-modal-desc {
  margin: 10px 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

.report-textarea {
  width: 100%;
  min-height: 120px;
  resize: vertical;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.6;
}

.report-quick-list {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.report-quick-item {
  border: 1px solid var(--border-light);
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.report-quick-item:hover {
  background: var(--bg-tertiary);
}

.report-modal-footer {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.report-count {
  color: var(--text-tertiary);
  font-size: 12px;
}

.report-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.report-cancel-btn,
.report-submit-btn {
  border: none;
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 14px;
  cursor: pointer;
}

.report-cancel-btn {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.report-submit-btn {
  background: #b91c1c;
  color: #fff;
}

.report-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 没有图片时使用正方形占位 */
.media-wrapper:has(.media-placeholder) {
  aspect-ratio: 1 / 1;
}

.media-image {
  width: 100%;
  height: auto;
  max-height: 500px;
  object-fit: contain;
  background: var(--bg-secondary);
}

.media-placeholder {
  font-size: 80px;
  opacity: 0.6;
}

.discount-tag {
  position: absolute;
  top: 12px;
  right: 12px;
  background: linear-gradient(135deg, #ad9090 0%, #937474 100%);
  color: white;
  font-size: 13px;
  font-weight: 700;
  padding: 8px 12px;
  border-radius: 10px;
}

/* 信息面板 */
.detail-info-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-name {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.4;
}

@media (min-width: 768px) {
  .detail-name {
    font-size: 26px;
  }
}

/* 价格区域 */
.price-section {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #fef9f3 0%, #fdf6ee 100%);
  border-radius: 14px;
}

.price-main {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-warning);
}

.price-main .unit {
  font-size: 16px;
  font-weight: 500;
}

.price-main.discounted {
  color: var(--color-danger);
}

.price-original {
  font-size: 16px;
  color: var(--text-tertiary);
  text-decoration: line-through;
}

/* 状态信息 */
.status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text-secondary);
}

.status-icon {
  font-size: 16px;
}

.status-text.low {
  color: var(--color-danger);
  font-weight: 500;
}

.status-item.hot .status-text {
  color: var(--color-warning);
  font-weight: 500;
}

/* 数量选择 */
.quantity-section {
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.quantity-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.quantity-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.qty-btn {
  width: 34px;
  height: 34px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 16px;
  cursor: pointer;
}

.qty-btn:hover {
  background: var(--bg-tertiary);
}

.qty-input {
  width: 88px;
  height: 34px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  text-align: center;
  padding: 0 6px;
}

.qty-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.quantity-summary {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-warning);
}

.quantity-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 卖家卡片 */
.seller-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.seller-card:hover {
  background: var(--bg-tertiary);
  transform: translateY(-1px);
}

.seller-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.seller-content {
  flex: 1;
  min-width: 0;
}

.seller-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.seller-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 0;
}

/* 妗岄潰绔喘涔版寜閽?*/
.action-section {
  margin-top: auto;
  padding-top: 10px;
}

.desktop-only {
  display: none;
}

@media (min-width: 768px) {
  .desktop-only {
    display: block;
  }
}

/* 描述区域 */
.detail-description {
  background: var(--bg-card);
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}

.description-content {
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 移动端底部按钮 */
.action-bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0));
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--border-light);
  z-index: 100;
}

.mobile-only {
  display: block;
}

@media (min-width: 768px) {
  .mobile-only {
    display: none;
  }
  
  .page-container {
    padding-bottom: 40px;
  }
}

/* 购买按钮 */
.buy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 16px 24px;
  background: linear-gradient(135deg, #cfa76f 0%, #bd8d57 100%);
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
}

.buy-btn:hover {
  opacity: 0.92;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(207, 167, 111, 0.3);
}

.buy-btn.store {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
}

.buy-btn.store:hover {
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
}

.buy-btn.disabled {
  background: #999;
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.buy-btn.disabled.test-only {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  opacity: 0.6;
}

.buy-btn.test {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
}

.buy-btn.test:hover {
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
}

/* 测试模式横幅 */
.test-mode-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #ecfeff 0%, #cffafe 100%);
  border: 1px solid #a5f3fc;
  border-radius: 12px;
  margin-bottom: 16px;
}

.test-badge {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  color: white;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
}

.test-desc {
  font-size: 13px;
  color: #0891b2;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .page-container {
    padding: 12px;
    padding-bottom: 90px;
  }
  
  .detail-main {
    padding: 20px;
  }
  
  .detail-nav {
    margin-bottom: 16px;
  }

  .detail-name {
    font-size: 20px;
  }

  .price-main {
    font-size: 28px;
  }
  
  .media-wrapper {
    max-width: 100%;
    max-height: 350px;
  }
  
  .media-image {
    max-height: 350px;
  }
  
  .detail-description {
    padding: 20px;
  }

}
</style>

