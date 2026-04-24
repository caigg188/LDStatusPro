<template>
  <div ref="rootRef" class="expandable-text">
    <component
      :is="as"
      ref="contentRef"
      class="expandable-text__content"
      :class="{ 'is-clamped': isOverflowing && !isExpanded }"
      :style="clampStyle"
    >
      {{ text }}
    </component>

    <button
      v-if="isOverflowing"
      type="button"
      class="expandable-text__toggle"
      :aria-expanded="String(isExpanded)"
      @click="isExpanded = !isExpanded"
    >
      {{ isExpanded ? collapseLabel : expandLabel }}
    </button>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  text: {
    type: String,
    default: ''
  },
  as: {
    type: String,
    default: 'div'
  },
  lines: {
    type: Number,
    default: 2
  },
  expandLabel: {
    type: String,
    default: '展开'
  },
  collapseLabel: {
    type: String,
    default: '收起'
  }
})

const rootRef = ref(null)
const contentRef = ref(null)
const isExpanded = ref(false)
const isOverflowing = ref(false)

const safeLines = computed(() => Math.max(Number(props.lines || 0), 1))
const clampStyle = computed(() => ({
  WebkitLineClamp: String(safeLines.value),
  lineClamp: String(safeLines.value)
}))

let resizeObserver = null
let rafId = 0

function getLineHeight(element) {
  if (typeof window === 'undefined' || !element) return 20
  const styles = window.getComputedStyle(element)
  const lineHeight = Number.parseFloat(styles.lineHeight)
  if (Number.isFinite(lineHeight)) return lineHeight
  const fontSize = Number.parseFloat(styles.fontSize)
  return Number.isFinite(fontSize) ? fontSize * 1.5 : 20
}

function measureOverflow() {
  if (typeof window === 'undefined') return
  if (rafId) window.cancelAnimationFrame(rafId)

  rafId = window.requestAnimationFrame(() => {
    const element = contentRef.value
    if (!element) return

    const previousDisplay = element.style.display
    const previousOverflow = element.style.overflow
    const previousWebkitLineClamp = element.style.webkitLineClamp
    const previousLineClamp = element.style.lineClamp
    const previousWebkitBoxOrient = element.style.webkitBoxOrient

    element.style.display = 'block'
    element.style.overflow = 'visible'
    element.style.webkitLineClamp = 'unset'
    element.style.lineClamp = 'unset'
    element.style.webkitBoxOrient = 'initial'

    const fullHeight = element.scrollHeight
    const maxHeight = getLineHeight(element) * safeLines.value

    element.style.display = previousDisplay
    element.style.overflow = previousOverflow
    element.style.webkitLineClamp = previousWebkitLineClamp
    element.style.lineClamp = previousLineClamp
    element.style.webkitBoxOrient = previousWebkitBoxOrient

    const nextOverflowing = fullHeight - maxHeight > 1
    isOverflowing.value = nextOverflowing

    if (!nextOverflowing) {
      isExpanded.value = false
    }
  })
}

async function refreshOverflow() {
  await nextTick()
  measureOverflow()
}

watch(
  () => props.text,
  () => {
    isExpanded.value = false
    refreshOverflow()
  }
)

watch(
  () => props.lines,
  () => {
    isExpanded.value = false
    refreshOverflow()
  }
)

onMounted(async () => {
  await refreshOverflow()

  if (typeof window !== 'undefined') {
    if (window.ResizeObserver && rootRef.value) {
      resizeObserver = new window.ResizeObserver(() => {
        measureOverflow()
      })
      resizeObserver.observe(rootRef.value)
    }

    window.addEventListener('resize', measureOverflow)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    if (rafId) window.cancelAnimationFrame(rafId)
    window.removeEventListener('resize', measureOverflow)
  }

  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style scoped>
.expandable-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.expandable-text__content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.expandable-text__content.is-clamped {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
}

.expandable-text__toggle {
  margin-top: 8px;
  padding: 0;
  border: none;
  background: transparent;
  color: #6b8068;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
  align-self: flex-start;
}
</style>
