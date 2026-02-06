<template>
  <div class="ld-image-page">
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">🖼️ 士多图床</h1>
        <p class="page-desc">上传图片，获取永久在线链接（支持 jpg、png、gif、webp）</p>
      </div>

      <!-- 使用须知 -->
      <div class="notice-section">
        <div class="notice-header" @click="showNotice = !showNotice">
          <span class="notice-icon">📢</span>
          <span class="notice-title">使用须知</span>
          <span class="notice-toggle">{{ showNotice ? '▼' : '▶' }}</span>
        </div>
        <Transition name="slide">
          <div v-if="showNotice" class="notice-content">
            <ul class="notice-list">
              <li><strong>✅ CF-R2存储</strong>：配有域名和证书，稳定、安全、高效。</li>
              <li><strong>🚫 禁止上传</strong>：色情、暴力、血腥、政治敏感、侵权等违规内容</li>
              <li><strong>📏 文件限制</strong>：单张图片最大 5MB，支持 jpg/png/gif/webp 格式</li>
              <li><strong>💾 存储说明</strong>：图片永久存储，删除后不可恢复</li>
              <li><strong>🔗 外链使用</strong>：可直接引用图片 URL，支持 Markdown 格式</li>
              <li><strong>⚠️ 违规处理</strong>：上传违规内容将被删除并封禁账号</li>
            </ul>
          </div>
        </Transition>
      </div>

      <!-- 维护提示（非免费用户） -->
      <div v-if="isLoggedIn && !isFreeUser && isMaintenance" class="maintenance-notice">
        <div class="maintenance-icon">🔧</div>
        <h3>图床服务维护中</h3>
        <p>付费上传功能正在维护，预计很快恢复。给您带来不便，敬请谅解。</p>
        <p class="maintenance-hint">如有紧急需求，请联系管理员。</p>
      </div>

      <!-- 未登录提示 -->
      <div v-if="!isLoggedIn" class="login-prompt">
        <div class="prompt-icon">🔐</div>
        <h3>请先登录</h3>
        <p>登录后即可使用图床服务</p>
        <router-link to="/login" class="login-btn">立即登录</router-link>
      </div>

      <!-- 已登录（免费用户不受维护影响） -->
      <template v-else-if="!isMaintenance || isFreeUser">
        <!-- 上传区域 -->
        <div class="upload-section">
          <div 
            class="upload-area"
            :class="{ 'drag-over': isDragOver, 'has-file': selectedFile }"
            @dragover.prevent="isDragOver = true"
            @dragleave="isDragOver = false"
            @drop.prevent="handleDrop"
            @paste="handlePaste"
            @click="triggerFileSelect"
          >
            <input 
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              @change="handleFileSelect"
              class="hidden-input"
            />
            
            <!-- 预览 -->
            <div v-if="previewUrl" class="preview-container">
              <img :src="previewUrl" alt="预览" class="preview-image" @error="handlePreviewError" />
              <button class="clear-btn" @click.stop="clearFile">✕</button>
            </div>

            <!-- 上传提示 -->
            <div v-else class="upload-hint">
              <div class="upload-icon">📤</div>
              <p class="hint-text">点击选择图片、拖拽或 Ctrl+V 粘贴</p>
              <p class="hint-sub">支持 jpg、png、gif、webp，最大 5MB</p>
            </div>
          </div>

          <!-- 费用说明 -->
          <div class="fee-notice">
            <span class="fee-icon">💰</span>
            <span class="fee-text">
              <template v-if="isFreeUser">您是管理员，免费上传</template>
              <template v-else-if="priceInfo">
                当前费用：<strong>{{ priceInfo.currentPrice }} LDC</strong> / 张
                <span class="upload-count">(已上传 {{ priceInfo.uploadCount }} 张)</span>
              </template>
              <template v-else>加载中...</template>
            </span>
          </div>

          <!-- 阶梯定价说明 -->
          <div v-if="!isFreeUser && priceInfo" class="price-tiers">
            <div class="tiers-header" @click="showTiers = !showTiers">
              <span>📊 阶梯定价</span>
              <span class="tiers-toggle">{{ showTiers ? '▼' : '▶' }}</span>
            </div>
            <Transition name="slide">
              <div v-if="showTiers" class="tiers-content">
                <div 
                  v-for="tier in priceInfo.tiers" 
                  :key="tier.min"
                  class="tier-item"
                  :class="{ active: isCurrentTier(tier) }"
                >
                  <span class="tier-range">
                    {{ tier.min }}-{{ tier.max || '∞' }} 张
                  </span>
                  <span class="tier-price">{{ tier.price }} LDC/张</span>
                </div>
                <p v-if="priceInfo.nextTierAt" class="next-tier-hint">
                  还需上传 {{ priceInfo.nextTierAt - priceInfo.uploadCount }} 张后进入下一档(¥{{ priceInfo.nextPrice }})
                </p>
              </div>
            </Transition>
          </div>

          <!-- 上传按钮 -->
          <button 
            class="upload-btn"
            :disabled="!canUpload"
            @click="startUpload"
          >
            <template v-if="uploadStatus === 'idle'">
              {{ isFreeUser ? '🚀 免费上传' : '💳 支付并上传' }}
            </template>
            <template v-else-if="uploadStatus === 'paying'">
              ⏳ 等待支付...
            </template>
            <template v-else-if="uploadStatus === 'uploading'">
              ⬆️ 上传中...
            </template>
            <template v-else-if="uploadStatus === 'success'">
              ✅ 上传成功
            </template>
          </button>

          <!-- 上传结果 -->
          <div v-if="uploadResult" class="upload-result">
            <div class="result-header">
              <span class="result-icon">✅</span>
              <span class="result-title">上传成功</span>
            </div>
            <div class="result-url">
              <input 
                type="text" 
                :value="uploadResult.url" 
                readonly 
                class="url-input"
                ref="urlInput"
              />
              <button class="copy-btn" @click="copyUrl">
                {{ copied ? '✓ 已复制' : '📋 复制' }}
              </button>
            </div>
            <div class="result-preview">
              <img :src="uploadResult.url" alt="已上传图片" />
            </div>
          </div>
        </div>

        <!-- 上传历史 -->
        <div class="history-section">
          <div class="section-header">
            <h2 class="section-title">📚 上传历史</h2>
            <button v-if="history.length > 0" class="refresh-btn" @click="loadHistory">
              🔄 刷新
            </button>
          </div>

          <div v-if="historyLoading" class="loading-state">
            <div class="skeleton-grid">
              <div v-for="i in 4" :key="i" class="skeleton-item">
                <div class="skeleton skeleton-image"></div>
                <div class="skeleton skeleton-line w-full mt-2"></div>
              </div>
            </div>
          </div>

          <div v-else-if="history.length === 0" class="empty-state">
            <div class="empty-icon">📭</div>
            <p>暂无上传记录</p>
          </div>

          <div v-else class="history-grid">
            <div 
              v-for="item in history" 
              :key="item.id" 
              class="history-item"
              @click="selectHistoryItem(item)"
            >
              <div class="item-image">
                <img :src="item.url" :alt="item.filename" loading="lazy" />
              </div>
              <div class="item-info">
                <p class="item-name">{{ item.filename }}</p>
                <p class="item-date">{{ formatDate(item.created_at) }}</p>
              </div>
              <div class="item-actions">
                <button class="item-copy" @click.stop="copyHistoryUrl(item.url)" title="复制链接">
                  📋
                </button>
                <button class="item-delete" @click.stop="confirmDelete(item)" title="删除图片">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 支付弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showPayModal" class="modal-overlay" @click.self="cancelPayment">
          <div class="pay-modal">
            <div class="modal-header">
              <h3>💳 支付确认</h3>
              <button class="close-btn" @click="cancelPayment">✕</button>
            </div>
            <div class="modal-body">
              <div class="pay-info">
                <p>上传图片需支付 <strong>{{ paymentAmount || priceInfo?.currentPrice || 1 }} LDC</strong></p>
                <p class="pay-tip">订单号：{{ paymentOrderNo }}</p>
                <p class="pay-tip">请在新窗口中完成支付，支付后点击"我已支付"</p>
              </div>
              <div class="pay-actions">
                <button v-if="paymentUrl" class="pay-btn" @click="openPayment">
                  🔗 前往支付
                </button>
                <button class="check-btn" @click="checkPayment" :disabled="checking">
                  {{ checking ? '检查中...' : '✅ 我已支付' }}
                </button>
              </div>
              <p v-if="payError" class="pay-error">{{ payError }}</p>
            </div>
          </div>
        </div>
      </Transition>

      <!-- 删除确认弹窗 -->
      <Transition name="modal">
        <div v-if="showDeleteModal" class="modal-overlay" @click.self="cancelDelete">
          <div class="delete-modal">
            <div class="modal-header">
              <h3>🗑️ 删除确认</h3>
              <button class="close-btn" @click="cancelDelete">✕</button>
            </div>
            <div class="modal-body">
              <div class="delete-preview" v-if="deleteTarget">
                <img :src="deleteTarget.url" :alt="deleteTarget.filename" />
              </div>
              <p class="delete-warning">确定要删除这张图片吗？删除后不可恢复！</p>
              <div class="delete-actions">
                <button class="cancel-btn" @click="cancelDelete">取消</button>
                <button class="confirm-delete-btn" @click="doDelete" :disabled="deleting">
                  {{ deleting ? '删除中...' : '确认删除' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useToast } from '@/composables/useToast'
import { api } from '@/utils/api'
import { prepareNewTab, openInNewTab, cleanupPreparedTab } from '@/utils/newTab'

const userStore = useUserStore()
const toast = useToast()

// 状态
const fileInput = ref(null)
const urlInput = ref(null)
const selectedFile = ref(null)
const previewUrl = ref('')
const isDragOver = ref(false)
const uploadStatus = ref('idle') // idle, paying, uploading, success
const uploadResult = ref(null)
const copied = ref(false)

// 历史记录
const history = ref([])
const historyLoading = ref(false)

// 支付相关
const showPayModal = ref(false)
const paymentUrl = ref('')
const paymentOrderNo = ref('')
const paymentAmount = ref(0)
const checking = ref(false)
const payError = ref('')

// 删除相关
const showDeleteModal = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)

