<template>
  <div class="my-reports-page">
    <div class="page-container">
      <section class="hero-card">
        <div class="hero-content">
          <div>
            <p class="eyebrow">Report Center</p>
            <h1 class="page-title">我的举报</h1>
            <p class="page-subtitle">查看你提交过的举报记录，跟进处理进度与处理结果。</p>
          </div>
          <div class="hero-summary">
            <div class="summary-card">
              <span class="summary-label">当前筛选</span>
              <strong class="summary-value">{{ activeFilterLabel }}</strong>
            </div>
            <div class="summary-card tone-warm">
              <span class="summary-label">待跟进</span>
              <strong class="summary-value">{{ pendingCount }}</strong>
            </div>
            <div class="summary-card tone-calm">
              <span class="summary-label">已完结</span>
              <strong class="summary-value">{{ closedCount }}</strong>
            </div>
          </div>
        </div>
      </section>

      <LiquidTabs
        :modelValue="statusFilter"
        :tabs="filterTabs"
        class="filter-tabs"
        @update:modelValue="applyFilter"
      />

      <div v-if="loading" class="loading-list">
        <article v-for="item in 4" :key="item" class="report-card skeleton-card">
          <div class="skeleton-row between">
            <span class="skeleton pill wide" />
            <span class="skeleton pill short" />
          </div>
          <div class="skeleton-row mt-16">
            <span class="skeleton pill mid" />
            <span class="skeleton pill short" />
          </div>
          <div class="skeleton block mt-16" />
          <div class="skeleton block short mt-10" />
          <div class="skeleton-row mt-18">
            <span class="skeleton pill mid" />
            <span class="skeleton pill short" />
          </div>
        </article>
      </div>

      <section v-else-if="reports.length === 0" class="empty-wrap">
        <EmptyState icon="🚩" text="暂无举报记录" hint="你提交的举报会显示在这里，方便随时查看处理进度。">
          <template #action>
            <router-link to="/" class="browse-btn">去逛逛物品</router-link>
          </template>
        </EmptyState>
      </section>

      <section v-else class="reports-list">
        <button
          v-for="item in reports"
          :key="item.id"
          type="button"
          :class="['report-card', `status-${item.status || 'unknown'}`]"
          @click="openDetail(item.id)"
        >
          <div class="report-card-top">
            <div class="report-main">
              <h2 class="report-product">{{ item.current_product_name || item.product_name || '商品已删除' }}</h2>
              <div class="report-meta-line">
                <span class="report-chip category">{{ categoryText(item.report_category, item.report_category_label) }}</span>
                <span class="report-chip time">提交于 {{ formatDate(item.created_at) }}</span>
              </div>
            </div>
            <span :class="['status-badge', item.status]">{{ statusText(item.status) }}</span>
          </div>

          <p class="report-reason">{{ item.report_reason || '未填写举报原因' }}</p>

          <div class="report-footer">
            <div class="report-footer-meta">
              <span v-if="item.updated_at">最近更新 {{ formatDate(item.updated_at) }}</span>
              <span v-if="item.handled_at">处理于 {{ formatDate(item.handled_at) }}</span>
              <span v-if="!item.handled_at && item.status === 'pending'">等待平台处理</span>
              <span v-else-if="!item.handled_at && item.status === 'processing'">平台正在跟进</span>
            </div>
            <span class="detail-link">查看详情 →</span>
          </div>
        </button>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import LiquidTabs from '@/components/common/LiquidTabs.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const FILTER_OPTIONS = Object.freeze([
  { value: '', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'processing', label: '处理中' },
  { value: 'resolved', label: '已处理' },
  { value: 'rejected', label: '已驳回' }
])

const router = useRouter()
const shopStore = useShopStore()

const loading = ref(false)
const reports = ref([])
const statusFilter = ref('')

const filterOptions = FILTER_OPTIONS

