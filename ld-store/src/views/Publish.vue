<template>
  <div class="publish-page">
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
      <Transition name="modal">
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
                ⚠️ <strong>禁止发布</strong>：违法违规、色情低俗、侵权盗版、虚假欺诈等内容，违者将被封禁处理。
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
          <div class="guide-modal test-mode-modal">
            <div class="guide-modal-header">
              <div class="guide-modal-icon test-icon">
                🧪
              </div>
              <h3 class="guide-modal-title">开启测试模式</h3>
            </div>
            <div class="guide-modal-body">
              <p class="guide-modal-text">
                测试模式下，<strong>只有您自己可以购买此物品</strong>，其他用户将无法购买。
              </p>
              <div class="test-mode-tips">
                <p class="tip-item">✅ 用于测试 LDC 支付回调通知是否正常</p>
                <p class="tip-item">✅ 购买后会正常扣款和发放 CDK</p>
                <p class="tip-item">✅ 测试完成后请及时下架或删除测试物品</p>
                <p class="tip-item">✅ 测试完成请务必在 <a href="https://credit.linux.do/merchant" target="_blank" style="color: #007bff;">LDC集市</a> 中关闭应用的测试模式</p>
                <p class="tip-item warning">⏱️ 测试模式商品上架 30 分钟后会自动下架</p>
              </div>
              <p class="guide-modal-warning test-warning">
                ⚠️ <strong>请确保已在 LDC 应用中开启测试模式</strong>，否则可能无法收到回调通知。
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
      <div class="page-header">
        <h1 class="page-title">{{ publishMode === 'product' ? '发布物品' : '发布求购' }}</h1>
      </div>
      
      <div class="publish-mode-switch">
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

      <form v-if="publishMode === 'product'" class="publish-form" @submit.prevent="submitForm">
        <!-- 基本信息 -->
        <div class="form-card">
          <h3 class="card-title">基本信息</h3>
          
          <div class="form-group">
            <label class="form-label required">物品名称</label>
            <input
              v-model="form.name"
              type="text"
              class="form-input"
              :class="{ 'input-error': showError('name', nameError) }"
              placeholder="请输入物品名称（2-50字符）"
              maxlength="50"
              ref="nameInput"
              @input="markTouched('name')"
            />
            <p class="form-counter">{{ form.name.length }}/50</p>
            <p v-if="showError('name', nameError)" class="form-error">{{ nameError }}</p>
          </div>
          
          <div class="form-group">
            <label class="form-label required">物品描述</label>
            <textarea
              v-model="form.description"
              class="form-textarea"
              :class="{ 'input-error': showError('description', descriptionError) }"
              :placeholder="descriptionPlaceholder"
              rows="4"
              maxlength="1000"
              ref="descriptionInput"
              @input="markTouched('description')"
            ></textarea>
            <p class="form-counter">{{ form.description.length }}/1000</p>
            <p v-if="showError('description', descriptionError)" class="form-error">{{ descriptionError }}</p>
          </div>
          
          <div class="form-group">
            <label class="form-label required">物品分类</label>
            <div class="category-select">
              <button
                v-for="cat in categories"
                :key="cat.id || cat.name"
                type="button"
                :class="['category-btn', { active: form.categoryId === cat.id }]"
                @click="form.categoryId = cat.id"
              >
                {{ cat.icon }} {{ cat.name }}
              </button>
            </div>
            <!-- 入站分类价格提示 -->
            <div v-if="isRuzhanCategory" class="category-price-notice">
              <span class="notice-icon">⚠️</span>
              <span class="notice-text">始皇指导价：入站分类物品<strong>折后价格不得低于 500 LDC</strong></span>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label required">价格 (LDC)</label>
              <input
                v-model="form.price"
                type="number"
                class="form-input"
                :class="{ 'input-error': showError('price', priceError) || ruzhanPriceError }"
                placeholder="0.00"
                min="0.01"
                max="99999999"
                step="0.01"
                ref="priceInput"
                @input="markTouched('price')"
              />
              <p v-if="showError('price', priceError)" class="form-error">{{ priceError }}</p>
              <p v-else-if="ruzhanPriceError" class="form-error">{{ ruzhanPriceError }}</p>
            </div>
            
            <div class="form-group">
              <label class="form-label">折扣</label>
              <input
                v-model="form.discount"
                type="number"
                class="form-input"
                :class="{ 'input-error': showError('discount', discountError) || ruzhanPriceError }"
                placeholder="1"
                min="0.01"
                max="1"
                step="0.01"
                ref="discountInput"
                @input="markTouched('discount')"
              />
              <p v-if="showError('discount', discountError)" class="form-error">{{ discountError }}</p>
              <p v-else class="form-hint">范围 0.01-1，0.8 表示8折，1 表示原价</p>
            </div>
          </div>
          <!-- 入站分类折后价格显示 -->
          <div v-if="isRuzhanCategory && finalPrice > 0" class="final-price-display">
            <span class="price-label">折后价格：</span>
            <span class="price-value" :class="{ 'price-error': finalPrice < 500 }">
              {{ finalPrice.toFixed(2) }} LDC
            </span>
            <span v-if="finalPrice < 500" class="price-warning">（最低 500 LDC）</span>
          </div>
          
          <div class="form-group">
            <label class="form-label required">物品图片</label>
            <input
              v-model="form.imageUrl"
              type="url"
              class="form-input"
              :class="{ 'input-error': showError('image', imageDisplayError) }"
              placeholder="https://..."
              @blur="validateImageLoad"
              ref="imageInput"
              @input="markTouched('image')"
            />
            <p v-if="showError('image', imageDisplayError)" class="form-error">{{ imageDisplayError }}</p>
            <p v-else-if="imageLoadError" class="form-error">{{ imageLoadError }}</p>
            <p v-else-if="imageValidating" class="form-hint loading-hint">⚙️ 正在验证图片...</p>
            <p v-else-if="imageValidated" class="form-hint success-hint">✅ 图片验证通过</p>
            <div v-else class="form-hint-with-link">
              <p class="form-hint">推荐尺寸 16:9，必须使用 HTTPS 链接，不支持 linux.do 图床</p>
              <router-link to="/ld-image" target="_blank" class="image-bed-link">
                🖼️ 没有图床？试试 <strong>士多图床</strong>🎉即刻上传图片🔗获取在线链接
              </router-link>
            </div>
            
            <!-- 图片预览 -->
            <div v-if="imagePreviewUrl && !imageLoadError" class="image-preview">
              <img :src="imagePreviewUrl" alt="图片预览" @error="onPreviewError" />
            </div>
          </div>
        </div>
        
        <!-- 物品类型 -->
        <div class="form-card">
          <h3 class="card-title">物品类型</h3>
          
          <div class="type-select">
            <div
              v-for="type in productTypes"
              :key="type.id"
              :class="['type-card', { active: form.productType === type.id }]"
              @click="form.productType = type.id"
            >
              <div class="type-icon">{{ type.icon }}</div>
              <div class="type-info">
                <h4 class="type-name">{{ type.name }}</h4>
                <p class="type-desc">{{ type.desc }}</p>
              </div>
              <div class="type-check" v-if="form.productType === type.id">✓</div>
            </div>
          </div>
        </div>
        
        <!-- 普通物品设置 -->
        <div class="form-card" v-if="form.productType === 'normal'">
          <h3 class="card-title">普通物品设置</h3>

          <div class="cdk-config-notice">
            <div class="notice-header">
              <span class="notice-icon">📦</span>
              <strong>普通物品会在平台内支付并保留订单记录，卖家需人工履约。</strong>
            </div>
            <div class="notice-content">
              <div class="notice-item">
                <span class="item-num">1</span>
                <div class="item-text">
                  <strong>请先在<a href="/user/settings" target="_blank" style="color: #007bff;"> LD士多 </a>配置 LDC 收款信息</strong>，否则买家无法完成平台内支付。
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
          <h3 class="card-title">兑换门槛</h3>

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
        </div>
        
        <!-- CDK 类型设置 -->
        <div class="form-card" v-if="form.productType === 'cdk'">
          <h3 class="card-title">CDK 设置</h3>
          
          <!-- LDC 配置提醒 -->
          <div class="cdk-config-notice">
            <div class="notice-header">
              <span class="notice-icon">⚠️</span>
              <strong>发布 CDK 物品前，请确保已完成以下配置：</strong>
            </div>
            <div class="notice-content">
              <div class="notice-item">
                <span class="item-num">1</span>
                <div class="item-text">
                  <strong>在<a href="/user/settings" target="_blank" style="color: #007bff;"> LD士多 </a>配置 LDC 收款信息</strong>：在「收款设置」中填写 Client ID 和 Client Key
                </div>
              </div>
              <div class="notice-item highlight">
                <span class="item-num">2</span>
                <div class="item-text">
                  <strong>在<a href="https://credit.linux.do/merchant" target="_blank" style="color: #007bff;"> LDC集市 </a>配置通知地址（最重要⚠️）</strong>：这是支付成功后自动发货的关键！
                  <code class="notice-url">https://api.ldspro.qzz.io/api/shop/ldc/notify</code>
                </div>
              </div>
              <div class="notice-item">
                <span class="item-num">3</span>
                <div class="item-text">
                  <strong>在<a href="https://credit.linux.do/merchant" target="_blank" style="color: #007bff;"> LDC集市 </a>配置回调地址</strong>：支付完成后浏览器跳转地址
                  <code class="notice-url">https://api.ldspro.qzz.io/api/shop/ldc/return</code>
                </div>
              </div>
            </div>
            <div class="notice-footer">
              📖 <a href="https://ldstore.cc.cd/docs/publish-cdk" target="_blank" rel="noopener">查看详细配置教程</a>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label required">CDK 卡密</label>
            <textarea
              v-model="form.cdkCodes"
              class="form-textarea code"
              :class="{ 'input-error': showError('cdkCodes', cdkCodesError) }"
              placeholder="每行一个 CDK，支持批量添加，会自动去重&#10;物品发布后也可在「我的物品」中管理 CDK 库存"
              rows="5"
              ref="cdkCodesInput"
              @input="markTouched('cdkCodes')"
            ></textarea>
            <p v-if="showError('cdkCodes', cdkCodesError)" class="form-error">{{ cdkCodesError }}</p>
            <p v-else class="form-hint">
              <span v-if="cdkCount > 0">已输入 {{ cdkCount }} 个 CDK</span>
              <span v-else>至少填写 1 个 CDK 卡密</span>
            </p>
          </div>

          <div class="form-group">
            <label class="toggle-switch limit-toggle" @click.prevent="form.limitEnabled = !form.limitEnabled">
              <span class="toggle-track" :class="{ active: form.limitEnabled }">
                <span class="toggle-thumb"></span>
              </span>
              <span class="toggle-label">
                设置单人单次购买上限
                <span class="toggle-help" v-if="!form.limitEnabled">（默认不限制）</span>
              </span>
            </label>
            <p class="form-hint">开启后，每位用户单次下单最多只能购买您设置的数量。</p>

            <div v-if="form.limitEnabled" class="limit-input-row">
              <input
                v-model="form.maxPurchaseQuantity"
                ref="maxPurchaseQuantityInput"
                type="number"
                class="form-input"
                :class="{ 'input-error': !!maxPurchaseQuantityError }"
                min="1"
                max="1000"
                step="1"
                placeholder="例如：5"
              />
              <span class="limit-unit">个 / 单</span>
            </div>
            <p v-if="maxPurchaseQuantityError" class="form-error">{{ maxPurchaseQuantityError }}</p>
          </div>
          
          <!-- 测试模式开关 -->
          <div class="form-group test-mode-group">
            <label class="toggle-switch" @click.prevent="toggleTestMode">
              <span class="toggle-track" :class="{ active: form.isTestMode }">
                <span class="toggle-thumb"></span>
              </span>
              <span class="toggle-label">
                🧪 测试模式
                <span class="toggle-help" v-if="form.isTestMode">（仅自己可购买）</span>
              </span>
            </label>
            <p class="form-hint test-mode-hint">
              开启后仅您自己可以购买此物品，用于测试 LDC 通知回调是否正常工作。
            </p>
            <p v-if="form.isTestMode" class="test-mode-auto-offline-note">
              ⚠️ 测试模式商品审核通过并上架后，30 分钟会自动下架；如需继续售卖，请关闭测试模式后重新上架。
            </p>
          </div>
          
          <div class="cdk-note">
            <p class="note-text">📝 CDK 使用说明请写在上方「物品描述」中，买家购买后可在订单详情中查看。</p>
          </div>
        </div>
        
        <!-- 提交按钮 -->
        <div class="form-actions">
          <button type="submit" class="submit-btn" :disabled="!canSubmit || productSubmittingBusy">
            {{ submitButtonText }}
          </button>
        </div>
      </form>

      <form v-else class="publish-form" @submit.prevent="submitBuyRequest">
        <div class="form-card">
          <h3 class="card-title">求购信息</h3>

          <div class="form-group">
            <label class="form-label required">求购标题</label>
            <input
              v-model="buyForm.title"
              type="text"
              class="form-input"
              :class="{ 'input-error': showBuyError('title', buyTitleError) }"
              placeholder="例如：收一个月 Claude 会员"
              maxlength="60"
              ref="buyTitleInput"
              @input="markBuyTouched('title')"
            />
            <p class="form-counter">{{ buyForm.title.length }}/60</p>
            <p v-if="showBuyError('title', buyTitleError)" class="form-error">{{ buyTitleError }}</p>
          </div>

          <div class="form-group">
            <label class="form-label required">详细需求</label>
            <textarea
              v-model="buyForm.details"
              class="form-textarea"
              :class="{ 'input-error': showBuyError('details', buyDetailsError) }"
              placeholder="请写清楚具体需求、交付方式、时效要求等（10-2000 字）"
              rows="6"
              maxlength="2000"
              ref="buyDetailsInput"
              @input="markBuyTouched('details')"
            ></textarea>
            <p class="form-counter">{{ buyForm.details.length }}/2000</p>
            <p v-if="showBuyError('details', buyDetailsError)" class="form-error">{{ buyDetailsError }}</p>
          </div>

          <div class="form-group">
            <label class="form-label required">预算价格 (LDC)</label>
            <input
              v-model="buyForm.price"
              type="number"
              class="form-input"
              :class="{ 'input-error': showBuyError('price', buyPriceError) }"
              placeholder="0.00"
              min="0.01"
              max="99999999"
              step="0.01"
              ref="buyPriceInput"
              @input="markBuyTouched('price')"
            />
            <p v-if="showBuyError('price', buyPriceError)" class="form-error">{{ buyPriceError }}</p>
            <p class="form-hint">发布后可在会话中继续协商，并可随时调价。</p>
          </div>
        </div>

        <div class="form-card buy-safe-card">
          <h3 class="card-title">安全说明</h3>
          <p class="form-hint">平台会展示随机用户名与密码进行沟通，真实信息默认不公开。</p>
          <p class="form-hint">聊天内容会自动检测违禁词，命中后无法发送。</p>
        </div>

        <div class="form-actions">
          <button type="submit" class="submit-btn" :disabled="!canSubmitBuy || buySubmitting">
            {{ buySubmitting ? '发布中...' : '发布求购' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { useToast } from '@/composables/useToast'
import { validateProductName, validateProductDescription, validatePrice } from '@/utils/security'
import { api } from '@/utils/api'

const router = useRouter()
const route = useRoute()
const shopStore = useShopStore()
const toast = useToast()

const submitting = ref(false)
const submitConfirming = ref(false)
const merchantConfigured = ref(false) // 是否已配置商家收款
const showGuideModal = ref(false)
const dontShowAgain = ref(false)
const publishMode = ref('product')
const buySubmitting = ref(false)
const buySubmitAttempted = ref(false)

const buyForm = ref({
  title: '',
  details: '',
  price: ''
})

const buyTouched = ref({
  title: false,
  details: false,
  price: false
})

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

const nameInput = ref(null)
const descriptionInput = ref(null)
const priceInput = ref(null)
const discountInput = ref(null)
const imageInput = ref(null)
const stockInput = ref(null)
const cdkCodesInput = ref(null)
const maxPurchaseQuantityInput = ref(null)
const buyTitleInput = ref(null)
const buyDetailsInput = ref(null)
const buyPriceInput = ref(null)

const fieldRefs = {
  name: nameInput,
  description: descriptionInput,
  price: priceInput,
  discount: discountInput,
  image: imageInput,
  stock: stockInput,
  cdkCodes: cdkCodesInput,
  maxPurchaseQuantity: maxPurchaseQuantityInput
}

const buyFieldRefs = {
  title: buyTitleInput,
  details: buyDetailsInput,
  price: buyPriceInput
}

function markTouched(field) {
  if (field in touched.value) {
    touched.value[field] = true
  }
}

function markBuyTouched(field) {
  if (field in buyTouched.value) {
    buyTouched.value[field] = true
  }
}

function focusField(field) {
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

function focusBuyField(field) {
  const elRef = buyFieldRefs[field]
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
  showGuideModal.value = false
  if (dontShowAgain.value) {
    localStorage.setItem(GUIDE_MODAL_KEY, 'true')
  }
}

// 表单数据
const form = ref({
  name: '',
  description: '',
  categoryId: null,
  price: '',
  discount: 1,
  imageUrl: '',
  productType: 'normal',
  stock: '',
  purchaseTrustLevel: 0,
  cdkCodes: '',
  isTestMode: false,   // 测试模式（仅 CDK 类型可用）
  limitEnabled: false,
  maxPurchaseQuantity: ''
})

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

// 分类 - 从API获取或使用默认
const categories = ref([
  { id: 1, name: 'AI', icon: '🤖' },
  { id: 2, name: '存储', icon: '💾' },
  { id: 3, name: '小鸡', icon: '🐔' },
  { id: 4, name: '咨询', icon: '💬' }
])

// 加载分类
async function loadCategories() {
  try {
    const result = await shopStore.fetchCategories()
    if (result && result.length > 0) {
      // 过滤掉小店分类（小店入驻使用独立的小店集市）
      categories.value = result
        .filter(cat => cat.name !== '小店' && cat.name !== '友情小店')
        .map(cat => ({
          id: cat.id,
          name: cat.name,
          icon: cat.icon || '📦'
        }))
      // 设置默认分类
      if (categories.value.length > 0 && !form.value.categoryId) {
        form.value.categoryId = categories.value[0].id
      }
    }
  } catch (error) {
    // 使用默认分类
    if (categories.value.length > 0 && !form.value.categoryId) {
      form.value.categoryId = categories.value[0].id
    }
  }
}

// 物品类型
const productTypes = [
  { id: 'normal', name: '普通物品', desc: '平台内支付、记录订单、卖家手动履约', icon: '📦' },
  { id: 'cdk', name: '自动发卡', desc: '平台内支付+自动发放 CDK', icon: '🎫' }
]
const purchaseTrustLevelOptions = [0, 1, 2, 3, 4]

// CDK 数量
const cdkCount = computed(() => {
  if (!form.value.cdkCodes.trim()) return 0
  return form.value.cdkCodes.split('\n').filter(line => line.trim()).length
})

// 入站分类价格限制
const isRuzhanCategory = computed(() => {
  const selectedCategory = categories.value.find(cat => cat.id === form.value.categoryId)
  return selectedCategory?.name === '入站'
})

// 折后价格
const finalPrice = computed(() => {
  const price = parseFloat(form.value.price) || 0
  const discount = parseFloat(form.value.discount) || 1
  return price * discount
})

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
  if (submitting.value && form.value.productType === 'cdk' && form.value.cdkCodes.trim()) {
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
    return form.value.productType === 'cdk' && form.value.cdkCodes.trim() 
      ? '发布并上传CDK...' 
      : '提交中...'
  }
  return form.value.productType === 'cdk' ? '发布并上传CDK' : '发布物品'
})

// 允许的图片后缀
const VALID_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']

// 图片加载验证状态
const imageValidating = ref(false)
const imageValidated = ref(false)
const imageLoadError = ref('')
const imagePreviewUrl = ref('')
let lastValidatedUrl = ''

// 检查URL是否为有效图片链接（后缀检查）
function isValidImageUrl(url) {
  if (!url) return false
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname.toLowerCase()
    // 检查路径是否以图片后缀结尾（忽略查询参数）
    return VALID_IMAGE_EXTENSIONS.some(ext => pathname.endsWith('.' + ext))
  } catch {
    return false
  }
}

