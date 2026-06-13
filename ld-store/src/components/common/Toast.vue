<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast-${toast.type}`]"
          @click="removeToast(toast.id)"
        >
          <span class="toast-icon">{{ getIcon(toast.type) }}</span>
          <span class="toast-message">{{ toast.message }}</span>
          <span v-if="toast.type === 'loading'" class="toast-spinner"></span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'

const uiStore = useUiStore()
const toasts = computed(() => uiStore.toasts)

function removeToast(id) {
  uiStore.removeToast(id)
}

function getIcon(type) {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    loading: ''
  }
  return icons[type] || 'ℹ️'
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--glass-bg-heavy);
  border-radius: 12px;
  box-shadow: var(--dropdown-shadow);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border-light);
  pointer-events: auto;
  cursor: pointer;
  max-width: 90vw;
  font-size: 14px;
  color: var(--text-primary);
}

.toast-icon {
  flex-shrink: 0;
}

.toast-message {
  word-break: break-word;
}

.toast-success {
  border-left: 3px solid var(--color-success);
}

.toast-error {
  border-left: 3px solid var(--color-danger);
}

.toast-warning {
  border-left: 3px solid var(--color-warning);
}

.toast-info {
  border-left: 3px solid var(--color-info);
}

.toast-loading {
  border-left: 3px solid var(--color-primary);
}

.toast-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-medium);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 动画 */
.toast-enter-active {
  animation: toastIn 0.3s ease-out;
}

.toast-leave-active {
  animation: toastOut 0.2s ease-in;
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes toastOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-10px) scale(0.9);
  }
}

/* 移动端适配 */
@media (max-width: 640px) {
  .toast-container {
    top: 10px;
    width: calc(100% - 20px);
    left: 10px;
    transform: none;
  }

  .toast {
    width: 100%;
    padding: 10px 16px;
    font-size: 13px;
  }
}
</style>