const filterTabs = computed(() =>
  filterOptions.map(item => ({
    value: item.value,
    label: item.label,
    icon: item.value === '' ? '🚩' : item.value === 'pending' ? '⏳' : item.value === 'processing' ? '🔄' : item.value === 'resolved' ? '✅' : '❌'
  }))
)

const activeFilterLabel = computed(() => {
  return filterOptions.find(item => item.value === statusFilter.value)?.label || '全部'
})

const pendingCount = computed(() => {
  return reports.value.filter(item => ['pending', 'processing'].includes(String(item?.status || ''))).length
})

const closedCount = computed(() => {
  return reports.value.filter(item => ['resolved', 'rejected'].includes(String(item?.status || ''))).length
})

function statusText(status) {
  const map = { pending: '待处理', processing: '处理中', resolved: '已处理', rejected: '已驳回' }
  return map[status] || status || '-'
}

function categoryText(category, fallback = '-') {
  const map = {
    payment_config_issue: '收款配置异常',
    test_mode_issue: '测试模式问题',
    purchase_flow_issue: '购买流程异常',
    content_mismatch: '内容不符',
    fraud_risk: '欺诈风险',
    other: '其他'
  }
  return map[category] || fallback || '-'
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(Number(value) || value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN')
}

async function loadReports() {
  loading.value = true
  try {
    const result = await shopStore.fetchMyReports({ status: statusFilter.value, page: 1, pageSize: 50 })
    reports.value = result?.data?.reports || []
  } finally {
    loading.value = false
  }
}

function applyFilter(value) {
  if (statusFilter.value === value && reports.value.length > 0) return
  statusFilter.value = value
  loadReports()
}

function openDetail(id) {
  router.push({ name: 'MyReportDetail', params: { id } })
}

onMounted(() => {
  loadReports()
})
</script>

<style scoped>
.my-reports-page {
  min-height: 100vh;
  padding-bottom: 80px;
  background: var(--bg-primary);
}

.page-container {
  max-width: 940px;
  margin: 0 auto;
  padding: 20px 16px 40px;
}

/* Hero */
.hero-card {
  position: relative;
  overflow: hidden;
  margin-bottom: 18px;
  padding: 24px;
  border: 1px solid var(--border-light);
  border-radius: 20px;
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
  isolation: isolate;
}

.hero-content {
  position: relative;
  display: grid;
  gap: 18px;
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #8d7760;
}

.page-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
  font-weight: 800;
  color: var(--text-primary);
}

.page-subtitle {
  margin: 8px 0 0;
  max-width: 560px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-tertiary);
}

.hero-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.summary-card {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border-light);
  background: var(--bg-tertiary);
}

.summary-card.tone-warm {
  background: rgba(255, 243, 219, 0.7);
}

.summary-card.tone-calm {
  background: rgba(230, 243, 233, 0.7);
}

.summary-label {
  display: block;
  font-size: 12px;
  color: var(--text-tertiary);
}

.summary-value {
  display: block;
  margin-top: 6px;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
}

/* Filter tabs via LiquidTabs */
.filter-tabs {
  width: 100%;
  margin-bottom: 16px;
}

.filter-tabs :deep(.liquid-tab) {
  flex: 1;
  justify-content: center;
  padding: 8px 12px;
  font-size: 13px;
}

.filter-tabs :deep(.tab-icon) {
  font-size: 14px;
}

/* Report list */
.loading-list,
.reports-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.report-card {
  width: 100%;
  padding: 18px;
  text-align: left;
  border: 1px solid var(--border-light);
  border-radius: 18px;
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
  isolation: isolate;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  -webkit-tap-highlight-color: transparent;
}

.report-card:focus-visible {
  outline: 2px solid rgba(98, 125, 102, 0.42);
  outline-offset: 2px;
}

.report-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.report-card.status-pending {
  border-color: rgba(221, 168, 90, 0.28);
}

.report-card.status-processing {
  border-color: rgba(106, 148, 210, 0.26);
}

.report-card.status-resolved {
  border-color: rgba(100, 164, 118, 0.24);
}

.report-card.status-rejected {
  border-color: rgba(208, 113, 113, 0.22);
}

