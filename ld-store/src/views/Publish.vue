<template>
  <div class="publish-page">
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">发布物品</h1>
      </div>
      
      <form class="publish-form" @submit.prevent="submitForm">
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
              :placeholder="descriptionPlaceholder"
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
                :key="cat.id || cat.name"
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
              <p class="form-hint">范围 0.01-1，0.8 表示8折，1 表示原价</p>
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
        
        <!-- 物品类型 -->
        <div class="form-card">
          <h3 class="card-title">物品类型</h3>
          
          <div class="type-select">
            <div
              v-for="type in productTypes"
              :key="type.id"
              :class="['type-card', { active: form.productType === type.id }]"
              @click="form.productType = type.id"
            >
              <div class="type-icon">{{ type.icon }}</div>
              <div class="type-info">
                <h4 class="type-name">{{ type.name }}</h4>
                <p class="type-desc">{{ type.desc }}</p>
              </div>
              <div class="type-check" v-if="form.productType === type.id">✓</div>
            </div>
          </div>
        </div>
        
        <!-- 链接类型设置 -->
        <div class="form-card" v-if="form.productType === 'link'">
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
        
        <!-- CDK 类型设置 -->
        <div class="form-card" v-if="form.productType === 'cdk'">
          <h3 class="card-title">CDK 设置</h3>
          
          <div class="form-group">
            <label class="form-label">CDK 卡密 <span class="optional-label">(可选)</span></label>
            <textarea
              v-model="form.cdkCodes"
              class="form-textarea code"
              placeholder="每行一个 CDK，支持批量添加&#10;物品发布后也可在「我的物品」中管理 CDK 库存"
              rows="5"
            ></textarea>
            <p class="form-hint">
              <span v-if="cdkCount > 0">已输入 {{ cdkCount }} 个 CDK</span>
              <span class="cdk-tip">💡 发布 CDK 物品前请先在「收款设置」中配置 LDC 收款信息</span>
            </p>
          </div>
          
          <div class="cdk-note">
            <p class="note-text">📝 CDK 使用说明请写在上方「物品描述」中，买家购买后可在订单详情中查看。</p>
          </div>
        </div>
        
        <!-- 提交按钮 -->
        <div class="form-actions">
          <button type="submit" class="submit-btn" :disabled="!canSubmit || submitting">
            {{ submitButtonText }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { useToast } from '@/composables/useToast'
import { validateProductName, validateProductDescription, validatePrice } from '@/utils/security'

const router = useRouter()
const shopStore = useShopStore()
const toast = useToast()

const submitting = ref(false)
const merchantConfigured = ref(false) // 是否已配置商家收款

// 表单数据
const form = ref({
  name: '',
  description: '',
  categoryId: null,
  price: '',
  discount: 1,
  imageUrl: '',
  productType: 'link', // 默认链接类型
  paymentLink: '',
  cdkCodes: ''
})

// 分类 - 从API获取或使用默认
const categories = ref([
  { id: 1, name: 'AI', icon: '🤖' },
  { id: 2, name: '存储', icon: '💾' },
  { id: 3, name: '小鸡', icon: '🐔' },
  { id: 4, name: '咨询', icon: '💬' }
])

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
      // 设置默认分类
      if (categories.value.length > 0 && !form.value.categoryId) {
        form.value.categoryId = categories.value[0].id
      }
    }
  } catch (error) {
    // 使用默认分类
    if (categories.value.length > 0 && !form.value.categoryId) {
      form.value.categoryId = categories.value[0].id
    }
  }
}

// 物品类型（只有链接和CDK两种）
const productTypes = [
  { id: 'link', name: '链接类型', desc: '提供外部支付链接', icon: '🔗' },
  { id: 'cdk', name: 'CDK 类型', desc: '平台内支付+自动发货', icon: '🎫' }
]

// CDK 数量
const cdkCount = computed(() => {
  if (!form.value.cdkCodes.trim()) return 0
  return form.value.cdkCodes.split('\n').filter(line => line.trim()).length
})

