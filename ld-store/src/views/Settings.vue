<template>
  <div class="settings-page">
    <div class="page-container">
      <SellerPageToolbar description="配置并验证 LDC 收款凭证后，平台订单才能稳定到账。" />
      <section v-if="showProductPublishReturn" class="publish-return-card" aria-labelledby="publish-return-title">
        <div class="publish-return-icon" aria-hidden="true">
          <PackageCheck :size="21" />
        </div>
        <div class="publish-return-copy">
          <h2 id="publish-return-title">完成收款配置后继续发布</h2>
          <p role="status" aria-live="polite" aria-atomic="true">
            {{ merchantReady
              ? '收款配置已启用并通过验证，可以返回发布页继续填写。'
              : '发布草稿已保存在当前设备，请先保存并验证收款配置。' }}
          </p>
        </div>
        <button
          type="button"
          class="publish-return-button"
          :disabled="loading || !merchantReady"
          :title="merchantReady ? '返回发布页' : '收款配置启用并验证后才可返回'"
          @click="returnToProductPublish"
        >
          <ArrowLeft :size="17" aria-hidden="true" />
          返回继续发布
        </button>
      </section>

      <div v-if="loading" class="loading-state">
        <div class="skeleton-card">
          <div class="skeleton skeleton-line w-32"></div>
          <div class="skeleton skeleton-line w-full mt-4"></div>
          <div class="skeleton skeleton-line w-full mt-2"></div>
          <div class="skeleton skeleton-line w-48 mt-4"></div>
        </div>
      </div>

      <div v-else-if="loadError" class="settings-error-state" role="alert">
        <CircleAlert :size="24" aria-hidden="true" />
        <h2>收款配置加载失败</h2>
        <p>{{ loadError }}</p>
        <button type="button" class="save-btn compact" @click="loadSettings">重新加载</button>
      </div>
      
      <div v-else class="settings-form">
        <section class="payment-status-strip" aria-labelledby="payment-status-title">
          <div class="status-lead">
            <p>收款状态</p>
            <h2 id="payment-status-title">{{ isConfigured ? '凭证已配置' : '等待接入 LDC 收款' }}</h2>
            <div class="config-status">
              <SellerStatusBadge :label="config.isVerified ? '已验证' : (isConfigured ? '待验证' : '未配置')" :tone="config.isVerified ? 'success' : 'warning'" />
              <SellerStatusBadge :label="config.isActive ? '已启用' : '未启用'" :tone="config.isActive ? 'success' : 'neutral'" />
            </div>
          </div>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{ stats.totalOrders || 0 }}</div>
              <div class="stat-label">累计订单</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ formatMoney(stats.totalRevenue) }}</div>
              <div class="stat-label">累计收入 · LDC</div>
            </div>
          </div>
        </section>

        <div class="payment-workspace">
          <section class="credential-panel" aria-labelledby="credential-title">
        
        <div class="form-card">
          <div class="form-header">
            <div><p class="panel-eyebrow">凭证配置</p><h2 id="credential-title" class="card-title">LDC 应用凭证</h2></div>
          </div>
          
          <p v-if="!isConfigured" class="card-desc">
            配置 LDC 收款后，您发布的普通物品和 CDK 物品可支持平台内支付，CDK 物品还可自动发货。
          </p>
          
          <div class="form-group">
            <label class="form-label">Client ID (PID)</label>
            <div v-if="isConfigured && !isEditing" class="credential-value mono">{{ ldcPid }}</div>
            <input
              v-else
              v-model="ldcPid"
              type="text"
              class="form-input"
              placeholder="请输入您的 LDC Client ID"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">Client Key</label>
            <div v-if="isConfigured && !isEditing" class="credential-value secret-value"><LockKeyhole :size="16" aria-hidden="true" /> 已安全加密存储</div>
            <div v-else class="secret-input-wrap">
              <input v-model="ldcKey" :type="showKey ? 'text' : 'password'" class="form-input" placeholder="请输入您的 LDC Client Key" />
              <button type="button" class="secret-toggle" :aria-label="showKey ? '隐藏 Client Key' : '显示 Client Key'" @click="showKey = !showKey">
                <EyeOff v-if="showKey" :size="17" aria-hidden="true" />
                <Eye v-else :size="17" aria-hidden="true" />
              </button>
            </div>
            <p v-if="saveError" class="form-error" role="alert">{{ saveError }}</p>
            <p class="form-hint">
              {{ isConfigured ? '密钥已安全存储，修改时需重新输入' : '密钥将安全加密存储，不会明文显示' }}
            </p>
          </div>
          
          <div class="form-actions">
            <template v-if="isConfigured && !isEditing">
              <button class="edit-btn" @click="startEdit">编辑配置</button>
            </template>
            <template v-else>
              <button
                class="save-btn"
                @click="saveSettings"
                :disabled="saving || !canSave"
              >
                {{ saving ? '验证中...' : '保存配置' }}
              </button>
              <button v-if="isConfigured" class="cancel-btn" @click="cancelEdit">取消</button>
            </template>
          </div>
        </div>
          </section>

          <section class="integration-panel" aria-labelledby="integration-title">
        <div class="help-card">
          <div class="form-header"><div><p class="panel-eyebrow">接入检查</p><h2 id="integration-title" class="card-title">通知与回调</h2></div></div>

          <div class="endpoint-list">
            <div class="endpoint-row">
              <div><span>通知 URL</span><code>{{ ldcNotifyUrl }}</code></div>
              <button type="button" class="copy-btn" @click="copyEndpoint(ldcNotifyUrl, '通知 URL')"><Copy :size="15" aria-hidden="true" />复制</button>
            </div>
            <div class="endpoint-row">
              <div><span>回调 URL</span><code>{{ ldcReturnUrl }}</code></div>
              <button type="button" class="copy-btn" @click="copyEndpoint(ldcReturnUrl, '回调 URL')"><Copy :size="15" aria-hidden="true" />复制</button>
            </div>
          </div>

          <div class="callback-test">
            <button type="button" class="test-btn" @click="testCallback" :disabled="testing || !isConfigured">
              <Send :size="16" aria-hidden="true" />{{ testing ? '正在测试…' : '测试通知' }}
            </button>
            <p v-if="testResult" class="test-result" :class="testResult.tone" role="status">{{ testResult.message }}</p>
            <p v-else class="test-hint">保存凭证后可发送一次测试通知，结果会显示在这里。</p>
          </div>
          
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
                <h4 class="step-title">填写通知与回调地址</h4>
                <p class="step-desc">将上方两个地址分别填写至应用设置，通知 URL 为自动履约的必要配置。</p>
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
        
        <div class="warning-card">
          <h3 class="card-title">注意事项</h3>
          <ul class="warning-list">
            <li><strong>通知地址</strong>是支付成功后自动发货的关键，请务必正确配置。配置错误会导致用户支付但订单无法正常完成。</li>
            <li>系统会在待支付期间每 30 秒主动补查一次订单状态，但这只是兜底，不能替代正确的通知地址和回调地址配置</li>
            <li>Client Key 将安全加密存储，不会明文显示</li>
            <li>修改配置不会影响已有订单</li>
            <li>如遇收款问题，请联系@JackyLiii</li>
          </ul>
        </div>
          </section>
        </div>

        <section v-if="isConfigured" class="payment-danger-zone" aria-labelledby="delete-config-title">
          <div><h2 id="delete-config-title">删除收款配置</h2><p>删除后新订单将无法使用当前凭证收款，已有订单记录不受影响。</p></div>
          <button type="button" class="delete-btn" @click="deleteConfig">删除配置</button>
        </section>
      </div>

      <section class="discovery-preference-card" aria-labelledby="discovery-preference-title">
        <div class="discovery-preference-copy">
          <p class="panel-eyebrow">浏览体验</p>
          <h2 id="discovery-preference-title">个性化物品推荐</h2>
          <p>开启后会根据近期购买、收藏和浏览改善默认排序；关闭后使用全站趋势，不再保存与你账号关联的新发现事件。</p>
          <p v-if="discoveryPreferenceError" class="form-error" role="status">{{ discoveryPreferenceError }}</p>
        </div>
        <button
          type="button"
          class="preference-switch"
          :class="{ active: personalizationEnabled }"
          role="switch"
          :aria-checked="personalizationEnabled"
          :aria-label="personalizationEnabled ? '关闭个性化物品推荐' : '开启个性化物品推荐'"
          :disabled="discoveryPreferenceLoading || discoveryPreferenceSaving"
          @click="toggleDiscoveryPreference"
        >
          <span class="preference-switch-track" aria-hidden="true"><span /></span>
          <span>{{ discoveryPreferenceSaving ? '保存中…' : (personalizationEnabled ? '已开启' : '已关闭') }}</span>
        </button>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInventoryStore } from '@/stores/inventory'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import {
  createMerchantConfigRequest,
  deleteMerchantConfigRequest,
  testMerchantCallbackRequest
} from '@/services/shop/merchantService'
import { PRODUCT_PUBLISH_PAYMENT_SOURCE } from '@/utils/productPublishDraft'
import { fetchDiscoveryPreferenceRequest, updateDiscoveryPreferenceRequest } from '@/services/shop/discoveryService'
import SellerPageToolbar from '@/components/seller/SellerPageToolbar.vue'
import SellerStatusBadge from '@/components/seller/SellerStatusBadge.vue'
import { ArrowLeft, CircleAlert, Copy, Eye, EyeOff, LockKeyhole, PackageCheck, Send } from '@lucide/vue'

