<template>
  <div class="coupon-manage-page">
    <SellerPageToolbar
      eyebrow="优惠券台账"
      :description="viewMode === 'list' ? '集中查看活动状态、领取进度和使用情况；打开详情可暂停领取、补充发行量或核对领取记录。' : '创建商品券或店铺券。核心规则发布后保持不变，领取状态可在有效期内暂停和恢复。'"
    >
      <template #actions>
        <SellerButton v-if="viewMode === 'list'" variant="primary" @click="viewMode = 'create'">创建优惠券</SellerButton>
      </template>
      <SellerTabs v-model="viewMode" class="coupon-view-tabs" :tabs="viewTabs" mode="tabs" activation="automatic" size="sm" layout="equal" aria-label="优惠券管理功能" />
      <form v-if="viewMode === 'list'" class="coupon-filter-form" role="search" @submit.prevent="applyFilters">
        <label class="coupon-search"><Search :size="16" aria-hidden="true" /><span class="seller-sr-only">搜索优惠券活动</span><input v-model.trim="filter.search" type="search" placeholder="搜索优惠券或适用商品" /></label>
        <select v-model="filter.state" aria-label="活动状态" @change="applyFilters"><option v-for="option in COUPON_CAMPAIGN_STATES" :key="option.value" :value="option.value">{{ option.label }}</option></select>
        <button type="submit">查询</button>
        <button v-if="filter.search || filter.state" type="button" class="filter-reset" @click="resetFilters">清除</button>
      </form>
    </SellerPageToolbar>

    <section v-show="viewMode === 'create'" id="coupon-create-panel" class="create-layout" role="tabpanel" aria-labelledby="coupon-create-tab" tabindex="0">
      <form ref="formElement" class="coupon-form-card" novalidate @submit.prevent="submitCampaign">
        <section class="form-section" aria-labelledby="coupon-basic-title">
          <div class="section-heading"><span>1</span><div><h2 id="coupon-basic-title">基本信息</h2><p>名称和说明会出现在领取页与买家券包。</p></div></div>
          <div class="field-grid">
            <label class="field field-wide"><span>优惠券名称 <em>*</em></span><input v-model.trim="form.name" maxlength="60" autocomplete="off" placeholder="例如：夏日店铺满减券" :aria-invalid="!!errors.name" :aria-describedby="errors.name ? 'coupon-name-error' : undefined" /><small v-if="errors.name" id="coupon-name-error" class="field-error" role="alert">{{ errors.name }}</small></label>
            <label class="field field-wide"><span>使用说明</span><textarea v-model.trim="form.description" maxlength="500" rows="3" placeholder="可选，说明适用品类或活动规则" /><small>{{ form.description.length }} / 500</small></label>
          </div>
        </section>

        <section class="form-section" aria-labelledby="coupon-rule-title">
          <div class="section-heading"><span>2</span><div><h2 id="coupon-rule-title">范围与优惠</h2><p>发布后范围、券值、门槛和有效期不可修改。</p></div></div>
          <fieldset class="choice-field">
            <legend>适用范围 <em>*</em></legend>
            <div class="choice-grid">
              <label :class="['choice-card', { selected: form.scopeType === 'product' }]"><input v-model="form.scopeType" type="radio" value="product" /><strong>指定商品</strong><small>仅限一个本人有效商品</small></label>
              <label :class="['choice-card', { selected: form.scopeType === 'seller' }]"><input v-model="form.scopeType" type="radio" value="seller" /><strong>店铺范围</strong><small>覆盖同站点当前和未来商品</small></label>
            </div>
          </fieldset>
          <label v-if="form.scopeType === 'product'" class="field"><span>适用商品 <em>*</em></span><select v-model="form.productId" :aria-invalid="!!errors.productId" :aria-describedby="errors.productId ? 'coupon-product-error' : undefined"><option value="">请选择商品</option><option v-for="product in eligibleProducts" :key="product.id" :value="String(product.id)">{{ product.name }} · {{ currentProductPrice(product).toFixed(2) }} LDC</option></select><small v-if="productsLoading">正在加载有效商品…</small><small v-else-if="!eligibleProducts.length">暂无可发券的普通物品或 CDK。</small><small v-if="errors.productId" id="coupon-product-error" class="field-error" role="alert">{{ errors.productId }}</small></label>
          <fieldset class="choice-field">
            <legend>优惠类型 <em>*</em></legend>
            <div class="choice-grid">
              <label :class="['choice-card', { selected: form.discountType === 'fixed_amount' }]"><input v-model="form.discountType" type="radio" value="fixed_amount" /><strong>减少指定金额</strong><small>整笔订单只抵扣一次</small></label>
              <label :class="['choice-card', { selected: form.discountType === 'percentage' }]"><input v-model="form.discountType" type="radio" value="percentage" /><strong>单件直接打折</strong><small>每笔订单仅优惠一件</small></label>
            </div>
          </fieldset>
          <div class="field-grid">
            <label v-if="form.discountType === 'fixed_amount'" class="field"><span>减额金额（LDC）<em>*</em></span><input v-model="form.fixedAmount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="10.00" :aria-invalid="!!errors.discountValue" :aria-describedby="errors.discountValue ? 'coupon-discount-error' : undefined" /><small v-if="errors.discountValue" id="coupon-discount-error" class="field-error" role="alert">{{ errors.discountValue }}</small></label>
            <label v-else class="field"><span>折扣（折）<em>*</em></span><input v-model="form.percentage" type="number" min="0.1" max="9.9" step="0.1" inputmode="decimal" placeholder="8.0" :aria-invalid="!!errors.discountValue" :aria-describedby="errors.discountValue ? 'coupon-discount-error' : undefined" /><small v-if="errors.discountValue" id="coupon-discount-error" class="field-error" role="alert">{{ errors.discountValue }}</small></label>
            <label class="field"><span>最低消费（LDC）</span><input v-model="form.minSpend" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" :aria-invalid="!!errors.minSpend" :aria-describedby="errors.minSpend ? 'coupon-min-spend-error' : undefined" /><small>按商品现有折后小计判断。</small><small v-if="errors.minSpend" id="coupon-min-spend-error" class="field-error" role="alert">{{ errors.minSpend }}</small></label>
          </div>
        </section>

        <section class="form-section" aria-labelledby="coupon-supply-title">
          <div class="section-heading"><span>3</span><div><h2 id="coupon-supply-title">发行与有效期</h2><p>所有领取者共享同一生效和过期时刻。</p></div></div>
          <div class="field-grid supply-grid">
            <label class="field"><span>发行总量 <em>*</em></span><input v-model="form.totalQuantity" type="number" min="1" max="100000" step="1" inputmode="numeric" :aria-invalid="!!errors.totalQuantity" :aria-describedby="errors.totalQuantity ? 'coupon-quantity-error' : undefined" /><small v-if="errors.totalQuantity" id="coupon-quantity-error" class="field-error" role="alert">{{ errors.totalQuantity }}</small></label>
            <label class="field"><span>生效时间 <em>*</em></span><input v-model="form.startsAt" type="datetime-local" :aria-invalid="!!errors.startsAt" :aria-describedby="errors.startsAt ? 'coupon-start-error' : undefined" /><small v-if="errors.startsAt" id="coupon-start-error" class="field-error" role="alert">{{ errors.startsAt }}</small></label>
            <label class="field"><span>过期时间 <em>*</em></span><input v-model="form.expiresAt" type="datetime-local" :aria-invalid="!!errors.expiresAt" :aria-describedby="errors.expiresAt ? 'coupon-expiry-error' : undefined" /><small v-if="errors.expiresAt" id="coupon-expiry-error" class="field-error" role="alert">{{ errors.expiresAt }}</small></label>
          </div>
        </section>
        <div class="rule-lock"><LockKeyhole :size="20" aria-hidden="true" /><span>发布后核心规则保持不变；生效后可随时暂停或恢复新领取，已领取且仍有效的券不受影响。</span></div>
        <button class="submit-button" type="submit" :disabled="submitting">{{ submitting ? '发布中…' : '发布优惠券' }}</button>
      </form>

      <aside class="coupon-preview">
        <p class="preview-label">买家领取页预览</p>
        <div class="preview-ticket"><span class="preview-track" aria-hidden="true"></span><div><small>{{ form.scopeType === 'product' ? '商品券' : '店铺券' }}</small><h2>{{ form.name || '优惠券名称' }}</h2><strong>{{ previewRule }}</strong><p>{{ Number(form.minSpend || 0) > 0 ? `满 ${Number(form.minSpend).toFixed(2)} LDC 可用` : '无门槛' }}</p></div></div>
        <div v-if="form.discountType === 'percentage'" class="quantity-preview"><h3>多件购买预览</h3><p>按当前单价 <strong>{{ previewUnitPrice.toFixed(2) }}</strong> LDC、购买 3 件计算：</p><div><span>商品小计</span><b>{{ (previewUnitPrice * 3).toFixed(2) }} LDC</b></div><div><span>仅 1 件优惠</span><b>-{{ previewPercentageDiscount.toFixed(2) }} LDC</b></div><div class="total"><span>预计实付</span><b>{{ Math.max(0.01, previewUnitPrice * 3 - previewPercentageDiscount).toFixed(2) }} LDC</b></div><small>单件折扣无论购买数量，只优惠其中一件。</small></div>
      </aside>
    </section>

    <section v-show="viewMode === 'list'" id="coupon-list-panel" class="campaign-section" role="tabpanel" aria-labelledby="coupon-list-tab" tabindex="0">
      <div v-if="createdCampaign" class="created-banner" role="status"><CircleCheck :size="22" aria-hidden="true" /><div><strong>“{{ createdCampaign.name }}”发布成功</strong><p>领取链接已生成，可以复制后分享给买家。</p></div><button type="button" @click="copyClaimUrl(createdCampaign)"><Link2 :size="16" aria-hidden="true" />复制领取链接</button></div>
      <div v-if="loadError" class="campaign-error" role="alert"><CircleAlert :size="20" aria-hidden="true" /><div><strong>优惠券活动加载失败</strong><p>{{ loadError }}</p></div><button type="button" @click="loadCampaigns">重试</button></div>
      <SellerDataTable v-else caption="优惠券活动台账" :columns="columns" :rows="campaigns" :loading="loading" row-key="id">
        <template #cell-campaign="{ row }"><button type="button" class="campaign-identity" @click="openDetails(row)"><span class="ticket-rail" aria-hidden="true"></span><span><strong>{{ row.name }}</strong><small>{{ row.scopeType === 'product' ? '商品券' : '店铺券' }} · {{ formatCouponRule(row) }}</small></span></button></template>
        <template #cell-scope="{ row }"><div class="scope-cell"><strong>{{ row.productName || '店铺内平台商品' }}</strong><small>{{ Number(row.minSpend || 0) > 0 ? `满 ${Number(row.minSpend).toFixed(2)} LDC 可用` : '无门槛' }}</small></div></template>
        <template #cell-distribution="{ row }"><div class="distribution-cell"><strong>{{ row.claimedCount }} / {{ row.totalQuantity }}</strong><span class="distribution-track"><i :style="{ width: `${claimProgress(row)}%` }"></i></span><small>已用 {{ row.counts?.used || 0 }} · 占用 {{ row.counts?.reserved || 0 }}</small></div></template>
        <template #cell-period="{ row }"><div class="period-cell"><span>{{ formatCouponDate(row.startsAt) }}</span><small>至 {{ formatCouponDate(row.expiresAt) }}</small></div></template>
        <template #cell-status="{ row }"><SellerStatusBadge v-bind="getCouponCampaignStateMeta(row.state)" /></template>
        <template #cell-action="{ row }"><button type="button" class="detail-link" @click="openDetails(row)">查看详情<ArrowUpRight :size="14" aria-hidden="true" /></button></template>
        <template #mobile-row="{ row }"><div class="campaign-mobile-head"><button type="button" class="campaign-identity" @click="openDetails(row)"><span class="ticket-rail" aria-hidden="true"></span><span><strong>{{ row.name }}</strong><small>{{ formatCouponRule(row) }}</small></span></button><SellerStatusBadge v-bind="getCouponCampaignStateMeta(row.state)" /></div><p class="campaign-mobile-scope">{{ row.productName || '店铺内平台商品' }}</p><div class="campaign-mobile-stats"><span>已领取 <strong>{{ row.claimedCount }} / {{ row.totalQuantity }}</strong></span><span>已使用 <strong>{{ row.counts?.used || 0 }}</strong></span></div><div class="campaign-mobile-foot"><span>{{ formatCouponDate(row.expiresAt) }} 过期</span><button type="button" @click="openDetails(row)">查看详情<ArrowUpRight :size="14" aria-hidden="true" /></button></div></template>
        <template #empty><div class="campaign-empty"><TicketPercent :size="34" aria-hidden="true" /><strong>{{ appliedFilter.search || appliedFilter.state ? '没有符合条件的优惠券' : '还没有发放优惠券' }}</strong><p>{{ appliedFilter.search || appliedFilter.state ? '可清除搜索或切换状态后再查看。' : '创建第一张优惠券，用领取链接为商品或店铺引流。' }}</p><button v-if="appliedFilter.search || appliedFilter.state" type="button" @click="resetFilters">清除筛选</button><button v-else type="button" @click="viewMode = 'create'">创建优惠券</button></div></template>
        <template #footer><SellerPagination :page="pagination.page" :total-pages="pagination.totalPages" :total="pagination.total" @change="goCampaignPage" /></template>
      </SellerDataTable>
    </section>
    <SellerCouponDetailDrawer :open="drawerOpen" :campaign="selectedCampaign" @close="closeDetails" @changed="handleCampaignChanged" />
  </div>
