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

      <section class="filters-panel">
        <div class="filters-head">
          <div>
            <h2 class="section-title">状态筛选</h2>
            <p class="section-hint">切换查看不同处理阶段的举报记录。</p>
          </div>
          <span class="result-count">共 {{ reports.length }} 条</span>
        </div>
        <div class="filter-tabs">
          <button
            v-for="item in filterOptions"
            :key="item.value || 'all'"
            type="button"
            :class="['filter-tab', { active: statusFilter === item.value }]"
            @click="applyFilter(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </section>

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
                <span class="report-chip neutral">举报 #{{ item.id }}</span>
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
}

.page-container {
  max-width: 940px;
  margin: 0 auto;
  padding: 20px 16px 40px;
}

.hero-card,
.filters-panel,
.report-card,
.empty-wrap {
  border: 1px solid rgba(176, 154, 124, 0.18);
  border-radius: 24px;
  background: rgba(255, 252, 247, 0.94);
  box-shadow: 0 18px 40px rgba(113, 86, 54, 0.08);
}

.hero-card {
  position: relative;
  overflow: hidden;
  margin-bottom: 18px;
  padding: 24px;
}

.hero-card::after {
  content: '';
  position: absolute;
  inset: auto -48px -70px auto;
  width: 180px;
  height: 180px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(146, 170, 150, 0.22), transparent 66%);
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
  font-size: 30px;
  line-height: 1.15;
  font-weight: 800;
  color: #2f2418;
}

.page-subtitle {
  margin: 10px 0 0;
  max-width: 560px;
  font-size: 14px;
  line-height: 1.7;
  color: #76614d;
}

.hero-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.summary-card {
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(176, 154, 124, 0.16);
  background: rgba(255, 255, 255, 0.72);
}

.summary-card.tone-warm {
  background: rgba(255, 243, 219, 0.68);
}

.summary-card.tone-calm {
  background: rgba(230, 243, 233, 0.72);
}

.summary-label {
  display: block;
  font-size: 12px;
  color: #8a735e;
}

.summary-value {
  display: block;
  margin-top: 8px;
  font-size: 20px;
  font-weight: 800;
  color: #2f2418;
}

.filters-panel {
  margin-bottom: 18px;
  padding: 18px;
}

.filters-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #2f2418;
}

.section-hint {
  margin: 6px 0 0;
  font-size: 13px;
  color: #8a735e;
}

.result-count {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(109, 132, 113, 0.12);
  color: #5d725f;
  font-size: 12px;
  font-weight: 700;
}

.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.filter-tab {
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid rgba(176, 154, 124, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: #705a45;
  font-size: 13px;
  font-weight: 700;
  transition: all 0.18s ease;
}

.filter-tab.active {
  border-color: rgba(104, 128, 108, 0.34);
  background: linear-gradient(135deg, #f0f5ee, #e5efe2);
  color: #536954;
  box-shadow: 0 8px 18px rgba(95, 120, 98, 0.14);
}

.loading-list,
.reports-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.report-card {
  width: 100%;
  padding: 20px;
  text-align: left;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  -webkit-tap-highlight-color: transparent;
}

.report-card:focus-visible,
.filter-tab:focus-visible,
.browse-btn:focus-visible {
  outline: 2px solid rgba(98, 125, 102, 0.42);
  outline-offset: 2px;
}

.report-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 22px 44px rgba(113, 86, 54, 0.12);
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
  gap: 14px;
}

.report-main {
  min-width: 0;
}

.report-product {
  margin: 0;
  font-size: 18px;
  line-height: 1.4;
  font-weight: 800;
  color: #2f2418;
}

.report-meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.report-chip,
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.report-chip {
  border: 1px solid rgba(176, 154, 124, 0.16);
  background: rgba(250, 245, 237, 0.9);
  color: #7b644f;
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
  margin: 16px 0 0;
  font-size: 14px;
  line-height: 1.8;
  color: #534231;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.report-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid rgba(176, 154, 124, 0.12);
}

.report-footer-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  font-size: 12px;
  color: #8a735e;
}

.detail-link {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  color: #5d725f;
}

.empty-wrap {
  padding: 24px;
}

.browse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  margin-top: 18px;
  padding: 0 18px;
  border-radius: 999px;
  background: linear-gradient(135deg, #7b957d, #66826a);
  color: #fff;
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 14px 28px rgba(102, 130, 106, 0.22);
}

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
  background: rgba(219, 210, 197, 0.5);
}

.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
  animation: shimmer 1.4s infinite;
}

.skeleton.pill {
  height: 14px;
}

.skeleton.pill.wide {
  width: 180px;
}

.skeleton.pill.mid {
  width: 120px;
}

.skeleton.pill.short {
  width: 74px;
}

.skeleton.block {
  display: block;
  height: 16px;
  width: 100%;
  border-radius: 10px;
}

