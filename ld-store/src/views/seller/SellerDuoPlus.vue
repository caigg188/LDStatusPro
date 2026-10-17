<template>
  <div class="duo-page" :aria-busy="loading || busy">
    <header class="duo-heading">
      <div>
        <p class="duo-eyebrow">按有效曝光交付</p>
        <h2>让物品，多一些被看见的机会<span>DUO+</span></h2>
        <p class="duo-description">在「全部」与所属分类的默认推荐中推广，随时查看每一份曝光的交付进度。</p>
      </div>
      <SellerButton :disabled="loading || busy" @click="load()"
        ><RefreshCw :size="16" aria-hidden="true" />{{ loading ? '更新中…' : '刷新进度' }}</SellerButton
      >
    </header>

    <p v-if="error" class="duo-feedback is-error" role="alert">
      <CircleAlert :size="18" aria-hidden="true" /><span>{{ error }}</span
      ><SellerButton :disabled="loading || busy" @click="load()">重试</SellerButton>
    </p>
    <p v-if="notice" class="duo-feedback" role="status">
      <CircleCheck :size="18" aria-hidden="true" /><span>{{ notice }}</span>
    </p>

    <div v-if="options && !options.settings.purchaseEnabled" class="duo-availability">
      <span class="duo-icon-tile"><ChartNoAxesCombined :size="22" aria-hidden="true" /></span>
      <div>
        <strong>DUO+ 暂未开放购买</strong>
        <p>套餐将结合可交付容量开放。已有推广的进度与剩余额度，仍可在下方查看。</p>
      </div>
      <SellerStatusBadge label="暂未开售" />
    </div>

    <form class="duo-purchase" aria-labelledby="duo-buy-title" @submit.prevent="purchase">
      <div class="duo-setup">
        <header class="duo-section-heading">
          <div>
            <h2 id="duo-buy-title">创建曝光推广</h2>
            <p>选好物品，再选择适合的曝光量。</p>
          </div>
          <Megaphone :size="22" aria-hidden="true" />
        </header>
        <div v-if="!options" class="duo-empty compact" role="status">
          <p>{{ error ? '物品与套餐暂时无法读取，请重试。' : '正在读取物品与套餐…' }}</p>
        </div>
        <template v-else>
          <div class="duo-field">
            <label for="duo-product">推广物品</label>
            <select
              id="duo-product"
              v-model="productId"
              :disabled="busy || loading"
              :aria-describedby="currentProduct?.reason ? 'duo-product-reason' : undefined"
            >
              <option value="">{{ options.products.length ? '选择要推广的物品' : '暂无可选择的物品' }}</option>
              <option v-for="p in options.products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <p v-if="currentProduct?.reason" id="duo-product-reason" class="duo-field-note">
              <Info :size="15" aria-hidden="true" />{{ currentProduct.reason }}
            </p>
            <p v-else-if="!options.products.length" class="duo-field-note">
              先在<router-link to="/seller/products">物品管理</router-link>准备一件已上架的物品。
            </p>
            <p v-else class="duo-field-note">同一物品不能同时持有置顶权益与未完成的 DUO+。</p>
          </div>
          <fieldset class="duo-package-field" :disabled="busy || loading">
            <legend>曝光套餐</legend>
            <div v-if="options.packages.length" class="duo-packages">
              <label
                v-for="p in options.packages"
                :key="p.id"
                class="duo-package"
                :class="{ selected: String(packageId) === String(p.id) }"
              >
                <input
                  v-model="packageId"
                  type="radio"
                  name="duo-package"
                  :value="p.id"
                  :aria-label="`${p.name}，${p.target} 次有效曝光，${p.price} LDC`"
                />
                <span class="duo-package-copy"
                  ><strong>{{ p.name }}</strong
                  ><span class="duo-package-target">{{ number(p.target) }}<small>次有效曝光</small></span
                  ><span class="duo-package-meta">预计 {{ p.expected_days }} 天 · {{ money(p.price) }} LDC</span></span
                >
              </label>
            </div>
            <div v-else class="duo-package-empty">
              <PackageOpen :size="26" aria-hidden="true" />
              <div>
                <strong>曝光套餐准备中</strong>
                <p>有可售套餐后，这里会显示曝光量、价格与预计周期。</p>
              </div>
            </div>
          </fieldset>
        </template>
      </div>
      <aside class="duo-checkout" aria-label="推广费用与确认">
        <div class="duo-checkout-heading"><span>本次推广</span><span>按次交付</span></div>
        <p class="duo-checkout-product">{{ currentProduct?.name || '尚未选择物品' }}</p>
        <div class="duo-price">
          <strong>{{ currentPackage ? money(currentPackage.price) : '—' }}</strong
          ><span>LDC</span>
        </div>
        <dl class="duo-checkout-facts">
          <div>
            <dt>有效曝光</dt>
            <dd>{{ currentPackage ? `${number(currentPackage.target)} 次` : '待选择套餐' }}</dd>
          </div>
          <div>
            <dt>预计周期</dt>
            <dd>{{ currentPackage ? `${currentPackage.expected_days} 天` : '—' }}</dd>
          </div>
        </dl>
        <p class="duo-checkout-note">
          <ShieldCheck :size="16" aria-hidden="true" /><span>自然曝光不扣量；预计周期内未完成，免费延长交付。</span>
        </p>
        <button class="duo-rules-trigger" type="button" @click="openRules">
          阅读曝光与交付规则<ChevronDown :size="14" aria-hidden="true" />
        </button>
        <label class="duo-accept"
          ><input
            v-model="accepted"
            type="checkbox"
            :disabled="busy || loading || !options?.settings.purchaseEnabled"
          /><span>我已阅读并接受以上规则</span></label
        >
        <SellerButton
          type="submit"
          variant="primary"
          block
          :busy="busy"
          :disabled="!!reason || loading"
          aria-describedby="duo-purchase-reason"
          >{{ busy ? '正在处理…' : '创建 LDC 支付订单' }}</SellerButton
        >
        <p id="duo-purchase-reason" class="duo-submit-reason">
          {{ reason || '付款确认后开始排期，实际额度以订单记录为准。' }}
        </p>
      </aside>
      <details ref="rules" class="duo-rules">
        <summary>
          <span><CircleHelp :size="17" aria-hidden="true" />曝光与交付规则</span
          ><ChevronDown :size="17" aria-hidden="true" />
        </summary>
        <ul>
          <li>已登录用户前台看见卡片至少 50%，持续 1 秒，才计有效曝光。</li>
          <li>同账号同物品每天最多计 1 次，首页与分类合并去重，卖家自览不计。</li>
          <li>
            仅推广展示消耗额度，自然曝光不扣量。不保证点击、成交或固定名次；预计周期内未完成将免费延长，剩余额度不失效。
          </li>
          <li>缺货、下架或禁售会暂停投放。永久无法投放时，可联系站长审核转移至本人的合格物品。</li>
          <li>不支持退款；同一物品不能同时开通置顶与未完成 DUO+。</li>
        </ul>
      </details>
    </form>

    <section class="duo-progress-section" aria-labelledby="duo-progress-title">
      <header class="duo-section-heading">
        <div>
          <h2 id="duo-progress-title">曝光进度</h2>
          <p>
            {{
              records.updatedAt
                ? `更新于 ${formatTime(records.updatedAt)} · 页面前台每 30 秒更新`
                : '交付数据以已确认的有效曝光为准'
            }}
          </p>
        </div>
        <span class="duo-count">本页 {{ records.campaigns.length }} 项</span>
      </header>
      <p v-if="options?.settings.deliveryEnabled === false && records.campaigns.some(c => c.state !== 'completed')" class="duo-delivery-paused" role="status"><Clock3 :size="17" aria-hidden="true" />平台暂未投放，已购剩余额度保留。活动恢复后仍需等待平台开放投放。</p>
      <div v-if="!loading && !records.campaigns.length" class="duo-empty">
        <span class="duo-empty-icon"><ChartNoAxesCombined :size="28" aria-hidden="true" /></span>
        <h3>{{ page > 1 ? '本页没有推广活动' : '推广进度，从这里开始' }}</h3>
        <p>{{ page > 1 ? '可返回上一页查看已有活动。' : '开通后，已交付曝光、剩余额度和每日明细都会展示在这里。' }}</p>
        <router-link to="/seller/services"
          >也可以了解甄选与优选服务<ArrowUpRight :size="15" aria-hidden="true"
        /></router-link>
      </div>
      <div class="duo-campaigns">
        <article v-for="c in records.campaigns" :key="c.id" class="duo-campaign">
          <header class="duo-campaign-heading">
            <div>
              <h3>{{ c.product_name || `物品 #${c.product_id}` }}</h3>
              <span v-if="c.internal" class="duo-muted">内部试投</span>
            </div>
            <SellerStatusBadge
              :label="status(c.state)"
              :tone="c.state === 'active' && options?.settings.deliveryEnabled !== false ? 'success' : c.state === 'completed' ? 'neutral' : 'warning'"
            />
          </header>
          <div class="duo-delivery-number">
            <strong>{{ number(c.delivered) }}</strong
            ><span>/ {{ number(c.target) }} 次有效曝光</span
            ><b>{{ Math.min(100, Math.floor((c.delivered / c.target) * 100)) }}%</b>
          </div>
          <progress
            :value="c.delivered"
            :max="c.target"
            :aria-label="`物品 ${c.product_id} 已完成 ${c.delivered}，目标 ${c.target}`"
          ></progress>
          <div class="duo-campaign-stats">
            <div>
              <span>剩余额度</span><strong>{{ number(c.remaining) }}<small>次</small></strong>
            </div>
            <div>
              <span>今日交付</span><strong>{{ number(c.today_impressions ?? 0) }}<small>次</small></strong>
            </div>
            <div>
              <span>去重点击</span><strong>{{ number(c.clicks ?? 0) }}<small>次</small></strong>
            </div>
          </div>
          <p v-if="c.extended" class="duo-extension">
            <Clock3 :size="15" aria-hidden="true" />已延长交付，继续保留剩余额度
          </p>
          <p class="duo-muted duo-schedule">
            {{ c.expected_at ? `预计周期至 ${formatTime(c.expected_at)}` : '等待排期' }}
          </p>
          <p v-if="c.pause_reason" class="duo-pause-reason">暂停原因：{{ pauseReason(c.pause_reason) }}</p>
          <footer class="duo-actions">
            <SellerButton variant="ghost" :disabled="busy" @click="showDetail(c)"
              >每日明细<ChevronDown :size="15" aria-hidden="true" /></SellerButton
            ><SellerButton v-if="c.state === 'active'" :disabled="busy" @click="campaignAction(c, 'pause')"
              >暂停</SellerButton
            ><SellerButton
              v-if="['paused', 'waiting'].includes(c.state)"
              :disabled="busy"
              @click="campaignAction(c, 'resume')"
              >恢复并重新排期</SellerButton
            >
          </footer>
        </article>
      </div>
      <div v-if="detail" class="duo-detail">
        <header class="duo-section-heading">
          <div>
            <h3>物品 #{{ detail.campaign.product_id }} 的每日交付</h3>
            <p>点击用于观察，不消耗套餐额度；不代表独立成交。</p>
          </div>
          <SellerButton variant="ghost" @click="detail = null">收起明细</SellerButton>
        </header>
        <p v-if="!detail.series.length" class="duo-muted">尚无交付数据，完成时间估算中。</p>
        <div v-for="d in detail.series" :key="d.day" class="duo-detail-row">
          <span>{{ String(d.day).slice(0, 10) }}</span
          ><span>{{ number(d.impressions) }} 次曝光 · {{ number(d.clicks) }} 次去重点击</span>
        </div>
      </div>
    </section>

    <section class="duo-orders-section" aria-labelledby="duo-orders-title">
      <header class="duo-section-heading">
        <div>
          <h2 id="duo-orders-title">购买记录</h2>
          <p>继续支付、核对付款和查阅历史订单。</p>
        </div>
        <ReceiptText :size="21" aria-hidden="true" />
      </header>
      <p v-if="!loading && !records.orders.length" class="duo-orders-empty">
        {{ page > 1 ? '本页暂无购买记录。' : '暂无购买记录，创建的订单会保存在这里。' }}
      </p>
      <article v-for="o in records.orders" :key="o.orderNo" class="duo-order">
        <div class="duo-order-copy">
          <strong>{{ o.package.name }}</strong
          ><span>{{ o.package.productName || `物品 #${o.productId}` }}</span
          ><span class="duo-order-no">{{ o.orderNo }}</span>
        </div>
        <div class="duo-order-payment">
          <strong>{{ money(o.amount) }} <small>LDC</small></strong
          ><SellerStatusBadge
            :label="orderStatus(o.status)"
            :tone="o.status === 'pending' || o.status === 'review' ? 'warning' : 'neutral'"
          />
        </div>
        <div class="duo-actions">
          <a
            v-if="safePaymentUrl(o.paymentUrl)"
            class="duo-pay"
            :href="safePaymentUrl(o.paymentUrl)"
            target="_blank"
            rel="noopener noreferrer"
            >继续支付<ArrowUpRight :size="15" aria-hidden="true" /></a
          ><SellerButton v-if="o.status !== 'paid'" :disabled="busy" @click="orderAction(o, 'refresh')"
            >核对支付</SellerButton
          ><SellerButton
            v-if="o.status === 'pending'"
            variant="ghost"
            :disabled="busy"
            @click="orderAction(o, 'cancel')"
            >关闭未支付订单</SellerButton
          >
        </div>
      </article>
      <nav
        v-if="page > 1 || records.orders.length >= 50 || records.campaigns.length >= 50"
        class="duo-pagination"
        aria-label="推广记录分页"
      >
        <SellerButton
          :disabled="page <= 1 || busy || loading"
          @click="changePage(-1)"
          >上一页</SellerButton
        ><span>第 {{ page }} 页</span
        ><SellerButton
          :disabled="busy || loading || (records.orders.length < 50 && records.campaigns.length < 50)"
          @click="changePage(1)"
          >下一页</SellerButton
        >
      </nav>
    </section>
    <p class="duo-footnote">
      <ShieldCheck :size="15" aria-hidden="true" />有效曝光次数按账号与物品每日去重，不等同于独立人数或成交承诺。
    </p>
  </div>
