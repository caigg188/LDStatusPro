<template>
  <div class="publish-page">
    <FulfillmentRuleDialog v-bind="fulfillmentReminder.dialogProps" @confirm="fulfillmentReminder.confirm" @cancel="fulfillmentReminder.cancel" @retry="fulfillmentReminder.retry" />
    <Transition name="submit-mask">
      <div
        v-if="publishOverlayVisible"
        class="submit-mask"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="submit-mask-card">
          <span class="submit-mask-spinner" aria-hidden="true"></span>
          <h3 class="submit-mask-title">{{ publishOverlayTitle }}</h3>
          <p class="submit-mask-text">{{ publishOverlayDescription }}</p>
        </div>
      </div>
    </Transition>

    <!-- 使用说明弹窗 -->
    <Teleport to="body">
      <Transition name="modal" @after-leave="guideClosing = false">
        <div v-if="showGuideModal" class="guide-modal-overlay" @click.self="closeGuideModal">
          <div class="guide-modal">
            <div class="guide-modal-header">
              <div class="guide-modal-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
              </div>
              <h3 class="guide-modal-title">发布前必读</h3>
            </div>
            <div class="guide-modal-body">
              <p class="guide-modal-text">
                首次发布物品？建议先阅读<strong>物品类型说明</strong>，了解「普通物品」与「自动发卡」的区别及适用场景，助您选择最合适的发布方式。
              </p>
              <p class="guide-modal-warning">
                <strong>禁止发布</strong>：违法违规、色情低俗、侵权盗版、虚假欺诈等内容，违者将被封禁处理。
              </p>
            </div>
            <div class="guide-modal-footer">
              <button class="guide-btn guide-btn-secondary" @click="closeGuideModal">
                我已了解，开始发布
              </button>
              <router-link to="/docs/product-types" class="guide-btn guide-btn-primary">
                查看使用说明
              </router-link>
            </div>
            <label class="guide-modal-remember">
              <input type="checkbox" v-model="dontShowAgain" />
              <span>不再提示</span>
            </label>
          </div>
        </div>
      </Transition>
      
      <!-- 测试模式提示弹窗 -->
      <Transition name="modal">
        <div v-if="showTestModeModal" class="guide-modal-overlay" @click.self="cancelTestMode">
          <div
            class="guide-modal test-mode-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="test-mode-modal-title"
            aria-describedby="test-mode-modal-description"
          >
            <div class="guide-modal-header">
              <div class="guide-modal-icon test-icon" aria-hidden="true">
                <FlaskConical :size="28" />
              </div>
              <h3 id="test-mode-modal-title" class="guide-modal-title">开启测试模式</h3>
            </div>
            <div class="guide-modal-body">
              <p id="test-mode-modal-description" class="guide-modal-text">
                测试模式下，<strong>只有您自己可以购买此物品</strong>，其他用户将无法购买。
              </p>
              <ul class="test-mode-tips">
                <li class="tip-item"><CircleCheck :size="16" aria-hidden="true" /><span>用于测试 LDC 支付回调通知是否正常</span></li>
                <li class="tip-item"><CircleCheck :size="16" aria-hidden="true" /><span>购买后会正常扣款和发放 CDK</span></li>
                <li class="tip-item"><CircleCheck :size="16" aria-hidden="true" /><span>测试完成后请及时下架或删除测试物品</span></li>
                <li class="tip-item">
                  <CircleCheck :size="16" aria-hidden="true" />
                  <span>测试完成请务必在 <a class="test-mode-link" href="https://credit.linux.do/merchant" target="_blank" rel="noopener noreferrer">LDC 集市</a>中关闭应用的测试模式</span>
                </li>
                <li class="tip-item warning"><Clock3 :size="16" aria-hidden="true" /><span>测试模式商品上架 30 分钟后会自动下架</span></li>
              </ul>
              <p class="guide-modal-warning test-warning">
                <strong>请确保已在 LDC 应用中开启测试模式</strong>，否则可能无法收到回调通知。
              </p>
            </div>
            <div class="guide-modal-footer">
              <button type="button" class="guide-btn guide-btn-secondary" @click="cancelTestMode">
                取消
              </button>
              <button type="button" class="guide-btn guide-btn-primary" @click="confirmTestMode">
                确认开启
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <div class="page-container">
      <div v-if="publishMode !== 'product' || !lockedMode" class="page-header">
        <h1 class="page-title">{{ publishMode === 'product' ? '发布物品' : '发布求购' }}</h1>
      </div>
      
      <div v-if="!lockedMode" class="publish-mode-switch">
        <button
          type="button"
          class="mode-btn"
          :class="{ active: publishMode === 'product' }"
          @click="publishMode = 'product'"
        >
          发布物品
        </button>
        <button
          type="button"
          class="mode-btn"
          :class="{ active: publishMode === 'buy' }"
          @click="publishMode = 'buy'"
        >
          发布求购
        </button>
      </div>

      <form v-if="publishMode === 'product'" class="publish-form seller-product-form" @submit.prevent="submitForm">
        <section class="draft-panel" :class="{ 'has-error': draftState === 'error' }" aria-label="发布草稿状态">
          <div class="draft-status-row">
            <CircleAlert v-if="draftState === 'error'" :size="18" aria-hidden="true" />
            <Cloud v-else :size="18" aria-hidden="true" />
            <p role="status" aria-live="polite" aria-atomic="true">{{ draftStatusText }}</p>
            <button v-if="draftState === 'error'" type="button" class="draft-text-button" @click="retryDraftSave">
              重试保存
            </button>
          </div>
          <div v-if="hasRestoredDraft" class="draft-restore-notice">
            <ShieldAlert :size="20" aria-hidden="true" />
            <div class="draft-restore-copy">
              <strong>已恢复 {{ formatDraftTime(restoredDraftAt) }} 的草稿</strong>
              <p v-if="restoredSensitiveFields.length">
                为保障库存安全，CDK 卡密未保存，请重新填写。
              </p>
              <p v-if="restoredCategoryNotice">{{ restoredCategoryNotice }}</p>
            </div>
            <button type="button" class="draft-discard-button" @click="discardProductDraft">放弃草稿</button>
          </div>
        </section>

        <div class="form-card product-type-section">
          <div class="type-heading"><h2 id="product-type-title" class="card-title">物品类型</h2><router-link to="/docs/product-types" target="_blank" rel="noopener noreferrer">物品类型说明<ArrowUpRight :size="14" aria-hidden="true" /></router-link></div>
          <div class="type-select" role="radiogroup" aria-labelledby="product-type-title">
            <button
              v-for="(type, index) in productTypes"
              :key="type.id"
              type="button"
              role="radio"
              :aria-checked="form.productType === type.id"
              :tabindex="form.productType === type.id ? 0 : -1"
              :disabled="fulfillmentReminder.pending || productSubmittingBusy"
              :class="['type-card', { active: form.productType === type.id }]"
              @click="selectProductType(type.id)"
              @keydown="handleProductTypeKeydown($event, index)"
            >
              <component :is="type.icon" class="type-icon" :size="22" :stroke-width="1.7" aria-hidden="true" />
              <span class="type-info"><span class="type-name">{{ type.name }}</span><span class="type-desc">{{ type.desc }}</span></span>
              <CircleCheck v-if="form.productType === type.id" class="type-selected-icon" :size="20" aria-hidden="true" />
            </button>
          </div>
        </div>

        <ProductEditorForm
          ref="productEditorFormRef"
          v-model="form"
          v-model:desc-mode="descMode"
          variant="publish"
          :categories="categories"
          :categories-loading="categoriesLoading"
          :categories-load-error="categoriesLoadError"
          :description-preview="descriptionPreview"
          :description-placeholder="descriptionPlaceholder"
          :errors="productEditorDisplayErrors"
          :is-ruzhan-category="isRuzhanCategory"
          :ruzhan-price-error="ruzhanPriceError"
          :final-price="finalPrice"
          :image-validating="imageValidating"
          :image-validated="imageValidated"
          :image-load-error="imageLoadError"
          :image-preview-url="imagePreviewUrl"
          @touched="markTouched"
          @retry-categories="loadCategories"
          @validate-image="validateImageLoad"
          @preview-error="onPreviewError"
        />

        <!-- 普通物品设置 -->
        <div class="form-card" v-if="form.productType === 'normal'">
          <div class="type-heading"><h2 class="card-title">普通物品设置</h2><button type="button" class="rule-text-link" @click="fulfillmentReminder.request({ force: true })">查看发货规则<ArrowUpRight :size="14" aria-hidden="true" /></button></div>

          <div class="cdk-config-notice">
            <div class="notice-header">
              <span class="notice-icon" aria-hidden="true"></span>
              <strong>普通物品会在平台内支付并保留订单记录，卖家需人工履约。</strong>
            </div>
            <div class="notice-content">
              <div class="notice-item">
                <span class="item-num">1</span>
                <div class="item-text">
                  <strong>请先在<button type="button" class="inline-payment-link" @click="goToPaymentSettings">卖家后台</button>配置 LDC 收款信息</strong>，否则买家无法完成平台内支付。
                </div>
              </div>
              <div class="notice-item highlight">
                <span class="item-num">2</span>
                <div class="item-text">
                  <strong>买家支付成功后需要主动联系卖家获取服务</strong>，平台会在订单中提醒买家，同时也会提醒您尽快处理交付。
                </div>
              </div>
              <div class="notice-item">
                <span class="item-num">3</span>
                <div class="item-text">
                  <strong>请填写真实库存</strong>，库存耗尽后商品将无法继续下单。
                </div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label required">库存数量</label>
            <input
              v-model="form.stock"
              type="number"
              class="form-input"
              :class="{ 'input-error': showError('stock', stockError) }"
              placeholder="例如：20"
              min="1"
              max="1000000"
              step="1"
              ref="stockInput"
              @input="markTouched('stock')"
            />
            <p v-if="showError('stock', stockError)" class="form-error">{{ stockError }}</p>
            <p v-else class="form-hint">
              支付后不会自动发卡，您需要在订单页与买家完成后续交付。
            </p>
          </div>

        </div>

        <div class="form-card">
          <h2 class="card-title">兑换门槛</h2>

          <div class="form-group">
            <label class="form-label">商品购买信任等级门槛</label>
            <select v-model.number="form.purchaseTrustLevel" class="form-input">
              <option v-for="level in purchaseTrustLevelOptions" :key="level" :value="level">
                TL{{ level }}{{ level === 0 ? '（不限制）' : '' }}
              </option>
            </select>
            <p class="form-hint">
              仅影响“兑换”门槛；TL0 表示任何能看到该商品的用户都可以兑换。
            </p>
          </div>

          <div class="form-group">
            <PurchaseLimitSelector
              ref="maxPurchaseQuantityInput"
              v-model:mode="form.purchaseLimitType"
              v-model:quantity="form.maxPurchaseQuantity"
              v-model:period-days="form.purchaseLimitPeriodDays"
              :shared-cdk-enabled="form.productType === 'cdk' && form.sharedCdkEnabled"
              :error="maxPurchaseQuantityError"
              :period-error="purchaseLimitPeriodDaysError"
              input-id-prefix="publish-purchase-limit"
            />
          </div>
        </div>
        
        <!-- CDK 类型设置 -->
        <div class="form-card" v-if="form.productType === 'cdk'">
          <h2 class="card-title">CDK 设置</h2>
          
          <!-- LDC 配置提醒 -->
          <div class="cdk-config-notice">
            <div class="notice-header">
              <span class="notice-icon">注意</span>
              <strong>发布 CDK 物品前，请确保已完成以下配置：</strong>
            </div>
            <div class="notice-content">
              <div class="notice-item">
                <span class="item-num">1</span>
                <div class="item-text">
                  <strong>在<button type="button" class="inline-payment-link" @click="goToPaymentSettings">卖家后台</button>配置 LDC 收款信息</strong>：在「收款设置」中填写 Client ID 和 Client Key
                </div>
              </div>
              <div class="notice-item highlight">
                <span class="item-num">2</span>
                <div class="item-text">
                  <strong>在<a href="https://credit.linux.do/merchant" target="_blank" class="merchant-config-link"> LDC集市 </a>配置通知地址（最重要）</strong>：这是支付成功后自动发货的关键！
                  <code class="notice-url">https://api.ldspro.qzz.io/api/shop/ldc/notify</code>
                </div>
              </div>
              <div class="notice-item">
                <span class="item-num">3</span>
                <div class="item-text">
                  <strong>在<a href="https://credit.linux.do/merchant" target="_blank" class="merchant-config-link"> LDC集市 </a>配置回调地址</strong>：支付完成后浏览器跳转地址
                  <code class="notice-url">https://api.ldspro.qzz.io/api/shop/ldc/return</code>
                </div>
              </div>
            </div>
            <div class="notice-footer">
              <a href="/docs/publish-product#auto-delivery" target="_blank" rel="noopener">查看自动发卡配置教程</a>
            </div>
          </div>
          
          <div class="form-group">
            <label class="toggle-switch limit-toggle" @click.prevent="form.sharedCdkEnabled = !form.sharedCdkEnabled">
              <span class="toggle-track" :class="{ active: form.sharedCdkEnabled }">
                <span class="toggle-thumb"></span>
              </span>
              <span class="toggle-label">
                共享卡密模式
                <span class="toggle-help" v-if="form.sharedCdkEnabled">（同一 CDK 重复发货）</span>
              </span>
            </label>
            <p class="form-hint">开启后只需填写 1 个 CDK，库存为无限，系统会固定每位用户累计只能购买 1 件。</p>
          </div>

          <div class="form-group">
            <label class="form-label required">{{ form.sharedCdkEnabled ? '共享 CDK 卡密' : 'CDK 卡密' }}</label>
            <textarea
              v-if="!form.sharedCdkEnabled"
              v-model="form.cdkCodes"
              class="form-textarea code"
              :class="{ 'input-error': showError('cdkCodes', cdkCodesError) }"
              placeholder="每行一个 CDK，支持批量添加，会自动去重&#10;物品发布后也可在「我的物品」中管理 CDK 库存"
              rows="5"
              ref="cdkCodesInput"
              @input="markTouched('cdkCodes')"
            ></textarea>
            <textarea
              v-else
              v-model="form.sharedCdkCode"
              class="form-textarea code"
              :class="{ 'input-error': showError('cdkCodes', cdkCodesError) }"
              placeholder="请输入 1 个共享 CDK"
              rows="3"
              ref="cdkCodesInput"
              @input="markTouched('cdkCodes')"
            ></textarea>
            <p v-if="showError('cdkCodes', cdkCodesError)" class="form-error">{{ cdkCodesError }}</p>
            <p v-else class="form-hint">
              <span v-if="form.sharedCdkEnabled">共享卡密模式下只允许填写 1 个 CDK</span>
              <span v-else-if="cdkCount > 0">已输入 {{ cdkCount }} 个 CDK（单次最多 {{ CDK_UPLOAD_LIMITS.perBatch }} 条）</span>
              <span v-else>至少填写 1 个 CDK 卡密</span>
            </p>
          </div>

          <!-- 测试模式开关 -->
          <div class="form-group test-mode-group">
            <label class="toggle-switch" @click.prevent="toggleTestMode">
              <span class="toggle-track" :class="{ active: form.isTestMode }">
                <span class="toggle-thumb"></span>
              </span>
              <span class="toggle-label">
                测试模式
                <span class="toggle-help" v-if="form.isTestMode">（仅自己可购买）</span>
              </span>
            </label>
            <p class="form-hint test-mode-hint">
              开启后仅您自己可以购买此物品，用于测试 LDC 通知回调是否正常工作。
            </p>
            <p v-if="form.isTestMode" class="test-mode-auto-offline-note">
              测试模式商品审核通过并上架后，30 分钟会自动下架；如需继续售卖，请关闭测试模式后重新上架。
            </p>
          </div>
          
          <div class="cdk-note">
            <p class="note-text">CDK 使用说明请写在上方「物品描述」中，买家购买后可在订单详情中查看。</p>
          </div>
        </div>
        
        <SellerStickySummary class="seller-product-summary" eyebrow="发布校对" title="物品摘要">
          <div class="seller-summary-preview" :class="{ empty: !imagePreviewUrl }">
            <img v-if="imagePreviewUrl" :src="imagePreviewUrl" :alt="form.name || '物品预览'" />
            <ImageIcon v-else :size="26" aria-hidden="true" />
          </div>
          <h3 class="seller-summary-name">{{ form.name || '尚未填写物品名称' }}</h3>
          <p class="seller-summary-meta">{{ selectedCategoryName }} · {{ form.productType === 'cdk' ? '自动发卡' : '普通物品' }}</p>
          <dl class="seller-summary-facts"><div><dt>成交价</dt><dd>{{ finalPrice > 0 ? finalPrice.toFixed(2) : '—' }} LDC</dd></div><div><dt>{{ form.productType === 'cdk' ? '卡密' : '库存' }}</dt><dd>{{ form.productType === 'cdk' ? (form.sharedCdkEnabled ? '共享模式' : `${cdkCount} 个`) : (form.stock || '—') }}</dd></div><div><dt>限购</dt><dd>{{ purchaseLimitSummary }}</dd></div></dl>
          <ul class="seller-readiness-list"><li :class="{ ready: merchantConfigured }"><span></span>{{ merchantReadinessText }}</li><li :class="{ ready: !!form.name.trim() }"><span></span>物品名称</li><li :class="{ ready: !!form.categoryId }"><span></span>物品分类</li><li :class="{ ready: imageValidated && lastValidatedUrl === form.imageUrl.trim() }"><span></span>图片验证</li></ul>
          <template #action><button type="submit" class="submit-btn" :disabled="!canSubmit || productSubmittingBusy || fulfillmentReminder.pending">{{ submitButtonText }}</button></template>
        </SellerStickySummary>
      </form>

      <BuyRequestEditorForm v-else @busy="buySubmitting = $event" />
    </div>
  </div>
