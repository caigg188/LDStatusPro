<template>
  <div class="category-filter">
    <button
      :class="['filter-chip', { active: !currentCategory }]"
      @click="selectCategory('')"
    >
      🏷️ 全部
    </button>
    <button
      v-for="category in categories"
      :key="category.id"
      :class="['filter-chip', { active: isActive(category.id) }]"
      @click="selectCategory(category.id)"
    >
      {{ category.icon || '📦' }} {{ category.name }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

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

function isActive(categoryId) {
  return String(props.currentCategory) === String(categoryId)
}

function selectCategory(categoryId) {
  emit('select', categoryId)
}
</script>

<style scoped>
.category-filter {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px;
  margin: -4px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.category-filter::-webkit-scrollbar {
  display: none;
}

.filter-chip {
  flex-shrink: 0;
  padding: 8px 14px;
  background: white;
  border: 1px solid #ebe7e1;
  border-radius: 20px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.filter-chip:hover {
  border-color: #ddd7ce;
  background: #faf9f7;
}

.filter-chip.active {
  background: linear-gradient(135deg, #b5a898 0%, #9f8f7d 100%);
  border-color: transparent;
  color: white;
}
</style>
