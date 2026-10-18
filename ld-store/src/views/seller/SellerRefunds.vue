<template>
  <div class="seller-refunds-page">
    <SellerPageToolbar eyebrow="退款台账" description="集中处理买家退款申请。请在订单显示的处理期限内作出决定，协商不延长时限；逾期未决定，系统将自动同意并发起全额退款。">
      <template #actions>
        <button type="button" class="refund-refresh" :disabled="loading" @click="loadRefunds">
          <RefreshCw :class="{ spinning: loading }" :size="16" aria-hidden="true" />刷新
        </button>
      </template>
      <form class="refund-filter-form" role="search" @submit.prevent="applySearch">
        <SellerTabs class="refund-tabs" :model-value="status" :tabs="refundTabs" size="sm" aria-label="退款状态筛选" @update:model-value="selectStatus" />
        <label class="refund-search">
          <Search :size="16" aria-hidden="true" />
          <span class="seller-sr-only">搜索退款申请</span>
          <input v-model.trim="search" type="search" placeholder="搜索订单号、买家或物品" />
        </label>
        <button type="submit" class="refund-search-submit">搜索</button>
      </form>
    </SellerPageToolbar>

    <div v-if="errorMessage" class="refund-page-error" role="alert">
      <CircleAlert :size="19" aria-hidden="true" />
      <div><strong>退款台账加载失败</strong><p>{{ errorMessage }}</p></div>
      <button type="button" @click="loadRefunds">重试</button>
    </div>

    <SellerDataTable
      caption="退款售后台账"
      :columns="columns"
      :rows="refunds"
      :loading="loading"
      row-key="orderNo"
    >
      <template #cell-orderNo="{ row }">
        <router-link :to="detailTarget(row)" class="refund-order-link">
          <strong>{{ row.orderNo }}</strong>
          <small>{{ formatRefundDate(row.requestedAt) }}</small>
          <RefundDeadlineNotice :refund="row" :server-now="serverNow" compact />
        </router-link>
      </template>
      <template #cell-buyer="{ row }">
        <div class="refund-party"><strong>@{{ row.buyerUsername || '未知买家' }}</strong><small>{{ row.productName }}</small></div>
      </template>
      <template #cell-reason="{ row }">
        <div class="refund-reason"><strong>{{ getRefundReasonLabel(row.reasonCode) }}</strong><small>{{ row.reasonDetail }}</small></div>
      </template>
      <template #cell-amount="{ row }"><strong class="refund-amount-cell">{{ Number(row.refundAmount || 0).toFixed(2) }} LDC</strong></template>
      <template #cell-status="{ row }"><SellerStatusBadge :label="getRefundStatusMeta(row.status).label" :tone="getRefundStatusMeta(row.status).tone" /></template>
      <template #cell-action="{ row }"><router-link :to="detailTarget(row)" class="refund-detail-link">查看处理<ArrowUpRight :size="14" aria-hidden="true" /></router-link></template>
      <template #mobile-row="{ row }">
        <div class="refund-mobile-head">
          <router-link :to="detailTarget(row)">{{ row.orderNo }}</router-link>
          <SellerStatusBadge :label="getRefundStatusMeta(row.status).label" :tone="getRefundStatusMeta(row.status).tone" />
        </div>
        <div class="refund-mobile-product"><strong>{{ row.productName }}</strong><span>@{{ row.buyerUsername || '未知买家' }}</span></div>
        <RefundDeadlineNotice :refund="row" :server-now="serverNow" compact />
        <p class="refund-mobile-reason">{{ getRefundReasonLabel(row.reasonCode) }} · {{ row.reasonDetail }}</p>
        <div class="refund-mobile-foot"><strong>{{ Number(row.refundAmount || 0).toFixed(2) }} LDC</strong><router-link :to="detailTarget(row)">查看处理<ArrowUpRight :size="14" aria-hidden="true" /></router-link></div>
      </template>
      <template #empty>
        <div class="refund-empty">
          <BadgeCheck :size="34" aria-hidden="true" />
          <strong>{{ status === 'action_required' ? '当前没有待处理退款' : '没有符合筛选条件的退款记录' }}</strong>
          <p>{{ status === 'action_required' ? '新的退款申请会在这里形成待办。' : '可切换状态或清除搜索后再查看。' }}</p>
          <router-link to="/seller/orders">返回订单管理</router-link>
        </div>
      </template>
      <template #footer>
        <SellerPagination :page="pagination.page" :total-pages="pagination.totalPages" :total="pagination.total" @change="changePage" />
      </template>
    </SellerDataTable>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowUpRight, BadgeCheck, CircleAlert, RefreshCw, Search } from '@lucide/vue'