// 图片预加载验证
function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    // 设置超时
    const timeout = setTimeout(() => {
      img.src = ''
      reject(new Error('图片加载超时'))
    }, 10000) // 10秒超时
    img.onload = () => {
      clearTimeout(timeout)
      resolve(img)
    }
    img.src = url
  })
}

// 验证图片是否可加载
async function validateImageLoad() {
  const url = form.value.imageUrl?.trim()
  
  // 清空或格式错误时重置状态
  if (!url || imageUrlError.value) {
    imageValidating.value = false
    imageValidated.value = false
    imageLoadError.value = ''
    imagePreviewUrl.value = ''
    lastValidatedUrl = ''
    return
  }
  
  // 如果 URL 没变，不重复验证
  if (url === lastValidatedUrl) return
  
  imageValidating.value = true
  imageValidated.value = false
  imageLoadError.value = ''
  imagePreviewUrl.value = ''
  
  try {
    await preloadImage(url)
    // 再次检查 URL 是否变化（防止异步竞态）
    if (form.value.imageUrl?.trim() !== url) return
    
    imageValidated.value = true
    imagePreviewUrl.value = url
    lastValidatedUrl = url
  } catch (error) {
    if (form.value.imageUrl?.trim() !== url) return
    imageLoadError.value = `图片无法加载，请检查链接是否有效`
    lastValidatedUrl = ''
  } finally {
    imageValidating.value = false
  }
}

