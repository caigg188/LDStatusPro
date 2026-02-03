<template>
  <div class="order-detail-page">
    <div class="page-container">
      <!-- 加载中 -->
      <div v-if="loading" class="loading-state">
        <div class="skeleton-card large">
          <div class="skeleton skeleton-line w-48"></div>
          <div class="skeleton skeleton-line w-full mt-4"></div>
          <div class="skeleton skeleton-line w-32 mt-2"></div>
        </div>
      </div>
      
      <!-- 订单不存在 -->
      <EmptyState
        v-else-if="!order"
        icon="🔍"
        title="订单不存在"
        description="无法找到该订单信息"
      >
        <router-link to="/user/orders" class="back-btn">
          返回订单列表
        </router-link>
      </EmptyState>
      
      <!-- 订单详情 -->
      <template v-else>
        <!-- 订单状态卡片 -->
        <div :class="['status-card', getStatusClass(order.status)]">
          <div class="status-icon">{{ getStatusIcon(order.status) }}</div>
          <div class="status-text">{{ getStatusText(order.status) }}</div>
          <div class="status-time" v-if="order.created_at || order.createdAt">
            {{ formatDateTime(order.created_at || order.createdAt) }}
          </div>
        </div>
        
        <!-- 商品信息 -->
        <div class="info-card">
          <h3 class="card-title">商品信息</h3>
          
          <div class="info-row">
            <span class="info-label">商品名称</span>
            <span class="info-value">{{ order.product?.name || order.product_name || order.productName }}</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">商品类型</span>
            <span class="info-value">
              <span :class="['type-badge', getProductType(order)]">
                {{ getOrderTypeText(getProductType(order)) }}
              </span>
            </span>
          </div>
          
          <div class="info-row" v-if="order.original_price && order.original_price !== order.amount">
            <span class="info-label">原价</span>
            <span class="info-value original-price">{{ order.original_price }} LDC</span>
          </div>
          
          <div class="info-row amount">
            <span class="info-label">实付积分</span>
            <span class="info-value price">{{ order.amount || order.total_price }} LDC</span>
          </div>
        </div>
        
        <!-- 交易双方信息 -->
        <div class="info-card">
          <h3 class="card-title">交易信息</h3>
          
          <div class="info-row">
            <span class="info-label">卖家</span>
            <span class="info-value user-info">
              <a :href="'https://linux.do/u/' + (order.seller_username || '')" target="_blank" rel="noopener" class="user-link">
                @{{ order.seller_username || '未知' }}
              </a>
            </span>
          </div>
          
          <div class="info-row">
            <span class="info-label">买家</span>
            <span class="info-value user-info">
              <a :href="'https://linux.do/u/' + (order.buyer_username || '')" target="_blank" rel="noopener" class="user-link">
                @{{ order.buyer_username || '未知' }}
              </a>
            </span>
          </div>
          
          <div class="info-row" v-if="order.delivery_type">
            <span class="info-label">发货方式</span>
            <span class="info-value">{{ order.delivery_type === 'auto' ? '🤖 自动发货' : '👤 手动发货' }}</span>
          </div>
        </div>
        
        <!-- CDK 信息 -->
        <div class="info-card" v-if="getProductType(order) === 'cdk' && getCdkContent(order)">
          <h3 class="card-title">🔑 CDK 密钥</h3>
          
          <div class="cdk-box">
            <code class="cdk-code">{{ showCdk ? getCdkContent(order) : '••••••••••••' }}</code>
            <div class="cdk-actions">
              <button class="icon-btn" @click="showCdk = !showCdk">
                {{ showCdk ? '🙈' : '👁️' }}
              </button>
              <button class="icon-btn" @click="copyCdk">📋</button>
            </div>
          </div>
        </div>
        
        <!-- CDK 使用说明（显示商品描述） -->
        <div class="info-card" v-if="getProductType(order) === 'cdk' && getProductDescription(order)">
          <h3 class="card-title">📝 使用说明</h3>
          <div class="description-content">{{ getProductDescription(order) }}</div>
        </div>
        
        <!-- 链接信息 -->
        <div class="info-card" v-if="getProductType(order) === 'link' && order.link">
          <h3 class="card-title">商品链接</h3>
          
          <div class="link-box">
            <a :href="order.link" target="_blank" rel="noopener" class="link-url">
              {{ order.link }}
            </a>
            <button class="icon-btn" @click="copyLink">📋</button>
          </div>
        </div>
        
        <!-- 寄存信息 -->
        <div class="info-card" v-if="getProductType(order) === 'store'">
          <h3 class="card-title">寄存信息</h3>
          
          <div class="store-info">
            <p class="store-notice">
              请联系卖家获取寄存物品详情
            </p>
            <div class="info-row" v-if="order.seller_username || order.sellerUsername">
              <span class="info-label">卖家用户名</span>
              <span class="info-value">@{{ order.seller_username || order.sellerUsername }}</span>
            </div>
          </div>
        </div>
        
        <!-- 订单信息 -->
        <div class="info-card">
          <h3 class="card-title">订单信息</h3>
          
          <div class="info-row">
            <span class="info-label">订单号</span>
            <span class="info-value mono">{{ order.order_no || order.orderNo || order.id }}</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">创建时间</span>
            <span class="info-value">{{ formatDateTime(order.created_at || order.createdAt) }}</span>
          </div>
          
          <div class="info-row" v-if="order.paid_at || order.paidAt">
            <span class="info-label">支付时间</span>
            <span class="info-value">{{ formatDateTime(order.paid_at || order.paidAt) }}</span>
          </div>
          
          <div class="info-row" v-if="order.delivered_at">
            <span class="info-label">发货时间</span>
            <span class="info-value">{{ formatDateTime(order.delivered_at) }}</span>
          </div>
          
          <div class="info-row" v-if="order.completed_at || order.completedAt">
            <span class="info-label">完成时间</span>
            <span class="info-value">{{ formatDateTime(order.completed_at || order.completedAt) }}</span>
          </div>
          
          <div class="info-row" v-if="order.ldc_trade_no">
            <span class="info-label">LDC交易号</span>
            <span class="info-value mono">{{ order.ldc_trade_no }}</span>
          </div>
        </div>
        
        <!-- 订单日志 -->
        <div class="info-card" v-if="orderLogs && orderLogs.length > 0">
          <h3 class="card-title">订单动态</h3>
          
          <div class="order-logs">
            <div class="log-item" v-for="(log, index) in orderLogs" :key="index">
              <div class="log-icon">{{ getLogIcon(log.action) }}</div>
              <div class="log-content">
                <div class="log-action">{{ getLogText(log) }}</div>
                <div class="log-time">{{ formatDateTime(log.created_at) }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div class="actions" v-if="showActions">
          <div class="actions-row">
            <button 
              v-if="order.status === 'pending'" 
              class="cancel-btn full-width" 
              @click="handleCancelOrder"
              :disabled="cancelling"
            >
              {{ cancelling ? '取消中...' : '取消订单' }}
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import EmptyState from '@/components/common/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const shopStore = useShopStore()
const toast = useToast()
const dialog = useDialog()

const loading = ref(true)
const order = ref(null)
const orderLogs = ref([])
const showCdk = ref(false)
const cancelling = ref(false)

// 当前用户角色（买家/卖家）
const currentRole = computed(() => route.query.role || 'buyer')

// 是否显示操作按钮区域（买家和卖家都可以取消待支付订单）
const showActions = computed(() => {
  return order.value?.status === 'pending'
})

// 获取商品类型
function getProductType(orderData) {
  return orderData?.product_type || orderData?.product?.product_type || orderData?.productType || 'cdk'
}

// 获取CDK内容（处理多种可能的字段名）
function getCdkContent(orderData) {
  return orderData?.cdk || orderData?.delivery_content || orderData?.deliveryContent || ''
}

// 获取商品描述（使用说明）
function getProductDescription(orderData) {
  // 从商品快照或直接字段获取描述
  return orderData?.product?.description || 
         orderData?.productDescription || 
         orderData?.product_description || 
         ''
}

// 加载订单详情
async function loadOrder() {
  try {
    loading.value = true
    const orderId = route.params.id
    const role = route.query.role || 'buyer'
    const result = await shopStore.fetchOrderDetail(orderId, role)
    // 解包可能嵌套的数据
    order.value = result?.order || result?.data?.order || result
    // 订单日志
    orderLogs.value = result?.logs || result?.data?.logs || []
  } catch (error) {
    toast.error('加载订单详情失败')
  } finally {
    loading.value = false
  }
}

// 日志图标
function getLogIcon(action) {
  const map = {
    create: '📝',
    pay: '💰',
    deliver: '📦',
    refund: '↩️',
    cancel: '❌',
    expire: '⏰',
    lock_cdk: '🔒',
    unlock_cdk: '🔓'
  }
  return map[action] || '📋'
}

// 日志文字
function getLogText(log) {
  const actionMap = {
    create: '创建订单',
    pay: '支付成功',
    deliver: '发货完成',
    refund: '订单退款',
    cancel: '取消订单',
    expire: '订单过期',
    lock_cdk: '锁定CDK',
    unlock_cdk: '释放CDK'
  }
  const actionText = actionMap[log.action] || log.action
  const operator = log.operator_name || log.operator_type || ''
  return operator ? `${actionText} (${operator})` : actionText
}

// 状态文字
function getStatusText(status) {
  const map = {
    pending: '待支付',
    paid: '已支付',
    completed: '已完成',
    cancelled: '已取消',
    refunded: '已退款',
    delivered: '已发货'
  }
  return map[status] || status || '未知'
}

// 状态图标
function getStatusIcon(status) {
  const map = {
    pending: '⏳',
    paid: '✅',
    completed: '🎉',
    cancelled: '❌',
    refunded: '↩️',
    delivered: '📦'
  }
  return map[status] || '📋'
}

// 状态样式
function getStatusClass(status) {
  const map = {
    pending: 'status-pending',
    paid: 'status-success',
    completed: 'status-success',
    cancelled: 'status-cancelled',
    refunded: 'status-refunded',
    delivered: 'status-info'
  }
  return map[status] || ''
}

// 订单类型
function getOrderTypeText(type) {
  const map = {
    cdk: 'CDK',
    link: '链接',
    store: '寄存'
  }
  return map[type] || type || '未知'
}

// 格式化日期时间
function formatDateTime(date) {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  const second = String(d.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

// 复制 CDK
function copyCdk() {
  const content = getCdkContent(order.value)
  if (content) {
    navigator.clipboard.writeText(content)
    toast.success('CDK 已复制')
  }
}

// 复制链接
function copyLink() {
  if (order.value?.link) {
    navigator.clipboard.writeText(order.value.link)
    toast.success('链接已复制')
  }
}

// 取消订单
async function handleCancelOrder() {
  const productName = order.value?.product?.name || order.value?.product_name || '该商品'
  const confirmed = await dialog.confirm(`确定要取消订单「${productName}」吗？`, {
    title: '取消订单',
    confirmText: '确定取消',
    cancelText: '再想想'
  })
  
  if (!confirmed) return
  
  try {
    cancelling.value = true
    const orderNo = order.value?.order_no || order.value?.orderNo
    await shopStore.cancelOrder(orderNo)
    toast.success('订单已取消')
    // 返回订单列表
    router.push('/user/orders')
  } catch (error) {
    toast.error(error.message || '取消失败')
  } finally {
    cancelling.value = false
  }
}

onMounted(() => {
  loadOrder()
})
</script>

<style scoped>
.order-detail-page {
  min-height: 100vh;
  padding-bottom: 100px;
  background: var(--bg-primary);
}

.page-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
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
  border: 1px solid var(--border-light);
}

.skeleton-card.large {
  min-height: 200px;
}

.skeleton {
  background: var(--skeleton-gradient);
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

/* 状态卡片 */
.status-card {
  text-align: center;
  padding: 32px;
  border-radius: 20px;
  margin-bottom: 16px;
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.status-card.status-pending {
  background: var(--color-warning-bg);
}

.status-card.status-success {
  background: var(--color-success-bg);
}

.status-card.status-info {
  background: var(--color-info-bg);
}

.status-card.status-cancelled {
  background: var(--bg-secondary);
}

.status-card.status-refunded {
  background: var(--color-danger-bg);
}

.status-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.status-text {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.status-time {
  font-size: 14px;
  color: var(--text-tertiary);
}

/* 信息卡片 */
.info-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-tertiary);
  margin: 0 0 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);
}

.info-row:last-child {
  border-bottom: none;
}

.info-row.amount {
  padding-top: 16px;
  margin-top: 8px;
  border-top: 1px dashed var(--border-medium);
  border-bottom: none;
}

.info-label {
  font-size: 14px;
  color: var(--text-tertiary);
}

.info-value {
  font-size: 14px;
  color: var(--text-primary);
  max-width: 60%;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info-value.mono {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
}

.info-value.price {
  font-size: 20px;
  font-weight: 700;
  color: #cfa76f;
}

/* 类型标签 */
.type-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.type-badge.cdk {
  background: #e8f5e8;
  color: #5a8c5a;
}

.type-badge.link {
  background: #e8f0f5;
  color: #778d9c;
}

.type-badge.store {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

/* CDK 展示框 */
.cdk-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.cdk-code {
  flex: 1;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 14px;
  color: var(--text-primary);
  word-break: break-all;
}

.cdk-actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

/* 链接展示框 */
.link-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.link-url {
  flex: 1;
  font-size: 14px;
  color: var(--color-info);
  word-break: break-all;
  text-decoration: none;
}

.link-url:hover {
  text-decoration: underline;
}

/* 使用说明 */
.description-content {
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 寄存信息 */
.store-info {
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.store-notice {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 12px;
}

.store-info .info-row {
  padding: 8px 0 0;
  border: none;
}

/* 操作按钮 */
.actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16px;
  background: var(--bg-card);
  border-top: 1px solid var(--border-light);
  text-align: center;
}

.pay-btn {
  display: inline-block;
  width: 100%;
  max-width: 568px;
  padding: 16px 32px;
  background: linear-gradient(135deg, #a5b4a3 0%, #95a493 100%);
  color: white;
  border-radius: 14px;
  text-decoration: none;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  transition: all 0.2s;
}

.pay-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-primary);
}

.actions-row {
  display: flex;
  gap: 12px;
  max-width: 568px;
  margin: 0 auto;
}

.cancel-btn {
  flex: 1;
  padding: 16px 32px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn.full-width {
  flex: 1;
  width: 100%;
}

/* 原价样式 */
.original-price {
  text-decoration: line-through;
  color: var(--text-tertiary) !important;
}

/* 用户链接 */
.user-link {
  color: var(--color-info);
  text-decoration: none;
}

.user-link:hover {
  text-decoration: underline;
}

/* 订单日志 */
.order-logs {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.log-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-light);
}

.log-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.log-item:first-child {
  padding-top: 0;
}

.log-icon {
  font-size: 18px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: 8px;
  flex-shrink: 0;
}

.log-content {
  flex: 1;
  min-width: 0;
}

.log-action {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.log-time {
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
