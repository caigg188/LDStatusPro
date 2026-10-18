<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useUserStore } from '@/stores/user';
import { submitReport, reportCategories } from '@/services/shop/reportService';
const props = defineProps({
  open: Boolean,
  targetType: { type: String, default: 'product' },
  objectId: { type: [String, Number], required: true },
  objectName: { type: String, default: '' },
  orderNo: { type: String, default: '' }
});
const session = useUserStore();
const emit = defineEmits(['close', 'busy']);
const modal = ref(null),
  category = ref(''),
  reason = ref(''),
  order = ref(props.orderNo),
  busy = ref(false),
  error = ref(''),
  receipt = ref(null);
let returnFocus,
  token = '',
  fingerprint = '',
  ownsScrollLock = false;
const categories = computed(() =>
  props.targetType === 'comment'
    ? ['privacy', 'harassment', 'promotion', 'factual_dispute', 'other']
    : ['delivery_issue', 'content_mismatch', 'promotion', 'fraud_risk', 'purchase_flow_issue', 'other']
);
const hint = computed(
  () =>
    ({
      delivery_issue: '请提供订单号、发生时间及具体报错；请勿填写完整卡密或密码。',
      factual_dispute: '请指出具体争议内容，并说明事实依据。低分或负面体验本身不属于违规。',
      privacy: '请指出泄露位置，不要在说明中重复粘贴敏感信息。',
      promotion: '请说明何处要求站外交易或推广，与物品描述有哪些差异。'
    })[category.value] || '请说明具体问题与发生时间。无需购买也能反馈公开违规。'
);
function close() {
  if (!busy.value) emit('close');
}
function keyboard(event) {
  if (!props.open) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  }
  if (event.key === 'Tab') {
    const nodes = [
      ...modal.value.querySelectorAll(
        'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]'
      )
    ];
    if (!nodes.length) return;
    if (event.shiftKey && document.activeElement === nodes[0]) {
      event.preventDefault();
      nodes.at(-1).focus();
    }
    if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
      event.preventDefault();
      nodes[0].focus();
    }
  }
}
async function submit() {
  error.value = '';
  if (!category.value || reason.value.trim().length < 5) {
    error.value = '请选择分类，并填写至少 5 个字符的问题说明。';
    return;
  }
  const body = { reason: reason.value.trim(), category: category.value, orderNo: order.value.trim() };
  const content = JSON.stringify(body);
  if (content !== fingerprint) {
    token = crypto.randomUUID();
    fingerprint = content;
  }
  busy.value = true;
  emit('busy', true);
  try {
    const result = await submitReport(props.targetType, props.objectId, { ...body, submissionToken: token });
    if (!result.success) {
      if (result.errorCode === 'DUPLICATE_REPORT' && result.details?.reportId) {
        receipt.value = {
          reportId: result.details.reportId,
          targetType: result.details.targetType || props.targetType,
          duplicate: true
        };
        return;
      }
      error.value = result.error + '。填写内容已保留，可核对后重试。';
      return;
    }
    receipt.value = result.data;
  } catch {
    error.value = '请求结果暂不确定，内容已保留。重试会核对同一次请求。';
  } finally {
    busy.value = false;
    emit('busy', false);
  }
}
watch(
  () => props.open,
  async (value) => {
    if (value) {
      returnFocus = document.activeElement;
      ownsScrollLock = document.body.style.overflow !== 'hidden';
      if (ownsScrollLock) document.body.style.overflow = 'hidden';
      order.value = props.orderNo;
      receipt.value = null;
      error.value = '';
      category.value = '';
      reason.value = '';
      token = '';
      fingerprint = '';
      document.addEventListener('keydown', keyboard, true);
      await nextTick();
      modal.value?.querySelector('select')?.focus();
    } else {
      if (ownsScrollLock) document.body.style.overflow = '';
      ownsScrollLock = false;
      document.removeEventListener('keydown', keyboard, true);
      returnFocus?.focus?.();
    }
  },
  { immediate: true }
);
watch(
  () => session.sessionKey,
  () => {
    receipt.value = null;
    reason.value = '';
    error.value = '';
    token = '';
    fingerprint = '';
    emit('close');
  }
);
onBeforeUnmount(() => {
  document.removeEventListener('keydown', keyboard, true);
  if (ownsScrollLock) document.body.style.overflow = '';
});
</script>
<template>
  <Teleport to="body">
    <div v-if="open" class="report-overlay" @click.self="close">
      <section
        ref="modal"
        class="report-composer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-compose-title"
      >
        <header>
          <h2 id="report-compose-title">{{ targetType === 'comment' ? '举报评论' : '反馈物品问题' }}</h2>
          <button type="button" aria-label="关闭举报" :disabled="busy" @click="close">×</button>
        </header>
        <p>{{ objectName }} · {{ targetType === 'comment' ? '评论' : '商品' }} #{{ objectId }}</p>
        <div v-if="receipt" role="status">
          <h3>{{ receipt.duplicate ? '已有举报正在处理' : '举报已提交' }}</h3>
          <p>举报编号 #{{ receipt.reportId }}。可在原记录补充说明和私密截图；物品治理与订单售后分别跟进。</p>
          <router-link
            class="report-link"
            :to="'/user/reports/' + receipt.targetType + '/' + receipt.reportId"
            @click="close"
            >查看进度 / 补充证据</router-link
          >
        </div>
        <form v-else @submit.prevent="submit">
          <label
            >问题分类<select v-model="category" required :disabled="busy">
              <option value="" disabled>请选择问题类型</option>
              <option v-for="value in categories" :key="value" :value="value">{{ reportCategories[value] }}</option>
            </select></label
          >
          <p class="report-hint">{{ hint }}</p>
          <label
            >详细说明<textarea
              v-model="reason"
              rows="5"
              minlength="5"
              maxlength="500"
              required
              :disabled="busy"
              placeholder="请描述你遇到的问题"
            ></textarea>
          </label>
          <span>{{ reason.trim().length }}/500</span>
          <label
            >关联订单号（可选）<input
              v-model.trim="order"
              maxlength="80"
              :disabled="busy"
              placeholder="仅可关联自己的同商品订单"
          /></label>
          <p class="report-hint">
            举报信息仅用于平台核查。不要填写完整卡密、账号密码或收款密钥；截图可在提交后私密补充。
          </p>
          <p v-if="error" role="alert">{{ error }}</p>
          <button class="report-submit" type="submit" :disabled="busy">{{ busy ? '正在提交…' : '提交举报' }}</button>
        </form>
      </section>
    </div>
  </Teleport>
</template>
<style scoped>
.report-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 16px;
  background: var(--overlay-bg);
}
.report-composer {
  width: min(100%, 560px);
  max-height: 90dvh;
  overflow-y: auto;
  padding: var(--detail-pad);
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--card-radius);
  box-shadow: var(--shadow-lg);
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
h2 {
  font-size: 20px;
}
form,
label {
  display: grid;
  gap: 8px;
}
form {
  gap: 16px;
  margin-top: 16px;
}
input,
select,
textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
}
button,
.report-link {
  min-height: 44px;
  padding: 10px 16px;
  border-radius: 10px;
}
.report-submit,
.report-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--publish-btn-bg);
  color: var(--publish-btn-color);
}
.report-hint {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
}
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}
</style>
