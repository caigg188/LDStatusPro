<template>
  <Teleport to="body">
    <Transition name="announcement-popup">
      <div
        v-if="activePopup"
        class="announcement-popup__overlay"
        @click.self="dismissForSession"
      >
        <div class="announcement-popup__card" role="dialog" aria-modal="true" aria-label="站内公告">
          <div class="announcement-popup__header">
            <div class="announcement-popup__meta">
              <span class="announcement-popup__icon">{{ typeIconMap[activePopup.type] || '📢' }}</span>
              <div class="announcement-popup__title-block">
                <p class="announcement-popup__eyebrow">{{ typeLabelMap[activePopup.type] || '站内公告' }}</p>
                <h3 class="announcement-popup__title">{{ activePopup.title || popupTitleMap[activePopup.type] || '公告提醒' }}</h3>
              </div>
            </div>
            <button
              class="announcement-popup__close"
              type="button"
              aria-label="本次关闭公告"
              @click="dismissForSession"
            >×</button>
          </div>
          <div class="announcement-popup__body" v-html="renderedContent"></div>
          <div class="announcement-popup__footer">
            <p class="announcement-popup__hint">右上角关闭仅对本次访问生效</p>
            <div class="announcement-popup__actions">
              <button
                type="button"
                class="announcement-popup__button announcement-popup__button--ghost"
                @click="dismissForToday"
              >
                今日关闭
              </button>
              <button type="button" class="announcement-popup__button" @click="dismissForever">永久关闭</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useAnnouncement } from '@/composables/useAnnouncement'
import { renderAnnouncementContent } from '@/utils/renderAnnouncementContent'

const { announcementItems } = useAnnouncement()
const sessionDismissedKeys = ref(new Set())

const typeIconMap = {
  info: '📢',
  warning: '⚠️',
  success: '🎉'
}

const typeLabelMap = {
  info: '站内公告',
  warning: '重要提醒',
  success: '最新动态'
}

const popupTitleMap = {
  info: '公告提醒',
  warning: '重要提醒',
  success: '好消息'
}

function buildReadKey(item) {
  return `ld-shop-popup-read:${item.popupDismissKey || `popup-${item.id}`}`
}

function getEndOfDay() {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return end.getTime()
}

function parseDismissRecord(raw) {
  if (!raw) return null
  if (raw === 'permanent') {
    return { mode: 'forever' }
  }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed
    }
  } catch (_) {
    if (/^\d+$/.test(raw)) {
      return { mode: 'forever', dismissedAt: Number(raw) }
    }
  }
  return null
}

function markSessionDismissed(item) {
  const key = buildReadKey(item)
  sessionDismissedKeys.value = new Set([...sessionDismissedKeys.value, key])
}

function isDismissed(item) {
  const key = buildReadKey(item)
  if (sessionDismissedKeys.value.has(key)) {
    return true
  }

  try {
    const record = parseDismissRecord(localStorage.getItem(key))
    if (!record) return false
    if (record.mode === 'forever') {
      return true
    }
    if (record.mode === 'today') {
      const expiresAt = Number(record.expiresAt || 0)
      if (expiresAt > Date.now()) {
        return true
      }
      localStorage.removeItem(key)
    }
  } catch (_) {
    return false
  }

  return false
}

function markDismissed(item, record) {
  markSessionDismissed(item)
  try {
    localStorage.setItem(buildReadKey(item), JSON.stringify(record))
  } catch (_) {
  }
}

const activePopup = computed(() => announcementItems.value.find((item) => {
  if (!item || item.mode !== 'popup' || !item.content) return false
  return !isDismissed(item)
}) || null)

const renderedContent = computed(() => {
  if (!activePopup.value) return ''
  return renderAnnouncementContent(activePopup.value.content, activePopup.value.contentType)
})

function dismissForSession() {
  if (!activePopup.value) return
  markSessionDismissed(activePopup.value)
}

function dismissForToday() {
  if (!activePopup.value) return
  markDismissed(activePopup.value, {
    mode: 'today',
    expiresAt: getEndOfDay(),
    dismissedAt: Date.now()
  })
}

function dismissForever() {
  if (!activePopup.value) return
  markDismissed(activePopup.value, {
    mode: 'forever',
    dismissedAt: Date.now()
  })
}
</script>

<style scoped>
.announcement-popup__overlay {
  position: fixed;
  inset: 0;
  z-index: 9997;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at top, rgba(181, 168, 152, 0.18), transparent 45%),
    rgba(61, 61, 61, 0.16);
  backdrop-filter: blur(10px);
}

.announcement-popup__card {
  position: relative;
  width: min(100%, 720px);
  max-height: min(84vh, 780px);
  overflow: auto;
  border-radius: 28px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 24%, var(--border-light));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(250, 249, 247, 0.96));
  box-shadow:
    0 24px 80px rgba(61, 61, 61, 0.14),
    0 8px 28px rgba(181, 168, 152, 0.12);
}

