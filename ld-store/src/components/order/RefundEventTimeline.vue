<template>
  <section v-if="orderedEvents.length" class="refund-event-timeline" aria-label="售后处理记录">
    <header class="refund-event-timeline__header">
      <div>
        <p>处理记录</p>
        <h4>售后进度</h4>
      </div>
      <span>最新进展在前</span>
    </header>

    <ol>
      <li
        v-for="(event, index) in orderedEvents"
        :key="event.id || `${event.action}-${event.createdAt}-${index}`"
        :class="`tone-${getEventMeta(event).tone}`"
      >
        <div class="refund-event__rail" aria-hidden="true">
          <span class="refund-event__marker">
            <component :is="getEventIcon(event)" :size="14" :stroke-width="2.2" />
          </span>
          <span v-if="index < orderedEvents.length - 1" class="refund-event__line"></span>
        </div>

        <article>
          <div class="refund-event__title-row">
            <strong>{{ getEventMeta(event).label }}</strong>
            <span>{{ getRefundActorLabel(event) }}</span>
          </div>
          <p v-if="event.message">{{ event.message }}</p>
          <time :datetime="toDateTimeAttribute(event.createdAt)">{{ formatRefundDate(event.createdAt) }}</time>
        </article>
      </li>
    </ol>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { normalizeTimestampMs } from '@/utils/format'
import {
  CircleCheck,
  CircleCheckBig,
  CircleX,
  Clock3,
  MessageCircleMore,
  RotateCcw,
  ShieldAlert,
  TriangleAlert
} from '@lucide/vue'
import {
  formatRefundDate,
  getRefundActorLabel,
  getRefundEventMeta
} from '@/utils/refund'

const props = defineProps({
  events: { type: Array, default: () => [] }
})

const eventIcons = Object.freeze({
  request: RotateCcw,
  contact: MessageCircleMore,
  approved: CircleCheck,
  success: CircleCheckBig,
  rejected: CircleX,
  failed: TriangleAlert,
  unknown: ShieldAlert,
  external: ShieldAlert,
  update: Clock3
})

const orderedEvents = computed(() => props.events
  .map((event, index) => ({ ...event, __index: index }))
  .sort((left, right) => {
    const leftTime = normalizeTimestampMs(left.createdAt)
    const rightTime = normalizeTimestampMs(right.createdAt)
    const timeDifference = (Number.isFinite(rightTime) ? rightTime : -Infinity)
      - (Number.isFinite(leftTime) ? leftTime : -Infinity)
    return timeDifference || Number(right.id || 0) - Number(left.id || 0) || right.__index - left.__index
  }))

function getEventMeta(event) {
  return getRefundEventMeta(event.action)
}

function getEventIcon(event) {
  return eventIcons[getEventMeta(event).icon] || Clock3
}

function toDateTimeAttribute(value) {
  const ms = normalizeTimestampMs(value)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined
}
</script>

<style scoped>
.refund-event-timeline {
  min-width: 0;
}

.refund-event-timeline__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.refund-event-timeline__header p {
  margin: 0 0 3px;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: .1em;
}

.refund-event-timeline__header h4 {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 750;
}

.refund-event-timeline__header > span {
  color: var(--text-tertiary);
  font-size: 12px;
  white-space: nowrap;
}

.refund-event-timeline ol {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.refund-event-timeline li {
  min-width: 0;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 12px;
}

.refund-event__rail {
  min-height: 100%;
  display: grid;
  grid-template-rows: 28px minmax(18px, 1fr);
  justify-items: center;
}

.refund-event__marker {
  position: relative;
  z-index: 1;
  width: 28px;
  height: 28px;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, currentColor 35%, var(--border-medium));
  border-radius: 50%;
  color: var(--color-primary-hover, var(--color-primary));
  background: color-mix(in srgb, currentColor 9%, var(--bg-card));
}

.refund-event__line {
  width: 2px;
  height: 100%;
  border-radius: 999px;
  background: var(--border-medium);
}

.refund-event-timeline article {
  min-width: 0;
  padding: 2px 0 22px;
}

.refund-event__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.refund-event__title-row strong {
  min-width: 0;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.55;
}

.refund-event__title-row span {
  flex: 0 0 auto;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 3px 8px;
  border-radius: 999px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  font-size: 11px;
  line-height: 1.35;
  white-space: nowrap;
}

.refund-event-timeline article p {
  margin: 5px 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.65;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.refund-event-timeline time {
  color: var(--text-tertiary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.tone-info .refund-event__marker { color: var(--color-info, var(--palette-hex-277da1)); }
.tone-success .refund-event__marker { color: var(--color-success, var(--palette-hex-3f7a52)); }
.tone-warning .refund-event__marker { color: var(--color-warning, var(--palette-hex-a66b24)); }
.tone-danger .refund-event__marker { color: var(--color-danger, var(--palette-hex-b54a4a)); }
.tone-neutral .refund-event__marker { color: var(--text-tertiary); }

@media (max-width: 479px) {
  .refund-event-timeline__header {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .refund-event__title-row {
    flex-direction: column;
    gap: 5px;
  }

  .refund-event__title-row span {
    max-width: 100%;
  }
}
</style>