</template>

<script setup>
import FulfillmentRuleDialog from '@/components/seller/FulfillmentRuleDialog.vue'
import { useFulfillmentReminder } from '@/composables/useFulfillmentReminder'
import { reactive, ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { ArrowUpRight, KeyRound, PackageCheck, CircleAlert, CircleCheck, Clock3, Cloud, FlaskConical, Image as ImageIcon, ShieldAlert } from '@lucide/vue'
import { onBeforeRouteLeave, useRouter, useRoute } from 'vue-router'
import { useCatalogStore } from '@/stores/catalog'
import { useInventoryStore } from '@/stores/inventory'
import { useUserStore } from '@/stores/user'
import { captureAuthSession, isAuthSessionCurrent } from '@/utils/auth'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { validateProductName, validateProductDescription, validatePrice } from '@/utils/security'
import { renderProductDescription } from '@/utils/renderProductDescription'
import { CDK_UPLOAD_LIMITS } from '@/config/cdkQuota'
import SellerStickySummary from '@/components/seller/SellerStickySummary.vue'
import PurchaseLimitSelector from '@/components/product/PurchaseLimitSelector.vue'
import ProductEditorForm from '@/components/product-editor/ProductEditorForm.vue'
import BuyRequestEditorForm from '@/components/product-editor/BuyRequestEditorForm.vue'
import {
  buildProductCreatePayload,
  createProductEditorFormState,
  useProductEditor
} from '@/composables/product-editor/useProductEditor'
import { useProductDraft } from '@/composables/product-editor/useProductDraft'
import {
  createSubmissionToken,
  isUncertainMutationResult,
  reconcileByPolling
} from '@/composables/product-editor/useSubmissionReconciliation'
import {
  PRODUCT_PUBLISH_PAYMENT_SOURCE
} from '@/utils/productPublishDraft'

const props = defineProps({
  initialMode: {
    type: String,
    default: 'product'
  },
  lockedMode: {
    type: Boolean,
    default: false
  }
})

const router = useRouter()
const route = useRoute()
const catalogStore = useCatalogStore()
const inventoryStore = useInventoryStore()
const userStore = useUserStore()
const editorSession = captureAuthSession()
const toast = useToast()
const dialog = useDialog()
const fulfillmentReminder = reactive(useFulfillmentReminder(() => `${userStore.currentUser?.site || 'linux.do'}:${userStore.currentUser?.id || ''}`))
const guideClosing = ref(false)
const publishInitialized = ref(false)
const restoredNormalReminderPending = ref(false)

async function selectProductType(type) {
  if (fulfillmentReminder.pending || productSubmittingBusy.value || form.value.productType === type) return
  if (type === 'normal' && !await fulfillmentReminder.request()) return
  form.value.productType = type
}

async function handleProductTypeKeydown(event, index) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? productTypes.length - 1
    : (index + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + productTypes.length) % productTypes.length
  const group = event.currentTarget.closest('[role="radiogroup"]')
  await selectProductType(productTypes[next].id)
  await nextTick()
  group?.querySelector('[aria-checked="true"]')?.focus()
}