// 注意事项展开状态
const showNotice = ref(false)

// 阶梯定价展开状态
const showTiers = ref(false)

// 维护状态（非免费用户暂停服务）
const isMaintenance = ref(true)

// 价格信息
const priceInfo = ref(null)
const priceLoading = ref(false)

// 加密凭证（从后端获取，用于上传）
const uploadCredential = ref('')

// 计算属性
const isLoggedIn = computed(() => userStore.isLoggedIn)
const isFreeUser = computed(() => {
  // JackyLiii 免费
  return userStore.user?.username === 'JackyLiii'
    return userStore.user?.is_admin === true
})
const canUpload = computed(() => {
  return selectedFile.value && uploadStatus.value === 'idle'
})

// 判断是否为当前价格档位
function isCurrentTier(tier) {
  if (!priceInfo.value) return false
  const count = priceInfo.value.uploadCount
  const max = tier.max || Infinity
  return count >= tier.min && count < max
}

// 加载价格信息
async function loadPriceInfo() {
  if (isFreeUser.value) return
  priceLoading.value = true
  try {
    const result = await api.get('/api/image/price-info')
    if (result.success && result.data) {
      priceInfo.value = result.data
    }
  } catch (e) {
    cleanupPreparedTab(preparedWindow)
    console.error('Load price info failed:', e)
  } finally {
    priceLoading.value = false
  }
}