const inventoryStore = useInventoryStore()
const toast = useToast()
const dialog = useDialog()
const route = useRoute()
const router = useRouter()

// 配置页展示的回调地址始终指向商城后端正式入口，避免本地代理地址误导商家配置
const merchantApiBaseUrl = computed(() => {
  const baseUrl = import.meta.env.VITE_API_BASE || 'https://api2.ldspro.qzz.io'
  return String(baseUrl).replace(/\/+$/, '')
})
const ldcNotifyUrl = computed(() => `${merchantApiBaseUrl.value}/api/shop/ldc/notify`)
const ldcReturnUrl = computed(() => `${merchantApiBaseUrl.value}/api/shop/ldc/return`)

const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const isEditing = ref(false)
const config = ref({})
const stats = ref({})
const ldcPid = ref('')
const ldcKey = ref('')
const showKey = ref(false)
const loadError = ref('')
const saveError = ref('')
const testResult = ref(null)
const personalizationEnabled = ref(true)
const discoveryPreferenceLoading = ref(true)
const discoveryPreferenceSaving = ref(false)
const discoveryPreferenceError = ref('')

// 是否已配置
const isConfigured = computed(() => !!config.value.configured)
const merchantReady = computed(() => !!config.value.configured && !!config.value.isActive && !!config.value.isVerified)
const showProductPublishReturn = computed(() => route.query.source === PRODUCT_PUBLISH_PAYMENT_SOURCE)

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