const submitting = ref(false)
const submitConfirming = ref(false)
const descMode = ref('write')
const merchantConfigured = ref(false)
const merchantStatusLoaded = ref(false)
const merchantConfigError = ref('')
const showGuideModal = ref(false)
const dontShowAgain = ref(false)
const lockedMode = computed(() => props.lockedMode)
const publishMode = ref(props.initialMode === 'buy' ? 'buy' : 'product')
const buySubmitting = ref(false)

const submitAttempted = ref(false)
const submitTokenState = ref({
  token: '',
  fingerprint: ''
})
const touched = ref({
  name: false,
  description: false,
  price: false,
  discount: false,
  image: false,
  stock: false,
  cdkCodes: false
})

const productEditorFormRef = ref(null)
const stockInput = ref(null)
const cdkCodesInput = ref(null)
const maxPurchaseQuantityInput = ref(null)

const fieldRefs = {
  stock: stockInput,
  cdkCodes: cdkCodesInput,
  maxPurchaseQuantity: maxPurchaseQuantityInput
}

function markTouched(field) {
  if (field in touched.value) {
    touched.value[field] = true
  }
}

function focusField(field) {
  if (['name', 'description', 'price', 'discount', 'image'].includes(field)) {
    productEditorFormRef.value?.focusField?.(field)
    return
  }
  const elRef = fieldRefs[field]
  if (elRef?.value) {
    elRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
    try {
      elRef.value.focus({ preventScroll: true })
    } catch (e) {
      // ignore focus errors
    }
  }
}

// localStorage key
const GUIDE_MODAL_KEY = 'ld_store_publish_guide_seen'
const PRODUCT_SUBMIT_TIMEOUT_MS = 90000
const PRODUCT_SUBMIT_STATUS_MAX_RETRIES = 8
const PRODUCT_SUBMIT_STATUS_RETRY_INTERVAL_MS = 2000

// 关闭弹窗
function closeGuideModal() {
  guideClosing.value = true
  showGuideModal.value = false
  if (dontShowAgain.value) {
    localStorage.setItem(GUIDE_MODAL_KEY, 'true')
  }
}

function createDefaultProductForm(categoryId = null) {
  return createProductEditorFormState({ categoryId, productType: 'cdk' })
}

// 表单数据
const form = ref(createDefaultProductForm())
const restoredCategoryId = ref(null)
const restoredCategoryNotice = ref('')
const {
  draftReady,
  draftDirty,
  draftState,
  draftSavedAt,
  draftError,
  hasRestoredDraft,
  restoredDraftAt,
  restoredSensitiveFields,
  draftStatusText,
  formatDraftTime,
  clearDraftSaveTimer,
  flushProductDraft,
  retryDraftSave,
  restoreProductDraft: restoreDraft,
  clearPersistedProductDraft: clearDraft,
  markDirty: markDraftDirty
} = useProductDraft({
  getUser: () => userStore.currentUser,
  form,
  isActive: () => publishMode.value === 'product'
})

