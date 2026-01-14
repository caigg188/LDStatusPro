<template>
  <div class="skeleton-container" :style="containerStyle">
    <template v-if="type === 'card'">
      <div class="skeleton-card" v-for="n in count" :key="n">
        <div class="skeleton skeleton-image"></div>
        <div class="skeleton-content">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-price"></div>
        </div>
      </div>
    </template>
    
    <template v-else-if="type === 'list'">
      <div class="skeleton-list-item" v-for="n in count" :key="n">
        <div class="skeleton skeleton-avatar"></div>
        <div class="skeleton-info">
          <div class="skeleton skeleton-name"></div>
          <div class="skeleton skeleton-desc"></div>
        </div>
      </div>
    </template>
    
    <template v-else-if="type === 'detail'">
      <div class="skeleton skeleton-detail-image"></div>
      <div class="skeleton-detail-content">
        <div class="skeleton skeleton-detail-title"></div>
        <div class="skeleton skeleton-detail-desc" v-for="n in 3" :key="n"></div>
        <div class="skeleton skeleton-detail-price"></div>
      </div>
    </template>
    
    <template v-else>
      <div class="skeleton" :style="customStyle"></div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: 'text', // text, card, list, detail
    validator: (value) => ['text', 'card', 'list', 'detail'].includes(value)
  },
  count: {
    type: Number,
    default: 1
  },
  width: {
    type: String,
    default: '100%'
  },
  height: {
    type: String,
    default: '20px'
  },
  columns: {
    type: Number,
    default: 2
  }
})

const containerStyle = computed(() => {
  if (props.type === 'card') {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${props.columns}, 1fr)`,
      gap: '16px'
    }
  }
  return {}
})

const customStyle = computed(() => ({
  width: props.width,
  height: props.height
}))
</script>

<style scoped>
.skeleton-container {
  width: 100%;
}

.skeleton {
  background: linear-gradient(90deg, #f0ede9 25%, #e8e4de 50%, #f0ede9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* 卡片骨架 */
.skeleton-card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.skeleton-image {
  height: 140px;
  border-radius: 0;
}

.skeleton-content {
  padding: 12px;
}

.skeleton-title {
  height: 18px;
  margin-bottom: 8px;
  width: 80%;
}

.skeleton-text {
  height: 14px;
  margin-bottom: 8px;
  width: 60%;
}

.skeleton-price {
  height: 22px;
  width: 40%;
  margin-top: 8px;
}

/* 列表骨架 */
.skeleton-list-item {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 12px;
  background: white;
  border-radius: 12px;
  margin-bottom: 12px;
}

.skeleton-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skeleton-info {
  flex: 1;
}

.skeleton-name {
  height: 16px;
  width: 40%;
  margin-bottom: 8px;
}

.skeleton-desc {
  height: 14px;
  width: 70%;
}

/* 详情骨架 */
.skeleton-detail-image {
  height: 250px;
  border-radius: 0;
}

.skeleton-detail-content {
  padding: 20px;
}

.skeleton-detail-title {
  height: 24px;
  width: 70%;
  margin-bottom: 16px;
}

.skeleton-detail-desc {
  height: 14px;
  margin-bottom: 8px;
}

.skeleton-detail-desc:nth-child(2) {
  width: 90%;
}

.skeleton-detail-desc:nth-child(3) {
  width: 80%;
}

.skeleton-detail-desc:nth-child(4) {
  width: 60%;
}

.skeleton-detail-price {
  height: 32px;
  width: 30%;
  margin-top: 16px;
}
</style>
