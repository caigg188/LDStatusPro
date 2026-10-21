<template>
  <div class="my-products-page">
    <SellerPageToolbar eyebrow="商品台账" description="集中查看物品状态、价格、库存与经营数据。筛选条件会保留在地址中，返回时仍能继续处理。">
      <template #actions>
        <button v-if="sellingDisabled" type="button" class="seller-primary-button" disabled title="卖家功能已被平台禁用，暂时无法发布物品"><Plus :size="17" aria-hidden="true" />暂无法发布</button>
        <router-link v-else to="/seller/products/new" class="seller-primary-button"><Plus :size="17" aria-hidden="true" />发布物品</router-link>
      </template>
      <form class="product-search" role="search" @submit.prevent="applyProductFilters({ resetPage: true })">
        <Search :size="17" aria-hidden="true" />
        <label class="seller-sr-only" for="seller-product-search">搜索物品</label>
        <input id="seller-product-search" v-model.trim="productSearch" type="search" placeholder="搜索名称或物品 ID" />
      </form>
      <label class="seller-filter-field"><span>状态</span><select v-model="productStatusFilter" @change="applyProductFilters({ resetPage: true })"><option value="">全部状态</option><option value="approved">已上架</option><option value="pending">审核中</option><option value="rejected">未通过</option><option value="offline">已下架</option></select></label>
      <label class="seller-filter-field"><span>类型</span><select v-model="productTypeFilter" @change="applyProductFilters({ resetPage: true })"><option value="">全部类型</option><option value="normal">普通物品</option><option value="cdk">自动发卡</option></select></label>
      <label class="seller-filter-field"><span>库存</span><select v-model="productStockFilter" @change="applyProductFilters({ resetPage: true })"><option value="">全部库存</option><option value="out">已售罄</option><option value="low">低库存</option><option value="available">库存充足</option></select></label>
      <label class="seller-filter-field"><span>排序</span><select v-model="productSort" @change="applyProductFilters({ resetPage: true })"><option value="priority">待处理优先</option><option value="updated">最近更新</option><option value="sold">售出最多</option><option value="views">浏览最多</option><option value="price-desc">价格从高到低</option><option value="price-asc">价格从低到高</option></select></label>
      <button v-if="hasProductFilters" type="button" class="seller-secondary-button" @click="clearProductFilters">清除筛选</button>
      <template #summary>
        <span v-if="productStatusFilter" class="seller-filter-chip">状态：{{ productStatusFilterLabel }}</span>
        <span v-if="productTypeFilter" class="seller-filter-chip">类型：{{ productTypeFilterLabel }}</span>
        <span v-if="productStockFilter" class="seller-filter-chip">库存：{{ productStockFilterLabel }}</span>
        <span class="seller-result-count">{{ productPagination.total }} 件物品</span>
      </template>
    </SellerPageToolbar>

    <SellerDataTable
      caption="我的物品经营列表"
      :columns="productColumns"
      :rows="productPagination.rows"
      :loading="loading"
      row-key="id"
    >
      <template #cell-product="{ row: product }">
        <div class="product-ledger-main">
          <button type="button" class="product-ledger-image" :style="getImageStyle(product)" :aria-label="`查看物品 ${product.name}`" @click="viewProduct(product)">
            <img v-if="hasProductImage(product)" :src="product.imageUrl" alt="" loading="lazy" @error="handleImageError($event, product)" />
            <Package v-else :size="20" aria-hidden="true" />
          </button>
          <div class="product-ledger-copy">
            <button type="button" class="product-ledger-name" :title="product.name" @click="viewProduct(product)">
              <strong>{{ product.name }}</strong>
            </button>
            <div class="product-ledger-badges">
              <button type="button" class="product-id-badge" :class="{ copied: isProductIdCopied(product) }" :aria-label="`复制物品 ID ${product.id}`" title="点击复制物品 ID" @click="copyProductId(product)">
                <Hash :size="12" aria-hidden="true" />
                <span>{{ product.id }}</span>
                <Check v-if="isProductIdCopied(product)" :size="12" aria-hidden="true" />
                <Copy v-else :size="12" aria-hidden="true" />
              </button>
              <span class="product-archive-badge category" :title="product.categoryName || '其他'">
                <Tag :size="12" aria-hidden="true" />
                <span>{{ product.categoryName || '其他' }}</span>
              </span>
              <span :class="['product-archive-badge', 'type', `type-${getProductType(product)}`]">
                <component :is="getTypeIcon(getProductType(product))" :size="12" aria-hidden="true" />
                <span>{{ getTypeText(getProductType(product)) }}</span>
              </span>
            </div>
          </div>
        </div>
      </template>
      <template #cell-status="{ row: product }">
        <div class="ledger-status-cell">
          <SellerStatusBadge :tone="resolveSellerStatusTone(getProductStatus(product))" :label="getStatusText(getProductStatus(product))" />
          <SellerReasonDisclosure v-if="getRejectReason(product)" :text="getRejectReason(product)" :label="getReasonLabel(product)" />
        </div>
      </template>
      <template #cell-price="{ row: product }">
        <div :class="['ledger-price', { discounted: hasProductDiscount(product) }]">
          <div class="ledger-price-current">
            <strong>{{ formatLedgerPrice(getProductPrice(product).current) }}</strong>
            <small>LDC</small>
          </div>
          <div class="ledger-price-meta">
            <span v-if="hasProductDiscount(product)" class="ledger-price-original">原价 <del>{{ formatLedgerPrice(getProductPrice(product).original) }}</del></span>
            <span :class="['ledger-discount-badge', { muted: !hasProductDiscount(product) }]">{{ getProductPrice(product).discountLabel }}</span>
          </div>
        </div>
      </template>
      <template #cell-stock="{ row: product }"><template v-if="isPlatformOrderProductItem(product)"><strong :class="['ledger-number', { 'is-warning': isLowStock(product) }]">{{ getStockDisplay(product) }}</strong><small class="ledger-unit">库存 · 售出 {{ product.soldCount || 0 }}</small></template><span v-else class="ledger-muted">不适用</span></template>
      <template #cell-views="{ row: product }"><strong class="ledger-number">{{ product.viewCount || 0 }}</strong><small class="ledger-unit">次浏览</small></template>
      <template #cell-actions="{ row: product }"><ProductRowActions :product="product" :can-manage-cdk="isCdkItem(product)" :can-toggle="canToggleStatus(product)" :busy="isProductBusy(product)" :restricted="isRestrictedProductManagement" :toggle-label="getToggleLabel(product)" :delete-label="getDeleteLabel(product)" @edit="editProduct" @cdk="manageCdk" @toggle="toggleStatus" @delete="deleteProduct" /></template>
      <template #mobile-row="{ row: product }">
        <div class="product-mobile-head">
          <div class="product-ledger-main">
            <button type="button" class="product-ledger-image" :style="getImageStyle(product)" :aria-label="`查看物品 ${product.name}`" @click="viewProduct(product)">
              <img v-if="hasProductImage(product)" :src="product.imageUrl" alt="" loading="lazy" @error="handleImageError($event, product)" />
              <Package v-else :size="20" aria-hidden="true" />
            </button>
            <div class="product-ledger-copy">
              <button type="button" class="product-ledger-name" @click="viewProduct(product)"><strong>{{ product.name }}</strong></button>
              <div class="product-ledger-badges">
                <button type="button" class="product-id-badge" :class="{ copied: isProductIdCopied(product) }" :aria-label="`复制物品 ID ${product.id}`" @click="copyProductId(product)">
                  <Hash :size="12" aria-hidden="true" />
                  <span>{{ product.id }}</span>
                  <Check v-if="isProductIdCopied(product)" :size="12" aria-hidden="true" />
                  <Copy v-else :size="12" aria-hidden="true" />
                </button>
                <span class="product-archive-badge category"><Tag :size="12" aria-hidden="true" /><span>{{ product.categoryName || '其他' }}</span></span>
                <span :class="['product-archive-badge', 'type', `type-${getProductType(product)}`]">
                  <component :is="getTypeIcon(getProductType(product))" :size="12" aria-hidden="true" />
                  <span>{{ getTypeText(getProductType(product)) }}</span>
                </span>
              </div>
            </div>
          </div>
          <SellerStatusBadge :tone="resolveSellerStatusTone(getProductStatus(product))" :label="getStatusText(getProductStatus(product))" />
        </div>
        <div v-if="getRejectReason(product)" class="product-mobile-reason">
          <CircleAlert :size="16" aria-hidden="true" />
          <div><strong>{{ getReasonLabel(product) }}</strong><p>{{ getRejectReason(product) }}</p></div>
        </div>
        <dl class="product-mobile-metrics">
          <div class="metric-price">
            <dt>成交价</dt>
            <dd>
              <span :class="['mobile-price-current', { discounted: hasProductDiscount(product) }]">{{ formatLedgerPrice(getProductPrice(product).current) }} <small>LDC</small></span>
              <span v-if="hasProductDiscount(product)" class="mobile-price-compare"><del>{{ formatLedgerPrice(getProductPrice(product).original) }}</del><em>{{ getProductPrice(product).discountLabel }}</em></span>
              <span v-else class="mobile-price-compare">无折扣</span>
            </dd>
          </div>
          <div><dt>库存 / 售出</dt><dd>{{ isPlatformOrderProductItem(product) ? `${getStockDisplay(product)} / ${product.soldCount || 0}` : '不适用' }}</dd></div>
          <div><dt>浏览</dt><dd>{{ product.viewCount || 0 }}</dd></div>
        </dl>
        <ProductRowActions :product="product" mobile :can-manage-cdk="isCdkItem(product)" :can-toggle="canToggleStatus(product)" :busy="isProductBusy(product)" :restricted="isRestrictedProductManagement" :toggle-label="getToggleLabel(product)" :delete-label="getDeleteLabel(product)" @edit="editProduct" @cdk="manageCdk" @toggle="toggleStatus" @delete="deleteProduct" />
      </template>
      <template #empty><div class="seller-empty-ledger"><PackageOpen :size="32" aria-hidden="true" /><strong>{{ products.length ? '当前筛选下没有物品' : '还没有发布物品' }}</strong><p>{{ products.length ? '调整或清除筛选条件后再试。' : (sellingDisabled ? '卖家功能已被平台禁用，暂时无法发布物品。' : '发布第一件物品，开始建立你的经营台账。') }}</p><button v-if="products.length" type="button" class="seller-secondary-button" @click="clearProductFilters">清除筛选</button><button v-else-if="sellingDisabled" type="button" class="seller-primary-button" disabled>暂无法发布</button><router-link v-else to="/seller/products/new" class="seller-primary-button">发布物品</router-link></div></template>
      <template #footer><SellerPagination :page="productPagination.page" :total-pages="productPagination.totalPages" :total="productPagination.total" @change="changeProductPage" /></template>
    </SellerDataTable>
    
    <!-- CDK 管理弹窗 -->
    <div v-if="showCdkModal" class="modal-overlay" @click.self="closeCdkModal">
      <div class="modal-content cdk-modal">
        <div class="modal-header">
          <h3 class="modal-title">CDK 管理</h3>
          <span class="modal-subtitle">{{ currentProduct?.name }}</span>
            <button class="modal-close" aria-label="关闭 CDK 管理" @click="closeCdkModal"><X :size="19" aria-hidden="true" /></button>
        </div>
        
        <div class="modal-body">
          <div v-if="currentProduct?.sharedCdkEnabled">
            <div class="cdk-stats shared-mode">
              <div class="stat-item">
                <span class="stat-value">∞</span>
                <span class="stat-label">共享库存</span>
              </div>
              <div class="stat-item sold">
                <span class="stat-value">{{ cdkStats.sold || 0 }}</span>
                <span class="stat-label">已售</span>
              </div>
            </div>
            <div class="cdk-list-wrapper">
              <div v-if="cdkLoading" class="cdk-loading">加载中...</div>
              <div class="cdk-list" v-else-if="cdkList.length > 0">
                <div
                  v-for="cdk in cdkList"
                  :key="cdk.id || cdk.code"
                  class="cdk-item available"
                >
                  <code class="cdk-code">{{ cdk.code }}</code>
                  <div class="cdk-actions">
                    <span class="cdk-status available">共享卡密</span>
                  </div>
                </div>
              </div>
              <div v-else class="cdk-empty">暂未配置共享卡密</div>
            </div>
            <div class="cdk-add">
              <p class="form-hint">共享卡密模式下请前往编辑页修改共享 CDK，当前页面不支持批量增删。</p>
              <button class="add-btn-primary" @click="editProduct(currentProduct)">前往编辑页</button>
            </div>
          </div>
          <template v-else>
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
              <Download :size="15" aria-hidden="true" />{{ exportingCdks ? '导出中...' : '导出 TXT' }}
            </button>
            <button
              class="clear-all-btn"
              @click="clearAllCdks"
              :disabled="clearingAllCdks || (cdkStats.available || 0) === 0"
            >
              {{ clearingAllCdks ? '清空中...' : '一键清空全部可删 CDK' }}
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
                  >{{ isDeletingCdk(cdk) ? '...' : '删除' }}</button>
                </div>
              </div>
            </div>
            <div v-else class="cdk-empty">
              暂无 CDK
            </div>
          </div>

          <!-- 添加 CDK -->
          <div class="cdk-add">
            <h4 class="add-title">添加 CDK</h4>
            <textarea
              v-model="newCdkText"
              class="cdk-input"
              placeholder="请输入CDK，每行一个"
              rows="4"
            ></textarea>
            <div class="add-footer">
              <span v-if="newCdkCount > 0" class="add-count" :class="{ 'limit-error': cdkExceedsBatchLimit }">
                将添加 {{ newCdkCount }} 个<template v-if="cdkExceedsBatchLimit">（超过单次上限 {{ CDK_UPLOAD_LIMITS.perBatch }} 条）</template>
              </span>
              <span v-else class="add-quota-hint">单次最多 {{ CDK_UPLOAD_LIMITS.perBatch }} 条 · 未售出 {{ unsoldCdkCount }}/{{ CDK_UPLOAD_LIMITS.totalUnsold }}</span>
              <button
                class="add-btn-primary"
                @click="addCdks"
                :disabled="!newCdkText.trim() || addingCdk || cdkExceedsBatchLimit"
              >
                {{ addingCdk ? '添加中...' : '添加 CDK' }}
              </button>
            </div>
          </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Check, CircleAlert, Copy, Download, Hash, KeyRound, Link2, Package, PackageOpen, Plus, Search, Store, Tag, X } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import { useInventoryStore } from '@/stores/inventory'