// 触发文件选择
function triggerFileSelect() {
  if (!selectedFile.value) {
    fileInput.value?.click()
  }
}

// 处理文件选择
function handleFileSelect(e) {
  const file = e.target.files?.[0]
  if (file) {
    validateAndSetFile(file)
  }
}

// 处理拖放
function handleDrop(e) {
  isDragOver.value = false
  const file = e.dataTransfer.files?.[0]
  if (file) {
    validateAndSetFile(file)
  }
}

// 处理粘贴
function handlePaste(e) {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        validateAndSetFile(file)
        break
      }
    }
  }
}

// 验证并设置文件
function validateAndSetFile(file) {
  // 验证类型
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    toast.error('只支持 jpg、png、gif、webp 格式')
    return
  }

  // 验证大小 (5MB)
  if (file.size > 5 * 1024 * 1024) {
    toast.error('图片大小不能超过 5MB')
    return
  }

  // 清理之前的预览URL
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }

  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
  uploadResult.value = null
  uploadStatus.value = 'idle'
}

// 预览图片加载失败
function handlePreviewError(e) {
  console.error('Preview image load error')
  // 尝试重新读取文件
  if (selectedFile.value) {
    const reader = new FileReader()
    reader.onload = (event) => {
      previewUrl.value = event.target.result
    }
    reader.readAsDataURL(selectedFile.value)
  }
}

