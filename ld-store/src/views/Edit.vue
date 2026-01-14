<template>
  <div class="edit-page">
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">编辑物品</h1>
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
            <label class="form-label">物品图片</label>
            <input
              v-model="form.imageUrl"
              type="url"
              class="form-input"
              placeholder="https://..."
            />
            <p class="form-hint">图片URL地址，建议使用 https 链接</p>
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
      categories.value = result.map(cat => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon || '📦'
      }))
    }
  } catch (error) {
    // 使用默认分类
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

// 加载商品
async function loadProduct() {
  try {
    loading.value = true
    const productId = route.params.id
    product.value = await shopStore.fetchProductDetail(productId)
    
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
  
  // 验证图片URL（可选）
  if (form.value.imageUrl && !form.value.imageUrl.startsWith('https://')) {
    toast.error('图片链接请使用 https 开头的安全链接')
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
  background: #faf9f7;
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
  color: #3d3d3d;
  margin: 0;
}

/* 加载骨架 */
.loading-state {
  padding-top: 20px;
}

.skeleton-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.skeleton {
  background: linear-gradient(90deg, #f5f3f0 25%, #ebe7e1 50%, #f5f3f0 75%);
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
  background: #a5b4a3;
  color: white;
  border-radius: 12px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #95a493;
}

/* 表单卡片 */
.form-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #3d3d3d;
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
  color: #666;
  margin-bottom: 8px;
}

.form-label.required::after {
  content: '*';
  color: #ad9090;
  margin-left: 4px;
}

.form-input {
  width: 100%;
  padding: 14px 16px;
  background: #f9f7f5;
  border: 1px solid #f0ede9;
  border-radius: 12px;
  font-size: 14px;
  color: #3d3d3d;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #a5b4a3;
}

.form-input::placeholder {
  color: #bbb;
}

.form-textarea {
  width: 100%;
  padding: 14px 16px;
  background: #f9f7f5;
  border: 1px solid #f0ede9;
  border-radius: 12px;
  font-size: 14px;
  color: #3d3d3d;
  outline: none;
  resize: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-textarea:focus {
  border-color: #a5b4a3;
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
  color: #bbb;
  margin: 0;
}

.form-hint {
  font-size: 13px;
  color: #999;
  margin: 8px 0 0;
  line-height: 1.5;
}

.form-hint.selectable {
  user-select: text;
}

.form-hint a {
  color: #7a9a7a;
  text-decoration: none;
}

.form-hint a:hover {
  text-decoration: underline;
}

/* 分类选择 */
.category-select {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.category-btn {
  padding: 10px 18px;
  background: #f5f3f0;
  border: 2px solid transparent;
  border-radius: 24px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.category-btn:hover {
  background: #ebe7e1;
}

.category-btn.active {
  background: #e8f5e8;
  border-color: #a5b4a3;
  color: #5a8c5a;
}

/* 类型只读 */
.type-readonly {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: #f9f7f5;
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
  color: #3d3d3d;
  margin: 0 0 4px;
}

.type-desc {
  font-size: 13px;
  color: #999;
  margin: 0;
}

/* CDK 管理提示 */
.cdk-hint {
  font-size: 14px;
  color: #999;
  margin: 0 0 12px;
}

.manage-link {
  display: inline-block;
  font-size: 14px;
  color: #a5b4a3;
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
  background: white;
  border-top: 1px solid #f0ede9;
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
  box-shadow: 0 4px 15px rgba(165, 180, 163, 0.4);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