</template>
<script setup>
import { ref } from 'vue'
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Info,
  Clock3,
  Megaphone,
  PackageOpen,
  ReceiptText,
  RefreshCw,
  ShieldCheck
} from '@lucide/vue'
import SellerButton from '@/components/seller/SellerButton.vue'
import SellerStatusBadge from '@/components/seller/SellerStatusBadge.vue'
import { useDuoPlus } from '@/composables/useDuoPlus'
const {
  options,
  records,
  detail,
  loading,
  busy,
  error,
  notice,
  productId,
  packageId,
  accepted,
  currentProduct,
  currentPackage,
  reason,
  page,
  load,
  purchase,
  orderAction,
  campaignAction,
  showDetail
} = useDuoPlus()
const rules = ref(null)
function changePage(delta) { page.value += delta; void load() }
function openRules() {
  rules.value.open = true
  rules.value.querySelector('summary').focus()
}
const number = (v) => Number(v).toLocaleString('zh-CN')
const money = (v) => Number(v).toFixed(2)
const status = (s) => s === 'active' && options.value?.settings.deliveryEnabled === false ? '等待平台恢复投放' : ({ active: '投放中', paused: '已暂停', waiting: '等待排期', completed: '已完成' })[s] || s
const orderStatus = (s) => ({ pending: '待支付', closed: '已关闭', paid: '已支付', review: '待人工核对' })[s] || s
const pauseReason = (s) =>
  ({
    manual: '手动暂停',
    product_unavailable: '商品不可售或分类变化',
    payment_requires_scheduling: '付款已确认，等待重新排期'
  })[s] || s
