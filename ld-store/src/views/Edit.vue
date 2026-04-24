<template>
  <div class="edit-page">
    <Transition name="submit-mask">
      <div
        v-if="editOverlayVisible"
        class="submit-mask"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="submit-mask-card">
          <span class="submit-mask-spinner" aria-hidden="true"></span>
          <h3 class="submit-mask-title">{{ editOverlayTitle }}</h3>
          <p class="submit-mask-text">{{ editOverlayDescription }}</p>
        </div>
      </div>
    </Transition>

    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">编辑物品</h1>
      </div>

      <div class="edit-notice">
        <span class="notice-icon">⏳</span>
        <span class="notice-text">为避免刷位，1 小时内最多修改 3 次，24 小时内最多修改 10 次，超过将无法保存。</span>
      </div>
      
      <!-- 加载中 -->
      <div v-if="loading" class="loading-state">
        <div class="skeleton-card">
          <div class="skeleton skeleton-line w-32"></div>
          <div class="skeleton skeleton-line w-full mt-4"></div>
          <div class="skeleton skeleton-line w-full mt-2"></div>
          <div class="skeleton skeleton-line w-48 mt-4"></div>
        </div>
      </div>
      
      <!-- 物品不存在 -->
      <EmptyState
        v-else-if="!product"
        icon="🔍"
        title="物品不存在"
        description="无法找到该物品信息"
      >
        <router-link to="/user/products" class="back-btn">
          ← 返回
        </router-link>
      </EmptyState>
      
      <!-- 编辑表单 -->
      <form v-else class="edit-form" @submit.prevent="submitForm">
        <!-- 基本信息 -->
        <div class="form-card">
          <h3 class="card-title">基本信息</h3>
          
          <div class="form-group">
            <label class="form-label required">物品名称</label>
            <input
              v-model="form.name"
              type="text"
              class="form-input"
              placeholder="请输入物品名称（2-50字符）"
              maxlength="50"
            />
            <p class="form-counter">{{ form.name.length }}/50</p>
          </div>
          
          <div class="form-group">
            <label class="form-label required">物品描述</label>
            <textarea
              v-model="form.description"
              class="form-textarea"
              placeholder="请输入物品描述（10-1000字符）"
              rows="4"
              maxlength="1000"
            ></textarea>
            <p class="form-counter">{{ form.description.length }}/1000</p>
          </div>
          
          <div class="form-group">
            <label class="form-label required">物品分类</label>
            <div class="category-select">
              <button
                v-for="cat in categories"
                :key="cat.id"
                type="button"
                :class="['category-btn', { active: form.categoryId === cat.id }]"
                @click="form.categoryId = cat.id"
              >
                {{ cat.icon }} {{ cat.name }}
              </button>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label required">价格 (LDC)</label>
              <input
                v-model="form.price"
                type="number"
                class="form-input"
                placeholder="0.00"
                min="0.01"
                max="99999999"
                step="0.01"
              />
            </div>
            
            <div class="form-group">
              <label class="form-label">折扣</label>
              <input
                v-model="form.discount"
                type="number"
                class="form-input"
                placeholder="1"
                min="0.01"
                max="1"
                step="0.01"
              />
              <p class="form-hint">范围 0.01-1</p>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label required">物品图片</label>
            <input
              v-model="form.imageUrl"
              type="url"
              class="form-input"
              :class="{ 'input-error': imageUrlError || imageLoadError }"
              placeholder="https://..."
              @blur="validateImageLoad"
            />
            <p v-if="imageUrlError" class="form-error">{{ imageUrlError }}</p>
            <p v-else-if="imageLoadError" class="form-error">{{ imageLoadError }}</p>
            <p v-else-if="imageValidating" class="form-hint loading-hint">⚙️ 正在验证图片...</p>
            <p v-else-if="imageValidated" class="form-hint success-hint">✅ 图片验证通过</p>
            <p v-else class="form-hint">推荐尺寸 16:9，必须使用 HTTPS 链接，不支持 linux.do 图床</p>
            
            <!-- 图片预览 -->
            <div v-if="imagePreviewUrl && !imageLoadError" class="image-preview">
              <img :src="imagePreviewUrl" alt="图片预览" @error="onPreviewError" />
            </div>
          </div>
        </div>
        
        <!-- 物品类型（只读） -->
        <div class="form-card">
          <h3 class="card-title">物品类型</h3>
          
          <div class="type-readonly">
            <div class="type-icon">{{ getTypeIcon(getProductType(product)) }}</div>
            <div class="type-info">
              <h4 class="type-name">{{ getTypeName(getProductType(product)) }}</h4>
              <p class="type-desc">物品类型创建后无法修改</p>
            </div>
          </div>
        </div>
        
        <!-- 普通物品设置 -->
        <div class="form-card" v-if="getProductType(product) === 'normal'">
          <h3 class="card-title">普通物品设置</h3>

          <div class="form-group">
            <label class="form-label required">库存数量</label>
            <input
              v-model="form.stock"
              ref="stockInput"
              type="number"
              class="form-input"
              :class="{ 'input-error': !!stockError }"
              min="0"
              max="1000000"
              step="1"
              placeholder="例如：20"
            />
            <p v-if="stockError" class="form-error">{{ stockError }}</p>
            <p v-else class="form-hint">
              普通物品不会自动发货。买家支付后会收到“请主动联系卖家获取服务”的提醒，请及时在订单页处理履约。
            </p>
          </div>
        </div>

        <div class="form-card" v-else-if="getProductType(product) === 'link'">
          <h3 class="card-title">外链物品已停用</h3>
          <p class="form-hint">
            外链物品已不再支持编辑和重新上架。请重新发布为普通物品，以便平台保留完整订单记录。
          </p>
        </div>

        <div class="form-card">
          <h3 class="card-title">兑换门槛</h3>

          <div class="form-group">
            <label class="form-label">商品购买信任等级门槛</label>
            <select v-model.number="form.purchaseTrustLevel" class="form-input">
              <option v-for="level in purchaseTrustLevelOptions" :key="level" :value="level">
                TL{{ level }}{{ level === 0 ? '（不限制）' : '' }}
              </option>
            </select>
            <p class="form-hint">
              仅影响“兑换”门槛；TL0 表示任何能看到该商品的用户都可以兑换。
            </p>
          </div>
        </div>
        
        <!-- CDK 类型提示 -->
        <div class="form-card" v-if="getProductType(product) === 'cdk'">
          <h3 class="card-title">CDK 管理</h3>
          <div class="form-group">
            <label class="toggle-switch limit-toggle" @click.prevent="form.limitEnabled = !form.limitEnabled">
              <span class="toggle-track" :class="{ active: form.limitEnabled }">
                <span class="toggle-thumb"></span>
              </span>
              <span class="toggle-label">
                设置单人单次购买上限
                <span class="toggle-help" v-if="!form.limitEnabled">（默认不限制）</span>
              </span>
            </label>
            <p class="form-hint">开启后，每位用户单次下单最多只能购买您设置的数量。</p>

            <div v-if="form.limitEnabled" class="limit-input-row">
              <input
                v-model="form.maxPurchaseQuantity"
                ref="maxPurchaseQuantityInput"
                type="number"
                class="form-input"
                :class="{ 'input-error': !!maxPurchaseQuantityError }"
                min="1"
                max="1000"
                step="1"
                placeholder="例如：5"
              />
              <span class="limit-unit">个 / 单</span>
            </div>
            <p v-if="maxPurchaseQuantityError" class="form-error">{{ maxPurchaseQuantityError }}</p>
          </div>

          <div v-if="initialTestModeEnabled" class="form-group">
            <label class="toggle-switch limit-toggle" @click.prevent="form.isTestMode = !form.isTestMode">
              <span class="toggle-track" :class="{ active: form.isTestMode }">
                <span class="toggle-thumb"></span>
              </span>
              <span class="toggle-label">
                测试模式
                <span class="toggle-help" v-if="form.isTestMode">（仅自己可购买）</span>
                <span class="toggle-help" v-else>（已关闭）</span>
              </span>
            </label>
            <p class="form-hint">
              开启时仅您自己可以购买此物品，用于测试 LDC 通知回调是否正常工作。
            </p>
            <p v-if="form.isTestMode" class="form-hint test-mode-auto-offline-note">
              ⚠️ 测试模式商品审核通过并上架后，30 分钟会自动下架；如需继续售卖，请关闭测试模式后保存。
            </p>
            <p v-else class="form-hint success-hint">
              关闭后将恢复普通可售状态，不再受“仅自己可购买”和“30 分钟自动下架”限制。
            </p>
          </div>

          <p class="cdk-hint">
            请在「我的物品」页面管理 CDK 库存
          </p>
          <router-link to="/user/products" class="manage-link">
            前往管理 →
          </router-link>
        </div>
        
        <!-- 提交按钮 -->
        <div class="form-actions">
          <button type="submit" class="submit-btn" :disabled="!canSubmit || updateBusy">
            {{ submitButtonText }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { useToast } from '@/composables/useToast'
import { validateProductName, validateProductDescription, validatePrice } from '@/utils/security'
import EmptyState from '@/components/common/EmptyState.vue'
import {
  getProductType as resolveProductType,
  getProductTypeIcon,
  getProductTypeText,
  isLegacyLinkProduct,
  isNormalProduct
} from '@/utils/shopProduct'

const route = useRoute()
const router = useRouter()
const shopStore = useShopStore()
const toast = useToast()

const loading = ref(true)
const submitting = ref(false)
const updateConfirming = ref(false)
const product = ref(null)
// 允许的图片后缀
const VALID_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']

// 图片加载验证状态
const imageValidating = ref(false)
const imageValidated = ref(false)
const imageLoadError = ref('')
const imagePreviewUrl = ref('')
const stockInput = ref(null)
const maxPurchaseQuantityInput = ref(null)
let lastValidatedUrl = ''
const EDIT_SAVE_TIMEOUT_MS = 90000
const EDIT_SAVE_STATUS_MAX_RETRIES = 8
const EDIT_SAVE_STATUS_RETRY_INTERVAL_MS = 2000
// 分类 - 从API获取或使用默认
const categories = ref([
  { id: 1, name: 'AI', icon: '🤖' },
  { id: 2, name: '存储', icon: '💾' },
  { id: 3, name: '小鸡', icon: '🐔' },
  { id: 4, name: '咨询', icon: '💬' }
])

// 表单数据
const form = ref({
  name: '',
  description: '',
  categoryId: null,
  price: '',
  discount: 1,
  imageUrl: '',
  stock: '',
  purchaseTrustLevel: 0,
  limitEnabled: false,
  maxPurchaseQuantity: '',
  isTestMode: false
})
const purchaseTrustLevelOptions = [0, 1, 2, 3, 4]

const updateBusy = computed(() => submitting.value || updateConfirming.value)
const editOverlayVisible = computed(() => updateBusy.value)
const editOverlayTitle = computed(() => (updateConfirming.value ? '正在确认保存结果' : '正在保存修改'))
const editOverlayDescription = computed(() => {
  if (updateConfirming.value) {
    return '请求可能已发送成功，系统正在核对最新数据，请勿重复提交。'
  }
  return '网络较慢时可能需要较长时间，请耐心等待并保持当前页面。'
})

const submitButtonText = computed(() => {
  if (updateConfirming.value) return '正在确认保存结果...'
  if (submitting.value) return '保存中...'
  if (isLegacyLinkProduct(product.value)) return '外链物品已停用'
  return '保存修改'
})

const initialTestModeEnabled = computed(() => !!(product.value?.is_test_mode || product.value?.isTestMode))

// 加载分类
async function loadCategories() {
  try {
    const result = await shopStore.fetchCategories()
    if (result && result.length > 0) {
      // 过滤掉小店分类（小店入驻使用独立的小店集市）
      categories.value = result
        .filter(cat => cat.name !== '小店' && cat.name !== '友情小店')
        .map(cat => ({
          id: cat.id,
          name: cat.name,
          icon: cat.icon || '📦'
        }))
    }
  } catch (error) {
    // 使用默认分类
  }
}

// 检查URL是否为有效图片链接（后缀检查）
function isValidImageUrl(url) {
  if (!url) return false
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname.toLowerCase()
    return VALID_IMAGE_EXTENSIONS.some(ext => pathname.endsWith('.' + ext))
  } catch {
    return false
  }
}