function restoreProductDraft() {
  const draft = restoreDraft(() => createDefaultProductForm())
  restoredCategoryId.value = draft?.form.categoryId ?? null
  restoredNormalReminderPending.value = draft?.form.productType === 'normal'
}

function clearPersistedProductDraft() {
  const cleared = clearDraft()
  if (cleared) {
    restoredCategoryId.value = null
    restoredCategoryNotice.value = ''
  }
  return cleared
}

async function discardProductDraft() {
  const confirmed = await dialog.confirm('放弃后，当前已自动保存的发布内容将无法恢复。', {
    title: '放弃发布草稿',
    danger: true
  })
  if (!confirmed) return

  clearDraftSaveTimer()
  draftReady.value = false
  if (!clearPersistedProductDraft()) {
    draftState.value = 'error'
    draftError.value = '无法清除草稿，请稍后重试'
    draftReady.value = true
    return
  }

  fulfillmentReminder.reset()
  restoredNormalReminderPending.value = false
  form.value = createDefaultProductForm(categories.value[0]?.id ?? null)
  touched.value = {
    name: false,
    description: false,
    price: false,
    discount: false,
    image: false,
    stock: false,
    cdkCodes: false
  }
  submitAttempted.value = false
  descMode.value = 'write'
  showTestModeModal.value = false
  resetImageValidation()
  clearSubmissionTokenState()
  draftDirty.value = false
  draftSavedAt.value = 0
  draftState.value = 'idle'
  draftError.value = ''
  await nextTick()
  draftReady.value = true
}

function goToPaymentSettings() {
  if (!flushProductDraft()) {
    toast.error('草稿保存失败，请重试后再前往收款设置')
    return
  }
  router.push({
    name: 'SellerPayment',
    query: { source: PRODUCT_PUBLISH_PAYMENT_SOURCE }
  })
}

function handleDraftPageHide() {
  flushProductDraft()
}

function handleDraftVisibilityChange() {
  if (document.visibilityState === 'hidden') flushProductDraft()
}


// 测试模式弹窗提示
const showTestModeModal = ref(false)

// 切换测试模式
function toggleTestMode() {
  if (!form.value.isTestMode) {
    // 开启测试模式时弹窗提示
    showTestModeModal.value = true
  } else {
    // 直接关闭
    form.value.isTestMode = false
  }
}

// 确认开启测试模式
function confirmTestMode() {
  form.value.isTestMode = true
  showTestModeModal.value = false
}

// 取消测试模式
function cancelTestMode() {
  showTestModeModal.value = false
}

// 分类必须来自服务端，避免接口失败时提交过期的硬编码 ID
const categories = ref([])
const categoriesLoading = ref(false)
const categoriesLoadError = ref('')

// 加载分类
async function loadCategories() {
  categoriesLoading.value = true
  categoriesLoadError.value = ''
  try {
    const result = await catalogStore.fetchCategories()
    const availableCategories = result.success && Array.isArray(result.data.categories)
      ? result.data.categories.filter(cat => cat.name !== '小店' && cat.name !== '友情小店')
      : []

    if (availableCategories.length === 0) {
      categories.value = []
      form.value.categoryId = null
      categoriesLoadError.value = '物品分类加载失败，请重新加载后再发布'
      return
    }

    categories.value = availableCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon || ''
    }))
    const preferredCategoryId = form.value.categoryId ?? restoredCategoryId.value
    const restoredCategoryAvailable = categories.value.some(cat => Number(cat.id) === Number(preferredCategoryId))
    if (restoredCategoryAvailable) {
      form.value.categoryId = categories.value.find(cat => Number(cat.id) === Number(preferredCategoryId)).id
      restoredCategoryId.value = null
    } else {
      if (hasRestoredDraft.value && preferredCategoryId) {
        restoredCategoryNotice.value = '原草稿中的物品分类已不可用，请重新选择分类。'
        form.value.categoryId = null
      } else {
        form.value.categoryId = categories.value[0].id
      }
      restoredCategoryId.value = null
    }
  } catch (error) {
    categories.value = []
    form.value.categoryId = null
    categoriesLoadError.value = '物品分类加载失败，请重新加载后再发布'
  } finally {
    categoriesLoading.value = false
  }
}

// 物品类型
const productTypes = [
  { id: 'cdk', name: 'CDK 物品', desc: '买家支付后，系统自动发放卡密', icon: KeyRound },
  { id: 'normal', name: '普通物品', desc: '买家支付后，由您手动完成交付', icon: PackageCheck }
]
const purchaseTrustLevelOptions = [0, 1, 2, 3, 4]
const isSharedCdkMode = computed(() => form.value.productType === 'cdk' && !!form.value.sharedCdkEnabled)

// CDK 数量
const cdkCount = computed(() => {
  const source = isSharedCdkMode.value ? form.value.sharedCdkCode : form.value.cdkCodes
  if (!String(source || '').trim()) return 0
  return String(source)
    .split('\n')
    .filter(line => line.trim()).length
})

// 入站分类价格限制
const isRuzhanCategory = computed(() => {
  const selectedCategory = categories.value.find(cat => cat.id === form.value.categoryId)
  return selectedCategory?.name === '入站'
})

const selectedCategoryName = computed(() => categories.value.find(category => Number(category.id) === Number(form.value.categoryId))?.name || '未选择分类')

// 入站分类价格错误提示
const ruzhanPriceError = computed(() => {
  if (!isRuzhanCategory.value) return null
  if (!form.value.price) return null  // 空值不提示，由必填验证处理
  if (finalPrice.value < 500) {
    return `入站分类折后价格不得低于 500 LDC（当前: ${finalPrice.value.toFixed(2)} LDC）`
  }
  return null
})

// 物品描述 placeholder（根据类型变化）
const descriptionPlaceholder = computed(() => {
  if (form.value.productType === 'cdk') {
    return '请详细描述物品信息，包括：\n• 物品内容（如：某某会员月卡、某某游戏充值卡等）\n• 使用方式（如：在官网兑换、APP内激活等）\n• 有效期限（如：永久有效、激活后30天等）\n• 其他注意事项\n\n（10-1000字符）'
  }
  return '请详细描述物品信息、服务内容、交付方式与联系说明。\n• 建议写明买家支付完成后应如何联系您\n• 建议写明响应时间、交付周期与注意事项\n\n（10-1000字符）'
})

// 提交按钮文字
const productSubmittingBusy = computed(() => submitting.value || submitConfirming.value)
const publishOverlayVisible = computed(() => productSubmittingBusy.value || buySubmitting.value)

const publishOverlayTitle = computed(() => {
  if (publishMode.value === 'buy') return '正在发布求购'
  if (submitConfirming.value) return '正在确认发布结果'
  if (submitting.value && form.value.productType === 'cdk' && (form.value.cdkCodes.trim() || form.value.sharedCdkCode.trim())) {
    return '正在发布并上传 CDK'
  }
  return '正在提交发布信息'
})

const publishOverlayDescription = computed(() => {
  if (submitConfirming.value) {
    return '请求可能已发送成功，系统正在核对发布状态，请勿重复提交。'
  }
  return '网络较慢时可能需要较长时间，请耐心等待并保持当前页面。'
})

const submitButtonText = computed(() => {
  if (submitConfirming.value) {
    return '正在确认发布结果...'
  }
  if (submitting.value) {
    return form.value.productType === 'cdk' && (form.value.cdkCodes.trim() || form.value.sharedCdkCode.trim())
      ? '发布并上传CDK...'
      : '提交中...'
  }
  return form.value.productType === 'cdk' ? '发布并上传CDK' : '发布物品'
})

const {
  errors: productEditorErrors,
  finalPrice,
  purchaseLimitSummary,
  imageValidating,
  imageValidated,
  imageLoadError,
  imagePreviewUrl,
  lastValidatedUrl,
  resetImageValidation,
  validateImageLoad,
  onPreviewError
} = useProductEditor(form, { minimumStock: 1, requireCdkCodes: true })

