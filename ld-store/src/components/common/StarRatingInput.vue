<template>
  <div class="star-rating-input" :class="{ disabled, readonly }" :style="labelSlotStyle">
    <div
      ref="trackRef"
      class="star-rating-track"
      role="slider"
      :tabindex="disabled || readonly ? -1 : 0"
      aria-label="评分"
      :aria-valuemin="0"
      :aria-valuemax="max"
      :aria-valuenow="currentValue ?? 0"
      :aria-valuetext="currentValue === null ? emptyLabel : `${formatValue(currentValue)} 星`"
      @mousemove="handlePointerMove"
      @mouseleave="clearHoverValue"
      @click="commitFromEvent"
      @keydown="handleKeydown"
    >
      <StarRatingDisplay :value="currentValue ?? 0" size="lg" />
    </div>
    <div class="star-rating-meta">
      <span class="star-rating-value">{{ currentValue === null ? emptyLabel : formatValue(currentValue) }}</span>
      <button
        v-if="allowClear"
        type="button"
        class="star-rating-clear"
        :disabled="disabled || readonly || normalizedModelValue === null"
        @click="clearValue"
      >
        清空
      </button>
    </div>
    <span ref="measureRef" class="star-rating-measure" aria-hidden="true">{{ emptyLabel }}</span>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue'

const props = defineProps({
  modelValue: {
    type: Number,
    default: null
  },
  max: {
    type: Number,
    default: 5
  },
  step: {
    type: Number,
    default: 0.5
  },
  disabled: {
    type: Boolean,
    default: false
  },
  readonly: {
    type: Boolean,
    default: false
  },
  allowClear: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const emptyLabel = '未评分'
const trackRef = ref(null)
const measureRef = ref(null)
const hoverValue = ref(null)
const labelSlotWidth = ref(0)

const maxSteps = computed(() => Math.max(1, Math.round(props.max / props.step)))
const normalizedModelValue = computed(() => normalizeValue(props.modelValue, { allowNull: true }))
const currentValue = computed(() => hoverValue.value ?? normalizedModelValue.value)
const labelSlotStyle = computed(() => (
  labelSlotWidth.value > 0
    ? { '--rating-label-slot-width': `${labelSlotWidth.value}px` }
    : {}
))

function normalizeValue(value, options = {}) {
  const allowNull = !!options.allowNull
  if (value === null || value === undefined || value === '') {
    return allowNull ? null : 0
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return allowNull ? null : 0
  }

  const rounded = Math.round(numeric / props.step) * props.step
  const clamped = Math.max(0, Math.min(props.max, rounded))
  return Number(clamped.toFixed(1))
}

function formatValue(value) {
  const normalized = normalizeValue(value)
  return Number.isInteger(normalized) ? normalized.toFixed(0) : normalized.toFixed(1)
}

function resolveValueFromPointer(event) {
  const element = trackRef.value
  if (!element) return null

  const rect = element.getBoundingClientRect()
  if (!rect.width) return null

  const offsetX = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
  const ratio = offsetX / rect.width
  const stepIndex = Math.max(1, Math.min(maxSteps.value, Math.ceil(ratio * maxSteps.value)))
  return normalizeValue(stepIndex * props.step)
}

function updateValue(nextValue) {
  const normalized = normalizeValue(nextValue, { allowNull: true })
  emit('update:modelValue', normalized)
  emit('change', normalized)
}

function handlePointerMove(event) {
  if (props.disabled || props.readonly) return
  hoverValue.value = resolveValueFromPointer(event)
}

function clearHoverValue() {
  hoverValue.value = null
}

function commitFromEvent(event) {
  if (props.disabled || props.readonly) return
  const nextValue = resolveValueFromPointer(event)
  if (nextValue === null) return
  updateValue(nextValue)
}

function clearValue() {
  if (props.disabled || props.readonly) return
  clearHoverValue()
  updateValue(null)
}

function handleKeydown(event) {
  if (props.disabled || props.readonly) return

  const current = normalizedModelValue.value ?? 0

  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    event.preventDefault()
    updateValue(Math.min(props.max, current + props.step))
    return
  }

  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    event.preventDefault()
    updateValue(Math.max(0, current - props.step))
    return
  }

  if (event.key === 'Home') {
    event.preventDefault()
    updateValue(0)
    return
  }

  if (event.key === 'End') {
    event.preventDefault()
    updateValue(props.max)
    return
  }

  if ((event.key === 'Delete' || event.key === 'Backspace') && props.allowClear) {
    event.preventDefault()
    clearValue()
  }
}

function updateLabelSlotWidth() {
  const measuredWidth = Math.ceil(Number(measureRef.value?.getBoundingClientRect?.().width || 0))
  if (measuredWidth > 0) {
    labelSlotWidth.value = measuredWidth
  }
}

function handleWindowResize() {
  updateLabelSlotWidth()
}

onMounted(async () => {
  await nextTick()
  updateLabelSlotWidth()
  window.addEventListener('resize', handleWindowResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleWindowResize)
})
</script>

<style scoped>
.star-rating-input {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  position: relative;
  width: fit-content;
  max-width: 100%;
}

.star-rating-input.disabled,
.star-rating-input.readonly {
  opacity: 0.7;
}

.star-rating-track {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  outline: none;
}

.star-rating-track:focus-visible {
  border-radius: 999px;
  box-shadow: 0 0 0 3px rgba(38, 111, 63, 0.16);
}

.star-rating-input.disabled .star-rating-track,
.star-rating-input.readonly .star-rating-track {
  cursor: default;
}

.star-rating-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex-shrink: 0;
}

.star-rating-value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--rating-label-slot-width, auto);
  min-width: var(--rating-label-slot-width, auto);
  font-size: 16px;
  font-weight: 700;
  color: #8a5a20;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
}

.star-rating-clear {
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
  white-space: nowrap;
}

.star-rating-clear:hover:not(:disabled) {
  color: var(--text-secondary);
}

.star-rating-clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.star-rating-measure {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden;
  pointer-events: none;
  white-space: nowrap;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

@media (max-width: 640px) {
  .star-rating-value {
    font-size: 15px;
  }

  .star-rating-measure {
    font-size: 15px;
  }
}
</style>