.report-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.report-main {
  min-width: 0;
}

.report-product {
  margin: 0;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 700;
  color: var(--text-primary);
}

.report-meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.report-chip,
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.report-chip {
  border: 1px solid var(--border-light);
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

.report-chip.category {
  background: rgba(239, 244, 237, 0.92);
  color: #5f745f;
}

.report-chip.time {
  background: rgba(244, 240, 234, 0.88);
}

.status-badge {
  flex-shrink: 0;
}

.status-badge.pending {
  background: rgba(255, 241, 204, 0.95);
  color: #9a6312;
}

.status-badge.processing {
  background: rgba(220, 235, 255, 0.96);
  color: #2b66b1;
}

.status-badge.resolved {
  background: rgba(225, 243, 228, 0.96);
  color: #2d7a43;
}

.status-badge.rejected {
  background: rgba(250, 226, 226, 0.96);
  color: #b14c4c;
}

.report-reason {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.report-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.report-footer-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.detail-link {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: #6b8068;
}

.empty-wrap {
  border: 1px solid var(--border-light);
  border-radius: 20px;
  background: var(--bg-card);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  isolation: isolate;
}

.browse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  margin-top: 16px;
  padding: 0 16px;
  border-radius: 999px;
  background: linear-gradient(135deg, #7b957d, #66826a);
  color: #fff;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 8px 18px rgba(102, 130, 106, 0.18);
}

/* Skeleton */
.skeleton-card {
  pointer-events: none;
}

.skeleton-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.skeleton-row.between {
  justify-content: space-between;
}

.skeleton {
  position: relative;
  overflow: hidden;
  display: inline-block;
  border-radius: 999px;
  background: var(--skeleton-gradient);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

.skeleton.pill { height: 14px; }
.skeleton.pill.wide { width: 180px; }
.skeleton.pill.mid { width: 120px; }
.skeleton.pill.short { width: 74px; }

.skeleton.block {
  display: block;
  height: 16px;
  width: 100%;
  border-radius: 10px;
}

.skeleton.block.short { width: 72%; }

.mt-10 { margin-top: 10px; }
.mt-16 { margin-top: 16px; }
.mt-18 { margin-top: 18px; }

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Mobile */
@media (max-width: 640px) {
  .page-container {
    padding: 12px 12px 32px;
  }

  .hero-card {
    padding: 14px;
    margin-bottom: 12px;
    border-radius: 16px;
  }

  .eyebrow {
    display: none;
  }

  .page-title {
    font-size: 20px;
  }

  .page-subtitle {
    font-size: 12px;
    margin-top: 4px;
  }

  .hero-summary {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .summary-card {
    padding: 8px 10px;
    border-radius: 10px;
  }

  .summary-label {
    font-size: 11px;
  }

  .summary-value {
    font-size: 16px;
    margin-top: 4px;
  }

  .filter-tabs {
    margin-bottom: 12px;
  }

  .filter-tabs :deep(.liquid-tab) {
    padding: 7px 6px;
    font-size: 12px;
  }

  .filter-tabs :deep(.tab-icon) {
    font-size: 13px;
  }

  .reports-list {
    gap: 10px;
  }

  .report-card {
    padding: 12px;
    border-radius: 14px;
  }

  .report-product {
    font-size: 14px;
  }

  .report-meta-line {
    margin-top: 6px;
    gap: 4px;
  }

  .report-chip,
  .status-badge {
    min-height: 22px;
    padding: 0 7px;
    font-size: 11px;
  }

  .report-reason {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.6;
    -webkit-line-clamp: 2;
  }

  .report-footer {
    margin-top: 10px;
    padding-top: 8px;
    gap: 8px;
  }

  .report-footer-meta {
    gap: 4px 8px;
    font-size: 11px;
  }

  .detail-link {
    font-size: 12px;
  }

  .report-card-top {
    flex-direction: column;
    gap: 8px;
  }

  .status-badge {
    align-self: flex-start;
  }
}
</style>
