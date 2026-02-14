<template>
  <div class="my-favorites-page">
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">我的收藏</h1>
        <p class="page-subtitle">查看并管理你收藏的物品</p>
      </div>

      <div v-if="loading" class="loading-wrap">
        <p>加载中...</p>
      </div>

      <div v-else-if="favorites.length === 0" class="empty-wrap">
        <EmptyState icon="⭐" title="暂无收藏" description="去逛逛并收藏你喜欢的物品吧" />
      </div>

      <div v-else class="favorite-list">
        <article v-for="item in favorites" :key="item.id" class="favorite-card">
          <router-link :to="`/product/${item.id}`" class="card-main">
            <div class="card-cover" :style="getCoverStyle(item)">
              <img
                v-if="item.image_url"
                :src="item.image_url"
                :alt="item.name"
                class="cover-image"
                @error="handleImageError"
              />
              <span v-else class="cover-placeholder">{{ item.category_icon || '📦' }}</span>
            </div>
            <div class="card-content">
              <h3 class="card-title">{{ item.name }}</h3>
              <p class="card-desc">{{ item.description || '暂无描述' }}</p>
              <div class="card-meta">
                <span class="meta-tag">{{ item.category_icon || '📦' }} {{ item.category_name || '其他' }}</span>
                <span :class="['meta-status', `status-${item.status || 'unknown'}`]">
                  {{ getStatusText(item.status) }}
                </span>
                <span class="meta-price">{{ getPrice(item) }} LDC</span>
                <span class="meta-info seller">{{ getSellerText(item) }}</span>
                <span class="meta-info">销量 {{ getSoldCount(item) }}</span>
                <span class="meta-info">库存 {{ getStockText(item) }}</span>
                <span class="meta-time">收藏于 {{ formatRelativeTime(item.favorited_at || item.updated_at || item.created_at) }}</span>
              </div>
            </div>
          </router-link>
          <div class="card-actions">
            <router-link :to="`/product/${item.id}`" class="action-btn">查看详情</router-link>
            <button
              class="action-btn danger"
              :disabled="removingId === item.id"
              @click="removeFavorite(item)"
            >
              {{ removingId === item.id ? '移除中...' : '移除收藏' }}
            </button>
          </div>
        </article>
      </div>

      <div v-if="hasMore && !loading" class="load-more">
        <button class="load-more-btn" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useShopStore } from '@/stores/shop'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { formatPrice, formatRelativeTime } from '@/utils/format'
import EmptyState from '@/components/common/EmptyState.vue'

const shopStore = useShopStore()
const toast = useToast()
const dialog = useDialog()

const loading = ref(true)
const loadingMore = ref(false)
const removingId = ref(null)
const favorites = ref([])
const page = ref(1)
const pageSize = 20
const hasMore = ref(false)

const coverColors = [
  'linear-gradient(135deg, #fef3c7, #fde68a)',
  'linear-gradient(135deg, #dbeafe, #bfdbfe)',
  'linear-gradient(135deg, #dcfce7, #bbf7d0)',
  'linear-gradient(135deg, #fce7f3, #fbcfe8)',
  'linear-gradient(135deg, #ede9fe, #ddd6fe)'
]

function getCoverStyle(item) {
  if (item.image_url) return {}
  const index = Math.abs(Number(item.id) || 0) % coverColors.length
  return { background: coverColors[index] }
}

function handleImageError(event) {
  event.target.style.display = 'none'
}

function getPrice(item) {
  const price = Number(item.price) || 0
  const discount = Number(item.discount ?? 1)
  return formatPrice(price * discount)
}

function getStatusText(status) {
  const map = {
    approved: '在售',
    offline: '已下架',
    pending: '待审核',
    rejected: '已拒绝'
  }
  return map[status] || '未知状态'
}

function getSellerText(item) {
  const username = String(item?.seller_username || item?.sellerUsername || '').trim()
  return username ? `@${username}` : '@未知'
}

function getSoldCount(item) {
  const sold = Number.parseInt(item?.sold_count, 10)
  return Number.isFinite(sold) && sold > 0 ? sold : 0
}