// 图片URL验证
const imageUrlError = computed(() => {
  const url = form.value.imageUrl?.trim()
  if (!url) return null
  if (!url.startsWith('https://')) return '图片链接必须使用 HTTPS'
  if (url.includes('linux.do')) return '不支持使用 linux.do 图床，请使用其他图床服务'
  if (!isValidImageUrl(url)) return '图片链接格式无效，支持: jpg, png, gif, webp, svg 等'
  return null
})

// 图片预加载验证
const stockError = computed(() => {
  if (!isNormalProduct(product.value)) return ''
  const raw = String(form.value.stock ?? '').trim()
  if (!raw) return '请输入库存数量'
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) return '库存必须是大于等于 0 的整数'
  if (value > 1000000) return '库存不能超过 1000000'
  return ''
})

const maxPurchaseQuantityError = computed(() => {
  if (getProductType(product.value) !== 'cdk' || !form.value.limitEnabled) return ''
  const raw = String(form.value.maxPurchaseQuantity ?? '').trim()
  if (!raw) return '请输入单人单次购买上限'
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) return '单人单次购买上限必须是大于 0 的整数'
  if (value > 1000) return '单人单次购买上限不能超过 1000'
  return ''
})

function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const timeout = setTimeout(() => {
      img.src = ''
      reject(new Error('图片加载超时'))
    }, 10000)
    img.onload = () => {
      clearTimeout(timeout)
      resolve(img)
    }
    img.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