import { useMerchantEnforcementStore } from '@/stores/merchantEnforcement'
import { isMaintenanceFeatureEnabled, isRestrictedMaintenanceMode } from '@/config/maintenance'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import ProductRowActions from '@/components/seller/ProductRowActions.vue'
import SellerDataTable from '@/components/seller/SellerDataTable.vue'
import SellerPageToolbar from '@/components/seller/SellerPageToolbar.vue'
import SellerPagination from '@/components/seller/SellerPagination.vue'
import SellerReasonDisclosure from '@/components/seller/SellerReasonDisclosure.vue'
import SellerStatusBadge from '@/components/seller/SellerStatusBadge.vue'
import { exportCdkRequest } from '@/services/shop/inventoryService'
import { CDK_UPLOAD_LIMITS } from '@/config/cdkQuota'
import { buildSellerProductPrice, filterAndSortSellerProducts, paginateSellerRows, resolveSellerStatusTone } from '@/utils/sellerTables'
import {
  getProductType as resolveProductType,
  getProductTypeText,
  getStockDisplay as resolveStockDisplay,
  isCdkProduct,
  isLegacyLinkProduct,
  isLowStock as hasLowStock,
  isPlatformOrderProduct
} from '@/utils/shopProduct'

const router = useRouter()
const route = useRoute()
const inventoryStore = useInventoryStore()
const merchantEnforcementStore = useMerchantEnforcementStore()
const toast = useToast()
const dialog = useDialog()