</template>

<script setup>
import { normalizeResourceId } from '@/utils/resourceId'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ArrowUpRight, CircleAlert, CircleCheck, Link2, LockKeyhole, Search, TicketPercent } from '@lucide/vue'
import { useInventoryStore } from '@/stores/inventory'
import { useToast } from '@/composables/useToast'
import SellerCouponDetailDrawer from '@/components/seller/SellerCouponDetailDrawer.vue'
import SellerButton from '@/components/seller/SellerButton.vue'
import SellerTabs from '@/components/seller/SellerTabs.vue'
import SellerDataTable from '@/components/seller/SellerDataTable.vue'
import SellerPageToolbar from '@/components/seller/SellerPageToolbar.vue'
import SellerPagination from '@/components/seller/SellerPagination.vue'
import SellerStatusBadge from '@/components/seller/SellerStatusBadge.vue'
import { createCouponRequest, fetchSellerCouponsRequest, formatCouponDate, formatCouponRule } from '@/services/shop/couponService'
import { buildSellerCouponQuery, COUPON_CAMPAIGN_STATES, getCouponCampaignStateMeta } from '@/utils/sellerCoupons'

const inventoryStore = useInventoryStore()
const toast = useToast()
const viewMode = ref('list')
const viewTabs = [
  { value: 'list', label: '活动管理', id: 'coupon-list-tab', panelId: 'coupon-list-panel' },
  { value: 'create', label: '创建优惠券', id: 'coupon-create-tab', panelId: 'coupon-create-panel' }
]
const loading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const campaigns = ref([])
const pagination = reactive({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
const filter = reactive({ search: '', state: '' })
const appliedFilter = reactive({ search: '', state: '' })
const products = ref([])
const productsLoading = ref(false)
const createdCampaign = ref(null)
const selectedCampaign = ref(null)
const drawerOpen = ref(false)
const errors = reactive({})
const formElement = ref(null)

const columns = Object.freeze([
  { key: 'campaign', label: '优惠券 / 规则', width: '25%' },
  { key: 'scope', label: '适用范围', width: '22%' },
  { key: 'distribution', label: '领取与使用', width: '19%' },
  { key: 'period', label: '有效时间', width: '17%' },
  { key: 'status', label: '状态', width: '10%' },
  { key: 'action', label: '', align: 'right', width: '7%' }
])

function shanghaiInput(date) { return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 16) }
const now = new Date()
const form = reactive({ name: '', description: '', scopeType: 'product', productId: '', discountType: 'fixed_amount', fixedAmount: '', percentage: '8', minSpend: '0', totalQuantity: '100', startsAt: shanghaiInput(now), expiresAt: shanghaiInput(new Date(now.getTime() + 7 * 86400000)) })
function field(product, camel, snake) { return product?.[camel] ?? product?.[snake] }
function currentProductPrice(product) { return Number(field(product, 'price', 'price') || 0) * Number(field(product, 'discount', 'discount') || 1) }
const eligibleProducts = computed(() => products.value.filter(product => { const type = String(field(product, 'productType', 'product_type') || ''); const status = String(field(product, 'status', 'status') || ''); return ['normal', 'cdk'].includes(type) && ['ai_approved', 'manual_approved', 'approved', 'active'].includes(status) }))
const selectedProduct = computed(() => eligibleProducts.value.find(item => String(item.id) === String(form.productId)))
const previewUnitPrice = computed(() => selectedProduct.value ? currentProductPrice(selectedProduct.value) : 80)
const previewRule = computed(() => form.discountType === 'fixed_amount' ? `减 ${Number(form.fixedAmount || 0).toFixed(2)} LDC` : `${Number(form.percentage || 0).toFixed(1)} 折 · 仅优惠 1 件`)
const previewPercentageDiscount = computed(() => previewUnitPrice.value * (1 - Math.min(9.9, Math.max(.1, Number(form.percentage || 0))) / 10))

function validateForm() {
  Object.keys(errors).forEach(key => delete errors[key])
  if (!form.name || form.name.length > 60) errors.name = '请输入 1-60 个字符的名称'
  if (form.scopeType === 'product' && !form.productId) errors.productId = '请选择适用商品'
  if (form.discountType === 'fixed_amount' && !(Number(form.fixedAmount) > 0)) errors.discountValue = '减额金额必须大于 0'
  if (form.discountType === 'percentage' && !(Number(form.percentage) >= .1 && Number(form.percentage) <= 9.9)) errors.discountValue = '折扣必须在 0.1 至 9.9 折之间'
  if (!(Number(form.minSpend) >= 0)) errors.minSpend = '最低消费不能小于 0'
  if (!Number.isInteger(Number(form.totalQuantity)) || Number(form.totalQuantity) < 1 || Number(form.totalQuantity) > 100000) errors.totalQuantity = '发行量须为 1-100000 的整数'
  if (!form.startsAt) errors.startsAt = '请选择生效时间'
  if (!form.expiresAt) errors.expiresAt = '请选择过期时间'
  if (form.startsAt && form.expiresAt && new Date(`${form.expiresAt}:00+08:00`) <= new Date(`${form.startsAt}:00+08:00`)) errors.expiresAt = '过期时间必须晚于生效时间'
  return Object.keys(errors).length === 0
}

async function submitCampaign() {
  if (submitting.value) return
  if (!validateForm()) {
    await nextTick()
    formElement.value?.querySelector('[aria-invalid="true"]')?.focus()
    return
  }
  submitting.value = true
  const payload = { name: form.name, description: form.description, scopeType: form.scopeType, productId: form.scopeType === 'product' ? normalizeResourceId(form.productId) : null, discountType: form.discountType, fixedAmount: form.discountType === 'fixed_amount' ? Number(form.fixedAmount) : null, percentageBps: form.discountType === 'percentage' ? Math.round(Number(form.percentage) * 1000) : null, minSpend: Number(form.minSpend || 0), totalQuantity: Number(form.totalQuantity), startsAt: new Date(`${form.startsAt}:00+08:00`).toISOString(), expiresAt: new Date(`${form.expiresAt}:00+08:00`).toISOString() }
  const result = await createCouponRequest(payload)
  if (result.success) { createdCampaign.value = result.data; toast.success('优惠券发布成功'); viewMode.value = 'list'; await loadCampaigns(1) }
  else toast.error(result.error || '发布失败，请稍后重试')
  submitting.value = false
}

function claimUrl(campaign) { return `${window.location.origin}${campaign.claimPath || `/coupon/${campaign.publicToken}`}` }
async function copyClaimUrl(campaign) { try { await navigator.clipboard.writeText(claimUrl(campaign)); toast.success('领取链接已复制') } catch { toast.error('复制失败，请手动复制') } }
function claimProgress(campaign) { return Math.min(100, Math.round(Number(campaign.claimedCount || 0) / Math.max(1, Number(campaign.totalQuantity || 0)) * 100)) }

async function loadCampaigns(page = pagination.page || 1) {
  loading.value = true; loadError.value = ''
  const result = await fetchSellerCouponsRequest(buildSellerCouponQuery({ ...appliedFilter, page, pageSize: pagination.pageSize }))
  if (result.success) { campaigns.value = result.data?.items || []; Object.assign(pagination, result.data?.pagination || { page, pageSize: 20, total: campaigns.value.length, totalPages: campaigns.value.length ? 1 : 0 }) }
  else { campaigns.value = []; loadError.value = result.error || '优惠券列表加载失败' }
  loading.value = false
}
function applyFilters() { Object.assign(appliedFilter, { search: filter.search, state: filter.state }); pagination.page = 1; void loadCampaigns(1) }
function resetFilters() { Object.assign(filter, { search: '', state: '' }); Object.assign(appliedFilter, { search: '', state: '' }); pagination.page = 1; void loadCampaigns(1) }
function goCampaignPage(page) { pagination.page = page; void loadCampaigns(page) }
function openDetails(campaign) { selectedCampaign.value = campaign; drawerOpen.value = true }
function closeDetails() { drawerOpen.value = false }
async function handleCampaignChanged(updated) { if (selectedCampaign.value?.id === updated?.id) selectedCampaign.value = { ...selectedCampaign.value, ...updated }; await loadCampaigns(pagination.page); const refreshed = campaigns.value.find(item => item.id === selectedCampaign.value?.id); if (refreshed) selectedCampaign.value = refreshed }

onMounted(async () => {
  productsLoading.value = true
  const result = await inventoryStore.fetchProducts()
  products.value = result.success ? result.data.products : []
  productsLoading.value = false
  await loadCampaigns()
})
</script>

<style scoped>
.coupon-manage-page { min-width: 0; }
.wallet-link { min-height: 44px; display: inline-flex; align-items: center; gap: 7px; padding: 0 13px; border: 1px solid var(--seller-border); border-radius: 10px; color: var(--seller-ink); background: var(--seller-surface); font-size: 13px; font-weight: 700; }
.coupon-view-tabs { width: auto; }
.coupon-filter-form { min-width: min(100%, 520px); display: flex; align-items: center; gap: 8px; flex: 1; }.coupon-search { min-width: 200px; min-height: 44px; display: flex; align-items: center; gap: 8px; flex: 1; padding: 0 11px; border: 1px solid var(--seller-border); border-radius: 9px; color: var(--seller-muted); background: var(--seller-surface-strong); }.coupon-search input { min-width: 0; width: 100%; border: 0; outline: 0; color: var(--seller-ink); background: transparent; }.coupon-filter-form select { min-height: 44px; padding: 0 10px; border: 1px solid var(--seller-border); border-radius: 9px; color: var(--seller-ink); background: var(--seller-surface-strong); }.coupon-filter-form > button { min-height: 44px; padding: 0 14px; border-radius: 9px; color: var(--palette-hex-ffffff); background: var(--seller-navy); font-weight: 700; }.coupon-filter-form .filter-reset { color: var(--seller-muted); border: 1px solid var(--seller-border); background: transparent; }
.create-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 18px; align-items: start; }.coupon-form-card, .coupon-preview { border: 1px solid var(--seller-border); border-radius: 14px; background: var(--seller-surface); box-shadow: var(--seller-shadow-sm); }.coupon-form-card { min-width: 0; padding: clamp(20px, 2.6vw, 30px); }.coupon-preview { position: sticky; top: 86px; padding: 20px; }.form-section + .form-section { margin-top: 30px; padding-top: 28px; border-top: 1px solid var(--seller-border); }
.section-heading { display: flex; gap: 11px; margin-bottom: 18px; }.section-heading > span { width: 29px; height: 29px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 8px; color: var(--seller-jade-strong); background: var(--seller-jade-soft); font-weight: 800; }.section-heading h2 { margin: 1px 0 0; color: var(--seller-ink); font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif; font-size: 18px; }.section-heading p { margin: 4px 0 0; color: var(--seller-muted); font-size: 12px; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }.supply-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }.field-wide { grid-column: 1 / -1; }.field { min-width: 0; display: grid; gap: 7px; }.field > span, legend { color: var(--seller-ink); font-size: 13px; font-weight: 700; } em { color: var(--seller-danger); font-style: normal; }.field input, .field textarea, .field select { min-width: 0; width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--seller-border); border-radius: 9px; color: var(--seller-ink); background: var(--seller-surface-strong); }.field textarea { resize: vertical; }.field input:focus, .field textarea:focus, .field select:focus { border-color: var(--seller-jade); box-shadow: 0 0 0 3px color-mix(in srgb, var(--seller-jade) 14%, transparent); }.field small { color: var(--seller-muted); font-size: 11px; }.field .field-error { color: var(--seller-danger); }
.choice-field { margin: 18px 0; padding: 0; border: 0; }.choice-field legend { margin-bottom: 8px; }.choice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }.choice-card { position: relative; min-height: 78px; display: grid; gap: 4px; padding: 14px 14px 14px 40px; border: 1px solid var(--seller-border); border-radius: 10px; background: var(--seller-surface-muted); cursor: pointer; }.choice-card.selected { border-color: var(--seller-jade); background: var(--seller-jade-soft); }.choice-card input { position: absolute; top: 17px; left: 14px; width: 16px; height: 16px; accent-color: var(--seller-jade-strong); }.choice-card strong { color: var(--seller-ink); font-size: 13px; }.choice-card small { color: var(--seller-muted); font-size: 11px; }
.rule-lock { display: flex; align-items: flex-start; gap: 9px; margin-top: 22px; padding: 13px; border-left: 3px solid var(--seller-warning); color: var(--seller-warning); background: color-mix(in srgb, var(--seller-warning) 8%, var(--seller-surface)); font-size: 12px; line-height: 1.6; }.rule-lock svg { flex: 0 0 auto; }.submit-button { width: 100%; min-height: 46px; margin-top: 16px; border-radius: 10px; color: var(--palette-hex-ffffff); background: var(--seller-navy); font-size: 14px; font-weight: 800; }.submit-button:disabled { cursor: wait; opacity: .55; }
.preview-label { margin: 0 0 12px; color: var(--seller-muted); font-size: 11px; font-weight: 750; letter-spacing: .1em; }.preview-ticket { overflow: hidden; display: grid; grid-template-columns: 12px minmax(0, 1fr); border: 1px solid var(--seller-border); border-radius: 12px; background: var(--seller-surface-strong); }.preview-track { border-right: 1px dashed var(--seller-border-strong); background: var(--seller-jade-soft); }.preview-ticket > div { padding: 20px; }.preview-ticket small { color: var(--seller-jade-strong); font-weight: 750; }.preview-ticket h2 { overflow-wrap: anywhere; margin: 12px 0 5px; color: var(--seller-ink); font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif; font-size: 18px; }.preview-ticket strong { color: var(--seller-ink); font-size: 22px; }.preview-ticket p { margin: 7px 0 0; color: var(--seller-muted); font-size: 12px; }.quantity-preview { margin-top: 14px; padding: 14px; border-radius: 10px; background: var(--seller-surface-muted); }.quantity-preview h3 { margin: 0; color: var(--seller-ink); font-size: 14px; }.quantity-preview p { margin: 7px 0 12px; color: var(--seller-muted); font-size: 11px; }.quantity-preview div { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; color: var(--seller-muted); font-size: 12px; }.quantity-preview .total { margin-top: 4px; padding-top: 9px; border-top: 1px solid var(--seller-border); color: var(--seller-ink); }.quantity-preview > small { display: block; margin-top: 9px; color: var(--seller-warning); font-size: 11px; line-height: 1.5; }
.campaign-section { min-width: 0; }.created-banner { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; margin-bottom: 14px; padding: 14px 16px; border: 1px solid color-mix(in srgb, var(--seller-jade) 45%, var(--seller-border)); border-radius: 12px; color: var(--seller-jade-strong); background: var(--seller-jade-soft); }.created-banner strong { color: var(--seller-ink); }.created-banner p { margin: 3px 0 0; color: var(--seller-muted); font-size: 12px; }.created-banner button { min-height: 42px; display: inline-flex; align-items: center; gap: 7px; padding: 0 13px; border: 1px solid var(--seller-border); border-radius: 9px; color: var(--seller-ink); background: var(--seller-surface-strong); font-weight: 700; }.campaign-error { min-height: 240px; display: grid; place-items: center; align-content: center; gap: 10px; padding: 28px; border: 1px solid var(--seller-border); border-radius: 14px; color: var(--seller-danger); background: var(--seller-surface); text-align: center; }.campaign-error p { margin: 5px 0 0; color: var(--seller-muted); }.campaign-error button { min-height: 42px; padding: 0 14px; border: 1px solid var(--seller-border); border-radius: 9px; background: var(--seller-surface-strong); color: var(--seller-ink); }
.campaign-identity { min-width: 0; width: 100%; display: grid; grid-template-columns: 8px minmax(0, 1fr); gap: 10px; color: inherit; text-align: left; }.campaign-identity .ticket-rail { border-right: 1px dashed var(--seller-border-strong); background: var(--seller-jade-soft); }.campaign-identity strong, .campaign-identity small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.campaign-identity strong { color: var(--seller-ink); font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif; font-size: 14px; }.campaign-identity small { margin-top: 5px; color: var(--seller-muted); font-size: 11px; }.scope-cell strong, .scope-cell small, .period-cell span, .period-cell small { display: block; }.scope-cell strong { overflow: hidden; color: var(--seller-ink); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.scope-cell small, .period-cell small { margin-top: 5px; color: var(--seller-muted); font-size: 11px; }.period-cell { font-variant-numeric: tabular-nums; }
.distribution-cell strong { color: var(--seller-ink); font-variant-numeric: tabular-nums; }.distribution-cell small { display: block; margin-top: 5px; color: var(--seller-muted); font-size: 10px; }.distribution-track { overflow: hidden; display: block; height: 4px; margin-top: 7px; border-radius: 999px; background: var(--seller-surface-soft); }.distribution-track i { display: block; height: 100%; border-radius: inherit; background: var(--seller-jade-strong); }.detail-link { min-height: 40px; display: inline-flex; align-items: center; justify-content: flex-end; gap: 4px; color: var(--seller-jade-strong); font-size: 12px; font-weight: 750; white-space: nowrap; }
.campaign-mobile-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: start; }.campaign-mobile-scope { overflow: hidden; margin: 13px 0 0; color: var(--seller-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.campaign-mobile-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }.campaign-mobile-stats span { padding: 10px; border-radius: 9px; color: var(--seller-muted); background: var(--seller-surface-muted); font-size: 11px; }.campaign-mobile-stats strong { display: block; margin-top: 4px; color: var(--seller-ink); font-size: 15px; }.campaign-mobile-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 13px; padding-top: 12px; border-top: 1px solid var(--seller-border); color: var(--seller-muted); font-size: 11px; }.campaign-mobile-foot button { min-height: 40px; display: inline-flex; align-items: center; gap: 4px; color: var(--seller-jade-strong); font-weight: 750; }.campaign-empty { min-height: 260px; display: grid; place-items: center; align-content: center; gap: 9px; color: var(--seller-muted); }.campaign-empty strong { color: var(--seller-ink); font-size: 15px; }.campaign-empty p { max-width: 420px; margin: 0; font-size: 12px; line-height: 1.55; }.campaign-empty button { min-height: 42px; padding: 0 14px; border-radius: 9px; color: var(--palette-hex-ffffff); background: var(--seller-navy); font-weight: 750; }
.seller-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 1040px) { .create-layout { grid-template-columns: 1fr; }.coupon-preview { position: static; }.supply-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 767px) { .coupon-filter-form { min-width: 0; width: 100%; flex-direction: column; align-items: stretch; }.coupon-search { min-width: 0; }.coupon-search input, .coupon-filter-form select, .field input, .field textarea, .field select { font-size: 16px; }.coupon-view-tabs { width: 100%; }.created-banner { grid-template-columns: auto minmax(0, 1fr); }.created-banner button { grid-column: 1 / -1; justify-content: center; }.campaign-identity, .campaign-mobile-foot button { min-height: 44px; }.field-grid, .choice-grid, .supply-grid { grid-template-columns: 1fr; }.field-wide { grid-column: auto; } }
@media (prefers-reduced-motion: reduce) { .distribution-track i { transition: none; } }
</style>
