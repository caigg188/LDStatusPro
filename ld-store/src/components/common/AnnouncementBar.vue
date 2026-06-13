<template>
  <section v-if="visibleItems.length > 0" class="announcement-bar" aria-label="站内公告">
    <div class="announcement-bar__inner">
      <article
        v-for="item in visibleItems"
        :key="item.id || item.content"
        :class="['announcement-bar__item', `announcement-bar__item--${item.type}`]"
      >
        <span class="announcement-bar__icon">{{ typeIconMap[item.type] || '📢' }}</span>
        <p class="announcement-bar__text">{{ item.content }}</p>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useAnnouncement } from '@/composables/useAnnouncement'

const { announcementItems } = useAnnouncement()

const typeIconMap = {
  info: '📢',
  warning: '⚠️',
  success: '🎉'
}

const visibleItems = computed(() => announcementItems.value.filter((item) => item?.content && item.mode === 'banner'))
</script>

<style scoped>
.announcement-bar {
  width: min(100% - 24px, 1180px);
  margin: 14px auto 0;
}

.announcement-bar__inner {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.announcement-bar__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.announcement-bar__item--info {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.18);
}

.announcement-bar__item--warning {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.25);
}

.announcement-bar__item--success {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.22);
}

.announcement-bar__icon {
  flex: 0 0 auto;
  line-height: 1.4;
}

.announcement-bar__text {
  margin: 0;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 768px) {
  .announcement-bar {
    width: min(100% - 20px, 1180px);
    margin-top: 10px;
  }

  .announcement-bar__item {
    border-radius: 14px;
    padding: 11px 12px;
  }
}
</style>