const loading = ref(true)
const products = ref([])
const productSearch = ref('')
const productStatusFilter = ref('')
const productTypeFilter = ref('')
const productStockFilter = ref('')
const productSort = ref('priority')
const productColumns = [
  { key: 'product', label: '物品', width: '29%' },
  { key: 'status', label: '状态', width: '15%' },
  { key: 'price', label: '价格', width: '15%' },
  { key: 'stock', label: '库存', width: '12%' },
  { key: 'views', label: '浏览', width: '7%' },
  { key: 'actions', label: '操作', width: '22%', align: 'right' }
]

const PRODUCT_TYPE_ICONS = {
  normal: Package,
  cdk: KeyRound,
  link: Link2,
  store: Store
}
const ledgerPriceFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })
const copiedProductId = ref('')
const failedProductImages = ref(new Set())
let copiedProductIdTimer = null

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
  merchantEnforcementStore.sellingDisabled
  || (isRestrictedMaintenanceMode() && !isMaintenanceFeatureEnabled('productManage'))
)
const sellingDisabled = computed(() => merchantEnforcementStore.sellingDisabled)
const restrictedProductMessage = computed(() => sellingDisabled.value
  ? '卖家功能已被平台禁用，暂时无法修改或重新发布物品'
  : '受限维护中，当前仅开放商品 CDK 管理')

const productStatusFilterLabel = computed(() => ({ approved: '已上架', pending: '审核中', rejected: '未通过', offline: '已下架' })[productStatusFilter.value] || productStatusFilter.value)
const productTypeFilterLabel = computed(() => ({ normal: '普通物品', cdk: '自动发卡' })[productTypeFilter.value] || productTypeFilter.value)
const productStockFilterLabel = computed(() => ({ out: '已售罄', low: '低库存', available: '库存充足' })[productStockFilter.value] || productStockFilter.value)
const hasProductFilters = computed(() => Boolean(productSearch.value || productStatusFilter.value || productTypeFilter.value || productStockFilter.value || productSort.value !== 'priority'))

const filteredProducts = computed(() => filterAndSortSellerProducts(products.value, {
  search: productSearch.value,
  status: productStatusFilter.value,
  type: productTypeFilter.value,
  stock: productStockFilter.value,
  sort: productSort.value
}, {
  getStatus: getProductStatus,
  getType: getProductType,
  getPrice: product => buildSellerProductPrice(product).current,
  getStock: product => Number(product.stock || 0),
  isStockManaged: product => isPlatformOrderProductItem(product) && !isSharedCdkProduct(product),
  priority: getProductStatusPriority
}))

const productPagination = computed(() => paginateSellerRows(filteredProducts.value, route.query.page, 20))

function syncProductFiltersFromRoute() {
  productSearch.value = String(route.query.search || '').trim()
  productStatusFilter.value = String(route.query.status || '').trim()
  productTypeFilter.value = String(route.query.type || '').trim()
  productStockFilter.value = String(route.query.stock || '').trim()
  productSort.value = String(route.query.sort || 'priority').trim() || 'priority'
}

async function applyProductFilters({ resetPage = false } = {}) {
  const nextQuery = { ...route.query }
  const values = {
    search: productSearch.value.trim(),
    status: productStatusFilter.value,
    type: productTypeFilter.value,
    stock: productStockFilter.value,
    sort: productSort.value === 'priority' ? '' : productSort.value
  }
  Object.entries(values).forEach(([key, value]) => {
    if (value) nextQuery[key] = value
    else delete nextQuery[key]
  })
  if (resetPage) delete nextQuery.page
  await router.replace({ query: nextQuery }).catch(() => {})
}

function clearProductFilters() {
  productSearch.value = ''
  productStatusFilter.value = ''
  productTypeFilter.value = ''
  productStockFilter.value = ''
  productSort.value = 'priority'
  router.replace({ path: '/seller/products' }).catch(() => {})
}

function changeProductPage(nextPage) {
  const nextQuery = { ...route.query }
  if (nextPage > 1) nextQuery.page = String(nextPage)
  else delete nextQuery.page
  router.replace({ query: nextQuery }).then(() => window.scrollTo({ top: 0, behavior: 'smooth' })).catch(() => {})
}

// 计算即将添加的 CDK 数量
const newCdkCount = computed(() => {
  if (!newCdkText.value.trim()) return 0
  return newCdkText.value.split('\n').filter(line => line.trim()).length
})

// 未售出 CDK 数量（available + locked）
const unsoldCdkCount = computed(() => (cdkStats.value.available || 0) + (cdkStats.value.locked || 0))

// 是否超过单次上传上限
const cdkExceedsBatchLimit = computed(() => newCdkCount.value > CDK_UPLOAD_LIMITS.perBatch)

// 加载物品
async function loadProducts() {
  try {
    loading.value = true
    
    const result = await inventoryStore.fetchProducts()
    if (!result.success) throw new Error(result.error || '加载物品失败')
    products.value = result.data.products
  } catch (error) {
    toast.error('加载物品失败')
  } finally {
    loading.value = false
  }
}

function getProductStatusPriority(product) {
  const priority = {
    ai_rejected: 0,
    manual_rejected: 0,
    rejected: 0,
    pending_manual: 1,
    pending_ai: 2,
    pending: 2,
    ai_approved: 3,
    manual_approved: 3,
    approved: 3,
    active: 3,
    offline_manual: 4,
    offline: 4,
    inactive: 4
  }
  return priority[getProductStatus(product)] ?? 999
}

// 查看物品
function viewProduct(product) {
  router.push(`/product/${product.id}`)
}

// 编辑物品
function editProduct(product) {
  if (isRestrictedProductManagement.value) {
    toast.warning(restrictedProductMessage.value)
    return
  }
  router.push(`/seller/products/${product.id}/edit`)
}

// 判断是否为上架状态
function isProductActive(product) {
  const status = getProductStatus(product)
  return ['ai_approved', 'manual_approved'].includes(status)
}

// 切换状态