// 清除选择
function clearFile() {
  selectedFile.value = null
  previewUrl.value = ''
  uploadResult.value = null
  uploadStatus.value = 'idle'
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// 开始上传流程
async function startUpload() {
  if (!selectedFile.value) return

  // 免费用户：获取免费凭证后直接上传
  if (isFreeUser.value) {
    try {
      const result = await api.get('/api/image/free-credential')
      if (result.success && result.data?.credential) {
        uploadCredential.value = result.data.credential
        await doUpload()
      } else {
        toast.error(result.error || '获取上传凭证失败')
      }
    } catch (e) {
      toast.error('获取上传凭证失败')
    }
    return
  }

  // 付费用户需要先支付
  uploadStatus.value = 'paying'
  payError.value = ''

  // 预开新标签页，保持用户手势，避免 Safari 拦截
  const preparedWindow = prepareNewTab()
  let paymentOpened = false

  try {
    const result = await api.post('/api/image/create-order')
    if (result.success && result.data) {
      paymentUrl.value = result.data.paymentUrl
      paymentOrderNo.value = result.data.orderNo
      paymentAmount.value = result.data.amount || priceInfo.value?.currentPrice || 1
      
      // 直接打开支付链接
      if (result.data.paymentUrl) {
        paymentOpened = openInNewTab(result.data.paymentUrl, preparedWindow)
        if (!paymentOpened) {
          cleanupPreparedTab(preparedWindow)
        }
      }
      // 显示支付弹窗
      showPayModal.value = true
      if (!paymentOpened) {
        cleanupPreparedTab(preparedWindow)
      }
    } else {
      cleanupPreparedTab(preparedWindow)
      const errMsg = typeof result.error === 'object' 
        ? (result.error.message || result.error.code || '创建订单失败')
        : (result.error || '创建订单失败')
      toast.error(errMsg)
      uploadStatus.value = 'idle'
    }
  } catch (e) {
    cleanupPreparedTab(preparedWindow)
    toast.error('创建支付订单失败：' + e.message)
    uploadStatus.value = 'idle'
  }
}

// 打开支付页面
function openPayment() {
  if (paymentUrl.value) {
    const preparedWindow = prepareNewTab()
    const opened = openInNewTab(paymentUrl.value, preparedWindow)
    if (!opened) {
      cleanupPreparedTab(preparedWindow)
    }
  }
}

// 检查支付状态
async function checkPayment() {
  if (!paymentOrderNo.value) return

  checking.value = true
  payError.value = ''

  try {
    const result = await api.get(`/api/image/check-payment?orderNo=${paymentOrderNo.value}`)
    if (result.success && result.data?.paid && result.data?.credential) {
      uploadCredential.value = result.data.credential
      showPayModal.value = false
      toast.success('支付成功，开始上传')
      await doUpload()
    } else if (result.success && result.data?.paid) {
      // 已经支付过，但状态是 uploaded，无法再次使用
      payError.value = '此订单已使用，请创建新订单'
    } else {
      // 支付状态确认中
      payError.value = result.data?.message || '支付确认中，请稍等几秒后重试'
    }
  } catch (e) {
    payError.value = '检查支付状态失败，请重试'
  } finally {
    checking.value = false
  }
}

// 取消支付
function cancelPayment() {
  showPayModal.value = false
  uploadStatus.value = 'idle'
  paymentUrl.value = ''
  paymentOrderNo.value = ''
}

// 执行上传（通过后端代理上传，解决 CORS 问题）
async function doUpload() {
  if (!selectedFile.value) return
  if (!uploadCredential.value) {
    toast.error('缺少上传凭证')
    return
  }

  uploadStatus.value = 'uploading'

  try {
    // 通过后端代理上传（解决外部图床 CORS 问题）
    const formData = new FormData()
    formData.append('credential', uploadCredential.value)
    formData.append('image', selectedFile.value)
    if (paymentOrderNo.value) {
      formData.append('orderNo', paymentOrderNo.value)
    }

    const result = await api.upload('/api/image/upload', formData)

    // 处理可能的嵌套响应格式
    const responseData = result.data?.data || result.data
    
    if (!result.success || !responseData?.url) {
      throw new Error(result.error || responseData?.error || '上传失败')
    }

    // 上传成功
    uploadStatus.value = 'success'
    uploadResult.value = { 
      id: responseData.id,
      url: responseData.url, 
      filename: responseData.filename 
    }
    toast.success('上传成功')
    
    // 清理凭证
    uploadCredential.value = ''
    paymentOrderNo.value = ''
    
    // 刷新历史和价格信息
    loadHistory()
    loadPriceInfo()
  } catch (e) {
    console.error('[Upload] Error:', e)
    uploadStatus.value = 'idle'
    uploadCredential.value = ''
    toast.error('上传失败: ' + e.message)
  }
}

// 复制链接
function copyUrl() {
  if (uploadResult.value?.url) {
    navigator.clipboard.writeText(uploadResult.value.url)
    copied.value = true
    toast.success('链接已复制')
    setTimeout(() => { copied.value = false }, 2000)
  }
}

// 复制历史记录链接
function copyHistoryUrl(url) {
  navigator.clipboard.writeText(url)
  toast.success('链接已复制')
}

// 选择历史记录项
function selectHistoryItem(item) {
  uploadResult.value = item
  copied.value = false
}

// 确认删除
function confirmDelete(item) {
  deleteTarget.value = item
  showDeleteModal.value = true
}

// 取消删除
function cancelDelete() {
  showDeleteModal.value = false
  deleteTarget.value = null
}

// 执行删除
async function doDelete() {
  if (!deleteTarget.value) return
  
  deleting.value = true
  try {
    const result = await api.delete(`/api/image/${deleteTarget.value.id}`)
    if (result.success) {
      toast.success('图片已删除')
      // 从历史记录中移除
      history.value = history.value.filter(item => item.id !== deleteTarget.value.id)
      // 如果删除的是当前显示的图片，清除结果
      if (uploadResult.value?.id === deleteTarget.value.id) {
        uploadResult.value = null
      }
      cancelDelete()
    } else {
      toast.error(result.error || '删除失败')
    }
  } catch (e) {
    console.error('Delete failed:', e)
    toast.error('删除失败')
  } finally {
    deleting.value = false
  }
}

// 加载历史记录
async function loadHistory() {
  historyLoading.value = true
  try {
    const result = await api.get('/api/image/history')
    if (result.success && result.data?.images) {
      history.value = result.data.images
    }
  } catch (e) {
    console.error('Load history failed:', e)
  } finally {
    historyLoading.value = false
  }
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 初始化
onMounted(() => {
  if (isLoggedIn.value) {
    loadHistory()
    loadPriceInfo()
  }
})
</script>

<style scoped>
.ld-image-page {
  min-height: 100vh;
  padding-bottom: 40px;
  background: var(--bg-primary);
}

.page-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 16px;
}

.page-header {
  margin-bottom: 16px;
  text-align: center;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px;
}

/* 使用须知 */
.notice-section {
  background: var(--bg-card);
  border-radius: 12px;
  margin-bottom: 20px;
  border: 1px solid var(--border-light);
  overflow: hidden;
}

.notice-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.notice-header:hover {
  background: var(--bg-secondary);
}

.notice-icon {
  font-size: 18px;
}

.notice-title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.notice-toggle {
  font-size: 12px;
  color: var(--text-tertiary);
}

.notice-content {
  padding: 0 16px 16px;
  border-top: 1px solid var(--border-light);
}

.notice-list {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.notice-list li {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 6px 0;
  line-height: 1.5;
}

.notice-list li strong {
  color: var(--text-primary);
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 300px;
}

.page-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

/* 维护提示 */
.maintenance-notice {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  border-radius: 20px;
  padding: 48px 24px;
  text-align: center;
  box-shadow: var(--shadow-sm);
  border: 1px solid #ffcc80;
  margin-bottom: 24px;
}

.maintenance-icon {
  font-size: 56px;
  margin-bottom: 16px;
}

.maintenance-notice h3 {
  font-size: 22px;
  font-weight: 600;
  color: #e65100;
  margin: 0 0 12px;
}

.maintenance-notice p {
  font-size: 15px;
  color: #bf360c;
  margin: 0 0 8px;
  line-height: 1.6;
}

.maintenance-hint {
  font-size: 13px;
  color: #8d6e63;
  margin-top: 16px !important;
}

/* 暗色模式维护提示 */
:root.dark .maintenance-notice {
  background: linear-gradient(135deg, #3e2723 0%, #4e342e 100%);
  border-color: #6d4c41;
}

:root.dark .maintenance-notice h3 {
  color: #ffab91;
}

:root.dark .maintenance-notice p {
  color: #ffccbc;
}

:root.dark .maintenance-hint {
  color: #a1887f;
}

/* 未登录提示 */
.login-prompt {
  background: var(--bg-card);
  border-radius: 20px;
  padding: 48px 24px;
  text-align: center;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.prompt-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.login-prompt h3 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.login-prompt p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 24px;
}

.login-btn {
  display: inline-block;
  padding: 12px 32px;
  background: linear-gradient(135deg, var(--color-success) 0%, #7a9a7a 100%);
  color: white;
  text-decoration: none;
  border-radius: 12px;
  font-weight: 600;
  transition: all 0.2s;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(90, 140, 90, 0.4);
}

/* 上传区域 */
.upload-section {
  background: var(--bg-card);
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.upload-area {
  border: 2px dashed var(--border-color);
  border-radius: 16px;
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: var(--bg-secondary);
  position: relative;
}

.upload-area:hover,
.upload-area.drag-over {
  border-color: var(--color-success);
  background: var(--color-success-bg);
}

.upload-area.has-file {
  border-style: solid;
  padding: 16px;
}

.hidden-input {
  display: none;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.hint-text {
  font-size: 16px;
  color: var(--text-primary);
  margin: 0 0 8px;
  font-weight: 500;
}

.hint-sub {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
}

/* 预览 */
.preview-container {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

.preview-image {
  max-width: 100%;
  max-height: 300px;
  border-radius: 12px;
  object-fit: contain;
}

.clear-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-danger);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}

/* 费用说明 */
.fee-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 16px 0;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 10px;
}

.fee-icon {
  font-size: 18px;
}

.fee-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.fee-text strong {
  color: var(--color-warning);
  font-weight: 600;
}

.upload-count {
  font-size: 12px;
  color: var(--text-muted);
  margin-left: 4px;
}

/* 阶梯定价 */
.price-tiers {
  margin: 12px 0;
  background: var(--bg-secondary);
  border-radius: 10px;
  overflow: hidden;
}

.tiers-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  transition: background 0.2s;
}

.tiers-header:hover {
  background: var(--bg-tertiary);
}

.tiers-toggle {
  font-size: 12px;
  color: var(--text-muted);
}

.tiers-content {
  padding: 0 16px 16px;
}

.tier-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 6px;
  background: var(--bg-card);
  border-radius: 8px;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.tier-item.active {
  border-color: var(--color-primary);
  background: rgba(var(--color-primary-rgb), 0.1);
}

.tier-range {
  font-size: 13px;
  color: var(--text-secondary);
}

.tier-price {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-warning);
}

.tier-item.active .tier-range,
.tier-item.active .tier-price {
  color: var(--color-primary);
}

.next-tier-hint {
  margin: 10px 0 0;
  padding: 8px 12px;
  background: rgba(var(--color-warning-rgb), 0.1);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-warning);
  text-align: center;
}

/* 上传按钮 */
.upload-btn {
  display: block;
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, var(--color-success) 0%, #7a9a7a 100%);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(90, 140, 90, 0.4);
}

.upload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 上传结果 */
.upload-result {
  margin-top: 20px;
  padding: 20px;
  background: var(--color-success-bg);
  border: 1px solid var(--color-success);
  border-radius: 14px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.result-icon {
  font-size: 20px;
}

.result-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-success);
}

