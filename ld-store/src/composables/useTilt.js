/**
 * 3D 透视倾斜效果 Composable
 * 模拟苹果风格的卡片交互 - 鼠标位置影响卡片倾斜方向
 */
import { ref, onMounted, onUnmounted } from 'vue'

/**
 * @param {Object} options 配置选项
 * @param {number} options.maxTilt - 最大倾斜角度（度），默认 8
 * @param {number} options.scale - 悬停时的缩放比例，默认 1.02
 * @param {number} options.perspective - 透视距离（px），默认 1000
 * @param {number} options.speed - 过渡速度（ms），默认 400
 * @param {boolean} options.glare - 是否显示光泽效果，默认 true
 * @param {number} options.glareOpacity - 光泽最大透明度，默认 0.15
 */
export function useTilt(options = {}) {
  const {
    maxTilt = 8,
    scale = 1.02,
    perspective = 1000,
    speed = 400,
    glare = true,
    glareOpacity = 0.15
  } = options

  const elementRef = ref(null)
  const tiltStyle = ref({})
  const glareStyle = ref({})
  const isHovering = ref(false)

  let animationFrame = null
  let currentX = 0
  let currentY = 0
  let targetX = 0
  let targetY = 0

  // 平滑插值
  function lerp(start, end, factor) {
    return start + (end - start) * factor
  }

  // 更新倾斜效果
  function updateTilt() {
    if (!isHovering.value) return

    // 平滑过渡到目标位置
    currentX = lerp(currentX, targetX, 0.1)
    currentY = lerp(currentY, targetY, 0.1)

    const rotateX = currentY * maxTilt
    const rotateY = -currentX * maxTilt

    tiltStyle.value = {
      transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`,
      transition: 'none'
    }

    if (glare) {
      // 光泽跟随鼠标位置
      const glareX = (currentX + 1) * 50
      const glareY = (currentY + 1) * 50
      const glareIntensity = Math.sqrt(currentX * currentX + currentY * currentY) * glareOpacity

      glareStyle.value = {
        background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,${glareIntensity}) 0%, transparent 60%)`,
        opacity: 1
      }
    }

    animationFrame = requestAnimationFrame(updateTilt)
  }

  // 鼠标移动处理
  function handleMouseMove(e) {
    if (!elementRef.value) return

    const rect = elementRef.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // 转换为 -1 到 1 的范围
    targetX = (x / rect.width) * 2 - 1
    targetY = (y / rect.height) * 2 - 1
  }

  // 鼠标进入
  function handleMouseEnter() {
    isHovering.value = true
    animationFrame = requestAnimationFrame(updateTilt)
  }

  // 鼠标离开
  function handleMouseLeave() {
    isHovering.value = false
    
    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
    }

    // 重置到初始状态
    currentX = 0
    currentY = 0
    targetX = 0
    targetY = 0

    tiltStyle.value = {
      transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
      transition: `transform ${speed}ms cubic-bezier(0.23, 1, 0.32, 1)`
    }

    glareStyle.value = {
      opacity: 0
    }
  }

  // 绑定事件
  function bindEvents() {
    if (!elementRef.value) return

    elementRef.value.addEventListener('mouseenter', handleMouseEnter)
    elementRef.value.addEventListener('mousemove', handleMouseMove)
    elementRef.value.addEventListener('mouseleave', handleMouseLeave)
  }

  // 解绑事件
  function unbindEvents() {
    if (!elementRef.value) return

    elementRef.value.removeEventListener('mouseenter', handleMouseEnter)
    elementRef.value.removeEventListener('mousemove', handleMouseMove)
    elementRef.value.removeEventListener('mouseleave', handleMouseLeave)

    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
    }
  }

  onMounted(() => {
    // 检查是否为触摸设备或用户偏好减少动效，优先保证兼容与性能
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!isTouchDevice && !prefersReducedMotion) {
      bindEvents()
    }
  })

  onUnmounted(() => {
    unbindEvents()
  })

  return {
    elementRef,
    tiltStyle,
    glareStyle,
    isHovering
  }
}

/**
 * 简化版 - 仅 CSS 类名控制
 * 用于不需要完全自定义的场景
 */
export function useTiltClass() {
  return {
    tiltClass: 'tilt-card',
    tiltGlareClass: 'tilt-glare'
  }
}