async function toggleStatus(product) {
  if (isRestrictedProductManagement.value) {
    toast.warning(restrictedProductMessage.value)
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
    icon: ''
  })

  if (!confirmed) return

  productAction.value = { id: product.id, type: isActive ? 'offline' : 'online' }
  const loadingId = toast.loading(isActive ? '正在下架物品...' : '正在上架物品...')

  try {
    if (isActive) {
      // 下架操作
      const result = await inventoryStore.offlineProduct(product.id)
      if (result?.success === false) {
        toast.update(loadingId, {
          type: 'error',
          message: result?.error?.message || result?.error || '下架失败'
        })
        return
      }
      product.status = 'offline_manual'
      toast.update(loadingId, { type: 'success', message: '物品已下架' })
    } else {
      // 重新上架操作（重新提交审核）
      const result = await inventoryStore.updateProduct(product.id, {
        name: product.name,
        categoryId: product.categoryId,
        description: product.description,
        price: product.price,
        discount: product.discount,
        imageUrl: product.imageUrl || '',
        stock: getProductType(product) === 'normal' ? Number(product.stock || 0) : undefined,
        purchaseLimitType: product.purchaseLimitConfig?.mode
          || product.purchaseLimitType
          || 'none',
        maxPurchaseQuantity: Number(
          product.purchaseLimitConfig?.quantity
            ?? product.maxPurchaseQuantity
            ?? 0
        ),
        purchaseLimitPeriodDays: Number(
          product.purchaseLimitConfig?.periodDays
            ?? product.purchaseLimitPeriodDays
            ?? 0
        )
      })
      if (result?.success === false) {
        toast.update(loadingId, {
          type: 'error',
          message: result?.error?.message || result?.error || '上架失败'
        })
        return
      }
      product.status = 'pending_ai'
      toast.update(loadingId, { type: 'success', message: '已重新提交审核' })
    }
  } catch (error) {
    toast.update(loadingId, {
      type: 'error',
      message: `${action}失败: ${error.message || '未知错误'}`
    })
  } finally {
    productAction.value = { id: null, type: '' }
  }
}

// 删除物品

async function deleteProduct(product) {
  if (isRestrictedProductManagement.value) {
    toast.warning(restrictedProductMessage.value)
    return
  }
  if (isProductBusy(product)) return
  const isActive = isProductActive(product)
  const confirmMsg = isActive 
    ? '该物品当前已上架，删除后将自动下架。确定要删除吗？此操作无法撤销。'
    : '确定要删除该物品吗？此操作无法撤销。'

  const confirmed = await dialog.confirm(confirmMsg, {
    title: '删除物品',
    icon: '',
    danger: true
  })

  if (!confirmed) return

  productAction.value = { id: product.id, type: 'delete' }
  const loadingId = toast.loading('正在删除物品...')

  try {
    const result = await inventoryStore.deleteProduct(product.id)
    if (result?.success === false) {
      toast.update(loadingId, {
        type: 'error',
        message: result?.error?.message || result?.error || '删除失败'
      })
      return
    }
    products.value = products.value.filter(p => p.id !== product.id)
    toast.update(loadingId, { type: 'success', message: result?.data?.message || result?.message || '物品已删除' })
  } catch (error) {
    toast.update(loadingId, {
      type: 'error',
      message: '删除失败: ' + (error.message || '未知错误')
    })
  } finally {
    productAction.value = { id: null, type: '' }
  }
}

// CDK 管理
async function manageCdk(product) {
  currentProduct.value = {
    ...product,
    sharedCdkEnabled: isSharedCdkProduct(product)
  }
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

  if (codes.length > CDK_UPLOAD_LIMITS.perBatch) {
    toast.error(`单次最多上传 ${CDK_UPLOAD_LIMITS.perBatch} 条卡密（已输入 ${codes.length} 条）`)
    return
  }

  addingCdk.value = true
  try {
    const result = await inventoryStore.addCdk(currentProduct.value.id, codes)
    if (!result.success) {
      toast.error(result.error || '添加 CDK 失败')
      return
    }

    const imported = result.data?.imported ?? codes.length
    const duplicates = result.data?.duplicates || 0
    toast.success(duplicates > 0
      ? `成功添加 ${imported} 个 CDK（跳过重复 ${duplicates} 条）`
      : `成功添加 ${imported} 个 CDK`)
    newCdkText.value = ''

    // 刷新 CDK 列表与统计（未售出余额实时更新）
    const refreshed = await inventoryStore.fetchCdkList(currentProduct.value.id, { status: cdkStatusFilter.value })
    if (refreshed.success) {
      cdkList.value = sortCdkListByStatus(refreshed.data.cdks || [])
      cdkStats.value = refreshed.data.stats || cdkStats.value
    }

    // 更新库存（用后端返回的库存，避免去重导致的偏差）
    const index = products.value.findIndex(p => p.id === currentProduct.value.id)
    if (index !== -1) {
      products.value[index].stock = result.data?.stock ?? ((products.value[index].stock || 0) + imported)
    }
  } catch (error) {
    toast.error(error?.message || '添加 CDK 失败')
  } finally {
    addingCdk.value = false
  }
}

async function exportCdks() {
  if (!currentProduct.value?.id || exportingCdks.value) return

  exportingCdks.value = true
  const loadingId = toast.loading('正在导出 CDK...')

  try {
    const result = await exportCdkRequest(currentProduct.value.id, cdkStatusFilter.value || 'all')
    if (!result.success) throw new Error(result.error || '导出 CDK 失败')
    const url = URL.createObjectURL(result.data.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.data.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.update(loadingId, { type: 'success', message: 'CDK TXT 导出成功' })
  } catch (error) {
    toast.update(loadingId, { type: 'error', message: error.message || '导出 CDK 失败' })
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
  const rawStatus = product?.status || product?.productStatus || 'pending_ai'
  return normalizeProductStatus(rawStatus)
}

// 获取物品类型（处理多种字段名）
function getProductType(product) {
  return resolveProductType(product)
}

function isPlatformOrderProductItem(product) {
  return isPlatformOrderProduct(product)
}

function isCdkItem(product) {
  return isCdkProduct(product)
}

function isSharedCdkProduct(product) {
  return isCdkProduct(product) && !!product?.sharedCdkEnabled
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

function getTypeIcon(type) {
  return PRODUCT_TYPE_ICONS[String(type || '').toLowerCase()] || Package
}

function getProductPrice(product) {
  return buildSellerProductPrice(product)
}

function hasProductDiscount(product) {
  return getProductPrice(product).hasDiscount
}

function formatLedgerPrice(value) {
  return ledgerPriceFormatter.format(Number(value) || 0)
}

// 获取库存显示
function getStockDisplay(product) {
  return resolveStockDisplay(product)
}

// 是否低库存
function isLowStock(product) {
  return hasLowStock(product)
}

function getProductImageKey(product) {
  return `${product?.id ?? 'unknown'}:${product?.imageUrl || ''}`
}

function hasProductImage(product) {
  return Boolean(product?.imageUrl) && !failedProductImages.value.has(getProductImageKey(product))
}

// 获取图片样式
function getImageStyle(product) {
  if (hasProductImage(product)) return {}
  // 根据分类生成渐变背景
  const colors = {
    '游戏': 'linear-gradient(135deg, var(--palette-hex-a5b4a3) 0%, var(--palette-hex-8fa38d) 100%)',
    '软件': 'linear-gradient(135deg, var(--palette-hex-b4a5a3) 0%, var(--palette-hex-a38f8d) 100%)',
    '会员': 'linear-gradient(135deg, var(--palette-hex-cfa76f) 0%, var(--palette-hex-c49a5f) 100%)',
    '点数': 'linear-gradient(135deg, var(--palette-hex-778d9c) 0%, var(--palette-hex-6a8090) 100%)',
    'default': 'linear-gradient(135deg, var(--palette-hex-d5d0c9) 0%, var(--palette-hex-c5c0b9) 100%)'
  }
  const category = product.categoryName || ''
  for (const [key, gradient] of Object.entries(colors)) {
    if (category.includes(key)) {
      return { background: gradient }
    }
  }
  return { background: colors.default }
}

// 处理图片加载错误
function handleImageError(_event, product) {
  const next = new Set(failedProductImages.value)
  next.add(getProductImageKey(product))
  failedProductImages.value = next
}

function fallbackCopyText(value) {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copied) throw new Error('复制失败')
}

async function copyProductId(product) {
  const productId = String(product?.id ?? '').trim()
  if (!productId) return
  try {
    let copied = false
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(productId)
        copied = true
      } catch {
        copied = false
      }
    }
    if (!copied) fallbackCopyText(productId)
    copiedProductId.value = productId
    if (copiedProductIdTimer) window.clearTimeout(copiedProductIdTimer)
    copiedProductIdTimer = window.setTimeout(() => {
      copiedProductId.value = ''
      copiedProductIdTimer = null
    }, 1400)
    toast.success('已复制物品ID')
  } catch {
    toast.error('复制失败，请稍后重试')
  }
}

