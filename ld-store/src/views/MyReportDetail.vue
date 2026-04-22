<template>
  <div class="my-report-detail-page">
    <div class="page-container">
      <div class="page-header">
        <button class="back-btn" @click="goBack">← 返回我的举报</button>
      </div>

      <div v-if="loading" class="detail-loading">
        <section class="hero-card skeleton-card">
          <span class="skeleton pill short" />
          <span class="skeleton title mt-14" />
          <div class="summary-grid mt-18">
            <span v-for="item in 4" :key="item" class="skeleton stat" />
          </div>
        </section>
        <section class="content-card skeleton-card mt-16">
          <span class="skeleton pill mid" />
          <span class="skeleton line mt-16" />
          <span class="skeleton line mt-10" />
          <span class="skeleton line short mt-10" />
        </section>
        <section class="content-card skeleton-card mt-16">
          <span class="skeleton pill mid" />
          <span class="skeleton line mt-16" />
          <span class="skeleton line short mt-10" />
        </section>
      </div>

      <section v-else-if="!report" class="empty-wrap">
        <EmptyState icon="🚩" text="举报不存在" hint="该举报记录可能已被删除，或你当前没有查看权限。">
          <template #action>
            <button type="button" class="back-home-btn" @click="goBack">返回举报列表</button>
          </template>
        </EmptyState>
      </section>

      <template v-else>
        <section class="hero-card">
          <div class="hero-top">
            <div class="hero-main">
              <p class="eyebrow">Report Detail</p>
              <h1 class="page-title">{{ report.current_product_name || report.product_name || '商品已删除' }}</h1>
              <p class="page-subtitle">举报 #{{ report.id }} · {{ categoryText(report.report_category, report.report_category_label) }}</p>
            </div>
            <span :class="['status-badge', report.status]">{{ statusText(report.status) }}</span>
          </div>

          <div class="summary-grid">
            <article class="summary-card">
              <span class="summary-label">当前状态</span>
              <strong class="summary-value">{{ statusText(report.status) }}</strong>
              <span class="summary-meta">{{ statusDescription(report.status) }}</span>
            </article>
            <article class="summary-card">
              <span class="summary-label">提交时间</span>
              <strong class="summary-value small">{{ formatDate(report.created_at) }}</strong>
              <span class="summary-meta">首次提交举报的时间</span>
            </article>
            <article class="summary-card">
              <span class="summary-label">最近更新</span>
              <strong class="summary-value small">{{ formatDate(report.updated_at) }}</strong>
              <span class="summary-meta">平台最近一次更新记录</span>
            </article>
            <article class="summary-card">
              <span class="summary-label">处理时间</span>
              <strong class="summary-value small">{{ formatDate(report.handled_at) }}</strong>
              <span class="summary-meta">若未处理则显示为 -</span>
            </article>
          </div>
        </section>

        <section class="content-card">
          <div class="section-head">
            <div>
              <h2 class="section-title">举报原因</h2>
              <p class="section-hint">这是你提交给平台的原始说明。</p>
            </div>
          </div>
          <div class="content-block reason-block">{{ report.report_reason || '未填写举报原因' }}</div>
        </section>

        <section :class="['content-card', 'note-card', noteToneClass]">
          <div class="section-head">
            <div>
              <h2 class="section-title">处理备注</h2>
              <p class="section-hint">平台对该举报的处理结果或补充说明。</p>
            </div>
          </div>
          <div v-if="report.admin_note" class="content-block">{{ report.admin_note }}</div>
          <div v-else class="soft-empty">暂未填写处理备注，处理进展会在这里更新。</div>
        </section>

        <section class="content-card">
          <div class="section-head">
            <div>
              <h2 class="section-title">处理历史</h2>
              <p class="section-hint">展示该举报的状态流转与操作记录。</p>
            </div>
          </div>

          <div v-if="logs.length === 0" class="soft-empty">暂无处理历史，平台后续跟进会记录在这里。</div>

          <div v-else class="timeline">
            <article v-for="(item, index) in logs" :key="`${item.created_at}-${index}`" class="timeline-item">
              <div class="timeline-dot" />
              <div class="timeline-body">
                <div class="timeline-time">{{ formatDate(item.created_at) }}</div>
                <div class="timeline-note">{{ item.note || `${statusText(item.from_status)} → ${statusText(item.to_status)}` }}</div>
              </div>
            </article>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import EmptyState from '@/components/common/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const shopStore = useShopStore()

