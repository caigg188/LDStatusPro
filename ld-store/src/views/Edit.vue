<template>
  <div class="edit-page">
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">编辑物品</h1>
      </div>

      <div class="edit-notice">
        <span class="notice-icon">⏳</span>
        <span class="notice-text">为避免刷位，1 小时内最多修改 5 次，超过将无法保存。</span>
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
      
      <!-- 商品不存在 -->
      <EmptyState
        v-else-if="!product"
        icon="🔍"
        title="物品不存在"
        description="无法找到该物品信息"
      >
        <router-link to="/user/products" class="back-btn">
          返回我的物品
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
        
        <!-- 链接类型设置 -->
        <div class="form-card" v-if="getProductType(product) === 'link'">
          <h3 class="card-title">积分流转链接</h3>
          
          <div class="form-group">
            <label class="form-label required">积分流转链接</label>
            <input
              v-model="form.paymentLink"
              type="url"
              class="form-input"
              placeholder="https://credit.linux.do/paying/..."
            />
            <p class="form-hint selectable">
              LDC积分流转链接，获取可参照：<a href="https://linux.do/t/topic/1356124" target="_blank" rel="noopener">创建自己的积分流转链接</a>
            </p>
          </div>
        </div>
        
        <!-- CDK 类型提示 -->
        <div class="form-card" v-if="getProductType(product) === 'cdk'">
          <h3 class="card-title">CDK 管理</h3>
          <p class="cdk-hint">
            请在「我的物品」页面管理 CDK 库存
          </p>
          <router-link to="/user/products" class="manage-link">
            前往管理 →
          </router-link>
        </div>
        
        <!-- 提交按钮 -->
        <div class="form-actions">
          <button type="submit" class="submit-btn" :disabled="!canSubmit || submitting">
            {{ submitting ? '保存中...' : '保存修改' }}
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

const route = useRoute()
const router = useRouter()
const shopStore = useShopStore()
const toast = useToast()

const loading = ref(true)
const submitting = ref(false)
const product = ref(null)
// 允许的图片后缀
const VALID_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']

// 图片加载验证状态
const imageValidating = ref(false)
const imageValidated = ref(false)
const imageLoadError = ref('')
const imagePreviewUrl = ref('')
let lastValidatedUrl = ''
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
  paymentLink: ''
})

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
    if (!form.value.paymentLink.trim()) return false
    if (!form.value.paymentLink.startsWith('https://credit.linux.do/')) return false
  }
  
  return true
})

// 获取类型图标
function getTypeIcon(type) {
  const map = {
    cdk: '🎫',
    link: '🔗'
  }
  return map[type] || '📦'
}

// 获取类型名称
function getTypeName(type) {
  const map = {
    cdk: 'CDK 类型',
    link: '链接类型'
  }
  return map[type] || '未知'
}

// 获取商品类型
function getProductType(prod) {
  return prod?.product_type || prod?.type || prod?.productType || 'link'
}

// 加载商品 (使用 my-products API，可获取任意状态的商品)
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
        paymentLink: product.value.payment_link || product.value.paymentLink || ''
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
  
  // 根据商品类型验证
  const productType = getProductType(product.value)
  if (productType === 'link') {
    if (!form.value.paymentLink.trim()) {
      toast.error('请输入积分流转链接')
      return
    }
    if (!form.value.paymentLink.startsWith('https://credit.linux.do/')) {
      toast.error('积分流转链接必须是 credit.linux.do 的链接')
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
      imageUrl: form.value.imageUrl.trim() || undefined
    }
    
    // 类型特定数据
    if (productType === 'link') {
      updateData.paymentLink = form.value.paymentLink.trim()
    }
    
    // 更新商品
    const result = await shopStore.updateProduct(product.value.id, updateData)
    
    // 检查返回结果
    if (result?.success === false) {
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
  background: var(--bg-primary);
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
  padding: 12px 24px;
  background: var(--color-primary);
  color: white;
  border-radius: 12px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--color-primary-hover);
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
</style>
