<template>
  <div class="settings-page">
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">LDC 收款配置</h1>
      </div>
      
      <!-- 加载中 -->
      <div v-if="loading" class="loading-state">
        <div class="skeleton-card">
          <div class="skeleton skeleton-line w-32"></div>
          <div class="skeleton skeleton-line w-full mt-4"></div>
          <div class="skeleton skeleton-line w-full mt-2"></div>
          <div class="skeleton skeleton-line w-48 mt-4"></div>
        </div>
      </div>
      
      <!-- 设置表单 -->
      <div v-else class="settings-form">
        <!-- 统计信息（已配置时显示）-->
        <div v-if="isConfigured" class="stats-card">
          <h3 class="card-title">📊 CDK 分发收入统计</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{ stats.totalOrders || 0 }}</div>
              <div class="stat-label">总订单</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ formatMoney(stats.totalRevenue) }}</div>
              <div class="stat-label">总收入 (LDC)</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ stats.thisMonthOrders || 0 }}</div>
              <div class="stat-label">本月订单</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ formatMoney(stats.thisMonthRevenue) }}</div>
              <div class="stat-label">本月收入 (LDC)</div>
            </div>
          </div>
        </div>
        
        <!-- 配置表单 -->
        <div class="form-card">
          <div class="form-header">
            <h3 class="card-title">💳 LDC 收款配置</h3>
            <div v-if="isConfigured" class="config-status">
              <span :class="['status-badge', config.isVerified ? 'verified' : 'pending']">
                {{ config.isVerified ? '✓ 已验证' : '⏳ 待验证' }}
              </span>
              <span :class="['status-badge', config.isActive ? 'active' : 'inactive']">
                {{ config.isActive ? '已启用' : '已禁用' }}
              </span>
            </div>
          </div>
          
          <p v-if="!isConfigured" class="card-desc">
            💡 配置 LDC 收款后，您发布的 CDK 物品可支持平台内支付和自动发货。
          </p>
          
          <div class="form-group">
            <label class="form-label">Client ID (PID)</label>
            <input
              v-model="ldcPid"
              type="text"
              class="form-input"
              :placeholder="isConfigured ? '' : '请输入您的 LDC Client ID'"
              :disabled="isConfigured && !isEditing"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">Client Key</label>
            <input
              v-model="ldcKey"
              type="password"
              class="form-input"
              :placeholder="isConfigured && !isEditing ? '' : '请输入您的 LDC Client Key'"
              :disabled="isConfigured && !isEditing"
            />
            <p class="form-hint">
              {{ isConfigured ? '密钥已安全存储，修改时需重新输入' : '密钥将安全加密存储，不会明文显示' }}
            </p>
          </div>
          
          <div class="form-actions">
            <template v-if="isConfigured && !isEditing">
              <button class="edit-btn" @click="startEdit">✏️ 编辑配置</button>
              <button class="test-btn" @click="testCallback" :disabled="testing">
                {{ testing ? '测试中...' : '🔔 测试通知' }}
              </button>
              <button class="delete-btn" @click="deleteConfig">🗑️ 删除配置</button>
            </template>
            <template v-else>
              <button
                class="save-btn"
                @click="saveSettings"
                :disabled="saving || !canSave"
              >
                {{ saving ? '验证中...' : '💾 保存配置' }}
              </button>
              <button v-if="isConfigured" class="cancel-btn" @click="cancelEdit">取消</button>
            </template>
          </div>
        </div>
        
        <!-- 使用说明 -->
        <div class="help-card">
          <h3 class="card-title">❓ 如何获取 LDC 收款凭证</h3>
          
          <div class="help-content">
            <div class="help-step">
              <span class="step-num">1</span>
              <div class="step-content">
                <h4 class="step-title">访问 LDC 集市</h4>
                <p class="step-desc">
                  访问 <a href="https://credit.linux.do/merchant" target="_blank" rel="noopener">LDC 集市</a>，
                  创建新应用
                </p>
              </div>
            </div>
            
            <div class="help-step">
              <span class="step-num">2</span>
              <div class="step-content">
                <h4 class="step-title">配置通知地址（必填）</h4>
                <p class="step-desc">
                  <strong>通知URL（服务器异步通知⚠️最最最重要⚠️）：</strong>
                </p>
                <code class="url-code">https://api.ldspro.qzz.io/api/shop/ldc/notify</code>
                <p class="step-desc" style="margin-top: 8px;">
                  <strong>回调URL（支付后浏览器跳转）：</strong>
                </p>
                <code class="url-code">https://api.ldspro.qzz.io/api/shop/ldc/return</code>
              </div>
            </div>
            
            <div class="help-step">
              <span class="step-num">3</span>
              <div class="step-content">
                <h4 class="step-title">获取凭证</h4>
                <p class="step-desc">
                  在应用详情页获取 Client ID 和 Client Key，填写到上方配置表单并保存
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 注意事项 -->
        <div class="warning-card">
          <h3 class="card-title">⚠️ 注意事项</h3>
          <ul class="warning-list">
            <li><strong>通知地址</strong>是支付成功后自动发货的关键，请务必正确配置。配置错误会导致用户支付但订单无法正常完成❗️</li>
            <li>Client Key 将安全加密存储，不会明文显示</li>
            <li>修改配置不会影响已有订单</li>
            <li>如遇收款问题，请联系@JackyLiii</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useShopStore } from '@/stores/shop'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { api } from '@/utils/api'

