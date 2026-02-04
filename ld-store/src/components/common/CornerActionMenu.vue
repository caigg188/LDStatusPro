<template>
  <div
    ref="menuRef"
    class="corner-menu"
    :class="{ 'is-open': isOpen, 'is-visible': showMenu }"
  >
    <button
      class="corner-action action-doodle"
      :class="{ 'is-active': isEnabled }"
      :style="actionStyle(0)"
      @click.stop="toggleDoodle"
      :title="isEnabled ? '关闭涂鸦背景' : '开启涂鸦背景'"
      :aria-label="isEnabled ? '关闭涂鸦背景' : '开启涂鸦背景'"
    >
      <svg
        class="action-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
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
      </svg>
      <span class="action-label">
        {{ isEnabled ? '关闭涂鸦背景' : '开启涂鸦背景' }}
      </span>
    </button>

    <button
      class="corner-action action-support"
      :style="actionStyle(1)"
      @click.stop="openSupport"
      title="支持LD士多"
      aria-label="支持LD士多"
    >
      <svg
        class="action-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 21l-1.4-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.5L12 21z"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="action-label">支持LD士多</span>
    </button>

    <button
      class="corner-fab"
      @click.stop="toggleMenu"
      :aria-expanded="String(isOpen)"
      aria-label="快捷菜单"
    >
      <span class="fab-label">功能按钮</span>
      <span class="fab-glow" aria-hidden="true"></span>
      <svg class="fab-icon" :class="{ 'is-open': isOpen }" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 4v6M12 14v6M4 12h6M14 12h6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const route = useRoute()
const menuRef = ref(null)
const showMenu = ref(false)
const isOpen = ref(false)
const isEnabled = ref(props.modelValue)

const radius = 72
const positions = [
  { x: 0, y: radius },
  { x: radius * 0.72, y: radius * 0.72 }
]

const actionStyle = (index) => {
  const { x, y } = positions[index]
  if (!isOpen.value) {
    return {
      transform: 'translate(0, 0) scale(0.6)',
      opacity: 0,
      transitionDelay: '0s',
      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
    }
  }
  return {
    transform: `translate(${-x}px, ${-y}px) scale(1)`,
    opacity: 1,
    transitionDelay: `${index * 0.06}s`,
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)'
  }
}

function toggleMenu() {
  isOpen.value = !isOpen.value
}

function toggleDoodle() {
  const next = !isEnabled.value
  isEnabled.value = next
  emit('update:modelValue', next)
  isOpen.value = false
}

function openSupport() {
  isOpen.value = false
  router.push('/support')
}

