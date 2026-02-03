<template>
  <Transition name="fade-slide">
    <button 
      v-if="showButton"
      class="doodle-toggle"
      :class="{ 'is-active': isEnabled }"
      @click="toggleDoodle"
      :title="isEnabled ? '关闭涂鸦背景' : '开启涂鸦背景'"
    >
      <svg 
        class="toggle-icon" 
        width="20" 
        height="20" 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- 画笔/涂鸦图标 -->
        <path 
          d="M12 19l7-7 3 3-7 7-3-3z" 
          stroke="currentColor" 
          stroke-width="1.5" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />
        <path 
          d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" 
          stroke="currentColor" 
          stroke-width="1.5" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />
        <path 
          d="M2 2l7.586 7.586" 
          stroke="currentColor" 
          stroke-width="1.5" 
          stroke-linecap="round"
        />
        <circle 
          cx="11" 
          cy="11" 
          r="2" 
          stroke="currentColor" 
          stroke-width="1.5"
        />
        <!-- 关闭时的斜线 -->
        <Transition name="slash">
          <line 
            v-if="!isEnabled"
            x1="3" 
            y1="21" 
            x2="21" 
            y2="3" 
            stroke="currentColor" 
            stroke-width="2" 
            stroke-linecap="round"
            class="slash-line"
          />
        </Transition>
      </svg>
    </button>
  </Transition>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue'])

const isEnabled = ref(props.modelValue)
const showButton = ref(false)

// 延迟显示按钮，避免页面加载时闪烁
onMounted(() => {
  setTimeout(() => {
    showButton.value = true
  }, 500)
})

// 同步外部值
watch(() => props.modelValue, (val) => {
  isEnabled.value = val
})

function toggleDoodle() {
  isEnabled.value = !isEnabled.value
  emit('update:modelValue', isEnabled.value)
}
</script>

<style scoped>
.doodle-toggle {
  position: fixed;
  right: 20px;
  bottom: 80px; /* 留出底部导航栏空间 */
  z-index: 100;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  cursor: pointer;
  box-shadow: 
    0 2px 12px var(--glass-shadow),
    inset 0 1px 0 var(--glass-shine);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: all 0.25s ease;
}

.doodle-toggle:hover {
  transform: scale(1.05);
  box-shadow: 
    0 4px 16px var(--glass-shadow),
    inset 0 1px 0 var(--glass-shine);
  color: var(--color-primary);
}

.doodle-toggle:active {
  transform: scale(0.95);
}

.doodle-toggle.is-active {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.toggle-icon {
  transition: transform 0.3s ease;
}

.doodle-toggle:hover .toggle-icon {
  transform: rotate(-8deg);
}

.slash-line {
  stroke: var(--color-primary);
  opacity: 0.7;
}

/* 按钮出现动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.8);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.9);
}

/* 斜线动画 */
.slash-enter-active,
.slash-leave-active {
  transition: all 0.2s ease;
}

.slash-enter-from,
.slash-leave-to {
  opacity: 0;
  stroke-dashoffset: 30;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .doodle-toggle {
    right: 16px;
    bottom: 90px; /* 移动端底部导航栏更高 */
    width: 40px;
    height: 40px;
  }
  
  .toggle-icon {
    width: 18px;
    height: 18px;
  }
}

/* 减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  .doodle-toggle,
  .toggle-icon,
  .fade-slide-enter-active,
  .fade-slide-leave-active,
  .slash-enter-active,
  .slash-leave-active {
    transition: none;
  }
}
</style>