// 图片URL验证（只有输入内容后才验证格式，空值不报错）
// 字段级校验
const nameError = computed(() => {
  const res = validateProductName(form.value.name)
  return res.valid ? '' : res.error
})

const descriptionError = computed(() => {
  const res = validateProductDescription(form.value.description)
  return res.valid ? '' : res.error
})

const descriptionPreview = computed(() => renderProductDescription(form.value.description))

const priceError = computed(() => {
  const res = validatePrice(form.value.price)
  return res.valid ? '' : res.error
})

const discountError = computed(() => {
  if (form.value.discount === '' || form.value.discount === null) {
    return '请填写折扣'
  }
  if (form.value.discount < 0.01 || form.value.discount > 1) {
    return '折扣范围需在 0.01-1 之间'
  }
  return ''
})



const stockError = computed(() => {
  if (form.value.productType !== 'normal') return ''
  const raw = String(form.value.stock ?? '').trim()
  if (!raw) return '请输入库存数量'
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) return '库存必须是大于 0 的整数'
  if (value > 1000000) return '库存不能超过 1000000'
  return ''
})

const maxPurchaseQuantityError = computed(() => {
  if (form.value.purchaseLimitType === 'none') return ''
  const raw = String(form.value.maxPurchaseQuantity ?? '').trim()
  if (!raw) return '请输入购买上限'
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) return '购买上限必须是大于 0 的整数'
  if (value > 1000) return '购买上限不能超过 1000'
  return ''
})

const purchaseLimitPeriodDaysError = computed(() => {
  if (form.value.purchaseLimitType !== 'per_user') return ''
  const raw = String(form.value.purchaseLimitPeriodDays ?? '').trim()
  if (!raw) return '请输入滚动周期'
  const value = Number(form.value.purchaseLimitPeriodDays || 0)
  if (value === 0) return ''
  if (!Number.isInteger(value) || value < 1 || value > 365) return '滚动周期必须是 1-365 天之间的整数'
  return ''
})