function handleDocClick(event) {
  if (!isOpen.value) return
  const target = menuRef.value
  if (target && !target.contains(event.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  setTimeout(() => {
    showMenu.value = true
  }, 450)
  document.addEventListener('click', handleDocClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocClick)
})

watch(
  () => props.modelValue,
  (val) => {
    isEnabled.value = val
  }
)

watch(
  () => route.fullPath,
  () => {
    isOpen.value = false
  }
)
</script>

<style scoped>
.corner-menu {
  position: fixed;
  right: 20px;
  bottom: 80px;
  width: 190px;
  height: 190px;
  z-index: 120;
  opacity: 0;
  transform: translateY(18px) scale(0.96);
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.corner-menu.is-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.corner-action {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 46px;
  height: 46px;
  --label-shift-y: -55%;
  border-radius: 50%;
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border-light);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 16px var(--glass-shadow), inset 0 1px 0 var(--glass-shine);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: transform 0.36s ease, opacity 0.22s ease, box-shadow 0.25s ease, color 0.25s ease, filter 0.2s ease;
  pointer-events: none;
}

.corner-menu.is-open .corner-action {
  pointer-events: auto;
}

.corner-action:hover {
  color: var(--color-primary);
  box-shadow: 0 12px 24px var(--glass-shadow), inset 0 1px 0 var(--glass-shine);
}

.corner-action:active {
  filter: brightness(0.98);
}

.corner-action.is-active {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.action-doodle {
  --label-shift-y: -90%;
  background: linear-gradient(135deg, rgba(181, 168, 152, 0.2), rgba(255, 255, 255, 0.9));
  color: var(--text-secondary);
}

.action-support {
  --label-shift-y: -20%;
  color: #ef7a7a;
  border-color: color-mix(in srgb, #ef7a7a 40%, transparent);
  background: linear-gradient(135deg, rgba(239, 122, 122, 0.2), rgba(255, 255, 255, 0.9));
}

.action-support:hover {
  color: #e65a5a;
  box-shadow: 0 12px 24px rgba(239, 122, 122, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.action-label {
  position: absolute;
  right: 56px;
  top: 50%;
  transform: translateY(var(--label-shift-y)) translateX(8px);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  opacity: 0;
  white-space: nowrap;
  box-shadow: 0 6px 16px var(--glass-shadow);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
}

.corner-action:hover .action-label,
.corner-action:focus-visible .action-label {
  opacity: 1;
  transform: translateY(var(--label-shift-y)) translateX(0);
}

.corner-fab {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--color-primary) 75%, #ffffff) 0%,
    color-mix(in srgb, var(--color-primary) 85%, #7e6e5f) 100%
  );
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-primary), 0 12px 26px rgba(159, 143, 125, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.55);
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.fab-label {
  position: absolute;
  right: 62px;
  top: 50%;
  transform: translateY(-50%) translateX(8px);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  opacity: 0;
  white-space: nowrap;
  box-shadow: 0 6px 16px var(--glass-shadow);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
}

.corner-fab:hover .fab-label,
.corner-fab:focus-visible .fab-label {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}

.corner-fab::before,
.corner-fab::after {
  content: '';
  position: absolute;
  inset: 6px;
  border-radius: 50%;
  pointer-events: none;
}

.corner-fab::before {
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.45) 0 2px, transparent 3px),
    radial-gradient(circle at 70% 40%, rgba(255, 255, 255, 0.35) 0 1.5px, transparent 3px),
    radial-gradient(circle at 45% 70%, rgba(255, 255, 255, 0.3) 0 1.8px, transparent 3px);
  opacity: 0.8;
}

.corner-fab::after {
  inset: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.35);
  opacity: 0.7;
}

.corner-fab:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(159, 143, 125, 0.35), 0 0 0 6px rgba(181, 168, 152, 0.08);
}

.corner-menu.is-open .corner-fab {
  transform: translateY(-1px) scale(1.02);
  box-shadow: 0 12px 26px rgba(159, 143, 125, 0.35), 0 0 0 8px rgba(181, 168, 152, 0.12);
}

.corner-fab:active {
  transform: scale(0.96);
}

.fab-glow {
  position: absolute;
  inset: -20%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.4), transparent 60%);
  opacity: 0.8;
  animation: fab-pulse 3.2s ease-in-out infinite;
}

.fab-icon {
  width: 24px;
  height: 24px;
  stroke: currentColor;
  fill: none;
  transition: transform 0.3s ease;
}

.fab-icon.is-open {
  transform: rotate(45deg) scale(0.9);
}

@keyframes fab-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.95;
  }
}

@media (max-width: 640px) {
  .corner-menu {
    right: 16px;
    bottom: 96px;
    width: 170px;
    height: 170px;
  }

  .corner-action {
    width: 42px;
    height: 42px;
  }

  .corner-fab {
    width: 48px;
    height: 48px;
  }

  .action-label {
    font-size: 11px;
    padding: 3px 8px;
  }

  .fab-label {
    font-size: 11px;
    padding: 3px 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .corner-menu,
  .corner-action,
  .action-label,
  .corner-fab,
  .fab-icon {
    transition: none;
  }

  .fab-glow {
    animation: none;
  }
}
</style>
