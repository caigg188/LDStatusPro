<template>
  <div class="maintenance-page">
    <div class="maintenance-card">
      <div class="maintenance-badge">系统维护中</div>
      <h1 class="maintenance-title">{{ title }}</h1>
      <p class="maintenance-message">{{ message }}</p>
      <p v-if="eta" class="maintenance-eta">预计恢复时间：{{ eta }}</p>
      <p class="maintenance-tip">
        维护期间已暂停新增和修改操作，避免产生迁移冲突数据。
      </p>
    </div>
  </div>
</template>

<script setup>
import { MAINTENANCE_ETA, MAINTENANCE_MESSAGE, MAINTENANCE_TITLE } from '@/config/maintenance';

const title = MAINTENANCE_TITLE;
const message = MAINTENANCE_MESSAGE;
const eta = MAINTENANCE_ETA;
</script>

<style scoped>
.maintenance-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at 20% 20%, rgba(82, 126, 255, 0.15), transparent 40%),
    radial-gradient(circle at 80% 80%, rgba(52, 211, 153, 0.14), transparent 38%),
    var(--bg-primary);
}

.maintenance-card {
  width: 100%;
  max-width: 680px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-secondary) 86%, white 14%);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
  padding: 32px 28px;
  text-align: center;
}

.maintenance-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
}

.maintenance-title {
  margin: 0 0 14px;
  font-size: clamp(24px, 4vw, 34px);
  line-height: 1.2;
  color: var(--text-primary);
}

.maintenance-message {
  margin: 0;
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.75;
}

.maintenance-eta {
  margin: 12px 0 0;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
}

.maintenance-tip {
  margin: 20px 0 0;
  padding-top: 18px;
  border-top: 1px dashed var(--border-color);
  color: var(--text-tertiary);
  font-size: 14px;
  line-height: 1.7;
}
</style>