const cdkCodesError = computed(() => {
  if (form.value.productType !== 'cdk') return ''
  const source = form.value.sharedCdkEnabled ? form.value.sharedCdkCode : form.value.cdkCodes
  const lines = String(source || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return '请至少填写 1 个 CDK 卡密'
  if (form.value.sharedCdkEnabled && lines.length !== 1) return '共享卡密模式下只能填写 1 个 CDK 卡密'
  if (!form.value.sharedCdkEnabled && lines.length > CDK_UPLOAD_LIMITS.perBatch) {
    return `单次最多上传 ${CDK_UPLOAD_LIMITS.perBatch} 个 CDK 卡密（已输入 ${lines.length} 条）`
  }
  return ''
})
function showError(field, err) {
  return !!err && (touched.value[field] || submitAttempted.value)
}

const imageUrlError = computed(() => productEditorErrors.value.imageUrl || null)

const imageDisplayError = computed(() => {
  const url = form.value.imageUrl?.trim()
  if (!url) return submitAttempted.value ? '请填写物品图片链接' : ''
  if (imageLoadError.value) return imageLoadError.value
  return imageUrlError.value || ''
})

const productEditorDisplayErrors = computed(() => ({
  name: showError('name', nameError.value) ? nameError.value : '',
  description: showError('description', descriptionError.value) ? descriptionError.value : '',
  price: showError('price', priceError.value) ? priceError.value : '',
  discount: showError('discount', discountError.value) ? discountError.value : '',
  image: showError('image', imageDisplayError.value) ? imageDisplayError.value : ''
}))

// 是否可以提交
const canSubmit = computed(() => {
  if (!validateProductName(form.value.name).valid) return false
  if (!validateProductDescription(form.value.description).valid) return false
  if (!validatePrice(form.value.price).valid) return false
  if (discountError.value) return false
  if (!form.value.categoryId) return false
  if (!form.value.imageUrl?.trim()) return false
  if (imageUrlError.value) return false
  if (ruzhanPriceError.value) return false
  if (stockError.value) return false
  if (cdkCodesError.value) return false
  if (maxPurchaseQuantityError.value) return false
  if (purchaseLimitPeriodDaysError.value) return false
  return true
})

const merchantReadinessText = computed(() => {
  if (!merchantStatusLoaded.value) return '正在检查收款配置'
  if (merchantConfigError.value) return '收款配置状态加载失败'
  return merchantConfigured.value ? '收款配置已启用并完成认证' : '需要启用并认证收款配置'
})

// 检查商家配置
async function checkMerchantConfig() {
  merchantStatusLoaded.value = false
  merchantConfigError.value = ''
  try {
    const result = await inventoryStore.fetchMerchantConfig()
    if (!result.success) {
      merchantConfigured.value = false
      merchantConfigError.value = result.error || '收款配置状态加载失败，请刷新页面后重试'
      return
    }
    const config = result.data || {}
    merchantConfigured.value = !!config.configured && !!config.isActive && !!config.isVerified
  } catch (error) {
    merchantConfigured.value = false
    merchantConfigError.value = '收款配置状态加载失败，请刷新页面后重试'
  } finally {
    merchantStatusLoaded.value = true
  }
}

function buildProductFingerprint(productData) {
  return JSON.stringify({
    name: productData.name || '',
    categoryId: String(productData.categoryId || ''),
    description: productData.description || '',
    price: Number(productData.price || 0),
    discount: Number(productData.discount || 1),
    imageUrl: productData.imageUrl || '',
    productType: productData.productType || 'normal',
    stock: Number(productData.stock || 0),
    purchaseTrustLevel: Number(productData.purchaseTrustLevel || 0),
    purchaseLimitType: productData.purchaseLimitType || 'none',
    maxPurchaseQuantity: Number(productData.maxPurchaseQuantity || 0),
    purchaseLimitPeriodDays: Number(productData.purchaseLimitPeriodDays || 0),
    cdkCodes: productData.cdkCodes || '',
    sharedCdkEnabled: !!productData.sharedCdkEnabled,
    sharedCdkCode: productData.sharedCdkCode || '',
    isTestMode: !!productData.isTestMode
  })
}

function resolveSubmissionToken(productData) {
  const fingerprint = buildProductFingerprint(productData)
  if (!submitTokenState.value.token || submitTokenState.value.fingerprint !== fingerprint) {
    submitTokenState.value = {
      token: createSubmissionToken(),
      fingerprint
    }
  }
  return submitTokenState.value.token
}

function clearSubmissionTokenState() {
  submitTokenState.value = {
    token: '',
    fingerprint: ''
  }
}

async function pollProductSubmissionResult(submissionToken) {
  const result = await reconcileByPolling(
    async () => {
      if (!isAuthSessionCurrent(editorSession)) return null
      const statusResult = await inventoryStore.getProductSubmissionStatus(submissionToken)
      return statusResult?.success ? statusResult.data?.product || null : null
    },
    product => Boolean(product?.id),
    { retries: PRODUCT_SUBMIT_STATUS_MAX_RETRIES, intervalMs: PRODUCT_SUBMIT_STATUS_RETRY_INTERVAL_MS }
  )
  return { confirmed: result.confirmed, product: result.value }
}

async function confirmSubmitAfterUncertainResult(submissionToken) {
  submitConfirming.value = true
  try {
    const confirmed = await pollProductSubmissionResult(submissionToken)
    if (!isAuthSessionCurrent(editorSession)) return false
    if (confirmed.confirmed) {
      clearSubmissionTokenState()
      clearPersistedProductDraft()
      toast.success('物品提交成功，已自动确认结果')
      router.push('/seller/products')
      return true
    }

    toast.warning('暂未确认发布结果。可稍后再次点击发布，系统会防止重复创建。')
    return false
  } finally {
    submitConfirming.value = false
  }
}

// 提交表单
async function submitForm() {
  if (productSubmittingBusy.value || fulfillmentReminder.pending) return
  flushProductDraft()
  submitAttempted.value = true

  const nameResult = validateProductName(form.value.name)
  if (!nameResult.valid) {
    toast.error(nameResult.error)
    focusField('name')
    return
  }
  
  const descResult = validateProductDescription(form.value.description)
  if (!descResult.valid) {
    toast.error(descResult.error)
    focusField('description')
    return
  }
  
  if (!form.value.categoryId) {
    toast.error(categoriesLoadError.value || '请选择物品分类')
    return
  }
  
  const priceResult = validatePrice(form.value.price)
  if (!priceResult.valid) {
    toast.error(priceResult.error)
    focusField('price')
    return
  }
  
  if (discountError.value) {
    toast.error(discountError.value)
    focusField('discount')
    return
  }
  
  if (form.value.productType === 'normal' || form.value.productType === 'cdk') {
    if (merchantConfigError.value || !merchantStatusLoaded.value) {
      toast.error(merchantConfigError.value || '正在检查收款配置，请稍后重试')
      return
    }
    if (!merchantConfigured.value) {
      toast.warning('请先启用 LDC 收款配置并完成认证')
      goToPaymentSettings()
      return
    }
  }

  if (form.value.productType === 'normal') {
    if (stockError.value) {
      toast.error(stockError.value)
      focusField('stock')
      return
    }
  } else if (form.value.productType === 'cdk') {
    if (cdkCodesError.value) {
      toast.error(cdkCodesError.value)
      focusField('cdkCodes')
      return
    }
  }
  if (maxPurchaseQuantityError.value) {
    toast.error(maxPurchaseQuantityError.value)
    focusField('maxPurchaseQuantity')
    return
  }
  if (purchaseLimitPeriodDaysError.value) {
    toast.error(purchaseLimitPeriodDaysError.value)
    focusField('maxPurchaseQuantity')
    return
  }
  
  // 验证图片URL（必填）
  const imageUrl = form.value.imageUrl?.trim() || ''
  if (!imageUrl) {
    toast.error('请上传物品图片')
    focusField('image')
    return
  }
  if (imageUrlError.value) {
    toast.error(imageUrlError.value)
    focusField('image')
    return
  }
  
  // 验证结果必须属于当前 URL；复用失焦时已经启动的同一验证请求
  let imageValidationToastId = null
  if (!imageValidated.value || lastValidatedUrl.value !== imageUrl) {
    imageValidationToastId = toast.loading('正在验证图片...')
    await validateImageLoad()
    if (!isAuthSessionCurrent(editorSession)) { if (imageValidationToastId) toast.close(imageValidationToastId); return }
  }
  
  if (imageLoadError.value || !imageValidated.value || lastValidatedUrl.value !== imageUrl) {
    const message = imageLoadError.value || '图片验证未完成，请重试'
    if (imageValidationToastId) {
      toast.update(imageValidationToastId, { type: 'error', message })
    } else {
      toast.error(message)
    }
    focusField('image')
    return
  }
  if (imageValidationToastId) toast.close(imageValidationToastId)
  
  if (ruzhanPriceError.value) {
    toast.error(ruzhanPriceError.value)
    focusField('price')
    return
  }
  
  if (form.value.productType === 'normal') {
    const snapshot = JSON.stringify(form.value)
    const confirmationCount = fulfillmentReminder.confirmationCount
    if (!await fulfillmentReminder.request({ refresh: true }) || !isAuthSessionCurrent(editorSession)) return
    // A dialog confirms the rules only. Publishing always needs a separate click.
    if (confirmationCount !== fulfillmentReminder.confirmationCount || snapshot !== JSON.stringify(form.value)) return
  }

  submitting.value = true
  
  try {
    const productData = buildProductCreatePayload(form.value)

    const submissionToken = resolveSubmissionToken(productData)
    productData.submissionToken = submissionToken
    
    if (!isAuthSessionCurrent(editorSession)) return
    // 创建物品
    const result = await inventoryStore.createProduct(productData, { timeout: PRODUCT_SUBMIT_TIMEOUT_MS })
    
    if (!isAuthSessionCurrent(editorSession)) return
    if (!result.success) {
      if (isUncertainMutationResult(result)) {
        await confirmSubmitAfterUncertainResult(submissionToken)
        return
      }
      clearSubmissionTokenState()
      if (form.value.productType === 'normal' && ['FULFILLMENT_RULE_NOT_ACCEPTED', 'POLICY_VERSION_MISMATCH'].includes(result.errorCode)) {
        fulfillmentReminder.reset()
        submitting.value = false
        await fulfillmentReminder.request({ force: true })
        return
      }
      toast.error(result.error || '发布失败')
      return
    }
    
    clearSubmissionTokenState()
    clearPersistedProductDraft()

    // 显示成功提示
    const cdkInfo = result.data?.cdkImported ? `，已导入 ${result.data.cdkImported} 条 CDK` : ''
    if (result.data?.deduplicated) {
      toast.success('已确认该物品已提交，请勿重复发布')
    } else {
      toast.success(`物品提交成功，等待管理员审核${cdkInfo}`)
    }
    router.push('/seller/products')
  } catch (error) {
    clearSubmissionTokenState()
    toast.error(error.message || '发布失败')
  } finally {
    submitting.value = false
  }
}

watch(
  form,
  () => {
    markDraftDirty()
  },
  { deep: true, flush: 'sync' }
)

watch(
  () => form.value.imageUrl,
  (currentUrl, previousUrl) => {
    if (String(currentUrl || '').trim() !== String(previousUrl || '').trim()) {
      resetImageValidation()
    }
  },
  { flush: 'sync' }
)

watch(
  () => form.value.categoryId,
  (categoryId) => {
    if (draftReady.value && categoryId && restoredCategoryNotice.value) {
      restoredCategoryNotice.value = ''
    }
  }
)

watch([showGuideModal, publishMode, publishInitialized, restoredNormalReminderPending, guideClosing], () => {
  if (!publishInitialized.value || showGuideModal.value || guideClosing.value || publishMode.value !== 'product' || !restoredNormalReminderPending.value) return
  restoredNormalReminderPending.value = false
  if (form.value.productType === 'normal') void fulfillmentReminder.request()
})

watch(
  () => form.value.productType,
  (type) => {
    if (type !== 'cdk') {
      form.value.sharedCdkEnabled = false
      form.value.sharedCdkCode = ''
      form.value.isTestMode = false
    }
  }
)

watch(() => `${userStore.currentUser?.site || 'linux.do'}:${userStore.currentUser?.id || ''}`, () => {
  restoredNormalReminderPending.value = form.value.productType === 'normal'
})

watch(
  publishMode,
  (currentMode, previousMode) => {
    if (previousMode === 'product' && currentMode !== 'product') flushProductDraft()
  }
)

onBeforeRouteLeave(async () => {
  if (flushProductDraft()) return true
  return dialog.confirm('自动保存失败，继续离开可能会丢失本次填写内容。', {
    title: '草稿尚未保存',
    danger: true
  })
})

onMounted(async () => {
  const queryType = String(route.query.type || '').toLowerCase()
  if (!props.lockedMode && (queryType === 'buy' || queryType === 'request')) {
    publishMode.value = 'buy'
  }

  // 检查是否需要显示引导弹窗
  const hasSeenGuide = localStorage.getItem(GUIDE_MODAL_KEY)
  if (!hasSeenGuide) {
    showGuideModal.value = true
  }

  restoreProductDraft()
  
  // 加载分类
  await loadCategories()
  
  // 检查商家配置（普通物品与 CDK 都需要）
  await checkMerchantConfig()

  await nextTick()
  draftReady.value = true
  if (hasRestoredDraft.value && form.value.imageUrl?.trim()) {
    void validateImageLoad()
  }

  publishInitialized.value = true
  window.addEventListener('pagehide', handleDraftPageHide)
  document.addEventListener('visibilitychange', handleDraftVisibilityChange)
})

onBeforeUnmount(() => {
  flushProductDraft()
  clearDraftSaveTimer()
  window.removeEventListener('pagehide', handleDraftPageHide)
  document.removeEventListener('visibilitychange', handleDraftVisibilityChange)
})
</script>

<style scoped>
.publish-page {
  min-height: 100vh;
  padding-bottom: 100px;
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

.publish-mode-switch {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.mode-btn {
  flex: 1;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.mode-btn.active {
  border-color: var(--color-success);
  background: var(--color-success-bg);
  color: var(--color-success);
}

.draft-panel {
  margin-bottom: 16px;
  overflow: hidden;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  box-shadow: var(--shadow-sm);
}

.draft-panel.has-error {
  border-color: var(--color-danger);
}

.draft-status-row {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 14px;
}

.draft-status-row > svg {
  flex: 0 0 auto;
  color: var(--color-success);
}

.draft-panel.has-error .draft-status-row > svg,
.draft-panel.has-error .draft-status-row p {
  color: var(--color-danger);
}

.draft-status-row p {
  flex: 1;
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.draft-text-button,
.draft-discard-button {
  min-height: 36px;
  padding: 7px 10px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.draft-text-button {
  color: var(--color-danger);
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger);
}

.draft-restore-notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 13px 14px;
  background: var(--color-warning-bg);
  border-top: 1px solid var(--border-light);
}

.draft-restore-notice > svg {
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--color-warning);
}

.draft-restore-copy {
  flex: 1;
  min-width: 0;
}

.draft-restore-copy strong {
  display: block;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.5;
}

.draft-restore-copy p {
  margin: 3px 0 0;
  color: var(--color-warning);
  font-size: 12px;
  line-height: 1.5;
}

.draft-discard-button {
  flex: 0 0 auto;
  color: var(--color-danger);
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger);
}

.draft-text-button:hover,
.draft-discard-button:hover {
  filter: brightness(0.98);
}

.draft-text-button:focus-visible,
.draft-discard-button:focus-visible,
.inline-payment-link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.inline-payment-link {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  margin: 0 2px;
  padding: 2px 3px;
  color: var(--color-primary);
  background: transparent;
  border: 0;
  border-radius: 4px;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

@media (max-width: 520px) {
  .draft-restore-notice {
    flex-wrap: wrap;
  }

  .draft-discard-button {
    width: 100%;
    min-height: 44px;
  }
}

/* 表单卡片 */
.form-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px;
}

/* 表单 */
.form-group {
  margin-bottom: 16px;
  position: relative;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.form-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.form-label-row .form-label {
  margin-bottom: 0;
}

.desc-mode-tabs {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--bg-secondary);
  border-radius: 10px;
}

.desc-mode-tab {
  border: none;
  background: none;
  padding: 4px 12px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.desc-mode-tab:hover {
  color: var(--color-success);
}

.desc-mode-tab.active {
  background: var(--color-success);
  color: var(--palette-hex-ffffff);
  font-weight: 600;
}

.form-label.required::after {
  content: '*';
  color: var(--color-danger);
  margin-left: 4px;
}

.optional-label {
  font-weight: 400;
  color: var(--text-tertiary);
  font-size: 12px;
}

.form-input {
  width: 100%;
  padding: 14px 16px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s, background-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: var(--color-success);
  background: var(--input-focus-bg);
}

.form-input::placeholder {
  color: var(--text-placeholder);
}

.form-textarea {
  width: 100%;
  padding: 14px 16px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  resize: vertical;
  min-height: 100px;
  transition: border-color 0.2s, background-color 0.2s;
  box-sizing: border-box;
}

.form-textarea:focus {
  border-color: var(--color-success);
  background: var(--input-focus-bg);
}

.form-textarea.code {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
}

.form-counter {
  position: absolute;
  right: 12px;
  bottom: -20px;
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
}

.form-hint {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 8px 0 0;
  line-height: 1.5;
}

.buy-safe-card .form-hint {
  margin-top: 6px;
}

.form-hint.loading-hint {
  color: var(--color-warning);
}

.form-hint.success-hint {
  color: var(--color-success);
}

.form-hint.selectable {
  user-select: text;
}

.form-hint a {
  color: var(--color-success);
  text-decoration: none;
}

.form-hint a:hover {
  text-decoration: underline;
}

/* 图片提示链接 */
.form-hint-with-link {
  margin-top: 8px;
}

.form-hint-with-link .form-hint {
  margin: 0 0 6px;
}

.image-bed-link {
  display: block;
  padding: 10px 12px;
  background: linear-gradient(135deg, var(--palette-rgba-90-140-90-0p08) 0%, var(--palette-rgba-122-154-122-0p12) 100%);
  border: 1px dashed var(--color-success);
  border-radius: 10px;
  font-size: 13px;
  color: var(--color-success);
  text-decoration: none;
  line-height: 1.5;
  word-break: break-word;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.image-bed-link:hover {
  background: var(--color-success-bg);
  border-style: solid;
  transform: translateX(2px);
}

.image-bed-link strong {
  font-weight: 700;
}

/* 图片预览 */
.image-preview {
  margin-top: 12px;
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
}

.image-preview img {
  display: block;
  width: 100%;
  max-height: 200px;
  object-fit: contain;
}

/* CDK 配置提醒框 */
.cdk-config-notice {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--color-warning-bg, var(--palette-rgba-245-158-11-0p1));
  border: 1px solid var(--color-warning, var(--palette-hex-f59e0b));
  border-radius: 12px;
}

.cdk-config-notice .notice-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 14px;
  color: var(--text-primary);
}

.cdk-config-notice .notice-icon {
  font-size: 18px;
}

.cdk-config-notice .notice-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 14px;
}

.cdk-config-notice .notice-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border-radius: 8px;
}

