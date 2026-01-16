<template>
  <form @submit.prevent="handleSubmit" class="shop-form">
    <!-- 小店名称 -->
    <div class="form-group">
      <label class="form-label">
        <span class="required">*</span> 小店名称
      </label>
      <input 
        v-model="form.name"
        type="text"
        class="form-input"
        placeholder="输入小店名称"
        maxlength="50"
        required
      />
      <p class="form-hint">最多50个字符</p>
    </div>

    <!-- 小店链接 -->
    <div class="form-group">
      <label class="form-label">
        <span class="required">*</span> 小店链接
      </label>
      <input 
        v-model="form.shopUrl"
        type="url"
        class="form-input"
        placeholder="https://example.com"
        required
      />
      <p class="form-hint">用户点击小店卡片后跳转的目标地址</p>
    </div>

    <!-- 店主 LinuxDo 主页 -->
    <div class="form-group">
      <label class="form-label">
        <span class="required">*</span> 店主 LinuxDo 主页
      </label>
      <input 
        v-model="form.ownerLinuxDoLink"
        type="url"
        class="form-input"
        placeholder="https://linux.do/u/username"
        required
      />
      <p class="form-hint">输入您的 LinuxDo 个人主页链接，用于展示店主身份</p>
    </div>

    <!-- 小店图片 -->
    <div class="form-group">
      <label class="form-label">小店图片</label>
      <input 
        v-model="form.imageUrl"
        type="url"
        class="form-input"
        placeholder="https://example.com/image.jpg"
      />
      <p class="form-hint">推荐尺寸 16:9，必须使用 HTTPS 链接</p>
    </div>

    <!-- 标签选择 -->
    <div class="form-group">
      <label class="form-label">小店标签 <span class="tag-hint">(最多选3个)</span></label>
      <div class="tag-selector">
        <label 
          v-for="tag in availableTags" 
          :key="tag"
          class="tag-option"
          :class="{ selected: form.tags.includes(tag), disabled: !form.tags.includes(tag) && form.tags.length >= 3 }"
        >
          <input 
            type="checkbox" 
            :value="tag" 
            v-model="form.tags"
            :disabled="!form.tags.includes(tag) && form.tags.length >= 3"
            class="tag-checkbox"
          />
          <span class="tag-label" :class="getTagClass(tag)">{{ tag }}</span>
        </label>
      </div>
    </div>

    <!-- 小店介绍 -->
    <div class="form-group">
      <label class="form-label">小店介绍</label>
      <textarea 
        v-model="form.description"
        class="form-textarea"
        placeholder="介绍一下你的小店..."
        rows="4"
        maxlength="500"
      ></textarea>
      <p class="form-hint">{{ form.description?.length || 0 }}/500</p>
    </div>

    <!-- 操作按钮 -->
    <div class="form-actions">
      <button 
        v-if="initialData" 
        type="button" 
        class="btn btn-secondary"
        @click="$emit('cancel')"
        :disabled="submitting"
      >
        取消
      </button>
      <button 
        type="submit" 
        class="btn btn-primary"
        :disabled="submitting || !isFormValid"
      >
        <span v-if="submitting" class="spinner-small"></span>
        {{ initialData ? '保存修改' : '提交入驻申请' }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'

const props = defineProps({
  initialData: {
    type: Object,
    default: null
  },
  submitting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit', 'cancel'])

// 可选标签
const availableTags = ['订阅', '服务', '小鸡', 'AI', '娱乐', '公益站']

// 表单数据
const form = reactive({
  name: '',
  shopUrl: '',
  ownerLinuxDoLink: '',
  imageUrl: '',
  description: '',
  tags: []
})

// 初始化表单数据
watch(() => props.initialData, (data) => {
  if (data) {
    form.name = data.name || ''
    form.shopUrl = data.shop_url || ''
    form.ownerLinuxDoLink = data.owner_linuxdo_link || ''
    form.imageUrl = data.image_url || ''
    form.description = data.description || ''
    
    // 处理标签
    if (data.tags) {
      if (Array.isArray(data.tags)) {
        form.tags = data.tags
      } else {
        try {
          form.tags = JSON.parse(data.tags)
        } catch {
          form.tags = []
        }
      }
    } else {
      form.tags = []
    }
  }
}, { immediate: true })

// 表单验证
const isFormValid = computed(() => {
  return form.name.trim() && 
         form.shopUrl.trim() && 
         form.ownerLinuxDoLink.trim() &&
         form.ownerLinuxDoLink.includes('linux.do/u/')
})

// 标签样式类
const getTagClass = (tag) => {
  const tagClassMap = {
    '订阅': 'tag-subscription',
    '服务': 'tag-service',
    '小鸡': 'tag-vps',
    'AI': 'tag-ai',
    '娱乐': 'tag-entertainment',
    '公益站': 'tag-charity'
  }
  return tagClassMap[tag] || ''
}

// 提交表单
function handleSubmit() {
  if (!isFormValid.value || props.submitting) return
  
  // 验证图片链接
  if (form.imageUrl && !form.imageUrl.startsWith('https://')) {
    alert('图片链接必须使用 HTTPS')
    return
  }
  
  emit('submit', {
    name: form.name.trim(),
    shopUrl: form.shopUrl.trim(),
    ownerLinuxDoLink: form.ownerLinuxDoLink.trim(),
    imageUrl: form.imageUrl.trim(),
    description: form.description.trim(),
    tags: form.tags
  })
}
</script>

<style scoped>
.shop-form {
  background: white;
  border-radius: 16px;
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #3d3d3d;
  margin-bottom: 8px;
}

.form-label .required {
  color: #dc2626;
}

.tag-hint {
  font-weight: 400;
  color: #999;
  font-size: 12px;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  border: 1px solid #e0dcd6;
  border-radius: 12px;
  background: #faf9f7;
  color: #3d3d3d;
  transition: all 0.2s;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #b5a898;
  background: white;
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: #aaa;
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-hint {
  font-size: 12px;
  color: #999;
  margin-top: 6px;
}

/* 标签选择器 */
.tag-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag-option {
  cursor: pointer;
}

.tag-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tag-checkbox {
  display: none;
}

.tag-label {
  display: inline-block;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 20px;
  background: #f5f3f0;
  color: #666;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.tag-option.selected .tag-label {
  border-color: currentColor;
  transform: scale(1.02);
}

.tag-label.tag-subscription { background: #e8f5e8; color: #166534; }
.tag-label.tag-service { background: #e0f2fe; color: #0369a1; }
.tag-label.tag-vps { background: #fef3c7; color: #b45309; }
.tag-label.tag-ai { background: #f3e8ff; color: #7c3aed; }
.tag-label.tag-entertainment { background: #ffe4e6; color: #be123c; }
.tag-label.tag-charity { background: #fce7f3; color: #be185d; }

/* 操作按钮 */
.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f0ede9;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #b5a898 0%, #a09080 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(181, 168, 152, 0.4);
}

.btn-secondary {
  background: white;
  color: #666;
  border: 1px solid #e0dcd6;
}

.btn-secondary:hover:not(:disabled) {
  background: #f8f6f3;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 移动端适配 */
@media (max-width: 640px) {
  .shop-form {
    padding: 16px;
  }
  
  .form-actions {
    flex-direction: column-reverse;
  }
  
  .btn {
    width: 100%;
  }
  
  .tag-selector {
    gap: 8px;
  }
  
  .tag-label {
    padding: 6px 12px;
    font-size: 12px;
  }
}
</style>