function getStockText(item) {
  const stock = Number.parseInt(item?.stock, 10)
  if (stock === -1) return '∞'

  const productType = String(item?.product_type || '').toLowerCase()
  if (productType === 'cdk') {
    const available = Number.parseInt(item?.availableStock ?? item?.cdkStats?.available ?? stock, 10)
    const total = Number.parseInt(item?.cdkStats?.total ?? stock, 10)
    const safeAvailable = Number.isFinite(available) ? Math.max(available, 0) : 0
    const safeTotal = Number.isFinite(total) ? Math.max(total, 0) : 0
    if (safeAvailable === 0 && safeTotal === 0) return '0'
    return `${safeAvailable}/${safeTotal}`
  }

  if (Number.isFinite(stock)) return String(Math.max(stock, 0))
  return '0'
}

async function loadFavorites(append = false) {
  const targetPage = append ? page.value : 1
  if (!append) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const result = await shopStore.fetchMyFavorites({
      page: targetPage,
      pageSize
    })

    const list = result?.products || []
    if (append) {
      favorites.value = [...favorites.value, ...list]
    } else {
      favorites.value = list
    }

    const total = Number(result?.pagination?.total || 0)
    hasMore.value = targetPage * pageSize < total
  } catch (error) {
    toast.error(error.message || '加载收藏失败')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  page.value += 1
  await loadFavorites(true)
}

async function removeFavorite(item) {
  if (!item?.id || removingId.value === item.id) return

  const confirmed = await dialog.confirm(`确定移除收藏「${item.name}」吗？`, {
    title: '移除收藏'
  })
  if (!confirmed) return

  removingId.value = item.id
  try {
    const result = await shopStore.removeFavorite(item.id)
    if (!result?.success) {
      const message = typeof result?.error === 'object'
        ? (result.error?.message || result.error?.code || '移除收藏失败')
        : (result?.error || '移除收藏失败')
      toast.error(message)
      return
    }

    favorites.value = favorites.value.filter((entry) => String(entry.id) !== String(item.id))
    toast.success(result?.data?.message || '已取消收藏')

    if (favorites.value.length === 0 && page.value > 1) {
      page.value -= 1
      await loadFavorites(false)
    }
  } catch (error) {
    toast.error(error.message || '移除收藏失败')
  } finally {
    removingId.value = null
  }
}

onMounted(async () => {
  await loadFavorites(false)
})
</script>

<style scoped>
.my-favorites-page {
  min-height: 100vh;
  padding-bottom: 80px;
  background: var(--bg-primary);
}

.page-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
}

.page-header {
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 26px;
  color: var(--text-primary);
}

.page-subtitle {
  margin: 6px 0 0;
  color: var(--text-tertiary);
  font-size: 13px;
}

.loading-wrap,
.empty-wrap {
  padding: 40px 12px;
  text-align: center;
  color: var(--text-tertiary);
}

.favorite-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.favorite-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  overflow: hidden;
}

.card-main {
  display: flex;
  gap: 14px;
  padding: 14px;
  text-decoration: none;
}

.card-cover {
  width: 88px;
  height: 88px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  font-size: 30px;
  opacity: 0.72;
}

.card-content {
  min-width: 0;
  flex: 1;
}

.card-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 17px;
  line-height: 1.35;
}

.card-desc {
  margin: 8px 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.55;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.meta-tag {
  font-size: 12px;
  color: var(--text-tertiary);
}

.meta-price {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-warning);
}

.meta-info {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.meta-info.seller {
  color: var(--text-primary);
}

.meta-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.meta-status.status-approved {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.meta-status.status-offline {
  background: rgba(148, 163, 184, 0.18);
  color: #64748b;
}

.meta-status.status-pending {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.meta-status.status-rejected {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}

.meta-time {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-tertiary);
}

.card-actions {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
}

.action-btn {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-secondary);
  padding: 8px 12px;
  font-size: 13px;
  text-decoration: none;
  cursor: pointer;
}

.action-btn.danger {
  border-color: rgba(220, 38, 38, 0.25);
  color: #dc2626;
  background: rgba(220, 38, 38, 0.08);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.load-more {
  margin-top: 16px;
  text-align: center;
}

.load-more-btn {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 10px 20px;
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .card-main {
    align-items: center;
  }

  .card-cover {
    width: 74px;
    height: 74px;
  }

  .meta-time {
    margin-left: 0;
    width: 100%;
  }
}
</style>
