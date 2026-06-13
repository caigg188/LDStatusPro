<template>
  <div class="liquid-tabs" ref="tabsContainer">
    <!-- 液态背景指示器 -->
    <div 
      class="liquid-indicator"
      :style="indicatorStyle"
    >
      <div class="liquid-glass"></div>
      <div class="liquid-shine"></div>
    </div>
    
    <!-- Tab 按钮 -->
    <button
      v-for="(tab, index) in tabs"
      :key="tab.value"
      :ref="el => setTabRef(el, index)"
      :class="['liquid-tab', { active: modelValue === tab.value }]"
      @click="selectTab(tab.value)"
    >
      <span v-if="tab.icon" class="tab-icon">{{ tab.icon }}</span>
      <span class="tab-text">{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  tabs: {
    type: Array,
    required: true,
    // [{ value: 'xxx', label: '标签', icon: '🔥' }]
  },
  modelValue: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

const tabsContainer = ref(null)
const tabRefs = ref([])
const indicatorStyle = ref({
  transform: 'translateX(0)',
  width: '0px',
  opacity: 0
})

// 设置 Tab 引用
function setTabRef(el, index) {
  if (el) {
    tabRefs.value[index] = el
  }
}

// 计算当前选中的索引
const currentIndex = computed(() => {
  return props.tabs.findIndex(tab => tab.value === props.modelValue)
})

// 更新指示器位置到当前选中
function updateIndicator() {
  const index = currentIndex.value
  if (index < 0 || !tabRefs.value[index] || !tabsContainer.value) {
    indicatorStyle.value = { ...indicatorStyle.value, opacity: 0 }
    return
  }
  
  const tab = tabRefs.value[index]
  const container = tabsContainer.value
  const containerRect = container.getBoundingClientRect()
  const tabRect = tab.getBoundingClientRect()
  
  const scrollLeft = container.scrollLeft || 0
  const left = tabRect.left - containerRect.left + scrollLeft
  const width = tabRect.width
  
  indicatorStyle.value = {
    transform: `translateX(${left}px)`,
    width: `${width}px`,
    opacity: 1
  }
}

// 选择 Tab
function selectTab(value) {
  emit('update:modelValue', value)
  nextTick(() => {
    const index = props.tabs.findIndex(tab => tab.value === value)
    if (index >= 0 && tabRefs.value[index]) {
      tabRefs.value[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  })
}

// 监听值变化
watch(() => props.modelValue, () => {
  nextTick(updateIndicator)
})

// 监听 tabs 变化
watch(() => props.tabs, () => {
  nextTick(updateIndicator)
}, { deep: true })

// ResizeObserver 用于响应容器大小变化
let resizeObserver = null

// 初始化
onMounted(() => {
  nextTick(updateIndicator)
  
  // 监听容器大小变化
  if (tabsContainer.value && window.ResizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      updateIndicator()
    })
    resizeObserver.observe(tabsContainer.value)
  }
})

// 清理
onUnmounted(() => {
  resizeObserver?.disconnect()
})
</script>

<style scoped>
.liquid-tabs {
  position: relative;
  display: inline-flex;
  gap: 2px;
  padding: 5px;
  background: var(--liquid-tabs-shell-bg, var(--glass-bg-medium));
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 16px;
  box-shadow: var(
    --liquid-tabs-shell-shadow,
    0 4px 20px var(--glass-shadow),
    0 1px 3px var(--glass-shadow-light),
    inset 0 1px 0 var(--glass-shine-strong)
  );
  border: 1px solid var(--liquid-tabs-shell-border, var(--glass-border));
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
  /* 流畅的弹性过渡 */
  transition: 
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.25s ease;
}

/* 玻璃材质层 */
.liquid-glass {
  position: absolute;
  inset: 0;
  background: var(--liquid-indicator-bg, var(--glass-bg-heavy));
  border-radius: inherit;
  box-shadow: var(
    --liquid-indicator-shadow,
    0 4px 16px var(--glass-shadow),
    0 2px 8px var(--glass-shadow-light),
    inset 0 1px 2px var(--glass-shine-strong)
  );
  border: 1px solid var(--liquid-indicator-border, var(--glass-border-light));
}

/* 高光层 - 模拟玻璃反光 */
.liquid-shine {
  position: absolute;
  top: 1px;
  left: 10%;
  right: 10%;
  height: 45%;
  background: var(
    --liquid-shine-bg,
    linear-gradient(
      180deg,
      var(--glass-shine) 0%,
      rgba(255, 255, 255, 0.12) 50%,
      transparent 100%
    )
  );
  border-radius: 10px 10px 50% 50%;
  pointer-events: none;
}

/* Tab 按钮 */
.liquid-tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: transparent;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: 
    color 0.25s ease,
    transform 0.15s ease;
  z-index: 1;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.liquid-tab:hover:not(.active) {
  color: var(--text-primary);
}

.liquid-tab:active {
  transform: scale(0.97);
}

.liquid-tab.active {
  color: var(--text-primary);
  font-weight: 600;
}

/* 图标 */
.tab-icon {
  font-size: 16px;
  line-height: 1;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.liquid-tab.active .tab-icon {
  transform: scale(1.1);
}

/* 文字 */
.tab-text {
  letter-spacing: 0.3px;
}

/* 悬停时的微光效果 */
.liquid-tab::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(
    --liquid-tab-hover-overlay,
    linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.08) 0%,
      transparent 50%
    )
  );
  opacity: 0;
  transition: opacity 0.2s ease;
}

.liquid-tab:hover:not(.active)::after {
  opacity: 1;
}
/* 移动端适配 */
@media (max-width: 640px) {
  .liquid-tabs {
    width: auto;
    max-width: 100%;
    padding: 4px;
    border-radius: 14px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .liquid-tabs::-webkit-scrollbar {
    display: none;
  }

  .liquid-tab {
    flex-shrink: 0;
    justify-content: center;
    padding: 10px 14px;
    font-size: 13px;
  }
  
  .tab-icon {
    font-size: 15px;
  }

  .liquid-indicator {
    top: 4px;
    height: calc(100% - 8px);
    border-radius: 10px;
  }

  .liquid-shine {
    border-radius: 8px 8px 50% 50%;
  }
}

/* 减少动画（辅助功能） */
@media (prefers-reduced-motion: reduce) {
  .liquid-indicator,
  .liquid-tab,
  .tab-icon {
    transition-duration: 0.01ms !important;
  }
}
</style>
