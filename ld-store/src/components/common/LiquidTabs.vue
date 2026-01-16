<template>
  <div class="liquid-tabs" ref="tabsContainer">
    <!-- 液态背景指示器 -->
    <div 
      class="liquid-indicator"
      :style="indicatorStyle"
    >
      <div class="liquid-glass"></div>
      <div class="liquid-shine"></div>
      <div class="liquid-glow"></div>
    </div>
    
    <!-- Tab 按钮 -->
    <button
      v-for="(tab, index) in tabs"
      :key="tab.value"
      :ref="el => setTabRef(el, index)"
      :class="['liquid-tab', { active: modelValue === tab.value }]"
      @click="selectTab(tab.value)"
      @mouseenter="handleHover(index)"
      @mouseleave="handleLeave"
    >
      <span v-if="tab.icon" class="tab-icon">{{ tab.icon }}</span>
      <span class="tab-text">{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'

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

// 更新指示器位置
function updateIndicator() {
  const index = currentIndex.value
  if (index < 0 || !tabRefs.value[index] || !tabsContainer.value) return
  
  const tab = tabRefs.value[index]
  const container = tabsContainer.value
  const containerRect = container.getBoundingClientRect()
  const tabRect = tab.getBoundingClientRect()
  
  const left = tabRect.left - containerRect.left
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
}

// 悬停效果
const isHovering = ref(false)
const hoverIndex = ref(-1)

function handleHover(index) {
  isHovering.value = true
  hoverIndex.value = index
}

function handleLeave() {
  isHovering.value = false
  hoverIndex.value = -1
}

// 监听值变化
watch(() => props.modelValue, () => {
  nextTick(updateIndicator)
})

// 监听 tabs 变化
watch(() => props.tabs, () => {
  nextTick(updateIndicator)
}, { deep: true })

// 初始化
onMounted(() => {
  nextTick(updateIndicator)
  // 窗口大小变化时更新
  window.addEventListener('resize', updateIndicator)
})
</script>

<style scoped>
.liquid-tabs {
  position: relative;
  display: inline-flex;
  gap: 2px;
  padding: 5px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-radius: 18px;
  box-shadow: 
    0 4px 24px rgba(0, 0, 0, 0.06),
    0 1px 4px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 -1px 0 rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

/* 液态指示器 */
.liquid-indicator {
  position: absolute;
  top: 5px;
  left: 0;
  height: calc(100% - 10px);
  border-radius: 14px;
  pointer-events: none;
  z-index: 0;
  /* 核心：苹果风格的弹性过渡 */
  transition: 
    transform 0.6s cubic-bezier(0.32, 1.2, 0.32, 1),
    width 0.45s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.3s ease;
}

/* 玄璃材质层 - 白色透明 */
.liquid-glass {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(250, 250, 250, 0.9) 40%,
    rgba(255, 255, 255, 0.92) 100%
  );
  border-radius: inherit;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 4px 16px rgba(0, 0, 0, 0.05),
    inset 0 2px 4px rgba(255, 255, 255, 0.9),
    inset 0 -1px 2px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.8);
}

/* 高光层 - 模拟玻璃反光 */
.liquid-shine {
  position: absolute;
  top: 1px;
  left: 8%;
  right: 8%;
  height: 50%;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.8) 0%,
    rgba(255, 255, 255, 0.3) 40%,
    transparent 100%
  );
  border-radius: 12px 12px 50% 50%;
  pointer-events: none;
}

/* 液态光晕效果 */
.liquid-glow {
  position: absolute;
  inset: -4px;
  background: radial-gradient(
    ellipse 120% 80% at center,
    rgba(255, 255, 255, 0.6) 0%,
    rgba(255, 255, 255, 0.2) 40%,
    transparent 70%
  );
  border-radius: inherit;
  filter: blur(12px);
  opacity: 0;
  transition: opacity 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

.liquid-tabs:hover .liquid-glow {
  opacity: 1;
}

/* Tab 按钮 */
.liquid-tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px;
  background: transparent;
  border: none;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: 
    color 0.35s ease,
    transform 0.2s ease;
  z-index: 1;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
}

.liquid-tab:hover:not(.active) {
  color: #4a4a4a;
}

.liquid-tab:active {
  transform: scale(0.97);
}

.liquid-tab.active {
  color: #3d3d3d;
  font-weight: 600;
  text-shadow: none;
}

.tab-icon {
  font-size: 18px;
  line-height: 1;
  transition: transform 0.4s cubic-bezier(0.32, 1.2, 0.32, 1);
}

.liquid-tab.active .tab-icon {
  transform: scale(1.15);
}

.tab-text {
  transition: transform 0.3s ease;
  letter-spacing: 0.3px;
}

/* 点击时的波纹效果 */
.liquid-tab::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(
    circle at var(--ripple-x, 50%) var(--ripple-y, 50%),
    rgba(255, 255, 255, 0.4) 0%,
    transparent 60%
  );
  opacity: 0;
  transform: scale(0);
  transition: 
    transform 0.6s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.4s ease;
}

.liquid-tab:active::before {
  transform: scale(2.5);
  opacity: 1;
  transition: transform 0s, opacity 0s;
}

/* 悬停时的微光效果 */
.liquid-tab::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.1) 0%,
    transparent 50%,
    rgba(0, 0, 0, 0.02) 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.liquid-tab:hover:not(.active)::after {
  opacity: 1;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .liquid-tabs {
    width: auto;
    max-width: 100%;
  }
  
  .liquid-tab {
    flex: 1;
    justify-content: center;
    padding: 12px 16px;
    font-size: 14px;
  }
  
  .tab-icon {
    font-size: 16px;
  }
}

/* 减少动画（辅助功能） */
@media (prefers-reduced-motion: reduce) {
  .liquid-indicator,
  .liquid-tab,
  .tab-icon,
  .liquid-glow {
    transition-duration: 0.01ms !important;
  }
}
</style>