import SellerDataTable from '@/components/seller/SellerDataTable.vue'
import RefundDeadlineNotice from '@/components/order/RefundDeadlineNotice.vue'
import SellerTabs from '@/components/seller/SellerTabs.vue'
import SellerPageToolbar from '@/components/seller/SellerPageToolbar.vue'
import SellerPagination from '@/components/seller/SellerPagination.vue'
import SellerStatusBadge from '@/components/seller/SellerStatusBadge.vue'
import { fetchSellerRefundsRequest } from '@/services/shop/refundService'
import { formatRefundDate, getRefundErrorMessage, getRefundReasonLabel, getRefundStatusMeta } from '@/utils/refund'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const errorMessage = ref('')
const refunds = ref([])
const status = ref(String(route.query.status || 'action_required'))
const search = ref(String(route.query.search || ''))
const serverNow = ref('')
const summary = reactive({ total: 0, requested: 0, negotiating: 0, exception: 0, externalDispute: 0, closed: 0, actionRequired: 0 })
const pagination = reactive({ page: Number(route.query.page) || 1, pageSize: 20, total: 0, totalPages: 0 })

const columns = Object.freeze([
  { key: 'orderNo', label: '订单 / 申请时间', width: '20%' },
  { key: 'buyer', label: '买家 / 物品', width: '21%' },
  { key: 'reason', label: '申请原因', width: '24%' },
  { key: 'amount', label: '全额退回', width: '12%' },
  { key: 'status', label: '状态', width: '13%' },
  { key: 'action', label: '', align: 'right', width: '10%' }
])

const statusTabs = [
  { value: 'action_required', label: '待处理', countKey: 'actionRequired' },
  { value: 'requested', label: '待响应', countKey: 'requested' },
  { value: 'negotiating', label: '协商中', countKey: 'negotiating' },
  { value: 'exception', label: '执行异常', countKey: 'exception' },
  { value: 'external_dispute', label: 'Credit 处理', countKey: 'externalDispute' },
  { value: 'closed', label: '已结束', countKey: 'closed' },
  { value: 'all', label: '全部', countKey: 'total' }
]

const refundTabs = computed(() => statusTabs.map(tab => ({ ...tab, badge: summary[tab.countKey] || 0 })))

function detailTarget(row) {
  return { path: `/seller/orders/${encodeURIComponent(row.orderNo)}`, query: { source: 'product', from: 'refunds' } }
}

async function syncRoute(next = {}) {
  await router.push({
    query: {
      status: next.status || status.value,
      ...(next.search ?? search.value ? { search: next.search ?? search.value } : {}),
      ...(Number(next.page || pagination.page) > 1 ? { page: next.page || pagination.page } : {})
    }
  })
}

async function selectStatus(nextStatus) {
  if (nextStatus === status.value) return
  status.value = nextStatus
  pagination.page = 1
  await syncRoute({ status: nextStatus, page: 1 })
}

async function applySearch() {
  pagination.page = 1
  await syncRoute({ search: search.value, page: 1 })
}

async function changePage(page) {
  pagination.page = page
  await syncRoute({ page })
}

async function loadRefunds() {
  loading.value = true
  errorMessage.value = ''
  const result = await fetchSellerRefundsRequest({
    status: status.value,
    search: search.value,
    page: pagination.page,
    pageSize: pagination.pageSize
  })
  if (!result?.success) {
    errorMessage.value = getRefundErrorMessage(result, '加载退款售后列表失败，请稍后重试')
    loading.value = false
    return
  }
  const data = result.data || result
  serverNow.value = data.serverNow || ''
  refunds.value = Array.isArray(data.refunds) ? data.refunds : []
  Object.assign(summary, data.summary || {})
  Object.assign(pagination, data.pagination || {})
  loading.value = false
}

watch(() => route.query, () => {
  status.value = String(route.query.status || 'action_required')
  search.value = String(route.query.search || '')
  pagination.page = Number(route.query.page) || 1
  loadRefunds()
})
onMounted(loadRefunds)
</script>

<style scoped>
/* 筛选表单 - 清晰布局 */
.refund-filter-form {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
}

.refund-tabs { flex: 1 1 auto; }

/* 搜索框 - 清晰聚焦效果 */
.refund-search {
  min-width: 240px;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border: 2px solid var(--border-medium);
  border-radius: 10px;
  color: var(--text-secondary);
  background: var(--palette-hex-ffffff);
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.refund-search:hover {
  border-color: var(--color-primary);
  background: var(--bg-secondary);
}

.refund-search input {
  width: 100%;
  min-height: 44px;
  border: 0;
  outline: 0;
  color: var(--text-primary);
  background: transparent;
  font-size: 14px;
}

.refund-search input::placeholder {
  color: var(--text-secondary);
}

.refund-search:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--palette-rgba-181-168-152-0p15);
  background: var(--palette-hex-ffffff);
}