.cdk-config-notice .notice-item.highlight {
  background: var(--color-danger-bg, var(--palette-rgba-239-68-68-0p1));
  border: 1px solid var(--color-danger, var(--palette-hex-ef4444));
}

.cdk-config-notice .item-num {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-warning, var(--palette-hex-f59e0b));
  color: var(--palette-hex-ffffff);
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
}

.cdk-config-notice .notice-item.highlight .item-num {
  background: var(--color-danger, var(--palette-hex-ef4444));
}

.cdk-config-notice .item-text {
  flex: 1;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.cdk-config-notice .item-text strong {
  color: var(--text-primary);
}

.merchant-config-link {
  color: var(--palette-hex-007bff);
}

.cdk-config-notice .notice-url {
  display: block;
  margin-top: 6px;
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: var(--color-primary);
  word-break: break-all;
}

.cdk-config-notice .notice-footer {
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
  font-size: 13px;
  color: var(--text-secondary);
}

.cdk-config-notice .notice-footer a {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}

.cdk-config-notice .notice-footer a:hover {
  text-decoration: underline;
}

.cdk-note {
  margin-top: 16px;
  padding: 12px 14px;
  background: var(--color-success-bg);
  border: 1px solid var(--color-success);
  border-radius: 10px;
}

.cdk-note .note-text {
  margin: 0;
  font-size: 13px;
  color: var(--color-success);
  line-height: 1.5;
}

.input-error {
  border-color: var(--color-danger) !important;
  background-color: var(--input-error-bg, var(--palette-rgba-220-38-38-0p05));
}

.form-error {
  font-size: 13px;
  color: var(--color-danger);
  margin: 8px 0 0;
  line-height: 1.5;
}

/* 分类选择 */
.category-select {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.category-btn {
  padding: 10px 18px;
  background: var(--bg-secondary);
  border: 2px solid transparent;
  border-radius: 24px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.category-btn:hover {
  background: var(--bg-tertiary);
}

.category-btn.active {
  background: var(--color-success-bg);
  border-color: var(--color-success);
  color: var(--color-success);
}

.category-load-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}

.category-load-error .form-error {
  margin: 0;
}

.category-retry-btn {
  flex: 0 0 auto;
  min-height: 44px;
  padding: 7px 12px;
  border: 1px solid var(--color-danger);
  border-radius: 9px;
  background: transparent;
  color: var(--color-danger);
  font: inherit;
  cursor: pointer;
}

.category-retry-btn:hover {
  background: var(--input-error-bg, var(--palette-rgba-220-38-38-0p05));
}

/* 入站分类价格提示 */
.category-price-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 14px;
  background: var(--color-warning-bg, var(--palette-rgba-245-158-11-0p1));
  border: 1px solid var(--color-warning, var(--palette-hex-f59e0b));
  border-radius: 10px;
}

.category-price-notice .notice-icon {
  flex-shrink: 0;
  font-size: 16px;
}

.category-price-notice .notice-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.category-price-notice .notice-text strong {
  color: var(--color-warning, var(--palette-hex-f59e0b));
  font-weight: 600;
}

/* 入站分类折后价格显示 */
.final-price-display {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-radius: 10px;
}

.final-price-display .price-label {
  font-size: 13px;
  color: var(--text-tertiary);
}

.final-price-display .price-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-success);
}