.result-url {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.url-input {
  flex: 1;
  padding: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 13px;
  font-family: monospace;
  color: var(--text-primary);
}

.copy-btn {
  padding: 12px 16px;
  background: var(--color-success);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.copy-btn:hover {
  opacity: 0.9;
}

.result-preview {
  border-radius: 10px;
  overflow: hidden;
}

.result-preview img {
  width: 100%;
  max-height: 200px;
  object-fit: contain;
  background: var(--bg-secondary);
}

/* 历史记录 */
.history-section {
  background: var(--bg-card);
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.refresh-btn {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover {
  background: var(--bg-tertiary);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-tertiary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

/* 加载状态 */
.loading-state {
  padding: 20px 0;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.skeleton-item {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 12px;
}

.skeleton-image {
  width: 100%;
  height: 100px;
  border-radius: 8px;
}

.skeleton {
  background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-line {
  height: 14px;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 历史网格 */
.history-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (min-width: 600px) {
  .history-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.history-item {
  background: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.history-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.item-image {
  width: 100%;
  height: 100px;
  overflow: hidden;
}

.item-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-info {
  padding: 10px 12px;
}

.item-name {
  font-size: 12px;
  color: var(--text-primary);
  margin: 0 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-date {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0;
}

.item-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.history-item:hover .item-actions {
  opacity: 1;
}

.item-copy,
.item-delete {
  width: 32px;
  height: 32px;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.item-copy:hover {
  background: rgba(90, 140, 90, 0.8);
}

.item-delete:hover {
  background: rgba(239, 68, 68, 0.8);
}

/* 删除弹窗 */
.delete-modal {
  background: var(--bg-card);
  border-radius: 20px;
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-light);
}

.delete-preview {
  text-align: center;
  margin-bottom: 16px;
}

.delete-preview img {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
  object-fit: contain;
}

.delete-warning {
  font-size: 15px;
  color: var(--text-primary);
  text-align: center;
  margin: 0 0 20px;
}

.delete-actions {
  display: flex;
  gap: 12px;
}

.cancel-btn {
  flex: 1;
  padding: 12px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: none;
  border-radius: 10px;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: var(--bg-tertiary);
}

.confirm-delete-btn {
  flex: 1;
  padding: 12px;
  background: var(--color-danger);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-delete-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.confirm-delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 支付弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.pay-modal {
  background: var(--bg-card);
  border-radius: 20px;
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-light);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-light);
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
}

.modal-body {
  padding: 24px;
}

.pay-info {
  text-align: center;
  margin-bottom: 24px;
}

.pay-info p {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--text-primary);
}

.pay-info strong {
  color: var(--color-warning);
  font-size: 20px;
}

.pay-tip {
  font-size: 13px !important;
  color: var(--text-tertiary) !important;
}

.pay-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pay-btn {
  padding: 14px;
  background: linear-gradient(135deg, var(--color-success) 0%, #7a9a7a 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.pay-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(90, 140, 90, 0.4);
}

.check-btn {
  padding: 14px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.check-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.check-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pay-error {
  margin-top: 16px;
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-danger);
  text-align: center;
}

/* 弹窗动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .pay-modal,
.modal-leave-active .pay-modal {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .pay-modal,
.modal-leave-to .pay-modal {
  transform: scale(0.9);
  opacity: 0;
}

/* 工具类 */
.w-full { width: 100%; }
.w-32 { width: 128px; }
.w-48 { width: 192px; }
.mt-2 { margin-top: 8px; }
.mt-4 { margin-top: 16px; }
</style>