// 验证图片是否可加载
async function validateImageLoad() {
  const url = form.value.imageUrl?.trim()
  
  if (!url || imageUrlError.value) {
    imageValidating.value = false
    imageValidated.value = false
    imageLoadError.value = ''
    imagePreviewUrl.value = ''
    lastValidatedUrl = ''
    return
  }
  
  if (url === lastValidatedUrl) return
  
  imageValidating.value = true
  imageValidated.value = false
  imageLoadError.value = ''
  imagePreviewUrl.value = ''
  
  try {
    await preloadImage(url)
    if (form.value.imageUrl?.trim() !== url) return
    
    imageValidated.value = true
    imagePreviewUrl.value = url
    lastValidatedUrl = url
  } catch (error) {
    if (form.value.imageUrl?.trim() !== url) return
    imageLoadError.value = '图片无法加载，请检查链接是否有效'
    lastValidatedUrl = ''
  } finally {
    imageValidating.value = false
  }
}

// 预览图片加载失败
function onPreviewError() {
  imageLoadError.value = '图片加载失败，请检查链接是否有效'
  imagePreviewUrl.value = ''
  imageValidated.value = false
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isUncertainUpdateResult(result) {
  const status = Number(result?.status || 0)
  const message = String(result?.error || '').toLowerCase()
  if (status === 0) return true
  return message.includes('超时')
    || message.includes('网络')
    || message.includes('failed to fetch')
    || message.includes('network')
    || message.includes('abort')
}

function hasExpectedProductState(latestProduct, expectedData, expectedType) {
  if (!latestProduct) return false

  const latestName = String(latestProduct.name || '').trim()
  const latestDescription = String(latestProduct.description || '').trim()
  const latestCategoryId = Number(latestProduct.category_id || latestProduct.categoryId || 0)
  const latestPrice = Number(latestProduct.price || 0)
  const latestDiscount = Number(latestProduct.discount || 1)
  const latestImageUrl = String(latestProduct.image_url || latestProduct.imageUrl || '').trim()

  const expectedName = String(expectedData.name || '').trim()
  const expectedDescription = String(expectedData.description || '').trim()
  const expectedCategoryId = Number(expectedData.categoryId || 0)
  const expectedPrice = Number(expectedData.price || 0)
  const expectedDiscount = Number(expectedData.discount || 1)
  const expectedImageUrl = String(expectedData.imageUrl || '').trim()

  const floatEquals = (a, b, epsilon = 1e-8) => Math.abs(Number(a || 0) - Number(b || 0)) <= epsilon

  if (latestName !== expectedName) return false
  if (latestDescription !== expectedDescription) return false
  if (latestCategoryId !== expectedCategoryId) return false
  if (!floatEquals(latestPrice, expectedPrice)) return false
  if (!floatEquals(latestDiscount, expectedDiscount)) return false
  if (latestImageUrl !== expectedImageUrl) return false

  if (expectedType === 'normal') {
    const latestStock = Number(latestProduct.stock || 0)
    const expectedStock = Number(expectedData.stock || 0)
    if (latestStock !== expectedStock) return false
  }

  const latestPurchaseTrustLevel = Number(
    latestProduct.purchase_trust_level ?? latestProduct.purchaseTrustLevel ?? 0
  )
  const expectedPurchaseTrustLevel = Number(expectedData.purchaseTrustLevel || 0)
  if (latestPurchaseTrustLevel !== expectedPurchaseTrustLevel) return false

  if (expectedType === 'cdk') {
    const latestLimit = Number(latestProduct.max_purchase_quantity || latestProduct.maxPurchaseQuantity || 0)
    const expectedLimit = Number(expectedData.maxPurchaseQuantity || 0)
    if (latestLimit !== expectedLimit) return false

    const latestTestMode = !!(latestProduct.is_test_mode || latestProduct.isTestMode)
    const expectedTestMode = !!expectedData.isTestMode
    if (latestTestMode !== expectedTestMode) return false
  }

  return true
}

async function pollUpdateResult(productId, expectedData, expectedType) {
  for (let i = 0; i < EDIT_SAVE_STATUS_MAX_RETRIES; i += 1) {
    const latestProduct = await shopStore.fetchMyProductDetail(productId)
    if (hasExpectedProductState(latestProduct, expectedData, expectedType)) {
      return { confirmed: true, product: latestProduct }
    }
    if (i < EDIT_SAVE_STATUS_MAX_RETRIES - 1) {
      await wait(EDIT_SAVE_STATUS_RETRY_INTERVAL_MS)
    }
  }
  return { confirmed: false, product: null }
}

async function confirmUpdateAfterUncertainResult(productId, expectedData, expectedType) {
  updateConfirming.value = true
  try {
    const confirmed = await pollUpdateResult(productId, expectedData, expectedType)
    if (confirmed.confirmed) {
      toast.success('物品已更新，已自动确认保存结果')
      router.push('/user/products')
      return true
    }
    toast.warning('暂未确认保存结果。请稍后在“我的物品”中查看，避免重复修改。')
    return false
  } finally {
    updateConfirming.value = false
  }
}

// 是否可以提交
const canSubmit = computed(() => {
  // 基本验证
  if (!form.value.name.trim()) return false
  if (form.value.name.length < 2 || form.value.name.length > 50) return false
  if (!form.value.description.trim()) return false
  if (form.value.description.length < 10 || form.value.description.length > 1000) return false
  if (!form.value.categoryId) return false
  if (!form.value.price || parseFloat(form.value.price) <= 0 || parseFloat(form.value.price) > 99999999) return false
  if (form.value.discount < 0.01 || form.value.discount > 1) return false
  // 图片验证：必填且格式正确
  if (!form.value.imageUrl?.trim()) return false
  if (imageUrlError.value) return false
  
  // 类型特定验证
  const type = getProductType(product.value)
  if (type === 'link') {
    return false
  } else if (type === 'normal') {
    if (stockError.value) return false
  } else if (type === 'cdk') {
    if (maxPurchaseQuantityError.value) return false
  }
  
  return true
})

// 获取类型图标
function getTypeIcon(type) {
  return getProductTypeIcon(type)
}

// 获取类型名称
function getTypeName(type) {
  const map = {
    normal: '普通物品',
    cdk: '自动发卡',
    link: '已停用外链物品'
  }
  return map[type] || getProductTypeText(type)
}

// 获取物品类型
function getProductType(prod) {
  return resolveProductType(prod)
}

// 加载物品 (使用 my-products API，可获取任意状态的物品)
async function loadProduct() {
  try {
    loading.value = true
    const productId = route.params.id
    product.value = await shopStore.fetchMyProductDetail(productId)
    
    if (product.value) {
      // 填充表单，处理多种字段名格式
      form.value = {
        name: product.value.name || '',
        description: product.value.description || '',
        categoryId: product.value.category_id || product.value.categoryId || null,
        price: product.value.price || '',
        discount: product.value.discount || 1,
        imageUrl: product.value.image_url || product.value.imageUrl || '',
        stock: Number(product.value.stock ?? 0),
        purchaseTrustLevel: Number(
          product.value.purchase_trust_level ?? product.value.purchaseTrustLevel ?? 0
        ),
        limitEnabled: Number(product.value.max_purchase_quantity || product.value.maxPurchaseQuantity || 0) > 0,
        maxPurchaseQuantity: Number(product.value.max_purchase_quantity || product.value.maxPurchaseQuantity || 0) > 0
          ? Number(product.value.max_purchase_quantity || product.value.maxPurchaseQuantity)
          : '',
        isTestMode: !!(product.value.is_test_mode || product.value.isTestMode)
      }
      
      // 如果已有图片，自动验证
      if (form.value.imageUrl) {
        validateImageLoad()
      }
    }
  } catch (error) {
    toast.error('加载物品失败')
  } finally {
    loading.value = false
  }
}

// 提交表单
async function submitForm() {
  if (updateBusy.value) return

  // 验证名称
  const nameResult = validateProductName(form.value.name)
  if (!nameResult.valid) {
    toast.error(nameResult.error)
    return
  }
  
  // 验证描述（必填）
  const descResult = validateProductDescription(form.value.description)
  if (!descResult.valid) {
    toast.error(descResult.error)
    return
  }
  
  // 验证分类
  if (!form.value.categoryId) {
    toast.error('请选择物品分类')
    return
  }
  
  // 验证价格
  const priceResult = validatePrice(form.value.price)
  if (!priceResult.valid) {
    toast.error(priceResult.error)
    return
  }
  
  // 验证折扣
  if (form.value.discount < 0.01 || form.value.discount > 1) {
    toast.error('折扣范围为 0.01-1')
    return
  }
  
  // 根据物品类型验证
  const productType = getProductType(product.value)
  if (productType === 'link') {
    toast.error('外链物品已停用，请重新发布普通物品')
    return
  } else if (productType === 'normal') {
    if (stockError.value) {
      toast.error(stockError.value)
      stockInput.value?.focus?.()
      return
    }
  } else if (productType === 'cdk') {
    if (maxPurchaseQuantityError.value) {
      toast.error(maxPurchaseQuantityError.value)
      maxPurchaseQuantityInput.value?.focus?.()
      return
    }
  }
  
  // 验证图片URL（必填）
  if (!form.value.imageUrl || !form.value.imageUrl.trim()) {
    toast.error('请上传物品图片')
    return
  }
  if (!form.value.imageUrl.startsWith('https://')) {
    toast.error('图片链接必须使用 HTTPS')
    return
  }
  if (form.value.imageUrl.includes('linux.do')) {
    toast.error('不支持使用 linux.do 图床，请使用其他图床服务')
    return
  }
  if (!isValidImageUrl(form.value.imageUrl)) {
    toast.error('图片链接格式无效，支持: jpg, png, gif, webp, svg 等')
    return
  }
  
  // 如果图片还未验证，先进行验证
  if (!imageValidated.value && !imageLoadError.value) {
    toast.loading('正在验证图片...')
    await validateImageLoad()
    toast.dismiss()
  }
  
  // 图片加载失败
  if (imageLoadError.value) {
    toast.error(imageLoadError.value)
    return
  }
  
  submitting.value = true
  
  try {
    // 构建更新数据（与客户端脚本保持一致）
    const updateData = {
      name: form.value.name.trim(),
      categoryId: form.value.categoryId,
      description: form.value.description.trim(),
      price: parseFloat(form.value.price),
      discount: parseFloat(form.value.discount) || 1,
      imageUrl: form.value.imageUrl.trim() || undefined,
      purchaseTrustLevel: Number(form.value.purchaseTrustLevel) || 0
    }
    
    // 类型特定数据
    if (productType === 'normal') {
      updateData.stock = Number(form.value.stock)
    } else if (productType === 'cdk') {
      updateData.maxPurchaseQuantity = form.value.limitEnabled
        ? Number(form.value.maxPurchaseQuantity)
        : 0
      if (initialTestModeEnabled.value) {
        updateData.isTestMode = form.value.isTestMode
      }
    }
    
    // 更新物品
    const result = await shopStore.updateProduct(product.value.id, updateData, { timeout: EDIT_SAVE_TIMEOUT_MS })
    
    // 检查返回结果
    if (result?.success === false) {
      if (isUncertainUpdateResult(result)) {
        await confirmUpdateAfterUncertainResult(product.value.id, updateData, productType)
        return
      }
      const errorMsg = result.error?.message || result.error || '更新失败'
      toast.error(errorMsg)
      return
    }
    
    toast.success('物品已更新')
    router.push('/user/products')
  } catch (error) {
    toast.error(error.message || '更新失败')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await loadCategories()
  await loadProduct()
})
</script>

<style scoped>
.edit-page {
  min-height: 100vh;
  padding-bottom: 100px;
}

.page-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.edit-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  margin-bottom: 16px;
  border-radius: 14px;
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  box-shadow: var(--shadow-sm);
}