const shopStore = useShopStore()
const toast = useToast()
const dialog = useDialog()

// API 基础地址（用于显示通知地址）
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin

const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const isEditing = ref(false)
const config = ref({})
const stats = ref({})
const ldcPid = ref('')
const ldcKey = ref('')

// 是否已配置
const isConfigured = computed(() => !!config.value.configured)

// 是否可以保存
const canSave = computed(() => {
  if (!ldcPid.value.trim()) return false
  if (!ldcKey.value.trim()) return false
  if (isConfigured.value && ldcKey.value === '••••••••••••••••') return false
  return true
})

// 格式化金额
function formatMoney(value) {
  return parseFloat(value || 0).toFixed(2)
}

// 加载设置
async function loadSettings() {
  try {
    loading.value = true
    const result = await shopStore.fetchMerchantConfig()
    // 解包嵌套 data
    const data = result?.data?.data || result?.data || result || {}
    config.value = data
    stats.value = data.stats || {}
    ldcPid.value = data.ldcPid || ''
    ldcKey.value = data.configured ? '••••••••••••••••' : ''
  } catch (error) {
    toast.error('加载设置失败')
  } finally {
    loading.value = false
  }
}

// 开始编辑
function startEdit() {
  isEditing.value = true
  ldcKey.value = ''
}

// 取消编辑
function cancelEdit() {
  isEditing.value = false
  ldcPid.value = config.value.ldcPid || ''
  ldcKey.value = config.value.configured ? '••••••••••••••••' : ''
}