// 预览图片加载失败
function onPreviewError() {
  imageLoadError.value = '图片加载失败，请检查链接是否有效'
  imagePreviewUrl.value = ''
  imageValidated.value = false
}

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
  if (form.value.productType !== 'cdk' || !form.value.limitEnabled) return ''
  const raw = String(form.value.maxPurchaseQuantity ?? '').trim()
  if (!raw) return '请输入单人单次购买上限'
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) return '单人单次购买上限必须是大于 0 的整数'
  if (value > 1000) return '单人单次购买上限不能超过 1000'
  return ''
})

const cdkCodesError = computed(() => {
  if (form.value.productType !== 'cdk') return ''
  return cdkCount.value > 0 ? '' : '请至少填写 1 个 CDK 卡密'
})
const buyTitleError = computed(() => {
  const value = buyForm.value.title?.trim() || ''
  if (!value) return '请输入求购标题'
  if (value.length < 2 || value.length > 60) return '标题需要 2-60 个字符'
  return ''
})

const buyDetailsError = computed(() => {
  const value = buyForm.value.details?.trim() || ''
  if (!value) return '请输入详细需求'
  if (value.length < 10 || value.length > 2000) return '详细需求需要 10-2000 个字符'
  return ''
})

const buyPriceError = computed(() => {
  const result = validatePrice(buyForm.value.price)
  return result.valid ? '' : result.error
})

