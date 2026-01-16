<template>
  <div class="orders-page">
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">我的订单</h1>
      </div>
      
      <!-- 角色切换 -->
      <div class="role-tabs">
        <button
          :class="['role-tab', { active: currentRole === 'buyer' }]"
          @click="switchRole('buyer')"
        >
          🛒 我买的
        </button>
        <button
          :class="['role-tab', { active: currentRole === 'seller' }]"
          @click="switchRole('seller')"
        >
          📦 我卖的
        </button>
      </div>
      
      <!-- 加载中 -->
      <div v-if="loading" class="loading-state">
        <div class="skeleton-card" v-for="i in 3" :key="i">
          <div class="skeleton-header">
            <div class="skeleton skeleton-line w-32"></div>
            <div class="skeleton skeleton-badge"></div>
          </div>
          <div class="skeleton skeleton-line w-48 mt-3"></div>
          <div class="skeleton skeleton-line w-24 mt-2"></div>
        </div>
      </div>
      
      <!-- 空状态 -->
      <EmptyState
        v-else-if="orders.length === 0"
        icon="📋"
        title="暂无订单"
        :description="currentRole === 'buyer' ? '您还没有购买任何商品' : '您还没有收到任何订单'"
      >
        <router-link to="/" class="browse-btn">
          浏览商品
        </router-link>
      </EmptyState>
      
      <!-- 订单列表 -->
      <div class="orders-list" v-else>
        <div
          v-for="order in orders"
          :key="order.id"
          class="order-card"
        >
          <div class="order-header" @click="viewOrderDetail(order)">
            <span class="order-date">{{ formatDate(order.created_at || order.createdAt) }}</span>
            <span :class="['order-status', getStatusClass(order.status)]">
              {{ getStatusText(order.status) }}
            </span>
          </div>
          
          <div class="order-content" @click="viewOrderDetail(order)">
            <div class="product-name">{{ order.product?.name || order.product_name }}</div>
            <div class="order-info">
              <!-- <span class="order-type">{{ getOrderTypeText(order.product_type || order.product?.product_type) }}</span> -->
              <span class="order-seller" v-if="currentRole === 'buyer'">
                卖家: {{ order.seller_username || order.seller?.username || '未知' }}
              </span>
              <span class="order-seller" v-else>
                买家: {{ order.buyer_username || order.buyer?.username || '未知' }}
              </span>
            </div>
          </div>
          
          <!-- CDK内容展示区（已完成的CDK订单直接显示） -->
          <div 
            v-if="isCdkOrder(order) && hasDeliveryContent(order)"
            class="cdk-display"
            @click.stop
          >
            <div class="cdk-label">🔑 CDK 密钥</div>
            <div class="cdk-content-wrapper">
              <code 
                class="cdk-code"
                :class="{ hidden: !order._showCdk }"
              >
                {{ order._showCdk ? getDeliveryContent(order) : '••••••••••••••••' }}
              </code>
              <div class="cdk-actions">
                <button class="cdk-btn" @click="toggleCdkVisibility(order)">
                  {{ order._showCdk ? '🙈' : '👁️' }}
                </button>
                <button class="cdk-btn" @click="copyCdk(order)">
                  📋
                </button>
              </div>
            </div>
          </div>
          
          <div class="order-footer">
            <span class="order-amount">{{ order.total_price || order.amount }} LDC</span>
            <div class="order-actions">
              <!-- 待支付订单操作按钮 -->
              <template v-if="order.status === 'pending' && currentRole === 'buyer'">
                <button class="action-btn cancel-btn" @click.stop="handleCancelOrder(order)">取消订单</button>
              </template>
              <span v-else class="order-action" @click="viewOrderDetail(order)">查看详情 →</span>
            </div>
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import EmptyState from '@/components/common/EmptyState.vue'

const router = useRouter()
const shopStore = useShopStore()
const toast = useToast()
const dialog = useDialog()

const loading = ref(true)
const loadingMore = ref(false)
const orders = ref([])
const page = ref(1)
const hasMore = ref(false)
const pageSize = 20
const currentRole = ref('buyer')

// 切换角色
async function switchRole(role) {
  if (currentRole.value === role) return
  currentRole.value = role
  page.value = 1
  await loadOrders()
}

