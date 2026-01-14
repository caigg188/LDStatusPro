<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="dialog.visible" class="dialog-overlay" @click.self="handleCancel">
        <div class="dialog-container">
          <div class="dialog-header">
            <span v-if="dialog.icon" class="dialog-icon">{{ dialog.icon }}</span>
            <h3 class="dialog-title">{{ dialog.title }}</h3>
          </div>
          
          <div class="dialog-body" v-html="dialog.content"></div>
          
          <div class="dialog-footer">
            <button
              v-if="dialog.showCancel"
              class="dialog-btn dialog-btn-cancel"
              @click="handleCancel"
            >
              {{ dialog.cancelText }}
            </button>
            <button
              :class="['dialog-btn', 'dialog-btn-confirm', { 'danger': dialog.danger }]"
              @click="handleConfirm"
            >
              {{ dialog.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'

const uiStore = useUiStore()
const dialog = computed(() => uiStore.dialog)

function handleConfirm() {
  if (dialog.value.onConfirm) {
    dialog.value.onConfirm()
  }
}

function handleCancel() {
  if (dialog.value.onCancel) {
    dialog.value.onCancel()
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9998;
  padding: 20px;
}

.dialog-container {
  background: white;
  border-radius: 20px;
  width: 100%;
  max-width: 360px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 24px 12px;
  gap: 8px;
}

.dialog-icon {
  font-size: 40px;
  line-height: 1;
}

.dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: #3d3d3d;
  margin: 0;
}

.dialog-body {
  padding: 12px 24px 24px;
  font-size: 14px;
  color: #666;
  text-align: center;
  line-height: 1.6;
}

.dialog-body :deep(strong) {
  color: #3d3d3d;
}

.dialog-footer {
  display: flex;
  border-top: 1px solid #f0ede9;
}

.dialog-btn {
  flex: 1;
  padding: 14px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: transparent;
}

.dialog-btn-cancel {
  color: #999;
  border-right: 1px solid #f0ede9;
}

.dialog-btn-cancel:hover {
  background: #f7f5f2;
}

.dialog-btn-confirm {
  color: #b5a898;
}

.dialog-btn-confirm:hover {
  background: #faf8f6;
}

.dialog-btn-confirm.danger {
  color: #ad9090;
}

/* 动画 */
.dialog-enter-active {
  animation: dialogIn 0.25s ease-out;
}

.dialog-leave-active {
  animation: dialogOut 0.2s ease-in;
}

.dialog-enter-active .dialog-container {
  animation: dialogContainerIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-leave-active .dialog-container {
  animation: dialogContainerOut 0.2s ease-in;
}

@keyframes dialogIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes dialogOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes dialogContainerIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes dialogContainerOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}

/* 移动端适配 */
@media (max-width: 640px) {
  .dialog-overlay {
    padding: 16px;
    align-items: flex-end;
  }

  .dialog-container {
    max-width: 100%;
    margin-bottom: env(safe-area-inset-bottom, 0);
  }
}
</style>