.skeleton.block.short {
  width: 72%;
}

.mt-10 {
  margin-top: 10px;
}

.mt-16 {
  margin-top: 16px;
}

.mt-18 {
  margin-top: 18px;
}

@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}

:global(.dark) .my-reports-page {
  background:
    radial-gradient(circle at top right, rgba(96, 122, 104, 0.2), transparent 28%),
    linear-gradient(180deg, #181410, #221c16);
}

:global(.dark) .hero-card,
:global(.dark) .filters-panel,
:global(.dark) .report-card,
:global(.dark) .empty-wrap {
  border-color: rgba(255, 232, 205, 0.08);
  background: rgba(44, 35, 26, 0.92);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.24);
}

:global(.dark) .eyebrow,
:global(.dark) .section-hint,
:global(.dark) .report-footer-meta,
:global(.dark) .summary-label {
  color: #c8b39a;
}

:global(.dark) .page-title,
:global(.dark) .section-title,
:global(.dark) .report-product,
:global(.dark) .summary-value {
  color: #f8ead7;
}

:global(.dark) .page-subtitle,
:global(.dark) .report-reason {
  color: #dcc7b0;
}

:global(.dark) .summary-card {
  border-color: rgba(255, 232, 205, 0.08);
  background: rgba(73, 58, 44, 0.72);
}

:global(.dark) .summary-card.tone-warm {
  background: rgba(99, 74, 34, 0.42);
}

:global(.dark) .summary-card.tone-calm {
  background: rgba(62, 84, 66, 0.42);
}

:global(.dark) .result-count,
:global(.dark) .filter-tab.active {
  background: rgba(120, 146, 123, 0.2);
  color: #dbe8dc;
}

:global(.dark) .filter-tab {
  border-color: rgba(255, 232, 205, 0.08);
  background: rgba(73, 58, 44, 0.72);
  color: #dcc7b0;
}

:global(.dark) .filter-tab.active {
  border-color: rgba(150, 182, 154, 0.24);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}

:global(.dark) .filter-tab:focus-visible,
:global(.dark) .report-card:focus-visible,
:global(.dark) .browse-btn:focus-visible {
  outline-color: rgba(186, 214, 190, 0.46);
}

:global(.dark) .report-card:hover {
  box-shadow: 0 24px 46px rgba(0, 0, 0, 0.26);
}

:global(.dark) .report-chip {
  border-color: rgba(255, 232, 205, 0.08);
  background: rgba(89, 72, 56, 0.72);
  color: #e5d0b7;
}

:global(.dark) .report-chip.category {
  background: rgba(72, 92, 75, 0.72);
  color: #d8e5d9;
}

:global(.dark) .report-chip.time {
  background: rgba(80, 66, 51, 0.72);
}

:global(.dark) .status-badge.pending {
  background: rgba(133, 98, 40, 0.35);
  color: #ffd78a;
}

:global(.dark) .status-badge.processing {
  background: rgba(57, 86, 132, 0.42);
  color: #b8d7ff;
}

:global(.dark) .status-badge.resolved {
  background: rgba(47, 98, 62, 0.42);
  color: #b8ecc5;
}

:global(.dark) .status-badge.rejected {
  background: rgba(117, 58, 58, 0.42);
  color: #ffc0c0;
}

:global(.dark) .report-footer {
  border-top-color: rgba(255, 232, 205, 0.08);
}

:global(.dark) .detail-link {
  color: #cfe0cf;
}

:global(.dark) .browse-btn {
  background: linear-gradient(135deg, #7f9a81, #69856c);
}

:global(.dark) .skeleton {
  background: rgba(117, 98, 78, 0.44);
}

@media (max-width: 720px) {
  .page-container {
    padding-top: 16px;
    padding-left: 12px;
    padding-right: 12px;
  }

  .hero-card,
  .filters-panel,
  .report-card,
  .empty-wrap {
    border-radius: 20px;
  }

  .hero-card,
  .filters-panel,
  .report-card {
    padding: 18px;
  }

  .page-title {
    font-size: 26px;
  }

  .page-subtitle {
    font-size: 13px;
    line-height: 1.65;
  }

  .hero-summary {
    grid-template-columns: 1fr;
  }

  .filters-head,
  .report-card-top,
  .report-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-tabs {
    gap: 8px;
  }

  .filter-tab {
    min-height: 38px;
    padding: 0 14px;
    font-size: 12px;
  }

  .report-meta-line {
    gap: 6px;
  }

  .report-chip,
  .status-badge {
    min-height: 26px;
    padding: 0 9px;
    font-size: 11px;
  }

  .report-reason {
    -webkit-line-clamp: 4;
    font-size: 13px;
    line-height: 1.75;
  }

  .report-footer-meta {
    gap: 8px 10px;
  }

  .status-badge,
  .detail-link,
  .result-count {
    align-self: flex-start;
  }
}
</style>
