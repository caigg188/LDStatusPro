<template>
  <div 
    v-if="isVisible" 
    class="doodle-background"
    :class="{ 'fade-in': isAnimating }"
  >
    <svg 
      class="doodle-pattern" 
      width="100%" 
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <!-- 定义重复的图案 - 更大的画布和图标 -->
        <pattern 
          id="doodle-pattern" 
          x="0" 
          y="0" 
          width="320" 
          height="320" 
          patternUnits="userSpaceOnUse"
        >
          <!-- 购物袋 -->
          <g transform="translate(15, 15) scale(1.2)" class="doodle-icon">
            <path 
              d="M6 8h20v18a2 2 0 01-2 2H8a2 2 0 01-2-2V8z" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path 
              d="M10 8V6a6 6 0 1112 0v2" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.3"
              stroke-linecap="round"
            />
          </g>
          
          <!-- 星星 -->
          <g transform="translate(120, 10) scale(1.1)" class="doodle-icon">
            <path 
              d="M10 2l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </g>
          
          <!-- 硬币/LDC -->
          <g transform="translate(220, 20) scale(1.0)" class="doodle-icon">
            <circle 
              cx="12" 
              cy="12" 
              r="11" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.3"
            />
            <text 
              x="12" 
              y="16" 
              text-anchor="middle" 
              font-size="11" 
              fill="currentColor"
              font-weight="500"
              font-family="sans-serif"
            >L</text>
          </g>
          
          <!-- 爱心 -->
          <g transform="translate(280, 70) scale(0.9)" class="doodle-icon">
            <path 
              d="M12 21l-1.4-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.5L12 21z" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </g>
          
          <!-- 礼物盒 -->
          <g transform="translate(60, 80) scale(1.1)" class="doodle-icon">
            <rect 
              x="3" 
              y="10" 
              width="18" 
              height="13" 
              rx="2" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.3"
            />
            <path 
              d="M12 10V23M3 15h18" 
              stroke="currentColor" 
              stroke-width="1.3"
              stroke-linecap="round"
            />
            <path 
              d="M12 10c-2-4-6-4-6 0M12 10c2-4 6-4 6 0" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.3"
              stroke-linecap="round"
            />
          </g>
          
          <!-- 价签 -->
          <g transform="translate(165, 65) scale(1.0)" class="doodle-icon">
            <path 
              d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L2 12V2h10l8.6 8.6a2 2 0 010 2.8z" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle 
              cx="7" 
              cy="7" 
              r="2" 
              fill="currentColor" 
              opacity="0.35"
            />
          </g>
          
          <!-- 对话气泡 -->
          <g transform="translate(250, 130) scale(1.0)" class="doodle-icon">
            <path 
              d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <!-- 省略号 -->
            <circle cx="8" cy="12" r="1.2" fill="currentColor" opacity="0.5"/>
            <circle cx="12" cy="12" r="1.2" fill="currentColor" opacity="0.5"/>
            <circle cx="16" cy="12" r="1.2" fill="currentColor" opacity="0.5"/>
          </g>
          
          <!-- 闪电 -->
          <g transform="translate(10, 155) scale(1.0)" class="doodle-icon">
            <path 
              d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </g>
          
          <!-- 购物车 -->
          <g transform="translate(95, 160) scale(1.0)" class="doodle-icon">
            <circle cx="9" cy="20" r="2" fill="none" stroke="currentColor" stroke-width="1.3"/>
            <circle cx="19" cy="20" r="2" fill="none" stroke="currentColor" stroke-width="1.3"/>
            <path 
              d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </g>
          
          <!-- 笑脸 -->
          <g transform="translate(190, 170) scale(1.0)" class="doodle-icon">
            <circle 
              cx="12" 
              cy="12" 
              r="10" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.3"
            />
            <path 
              d="M8 14s1.5 2 4 2 4-2 4-2" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.3"
              stroke-linecap="round"
            />
            <circle cx="9" cy="9" r="1.3" fill="currentColor" opacity="0.6"/>
            <circle cx="15" cy="9" r="1.3" fill="currentColor" opacity="0.6"/>
          </g>
          
          <!-- 钻石 -->
          <g transform="translate(40, 235) scale(1.0)" class="doodle-icon">
            <path 
              d="M6 3h12l4 7-10 12L2 10l4-7z" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path 
              d="M2 10h20M6 3l6 19M18 3l-6 19" 
              stroke="currentColor" 
              stroke-width="1"
              stroke-linecap="round"
              opacity="0.5"
            />
          </g>
          
          <!-- 纸飞机 -->
          <g transform="translate(145, 235) scale(1.0)" class="doodle-icon">
            <path 
              d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </g>
          
          <!-- 勋章/徽章 -->
          <g transform="translate(235, 220) scale(1.0)" class="doodle-icon">
            <circle 
              cx="12" 
              cy="10" 
              r="7" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.3"
            />
            <path 
              d="M8 17l-2 5 6-2 6 2-2-5" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path 
              d="M12 6v8M8 10h8" 
              stroke="currentColor" 
              stroke-width="1.2"
              stroke-linecap="round"
              opacity="0.5"
            />
          </g>
          
          <!-- 小装饰元素 -->
          <!-- 小圆点 -->
          <circle cx="55" cy="60" r="3" fill="currentColor" opacity="0.25" />
          <circle cx="210" cy="110" r="2.5" fill="currentColor" opacity="0.2" />
          <circle cx="295" cy="195" r="3.5" fill="currentColor" opacity="0.22" />
          <circle cx="115" cy="295" r="2.5" fill="currentColor" opacity="0.2" />
          <circle cx="275" cy="285" r="3" fill="currentColor" opacity="0.22" />
          
          <!-- 小星星 -->
          <g transform="translate(285, 15) scale(0.7)" class="doodle-icon">
            <path 
              d="M6 1l1.5 3 3.5.5-2.5 2.4.6 3.4L6 8.7 3 10.3l.6-3.4L1 4.5l3.5-.5z" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </g>
          
          <!-- 小十字 -->
          <g transform="translate(85, 135)">
            <path 
              d="M0 6h12M6 0v12" 
              stroke="currentColor" 
              stroke-width="1.3"
              stroke-linecap="round"
              opacity="0.35"
            />
          </g>
          
          <!-- 波浪线 -->
          <path 
            d="M5 305 Q 25 295, 45 305 T 85 305" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="1.3"
            opacity="0.3"
            stroke-linecap="round"
          />
          
          <!-- 小圆圈 -->
          <circle cx="175" cy="305" r="6" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.3" />
          
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#doodle-pattern)" />
    </svg>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

defineProps({
  isVisible: {
    type: Boolean,
    default: true
  }
})

const isAnimating = ref(false)

onMounted(() => {
  // 入场动画
  requestAnimationFrame(() => {
    isAnimating.value = true
  })
})
</script>

<style scoped>
.doodle-background {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  opacity: 0;
  transition: opacity 0.5s ease;
}

.doodle-background.fade-in {
  opacity: 1;
}

.doodle-pattern {
  width: 100%;
  height: 100%;
  /* 浅色模式：使用莫兰迪灰棕色调 */
  color: rgba(181, 168, 152, 0.15);
}

/* 深色模式 */
:global(html.dark) .doodle-pattern {
  color: rgba(181, 168, 152, 0.08);
}

/* 图标微动画 - 可选，按需启用 */
.doodle-icon {
  /* 默认不开启动画以保持"安静"感 */
}

/* 呼吸感动画 - 极其微妙，几乎察觉不到 */
@keyframes subtle-breathe {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.85;
  }
}

/* 媒体查询：减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  .doodle-background {
    transition: none;
  }
}
</style>
