<template>
  <div class="theme-toggle" ref="toggleRef">
    <button 
      class="theme-btn"
      @click="toggleMenu"
      :title="themeModeText"
    >
      <span class="theme-icon" v-html="themeIconSvg"></span>
      <span class="theme-text" v-if="showText">{{ themeModeText }}</span>
      <svg 
        v-if="showArrow"
        class="arrow-icon" 
        :class="{ open: showMenu }"
        width="12" 
        height="12" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
    
    <!-- 下拉菜单 -->
    <Transition name="menu">
      <div v-if="showMenu" class="theme-menu">
        <button 
          v-for="option in themeOptions" 
          :key="option.value"
          :class="['menu-item', { active: themeMode === option.value }]"
          @click="selectTheme(option.value)"
        >
          <span class="menu-icon" v-html="option.icon"></span>
          <span class="menu-text">{{ option.label }}</span>
          <svg v-if="themeMode === option.value" class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTheme, THEME_MODES } from '@/composables/useTheme'

const props = defineProps({
  showText: {
    type: Boolean,
    default: false
  },
  showArrow: {
    type: Boolean,
    default: true
  }
})

const { themeMode, isDark, themeModeText, setTheme } = useTheme()

const toggleRef = ref(null)
const showMenu = ref(false)

// SVG 图标
const icons = {
  // 半圆对比图标 - 跟随系统（左半亮右半暗）
  system: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" opacity="0.3"/></svg>',
  // 太阳图标 - 浅色模式
  light: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="4.22" x2="19.78" y2="5.64"/></svg>',
  // 月亮图标 - 深色模式
  dark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
}

// 当前主题图标 SVG
const themeIconSvg = computed(() => {
  if (themeMode.value === THEME_MODES.SYSTEM) return icons.system
  return isDark.value ? icons.dark : icons.light
})

const themeOptions = [
  { value: THEME_MODES.SYSTEM, label: '跟随系统', icon: icons.system },
  { value: THEME_MODES.LIGHT, label: '浅色模式', icon: icons.light },
  { value: THEME_MODES.DARK, label: '深色模式', icon: icons.dark }
]

function toggleMenu() {
  showMenu.value = !showMenu.value
}

function selectTheme(mode) {
  setTheme(mode)
  showMenu.value = false
}

function handleClickOutside(e) {
  if (toggleRef.value && !toggleRef.value.contains(e.target)) {
    showMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.theme-toggle {
  position: relative;
}

.theme-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--input-bg);
  border: none;
  border-radius: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.theme-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.theme-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

.theme-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.theme-text {
  font-size: 13px;
  font-weight: 500;
}

.arrow-icon {
  opacity: 0.6;
  transition: transform 0.2s;
}

.arrow-icon.open {
  transform: rotate(180deg);
}

/* 下拉菜单 */
.theme-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 160px;
  background: var(--dropdown-bg);
  border-radius: 12px;
  box-shadow: var(--dropdown-shadow);
  padding: 6px;
  z-index: 1000;
  border: 1px solid var(--border-light);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.2s;
  text-align: left;
}

.menu-item:hover {
  background: var(--bg-secondary);
}

.menu-item.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.menu-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.menu-icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.menu-text {
  flex: 1;
}

.check-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

/* 动画 */
.menu-enter-active {
  animation: menuIn 0.2s ease-out;
}

.menu-leave-active {
  animation: menuOut 0.15s ease-in;
}

@keyframes menuIn {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes menuOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
}

/* 移动端适配 */
@media (max-width: 640px) {
  .theme-btn {
    padding: 8px 10px;
  }
  
  .theme-text {
    display: none;
  }
  
  .theme-menu {
    right: -10px;
  }
}
</style>
