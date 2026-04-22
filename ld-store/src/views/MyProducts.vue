<template>
  <div class="my-products-page">
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">我的物品</h1>
        <router-link to="/publish" class="add-btn">
          ➕ 发布
        </router-link>
      </div>
      
      <!-- 加载中 -->
      <div v-if="loading" class="loading-state">
        <div class="skeleton-card" v-for="i in 3" :key="i">
          <div class="skeleton-img"></div>
          <div class="skeleton-info">
            <div class="skeleton skeleton-line w-48"></div>
            <div class="skeleton skeleton-line w-full mt-3"></div>
            <div class="skeleton skeleton-line w-32 mt-2"></div>
          </div>
        </div>
      </div>
      
      <!-- 空状态 -->
      <EmptyState
        v-else-if="products.length === 0"
        icon="📦"
        title="暂无物品"
        description="您还没有发布任何物品"
      >
        <router-link to="/publish" class="publish-btn">
          发布物品
        </router-link>
      </EmptyState>
      
      <!-- 物品列表 -->
      <div class="products-list" v-else>
        <div
          v-for="product in products"
          :key="product.id"
          :class="['product-card', getProductStatus(product)]"
        >
          <!-- 状态标签（右上角） -->
          <div :class="['status-badge', getProductStatus(product)]">
            <span class="status-icon">{{ getStatusIcon(getProductStatus(product)) }}</span>
            <span class="status-text">{{ getStatusText(getProductStatus(product)) }}</span>
          </div>
          
          <!-- 主体内容 -->
          <div class="product-main" @click="viewProduct(product)">
            <!-- 物品图片 -->
            <div class="product-image" :style="getImageStyle(product)">
              <img
                v-if="product.image_url"
                :src="product.image_url"
                :alt="product.name"
                @error="handleImageError"
              />
              <span v-else class="image-placeholder">{{ product.category_icon || '📦' }}</span>
              <!-- 类型角标 -->
              <span :class="['type-badge', getProductType(product)]">
                {{ getTypeIcon(getProductType(product)) }}
              </span>
            </div>
            
            <!-- 物品信息 -->
            <div class="product-info">
              <h3 class="product-name">{{ product.name }}</h3>
              <p class="product-desc">{{ product.description || '暂无描述' }}</p>
              
              <!-- 价格和数据 -->
              <div class="product-meta">
                <span class="product-price">
                  <span class="price-value">{{ formatPrice(product) }}</span>
                  <span class="price-unit">LDC</span>
                </span>
                <span class="meta-divider">·</span>
                <span class="product-views">👁 {{ product.view_count || 0 }}</span>
                <template v-if="isPlatformOrderProductItem(product)">
                  <span class="meta-divider">·</span>
                  <span :class="['product-stock', { low: isLowStock(product) }]">
                    📦 {{ getStockDisplay(product) }}
                  </span>
                  <span class="meta-divider">·</span>
                  <span class="product-sold">🔥 {{ product.sold_count || 0 }}</span>
                </template>
              </div>
              
              <!-- 分类标签 -->
              <div class="product-tags">
                <span class="tag category">{{ product.category_icon || '📦' }} {{ product.category_name || '其他' }}</span>
                <span :class="['tag', 'type', getProductType(product)]">{{ getTypeText(getProductType(product)) }}</span>
              </div>
            </div>
          </div>
          
          <!-- 被拒绝/下架原因 -->
          <div v-if="getRejectReason(product)" class="reject-reason">
            <span class="reason-icon">⚠️</span>
            <span class="reason-text">{{ getRejectReason(product) }}</span>
          </div>
          
          <!-- 操作按钮 -->
          <div class="product-actions">
            <button class="action-btn edit" @click.stop="editProduct(product)" :disabled="isProductBusy(product) || isRestrictedProductManagement">
              ✏️ 编辑
            </button>
              <button
                v-if="isCdkItem(product)"
                class="action-btn cdk"
                @click.stop="manageCdk(product)"
                :disabled="isProductBusy(product)"
            >
              🔑 CDK
            </button>
              <button
                v-if="canToggleStatus(product)"
                class="action-btn"
                :class="isProductActive(product) ? 'offline' : 'online'"
                @click.stop="toggleStatus(product)"
              :disabled="isProductBusy(product) || isRestrictedProductManagement"
            >
              {{ getToggleLabel(product) }}
            </button>
            <button class="action-btn delete" @click.stop="deleteProduct(product)" :disabled="isProductBusy(product) || isRestrictedProductManagement">
              {{ getDeleteLabel(product) }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- 加载更多 -->
      <div v-if="hasMore && !loading" class="load-more">
        <button class="load-more-btn" @click="loadMore" :disabled="loadingMore">
          {{ loadingMore ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </div>
    
    <!-- CDK 管理弹窗 -->
    <div v-if="showCdkModal" class="modal-overlay" @click.self="closeCdkModal">
      <div class="modal-content cdk-modal">
        <div class="modal-header">
          <h3 class="modal-title">🔑 CDK 管理</h3>
          <span class="modal-subtitle">{{ currentProduct?.name }}</span>
          <button class="modal-close" @click="closeCdkModal">✕</button>
        </div>
        
        <div class="modal-body">
          <!-- CDK 统计 -->
          <div class="cdk-stats">
            <div class="stat-item">
              <span class="stat-value">{{ cdkStats.total || 0 }}</span>
              <span class="stat-label">总计</span>
            </div>
            <div class="stat-item available">
              <span class="stat-value">{{ cdkStats.available || 0 }}</span>
              <span class="stat-label">可用</span>
            </div>
            <div class="stat-item locked">
              <span class="stat-value">{{ cdkStats.locked || 0 }}</span>
              <span class="stat-label">锁定</span>
            </div>
            <div class="stat-item sold">
              <span class="stat-value">{{ cdkStats.sold || 0 }}</span>
              <span class="stat-label">已售</span>
            </div>
          </div>
          
          <!-- CDK 筛选和操作 -->
          <div class="cdk-filter">
            <select v-model="cdkStatusFilter" class="filter-select" @change="loadCdkList">
              <option value="available">可用</option>
              <option value="">全部状态</option>
              <option value="locked">锁定</option>
              <option value="sold">已售</option>
            </select>
            <button class="export-btn" @click="exportCdks" :disabled="exportingCdks || !currentProduct?.id">
              {{ exportingCdks ? '导出中...' : '⬇️ 导出 TXT' }}
            </button>
            <button
              class="clear-all-btn"
              @click="clearAllCdks"
              :disabled="clearingAllCdks || (cdkStats.available || 0) === 0"
            >
              {{ clearingAllCdks ? '清空中...' : '🗑️ 一键清空全部可删CDK' }}
            </button>
          </div>
          
          <!-- CDK 列表 -->
          <div class="cdk-list-wrapper">
            <div v-if="cdkLoading" class="cdk-loading">加载中...</div>
            <div class="cdk-list" v-else-if="cdkList.length > 0">
              <div
                v-for="cdk in cdkList"
                :key="cdk.id || cdk.code"
                :class="['cdk-item', normalizeCdkStatus(cdk.status)]"
              >
                <code class="cdk-code">{{ cdk.code }}</code>
                <div class="cdk-actions">
                  <span :class="['cdk-status', normalizeCdkStatus(cdk.status)]">
                    {{ getCdkStatusText(normalizeCdkStatus(cdk.status)) }}
                  </span>
                  <button 
                    v-if="isCdkDeletable(cdk)" 
                    class="cdk-delete-btn"
                    @click="deleteCdkItem(cdk)"
                    :disabled="isDeletingCdk(cdk)"
                  >{{ isDeletingCdk(cdk) ? '...' : '🗑️' }}</button>
                </div>
              </div>
            </div>
            <div v-else class="cdk-empty">
              暂无 CDK
            </div>
          </div>
          
          <!-- 添加 CDK -->
          <div class="cdk-add">
            <h4 class="add-title">➕ 添加 CDK</h4>
            <textarea
              v-model="newCdkText"
              class="cdk-input"
              placeholder="请输入CDK，每行一个"
              rows="4"
            ></textarea>
            <div class="add-footer">
              <span class="add-count" v-if="newCdkCount > 0">将添加 {{ newCdkCount }} 个</span>
              <button
                class="add-btn-primary"
                @click="addCdks"
                :disabled="!newCdkText.trim() || addingCdk"
              >
                {{ addingCdk ? '添加中...' : '添加 CDK' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { isMaintenanceFeatureEnabled, isRestrictedMaintenanceMode } from '@/config/maintenance'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import EmptyState from '@/components/common/EmptyState.vue'
import { api } from '@/utils/api'
import { storage } from '@/utils/storage'
import {
  getProductType as resolveProductType,
  getProductTypeIcon,
  getProductTypeText,
  getStockDisplay as resolveStockDisplay,
  isCdkProduct,
  isLegacyLinkProduct,
  isLowStock as hasLowStock,
  isPlatformOrderProduct
} from '@/utils/shopProduct'

const router = useRouter()
const shopStore = useShopStore()
const toast = useToast()
const dialog = useDialog()

const loading = ref(true)
const loadingMore = ref(false)
const products = ref([])
const page = ref(1)
const hasMore = ref(false)

// CDK 管理
const showCdkModal = ref(false)
const currentProduct = ref(null)
const cdkList = ref([])
const cdkStats = ref({ total: 0, available: 0, locked: 0, sold: 0 })
const newCdkText = ref('')
const addingCdk = ref(false)
const cdkLoading = ref(false)
const cdkStatusFilter = ref('available')
const deletingCdkId = ref(null)
const clearingAllCdks = ref(false)
const exportingCdks = ref(false)
const productAction = ref({ id: null, type: '' })
const isRestrictedProductManagement = computed(() =>
  isRestrictedMaintenanceMode() && !isMaintenanceFeatureEnabled('productManage')
)

// 计算即将添加的 CDK 数量
const newCdkCount = computed(() => {
  if (!newCdkText.value.trim()) return 0
  return newCdkText.value.split('\n').filter(line => line.trim()).length
})

// 加载物品
async function loadProducts(append = false) {
  try {
    if (!append) {
      loading.value = true
    } else {
      loadingMore.value = true
    }
    
    const result = await shopStore.fetchMyProducts()
    
    // result 可能是数组或者包含 products 的对象
    let productList = Array.isArray(result) ? result : (result?.products || result || [])
    
    // 应用排序规则
    productList = sortProducts(productList)
    
    if (append) {
      products.value.push(...productList)
    } else {
      products.value = productList
    }
    
    // 目前 API 一次返回所有数据，暂不支持分页
    hasMore.value = false
  } catch (error) {
    toast.error('加载物品失败')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// 排序物品
// 规则1: 已拒绝(含 AI/人工) → 待人工审核 → 待AI审核 → 已上架(AI/人工) → 已下架（需要处理的在前）
// 规则2: 按修改时间排序（新的在前）
function sortProducts(productList) {
  return [...productList].sort((a, b) => {
    const statusA = getProductStatus(a)
    const statusB = getProductStatus(b)
    
    // 定义状态优先级（更小的数字优先级更高）
    // 已拒绝最需要关注，放最前面
    const statusPriority = {
      'ai_rejected': 0,
      'manual_rejected': 0,
      'rejected': 0,      // 旧状态兼容
      'pending_manual': 1,
      'pending_ai': 2,
      'pending': 2,       // 旧状态兼容
      'ai_approved': 3,
      'manual_approved': 3,
      'approved': 3,      // 旧状态兼容
      'active': 3,
      'offline_manual': 4,
      'offline': 4,       // 旧状态兼容
      'inactive': 4
    }
    
    const priorityA = statusPriority[statusA] ?? 999
    const priorityB = statusPriority[statusB] ?? 999
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    
    // 规则2: 同状态下，按修改时间排序（新的在前）
    const timeA = new Date(a.updated_at || a.updatedAt || a.created_at || 0).getTime()
    const timeB = new Date(b.updated_at || b.updatedAt || b.created_at || 0).getTime()
    
    return timeB - timeA
  })
}

// 加载更多
function loadMore() {
  page.value++
  loadProducts(true)
}

// 查看物品
function viewProduct(product) {
  router.push(`/product/${product.id}`)
}

// 编辑物品
function editProduct(product) {
  if (isRestrictedProductManagement.value) {
    toast.warning('受限维护中，当前仅开放商品 CDK 管理')
    return
  }
  router.push(`/edit/${product.id}`)
}

// 判断是否为上架状态
function isProductActive(product) {
  const status = getProductStatus(product)
  return ['ai_approved', 'manual_approved'].includes(status)
}

// 切换状态

async function toggleStatus(product) {
  if (isRestrictedProductManagement.value) {
    toast.warning('受限维护中，当前仅开放商品 CDK 管理')
    return
  }
  if (isProductBusy(product)) return
  if (isLegacyLinkProduct(product)) {
    toast.error('外链物品已停用，请重新发布普通物品')
    return
  }
  const isActive = isProductActive(product)
  const action = isActive ? '下架' : '上架'

  const confirmed = await dialog.confirm(`确定要${action}该物品吗？${!isActive ? '\n将重新提交审核' : ''}`, {
    title: `${action}物品`,
    icon: isActive ? '⏸️' : '▶️'
  })

  if (!confirmed) return

  productAction.value = { id: product.id, type: isActive ? 'offline' : 'online' }
  const loadingId = toast.loading(isActive ? '正在下架物品...' : '正在上架物品...')

  try {
    if (isActive) {
      // 下架操作
      const result = await shopStore.offlineProduct(product.id)
      if (result?.success === false) {
        toast.error(result?.error?.message || result?.error || '下架失败')
        return
      }
      product.status = 'offline_manual'
      toast.success('物品已下架')
    } else {
      // 重新上架操作（重新提交审核）
      const result = await shopStore.updateProduct(product.id, {
        name: product.name,
        categoryId: product.category_id,
        description: product.description,
        price: product.price,
        discount: product.discount,
        imageUrl: product.image_url || '',
        stock: getProductType(product) === 'normal' ? Number(product.stock || 0) : undefined,
        maxPurchaseQuantity: getProductType(product) === 'cdk'
          ? Number(product.max_purchase_quantity || product.maxPurchaseQuantity || 0)
          : undefined
      })
      if (result?.success === false) {
        toast.error(result?.error?.message || result?.error || '上架失败')
        return
      }
      product.status = 'pending_ai'
      toast.success('已重新提交审核')
    }
  } catch (error) {
    toast.error(`${action}失败: ${error.message || '未知错误'}`)
  } finally {
    toast.close(loadingId)
    productAction.value = { id: null, type: '' }
  }
}

// 删除物品

async function deleteProduct(product) {
  if (isRestrictedProductManagement.value) {
    toast.warning('受限维护中，当前仅开放商品 CDK 管理')
    return
  }
  if (isProductBusy(product)) return
  const isActive = isProductActive(product)
  const confirmMsg = isActive 
    ? '该物品当前已上架，删除后将自动下架。确定要删除吗？此操作无法撤销。'
    : '确定要删除该物品吗？此操作无法撤销。'

  const confirmed = await dialog.confirm(confirmMsg, {
    title: '删除物品',
    icon: '🗑️',
    danger: true
  })

  if (!confirmed) return

  productAction.value = { id: product.id, type: 'delete' }
  const loadingId = toast.loading('正在删除物品...')

  try {
    const result = await shopStore.deleteProduct(product.id)
    if (result?.success === false) {
      toast.error(result?.error?.message || result?.error || '删除失败')
      return
    }
    products.value = products.value.filter(p => p.id !== product.id)
    toast.success(result?.message || '物品已删除')
  } catch (error) {
    toast.error('删除失败: ' + (error.message || '未知错误'))
  } finally {
    toast.close(loadingId)
    productAction.value = { id: null, type: '' }
  }
}

// CDK 管理
async function manageCdk(product) {
  currentProduct.value = product
  showCdkModal.value = true
  cdkStatusFilter.value = 'available'
  await loadCdkList()
}

// 关闭 CDK 弹窗
function closeCdkModal() {
  showCdkModal.value = false
  currentProduct.value = null
  cdkList.value = []
  newCdkText.value = ''
  deletingCdkId.value = null
}

// 添加 CDK
async function addCdks() {
  if (!newCdkText.value.trim() || !currentProduct.value) return
  
  const codes = newCdkText.value
    .split('\n')
    .map(code => code.trim())
    .filter(code => code)
  
  if (codes.length === 0) {
    toast.warning('请输入有效的 CDK')
    return
  }
  
  addingCdk.value = true
  try {
    await shopStore.addProductCdks(currentProduct.value.id, codes)
    toast.success(`成功添加 ${codes.length} 个 CDK`)
    newCdkText.value = ''
    
    // 刷新 CDK 列表
    cdkList.value = sortCdkListByStatus(await shopStore.fetchProductCdks(currentProduct.value.id))
    
    // 更新库存
    const index = products.value.findIndex(p => p.id === currentProduct.value.id)
    if (index !== -1) {
      products.value[index].stock = (products.value[index].stock || 0) + codes.length
    }
  } catch (error) {
    toast.error('添加 CDK 失败')
  } finally {
    addingCdk.value = false
  }
}

async function exportCdks() {
  if (!currentProduct.value?.id || exportingCdks.value) return

  exportingCdks.value = true
  const loadingId = toast.loading('正在导出 CDK...')

  try {
    const status = cdkStatusFilter.value || 'all'
    const token = storage.get('token') || ''
    const apiBase = api.BASE_URL || ''
    const response = await fetch(`${apiBase}/api/shop/products/${currentProduct.value.id}/cdk/export?status=${encodeURIComponent(status)}&format=txt`, {
      method: 'GET',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })

    if (!response.ok) {
      let message = '导出 CDK 失败'
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = await response.json().catch(() => null)
        message = data?.error?.message || data?.error || data?.message || message
      } else {
        const text = await response.text().catch(() => '')
        if (text) message = text
      }
      throw new Error(message)
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const disposition = response.headers.get('content-disposition') || ''
    const match = disposition.match(/filename="([^"]+)"/)
    link.href = url
    link.download = match?.[1] || `${currentProduct.value.id}-cdk.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.close(loadingId)
    toast.success('CDK TXT 导出成功')
  } catch (error) {
    toast.close(loadingId)
    toast.error(error.message || '导出 CDK 失败')
  } finally {
    exportingCdks.value = false
  }
}

// 获取物品状态（处理多种字段名和状态值）
function normalizeProductStatus(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (!normalized) return 'pending_ai'

  const alias = {
    approved: 'manual_approved',
    active: 'manual_approved',
    pending: 'pending_ai',
    rejected: 'manual_rejected',
    offline: 'offline_manual',
    inactive: 'offline_manual'
  }

  return alias[normalized] || normalized
}

function getProductStatus(product) {
  const rawStatus = product?.status || product?.product_status || product?.productStatus || 'pending_ai'
  return normalizeProductStatus(rawStatus)
}

// 获取物品类型（处理多种字段名）
function getProductType(product) {
  return resolveProductType(product)
}

function isCdkItem(product) {
  return isCdkProduct(product)
}

function isPlatformOrderProductItem(product) {
  return isPlatformOrderProduct(product)
}

// 状态文本
function getStatusText(status) {
  const normalized = normalizeProductStatus(status)
  const map = {
    pending_ai: '审核中',
    pending_manual: '待人工审核',
    ai_approved: '已上架',
    manual_approved: '已上架',
    ai_rejected: '已拒绝',
    manual_rejected: '已拒绝',
    offline_manual: '已下架'
  }
  return map[normalized] || '未知状态'
}

// 类型文本
function getTypeText(type) {
  const normalized = String(type || '')
  if (normalized === 'link') {
    return '已停用外链'
  }
  return getProductTypeText(type)
}

// 状态图标
function getStatusIcon(status) {
  const normalized = normalizeProductStatus(status)
  const map = {
    pending_ai: '⏳',
    pending_manual: '🧑‍⚖️',
    ai_approved: '✅',
    manual_approved: '✅',
    ai_rejected: '❌',
    manual_rejected: '❌',
    offline_manual: '⏸️'
  }
  return map[normalized] || '❓'
}

// 类型图标
function getTypeIcon(type) {
  return getProductTypeIcon(type)
}

// 格式化价格
function formatPrice(product) {
  const price = product.price || 0
  return price % 1 === 0 ? price : price.toFixed(2)
}

// 获取库存显示
function getStockDisplay(product) {
  return resolveStockDisplay(product)
}

// 是否低库存
function isLowStock(product) {
  return hasLowStock(product)
}

// 获取图片样式
function getImageStyle(product) {
  if (product.image_url) return {}
  // 根据分类生成渐变背景
  const colors = {
    '游戏': 'linear-gradient(135deg, #a5b4a3 0%, #8fa38d 100%)',
    '软件': 'linear-gradient(135deg, #b4a5a3 0%, #a38f8d 100%)',
    '会员': 'linear-gradient(135deg, #cfa76f 0%, #c49a5f 100%)',
    '点数': 'linear-gradient(135deg, #778d9c 0%, #6a8090 100%)',
    'default': 'linear-gradient(135deg, #d5d0c9 0%, #c5c0b9 100%)'
  }
  const category = product.category_name || ''
  for (const [key, gradient] of Object.entries(colors)) {
    if (category.includes(key)) {
      return { background: gradient }
    }
  }
  return { background: colors.default }
}

// 处理图片加载错误
function handleImageError(e) {
  e.target.style.display = 'none'
  e.target.parentElement.querySelector('.image-placeholder')?.style?.removeProperty('display')
}

// 获取拒绝/下架原因
function getRejectReason(product) {
  const status = getProductStatus(product)
  const shouldShowReason = ['ai_rejected', 'manual_rejected', 'offline_manual'].includes(status)
  if (!shouldShowReason) return null

  const reason =
    product.status_reason
    || product.statusReason
    || product.reject_reason
    || product.rejectReason
    || product.offline_reason
    || product.offlineReason
    || ''

  if (reason) return reason

  if (isLegacyLinkProduct(product)) {
    return '外链物品已停用，请重新发布为普通物品'
  }

  if (['ai_rejected', 'manual_rejected'].includes(status)) {
    return '物品未通过审核'
  }
  if (status === 'offline_manual') {
    return '物品已下架'
  }
  return null
}

// 是否可切换状态（已拒绝的不能切换）
function canToggleStatus(product) {
  const blockedStatuses = ['pending_ai', 'pending_manual', 'ai_rejected', 'manual_rejected']
  if (isLegacyLinkProduct(product)) return false
  return !blockedStatuses.includes(getProductStatus(product))
}

const CDK_STATUS_PRIORITY = {
  locked: 0,
  available: 1,
  sold: 2
}

function normalizeCdkStatus(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'locked' || normalized === 'available' || normalized === 'sold') {
    return normalized
  }
  return 'available'
}

function sortCdkListByStatus(list) {
  return [...(list || [])].sort((a, b) => {
    const statusA = normalizeCdkStatus(a?.status)
    const statusB = normalizeCdkStatus(b?.status)
    const priorityA = CDK_STATUS_PRIORITY[statusA] ?? 999
    const priorityB = CDK_STATUS_PRIORITY[statusB] ?? 999
    if (priorityA !== priorityB) return priorityA - priorityB

    const timeA = new Date(a?.created_at || 0).getTime()
    const timeB = new Date(b?.created_at || 0).getTime()
    if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeA !== timeB) {
      return timeB - timeA
    }

    return (b?.id || 0) - (a?.id || 0)
  })
}

// CDK 状态文本
function getCdkStatusText(status) {
  const map = {
    locked: '锁定中',
    available: '可用',
    sold: '已售出'
  }
  return map[status] || '可用'
}

function isCdkDeletable(cdk) {
  return normalizeCdkStatus(cdk?.status) === 'available'
}

// 加载 CDK 列表
async function loadCdkList() {
  if (!currentProduct.value) return
  
  cdkLoading.value = true
  try {
    // fetchCdkList 返回 { cdks, stats, batches, pagination }
    const result = await shopStore.fetchCdkList(currentProduct.value.id, { status: cdkStatusFilter.value })
    cdkList.value = sortCdkListByStatus(result?.cdks || [])
    cdkStats.value = result?.stats || { total: 0, available: 0, locked: 0, sold: 0 }
  } catch (error) {
    toast.error('加载 CDK 列表失败')
  } finally {
    cdkLoading.value = false
  }
}

// 删除单个 CDK

async function deleteCdkItem(cdk) {
  if (isDeletingCdk(cdk)) return
  const confirmed = await dialog.confirm('确定要删除这个 CDK 吗？', {
    title: '删除 CDK',
    icon: '🗑️',
    danger: true
  })

  if (!confirmed) return

  deletingCdkId.value = getCdkKey(cdk)
  const loadingId = toast.loading('正在删除 CDK...')

  try {
    await shopStore.deleteProductCdk(currentProduct.value.id, cdk.id)
    cdkList.value = cdkList.value.filter(item => item.id !== cdk.id)
    toast.success('CDK 已删除')

    // 更新库存
    const index = products.value.findIndex(p => p.id === currentProduct.value.id)
    if (index !== -1 && products.value[index].availableStock > 0) {
      products.value[index].availableStock--
    }
  } catch (error) {
    toast.error('删除 CDK 失败')
  } finally {
    toast.close(loadingId)
    deletingCdkId.value = null
  }
}

function getCdkKey(cdk) {
  return cdk?.id ?? cdk?.code
}

function isDeletingCdk(cdk) {
  return deletingCdkId.value === getCdkKey(cdk)
}

// 一键清空全部可删 CDK
async function clearAllCdks() {
  if (clearingAllCdks.value) return
  
  const availableCount = cdkStats.value.available || 0
  if (availableCount === 0) {
    toast.info('没有可删除的 CDK')
    return
  }
  
  const confirmed = await dialog.confirm(
    `确定要删除全部 ${availableCount} 个可用的 CDK 吗？\n\n此操作不可恢复！已锁定和已售出的 CDK 不会被删除。`,
    {
      title: '⚠️ 一键清空 CDK',
      icon: '🗑️',
      danger: true
    }
  )
  
  if (!confirmed) return
  
  clearingAllCdks.value = true
  const loadingId = toast.loading('正在清空 CDK...')
  
  try {
    const result = await shopStore.clearCdk(currentProduct.value.id)
    
    // 重新加载 CDK 列表和统计
    await loadCdkList()
    
    toast.success(`已清空 ${result?.deleted || availableCount} 个 CDK`)
    
    // 更新产品库存
    const index = products.value.findIndex(p => p.id === currentProduct.value.id)
    if (index !== -1) {
      products.value[index].availableStock = 0
      products.value[index].stock = result?.stock || 0
    }
  } catch (error) {
    console.error('Clear CDK error:', error)
    toast.error('清空 CDK 失败: ' + (error.message || '未知错误'))
  } finally {
    toast.close(loadingId)
    clearingAllCdks.value = false
  }
}

function isProductBusy(product) {
  return productAction.value.id === product.id
}

function isProcessingProduct(product, type) {
  return isProductBusy(product) && productAction.value.type === type
}

function getToggleLabel(product) {
  if (isProcessingProduct(product, 'offline')) return '⏸️ 下架中...'
  if (isProcessingProduct(product, 'online')) return '▶️ 上架中...'
  return isProductActive(product) ? '⏸️ 下架' : '▶️ 重新上架'
}

function getDeleteLabel(product) {
  return isProcessingProduct(product, 'delete') ? '🗑️ 删除中...' : '🗑️ 删除'
}

onMounted(() => {
  loadProducts()
})
</script>

<style scoped>
.my-products-page {
  min-height: 100vh;
  padding-bottom: 80px;
}

.page-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
}

.page-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.5px;
}

.add-btn {
  padding: 10px 20px;
  background: #8fa38d;
  color: white;
  border-radius: 24px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  box-shadow: 0 2px 8px rgba(143, 163, 141, 0.3);
}

.add-btn:hover {
  background: #7a8f78;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(143, 163, 141, 0.4);
}

/* 加载骨架 */
.loading-state {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
  display: flex;
  gap: 16px;
}

.skeleton-img {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  background: var(--skeleton-gradient);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  flex-shrink: 0;
}

.skeleton-info {
  flex: 1;
}

.skeleton {
  background: var(--skeleton-gradient);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-line { height: 14px; }
.w-32 { width: 128px; }
.w-48 { width: 192px; }
.w-full { width: 100%; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* 空状态按钮 */
.publish-btn {
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

.publish-btn:hover {
  background: var(--color-primary-hover);
}

/* 物品列表 */
.products-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 物品卡片 */
.product-card {
  position: relative;
  background: var(--bg-card);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  border: 1px solid var(--border-light);
}

.product-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  transform: translateY(-3px);
}

/* 不同状态的卡片左边框指示器 */
.product-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  border-radius: 16px 0 0 16px;
  transition: background 0.3s;
}

.product-card.ai_approved::before,
.product-card.manual_approved::before,
.product-card.approved::before,
.product-card.active::before {
  background: linear-gradient(180deg, #52c41a 0%, #73d13d 100%);
}

.product-card.pending_ai::before,
.product-card.pending::before {
  background: linear-gradient(180deg, #faad14 0%, #ffc53d 100%);
}

.product-card.pending_manual::before {
  background: linear-gradient(180deg, #f59e0b 0%, #fbbf24 100%);
}

.product-card.ai_rejected::before,
.product-card.manual_rejected::before,
.product-card.rejected::before {
  background: linear-gradient(180deg, #ff4d4f 0%, #ff7875 100%);
}

.product-card.offline_manual::before,
.product-card.offline::before,
.product-card.inactive::before {
  background: linear-gradient(180deg, #8c8c8c 0%, #bfbfbf 100%);
}

.product-card.offline_manual,
.product-card.offline,
.product-card.inactive {
  opacity: 0.8;
}

/* 状态标签（右上角） */
.status-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  z-index: 2;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.status-badge.ai_approved,
.status-badge.manual_approved,
.status-badge.approved,
.status-badge.active {
  background: linear-gradient(135deg, rgba(82, 196, 26, 0.15) 0%, rgba(115, 209, 61, 0.2) 100%);
  color: #389e0d;
  border: 1px solid rgba(82, 196, 26, 0.3);
}

.status-badge.pending_ai,
.status-badge.pending {
  background: linear-gradient(135deg, rgba(250, 173, 20, 0.15) 0%, rgba(255, 197, 61, 0.2) 100%);
  color: #d48806;
  border: 1px solid rgba(250, 173, 20, 0.3);
}

.status-badge.pending_manual {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 191, 36, 0.2) 100%);
  color: #b45309;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.status-badge.ai_rejected,
.status-badge.manual_rejected,
.status-badge.rejected {
  background: linear-gradient(135deg, rgba(255, 77, 79, 0.15) 0%, rgba(255, 120, 117, 0.2) 100%);
  color: #cf1322;
  border: 1px solid rgba(255, 77, 79, 0.3);
}

.status-badge.offline_manual,
.status-badge.offline,
.status-badge.inactive {
  background: linear-gradient(135deg, rgba(140, 140, 140, 0.1) 0%, rgba(191, 191, 191, 0.15) 100%);
  color: #595959;
  border: 1px solid rgba(140, 140, 140, 0.2);
}

.status-icon {
  font-size: 12px;
}

/* 主体内容 */
.product-main {
  display: flex;
  gap: 16px;
  padding: 16px;
  cursor: pointer;
}

/* 物品图片 */
.product-image {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder {
  font-size: 32px;
  opacity: 0.7;
}

/* 类型角标 */
.type-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 12px;
  background: var(--glass-bg-heavy);
  box-shadow: var(--shadow-sm);
}

/* 物品信息 */
.product-info {
  flex: 1;
  min-width: 0;
  padding-right: 60px; /* 给状态标签留空间 */
}

.product-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0 0 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

/* 价格和数据 */
.product-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.product-price {
  color: var(--color-warning);
  font-weight: 600;
}

.price-value {
  font-size: 16px;
}

.price-unit {
  font-size: 12px;
  margin-left: 2px;
}

.meta-divider {
  color: var(--border-color);
  margin: 0 2px;
}

.product-stock.low {
  color: var(--color-warning);
}

/* 标签 */
.product-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.2px;
}

.tag.category {
  background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}

.tag.type {
  background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}

.tag.type.cdk {
  background: linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%);
  color: #389e0d;
  border: 1px solid #b7eb8f;
}

.tag.type.normal {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  color: #1d4ed8;
  border: 1px solid #93c5fd;
}

.tag.type.link {
  background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
  color: #c2410c;
  border: 1px solid #fdba74;
}

/* 拒绝/下架原因 */
.reject-reason {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #fef3e2 0%, #fef9f3 100%);
  border-top: 1px solid #f5dbb8;
  border-radius: 0 0 14px 14px;
}

.reason-icon {
  flex-shrink: 0;
  font-size: 16px;
  line-height: 1.4;
}

.reason-text {
  font-size: 13px;
  color: #8b5a2b;
  line-height: 1.5;
  word-break: break-word;
}

/* 操作按钮 */
.product-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  border-top: 1px solid var(--border-light);
}

.action-btn {
  padding: 8px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  font-weight: 500;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.action-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

.action-btn:active {
  transform: translateY(0);
}

.action-btn.edit:hover {
  background: linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%);
  border-color: #1890ff;
  color: #1890ff;
}

.action-btn.cdk {
  background: linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%);
  border-color: #b7eb8f;
  color: #52c41a;
}

.action-btn.cdk:hover {
  border-color: #52c41a;
  box-shadow: 0 2px 6px rgba(82, 196, 26, 0.2);
}

.action-btn.offline:hover {
  background: linear-gradient(135deg, #fffbe6 0%, #fff1b8 100%);
  border-color: #faad14;
  color: #d48806;
}

.action-btn.online {
  background: linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%);
  border-color: #b7eb8f;
  color: #52c41a;
}

.action-btn.online:hover {
  border-color: #52c41a;
  box-shadow: 0 2px 6px rgba(82, 196, 26, 0.2);
}

.action-btn.delete:hover {
  background: linear-gradient(135deg, #fff2f0 0%, #ffccc7 100%);
  border-color: #ff4d4f;
  color: #cf1322;
}

/* 加载更多 */
.load-more {
  padding: 20px;
  text-align: center;
}

.load-more-btn {
  padding: 12px 32px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 24px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.load-more-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ========== CDK 弹窗 ========== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.modal-content {
  width: 100%;
  max-width: 500px;
  max-height: 85vh;
  background: var(--bg-card);
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-subtitle {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-right: auto;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: none;
  border-radius: 50%;
  font-size: 16px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s;
}

.modal-close:hover {
  background: var(--border-color);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* CDK 统计 */
.cdk-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-item {
  flex: 1;
  text-align: center;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.stat-item.available {
  background: var(--color-success-light);
}

.stat-item.available .stat-value {
  color: var(--color-success);
}

.stat-item.locked {
  background: #fff7e6;
}

.stat-item.locked .stat-value {
  color: #d48806;
}

.stat-item.sold {
  background: var(--bg-secondary);
}

.stat-item.sold .stat-value {
  color: var(--text-tertiary);
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  display: block;
}

.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
  display: block;
}

/* CDK 筛选 */
.cdk-filter {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-card);
  outline: none;
  cursor: pointer;
}

.filter-select:focus {
  border-color: var(--color-primary);
}

.export-btn {
  padding: 8px 14px;
  background: #dbeafe;
  color: #1d4ed8;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.export-btn:hover:not(:disabled) {
  background: #bfdbfe;
}

.clear-all-btn {
  flex: 1;
  padding: 8px 14px;
  border: 1px solid #dc2626;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #dc2626;
  background: #fef2f2;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-all-btn:hover:not(:disabled) {
  background: #dc2626;
  color: #fff;
}

.clear-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* CDK 列表 */
.cdk-list-wrapper {
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 16px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.cdk-loading {
  text-align: center;
  padding: 30px;
  color: var(--text-tertiary);
}

.cdk-list {
  padding: 8px;
}

.cdk-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 6px;
  transition: background 0.2s;
}

.cdk-item:last-child {
  margin-bottom: 0;
}

.cdk-item:hover {
  background: var(--bg-secondary);
}

.cdk-item.available {
  background: var(--color-success-light);
}

.cdk-item.locked {
  background: #fff7e6;
}

.cdk-item.sold {
  background: var(--bg-secondary);
}

.cdk-item.sold .cdk-code {
  color: var(--text-placeholder);
  text-decoration: line-through;
}

.cdk-code {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  color: var(--text-primary);
  word-break: break-all;
  flex: 1;
  margin-right: 12px;
}

.cdk-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.cdk-status {
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.cdk-status.available {
  background: var(--color-success-light);
  color: var(--color-success);
}

.cdk-status.locked {
  background: #fff7e6;
  color: #d48806;
}

.cdk-status.sold {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

.cdk-delete-btn {
  padding: 4px 8px;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  opacity: 0.6;
  transition: all 0.2s;
}

.cdk-delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cdk-delete-btn:hover {
  background: var(--color-danger-light);
  opacity: 1;
}

.cdk-empty {
  text-align: center;
  padding: 30px;
  color: var(--text-tertiary);
  font-size: 14px;
}

/* 添加 CDK */
.cdk-add {
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}

.add-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px;
}

.cdk-input {
  width: 100%;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  color: var(--text-primary);
  resize: none;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.cdk-input:focus {
  border-color: var(--color-primary);
}

.add-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.add-count {
  font-size: 13px;
  color: var(--color-success);
}

.add-btn-primary {
  padding: 10px 24px;
  background: var(--color-primary);
  border: none;
  border-radius: 10px;
  font-size: 14px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.add-btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 响应式调整 */
@media (max-width: 400px) {
  .product-image {
    width: 72px;
    height: 72px;
  }
  
  .product-info {
    padding-right: 50px;
  }
  
  .status-badge {
    padding: 3px 8px;
    font-size: 11px;
  }
  
  .product-actions {
    gap: 6px;
  }
  
  .action-btn {
    padding: 6px 10px;
    font-size: 12px;
  }
}
</style>