const canSubmitBuy = computed(() => {
  return !buyTitleError.value && !buyDetailsError.value && !buyPriceError.value
})

function showBuyError(field, err) {
  return !!err && (buyTouched.value[field] || buySubmitAttempted.value)
}

function showError(field, err) {
  return !!err && (touched.value[field] || submitAttempted.value)
}

const imageUrlError = computed(() => {
  const url = form.value.imageUrl?.trim()
  if (!url) return null  // 空值不显示错误，提交时再验证
  if (!url.startsWith('https://')) return '图片链接必须使用 HTTPS'
  if (url.includes('linux.do')) return '不支持使用 linux.do 图床，请使用其他图床服务'
  if (!isValidImageUrl(url)) return '图片链接格式无效，支持: jpg, png, gif, webp, svg 等'
  return null
})

const imageDisplayError = computed(() => {
  const url = form.value.imageUrl?.trim()
  if (!url) return submitAttempted.value ? '请填写物品图片链接' : ''
  if (imageLoadError.value) return imageLoadError.value
  return imageUrlError.value || ''
})

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
  return true
})

// 检查商家配置
async function checkMerchantConfig() {
  try {
    const result = await shopStore.fetchMerchantConfig()
    const config = result?.data?.data || result?.data || result || {}
    merchantConfigured.value = !!config.configured
  } catch (error) {
    merchantConfigured.value = false
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function generateSubmissionToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `pub_${crypto.randomUUID().replace(/-/g, '')}`
  }
  return `pub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`
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
    maxPurchaseQuantity: Number(productData.maxPurchaseQuantity || 0),
    cdkCodes: productData.cdkCodes || '',
    isTestMode: !!productData.isTestMode
  })
}

