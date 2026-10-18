<template>
  <div v-if="hasMore || error" ref="sentinel" class="load-more" :aria-busy="loading">
    <p v-if="error" role="status">{{ error }}</p>
    <button type="button" class="load-more-btn" :disabled="loading" @click="emit('load')">
      {{ loading ? '加载中…' : error ? '重试' : '加载更多' }}
    </button>
  </div>
  <p v-else class="loaded-all" role="status">已加载全部</p>
</template>

<script setup lang="ts">
import { onActivated, onDeactivated, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  hasMore: boolean
  loading?: boolean
  error?: string
  automatic?: boolean
}>(), { loading: false, error: '', automatic: false })
const emit = defineEmits<{ load: [] }>()
const sentinel = ref<HTMLElement | null>(null)
const active = ref(true)
let observer: IntersectionObserver | null = null

function disconnect() {
  observer?.disconnect()
  observer = null
}

// Re-observe after rendering and after each page. This also fills a viewport
// whose sentinel stays visible, without automatically retrying failed requests.
watch(
  () => [sentinel.value, active.value, props.automatic, props.hasMore, props.loading, props.error],
  () => {
    disconnect()
    if (!sentinel.value || !active.value || !props.automatic || !props.hasMore || props.loading || props.error
      || typeof IntersectionObserver !== 'function') return
    observer = new IntersectionObserver(entries => {
      if (active.value && !props.loading && !props.error && props.hasMore
        && entries.some(entry => entry.target === sentinel.value && entry.isIntersecting)) emit('load')
    }, { rootMargin: '100px' })
    observer.observe(sentinel.value)
  },
  { flush: 'post' }
)

onActivated(() => { active.value = true })
onDeactivated(() => { active.value = false; disconnect() })
onUnmounted(disconnect)
</script>

<style scoped>
.load-more, .loaded-all { grid-column: 1 / -1; min-height: 64px; margin: 0; padding: 20px; text-align: center; color: var(--text-tertiary); font-size: 13px; }
.load-more p { margin: 0 0 12px; color: var(--color-danger); }
.load-more-btn { min-height: 44px; padding: 10px 28px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--bg-card); color: var(--text-primary); cursor: pointer; }
.load-more-btn:disabled { opacity: .6; cursor: wait; }
.load-more-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
</style>
