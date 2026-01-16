<template>
  <div class="category-filter" ref="filterContainer">
    <!-- 液态指示器 -->
    <div class="liquid-indicator" :style="indicatorStyle">
      <div class="liquid-glass"></div>
      <div class="liquid-shine"></div>
    </div>
    
    <!-- 全部按钮 -->
    <button
      ref="allBtn"
      :class="['filter-chip', { active: !currentCategory }]"
      @click="selectCategory('')"
    >
      <span class="chip-icon">🏷️</span>
      <span class="chip-text">全部</span>
    </button>
    
    <!-- 分类按钮 -->
    <button
      v-for="(category, index) in categories"
      :key="category.id"
      :ref="el => setCategoryRef(el, index)"
      :class="['filter-chip', { active: isActive(category.id) }]"
      @click="selectCategory(category.id)"
    >
      <span class="chip-icon">{{ category.icon || '📦' }}</span>
      <span class="chip-text">{{ category.name }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'

const props = defineProps({
  categories: {
    type: Array,
    default: () => []
  },
  currentCategory: {
    type: [String, Number],
    default: ''
  }
})

const emit = defineEmits(['select'])

const filterContainer = ref(null)
const allBtn = ref(null)
const categoryRefs = ref([])
const indicatorStyle = ref({
  transform: 'translateX(0)',
  width: '0px',
  opacity: 0
})

function setCategoryRef(el, index) {
  if (el) {
    categoryRefs.value[index] = el
  }
}

function isActive(categoryId) {
  return String(props.currentCategory) === String(categoryId)
}

function selectCategory(categoryId) {
  emit('select', categoryId)
}

// 更新指示器位置
function updateIndicator() {
  if (!filterContainer.value) return
  
  let activeEl = null
  
  // 找到当前激活的元素
  if (!props.currentCategory) {
    activeEl = allBtn.value
  } else {
    const index = props.categories.findIndex(c => 
      String(c.id) === String(props.currentCategory)
    )
    if (index >= 0) {
      activeEl = categoryRefs.value[index]
    }
  }
  
  if (!activeEl) return
  
  const containerRect = filterContainer.value.getBoundingClientRect()
  const activeRect = activeEl.getBoundingClientRect()
  const scrollLeft = filterContainer.value.scrollLeft
  
  const left = activeRect.left - containerRect.left + scrollLeft
  const width = activeRect.width
  
  indicatorStyle.value = {
    transform: `translateX(${left}px)`,
    width: `${width}px`,
    opacity: 1
  }
}

// 监听变化
watch(() => props.currentCategory, () => {
  nextTick(updateIndicator)
})

watch(() => props.categories, () => {
  nextTick(updateIndicator)
}, { deep: true })

onMounted(() => {
  nextTick(updateIndicator)
  window.addEventListener('resize', updateIndicator)
})
</script>

<style scoped>
.category-filter {
  position: relative;
  display: flex;
  gap: 4px;
  padding: 5px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  background: rgba(245, 243, 240, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 
    0 2px 12px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.category-filter::-webkit-scrollbar {
  display: none;
}

/* 液态指示器 */
.liquid-indicator {
  position: absolute;
  top: 5px;
  left: 0;
  height: calc(100% - 10px);
  border-radius: 12px;
  pointer-events: none;
  z-index: 0;
  transition: 
    transform 0.5s cubic-bezier(0.32, 1.2, 0.32, 1),
    width 0.4s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.3s ease;
}

.liquid-glass {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.98) 0%,
    rgba(252, 252, 252, 0.95) 50%,
    rgba(255, 255, 255, 0.96) 100%
  );
  border-radius: inherit;
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04),
    inset 0 2px 4px rgba(255, 255, 255, 1),
    inset 0 -1px 2px rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.9);
}

.liquid-shine {
  position: absolute;
  top: 1px;
  left: 10%;
  right: 10%;
  height: 50%;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(255, 255, 255, 0.4) 40%,
    transparent 100%
  );
  border-radius: 10px 10px 50% 50%;
  pointer-events: none;
}

/* 分类按钮 */
.filter-chip {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: transparent;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: 
    color 0.3s ease,
    transform 0.2s ease;
  white-space: nowrap;
  z-index: 1;
  -webkit-tap-highlight-color: transparent;
}

.filter-chip:hover:not(.active) {
  color: #4a4a4a;
}

.filter-chip:active {
  transform: scale(0.96);
}

.filter-chip.active {
  color: #3d3d3d;
  font-weight: 600;
}

.chip-icon {
  font-size: 15px;
  line-height: 1;
  transition: transform 0.4s cubic-bezier(0.32, 1.2, 0.32, 1);
}

.filter-chip.active .chip-icon {
  transform: scale(1.1);
}

.chip-text {
  letter-spacing: 0.3px;
}

/* 点击波纹 */
.filter-chip::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.6) 0%,
    transparent 60%
  );
  opacity: 0;
  transform: scale(0);
  transition: 
    transform 0.5s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.4s ease;
}

.filter-chip:active::before {
  transform: scale(2);
  opacity: 1;
  transition: transform 0s, opacity 0s;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .filter-chip {
    padding: 8px 14px;
    font-size: 13px;
  }
  
  .chip-icon {
    font-size: 14px;
  }
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .liquid-indicator,
  .filter-chip,
  .chip-icon {
    transition-duration: 0.01ms !important;
  }
}
</style>