function resolveSubmissionToken(productData) {
  const fingerprint = buildProductFingerprint(productData)
  if (!submitTokenState.value.token || submitTokenState.value.fingerprint !== fingerprint) {
    submitTokenState.value = {
      token: generateSubmissionToken(),
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

function isUncertainSubmitResult(result) {
  const status = Number(result?.status || 0)
  const message = String(result?.error || '').toLowerCase()
  if (status === 0) return true
  return message.includes('超时')
    || message.includes('网络')
    || message.includes('failed to fetch')
    || message.includes('network')
    || message.includes('abort')
}

async function pollProductSubmissionResult(submissionToken) {
  for (let i = 0; i < PRODUCT_SUBMIT_STATUS_MAX_RETRIES; i += 1) {
    const statusResult = await shopStore.getProductSubmissionStatus(submissionToken)
    if (statusResult?.success && statusResult.data?.exists && statusResult.data?.product?.id) {
      return { confirmed: true, product: statusResult.data.product }
    }
    if (i < PRODUCT_SUBMIT_STATUS_MAX_RETRIES - 1) {
      await wait(PRODUCT_SUBMIT_STATUS_RETRY_INTERVAL_MS)
    }
  }
  return { confirmed: false, product: null }
}

async function confirmSubmitAfterUncertainResult(submissionToken) {
  submitConfirming.value = true
  try {
    const confirmed = await pollProductSubmissionResult(submissionToken)
    if (confirmed.confirmed) {
      clearSubmissionTokenState()
      toast.success('物品提交成功，已自动确认结果')
      router.push('/user/products')
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
  if (productSubmittingBusy.value) return
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
    toast.error('请选择物品分类')
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
    if (!merchantConfigured.value) {
      toast.warning('请先在「收款设置」中配置 LDC 收款信息')
      router.push('/user/settings')
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
    if (maxPurchaseQuantityError.value) {
      toast.error(maxPurchaseQuantityError.value)
      focusField('maxPurchaseQuantity')
      return
    }
  }
  
  // 验证图片URL（必填）
  if (!form.value.imageUrl || !form.value.imageUrl.trim()) {
    toast.error('请上传物品图片')
    focusField('image')
    return
  }
  if (!form.value.imageUrl.startsWith('https://')) {
    toast.error('图片链接必须使用 HTTPS')
    focusField('image')
    return
  }
  if (form.value.imageUrl.includes('linux.do')) {
    toast.error('不支持使用 linux.do 图床，请使用其他图床服务')
    focusField('image')
    return
  }
  if (!isValidImageUrl(form.value.imageUrl)) {
    toast.error('图片链接格式无效，支持: jpg, png, gif, webp, svg 等')
    focusField('image')
    return
  }
  
  // 如果图片还未验证，先进行验证
  if (!imageValidated.value && !imageLoadError.value) {
    const loadingToastId = toast.loading('正在验证图片...')
    await validateImageLoad()
    toast.close(loadingToastId)
  }
  
  // 图片加载失败
  if (imageLoadError.value) {
    toast.error(imageLoadError.value)
    focusField('image')
    return
  }
  
  if (ruzhanPriceError.value) {
    toast.error(ruzhanPriceError.value)
    focusField('price')
    return
  }
  
  submitting.value = true
  
  try {
    // 构建物品数据（与客户端脚本保持一致）
    const productData = {
      name: form.value.name.trim(),
      categoryId: form.value.categoryId,
      description: form.value.description.trim(),
      price: parseFloat(form.value.price),
      discount: parseFloat(form.value.discount) || 1,
      imageUrl: form.value.imageUrl.trim() || undefined,
      productType: form.value.productType,
      purchaseTrustLevel: Number(form.value.purchaseTrustLevel) || 0
    }
    
    // 类型特定数据
    if (form.value.productType === 'normal') {
      productData.stock = Number(form.value.stock)
    } else if (form.value.productType === 'cdk') {
      productData.maxPurchaseQuantity = form.value.limitEnabled
        ? Number(form.value.maxPurchaseQuantity)
        : 0
      // CDK 可以直接在创建时填入
      if (form.value.cdkCodes.trim()) {
        productData.cdkCodes = form.value.cdkCodes.trim()
      }
      // 测试模式
      if (form.value.isTestMode) {
        productData.isTestMode = true
      }
    }

    const submissionToken = resolveSubmissionToken(productData)
    productData.submissionToken = submissionToken
    
    // 创建物品
    const result = await shopStore.createProduct(productData, { timeout: PRODUCT_SUBMIT_TIMEOUT_MS })
    
    if (!result.success) {
      if (isUncertainSubmitResult(result)) {
        await confirmSubmitAfterUncertainResult(submissionToken)
        return
      }
      clearSubmissionTokenState()
      toast.error(result.error || '发布失败')
      return
    }
    
    clearSubmissionTokenState()

    // 显示成功提示
    const cdkInfo = result.data?.cdkImported ? `，已导入 ${result.data.cdkImported} 条 CDK` : ''
    if (result.data?.deduplicated) {
      toast.success('已确认该物品已提交，请勿重复发布')
    } else {
      toast.success(`物品提交成功，等待管理员审核${cdkInfo}`)
    }
    router.push('/user/products')
  } catch (error) {
    clearSubmissionTokenState()
    toast.error(error.message || '发布失败')
  } finally {
    submitting.value = false
  }
}

// 初始化
async function submitBuyRequest() {
  buySubmitAttempted.value = true

  if (buyTitleError.value) {
    toast.error(buyTitleError.value)
    focusBuyField('title')
    return
  }
  if (buyDetailsError.value) {
    toast.error(buyDetailsError.value)
    focusBuyField('details')
    return
  }
  if (buyPriceError.value) {
    toast.error(buyPriceError.value)
    focusBuyField('price')
    return
  }

  buySubmitting.value = true
  try {
    const result = await api.post('/api/shop/buy-requests', {
      title: buyForm.value.title.trim(),
      details: buyForm.value.details.trim(),
      price: parseFloat(buyForm.value.price)
    })

    if (!result.success) {
      toast.error(result.error || '发布求购失败')
      return
    }

    toast.success('求购发布成功，已提交管理员审核')
    router.push('/user/buy-requests')
  } catch (error) {
    toast.error(error.message || '发布求购失败')
  } finally {
    buySubmitting.value = false
  }
}

watch(
  () => form.value.productType,
  (type) => {
    if (type !== 'cdk') {
      form.value.isTestMode = false
    }
  }
)

onMounted(async () => {
  const queryType = String(route.query.type || '').toLowerCase()
  if (queryType === 'buy' || queryType === 'request') {
    publishMode.value = 'buy'
  }

  // 检查是否需要显示引导弹窗
  const hasSeenGuide = localStorage.getItem(GUIDE_MODAL_KEY)
  if (!hasSeenGuide) {
    showGuideModal.value = true
  }
  
  // 加载分类
  await loadCategories()
  
  // 检查商家配置（普通物品与 CDK 都需要）
  await checkMerchantConfig()
})
</script>

<style scoped>
.publish-page {
  min-height: 100vh;
  padding-bottom: 100px;
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
  transition: all 0.2s ease;
}

.mode-btn.active {
  border-color: var(--color-success);
  background: var(--color-success-bg);
  color: var(--color-success);
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
  resize: none;
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
  background: linear-gradient(135deg, rgba(90, 140, 90, 0.08) 0%, rgba(122, 154, 122, 0.12) 100%);
  border: 1px dashed var(--color-success);
  border-radius: 10px;
  font-size: 13px;
  color: var(--color-success);
  text-decoration: none;
  line-height: 1.5;
  word-break: break-word;
  transition: all 0.2s;
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
  background: var(--color-warning-bg, rgba(245, 158, 11, 0.1));
  border: 1px solid var(--color-warning, #f59e0b);
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
  background: var(--color-danger-bg, rgba(239, 68, 68, 0.1));
  border: 1px solid var(--color-danger, #ef4444);
}

.cdk-config-notice .item-num {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-warning, #f59e0b);
  color: white;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
}

.cdk-config-notice .notice-item.highlight .item-num {
  background: var(--color-danger, #ef4444);
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
  background-color: var(--input-error-bg, rgba(220, 38, 38, 0.05));
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
  transition: all 0.2s;
}

.category-btn:hover {
  background: var(--bg-tertiary);
}

.category-btn.active {
  background: var(--color-success-bg);
  border-color: var(--color-success);
  color: var(--color-success);
}

/* 入站分类价格提示 */
.category-price-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 14px;
  background: var(--color-warning-bg, rgba(245, 158, 11, 0.1));
  border: 1px solid var(--color-warning, #f59e0b);
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
  color: var(--color-warning, #f59e0b);
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
  transition: all 0.2s;
}

.type-card:hover {
  background: var(--bg-tertiary);
}

.type-card.active {
  background: var(--color-success-bg);
  border-color: var(--color-success);
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

.type-check {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-success);
  color: white;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 600;
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
  background: linear-gradient(135deg, var(--color-success) 0%, #7a9a7a 100%);
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(90, 140, 90, 0.4);
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
  background: var(--overlay-bg, rgba(24, 28, 34, 0.45));
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
  border: 3px solid rgba(126, 179, 126, 0.25);
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
  background: rgba(220, 38, 38, 0.08);
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
  transition: all 0.2s;
  border: none;
}

.guide-btn-primary {
  background: linear-gradient(135deg, var(--color-success) 0%, #7a9a7a 100%);
  color: white;
}

.guide-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(90, 140, 90, 0.4);
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
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
}

.test-icon {
  font-size: 32px;
  background: var(--color-info-bg) !important;
}

.test-mode-tips {
  margin: 16px 0;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.tip-item {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  padding: 4px 0;
  line-height: 1.6;
}

.tip-item.warning {
  color: var(--color-warning);
  font-weight: 600;
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
</style>
