<template>
  <div class="product-interactions">
    <button class="nav-favorite-btn" :class="{ active: favorited }" :disabled="busy" @click="emit('favorite')">
      <Heart :size="16" :fill="favorited ? 'currentColor' : 'none'" aria-hidden="true" />
      <span>{{ favorited ? '已收藏' : '收藏' }}</span>
    </button>
    <button class="nav-block-btn" :disabled="busy" title="以后不再向我展示这件商品" aria-label="将这件商品标记为不感兴趣" @click="emit('block')">
      <EyeOff :size="16" aria-hidden="true" /><span>不感兴趣</span>
    </button>
    <button class="nav-report-btn" :disabled="reporting" @click="emit('report')"><Flag :size="16" aria-hidden="true" /><span>举报</span></button>
  </div>
</template>

<script setup lang="ts">
import { EyeOff, Flag, Heart } from '@lucide/vue'
defineProps<{ favorited: boolean; busy: boolean; reporting: boolean }>()
const emit = defineEmits<{ favorite: []; block: []; report: [] }>()
</script>

<style scoped>
.product-interactions { display: contents; }
button { display: inline-flex; min-height: 34px; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 20px; cursor: pointer; font-size: 13px; line-height: 1.2; transition: background-color 0.2s, border-color 0.2s, color 0.2s; }
button:disabled { cursor: not-allowed; opacity: 0.65; }
button:focus-visible { outline: 3px solid var(--palette-rgba-99-102-241-0p2); outline-offset: 2px; }
.nav-favorite-btn { color: var(--palette-hex-b16472); background: var(--palette-hex-fff4f6); border: 1px solid var(--palette-hex-e4cad0); }
.nav-favorite-btn:hover { background: var(--palette-hex-feecef); border-color: var(--palette-hex-dbaab5); }
.nav-favorite-btn.active { color: var(--palette-hex-9f4258); background: var(--palette-hex-fce5ea); border-color: var(--palette-hex-d98f9f); }
.nav-block-btn { color: var(--text-tertiary); background: var(--bg-card); border: 1px solid var(--border-color); }
.nav-block-btn:hover { color: var(--color-danger); background: var(--palette-rgba-220-38-38-0p08); border-color: var(--palette-rgba-220-38-38-0p3); }
.nav-report-btn { color: var(--palette-hex-8a6500); background: var(--palette-rgba-250-204-21-0p16); border: 1px solid var(--palette-rgba-234-179-8-0p35); }
.nav-report-btn:hover { color: var(--palette-hex-6f5200); background: var(--palette-rgba-250-204-21-0p24); border-color: var(--palette-rgba-234-179-8-0p5); }
@media (max-width: 639px) {
  button { min-height: 44px; }
  /* 手机端仅展示图标，文字改用 sr-only 保留给屏幕阅读器 */
  button span { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
}
</style>
