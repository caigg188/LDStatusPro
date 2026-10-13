<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { useUserStore } from '@/stores/user';
import { useRoute, useRouter } from 'vue-router';
import { listReports, reportStates, reportDecisions } from '@/services/shop/reportService';
const session = useUserStore();
const route = useRoute(),
  router = useRouter(),
  reports = ref([]),
  stats = ref({}),
  pagination = ref({ total: 0, totalPages: 0 });
const loading = ref(false),
  error = ref('');
let generation = 0;
async function load() {
  const current = ++generation;
  loading.value = true;
  error.value = '';
  try {
    const result = await listReports({
      status: String(route.query.status || ''),
      targetType: String(route.query.type || ''),
      page: String(route.query.page || 1),
      pageSize: '20'
    });
    if (current !== generation) return;
    if (!result.success) {
      error.value = result.error;
      return;
    }
    reports.value = result.data.reports;
    stats.value = result.data.stats;
    pagination.value = result.data.pagination;
  } finally {
    if (current === generation) loading.value = false;
  }
}
function filter(key, value) {
  router.replace({ query: { ...route.query, [key]: value || undefined, page: key === 'page' ? value : undefined } });
}
watch(
  () => [route.fullPath, session.sessionKey],
  () => {
    reports.value = [];
    stats.value = {};
    load();
  },
  { immediate: true }
);
onBeforeUnmount(() => generation++);
</script>
<template>
  <main class="my-reports page-container">
    <header class="report-card">
      <h1>我的举报</h1>
      <p>跟进商品与评论举报，补充证据或申请复核。物品治理与订单售后分别处理。</p>
      <div class="summary">
        <span
          >待跟进 <strong>{{ stats.open || 0 }}</strong></span
        ><span
          >待补充 <strong>{{ stats.awaitingInfo || 0 }}</strong></span
        ><span
          >已结案 <strong>{{ stats.closed || 0 }}</strong></span
        >
      </div>
    </header>
    <div class="filters">
      <label
        >对象<select :value="route.query.type || ''" @change="filter('type', $event.target.value)">
          <option value="">全部</option>
          <option value="product">商品</option>
          <option value="comment">评论</option>
        </select></label
      ><label
        >状态<select :value="route.query.status || ''" @change="filter('status', $event.target.value)">
          <option value="">全部状态</option>
          <option v-for="(label, key) in reportStates" :key="key" :value="key">
            {{ label }}{{ key === 'rejected' ? '（未采纳）' : '' }}
          </option>
        </select></label
      >
    </div>
    <p v-if="loading" role="status">正在加载举报记录…</p>
    <div v-else-if="error" role="alert" class="report-card">{{ error }} <button @click="load">重试</button></div>
    <p v-else-if="!reports.length" class="report-card">当前筛选下暂无举报记录。</p>
    <router-link
      v-for="item in reports"
      v-else
      :key="item.targetType + ':' + item.id"
      class="report-card"
      :to="{ path: '/user/reports/' + item.targetType + '/' + item.id, query: { ...route.query } }"
      ><div class="card-header">
        <h2>{{ item.currentProductName || item.productName || '商品 #' + item.productId }}</h2>
        <span>{{ reportStates[item.status] }}{{ item.reviewPending ? ' · 复核中' : '' }}</span>
      </div>
      <p>{{ item.targetType === 'comment' ? '评论' : '商品' }}举报 #{{ item.id }} · {{ item.reportCategoryLabel }}</p>
      <p class="reason">{{ item.reportReason }}</p>
      <p v-if="item.decision">{{ reportDecisions[item.decision] }} · {{ item.adminNote }}</p>
      <small
        >提交于 {{ new Date(item.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) }} · 查看进度与结果
        →</small
      ></router-link
    >
    <nav v-if="pagination.totalPages > 1" class="pages" aria-label="举报分页">
      <button
        :disabled="loading || Number(route.query.page || 1) <= 1"
        @click="filter('page', String(Number(route.query.page || 1) - 1))"
      >
        上一页</button
      ><span>{{ route.query.page || 1 }} / {{ pagination.totalPages }} · 共 {{ pagination.total }} 条</span
      ><button
        :disabled="loading || Number(route.query.page || 1) >= pagination.totalPages"
        @click="filter('page', String(Number(route.query.page || 1) + 1))"
      >
        下一页
      </button>
    </nav>
  </main>
</template>
<style scoped>
.my-reports {
  max-width: 940px;
  padding-bottom: 80px;
  display: grid;
  gap: 16px;
}
.report-card {
  display: block;
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
  font-size: 18px;
}
p {
  margin-top: 10px;
  line-height: 1.6;
}
small {
  display: block;
  margin-top: 12px;
  color: var(--text-secondary);
}
.summary,
.filters,
.pages,
.card-header {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}
.summary {
  margin-top: 20px;
  justify-content: flex-start;
}
.summary strong {
  margin-left: 8px;
}
label {
  display: grid;
  gap: 8px;
  flex: 1;
}
select,
button {
  min-height: 44px;
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-primary);
}
.reason {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
a:focus-visible,
select:focus-visible,
button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}
</style>