function formatTime(v) {
  return new Date(v).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}
function safePaymentUrl(v) {
  try {
    const u = new URL(v)
    return u.protocol === 'https:' ? u.href : ''
  } catch {
    return ''
  }
}
</script>
<style scoped>
.duo-page {
  --seller-muted: color-mix(in srgb, var(--text-paper-secondary) 85%, var(--text-paper-primary));
  --seller-jade-strong: color-mix(in srgb, var(--action-paper-accent-strong) 85%, var(--text-paper-primary));
  --seller-warning: color-mix(in srgb, var(--status-paper-warning) 75%, var(--text-paper-primary));
  display: grid;
  gap: 28px;
  color: var(--seller-ink);
}
.duo-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 6px 0 2px;
}
.duo-eyebrow {
  margin: 0 0 12px;
  color: var(--seller-jade-strong);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.08em;
}
.duo-heading h2 {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0;
  font-size: clamp(22px, 2.1vw, 30px);
  font-weight: 600;
  letter-spacing: -0.035em;
  line-height: 1.45;
  text-wrap: balance;
}
.duo-heading h2 span {
  padding: 3px 8px;
  border: 1px solid var(--seller-border-strong);
  border-radius: 6px;
  font-size: 14px;
  font-weight: 750;
  letter-spacing: -0.04em;
}
.duo-description {
  max-width: 62ch;
  margin: 12px 0 0;
  color: var(--seller-muted);
  font-size: 14px;
  line-height: 1.75;
}
.duo-feedback {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 14px 18px;
  border: 1px solid var(--seller-border);
  border-radius: 12px;
  background: var(--seller-surface);
  font-size: 14px;
  overflow-wrap: anywhere;
}
.duo-feedback > span {
  flex: 1;
  min-width: 0;
}
.duo-feedback > svg {
  flex-shrink: 0;
}
.is-error {
  color: var(--seller-danger);
}
.duo-availability {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 22px;
  border: 1px solid var(--seller-border);
  border-radius: 12px;
  background: var(--seller-surface-soft);
}
.duo-availability > div {
  flex: 1;
  min-width: 0;
}
.duo-availability strong {
  font-size: 14px;
  font-weight: 650;
}
.duo-availability p {
  margin: 4px 0 0;
  color: var(--seller-muted);
  font-size: 13px;
  line-height: 1.7;
}
.duo-icon-tile {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: 1px solid var(--seller-border);
  border-radius: 10px;
  background: var(--seller-surface);
  color: var(--seller-jade-strong);
}
.duo-purchase {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  overflow: hidden;
  border: 1px solid var(--seller-border);
  border-radius: 16px;
  background: var(--seller-surface);
  box-shadow: var(--seller-shadow-sm);
}
.duo-setup {
  min-width: 0;
  padding: 28px;
}
.duo-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}
.duo-section-heading h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.02em;
}
.duo-section-heading h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
}
.duo-section-heading p {
  margin: 6px 0 0;
  color: var(--seller-muted);
  font-size: 13px;
  line-height: 1.65;
}
.duo-section-heading > svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--seller-muted);
}
.duo-section-heading > .seller-btn {
  flex-shrink: 0;
  white-space: nowrap;
}
.duo-delivery-paused { display: flex; align-items: flex-start; gap: 8px; padding: 14px 16px; margin: 0 0 18px; border: 1px solid var(--seller-border); border-radius: 10px; color: var(--seller-warning); background: var(--seller-surface); font-size: 13px; line-height: 1.7; }
.duo-delivery-paused svg { flex-shrink: 0; margin-top: 2px; }
.duo-field {
  margin: 28px 0;
}
.duo-field > label,
.duo-package-field legend {
  display: block;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 650;
}
.duo-field select {
  width: 100%;
  min-width: 0;
  min-height: 48px;
  padding: 10px 14px;
  border: 1px solid var(--seller-border-strong);
  border-radius: 8px;
  color: var(--seller-ink);
  background: var(--seller-surface-strong);
  font: inherit;
  font-size: 14px;
  text-overflow: ellipsis;
}
.duo-field-note {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin: 9px 0 0;
  color: var(--seller-muted);
  font-size: 12px;
  line-height: 1.7;
}
.duo-field-note svg {
  flex-shrink: 0;
  margin-top: 2px;
}
.duo-field-note a {
  color: var(--seller-jade-strong);
  text-decoration: underline;
}
.duo-package-field {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.duo-package-field legend {
  padding: 0;
}
.duo-packages {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr));
  gap: 12px;
}
.duo-package {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--seller-border-strong);
  border-radius: 10px;
  cursor: pointer;
  background: var(--seller-surface-strong);
}
.duo-package.selected {
  border-color: var(--seller-jade-strong);
  background: var(--seller-jade-soft);
  box-shadow: inset 0 0 0 1px var(--seller-jade-strong);
}
.duo-package input {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin: 3px 0 0;
  accent-color: var(--seller-jade-strong);
}
.duo-package-copy {
  display: grid;
  gap: 13px;
  min-width: 0;
}
.duo-package-copy > strong {
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.duo-package-target {
  font-size: 26px;
  font-weight: 650;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}
.duo-package-target small {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0;
  color: var(--seller-muted);
}
.duo-package-meta {
  font-size: 12px;
  line-height: 1.6;
  color: var(--seller-muted);
}
.duo-package-empty {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 132px;
  padding: 22px;
  border: 1px dashed var(--seller-border-strong);
  border-radius: 10px;
  color: var(--seller-muted);
  background: var(--seller-surface-muted);
}
.duo-package-empty > svg {
  flex-shrink: 0;
}
.duo-package-empty strong {
  color: var(--seller-ink);
  font-size: 14px;
  font-weight: 600;
}
.duo-package-empty p {
  max-width: 32ch;
  margin: 7px 0 0;
  font-size: 13px;
  line-height: 1.7;
}
.duo-checkout {
  min-width: 0;
  padding: 28px 24px 20px;
  border-left: 1px solid var(--seller-border);
  background: var(--seller-surface-muted);
}
.duo-checkout-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  font-weight: 650;
}
.duo-checkout-heading span + span {
  color: var(--seller-muted);
  font-size: 12px;
  font-weight: 400;
}
.duo-checkout-product {
  min-height: 24px;
  margin: 24px 0 10px;
  font-size: 14px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.duo-price {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 24px;
}
.duo-price strong {
  font-size: 40px;
  line-height: 1.25;
  font-weight: 600;
  letter-spacing: -0.05em;
  font-variant-numeric: tabular-nums;
}
.duo-price > span {
  color: var(--seller-muted);
  font-size: 13px;
}
.duo-checkout-facts {
  display: grid;
  gap: 12px;
  padding-bottom: 20px;
  margin: 0;
  border-bottom: 1px solid var(--seller-border);
  font-size: 13px;
}
.duo-checkout-facts > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
}
.duo-checkout-facts dt {
  color: var(--seller-muted);
}
.duo-checkout-facts dd {
  margin: 0;
  font-weight: 600;
}
.duo-checkout-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 18px 0;
  color: var(--seller-muted);
  font-size: 12px;
  line-height: 1.8;
}
.duo-checkout-note svg {
  flex-shrink: 0;
  margin-top: 3px;
  color: var(--seller-jade-strong);
}
.duo-accept {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 44px;
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.7;
  cursor: pointer;
}
.duo-accept input {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--seller-jade-strong);
}
.duo-submit-reason {
  margin: 10px 0 0;
  color: var(--seller-muted);
  font-size: 12px;
  line-height: 1.7;
  text-align: center;
}
.duo-rules {
  grid-column: 1 / -1;
  padding: 0 28px;
  border-top: 1px solid var(--seller-border);
}
.duo-rules summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 56px;
  cursor: pointer;
  list-style: none;
  font-size: 13px;
  font-weight: 600;
}
.duo-rules summary::-webkit-details-marker {
  display: none;
}
.duo-rules summary > span {
  display: flex;
  align-items: center;
  gap: 8px;
}
.duo-rules summary svg {
  color: var(--seller-muted);
}
.duo-rules[open] summary > svg {
  transform: rotate(180deg);
}
.duo-rules ul {
  max-width: 100ch;
  margin: 0 0 22px;
  padding-left: 20px;
  color: var(--seller-muted);
  font-size: 13px;
  line-height: 1.9;
}
.duo-rules li + li {
  margin-top: 5px;
}
.duo-progress-section,
.duo-orders-section {
  min-width: 0;
}
.duo-count {
  padding-top: 3px;
  color: var(--seller-muted);
  font-size: 12px;
  white-space: nowrap;
}
.duo-empty {
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 38px 20px;
  border: 1px solid var(--seller-border);
  border-radius: 14px;
  background: var(--seller-surface);
  text-align: center;
}
.duo-empty-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 17px;
  border: 1px solid var(--seller-border);
  border-radius: 16px;
  color: var(--seller-jade-strong);
  background: var(--seller-surface-soft);
}
.duo-empty h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.duo-empty p {
  max-width: 44ch;
  margin: 9px 0 0;
  color: var(--seller-muted);
  font-size: 13px;
  line-height: 1.8;
}
.duo-empty a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 44px;
  margin-top: 12px;
  color: var(--seller-jade-strong);
  font-size: 13px;
  font-weight: 600;
}
.duo-empty.compact {
  padding: 20px;
  border: 0;
}
.duo-campaigns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
  gap: 18px;
}
.duo-campaign {
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--seller-border);
  border-radius: 14px;
  background: var(--seller-surface);
  box-shadow: var(--seller-shadow-sm);
}
.duo-campaign-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.duo-campaign-heading > div {
  min-width: 0;
}
.duo-campaign-heading h3 {
  margin: 4px 0 0;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.duo-delivery-number {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 7px;
  margin: 26px 0 12px;
  font-variant-numeric: tabular-nums;
}
.duo-delivery-number > strong {
  font-size: 34px;
  font-weight: 600;
  letter-spacing: -0.04em;
}
.duo-delivery-number > span {
  color: var(--seller-muted);
  font-size: 12px;
}
.duo-delivery-number b {
  margin-left: auto;
  font-size: 13px;
  font-weight: 600;
  color: var(--seller-jade-strong);
}
progress {
  display: block;
  width: 100%;
  height: 6px;
  border: 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--seller-surface-soft);
  accent-color: var(--seller-jade);
}
progress::-webkit-progress-bar {
  background: var(--seller-surface-soft);
  border-radius: 8px;
}
progress::-webkit-progress-value {
  background: var(--seller-jade);
  border-radius: 8px;
}
progress::-moz-progress-bar {
  background: var(--seller-jade);
  border-radius: 8px;
}
.duo-campaign-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 24px 0;
}
.duo-campaign-stats > div {
  display: grid;
  gap: 8px;
}
.duo-campaign-stats span {
  color: var(--seller-muted);
  font-size: 12px;
}
.duo-campaign-stats strong {
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.duo-campaign-stats small {
  margin-left: 4px;
  color: var(--seller-muted);
  font-size: 12px;
  font-weight: 400;
}
.duo-muted {
  color: var(--seller-muted);
  font-size: 12px;
  line-height: 1.75;
}
.duo-schedule {
  margin: 8px 0;
}
.duo-extension {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--seller-warning);
}
.duo-extension svg {
  flex-shrink: 0;
}
.duo-pause-reason {
  margin: 8px 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--seller-warning);
}
.duo-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.duo-campaign .duo-actions {
  justify-content: flex-end;
  margin: 20px -4px -4px;
  padding-top: 16px;
  border-top: 1px solid var(--seller-border);
}
.duo-campaign .duo-actions > :first-child {
  margin-right: auto;
}
.duo-detail {
  margin-top: 20px;
  padding: 24px;
  border: 1px solid var(--seller-border);
  border-radius: 12px;
  background: var(--seller-surface);
}
.duo-detail-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 13px 0;
  border-top: 1px solid var(--seller-border);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.duo-detail-row > span + span {
  color: var(--seller-muted);
}
.duo-orders-section {
  padding: 24px 28px;
  border: 1px solid var(--seller-border);
  border-radius: 14px;
  background: var(--seller-surface);
}
.duo-orders-section .duo-section-heading {
  margin-bottom: 12px;
}
.duo-orders-empty {
  padding: 18px 0 4px;
  margin: 0;
  color: var(--seller-muted);
  font-size: 13px;
  line-height: 1.7;
}
.duo-order {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  padding: 20px 0;
  border-top: 1px solid var(--seller-border);
}
.duo-order-copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.duo-order-copy > strong {
  font-size: 14px;
  font-weight: 600;
}
.duo-order-copy > span {
  font-size: 12px;
  line-height: 1.6;
  color: var(--seller-muted);
  overflow-wrap: anywhere;
}
.duo-order-copy .duo-order-no {
  font-family: var(--font-mono);
  font-size: 11px;
}
.duo-order-payment {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 8px;
}
.duo-order-payment > strong {
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.duo-order-payment small {
  color: var(--seller-muted);
  font-size: 12px;
  font-weight: 400;
}
.duo-order > .duo-actions {
  grid-column: 1 / -1;
}
.duo-pay {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--seller-border-strong);
  border-radius: 8px;
  color: var(--seller-ink);
  font-size: 13px;
  font-weight: 600;
}
.duo-pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 18px;
  font-size: 12px;
  color: var(--seller-muted);
}
.duo-footnote {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 6px;
  margin: -8px 0 4px;
  color: var(--seller-muted);
  font-size: 12px;
  line-height: 1.8;
}
.duo-footnote svg {
  flex-shrink: 0;
  margin-top: 3px;
}
.duo-rules-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 44px;
  padding: 0;
  border: 0;
  color: var(--seller-jade-strong);
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.duo-page :is(select, input, a, summary, button):focus-visible {
  outline: 3px solid var(--seller-jade-strong);
  outline-offset: 3px;
}
@media (max-width: 1100px) {
  .duo-purchase {
    grid-template-columns: minmax(0, 1fr) 270px;
  }
  .duo-setup {
    padding: 24px;
  }
  .duo-checkout {
    padding: 24px 20px 20px;
  }
}
@media (max-width: 900px) {
  .duo-purchase {
    grid-template-columns: 1fr;
  }
  .duo-checkout {
    border-top: 1px solid var(--seller-border);
    border-left: 0;
  }
  .duo-price {
    margin-bottom: 18px;
  }
  .duo-checkout-product {
    margin-top: 16px;
  }
  .duo-checkout-facts {
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .duo-checkout-facts > div {
    display: grid;
    gap: 8px;
  }
  .duo-heading {
    flex-direction: column;
    gap: 16px;
  }
  .duo-heading > .seller-btn {
    align-self: flex-start;
  }
}
@media (max-width: 480px) {
  .duo-page {
    gap: 24px;
  }
  .duo-heading h2 {
    font-size: 23px;
    gap: 8px;
  }
  .duo-description {
    font-size: 13px;
  }
  .duo-availability {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 10px;
    padding: 16px;
  }
  .duo-availability .duo-icon-tile {
    display: none;
  }
  .duo-availability > div {
    flex-basis: 100%;
  }
  .duo-availability > .seller-status-badge {
    min-height: 26px;
    padding: 4px 9px;
  }
  .duo-setup,
  .duo-checkout,
  .duo-orders-section,
  .duo-detail,
  .duo-campaign {
    padding: 20px;
  }
  .duo-rules {
    padding: 0 20px;
  }
  .duo-section-heading {
    gap: 10px;
  }
  .duo-section-heading h2 {
    font-size: 17px;
  }
  .duo-package-empty {
    align-items: flex-start;
    gap: 12px;
    padding: 18px;
  }
  .duo-packages {
    grid-template-columns: 1fr;
  }
  .duo-package-copy {
    grid-template-columns: 1fr;
    gap: 9px;
  }
  .duo-order {
    grid-template-columns: 1fr;
  }
  .duo-order-payment {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
  .duo-campaign-heading {
    flex-wrap: wrap;
  }
  .duo-campaign-stats {
    gap: 8px;
  }
  .duo-empty {
    padding: 30px 20px;
  }
  .duo-count {
    font-size: 11px;
  }
  .duo-footnote {
    justify-content: flex-start;
  }
}
</style>
