<template>
  <span
    ref="rootRef"
    v-bind="forwardedAttrs"
    :class="['avatar-image', attrs.class, { 'avatar-image--loading': isLoading }]"
    :style="attrs.style"
    :data-avatar-state="loadState"
    :aria-busy="String(isLoading)"
  >
    <span v-if="showPlaceholder" class="avatar-image__placeholder" aria-hidden="true">
      <span class="avatar-image__shimmer"></span>
    </span>
    <img
      v-if="displaySrc"
      :src="displaySrc"
      :alt="alt"
      class="avatar-image__media"
      :referrerpolicy="referrerPolicy"
      decoding="async"
      :loading="loadingMode === 'eager' ? 'eager' : 'lazy'"
      @error="handleRenderError"
    />
  </span>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, useAttrs, watch } from 'vue'
import {
  buildAvatarCandidates,
  buildFallbackAvatar,
  getAvatarCandidateState,
  preloadAvatarCandidate,
  isAvatarCooldownError,
  getAvatarCooldownDelay,
  shouldPreferAvatarProxy
} from '@/utils/avatar'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  alt: {
    type: String,
    default: ''
  },
  src: {
    type: String,
    default: ''
  },
  candidates: {
    type: Array,
    default: () => []
  },
  seed: {
    type: String,
    default: 'user'
  },
  size: {
    type: Number,
    default: 128
  },
  loadingMode: {
    type: String,
    default: 'lazy'
  },
  referrerPolicy: {
    type: String,
    default: 'no-referrer'
  }
})

const attrs = useAttrs()
const rootRef = ref(null)
const resolvedSrc = ref('')
const loadState = ref('idle')
const isVisible = ref(props.loadingMode === 'eager')
const fallbackVisible = ref(false)

let observer = null
let loadTicket = 0
let retryTimerId = 0
let fallbackTimerId = 0
let retryDeadline = 0

const AVATAR_RETRY_WINDOW_MS = 90 * 1000
const AVATAR_FIRST_REQUEST_PLACEHOLDER_MS = 280
const AVATAR_REPEAT_REQUEST_PLACEHOLDER_MS = 110
const AVATAR_DEGRADED_PLACEHOLDER_MS = 60

const forwardedAttrs = computed(() => {
  const {
    class: _class,
    style: _style,
    alt: _alt,
    src: _src,
    loading: _loading,
    decoding: _decoding,
    referrerpolicy: _referrerpolicy,
    ...rest
  } = attrs
  return rest
})

const avatarSources = computed(() => {
  const providedCandidates = Array.isArray(props.candidates)
    ? props.candidates.filter(item => String(item || '').trim())
    : []

  if (providedCandidates.length > 0) {
    return providedCandidates
  }

  return props.src ? [props.src] : []
})

const fallbackSrc = computed(() => buildFallbackAvatar(props.seed, props.size))
const displaySrc = computed(() => resolvedSrc.value || (fallbackVisible.value ? fallbackSrc.value : ''))
const isLoading = computed(() => ['loading', 'fallback-loading', 'retrying'].includes(loadState.value))
const showPlaceholder = computed(() => isLoading.value && !displaySrc.value)

function disconnectObserver() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
}

function clearRetryTimer() {
  if (retryTimerId) {
    window.clearTimeout(retryTimerId)
    retryTimerId = 0
  }
}

function clearFallbackTimer() {
  if (fallbackTimerId) {
    window.clearTimeout(fallbackTimerId)
    fallbackTimerId = 0
  }
}

function scheduleRetry(retryAfterMs) {
  const now = Date.now()
  if (!retryDeadline) {
    retryDeadline = now + AVATAR_RETRY_WINDOW_MS
  }

  const remainingWindowMs = retryDeadline - now
  if (remainingWindowMs <= 0) {
    loadState.value = 'fallback'
    retryDeadline = 0
    clearRetryTimer()
    return
  }

  const delayMs = Math.max(1000, Math.min(retryAfterMs, remainingWindowMs))
  clearRetryTimer()
  retryTimerId = window.setTimeout(() => {
    retryTimerId = 0
    void resolveAvatar()
  }, delayMs)
}

function resetRetryState() {
  retryDeadline = 0
  clearRetryTimer()
}

function cancelPendingWork() {
  loadTicket += 1
  resetRetryState()
  clearFallbackTimer()
}

function resetAvatarState() {
  cancelPendingWork()
  resolvedSrc.value = ''
  fallbackVisible.value = false
  loadState.value = 'idle'
}

function setupObserver() {
  disconnectObserver()

  if (props.loadingMode === 'eager' || typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    isVisible.value = true
    return
  }

  if (!rootRef.value) return

  observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting || entry.intersectionRatio > 0)) {
      isVisible.value = true
      disconnectObserver()
    }
  }, {
    rootMargin: '160px 0px'
  })

  observer.observe(rootRef.value)
}

function getResolvedCandidates() {
  const sources = avatarSources.value
  if (sources.length === 0) return []

  return buildAvatarCandidates(sources, props.size, {
    includeProxy: true,
    preferProxy: shouldPreferAvatarProxy(sources, props.size)
  })
}