function isProductIdCopied(product) {
  return copiedProductId.value === String(product?.id ?? '')
}

// 获取拒绝/下架原因
function getRejectReason(product) {
  const status = getProductStatus(product)
  const shouldShowReason = ['ai_rejected', 'manual_rejected', 'offline_manual'].includes(status)
  if (!shouldShowReason) return null

  const reason =
    product.statusReason
    || product.rejectReason
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

function getReasonLabel(product) {
  const status = getProductStatus(product)
  if (['ai_rejected', 'manual_rejected'].includes(status)) return '拒绝原因'
  if (status === 'offline_manual') return '下架原因'
  return '状态说明'
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
  sold: 2,
  expired: 3,
  disabled: 4
}

function normalizeCdkStatus(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (['locked', 'available', 'sold', 'expired', 'disabled'].includes(normalized)) {
    return normalized
  }
  return 'unknown'
}

function sortCdkListByStatus(list) {
  return [...(list || [])].sort((a, b) => {
    const statusA = normalizeCdkStatus(a?.status)
    const statusB = normalizeCdkStatus(b?.status)
    const priorityA = CDK_STATUS_PRIORITY[statusA] ?? 999
    const priorityB = CDK_STATUS_PRIORITY[statusB] ?? 999
    if (priorityA !== priorityB) return priorityA - priorityB

    const timeA = new Date(a?.createdAt || 0).getTime()
    const timeB = new Date(b?.createdAt || 0).getTime()
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
    sold: '已售出',
    expired: '已过期',
    disabled: '已停用',
    unknown: '未知状态'
  }
  return map[status] || map.unknown
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
    const result = await inventoryStore.fetchCdkList(currentProduct.value.id, { status: cdkStatusFilter.value })
    if (!result.success) throw new Error(result.error || '加载 CDK 列表失败')
    cdkList.value = sortCdkListByStatus(result.data.cdks || [])
    cdkStats.value = result.data.stats || { total: 0, available: 0, locked: 0, sold: 0 }
    if (result.data.sharedMode && currentProduct.value) {
      currentProduct.value.sharedCdkEnabled = true
    }
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
    icon: '',
    danger: true
  })

  if (!confirmed) return

  deletingCdkId.value = getCdkKey(cdk)
  const loadingId = toast.loading('正在删除 CDK...')

  try {
    const result = await inventoryStore.deleteCdk(currentProduct.value.id, cdk.id)
    if (!result.success) throw new Error(result.error || '删除 CDK 失败')
    cdkList.value = cdkList.value.filter(item => item.id !== cdk.id)
    toast.update(loadingId, { type: 'success', message: 'CDK 已删除' })

    // 更新库存
    const index = products.value.findIndex(p => p.id === currentProduct.value.id)
    if (index !== -1 && products.value[index].availableStock > 0) {
      products.value[index].availableStock--
    }
  } catch (error) {
    toast.update(loadingId, { type: 'error', message: '删除 CDK 失败' })
  } finally {
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
      title: '一键清空 CDK',
      icon: '',
      danger: true
    }
  )
  
  if (!confirmed) return
  
  clearingAllCdks.value = true
  const loadingId = toast.loading('正在清空 CDK...')
  
  try {
    const result = await inventoryStore.clearCdk(currentProduct.value.id)
    if (!result.success) throw new Error(result.error || '清空 CDK 失败')
    
    // 重新加载 CDK 列表和统计
    await loadCdkList()
    
    toast.update(loadingId, {
      type: 'success',
      message: `已清空 ${result.data?.deleted || availableCount} 个 CDK`
    })
    
    // 更新产品库存
    const index = products.value.findIndex(p => p.id === currentProduct.value.id)
    if (index !== -1) {
      products.value[index].availableStock = 0
      products.value[index].stock = result.data?.stock || 0
    }
  } catch (error) {
    console.error('Clear CDK error:', error)
    toast.update(loadingId, {
      type: 'error',
      message: '清空 CDK 失败: ' + (error.message || '未知错误')
    })
  } finally {
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
  if (isProcessingProduct(product, 'offline')) return '下架中...'
  if (isProcessingProduct(product, 'online')) return '上架中...'
  return isProductActive(product) ? '下架' : '重新上架'
}

function getDeleteLabel(product) {
  return isProcessingProduct(product, 'delete') ? '删除中...' : '删除'
}

onMounted(() => {
  loadProducts()
})

onUnmounted(() => {
  if (copiedProductIdTimer) window.clearTimeout(copiedProductIdTimer)
})

watch(
  () => [route.query.search, route.query.status, route.query.type, route.query.stock, route.query.sort].join('|'),
  syncProductFiltersFromRoute,
  { immediate: true }
)
</script>

<style scoped>
.product-filter-banner {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding: 8px 12px 8px 16px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  color: var(--text-secondary);
  background: var(--bg-card);
  font-size: 13px;
}

.product-filter-banner button {
  min-height: 44px;
  padding: 0 12px;
  border-radius: 8px;
  color: var(--color-primary);
  font-weight: 600;
}

.my-products-page {
  min-height: 100vh;
  padding-bottom: 80px;
  background: var(--bg-primary);
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
  background: var(--palette-hex-8fa38d);
  color: var(--palette-hex-ffffff);
  border-radius: 24px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: color var(--motion-duration-standard) var(--motion-ease-emphasized), background-color var(--motion-duration-standard) var(--motion-ease-emphasized), border-color var(--motion-duration-standard) var(--motion-ease-emphasized), box-shadow var(--motion-duration-standard) var(--motion-ease-emphasized), opacity var(--motion-duration-standard) var(--motion-ease-emphasized), transform var(--motion-duration-standard) var(--motion-ease-emphasized);
  box-shadow: 0 2px 8px var(--palette-rgba-143-163-141-0p3);
}

.add-btn:hover {
  background: var(--palette-hex-7a8f78);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--palette-rgba-143-163-141-0p4);
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
  color: var(--palette-hex-ffffff);
  border-radius: 12px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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
  box-shadow: 0 2px 8px var(--palette-rgba-0-0-0-0p06);
  overflow: hidden;
  transition: color var(--motion-duration-standard) var(--motion-ease-emphasized), background-color var(--motion-duration-standard) var(--motion-ease-emphasized), border-color var(--motion-duration-standard) var(--motion-ease-emphasized), box-shadow var(--motion-duration-standard) var(--motion-ease-emphasized), opacity var(--motion-duration-standard) var(--motion-ease-emphasized), transform var(--motion-duration-standard) var(--motion-ease-emphasized);
  border: 1px solid var(--border-light);
  isolation: isolate;
}

.product-card:hover {
  box-shadow: 0 8px 24px var(--palette-rgba-0-0-0-0p1);
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
  background: linear-gradient(180deg, var(--palette-hex-52c41a) 0%, var(--palette-hex-73d13d) 100%);
}