function returnToProductPublish() {
  if (!merchantReady.value) return
  router.push({ name: 'SellerPublish' })
}

// 加载设置
async function loadSettings() {
  try {
    loading.value = true
    loadError.value = ''
    const result = await inventoryStore.fetchMerchantConfig()
    if (!result.success) throw new Error(result.error || '加载设置失败')
    const data = result.data || {}
    config.value = data
    stats.value = data.stats || {}
    ldcPid.value = data.ldcPid || ''
    ldcKey.value = data.configured ? '••••••••••••••••' : ''
  } catch (error) {
    loadError.value = error?.message || '网络异常，请稍后重试。'
    toast.error('加载设置失败')
  } finally {
    loading.value = false
  }
}

// 开始编辑
function startEdit() {
  isEditing.value = true
  ldcKey.value = ''
  saveError.value = ''
  showKey.value = false
}

// 取消编辑
function cancelEdit() {
  isEditing.value = false
  ldcPid.value = config.value.ldcPid || ''
  ldcKey.value = config.value.configured ? '••••••••••••••••' : ''
  saveError.value = ''
  showKey.value = false
}

async function copyEndpoint(value, label) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label}已复制`)
  } catch {
    toast.error('复制失败，请手动选择地址复制')
  }
}

// 保存设置
async function saveSettings() {
  if (!canSave.value) {
    toast.error('请填写完整的 Client ID 和 Client Key')
    return
  }
  
  saving.value = true
  saveError.value = ''
  try {
    // Base64 编码 Key 避免 WAF 拦截
    const encodedKey = btoa(ldcKey.value)
    const result = await createMerchantConfigRequest({
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
      saveError.value = result.error?.message || result.error || '保存失败，请检查凭证后重试。'
      toast.error(saveError.value)
    }
  } catch (error) {
    saveError.value = error?.message || '保存失败，请检查网络后重试。'
    toast.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 测试通知
async function testCallback() {
  testing.value = true
  testResult.value = null
  try {
    const result = await testMerchantCallbackRequest()
    if (result.success) {
      const data = result.data || {}
      if (data.status === 'ok') {
        testResult.value = { tone: 'success', message: '测试成功，通知地址可以正常接收请求。' }
        toast.success('通知测试成功！您的通知地址配置正确')
      } else {
        testResult.value = { tone: 'warning', message: data.message || '测试已完成，请核对 LDC 应用中的通知地址。' }
        toast.warning(data.message || '通知测试完成，请检查配置')
      }
    } else {
      testResult.value = { tone: 'danger', message: result.error?.message || result.error || '测试失败，请稍后重试。' }
      toast.error(result.error || '测试失败')
    }
  } catch (error) {
    testResult.value = { tone: 'danger', message: error?.message || '测试失败，请检查网络后重试。' }
    toast.error('测试失败')
  } finally {
    testing.value = false
  }
}

// 删除配置
async function deleteConfig() {
  const confirmed = await dialog.confirm('确定要删除 LDC 收款配置吗？删除后将无法自动发货。', {
    title: '删除配置',
    icon: '',
    danger: true
  })
  
  if (!confirmed) return
  
  try {
    const result = await deleteMerchantConfigRequest()
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

async function loadDiscoveryPreference() {
  discoveryPreferenceLoading.value = true
  discoveryPreferenceError.value = ''
  try {
    const result = await fetchDiscoveryPreferenceRequest()
    if (result?.success && typeof result.data?.personalizationEnabled === 'boolean') {
      personalizationEnabled.value = result.data.personalizationEnabled
    } else {
      discoveryPreferenceError.value = result?.error || '个性化偏好暂时无法读取'
    }
  } catch (error) {
    discoveryPreferenceError.value = error?.message || '个性化偏好暂时无法读取'
  } finally {
    discoveryPreferenceLoading.value = false
  }
}

async function toggleDiscoveryPreference() {
  if (discoveryPreferenceLoading.value || discoveryPreferenceSaving.value) return
  const nextValue = !personalizationEnabled.value
  discoveryPreferenceSaving.value = true
  discoveryPreferenceError.value = ''
  try {
    const result = await updateDiscoveryPreferenceRequest(nextValue)
    if (!result?.success) {
      discoveryPreferenceError.value = result?.error || '保存失败，请稍后重试'
      return
    }
    personalizationEnabled.value = result.data?.personalizationEnabled === true
    toast.success(personalizationEnabled.value ? '已开启个性化推荐' : '已关闭个性化推荐')
  } catch (error) {
    discoveryPreferenceError.value = error?.message || '保存失败，请稍后重试'
  } finally {
    discoveryPreferenceSaving.value = false
  }
}

onMounted(() => {
  void Promise.allSettled([loadSettings(), loadDiscoveryPreference()])
})
</script>

<style scoped>
.settings-page {
  --settings-tone-sage-bg: var(--palette-hex-edf2ec);
  --settings-tone-sage-text: var(--palette-hex-647c6a);
  --settings-tone-sage-border: var(--palette-hex-d8e2d7);
  --settings-tone-amber-bg: var(--palette-hex-f5efe6);
  --settings-tone-amber-text: var(--palette-hex-8d7456);
  --settings-tone-amber-border: var(--palette-hex-e7d8c4);
  --settings-tone-rose-bg: var(--palette-hex-f4eae7);
  --settings-tone-rose-text: var(--palette-hex-91645f);
  --settings-tone-rose-border: var(--palette-hex-e6d3cf);

  min-height: 100vh;
  padding-bottom: 80px;
}

html.dark .settings-page {
  --settings-tone-sage-bg: var(--palette-rgba-111-136-116-0p18);
  --settings-tone-sage-text: var(--palette-hex-9ab49f);
  --settings-tone-sage-border: var(--palette-rgba-111-136-116-0p3);
  --settings-tone-amber-bg: var(--palette-rgba-143-121-92-0p2);
  --settings-tone-amber-text: var(--palette-hex-c9ae8d);
  --settings-tone-amber-border: var(--palette-rgba-143-121-92-0p32);
  --settings-tone-rose-bg: var(--palette-rgba-145-100-95-0p2);
  --settings-tone-rose-text: var(--palette-hex-c7a09a);
  --settings-tone-rose-border: var(--palette-rgba-145-100-95-0p34);
}

.page-container {
  max-width: 600px;
}

.discovery-preference-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 16px;
  padding: 20px 22px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
}

.discovery-preference-copy {
  min-width: 0;
}

.discovery-preference-copy h2 {
  margin: 2px 0 6px;
  color: var(--text-primary);
  font-size: 16px;
}

.discovery-preference-copy > p:not(.panel-eyebrow):not(.form-error) {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.preference-switch {
  min-width: 108px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 0 0 auto;
  padding: 8px 12px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
}

.preference-switch.active {
  color: var(--settings-tone-sage-text);
  background: var(--settings-tone-sage-bg);
  border-color: var(--settings-tone-sage-border);
}

.preference-switch:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.preference-switch:disabled {
  opacity: 0.65;
  cursor: wait;
}

.preference-switch-track {
  width: 30px;
  height: 18px;
  padding: 2px;
  display: flex;
  align-items: center;
  background: var(--text-tertiary);
  border-radius: 999px;
}

.preference-switch-track span {
  width: 14px;
  height: 14px;
  background: var(--bg-card);
  border-radius: 50%;
  transform: translateX(0);
  transition: transform 0.2s ease;
}

.preference-switch.active .preference-switch-track {
  background: var(--settings-tone-sage-text);
}

.preference-switch.active .preference-switch-track span {
  transform: translateX(12px);
}

@media (max-width: 639px) {
  .discovery-preference-card {
    align-items: stretch;
    flex-direction: column;
  }

  .preference-switch {
    width: 100%;
  }
}

.publish-return-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 14px;
  color: var(--settings-tone-sage-text);
  background: var(--settings-tone-sage-bg);
  border: 1px solid var(--settings-tone-sage-border);
  border-radius: 14px;
}

.publish-return-icon {
  width: 40px;
  height: 40px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  color: var(--settings-tone-sage-text);
  background: var(--bg-card);
  border: 1px solid var(--settings-tone-sage-border);
  border-radius: 12px;
}

.publish-return-copy {
  flex: 1;
  min-width: 0;
}

.publish-return-copy h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
}

.publish-return-copy p {
  margin: 3px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.publish-return-button {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 0 0 auto;
  padding: 10px 13px;
  color: var(--palette-hex-ffffff);
  background: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: 11px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.publish-return-button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.publish-return-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.publish-return-button:disabled {
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  border-color: var(--border-color);
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 639px) {
  .publish-return-card {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .publish-return-button {
    width: 100%;
  }
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: var(--text-display);
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
  background: var(--settings-tone-sage-bg);
  border: 1px solid var(--settings-tone-sage-border);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.stats-card .card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--settings-tone-sage-text);
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
  border: 1px solid transparent;
}

.status-badge.verified {
  background: var(--settings-tone-sage-bg);
  color: var(--settings-tone-sage-text);
  border-color: var(--settings-tone-sage-border);
}

.status-badge.pending {
  background: var(--settings-tone-amber-bg);
  color: var(--settings-tone-amber-text);
  border-color: var(--settings-tone-amber-border);
}

.status-badge.active {
  background: var(--settings-tone-sage-bg);
  color: var(--settings-tone-sage-text);
  border-color: var(--settings-tone-sage-border);
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
  color: var(--palette-hex-ffffff);
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
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
  background: var(--settings-tone-rose-bg);
  border: 1px solid var(--settings-tone-rose-border);
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--settings-tone-rose-text);
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.delete-btn:hover {
  filter: brightness(0.98);
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
  color: var(--palette-hex-ffffff);
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
  background: var(--settings-tone-amber-bg);
  border: 1px solid var(--settings-tone-amber-border);
}

.warning-card .card-title {
  color: var(--settings-tone-amber-text);
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

/* Seller ledger layout */
.payment-status-strip {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
  padding: 18px 20px;
  border: 1px solid var(--seller-border);
  border-left: 4px solid var(--seller-jade);
  border-radius: 14px;
  background: var(--seller-surface);
  box-shadow: var(--seller-shadow-sm);
}

.status-lead > p,
.panel-eyebrow {
  margin: 0 0 4px;
  color: var(--seller-jade);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .14em;
}

.status-lead h2 {
  margin: 0 0 12px;
  color: var(--seller-ink);
  font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif;
  font-size: 19px;
}

.config-status { display: flex; flex-wrap: wrap; gap: 7px; }
.payment-status-strip .stats-grid { width: min(100%, 360px); gap: 1px; background: var(--seller-border); }
.payment-status-strip .stat-item { display: grid; align-content: center; min-width: 150px; border-radius: 0; background: var(--seller-surface); }
.payment-status-strip .stat-value { color: var(--seller-ink); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 21px; font-variant-numeric: tabular-nums; }
.payment-status-strip .stat-label { color: var(--seller-muted); }

.payment-workspace {
  display: grid;
  gap: 18px;
  align-items: start;
}

.credential-panel,
.integration-panel,
.payment-danger-zone,
.settings-error-state {
  min-width: 0;
  border: 1px solid var(--seller-border);
  border-radius: 14px;
  background: var(--seller-surface);
  box-shadow: var(--seller-shadow-sm);
}

.credential-panel,
.integration-panel { padding: clamp(20px, 2vw, 28px); }
.form-card,
.help-card,
.warning-card { padding: 0; margin: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.form-header { margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1px solid var(--seller-border); }
.card-title { margin: 0; color: var(--seller-ink); font-family: "Noto Serif SC", "Source Han Serif SC", serif; font-size: 19px; }
.card-desc { color: var(--seller-muted); }

.form-label { color: var(--seller-ink); font-size: 13px; font-weight: 650; }
.form-input {
  min-height: 46px;
  border-color: var(--seller-border);
  border-radius: 10px;
  background: var(--seller-surface-strong);
  color: var(--seller-ink);
}
.form-input:focus { border-color: var(--seller-jade); box-shadow: 0 0 0 3px color-mix(in srgb, var(--seller-jade) 14%, transparent); }
.credential-value {
  display: flex;
  min-height: 46px;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  border: 1px solid var(--seller-border);
  border-radius: 10px;
  background: var(--seller-surface-muted);
  color: var(--seller-ink);
}
.credential-value.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
.secret-value { color: var(--seller-muted); }
.secret-input-wrap { position: relative; }
.secret-input-wrap .form-input { padding-right: 48px; }
.secret-toggle {
  position: absolute;
  top: 3px;
  right: 3px;
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--seller-muted);
  cursor: pointer;
}
.form-error { margin: 7px 0 0; color: var(--seller-danger); font-size: 12px; line-height: 1.5; }

.save-btn,
.edit-btn,
.test-btn,
.cancel-btn { min-height: 44px; border-radius: 10px; }
.save-btn { background: var(--seller-navy); box-shadow: none; }
.save-btn.compact { width: auto; min-width: 0; flex: none; padding: 10px 16px; }
.edit-btn,
.test-btn,
.cancel-btn { border: 1px solid var(--seller-border); background: var(--seller-surface-muted); color: var(--seller-ink); }

.endpoint-list { display: grid; gap: 10px; }
.endpoint-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--seller-border);
  border-radius: 10px;
  background: var(--seller-surface-muted);
}
.endpoint-row > div { min-width: 0; flex: 1; }
.endpoint-row span { display: block; margin-bottom: 4px; color: var(--seller-muted); font-size: 11px; }
.endpoint-row code { display: block; overflow: hidden; color: var(--seller-ink); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.copy-btn {
  display: inline-flex;
  min-height: 38px;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  padding: 8px 10px;
  border: 1px solid var(--seller-border);
  border-radius: 8px;
  background: var(--seller-surface);
  color: var(--seller-ink);
  cursor: pointer;
}

.callback-test { margin: 14px 0 22px; padding-bottom: 20px; border-bottom: 1px solid var(--seller-border); }
.callback-test .test-btn { display: inline-flex; align-items: center; gap: 7px; }
.test-result,
.test-hint { margin: 10px 0 0; font-size: 12px; line-height: 1.55; }
.test-hint { color: var(--seller-muted); }
.test-result.success { color: var(--seller-success); }
.test-result.warning { color: var(--seller-warning); }
.test-result.danger { color: var(--seller-danger); }

.help-content { padding-bottom: 20px; border-bottom: 1px solid var(--seller-border); }
.step-num { background: var(--seller-jade); }
.step-title { color: var(--seller-ink); }
.step-desc { color: var(--seller-muted); }
.warning-card { padding-top: 20px; }
.warning-card .card-title { color: var(--seller-ink); font-family: inherit; font-size: 14px; }
.warning-list { margin-top: 10px; color: var(--seller-muted); font-size: 12px; line-height: 1.7; }

.payment-danger-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 18px;
  padding: 20px;
  border-color: color-mix(in srgb, var(--seller-danger) 32%, var(--seller-border));
}
.payment-danger-zone h2 { margin: 0 0 4px; color: var(--seller-ink); font-size: 14px; }
.payment-danger-zone p { margin: 0; color: var(--seller-muted); font-size: 12px; }
.payment-danger-zone .delete-btn { flex: 0 0 auto; min-height: 42px; }

.settings-error-state {
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 28px;
  color: var(--seller-muted);
}
.settings-error-state h2 { margin: 0; color: var(--seller-ink); font-size: 18px; }
.settings-error-state p { margin: 0 0 6px; }

@media (min-width: 1024px) {
  .payment-workspace { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
}

@media (max-width: 767px) {
  .payment-status-strip,
  .payment-danger-zone { align-items: stretch; flex-direction: column; }
  .payment-status-strip .stats-grid { width: 100%; }
  .payment-status-strip .stat-item { min-width: 0; padding-inline: 8px; }
  .endpoint-row { align-items: stretch; flex-direction: column; }
  .copy-btn { align-self: flex-start; }
  .payment-danger-zone .delete-btn { width: 100%; }
}
</style>