// 加载订单
async function loadOrders(append = false) {
  try {
    if (!append) {
      loading.value = true
    } else {
      loadingMore.value = true
    }
    
    let result
    if (currentRole.value === 'buyer') {
      result = await shopStore.fetchMyOrders()
    } else {
      result = await shopStore.fetchSellerOrders()
      result = shopStore.sellerOrders
    }
    
    const ordersList = Array.isArray(result) ? result : (result?.orders || result || [])
    
    if (append) {
      orders.value.push(...ordersList)
    } else {
      orders.value = ordersList
    }
    
    hasMore.value = ordersList.length === pageSize
  } catch (error) {
    toast.error('加载订单失败')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// 加载更多
function loadMore() {
  page.value++
  loadOrders(true)
}

// 查看订单详情
function viewOrderDetail(order) {
  const orderNo = order.order_no || order.orderNo || order.id
  router.push(`/order/${orderNo}?role=${currentRole.value}`)
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

// 状态样式
function getStatusClass(status) {
  const map = {
    pending: 'status-pending',
    paid: 'status-paid',
    completed: 'status-completed',
    cancelled: 'status-cancelled',
    refunded: 'status-refunded',
    delivered: 'status-delivered'
  }
  return map[status] || ''
}

// 订单类型
function getOrderTypeText(type) {
  const map = {
    cdk: 'CDK',
    link: '链接',
  }
  return map[type] || type || '未知'
}

// 格式化日期
function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

// 是否是CDK类型订单
function isCdkOrder(order) {
  const type = order.product_type || order.product?.product_type || order.productType
  return type === 'cdk'
}

// 是否有发货内容
function hasDeliveryContent(order) {
  return !!(order.cdk || order.delivery_content || order.deliveryContent)
}

// 获取发货内容
function getDeliveryContent(order) {
  return order.cdk || order.delivery_content || order.deliveryContent || ''
}

// 切换CDK显示
function toggleCdkVisibility(order) {
  order._showCdk = !order._showCdk
}

// 复制CDK
function copyCdk(order) {
  const content = getDeliveryContent(order)
  if (content) {
    navigator.clipboard.writeText(content)
    toast.success('CDK 已复制到剪贴板')
  }
}

// 取消订单
async function handleCancelOrder(order) {
  const productName = order.product?.name || order.product_name || '该商品'
  const confirmed = await dialog.confirm(`确定要取消订单「${productName}」吗？`, {
    title: '取消订单',
    confirmText: '确定取消',
    cancelText: '再想想'
  })
  
  if (!confirmed) return
  
  try {
    const orderNo = order.order_no || order.orderNo
    await shopStore.cancelOrder(orderNo)
    toast.success('订单已取消')
    // 刷新订单列表
    await loadOrders()
  } catch (error) {
    toast.error(error.message || '取消失败')
  }
}

onMounted(() => {
  loadOrders()
})
</script>

<style scoped>
.orders-page {
  min-height: 100vh;
  padding-bottom: 80px;
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

/* 角色切换 */
.role-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.role-tab {
  flex: 1;
  padding: 14px 20px;
  background: white;
  border: 2px solid #f0ede9;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.role-tab:hover {
  border-color: #e0dcd6;
  background: #faf9f7;
}

.role-tab.active {
  background: #f0f9f0;
  border-color: #a5b4a3;
  color: #5a8c5a;
  font-weight: 600;
}

/* 加载骨架 */
.loading-state {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-card {
  background: white;
  border-radius: 16px;
  padding: 16px 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.skeleton-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skeleton {
  background: linear-gradient(90deg, #f5f3f0 25%, #ebe7e1 50%, #f5f3f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-line {
  height: 14px;
}

.skeleton-badge {
  width: 60px;
  height: 24px;
  border-radius: 12px;
}

.w-24 { width: 96px; }
.w-32 { width: 128px; }
.w-48 { width: 192px; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* 空状态按钮 */
.browse-btn {
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

.browse-btn:hover {
  background: #95a493;
}

/* 订单列表 */
.orders-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-card {
  background: white;
  border-radius: 16px;
  padding: 16px 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.2s;
}

.order-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.order-date {
  font-size: 13px;
  color: #999;
}

.order-status {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending {
  background: #fff8eb;
  color: #cfa76f;
}

.status-paid {
  background: #e8f5e8;
  color: #5a8c5a;
}

.status-completed {
  background: #e8f5e8;
  color: #5a8c5a;
}

.status-delivered {
  background: #e8f0f5;
  color: #778d9c;
}

.status-cancelled {
  background: #f5f3f0;
  color: #999;
}

.status-refunded {
  background: #f5e8e8;
  color: #ad9090;
}

.order-content {
  margin-bottom: 12px;
}

.product-name {
  font-size: 16px;
  font-weight: 600;
  color: #3d3d3d;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-info {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #999;
}

/* CDK 显示区域 */
.cdk-display {
  margin: 12px 0;
  padding: 12px;
  background: #f9f7f5;
  border-radius: 12px;
}

.cdk-label {
  font-size: 12px;
  font-weight: 500;
  color: #5a8c5a;
  margin-bottom: 8px;
}

.cdk-content-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cdk-code {
  flex: 1;
  padding: 10px 12px;
  background: white;
  border-radius: 8px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  color: #3d3d3d;
  word-break: break-all;
}

.cdk-code.hidden {
  color: #999;
  letter-spacing: 2px;
}

.cdk-actions {
  display: flex;
  gap: 6px;
}

.cdk-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #f0ede9;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.cdk-btn:hover {
  background: #faf9f7;
  border-color: #e0dcd6;
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #f5f3f0;
}

.order-amount {
  font-size: 18px;
  font-weight: 700;
  color: #cfa76f;
}

.order-action {
  font-size: 13px;
  color: #a5b4a3;
}

.order-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.action-btn {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  border: none;
}

.action-btn.cancel-btn {
  background: #f5f3f0;
  color: #999;
}

.action-btn.cancel-btn:hover {
  background: #ebe7e1;
  color: #666;
}

.action-btn.pay-btn {
  background: linear-gradient(135deg, #a5b4a3 0%, #95a493 100%);
  color: white;
}

.action-btn.pay-btn:hover {
  opacity: 0.9;
}

/* 加载更多 */
.load-more {
  padding: 20px;
  text-align: center;
}

.load-more-btn {
  padding: 12px 32px;
  background: white;
  border: 1px solid #f0ede9;
  border-radius: 24px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.load-more-btn:hover:not(:disabled) {
  background: #faf9f7;
  border-color: #e0dcd6;
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