.product-card.pending_ai::before,
.product-card.pending::before {
  background: linear-gradient(180deg, var(--palette-hex-faad14) 0%, var(--palette-hex-ffc53d) 100%);
}

.product-card.pending_manual::before {
  background: linear-gradient(180deg, var(--palette-hex-f59e0b) 0%, var(--palette-hex-fbbf24) 100%);
}

.product-card.ai_rejected::before,
.product-card.manual_rejected::before,
.product-card.rejected::before {
  background: linear-gradient(180deg, var(--palette-hex-ff4d4f) 0%, var(--palette-hex-ff7875) 100%);
}

.product-card.offline_manual::before,
.product-card.offline::before,
.product-card.inactive::before {
  background: linear-gradient(180deg, var(--palette-hex-8c8c8c) 0%, var(--palette-hex-bfbfbf) 100%);
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
  box-shadow: 0 2px 8px var(--palette-rgba-0-0-0-0p08);
}

.status-badge.ai_approved,
.status-badge.manual_approved,
.status-badge.approved,
.status-badge.active {
  background: linear-gradient(135deg, var(--palette-rgba-82-196-26-0p15) 0%, var(--palette-rgba-115-209-61-0p2) 100%);
  color: var(--palette-hex-389e0d);
  border: 1px solid var(--palette-rgba-82-196-26-0p3);
}

.status-badge.pending_ai,
.status-badge.pending {
  background: linear-gradient(135deg, var(--palette-rgba-250-173-20-0p15) 0%, var(--palette-rgba-255-197-61-0p2) 100%);
  color: var(--palette-hex-d48806);
  border: 1px solid var(--palette-rgba-250-173-20-0p3);
}

.status-badge.pending_manual {
  background: linear-gradient(135deg, var(--palette-rgba-245-158-11-0p15) 0%, var(--palette-rgba-251-191-36-0p2) 100%);
  color: var(--palette-hex-b45309);
  border: 1px solid var(--palette-rgba-245-158-11-0p3);
}

.status-badge.ai_rejected,
.status-badge.manual_rejected,
.status-badge.rejected {
  background: linear-gradient(135deg, var(--palette-rgba-255-77-79-0p15) 0%, var(--palette-rgba-255-120-117-0p2) 100%);
  color: var(--palette-hex-cf1322);
  border: 1px solid var(--palette-rgba-255-77-79-0p3);
}

