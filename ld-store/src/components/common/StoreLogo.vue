<template>
  <span
    class="store-logo"
    :class="{ 'store-logo--inverted': inverted }"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : 'LD 士多'"
    :aria-hidden="decorative ? true : undefined"
  >
    <img class="store-logo__color" src="/brand/store-mark.svg" width="64" height="64" alt="" draggable="false" />
    <img class="store-logo__white" src="/brand/store-mark-white.svg" width="64" height="64" alt="" draggable="false" />
  </span>
</template>

<script setup>
defineProps({
  decorative: { type: Boolean, default: false },
  inverted: { type: Boolean, default: false }
})
</script>

<style scoped>
.store-logo {
  display: inline-block;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  vertical-align: middle;
}

.store-logo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.store-logo .store-logo__white {
  display: none;
}

.store-logo--inverted .store-logo__color,
html.dark .store-logo__color {
  display: none;
}

.store-logo--inverted .store-logo__white,
html.dark .store-logo__white {
  display: block;
}
</style>