// 物品描述 placeholder（根据类型变化）
const descriptionPlaceholder = computed(() => {
  if (form.value.productType === 'cdk') {
    return '请详细描述物品信息，包括：\n• 物品内容（如：某某会员月卡、某某游戏充值卡等）\n• 使用方式（如：在官网兑换、APP内激活等）\n• 有效期限（如：永久有效、激活后30天等）\n• 其他注意事项\n\n（10-1000字符）'
  }
  return '请详细描述物品信息、服务内容及服务方式等，让买家充分了解您提供的物品或服务。\n\n（10-1000字符）'
})

// 提交按钮文字
const submitButtonText = computed(() => {
  if (submitting.value) {
    return form.value.productType === 'cdk' && form.value.cdkCodes.trim() 
      ? '发布并上传CDK...' 
      : '提交中...'
  }
  return form.value.productType === 'cdk' ? '发布并上传CDK' : '发布物品'
})

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
  if (form.value.productType === 'link') {
    if (!form.value.paymentLink.trim()) return false
    if (!form.value.paymentLink.startsWith('https://credit.linux.do/')) return false
  }
  
  return true
})

// 检查商家配置
async function checkMerchantConfig() {
  try {
    const result = await shopStore.fetchMerchantConfig()
    const config = result?.data?.data || result?.data || result || {}
    merchantConfigured.value = !!config.configured
  } catch (error) {
    merchantConfigured.value = false
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
  if (form.value.productType === 'link') {
    if (!form.value.paymentLink.trim()) {
      toast.error('请输入积分流转链接')
      return
    }
    if (!form.value.paymentLink.startsWith('https://credit.linux.do/')) {
      toast.error('积分流转链接必须是 credit.linux.do 的链接')
      return
    }
  } else if (form.value.productType === 'cdk') {
    // CDK 类型需要检查商家配置
    if (!merchantConfigured.value) {
      toast.warning('请先在「收款设置」中配置 LDC 收款信息')
      router.push('/user/settings')
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
    // 构建商品数据（与客户端脚本保持一致）
    const productData = {
      name: form.value.name.trim(),
      categoryId: form.value.categoryId,
      description: form.value.description.trim(),
      price: parseFloat(form.value.price),
      discount: parseFloat(form.value.discount) || 1,
      imageUrl: form.value.imageUrl.trim() || undefined,
      productType: form.value.productType
    }
    
    // 类型特定数据
    if (form.value.productType === 'link') {
      productData.paymentLink = form.value.paymentLink.trim()
    } else if (form.value.productType === 'cdk') {
      // CDK 可以直接在创建时填入
      if (form.value.cdkCodes.trim()) {
        productData.cdkCodes = form.value.cdkCodes.trim()
      }
    }
    
    // 创建商品
    const result = await shopStore.createProduct(productData)
    
    if (!result.success) {
      toast.error(result.error || '发布失败')
      return
    }
    
    // 显示成功提示
    const cdkInfo = result.data?.cdkImported ? `，已导入 ${result.data.cdkImported} 条 CDK` : ''
    toast.success(`物品提交成功，等待管理员审核${cdkInfo}`)
    router.push('/user/products')
  } catch (error) {
    toast.error(error.message || '发布失败')
  } finally {
    submitting.value = false
  }
}

// 初始化
onMounted(async () => {
  // 加载分类
  await loadCategories()
  
  // 检查商家配置（用于 CDK 类型验证）
  await checkMerchantConfig()
})
</script>

<style scoped>
.publish-page {
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

.optional-label {
  font-weight: 400;
  color: #999;
  font-size: 12px;
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

.form-textarea.code {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
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

.cdk-tip {
  display: block;
  margin-top: 8px;
  padding: 8px 10px;
  background: #f9f7f5;
  border-radius: 8px;
  font-size: 12px;
}

.cdk-note {
  margin-top: 16px;
  padding: 12px 14px;
  background: #f0f9f0;
  border: 1px solid #d4e5d4;
  border-radius: 10px;
}

.cdk-note .note-text {
  margin: 0;
  font-size: 13px;
  color: #5a8c5a;
  line-height: 1.5;
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

/* 类型选择 */
.type-select {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.type-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: #f9f7f5;
  border: 2px solid transparent;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.type-card:hover {
  background: #f5f3f0;
}

.type-card.active {
  background: #f0f9f0;
  border-color: #a5b4a3;
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

.type-check {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #a5b4a3;
  color: white;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 600;
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