.status-badge.offline_manual,
.status-badge.offline,
.status-badge.inactive {
  background: linear-gradient(135deg, var(--palette-rgba-140-140-140-0p1) 0%, var(--palette-rgba-191-191-191-0p15) 100%);
  color: var(--palette-hex-595959);
  border: 1px solid var(--palette-rgba-140-140-140-0p2);
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
  background: var(--bg-tertiary);
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

/* 物品 ID 行 */
.product-id-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.product-id {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.id-label {
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--text-tertiary);
}

.id-value {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.copy-id-btn {
  padding: 2px 6px;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  opacity: 0.55;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.copy-id-btn:hover {
  opacity: 1;
  background: var(--bg-tertiary);
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
  background: linear-gradient(135deg, var(--palette-hex-f6ffed) 0%, var(--palette-hex-d9f7be) 100%);
  color: var(--palette-hex-389e0d);
  border: 1px solid var(--palette-hex-b7eb8f);
}

.tag.type.normal {
  background: linear-gradient(135deg, var(--palette-hex-eff6ff) 0%, var(--palette-hex-dbeafe) 100%);
  color: var(--palette-hex-1d4ed8);
  border: 1px solid var(--palette-hex-93c5fd);
}

.tag.type.link {
  background: linear-gradient(135deg, var(--palette-hex-fff7ed) 0%, var(--palette-hex-ffedd5) 100%);
  color: var(--palette-hex-c2410c);
  border: 1px solid var(--palette-hex-fdba74);
}

/* 拒绝/下架原因 */
.reject-reason {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, var(--palette-hex-fef3e2) 0%, var(--palette-hex-fef9f3) 100%);
  border-top: 1px solid var(--palette-hex-f5dbb8);
  border-radius: 0 0 14px 14px;
}

.reason-icon {
  flex-shrink: 0;
  font-size: 16px;
  line-height: 1.4;
}

.reason-text {
  font-size: 13px;
  color: var(--palette-hex-8b5a2b);
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
  transition: color var(--motion-duration-standard) var(--motion-ease-emphasized), background-color var(--motion-duration-standard) var(--motion-ease-emphasized), border-color var(--motion-duration-standard) var(--motion-ease-emphasized), box-shadow var(--motion-duration-standard) var(--motion-ease-emphasized), opacity var(--motion-duration-standard) var(--motion-ease-emphasized), transform var(--motion-duration-standard) var(--motion-ease-emphasized);
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
  background: linear-gradient(135deg, var(--palette-hex-e6f7ff) 0%, var(--palette-hex-bae7ff) 100%);
  border-color: var(--palette-hex-1890ff);
  color: var(--palette-hex-1890ff);
}

.action-btn.cdk {
  background: linear-gradient(135deg, var(--palette-hex-f6ffed) 0%, var(--palette-hex-d9f7be) 100%);
  border-color: var(--palette-hex-b7eb8f);
  color: var(--palette-hex-52c41a);
}

.action-btn.cdk:hover {
  border-color: var(--palette-hex-52c41a);
  box-shadow: 0 2px 6px var(--palette-rgba-82-196-26-0p2);
}

.action-btn.offline:hover {
  background: linear-gradient(135deg, var(--palette-hex-fffbe6) 0%, var(--palette-hex-fff1b8) 100%);
  border-color: var(--palette-hex-faad14);
  color: var(--palette-hex-d48806);
}

.action-btn.online {
  background: linear-gradient(135deg, var(--palette-hex-f6ffed) 0%, var(--palette-hex-d9f7be) 100%);
  border-color: var(--palette-hex-b7eb8f);
  color: var(--palette-hex-52c41a);
}

.action-btn.online:hover {
  border-color: var(--palette-hex-52c41a);
  box-shadow: 0 2px 6px var(--palette-rgba-82-196-26-0p2);
}

.action-btn.delete:hover {
  background: linear-gradient(135deg, var(--palette-hex-fff2f0) 0%, var(--palette-hex-ffccc7) 100%);
  border-color: var(--palette-hex-ff4d4f);
  color: var(--palette-hex-cf1322);
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
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.load-more-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
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
  background: var(--bg-tertiary);
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
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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
  background: var(--bg-tertiary);
  border-radius: 12px;
}

.stat-item.available {
  background: var(--color-success-light);
}

.stat-item.available .stat-value {
  color: var(--color-success);
}

.stat-item.locked {
  background: var(--palette-hex-fff7e6);
}

.stat-item.locked .stat-value {
  color: var(--palette-hex-d48806);
}

.stat-item.sold {
  background: var(--bg-tertiary);
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
  background: var(--palette-hex-dbeafe);
  color: var(--palette-hex-1d4ed8);
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.export-btn:hover:not(:disabled) {
  background: var(--palette-hex-bfdbfe);
}

.clear-all-btn {
  flex: 1;
  padding: 8px 14px;
  border: 1px solid var(--palette-hex-dc2626);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--palette-hex-dc2626);
  background: var(--palette-hex-fef2f2);
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.clear-all-btn:hover:not(:disabled) {
  background: var(--palette-hex-dc2626);
  color: var(--palette-hex-ffffff);
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
  background: var(--bg-tertiary);
}

.cdk-item.available {
  background: var(--color-success-light);
}

.cdk-item.locked {
  background: var(--palette-hex-fff7e6);
}

.cdk-item.sold {
  background: var(--bg-tertiary);
}

.cdk-item.expired,
.cdk-item.disabled,
.cdk-item.unknown {
  background: var(--bg-tertiary);
}

.cdk-item.sold .cdk-code,
.cdk-item.expired .cdk-code,
.cdk-item.disabled .cdk-code {
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
  background: var(--palette-hex-fff7e6);
  color: var(--palette-hex-d48806);
}

.cdk-status.sold {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

.cdk-status.expired,
.cdk-status.disabled,
.cdk-status.unknown {
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
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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
  background: var(--bg-tertiary);
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

.add-count.limit-error {
  color: var(--color-danger, var(--palette-hex-e74c3c));
}

.add-quota-hint {
  font-size: 13px;
  color: var(--text-secondary);
}

.add-btn-primary {
  padding: 10px 24px;
  background: var(--color-primary);
  border: none;
  border-radius: 10px;
  font-size: 14px;
  color: var(--palette-hex-ffffff);
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.add-btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.add-btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.seller-primary-button,
.seller-secondary-button {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 15px;
  border: 1px solid var(--seller-border);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
}
.seller-primary-button { color: var(--palette-hex-ffffff); border-color: var(--seller-navy); background: var(--seller-navy); }
.seller-secondary-button { color: var(--seller-muted); background: var(--seller-surface); }
.product-search { min-width: min(100%, 280px); height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 12px; border: 1px solid var(--seller-border); border-radius: 10px; color: var(--seller-muted); background: var(--seller-surface); }
.product-search:focus-within { border-color: var(--seller-jade); box-shadow: 0 0 0 3px color-mix(in srgb, var(--seller-jade) 18%, transparent); }
.product-search input { min-width: 0; width: 100%; border: 0; outline: 0; color: var(--seller-ink); background: transparent; font-size: 14px; }
.seller-filter-field { min-height: 44px; display: flex; align-items: center; gap: 7px; padding: 0 10px; border: 1px solid var(--seller-border); border-radius: 10px; color: var(--seller-muted); background: var(--seller-surface); font-size: 12px; }
.seller-filter-field select { min-width: 88px; border: 0; outline: 0; color: var(--seller-ink); background: transparent; font-size: 13px; }
.seller-filter-chip, .seller-result-count { min-height: 30px; display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; color: var(--seller-muted); background: var(--seller-jade-soft); font-size: 12px; }
.seller-result-count { margin-left: auto; background: transparent; font-variant-numeric: tabular-nums; }
.seller-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.product-ledger-main { min-width: 0; width: 100%; display: grid; grid-template-columns: 54px minmax(0, 1fr); align-items: center; gap: 11px; color: inherit; text-align: left; }
.product-ledger-image { width: 54px; height: 48px; display: grid; place-items: center; overflow: hidden; padding: 0; border: 1px solid var(--seller-border); border-radius: 9px; color: var(--seller-muted); background-color: var(--seller-surface-soft); background-size: cover; background-position: center; cursor: pointer; transition: border-color 160ms ease, box-shadow 160ms ease; }
.product-ledger-image img { width: 100%; height: 100%; object-fit: cover; }
.product-ledger-copy { min-width: 0; }
.product-ledger-name { max-width: 100%; display: block; padding: 0; border: 0; color: var(--seller-ink); background: transparent; text-align: left; cursor: pointer; }
.product-ledger-name strong { display: block; overflow: hidden; color: var(--seller-ink); font-size: 13px; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
.product-ledger-name:hover strong { color: color-mix(in srgb, var(--seller-jade) 76%, var(--seller-ink)); }
.product-ledger-image:hover { border-color: var(--seller-jade); box-shadow: 0 0 0 3px color-mix(in srgb, var(--seller-jade) 12%, transparent); }
.product-ledger-image:focus-visible,
.product-ledger-name:focus-visible,
.product-id-badge:focus-visible { outline: 3px solid color-mix(in srgb, var(--seller-jade) 52%, transparent); outline-offset: 2px; }
.product-ledger-badges { min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 7px; }
.product-id-badge,
.product-archive-badge { min-width: 0; min-height: 24px; display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border: 1px solid var(--seller-border); border-radius: 7px; font-size: 10px; font-weight: 650; line-height: 1; white-space: nowrap; }
.product-id-badge { position: relative; max-width: 100%; color: var(--seller-muted); background: var(--seller-surface-soft); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; cursor: copy; transition: color 160ms ease, border-color 160ms ease, background 160ms ease; }
.product-id-badge > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.product-id-badge:hover { color: var(--seller-ink); border-color: var(--seller-jade); background: var(--seller-jade-soft); }
.product-id-badge.copied { color: var(--palette-hex-54745e); border-color: color-mix(in srgb, var(--seller-jade) 48%, var(--seller-border)); background: var(--seller-jade-soft); }
.product-archive-badge > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.product-archive-badge.category { max-width: 96px; color: var(--seller-muted); background: color-mix(in srgb, var(--seller-paper) 56%, var(--seller-surface-soft)); }
.product-archive-badge.type-normal { color: var(--palette-hex-557388); border-color: color-mix(in srgb, var(--palette-hex-557388) 27%, var(--seller-border)); background: color-mix(in srgb, var(--palette-hex-557388) 8%, var(--seller-surface)); }
.product-archive-badge.type-cdk { color: var(--palette-hex-54745e); border-color: color-mix(in srgb, var(--seller-jade) 36%, var(--seller-border)); background: var(--seller-jade-soft); }
.product-archive-badge.type-link { color: var(--seller-warning); border-color: color-mix(in srgb, var(--seller-warning) 34%, var(--seller-border)); background: color-mix(in srgb, var(--seller-warning) 8%, var(--seller-surface)); }
.product-archive-badge.type-store { color: var(--palette-hex-755e88); border-color: color-mix(in srgb, var(--palette-hex-755e88) 28%, var(--seller-border)); background: color-mix(in srgb, var(--palette-hex-755e88) 8%, var(--seller-surface)); }
.ledger-status-cell { min-width: 0; }
.ledger-price { min-width: 0; display: grid; gap: 6px; }
.ledger-price-current { display: flex; align-items: baseline; gap: 4px; font-variant-numeric: tabular-nums; }
.ledger-price-current strong { color: var(--seller-ink); font: 750 15px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ledger-price-current small { color: var(--seller-muted); font-size: 9px; font-weight: 700; letter-spacing: .05em; }
.ledger-price.discounted .ledger-price-current strong { color: var(--seller-danger); }
.ledger-price-meta { min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
.ledger-price-original { color: var(--seller-muted); font-size: 10px; white-space: nowrap; }
.ledger-price-original del { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.ledger-discount-badge { min-height: 20px; display: inline-flex; align-items: center; padding: 2px 6px; border: 1px solid color-mix(in srgb, var(--seller-danger) 25%, var(--seller-border)); border-radius: 999px; color: var(--seller-danger); background: color-mix(in srgb, var(--seller-danger) 7%, var(--seller-surface)); font-size: 9px; font-weight: 750; white-space: nowrap; }
.ledger-discount-badge.muted { color: var(--seller-muted); border-color: var(--seller-border); background: var(--seller-surface-soft); }
.ledger-number, .ledger-unit { display: block; font-variant-numeric: tabular-nums; }
.ledger-number { color: var(--seller-ink); font: 700 14px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ledger-number.is-warning { color: var(--seller-warning); }
.ledger-unit { margin-top: 5px; color: var(--seller-muted); font-size: 10px; }
.ledger-muted { color: var(--seller-muted); font-size: 12px; }
.product-mobile-head { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 10px; }
.product-mobile-head > .seller-status-badge { flex: 0 0 auto; }
.product-mobile-reason { display: grid; grid-template-columns: 16px minmax(0, 1fr); align-items: start; gap: 8px; margin: 12px 0 0; padding: 10px 12px; border-left: 3px solid var(--seller-danger); color: var(--seller-danger); background: color-mix(in srgb, var(--seller-danger) 7%, transparent); font-size: 12px; line-height: 1.55; }
.product-mobile-reason strong { display: block; font-size: 11px; letter-spacing: .03em; }
.product-mobile-reason p { margin: 3px 0 0; overflow-wrap: anywhere; color: var(--seller-ink); white-space: pre-wrap; }
.product-mobile-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 15px 0 0; }
.product-mobile-metrics div { padding: 10px; border-radius: 9px; background: var(--seller-surface-soft); }
.product-mobile-metrics dt { color: var(--seller-muted); font-size: 10px; }
.product-mobile-metrics dd { margin: 4px 0 0; color: var(--seller-ink); font: 650 12px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; }
.product-mobile-metrics .metric-price { grid-column: 1 / -1; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 12px; }
.product-mobile-metrics .metric-price dd { min-width: 0; margin: 0; display: flex; flex-wrap: wrap; align-items: baseline; justify-content: flex-end; gap: 5px 8px; }
.mobile-price-current { color: var(--seller-ink); font-size: 15px; font-weight: 750; }
.mobile-price-current.discounted { color: var(--seller-danger); }
.mobile-price-current small { color: var(--seller-muted); font-size: 9px; }
.mobile-price-compare { color: var(--seller-muted); font-size: 10px; font-weight: 550; }
.mobile-price-compare em { margin-left: 6px; padding: 2px 6px; border-radius: 999px; color: var(--seller-danger); background: color-mix(in srgb, var(--seller-danger) 8%, var(--seller-surface)); font-style: normal; font-weight: 750; }
.my-products-page :deep(tbody > tr:not(.seller-expanded-row)) { height: 82px; }
:global(html.dark) .product-id-badge.copied,
:global(html.dark) .product-archive-badge.type-cdk { color: var(--palette-hex-a4c8ad); }
:global(html.dark) .product-archive-badge.type-normal { color: var(--palette-hex-9ebed1); }
:global(html.dark) .product-archive-badge.type-store { color: var(--palette-hex-c2a9d4); }
.seller-empty-ledger { display: grid; justify-items: center; gap: 8px; color: var(--seller-muted); }
.seller-empty-ledger strong { color: var(--seller-ink); font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif; font-size: 18px; }
.seller-empty-ledger p { margin: 0 0 8px; font-size: 13px; }
.export-btn { display: inline-flex; align-items: center; gap: 6px; }

@media (max-width: 767px) {
  .product-search, .seller-filter-field { width: 100%; }
  .seller-filter-field select { flex: 1; }
  .seller-result-count { margin-left: 0; }
  .product-ledger-image { width: 52px; height: 52px; }
  .product-ledger-main { grid-template-columns: 52px minmax(0, 1fr); gap: 10px; }
  .product-ledger-name { min-height: 44px; display: flex; align-items: center; }
  .product-id-badge,
  .product-archive-badge { min-height: 26px; }
  /* 视觉高度与标签一致，命中区域向外扩到 44px 触控目标。 */
  .product-id-badge::after { content: ""; position: absolute; inset: -9px; }
}

@media (min-width: 768px) and (max-width: 1199px) {
  .my-products-page :deep(th),
  .my-products-page :deep(td) { padding-right: 8px; padding-left: 8px; }
}

@media (max-width: 420px) {
  .product-mobile-head { grid-template-columns: minmax(0, 1fr); }
  .product-mobile-head > .seller-status-badge { justify-self: start; margin-left: 62px; }
}

/* Mobile */
@media (max-width: 640px) {
  .page-header {
    margin-bottom: 12px;
    padding-bottom: 10px;
  }

  .page-title {
    font-size: 20px;
  }

  .add-btn {
    padding: 8px 14px;
    font-size: 13px;
  }

  .products-list {
    gap: 10px;
  }

  .product-card {
    border-radius: 14px;
  }

  .product-main {
    gap: 10px;
    padding: 10px;
  }

  .product-image {
    width: 64px;
    height: 64px;
    border-radius: 10px;
  }

  .image-placeholder {
    font-size: 26px;
  }

  .type-badge {
    width: 20px;
    height: 20px;
    font-size: 10px;
    border-radius: 5px;
  }

  .product-info {
    padding-right: 50px;
  }

  .product-name {
    font-size: 14px;
  }

  .product-desc {
    font-size: 12px;
    margin-bottom: 6px;
  }

  .product-id-row {
    margin-bottom: 4px;
  }

  .id-value {
    font-size: 11px;
  }

  .copy-id-btn {
    font-size: 11px;
    padding: 2px 4px;
  }

  .product-meta {
    gap: 3px;
    font-size: 12px;
    margin-bottom: 6px;
  }

  .price-value {
    font-size: 14px;
  }

  .price-unit {
    font-size: 11px;
  }

  .status-badge {
    top: 8px;
    right: 8px;
    padding: 3px 8px;
    font-size: 11px;
    gap: 3px;
  }

  .status-icon {
    font-size: 10px;
  }

  .product-tags {
    gap: 4px;
  }

  .tag {
    padding: 2px 7px;
    font-size: 10px;
  }

  .reject-reason {
    padding: 8px 10px;
    gap: 6px;
  }

  .reason-icon {
    font-size: 14px;
  }

  .reason-text {
    font-size: 12px;
  }

  .product-actions {
    padding: 8px 10px;
    gap: 6px;
  }

  .action-btn {
    padding: 6px 10px;
    font-size: 12px;
  }

  /* CDK modal mobile */
  .modal-content {
    max-width: 100%;
    max-height: 90vh;
    border-radius: 16px;
  }

  .modal-header {
    padding: 12px 14px;
  }

  .modal-title {
    font-size: 16px;
  }

  .modal-body {
    padding: 14px;
  }

  .cdk-stats {
    gap: 8px;
  }

  .stat-item {
    padding: 8px;
  }

  .stat-value {
    font-size: 16px;
  }

  .cdk-filter {
    gap: 8px;
    flex-wrap: wrap;
  }

  .clear-all-btn {
    flex: 0 0 100%;
  }
}

.cdk-modal {
  max-width: 720px;
  border: 1px solid var(--seller-border);
  border-radius: 14px;
  background: var(--seller-surface);
  box-shadow: var(--seller-shadow-md);
}

.cdk-modal .modal-header {
  padding: 18px 20px 14px;
  border-top: 4px solid var(--seller-jade);
  border-bottom-color: var(--seller-border);
  background: var(--seller-surface);
}

.cdk-modal .modal-title {
  color: var(--seller-ink);
  font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif;
}

.cdk-modal .modal-subtitle { color: var(--seller-muted); }
.cdk-modal .modal-close { color: var(--seller-muted); background: var(--seller-surface-muted); }
.cdk-modal .cdk-stats,
.cdk-modal .cdk-item,
.cdk-modal .cdk-add { border-color: var(--seller-border); background: var(--seller-surface-muted); }
.cdk-modal .filter-select,
.cdk-modal .cdk-input { border-color: var(--seller-border); background: var(--seller-surface-strong); color: var(--seller-ink); }
.cdk-modal .add-btn-primary { border-radius: 9px; background: var(--seller-navy); }

@media (max-width: 767px) {
  .cdk-modal { max-width: 100%; max-height: 92dvh; }
}
</style>