.notice-icon {
  font-size: 16px;
}

.notice-text {
  font-size: 13px;
  line-height: 1.5;
}

/* 加载骨架 */
.loading-state {
  padding-top: 20px;
}

.skeleton-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
}

.skeleton {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-line {
  height: 16px;
}

.w-32 { width: 128px; }
.w-48 { width: 192px; }
.w-full { width: 100%; }
.mt-2 { margin-top: 8px; }
.mt-4 { margin-top: 16px; }

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* 返回按钮 */
.back-btn {
  display: inline-block;
  padding: 10px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

/* 表单卡片 */
.form-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-sm);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px;
}

/* 表单 */
.form-group {
  margin-bottom: 16px;
  position: relative;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.form-label.required::after {
  content: '*';
  color: var(--color-danger);
  margin-left: 4px;
}

.form-input {
  width: 100%;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: var(--color-primary);
}

.form-input::placeholder {
  color: var(--text-muted);
}

.form-textarea {
  width: 100%;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  resize: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-textarea:focus {
  border-color: var(--color-primary);
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
}

.form-counter {
  position: absolute;
  right: 12px;
  bottom: -20px;
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.form-hint {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 8px 0 0;
  line-height: 1.5;
}

.form-hint.loading-hint {
  color: var(--color-warning);
}

.form-hint.success-hint {
  color: var(--color-success);
}

.form-hint.selectable {
  user-select: text;
}

.form-hint a {
  color: var(--color-primary);
  text-decoration: none;
}

.form-hint a:hover {
  text-decoration: underline;
}

.form-error {
  font-size: 13px;
  color: var(--color-danger);
  margin: 8px 0 0;
}

.form-input.input-error {
  border-color: var(--color-danger);
}

/* 图片预览 */
.image-preview {
  margin-top: 12px;
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
}

.image-preview img {
  display: block;
  width: 100%;
  max-height: 200px;
  object-fit: contain;
}

/* 分类选择 */
.category-select {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.category-btn {
  padding: 10px 18px;
  background: var(--bg-secondary);
  border: 2px solid transparent;
  border-radius: 24px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.category-btn:hover {
  background: var(--bg-tertiary);
}

.category-btn.active {
  background: var(--color-success-bg);
  border-color: var(--color-primary);
  color: var(--color-success);
}

/* 类型只读 */
.type-readonly {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 14px;
}

.type-icon {
  font-size: 28px;
}

.type-info {
  flex: 1;
}

.type-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px;
}

.type-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
}

/* CDK 管理提示 */
.toggle-switch {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.toggle-track {
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--bg-tertiary);
  border-radius: 12px;
  transition: background 0.2s;
}

.toggle-track.active {
  background: var(--color-info);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.toggle-track.active .toggle-thumb {
  transform: translateX(20px);
}

.toggle-label {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.toggle-help {
  font-size: 12px;
  color: var(--color-info);
  font-weight: 400;
}

.limit-toggle {
  margin-bottom: 8px;
}

.limit-input-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.limit-input-row .form-input {
  flex: 1;
}

.limit-unit {
  font-size: 13px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.cdk-hint {
  font-size: 14px;
  color: var(--text-tertiary);
  margin: 0 0 12px;
}

.manage-link {
  display: inline-block;
  font-size: 14px;
  color: var(--color-primary);
  text-decoration: none;
}

.manage-link:hover {
  text-decoration: underline;
}

/* 提交按钮 */
.form-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16px;
  background: var(--bg-card);
  border-top: 1px solid var(--border-light);
  z-index: 100;
}

.submit-btn {
  display: block;
  width: 100%;
  max-width: 568px;
  margin: 0 auto;
  padding: 16px 32px;
  background: linear-gradient(135deg, #a5b4a3 0%, #95a493 100%);
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-primary);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 提交遮罩 */
.submit-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--overlay-bg, rgba(24, 28, 34, 0.45));
  backdrop-filter: blur(2px);
}

.submit-mask-card {
  width: min(90vw, 360px);
  padding: 24px 20px;
  border-radius: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-lg);
  text-align: center;
}

.submit-mask-spinner {
  display: block;
  width: 44px;
  height: 44px;
  margin: 0 auto 14px;
  border-radius: 50%;
  border: 3px solid rgba(126, 179, 126, 0.25);
  border-top-color: var(--color-success);
  animation: submit-mask-spin 0.8s linear infinite;
}

.submit-mask-title {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.submit-mask-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.submit-mask-enter-active,
.submit-mask-leave-active {
  transition: opacity 0.2s ease;
}

.submit-mask-enter-active .submit-mask-card,
.submit-mask-leave-active .submit-mask-card {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.submit-mask-enter-from,
.submit-mask-leave-to {
  opacity: 0;
}

.submit-mask-enter-from .submit-mask-card,
.submit-mask-leave-to .submit-mask-card {
  transform: translateY(6px) scale(0.98);
  opacity: 0;
}

@keyframes submit-mask-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