.refund-search-submit,
.refund-refresh {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 18px;
  border: 2px solid var(--border-medium);
  border-radius: 10px;
  color: var(--text-primary);
  background: var(--palette-hex-ffffff);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.refund-search-submit:hover,
.refund-refresh:hover {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--palette-hex-ffffff);
  box-shadow: 0 2px 8px var(--palette-rgba-181-168-152-0p25);
}

.refund-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 表格单元格内容 - 改进可读性 */
.refund-order-link,
.refund-party,
.refund-reason {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.refund-order-link {
  text-decoration: none;
  transition: opacity 0.2s;
}

.refund-order-link:hover { opacity: 0.7; }

.refund-order-link strong {
  color: var(--text-primary);
  font: 700 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow-wrap: anywhere;
}

.refund-order-link small,
.refund-party small,
.refund-reason small {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.refund-party strong,
.refund-reason strong {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.refund-amount-cell {
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  white-space: nowrap;
}

/* 详情链接 - 简洁强调 */
.refund-detail-link {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  text-decoration: none;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.refund-detail-link:hover {
  background: var(--color-primary-light);
  box-shadow: 0 2px 8px var(--palette-rgba-181-168-152-0p15);
}

/* 错误状态 - 简洁错误提示 */
.refund-page-error {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 16px;
  border: 2px solid var(--color-danger-light);
  border-radius: 12px;
  color: var(--palette-hex-991b1b);
  background: var(--color-danger-bg);
}

.refund-page-error p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.refund-page-error button {
  min-height: 44px;
  padding: 0 18px;
  border: 2px solid currentColor;
  border-radius: 10px;
  font-weight: 700;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
  cursor: pointer;
}

.refund-page-error button:hover {
  background: var(--palette-rgba-153-27-27-0p1);
  box-shadow: 0 2px 8px var(--palette-rgba-153-27-27-0p15);
}

/* 空状态 - 友好空状态 */
.refund-empty {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 48px 20px;
  color: var(--text-secondary);
}

.refund-empty svg {
  color: var(--color-primary);
  opacity: 0.6;
}

.refund-empty strong {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
}

.refund-empty p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

.refund-empty a {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  margin-top: 8px;
  padding: 0 20px;
  border: 2px solid var(--border-medium);
  border-radius: 10px;
  color: var(--text-primary);
  font-weight: 700;
  text-decoration: none;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.refund-empty a:hover {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--palette-hex-ffffff);
  box-shadow: 0 2px 8px var(--palette-rgba-181-168-152-0p25);
}

/* 移动端卡片布局 - 改进层次 */
.refund-mobile-head,
.refund-mobile-foot,
.refund-mobile-product {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.refund-mobile-head > a {
  color: var(--text-primary);
  font: 700 13px/1.5 ui-monospace, monospace;
  overflow-wrap: anywhere;
  text-decoration: none;
}

.refund-mobile-product {
  margin-top: 12px;
}

.refund-mobile-product strong {
  color: var(--text-primary);
  font-weight: 600;
}

.refund-mobile-product span {
  color: var(--text-secondary);
  font-size: 12px;
}

.refund-mobile-reason {
  margin: 10px 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.refund-mobile-foot {
  padding-top: 12px;
  border-top: 2px solid var(--border-medium);
}

.refund-mobile-foot strong {
  color: var(--color-primary);
  font-weight: 700;
}

.refund-mobile-foot a {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.refund-mobile-foot a:hover {
  background: var(--color-primary-light);
  box-shadow: 0 2px 8px var(--palette-rgba-181-168-152-0p15);
}

.seller-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.spinning {
  animation: refund-rotate 800ms linear infinite;
}

@keyframes refund-rotate {
  to { transform: rotate(360deg); }
}

/* 响应式优化 */
@media (max-width: 1100px) {
  .refund-filter-form {
    align-items: stretch;
    flex-wrap: wrap;
  }
  .refund-tabs {
    flex: 1 1 100%;
  }
}

@media (max-width: 767px) {
  .refund-filter-form {
    flex-direction: column;
  }
  .refund-tabs,
  .refund-search,
  .refund-search-submit {
    width: 100%;
    box-sizing: border-box;
  }
  .refund-page-error {
    grid-template-columns: auto 1fr;
  }
  .refund-page-error button {
    grid-column: 1 / -1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinning { animation: none; }
  .refund-search,
  .refund-search-submit,
  .refund-refresh,
  .refund-detail-link,
  .refund-empty a,
  .refund-mobile-foot a {
    transition: none;
  }
}
</style>