// 保存设置
async function saveSettings() {
  if (!canSave.value) {
    toast.error('请填写完整的 Client ID 和 Client Key')
    return
  }
  
  saving.value = true
  try {
    // Base64 编码 Key 避免 WAF 拦截
    const encodedKey = btoa(ldcKey.value)
    const result = await api.post('/api/shop/merchant/config', {
      ldcPid: ldcPid.value.trim(),
      ldcKeyEncoded: encodedKey
    })
    
    if (result.success) {
      const data = result.data || result
      if (data.callbackWarning) {
        toast.warning(`配置已保存，但通知地址验证有警告：${data.callbackWarning}`)
      } else {
        toast.success('配置保存成功')
      }
      isEditing.value = false
      await loadSettings()
    } else {
      toast.error(result.error || '保存失败')
    }
  } catch (error) {
    toast.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 测试通知
async function testCallback() {
  testing.value = true
  try {
    const result = await api.post('/api/shop/merchant/test-callback')
    if (result.success) {
      const data = result.data?.data || result.data || {}
      if (data.status === 'ok') {
        toast.success('通知测试成功！您的通知地址配置正确')
      } else {
        toast.warning(data.message || '通知测试完成，请检查配置')
      }
    } else {
      toast.error(result.error || '测试失败')
    }
  } catch (error) {
    toast.error('测试失败')
  } finally {
    testing.value = false
  }
}

// 删除配置
async function deleteConfig() {
  const confirmed = await dialog.confirm('确定要删除 LDC 收款配置吗？删除后将无法自动发货。', {
    title: '删除配置',
    icon: '🗑️',
    danger: true
  })
  
  if (!confirmed) return
  
  try {
    const result = await api.delete('/api/shop/merchant/config')
    if (result.success) {
      toast.success('配置已删除')
      await loadSettings()
    } else {
      toast.error(result.error || '删除失败')
    }
  } catch (error) {
    toast.error('删除失败')
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  padding-bottom: 80px;
  background: var(--bg-primary);
}

.page-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

/* 加载骨架 */
.loading-state {
  padding-top: 20px;
}

.skeleton-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
}

.skeleton {
  background: var(--skeleton-gradient);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-line {
  height: 16px;
}

.w-32 { width: 128px; }
.w-48 { width: 192px; }
.w-full { width: 100%; }
.mt-2 { margin-top: 8px; }
.mt-4 { margin-top: 16px; }

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* 统计卡片 */
.stats-card {
  background: var(--color-success-light);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.stats-card .card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-success);
  margin: 0 0 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.stat-item {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 14px;
  text-align: center;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 表单卡片 */
.form-card,
.help-card,
.warning-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-sm);
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.config-status {
  display: flex;
  gap: 6px;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.verified {
  background: var(--color-success-light);
  color: var(--color-success);
}

.status-badge.pending {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.status-badge.active {
  background: var(--color-success-light);
  color: var(--color-success);
}

.status-badge.inactive {
  background: var(--bg-secondary);
  color: var(--text-tertiary);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.card-desc {
  font-size: 14px;
  color: var(--text-tertiary);
  margin: 0 0 20px;
  line-height: 1.6;
}

/* 表单 */
.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: var(--color-primary);
}

.form-input:disabled {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

.form-input::placeholder {
  color: var(--text-placeholder);
}

.form-hint {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 8px 0 0;
}

.form-hint a {
  color: var(--color-info);
  text-decoration: none;
}

.form-hint a:hover {
  text-decoration: underline;
}

/* 按钮 */
.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 8px;
}

.save-btn {
  flex: 1;
  min-width: 140px;
  padding: 14px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.save-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-primary);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.edit-btn,
.test-btn,
.cancel-btn {
  flex: 1;
  min-width: 100px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.edit-btn:hover,
.test-btn:hover,
.cancel-btn:hover {
  background: var(--bg-tertiary);
}

.test-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.delete-btn {
  flex: 1;
  min-width: 100px;
  padding: 12px 16px;
  background: var(--color-danger-light);
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-danger);
  cursor: pointer;
  transition: all 0.2s;
}

.delete-btn:hover {
  background: var(--color-danger-light);
  filter: brightness(0.95);
}

/* 帮助内容 */
.help-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

.help-step {
  display: flex;
  gap: 14px;
}

.step-num {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: white;
  font-size: 14px;
  font-weight: 600;
  border-radius: 50%;
}

.step-content {
  flex: 1;
  padding-top: 2px;
}

.step-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px;
}

.step-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.5;
}

.step-desc a {
  color: var(--color-info);
  text-decoration: none;
}

.step-desc a:hover {
  text-decoration: underline;
}

.url-code {
  display: block;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: var(--color-info);
  word-break: break-all;
  margin-top: 4px;
}

/* 警告卡片 */
.warning-card {
  background: var(--color-warning-light);
  border: 1px solid var(--border-color);
}

.warning-card .card-title {
  color: var(--color-warning);
}

.warning-list {
  margin: 16px 0 0;
  padding: 0 0 0 20px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.8;
}

.warning-list li {
  margin-bottom: 4px;
}

.warning-list li:last-child {
  margin-bottom: 0;
}
</style>