.final-price-display .price-value.price-error {
  color: var(--color-danger);
}

.final-price-display .price-warning {
  font-size: 12px;
  color: var(--color-danger);
}

/* 类型选择 */
.type-select {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.type-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 2px solid transparent;
  border-radius: 14px;
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.type-card:hover {
  background: var(--bg-tertiary);
}

.type-card.active {
  background: var(--action-paper-accent-soft);
  border-color: var(--action-paper-accent-strong);
}

.type-icon {
  font-size: 28px;
}

.type-info {
  flex: 1;
}

.type-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px;
}

.type-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
}

/* 提交按钮 */
.form-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16px;
  background: var(--bg-card);
  border-top: 1px solid var(--border-light);
  z-index: 100;
}

.submit-btn {
  display: block;
  width: 100%;
  max-width: 568px;
  margin: 0 auto;
  padding: 16px 32px;
  background: linear-gradient(135deg, var(--color-success) 0%, var(--palette-hex-7a9a7a) 100%);
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  color: var(--palette-hex-ffffff);
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px var(--palette-rgba-90-140-90-0p4);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 提交遮罩 */
.submit-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--overlay-bg, var(--palette-rgba-24-28-34-0p45));
  backdrop-filter: blur(2px);
}

.submit-mask-card {
  width: min(90vw, 360px);
  padding: 24px 20px;
  border-radius: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-lg);
  text-align: center;
}

.submit-mask-spinner {
  display: block;
  width: 44px;
  height: 44px;
  margin: 0 auto 14px;
  border-radius: 50%;
  border: 3px solid var(--palette-rgba-126-179-126-0p25);
  border-top-color: var(--color-success);
  animation: submit-mask-spin 0.8s linear infinite;
}

.submit-mask-title {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.submit-mask-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.submit-mask-enter-active,
.submit-mask-leave-active {
  transition: opacity 0.2s ease;
}

.submit-mask-enter-active .submit-mask-card,
.submit-mask-leave-active .submit-mask-card {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.submit-mask-enter-from,
.submit-mask-leave-to {
  opacity: 0;
}

.submit-mask-enter-from .submit-mask-card,
.submit-mask-leave-to .submit-mask-card {
  transform: translateY(6px) scale(0.98);
  opacity: 0;
}

@keyframes submit-mask-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 引导弹窗 */
.guide-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.guide-modal {
  background: var(--bg-card);
  border-radius: 20px;
  max-width: 400px;
  width: 100%;
  padding: 28px 24px 20px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-light);
}

.guide-modal-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
}

.guide-modal-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-success-bg);
  border-radius: 16px;
  margin-bottom: 16px;
}

.guide-modal-icon svg {
  width: 28px;
  height: 28px;
  color: var(--color-success);
}

.guide-modal-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.guide-modal-body {
  margin-bottom: 24px;
}

.guide-modal-text {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
  margin: 0;
  text-align: center;
}

.guide-modal-warning {
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-danger);
  margin: 12px 0 0;
  padding: 10px 12px;
  background: var(--palette-rgba-220-38-38-0p08);
  border-radius: 8px;
  text-align: center;
}

.guide-modal-warning strong {
  font-weight: 600;
}

.guide-modal-text strong {
  color: var(--color-success);
}

.guide-modal-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.guide-btn {
  display: block;
  width: 100%;
  padding: 14px 20px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
  border: none;
}

.guide-btn-primary {
  background: linear-gradient(135deg, var(--color-success) 0%, var(--palette-hex-7a9a7a) 100%);
  color: var(--palette-hex-ffffff);
}

.guide-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px var(--palette-rgba-90-140-90-0p4);
}

.guide-btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.guide-btn-secondary:hover {
  background: var(--bg-tertiary);
}

.guide-modal-remember {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
  cursor: pointer;
  user-select: none;
}

.guide-modal-remember input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-success);
}

.guide-modal-remember span {
  font-size: 13px;
  color: var(--text-tertiary);
}

/* 弹窗动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .guide-modal,
.modal-leave-active .guide-modal {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .guide-modal,
.modal-leave-to .guide-modal {
  transform: scale(0.9);
  opacity: 0;
}

/* 测试模式开关 */
.test-mode-group {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px dashed var(--border-light);
}

.toggle-switch {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.toggle-track {
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--bg-tertiary);
  border-radius: 12px;
  transition: background 0.2s;
}

.toggle-track.active {
  background: var(--color-info);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: var(--palette-hex-ffffff);
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 2px 4px var(--palette-rgba-0-0-0-0p1);
}

.toggle-track.active .toggle-thumb {
  transform: translateX(20px);
}

.toggle-label {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.toggle-help {
  font-size: 12px;
  color: var(--color-info);
  font-weight: 400;
}

.limit-toggle {
  margin-bottom: 8px;
}

.limit-input-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.limit-input-row .form-input {
  flex: 1;
}

.limit-unit {
  font-size: 13px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.test-mode-hint {
  margin-top: 8px !important;
  padding-left: 56px;
}

/* 测试模式弹窗 */
.test-mode-modal {
  max-width: 420px;
  max-height: calc(100vh - 40px);
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
}

.test-icon {
  background: var(--color-info-bg) !important;
}

.test-icon svg {
  color: var(--color-info);
}

.test-mode-tips {
  margin: 16px 0;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
  list-style: none;
}

.tip-item {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  padding: 4px 0;
  line-height: 1.6;
  text-align: left;
  overflow-wrap: anywhere;
}

.tip-item svg {
  margin-top: 2px;
  color: var(--color-success);
}

.tip-item.warning {
  color: var(--color-warning);
  font-weight: 600;
}

.tip-item.warning svg {
  color: currentColor;
}

.test-mode-link {
  color: var(--color-info);
  font-weight: 600;
  text-underline-offset: 2px;
}

.test-warning {
  background: var(--color-warning-bg) !important;
  color: var(--color-warning) !important;
  border: 1px solid var(--color-warning);
  margin-top: 12px !important;
}

.test-mode-auto-offline-note {
  margin-top: 8px;
  margin-left: 56px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-warning);
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
}

.type-heading { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px 16px; margin-bottom:18px; }
.seller-product-form .type-heading .card-title { margin:0; }
.type-heading a,.rule-text-link { display:inline-flex; align-items:center; gap:4px; min-height:44px; border:0; padding:0; background:transparent; color:var(--action-paper-accent-strong); font:inherit; font-size:13px; text-decoration:underline; text-underline-offset:3px; cursor:pointer; }
.product-type-section .type-select { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.type-card { position:relative; min-width:0; min-height:88px; font:inherit; text-align:left; color:var(--text-primary); }
.type-card:disabled { cursor:wait; }
.type-card:focus-visible { outline:3px solid var(--action-paper-accent-strong); outline-offset:3px; }
.type-card .type-icon { flex-shrink:0; margin:0; color:var(--action-paper-accent-strong); }
.type-info { display:grid; gap:6px; min-width:0; padding-right:24px; }
.type-info .type-name,.type-info .type-desc { display:block; margin:0; }
.type-info .type-desc { color:var(--text-secondary); }
.type-selected-icon { position:absolute; right:12px; top:14px; color:var(--action-paper-accent-strong); }
@media(max-width:640px) { .product-type-section .type-select { grid-template-columns:minmax(0,1fr); } }
</style>
