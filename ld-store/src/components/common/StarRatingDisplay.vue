<template>
  <span class="star-rating-display" :class="[`size-${size}`]">
    <span class="star-rating-display__stars" aria-hidden="true">
      <span
        v-for="(fillPercent, index) in starFillPercents"
        :key="`star-${index + 1}`"
        class="star-rating-display__star"
      >
        <svg
          class="star-rating-display__icon is-base"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            :d="STAR_PATH"
            fill="currentColor"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.2"
          />
        </svg>
        <span class="star-rating-display__fill" :style="{ width: `${fillPercent}%` }">
          <svg
            class="star-rating-display__icon is-fill"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              :d="STAR_PATH"
              fill="currentColor"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.2"
            />
          </svg>
        </span>
      </span>
    </span>
    <span v-if="showValue" class="star-rating-display__value">{{ displayValue }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const STAR_PATH = 'M12 2.65c.36 0 .7.2.86.52l2.55 5.16a.96.96 0 0 0 .72.53l5.69.83c.8.12 1.12 1.1.54 1.66l-4.12 4.02a.96.96 0 0 0-.28.85l.97 5.67c.14.8-.7 1.42-1.42 1.04l-5.09-2.68a.96.96 0 0 0-.9 0l-5.09 2.68c-.72.38-1.56-.24-1.42-1.04l.97-5.67a.96.96 0 0 0-.28-.85L1.64 11.54c-.58-.56-.26-1.54.54-1.66l5.69-.83a.96.96 0 0 0 .72-.53l2.55-5.16c.16-.32.5-.52.86-.52Z'

const props = defineProps({
  value: {
    type: Number,
    default: 0
  },
  max: {
    type: Number,
    default: 5
  },
  size: {
    type: String,
    default: 'md'
  },
  showValue: {
    type: Boolean,
    default: false
  }
})

const safeMax = computed(() => Math.max(1, Number.parseInt(props.max, 10) || 5))
const normalizedValue = computed(() => {
  const numeric = Number(props.value)
  if (!Number.isFinite(numeric)) return 0
  const rounded = Math.round(numeric * 2) / 2
  return Math.max(0, Math.min(safeMax.value, rounded))
})
const starFillPercents = computed(() => (
  Array.from({ length: safeMax.value }, (_, index) => {
    const remaining = normalizedValue.value - index
    return Math.max(0, Math.min(100, remaining * 100))
  })
))
const displayValue = computed(() => (
  Number.isInteger(normalizedValue.value) ? normalizedValue.value.toFixed(0) : normalizedValue.value.toFixed(1)
))
</script>

<style scoped>
.star-rating-display {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.star-rating-display__stars {
  display: inline-flex;
  align-items: center;
  gap: var(--star-gap);
}

.star-rating-display__star {
  position: relative;
  width: var(--star-size);
  height: var(--star-size);
  flex-shrink: 0;
}

.star-rating-display__icon {
  display: block;
  width: 100%;
  height: 100%;
}

.star-rating-display__icon.is-base {
  color: rgba(203, 213, 225, 0.95);
}

.star-rating-display__fill {
  position: absolute;
  inset: 0 auto 0 0;
  overflow: hidden;
  height: 100%;
}

.star-rating-display__fill > .star-rating-display__icon {
  width: var(--star-size);
  height: var(--star-size);
}

.star-rating-display__icon.is-fill {
  color: #f6ad1b;
}

.star-rating-display__value {
  font-weight: 700;
  color: inherit;
  line-height: 1;
}

.size-xs {
  --star-size: 12px;
  --star-gap: 2px;
}

.size-xs .star-rating-display__value {
  font-size: 11px;
}

.size-sm {
  --star-size: 15px;
  --star-gap: 2.5px;
}

.size-sm .star-rating-display__value {
  font-size: 12px;
}

.size-md {
  --star-size: 20px;
  --star-gap: 4px;
}

.size-md .star-rating-display__value {
  font-size: 14px;
}

.size-lg {
  --star-size: 24px;
  --star-gap: 5px;
}

.size-lg .star-rating-display__value {
  font-size: 16px;
}
</style>