.announcement-popup__card::before {
  content: '';
  position: sticky;
  top: 0;
  display: block;
  height: 5px;
  background: linear-gradient(90deg, #d8cbbb, var(--color-primary), #c9b7a2);
}

.announcement-popup__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 28px 28px 18px;
}

.announcement-popup__meta {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.announcement-popup__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(181, 168, 152, 0.18), rgba(216, 203, 187, 0.3));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
  font-size: 24px;
}

.announcement-popup__title-block {
  min-width: 0;
}

.announcement-popup__eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-primary) 78%, #7d6c59);
}

.announcement-popup__title {
  margin: 0;
  color: var(--text-primary);
  font-size: 24px;
  line-height: 1.35;
}

.announcement-popup__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--border-light));
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.76);
  color: var(--text-secondary);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;
}

.announcement-popup__close:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--color-primary) 36%, var(--border-light));
  background: #ffffff;
  color: var(--text-primary);
}

.announcement-popup__body {
  padding: 0 28px 26px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.announcement-popup__body :deep(h1),
.announcement-popup__body :deep(h2),
.announcement-popup__body :deep(h3),
.announcement-popup__body :deep(h4) {
  margin: 0 0 14px;
  color: var(--text-primary);
  line-height: 1.35;
}

.announcement-popup__body :deep(p) {
  margin: 0 0 14px;
}

.announcement-popup__body :deep(ul),
.announcement-popup__body :deep(ol) {
  margin: 0 0 14px;
  padding-left: 22px;
}

.announcement-popup__body :deep(li + li) {
  margin-top: 8px;
}

.announcement-popup__body :deep(a) {
  color: color-mix(in srgb, var(--color-primary) 72%, #7c6041);
  text-decoration: underline;
  text-underline-offset: 3px;
  word-break: break-word;
}

.announcement-popup__body :deep(blockquote) {
  margin: 0 0 14px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid rgba(181, 168, 152, 0.18);
  border-left: 4px solid var(--color-primary);
  background: rgba(181, 168, 152, 0.08);
  color: var(--text-primary);
}

.announcement-popup__body :deep(code),
.announcement-popup__body :deep(pre) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.announcement-popup__body :deep(code) {
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(181, 168, 152, 0.12);
  color: var(--text-primary);
}

.announcement-popup__body :deep(pre) {
  margin: 0 0 14px;
  padding: 14px 16px;
  overflow: auto;
  border-radius: 16px;
  border: 1px solid rgba(181, 168, 152, 0.16);
  background: rgba(250, 249, 247, 0.96);
}

.announcement-popup__body :deep(table) {
  width: 100%;
  margin: 0 0 14px;
  border-collapse: collapse;
  overflow: hidden;
  border-radius: 14px;
  border-style: hidden;
  box-shadow: 0 0 0 1px rgba(181, 168, 152, 0.18);
}

.announcement-popup__body :deep(th),
.announcement-popup__body :deep(td) {
  padding: 10px 12px;
  text-align: left;
  border: 1px solid rgba(181, 168, 152, 0.18);
}

.announcement-popup__body :deep(th) {
  background: rgba(181, 168, 152, 0.1);
  color: var(--text-primary);
}

.announcement-popup__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 28px 28px;
}

.announcement-popup__hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.announcement-popup__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.announcement-popup__button {
  min-width: 120px;
  border: 1px solid transparent;
  border-radius: 14px;
  padding: 12px 18px;
  background: linear-gradient(135deg, #c8b9a6, var(--color-primary));
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(181, 168, 152, 0.18);
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
}

.announcement-popup__button:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 28px rgba(181, 168, 152, 0.24);
}

.announcement-popup__button--ghost {
  border-color: rgba(181, 168, 152, 0.26);
  background: rgba(255, 255, 255, 0.78);
  color: var(--text-primary);
  box-shadow: none;
}

.announcement-popup-enter-active,
.announcement-popup-leave-active {
  transition: opacity 0.2s ease;
}

.announcement-popup-enter-from,
.announcement-popup-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .announcement-popup__overlay {
    padding: 14px;
    align-items: flex-end;
  }

  .announcement-popup__card {
    width: 100%;
    max-height: min(88vh, 760px);
    border-radius: 24px 24px 20px 20px;
  }

  .announcement-popup__header {
    padding: 22px 18px 14px;
  }

  .announcement-popup__body {
    padding: 0 18px 20px;
  }

  .announcement-popup__footer {
    padding: 0 18px 18px;
    flex-direction: column;
    align-items: stretch;
  }

  .announcement-popup__title {
    font-size: 20px;
  }

  .announcement-popup__actions {
    flex-direction: column;
  }

  .announcement-popup__button {
    width: 100%;
  }

  .announcement-popup__hint {
    text-align: center;
  }
}
</style>
