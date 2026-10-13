<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { useUserStore } from '@/stores/user';
import { useRoute } from 'vue-router';
import { reportDetail, reportStates, reportDecisions } from '@/services/shop/reportService';
import ReportFollowup from '@/components/report/ReportFollowup.vue';
const session = useUserStore();
const route = useRoute(),
  detail = ref(null),
  loading = ref(false),
  error = ref('');
let generation = 0;
async function load() {
  const current = ++generation;
  loading.value = true;
  error.value = '';
  try {
    const result = await reportDetail(
      String(route.params.type || 'product'),
      String(route.params.id),
      route.query.party === 'subject'
    );
    if (current !== generation) return;
    if (!result.success) {
      detail.value = null;
      error.value = result.error;
      return;
    }
    detail.value = result.data;
  } finally {
    if (current === generation) loading.value = false;
  }
}
function date(value) {
  return value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未记录';
}
watch(
  () => [route.fullPath, session.sessionKey],
  () => {
    detail.value = null;
    load();
  },
  { immediate: true }
);
onBeforeUnmount(() => generation++);
</script>
<template>
  <main class="report-detail page-container">
    <router-link :to="{ path: '/user/reports', query: { ...route.query } }" class="back">← 返回举报列表</router-link>
    <p v-if="loading" role="status">正在加载举报进度…</p>
    <div v-else-if="error" role="alert" class="report-card">{{ error }} <button @click="load">重试</button></div>
    <template v-else-if="detail">
      <header class="report-card">
        <h1>举报 #{{ detail.report.id }}</h1>
        <p>
          {{ detail.report.targetType === 'comment' ? '评论' : '商品' }}举报 · 商品 #{{ detail.report.productId }} ·
          {{ detail.report.reportCategoryLabel }}
        </p>
        <strong>{{ reportStates[detail.report.status] }}{{ detail.report.reviewPending ? ' · 复核中' : '' }}</strong>
        <p>提交 {{ date(detail.report.createdAt) }} · 最近更新 {{ date(detail.report.updatedAt) }}</p>
      </header>
      <section class="report-card">
        <h2>原始问题说明</h2>
        <p class="content">{{ detail.report.reportReason }}</p>
        <details class="snapshot">
          <summary>提交时的内容快照</summary>
          <p v-if="detail.report.snapshot" class="content">
            {{ detail.report.snapshot.commentContent || detail.report.snapshot.description }}<br />价格
            {{ detail.report.snapshot.price }} · 内容版本 {{ detail.report.snapshot.contentVersion }}
          </p>
          <p v-else>历史记录未保存完整内容快照。</p>
        </details>
      </section>
      <section class="report-card">
        <h2>核查结论与下一步</h2>
        <p>
          {{
            reportDecisions[detail.report.decision] ||
            (detail.report.historical ? '历史已结案，未记录结构化结论' : '平台正在等待受理或继续核查')
          }}
        </p>
        <p class="content">{{ detail.report.adminNote || '平台尚未填写处理说明。' }}</p>
        <p v-if="detail.report.governanceAction && detail.report.governanceAction !== 'none'">
          治理动作：{{
            { offline: '商品已下架', delete: '商品已删除', hide_comment: '评论已隐藏' }[detail.report.governanceAction]
          }}
        </p>
        <p class="content">{{ detail.report.nextStep || '有新信息时，可在下方补充原记录或申请复核。' }}</p>
        <p v-if="detail.report.ruleVersion">适用依据：{{ detail.report.ruleVersion }}</p>
        <p>举报结案或物品下架不代表订单已退款，请以订单中的售后结果为准。</p>
        <router-link
          v-if="detail.report.orderNo"
          :to="
            '/order/' +
            encodeURIComponent(detail.report.orderNo) +
            '?role=' +
            (detail.report.orderRole || 'buyer') +
            '#order-refund'
          "
          class="action-link"
          >查看关联订单与售后</router-link
        >
      </section>
      <section class="report-card">
        <h2>处理历史</h2>
        <p v-if="!detail.events.length">历史记录未保存处理事件。</p>
        <article v-for="(event, index) in detail.events" :key="event.id || index" class="event">
          <time>{{ date(event.createdAt) }}</time>
          <p class="content">{{ event.publicNote }}</p>
          <p v-if="event.context?.disposition && event.context.disposition !== 'none'">
            历史治理动作：{{
              { offline: '商品下架', delete: '商品删除', hide_comment: '评论隐藏' }[event.context.disposition]
            }}
            · {{ event.context.ruleVersion }}
          </p>
          <p v-if="event.decision">{{ reportDecisions[event.decision] }}</p>
        </article>
      </section>
      <section class="report-card">
        <ReportFollowup
          :report="detail.report"
          :evidence="detail.evidence"
          :subject="route.query.party === 'subject'"
          @updated="load"
        />
      </section>
    </template>
  </main>
</template>
<style scoped>
.report-detail {
  max-width: 940px;
  display: grid;
  gap: 16px;
  padding-bottom: 80px;
}
.report-card {
  padding: var(--detail-pad);
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  background: var(--bg-card);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}
h1 {
  font-size: var(--text-display);
}
h2 {
  font-size: 20px;
}
p {
  margin-top: 12px;
  line-height: 1.6;
}
.content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.event {
  border-bottom: 1px solid var(--border-light);
  padding: 16px 0;
}
time {
  color: var(--text-secondary);
  font-size: 14px;
}
.snapshot {
  margin-top: 16px;
}
.back,
.action-link,
button {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 10px 16px;
  border-radius: 10px;
  color: var(--text-primary);
}
a:focus-visible,
button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}
</style>
