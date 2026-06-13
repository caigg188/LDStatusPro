<template>
  <div
    ref="rootRef"
    class="app-select"
    :class="[`variant-${variant}`, { open: isOpen, disabled, 'full-width': fullWidth }]"
  >
    <button
      type="button"
      class="select-trigger"
      :disabled="disabled"
      @click="toggleOpen"
    >
      <span class="select-label" :class="{ placeholder: !selectedOption }">
        {{ selectedOption?.label || placeholder }}
      </span>
      <span class="select-arrow" :class="{ open: isOpen }" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none">
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </button>

    <Transition name="select-fade">
      <div v-if="isOpen" class="select-panel">
        <button
          v-for="option in normalizedOptions"
          :key="String(option.value)"
          type="button"
          class="select-option"
          :class="{ active: option.value === modelValue, disabled: option.disabled }"
          :disabled="option.disabled"
          @click="selectOption(option)"
        >
          <span class="option-main">
            <span v-if="option.icon" class="option-icon">{{ option.icon }}</span>
            <span>{{ option.label }}</span>
          </span>
          <span v-if="option.description" class="option-description">{{ option.description }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number, Boolean],
    default: ''
  },
  options: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: '请选择'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  fullWidth: {
    type: Boolean,
    default: false
  },
  variant: {
    type: String,
    default: 'default'
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const rootRef = ref(null)
const isOpen = ref(false)

const normalizedOptions = computed(() => props.options.map((item) => ({
  value: item?.value,
  label: item?.label || String(item?.value ?? ''),
  description: item?.description || '',
  icon: item?.icon || '',
  disabled: !!item?.disabled
})))

const selectedOption = computed(() => normalizedOptions.value.find((item) => item.value === props.modelValue) || null)

function toggleOpen() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
}

function closeOpen() {
  isOpen.value = false
}

function selectOption(option) {
  if (!option || option.disabled) return
  emit('update:modelValue', option.value)
  emit('change', option)
  closeOpen()
}

function handleDocumentClick(event) {
  if (!isOpen.value) return
  if (rootRef.value && !rootRef.value.contains(event.target)) {
    closeOpen()
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    closeOpen()
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.app-select {
  position: relative;
  display: inline-flex;
  width: auto;
  min-width: 168px;
  max-width: 100%;
}

.app-select.full-width {
  display: flex;
  width: 100%;
  min-width: 0;
}

.select-trigger {
  position: relative;
  width: auto;
  min-width: 168px;
  max-width: 100%;
  min-height: 48px;
  border: 1px solid var(--app-select-trigger-border, var(--glass-border));
  border-radius: 16px;
  background: var(--app-select-trigger-bg, var(--glass-bg-medium));
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0;
  padding: 12px 42px 12px 14px;
  text-align: left;
  box-shadow: var(--app-select-trigger-shadow, 0 8px 20px var(--glass-shadow-light));
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
}

.app-select.full-width .select-trigger {
  width: 100%;
  min-width: 0;
}

.select-trigger:hover:not(:disabled),
.app-select.open .select-trigger {
  border-color: var(--app-select-trigger-hover-border, var(--color-primary));
  box-shadow: var(--app-select-trigger-hover-shadow, 0 12px 24px var(--glass-shadow));
}

.select-trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.select-label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.select-label.placeholder {
  color: var(--text-tertiary);
}

.select-arrow {
  position: absolute;
  top: 50%;
  right: 14px;
  width: 18px;
  height: 18px;
  color: var(--text-secondary);
  transform: translateY(-50%);
  transition: transform 0.22s ease, color 0.22s ease;
  pointer-events: none;
}

.select-arrow svg {
  display: block;
  width: 100%;
  height: 100%;
}

.select-arrow.open {
  transform: translateY(-50%) rotate(180deg);
}

.select-panel {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  min-width: 100%;
  width: max-content;
  max-width: min(420px, calc(100vw - 32px));
  z-index: 30;
  border: 1px solid var(--app-select-panel-border, var(--glass-border-light));
  border-radius: 18px;
  background: var(--app-select-panel-bg, var(--bg-primary));
  box-shadow: var(--app-select-panel-shadow, 0 20px 40px var(--glass-shadow));
  overflow: hidden;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.app-select.full-width .select-panel {
  right: 0;
  width: auto;
  max-width: none;
}

.app-select.variant-toolbar .select-trigger {
  min-height: 40px;
  border-radius: 10px;
  border-color: var(--app-select-toolbar-trigger-border, var(--border-color));
  background: var(--app-select-toolbar-trigger-bg, var(--bg-card));
  box-shadow: none;
  padding: 9px 38px 9px 12px;
}

.app-select.variant-toolbar .select-trigger:hover:not(:disabled),
.app-select.variant-toolbar.open .select-trigger {
  border-color: var(--app-select-toolbar-trigger-hover-border, rgba(16, 185, 129, 0.4));
  box-shadow: var(--app-select-toolbar-trigger-hover-shadow, 0 0 0 3px rgba(16, 185, 129, 0.08));
}

.app-select.variant-toolbar .select-arrow {
  right: 12px;
}

.app-select.variant-toolbar .select-panel {
  top: calc(100% + 8px);
  border-radius: 12px;
  border-color: var(--app-select-toolbar-panel-border, var(--border-light));
  background: var(--app-select-toolbar-panel-bg, var(--bg-card));
  box-shadow: var(--app-select-toolbar-panel-shadow, 0 16px 32px rgba(15, 23, 42, 0.12));
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.app-select.variant-toolbar .select-option {
  padding: 10px 12px;
}

.app-select.variant-toolbar .select-option:hover:not(:disabled),
.app-select.variant-toolbar .select-option.active {
  background: var(--app-select-toolbar-option-hover-bg, var(--color-success-bg));
}

.app-select.variant-toolbar .option-main {
  font-weight: 500;
}

.select-option {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px 14px;
  text-align: left;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.select-option + .select-option {
  border-top: 1px solid var(--app-select-option-divider, var(--glass-border-light));
}

.select-option:hover:not(:disabled),
.select-option.active {
  background: var(--app-select-option-hover-bg, rgba(196, 145, 26, 0.12));
}

.select-option.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.option-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

.option-icon {
  font-size: 16px;
}

.option-description {
  font-size: 12px;
  color: var(--text-secondary);
}

.select-fade-enter-active,
.select-fade-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.select-fade-enter-from,
.select-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
