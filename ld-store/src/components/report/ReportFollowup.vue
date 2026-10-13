<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { supplementReport, attachReportEvidence, readReportEvidence } from '@/services/shop/reportService';
const props = defineProps({
  subject: Boolean,
  report: { type: Object, required: true },
  evidence: { type: Array, default: () => [] }
});
const emit = defineEmits(['updated']);
const note = ref(''),
  busy = ref(false),
  error = ref(''),
  feedback = ref(''),
  images = ref({}),
  uploadInput = ref(null);
let operation = '',
  fingerprint = '',
  fileReceipt = null,
  generation = 0;
function clearImages() {
  for (const url of Object.values(images.value)) URL.revokeObjectURL(url);
  images.value = {};
}
watch(
  () => [props.report.targetType, props.report.id, props.evidence],
  async () => {
    const current = ++generation;
    clearImages();
    for (const file of props.evidence) {
      const result = await readReportEvidence(props.report.targetType, props.report.id, file.id, props.subject);
      if (current !== generation) return;
      if (result.success) images.value[file.id] = URL.createObjectURL(result.data);
    }
  },
  { immediate: true }
);
async function send() {
  error.value = '';
  feedback.value = '';
  if (note.value.trim().length < 5) {
    error.value = '请填写至少 5 个字符的说明或新证据。';
    return;
  }
  const review = ['resolved', 'rejected'].includes(props.report.status),
    content = note.value.trim() + String(review);
  if (fingerprint !== content) {
    operation = crypto.randomUUID();
    fingerprint = content;
  }
  busy.value = true;
  try {
    const result = await supplementReport(
      props.report.targetType,
      props.report.id,
      { operationId: operation, note: note.value.trim(), review },
      props.subject
    );
    if (!result.success) {
      error.value = result.error;
      return;
    }
    feedback.value = review ? '复核申请已提交，原结论会保留在历史中。' : '补充信息已提交。';
    note.value = '';
    operation = '';
    fingerprint = '';
    emit('updated');
  } finally {
    busy.value = false;
  }
}
async function upload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  error.value = '';
  feedback.value = '';
  if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    error.value = '请选择 5 MB 以内的 PNG、JPEG 或 WebP 截图。';
    return;
  }
  const fileKey = file.name + ':' + file.size + ':' + file.lastModified;
  if (!fileReceipt || fileReceipt.key !== fileKey) fileReceipt = { key: fileKey, operationId: crypto.randomUUID() };
  busy.value = true;
  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const result = await attachReportEvidence(
      props.report.targetType,
      props.report.id,
      { operationId: fileReceipt.operationId, data },
      props.subject
    );
    if (!result.success) {
      error.value = result.error;
      return;
    }
    feedback.value = '私密截图已保存，仅你与平台核查人员可查看。';
    emit('updated');
  } catch {
    error.value = '上传结果暂不确定，可选择同一文件重试。';
  } finally {
    busy.value = false;
    event.target.value = '';
  }
}
onBeforeUnmount(() => {
  generation++;
  clearImages();
});
</script>
<template>
  <section class="followup">
    <h2>{{ ['resolved', 'rejected'].includes(report.status) ? '申请复核' : '补充信息' }}</h2>
    <p v-if="report.reviewPending">复核正在进行，请在此补充原记录。</p>
    <label
      >问题说明或新证据<textarea
        v-model="note"
        rows="4"
        minlength="5"
        maxlength="1000"
        :disabled="busy"
        placeholder="请说明需要核查的具体事实，勿填写卡密、密码或密钥"
      ></textarea>
    </label>
    <button type="button" :disabled="busy" @click="send">
      {{ busy ? '正在保存…' : ['resolved', 'rejected'].includes(report.status) ? '提交复核申请' : '提交补充说明' }}
    </button>
    <label v-if="!['resolved', 'rejected'].includes(report.status)"
      >私密截图（最多 3 张，每张 5 MB）<button
        type="button"
        :disabled="busy || evidence.length >= 3"
        @click="uploadInput.click()"
      >
        选择并上传私密截图</button
      ><input
        ref="uploadInput"
        class="private-file"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        :disabled="busy || evidence.length >= 3"
        @change="upload"
    /></label>
    <p>上传前遮盖账号密码、完整卡密、收款密钥及无关个人信息。</p>
    <div class="evidence-list">
      <div v-for="file in evidence" :key="file.id">
        <img v-if="images[file.id]" :src="images[file.id]" alt="你提交的私密证据截图" /><span v-else
          >截图暂未加载，请刷新重试。</span
        >
      </div>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="feedback" role="status">{{ feedback }}</p>
  </section>
</template>
<style scoped>
.followup {
  display: grid;
  gap: 16px;
}
label {
  display: grid;
  gap: 8px;
}
textarea,
input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
}
button {
  min-height: 44px;
  padding: 10px 16px;
  background: var(--publish-btn-bg);
  color: var(--publish-btn-color);
  border-radius: 10px;
}
.private-file {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
}
.evidence-list {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
}
img {
  max-width: 100%;
  max-height: 320px;
  object-fit: contain;
}
button:focus-visible,
textarea:focus-visible,
input:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}
</style>