function inspectCandidates(candidates) {
  return candidates.reduce((summary, candidate) => {
    const state = getAvatarCandidateState(candidate, props.size)

    if (state.isLoaded) {
      summary.hasLoaded = true
    }
    if (state.hasRequested) {
      summary.hasRequested = true
    }
    if (state.isCoolingDown) {
      summary.hasCooldown = true
      summary.shortestRetryAfterMs = summary.shortestRetryAfterMs > 0
        ? Math.min(summary.shortestRetryAfterMs, state.retryAfterMs)
        : state.retryAfterMs
    }
    if (state.isOriginDegraded || state.failureCount > 0) {
      summary.isDegraded = true
    }

    return summary
  }, {
    hasLoaded: false,
    hasRequested: false,
    hasCooldown: false,
    isDegraded: false,
    shortestRetryAfterMs: 0
  })
}

function getPlaceholderDelayMs(context) {
  if (context.hasLoaded) return -1
  if (context.hasCooldown || context.isDegraded) return AVATAR_DEGRADED_PLACEHOLDER_MS
  if (context.hasRequested) return AVATAR_REPEAT_REQUEST_PLACEHOLDER_MS
  return AVATAR_FIRST_REQUEST_PLACEHOLDER_MS
}

function scheduleFallbackReveal(ticket, delayMs) {
  if (fallbackVisible.value || resolvedSrc.value) return

  const reveal = () => {
    if (ticket !== loadTicket || resolvedSrc.value) return
    fallbackVisible.value = true
    if (loadState.value === 'loading') {
      loadState.value = 'fallback-loading'
    }
  }

  if (delayMs <= 0) {
    reveal()
    return
  }

  clearFallbackTimer()
  fallbackTimerId = window.setTimeout(() => {
    fallbackTimerId = 0
    reveal()
  }, delayMs)
}

async function resolveAvatar() {
  const ticket = ++loadTicket
  const candidates = getResolvedCandidates()
  clearRetryTimer()
  clearFallbackTimer()

  if (!isVisible.value) {
    resetAvatarState()
    return
  }

  if (candidates.length === 0) {
    resolvedSrc.value = ''
    fallbackVisible.value = true
    loadState.value = 'fallback'
    resetRetryState()
    return
  }

  const context = inspectCandidates(candidates)
  const keepExistingFallback = fallbackVisible.value
  if (!keepExistingFallback) {
    fallbackVisible.value = false
    resolvedSrc.value = ''
  }

  loadState.value = keepExistingFallback ? 'fallback-loading' : 'loading'
  const placeholderDelayMs = getPlaceholderDelayMs(context)
  if (placeholderDelayMs >= 0) {
    scheduleFallbackReveal(ticket, placeholderDelayMs)
  }

  let shortestRetryAfterMs = context.shortestRetryAfterMs

  for (const candidate of candidates) {
    try {
      await preloadAvatarCandidate(candidate)
      if (ticket !== loadTicket) return
      clearFallbackTimer()
      resolvedSrc.value = candidate
      fallbackVisible.value = true
      loadState.value = 'loaded'
      resetRetryState()
      return
    } catch (error) {
      if (isAvatarCooldownError(error)) {
        const retryAfterMs = getAvatarCooldownDelay(error)
        shortestRetryAfterMs = shortestRetryAfterMs > 0
          ? Math.min(shortestRetryAfterMs, retryAfterMs)
          : retryAfterMs
      }
      continue
    }
  }

  if (ticket !== loadTicket) return
  clearFallbackTimer()
  resolvedSrc.value = ''
  fallbackVisible.value = true
  if (shortestRetryAfterMs > 0) {
    loadState.value = 'retrying'
    scheduleRetry(shortestRetryAfterMs)
    return
  }
  loadState.value = 'fallback'
  resetRetryState()
}

function handleRenderError() {
  if (resolvedSrc.value === fallbackSrc.value) return
  resolvedSrc.value = ''
  fallbackVisible.value = true
  loadState.value = 'fallback'
  resetRetryState()
}

watch(avatarSources, () => {
  if (!isVisible.value) {
    resetAvatarState()
    return
  }
  resetRetryState()
  void resolveAvatar()
}, { deep: true })

watch(() => props.size, () => {
  if (!isVisible.value) {
    resetAvatarState()
    return
  }
  resetRetryState()
  void resolveAvatar()
})

watch(() => props.loadingMode, () => {
  isVisible.value = props.loadingMode === 'eager'
  setupObserver()
  if (isVisible.value) {
    void resolveAvatar()
    return
  }
  resetAvatarState()
})

watch(isVisible, (visible) => {
  if (visible) {
    void resolveAvatar()
    return
  }
  resetAvatarState()
})

onMounted(() => {
  setupObserver()
  if (isVisible.value) {
    void resolveAvatar()
  }
})

onUnmounted(() => {
  cancelPendingWork()
  disconnectObserver()
})
</script>

<style scoped>
.avatar-image {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: inherit;
  background: rgba(148, 163, 184, 0.16);
  vertical-align: middle;
  line-height: 0;
  isolation: isolate;
}

.avatar-image__placeholder,
.avatar-image__media {
  position: absolute;
  inset: 0;
}

.avatar-image__placeholder {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0)),
    rgba(15, 23, 42, 0.04);
}

.avatar-image__shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 18%, rgba(255, 255, 255, 0.52) 50%, transparent 82%);
  transform: translateX(-100%);
  animation: avatar-shimmer 1.6s ease-in-out infinite;
}

.avatar-image__media {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

@keyframes avatar-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