const loading = ref(false)
const report = ref(null)
const logs = ref([])

const noteToneClass = computed(() => {
  const status = String(report.value?.status || '')
  if (status === 'resolved') return 'tone-resolved'
  if (status === 'rejected') return 'tone-rejected'
  return 'tone-neutral'
})

function statusText(status) {
  const map = { pending: '待处理', processing: '处理中', resolved: '已处理', rejected: '已驳回' }
  return map[status] || status || '-'
}

function statusDescription(status) {
  const map = {
    pending: '举报已提交，等待平台受理。',
    processing: '平台正在核查该举报内容。',
    resolved: '举报已完成处理。',
    rejected: '举报未被采纳或已驳回。'
  }
  return map[status] || '当前暂无更多状态说明。'
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

async function loadDetail() {
  loading.value = true
  try {
    const result = await shopStore.fetchMyReportDetail(route.params.id)
    report.value = result?.data?.report || null
    logs.value = result?.data?.logs || []
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push({ name: 'MyReports' })
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.my-report-detail-page {
  min-height: 100vh;
  padding-bottom: 80px;
}

.page-container {
  max-width: 940px;
  margin: 0 auto;
  padding: 20px 16px 40px;
}

.page-header {
  margin-bottom: 14px;
}

.back-btn,
.back-home-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid rgba(176, 154, 124, 0.2);
  border-radius: 999px;
  background: rgba(255, 252, 247, 0.9);
  color: #6f5945;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 12px 24px rgba(113, 86, 54, 0.08);
  -webkit-tap-highlight-color: transparent;
}

.back-btn:focus-visible,
.back-home-btn:focus-visible {
  outline: 2px solid rgba(98, 125, 102, 0.42);
  outline-offset: 2px;
}

.hero-card,
.content-card,
.empty-wrap {
  border: 1px solid rgba(176, 154, 124, 0.18);
  border-radius: 24px;
  background: rgba(255, 252, 247, 0.94);
  box-shadow: 0 18px 40px rgba(113, 86, 54, 0.08);
}

.hero-card {
  position: relative;
  overflow: hidden;
  padding: 24px;
}

.hero-card::after {
  content: '';
  position: absolute;
  inset: auto -46px -74px auto;
  width: 180px;
  height: 180px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(146, 170, 150, 0.22), transparent 66%);
}

.hero-top {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.hero-main {
  min-width: 0;
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
  line-height: 1.2;
  font-weight: 800;
  color: #2f2418;
}

.page-subtitle {
  margin: 10px 0 0;
  font-size: 14px;
  color: #7b644f;
}

.status-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
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

.summary-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
}

.summary-card {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(176, 154, 124, 0.16);
  background: rgba(255, 255, 255, 0.72);
}

.summary-label {
  display: block;
  font-size: 12px;
  color: #8a735e;
}

.summary-value {
  display: block;
  margin-top: 10px;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.4;
  color: #2f2418;
}

.summary-value.small {
  font-size: 15px;
  font-weight: 700;
}

.summary-meta {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #8a735e;
}

.content-card {
  margin-top: 16px;
  padding: 20px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #2f2418;
}

.section-hint {
  margin: 6px 0 0;
  font-size: 13px;
  color: #8a735e;
}

.content-block {
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(250, 245, 237, 0.9);
  color: #4f3f30;
  font-size: 14px;
  line-height: 1.9;
  white-space: pre-wrap;
  word-break: break-word;
}

.reason-block {
  font-size: 15px;
}

.note-card.tone-resolved .content-block {
  background: rgba(232, 243, 234, 0.92);
}

.note-card.tone-rejected .content-block {
  background: rgba(249, 234, 234, 0.92);
}

.soft-empty {
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px dashed rgba(176, 154, 124, 0.22);
  background: rgba(252, 248, 241, 0.72);
  color: #8a735e;
  font-size: 14px;
  line-height: 1.8;
}

.timeline {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.timeline::before {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 8px;
  width: 1px;
  background: rgba(176, 154, 124, 0.2);
}

.timeline-item {
  position: relative;
  display: flex;
  gap: 14px;
}

.timeline-dot {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 5px;
  border: 3px solid rgba(116, 143, 120, 0.4);
  border-radius: 999px;
  background: #fffdf8;
}

.timeline-body {
  flex: 1;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(250, 245, 237, 0.9);
}

.timeline-time {
  font-size: 12px;
  font-weight: 700;
  color: #8a735e;
}

.timeline-note {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.8;
  color: #4f3f30;
}

.empty-wrap {
  padding: 24px;
}

.detail-loading {
  display: flex;
  flex-direction: column;
}

.skeleton-card {
  pointer-events: none;
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

.skeleton.pill.short {
  width: 88px;
  height: 14px;
}

.skeleton.pill.mid {
  width: 128px;
  height: 14px;
}

.skeleton.title {
  display: block;
  width: 52%;
  height: 28px;
  border-radius: 12px;
}

.skeleton.stat {
  height: 88px;
  border-radius: 18px;
}

.skeleton.line {
  display: block;
  width: 100%;
  height: 16px;
  border-radius: 10px;
}

.skeleton.line.short {
  width: 72%;
}

.mt-10 {
  margin-top: 10px;
}

.mt-14 {
  margin-top: 14px;
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

:global(.dark) .my-report-detail-page {
  background:
    radial-gradient(circle at top right, rgba(96, 122, 104, 0.2), transparent 28%),
    linear-gradient(180deg, #181410, #221c16);
}

:global(.dark) .back-btn,
:global(.dark) .back-home-btn,
:global(.dark) .hero-card,
:global(.dark) .content-card,
:global(.dark) .empty-wrap {
  border-color: rgba(255, 232, 205, 0.08);
  background: rgba(44, 35, 26, 0.92);
  color: #eadbc9;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.24);
}

:global(.dark) .back-btn:focus-visible,
:global(.dark) .back-home-btn:focus-visible {
  outline-color: rgba(186, 214, 190, 0.46);
}

:global(.dark) .eyebrow,
:global(.dark) .page-subtitle,
:global(.dark) .summary-label,
:global(.dark) .summary-meta,
:global(.dark) .section-hint,
:global(.dark) .soft-empty,
:global(.dark) .timeline-time {
  color: #c8b39a;
}

:global(.dark) .page-title,
:global(.dark) .summary-value,
:global(.dark) .section-title {
  color: #f8ead7;
}

:global(.dark) .summary-card,
:global(.dark) .content-block,
:global(.dark) .timeline-body {
  border-color: rgba(255, 232, 205, 0.08);
  background: rgba(73, 58, 44, 0.72);
  color: #e4cfb7;
}

:global(.dark) .soft-empty {
  border-color: rgba(255, 232, 205, 0.08);
  background: rgba(73, 58, 44, 0.52);
}

:global(.dark) .note-card.tone-resolved .content-block {
  background: rgba(53, 88, 63, 0.42);
}

:global(.dark) .note-card.tone-rejected .content-block {
  background: rgba(101, 55, 55, 0.42);
}

:global(.dark) .timeline::before {
  background: rgba(255, 232, 205, 0.08);
}

:global(.dark) .timeline-dot {
  border-color: rgba(152, 183, 156, 0.42);
  background: #3c3024;
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

:global(.dark) .skeleton {
  background: rgba(117, 98, 78, 0.44);
}

@media (max-width: 760px) {
  .page-container {
    padding-top: 16px;
    padding-left: 12px;
    padding-right: 12px;
  }

  .hero-card,
  .content-card,
  .empty-wrap {
    border-radius: 20px;
  }

  .hero-card,
  .content-card {
    padding: 18px;
  }

  .back-btn,
  .back-home-btn {
    min-height: 38px;
    padding: 0 14px;
    font-size: 12px;
  }

  .hero-top {
    flex-direction: column;
    align-items: flex-start;
  }

  .page-title {
    font-size: 26px;
  }

  .page-subtitle,
  .summary-meta,
  .section-hint,
  .timeline-note,
  .content-block,
  .soft-empty {
    font-size: 13px;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }

  .summary-value.small {
    font-size: 14px;
  }

  .timeline-item {
    gap: 10px;
  }

  .timeline-body {
    padding: 12px 14px;
  }
}
</style>
