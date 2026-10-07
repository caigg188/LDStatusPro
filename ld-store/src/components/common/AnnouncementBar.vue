<script setup>
import { useRoute } from 'vue-router'
import { announcementImpression as vAnnouncementImpression } from '@/utils/announcementTelemetry'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Megaphone, ArrowRight } from '@lucide/vue'
import { useAnnouncement } from '@/composables/useAnnouncement'

const MARQUEE_SPEED_PX_PER_SECOND = 36
const MARQUEE_MIN_DURATION_MS = 8000
const MARQUEE_GAP_PX = 32

const route = useRoute()
const { announcementItems, announcementError, announcementLoading, fetchAnnouncements } = useAnnouncement()
const banner = computed(() => announcementItems.value.find(item => item.mode === 'banner'))
const bannerText = computed(() => String(banner.value?.summary || banner.value?.content || '').trim())
const viewport = ref(null)
const sizer = ref(null)
const scrolling = ref(false)
const truncated = ref(false)
const durationMs = ref(MARQUEE_MIN_DURATION_MS)

const marqueeStyle = computed(() => (
  scrolling.value ? { '--announcement-marquee-duration': `${durationMs.value}ms` } : undefined
))

let resizeObserver = null
let motionQuery = typeof window === 'undefined'
  ? null
  : window.matchMedia?.('(prefers-reduced-motion: reduce)') || null
let measureQueued = false
let disposed = false

function prefersReducedMotion() {
  return Boolean(motionQuery?.matches)
}

function measureOverflow() {
  const box = viewport.value
  const text = sizer.value
  if (!box || !text || !box.clientWidth) {
    scrolling.value = false
    truncated.value = false
    return
  }
  const overflows = text.scrollWidth - box.clientWidth > 1
  if (!overflows) {
    scrolling.value = false
    truncated.value = false
    return
  }
  if (prefersReducedMotion()) {
    scrolling.value = false
    truncated.value = true
    return
  }
  truncated.value = false
  scrolling.value = true
  const distance = text.scrollWidth + MARQUEE_GAP_PX
  durationMs.value = Math.max(
    MARQUEE_MIN_DURATION_MS,
    Math.round((distance / MARQUEE_SPEED_PX_PER_SECOND) * 1000)
  )
}

function scheduleMeasure() {
  if (disposed || measureQueued) return
  measureQueued = true
  queueMicrotask(() => {
    measureQueued = false
    if (!disposed) measureOverflow()
  })
}

function connectObserver() {
  if (typeof window === 'undefined' || !window.ResizeObserver) return
  resizeObserver?.disconnect()
  resizeObserver = new window.ResizeObserver(scheduleMeasure)
  if (viewport.value) resizeObserver.observe(viewport.value)
  if (sizer.value) resizeObserver.observe(sizer.value)
}

watch([bannerText, viewport, sizer], () => {
  scrolling.value = false
  truncated.value = false
  connectObserver()
  scheduleMeasure()
}, { flush: 'post' })

onMounted(() => {
  motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') || motionQuery
  motionQuery?.addEventListener?.('change', scheduleMeasure)
  window.addEventListener('resize', scheduleMeasure)
  document.fonts?.ready?.then(() => { if (!disposed) scheduleMeasure() })
  connectObserver()
  scheduleMeasure()
})

onBeforeUnmount(() => {
  disposed = true
  motionQuery?.removeEventListener?.('change', scheduleMeasure)
  window.removeEventListener('resize', scheduleMeasure)
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<template>
  <section
    v-if="banner"
    v-announcement-impression="{item:banner,placement:route.meta.layout === 'seller' ? 'seller' : 'storefront'}"
    class="announcement-bar"
    aria-label="站内公告"
  >
    <Megaphone :size="18" aria-hidden="true" />
    <div
      ref="viewport"
      class="announcement-marquee"
      :class="{ 'is-scrolling': scrolling, 'is-truncated': truncated }"
      :style="marqueeStyle"
    >
      <span ref="sizer" class="announcement-marquee-sizer" aria-hidden="true">{{ bannerText }}</span>
      <p class="announcement-marquee-track">
        <span class="announcement-marquee-copy">{{ bannerText }}</span>
        <span v-if="scrolling" class="announcement-marquee-copy" aria-hidden="true">{{ bannerText }}</span>
      </p>
    </div>
    <router-link :to="`/announcements/${banner.id}`">查看详情<ArrowRight :size="16" aria-hidden="true" /></router-link>
  </section>
  <p v-if="announcementError" class="announcement-refresh-status" role="status">
    公告暂未更新，稍后自动重试。
    <button :disabled="announcementLoading" @click="fetchAnnouncements(true)">重试</button>
  </p>
</template>

<style scoped>
.announcement-refresh-status {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-size-xs);
  color: var(--text-secondary-semantic);
  margin: 0;
}

.announcement-refresh-status button {
  min-height: 44px;
  padding: 0 var(--space-3);
  text-decoration: underline;
}

.announcement-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: min(calc(100% - 24px), 1180px);
  margin: var(--space-3) auto 0;
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--border-default-semantic);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
  color: var(--text-primary-semantic);
}

.announcement-bar > svg {
  flex-shrink: 0;
}

.announcement-marquee {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.announcement-marquee-sizer {
  position: absolute;
  left: 0;
  top: 0;
  white-space: nowrap;
  visibility: hidden;
  pointer-events: none;
}

.announcement-marquee-track {
  display: flex;
  width: max-content;
  max-width: 100%;
  margin: 0;
  line-height: 1.6;
  font-size: var(--text-size-sm);
}

.announcement-marquee-copy {
  flex: none;
  white-space: nowrap;
}

.announcement-marquee.is-scrolling .announcement-marquee-track {
  max-width: none;
}

.announcement-marquee.is-scrolling .announcement-marquee-copy {
  padding-inline-end: var(--space-8);
}

.announcement-marquee.is-truncated .announcement-marquee-track {
  display: block;
  width: 100%;
  max-width: 100%;
}

.announcement-marquee.is-truncated .announcement-marquee-copy {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.announcement-bar a {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 44px;
  flex-shrink: 0;
  white-space: nowrap;
  color: var(--text-link);
  font-size: var(--text-size-sm);
  text-decoration: underline;
}

.announcement-bar a:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: no-preference) {
  .announcement-marquee.is-scrolling .announcement-marquee-track {
    animation: announcement-marquee-scroll var(--announcement-marquee-duration, 12s) linear infinite;
  }

  .announcement-bar:hover .announcement-marquee.is-scrolling .announcement-marquee-track,
  .announcement-bar:focus-within .announcement-marquee.is-scrolling .announcement-marquee-track {
    animation-play-state: paused;
  }
}

@media (prefers-reduced-motion: reduce) {
  .announcement-marquee-track {
    animation: none;
  }
}

@keyframes announcement-marquee-scroll {
  to {
    transform: translateX(-50%);
  }
}

@media (max-width: 639px) {
  .announcement-bar {
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }
}
</style>
