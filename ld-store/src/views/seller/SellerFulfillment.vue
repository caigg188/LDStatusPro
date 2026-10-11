<template>
  <div class="seller-fulfillment-page">
    <div v-if="loading && !loaded" class="fulfillment-loading" aria-live="polite" aria-label="正在加载发货与履约状态">
      <div class="skeleton hero-skeleton"></div>
      <div class="skeleton rule-skeleton"></div>
    </div>

    <section v-else-if="!loaded || !policy || !status" class="fulfillment-load-error" role="alert">
      <CircleAlert :size="28" aria-hidden="true" />
      <h2>暂时无法核对发货规则</h2>
      <p>{{ error || '请检查网络连接后重试。' }}</p>
      <button type="button" :disabled="loading" @click="retry">
        <RefreshCw :size="16" aria-hidden="true" />
        {{ loading ? '正在加载…' : '重新加载' }}
      </button>
    </section>

    <template v-else>
      <section v-if="error && versionsAligned" class="status-refresh-error" role="status">
        <AlertTriangle :size="18" aria-hidden="true" />
        <p>当前展示上次成功读取的履约状态：{{ error }}</p>
        <button type="button" :disabled="loading" @click="retry">{{ loading ? '正在核对…' : '重新核对' }}</button>
      </section>

      <section class="fulfillment-hero" :class="heroTone" aria-labelledby="fulfillment-page-title">
        <div class="hero-mark" aria-hidden="true">
          <CirclePause v-if="!policy.enabled" :size="22" />
          <ShieldAlert v-else-if="needsAcknowledgement" :size="22" />
          <ShieldCheck v-else :size="22" />
        </div>
        <div class="hero-copy">
          <h2 id="fulfillment-page-title">{{ heroTitle }}</h2>
          <p>{{ heroDescription }}</p>
          <div class="hero-badges" aria-label="当前履约状态">
            <SellerStatusBadge
              :tone="!policy.enabled ? 'neutral' : needsAcknowledgement ? 'warning' : 'success'"
              :label="!policy.enabled ? '规则未启用' : needsAcknowledgement ? '规则待确认' : '规则已确认'"
            />
            <SellerStatusBadge v-if="status.activeRestriction" tone="danger" label="新增交易受限" />
          </div>
        </div>
        <router-link class="hero-order-link" to="/seller/orders?source=product&status=paid">
          处理待发货订单
          <ArrowUpRight :size="16" aria-hidden="true" />
        </router-link>
      </section>

      <section v-if="status.activeRestriction" class="restriction-card" role="alert">
        <Ban :size="21" aria-hidden="true" />
        <div>
          <strong>新增交易受限至 {{ formatDate(status.activeRestriction.endsAt) }}（北京时间）</strong>
          <p>已有订单仍可交付及处理售后。确认规则不会解除本次限制，到期后物品也不会自动重新上架。</p>
        </div>
        <router-link :to="status.supportUrl">联系平台 / 申诉</router-link>
      </section>

      <section class="rule-card" aria-labelledby="rule-card-title">
        <header class="section-heading">
          <div>
            <p>发货时限</p>
            <h2 id="rule-card-title">{{ needsAcknowledgement ? '确认之前，先看清三个节点' : '当前发货时限' }}</h2>
          </div>
          <router-link :to="policy.ruleUrl">查看完整规则 <ArrowUpRight :size="15" aria-hidden="true" /></router-link>
        </header>

        <ol v-if="needsAcknowledgement || !policy.enabled" class="rule-timeline">
          <li>
            <span class="timeline-marker">{{ policy.offlineHours }}</span>
            <div><strong>{{ policy.offlineHours }} 小时未发货</strong><p>系统自动下架对应物品，已付款订单仍保留处理入口。</p></div>
          </li>
          <li>
            <span class="timeline-marker">{{ policy.deliveryHours }}</span>
            <div><strong>{{ policy.deliveryHours }} 小时未发货</strong><p>系统自动发起原订单实付全额退款；实际到账以退款结果为准。</p></div>
          </li>
          <li>
            <span class="timeline-marker">{{ policy.strikeThreshold }}</span>
            <div><strong>{{ policy.strikeWindowDays }} 天内 {{ policy.strikeThreshold }} 笔有效超时退款</strong><p>限制新增交易 {{ restrictionDays }} 天；已有订单的履约与售后入口继续开放。</p></div>
          </li>
        </ol>
        <details v-else class="rule-details">
          <summary>查看 48 / 72 小时与限制节点</summary>
          <ol class="rule-timeline">
            <li>
              <span class="timeline-marker">{{ policy.offlineHours }}</span>
              <div><strong>{{ policy.offlineHours }} 小时未发货</strong><p>系统自动下架对应物品，已付款订单仍保留处理入口。</p></div>
            </li>
            <li>
              <span class="timeline-marker">{{ policy.deliveryHours }}</span>
              <div><strong>{{ policy.deliveryHours }} 小时未发货</strong><p>系统自动发起原订单实付全额退款；实际到账以退款结果为准。</p></div>
            </li>
            <li>
              <span class="timeline-marker">{{ policy.strikeThreshold }}</span>
              <div><strong>{{ policy.strikeWindowDays }} 天内 {{ policy.strikeThreshold }} 笔有效超时退款</strong><p>限制新增交易 {{ restrictionDays }} 天；已有订单的履约与售后入口继续开放。</p></div>
            </li>
          </ol>
        </details>

        <form v-if="policy.enabled && needsAcknowledgement" class="confirmation-form" :aria-busy="acknowledging" @submit.prevent="confirmRules">
          <label class="confirmation-check">
            <input v-model="checked" type="checkbox" :disabled="acknowledging || !versionsAligned" />
            <span>我已阅读并接受发货时限、自动发起全额退款及卖家限制规则</span>
          </label>
          <p class="confirmation-help">确认按当前账号和规则版本保存；规则更新后需要重新确认。</p>
          <p v-if="error" class="confirmation-error" role="alert">{{ error }}</p>
          <button
            v-if="!versionsAligned"
            type="button"
            class="confirmation-retry"
            :disabled="loading"
            @click="retry"
          >
            <RefreshCw :size="17" aria-hidden="true" />
            {{ loading ? '正在加载…' : '重新加载当前规则' }}
          </button>
          <button v-else type="submit" :disabled="!checked || acknowledging">
            <CheckCircle2 :size="17" aria-hidden="true" />
            {{ acknowledging ? '正在确认…' : '我已阅读并确认' }}
          </button>
        </form>

        <div
          v-else-if="policy.enabled"
          ref="confirmationResult"
          class="confirmation-complete"
          role="status"
          aria-live="polite"
          tabindex="-1"
        >
          <CheckCircle2 :size="21" aria-hidden="true" />
          <div><strong>当前版本已经确认</strong><p>{{ confirmationMessage || '普通物品可以正常发布和成交；若仍受其他限制，以页面对应状态为准。' }}</p></div>
        </div>

        <div v-else class="confirmation-complete is-neutral" role="status">
          <CirclePause :size="21" aria-hidden="true" />
          <div><strong>发货时限规则暂未启用</strong><p>当前无需确认，启用新版本后这里会展示明确待办。</p></div>
        </div>
      </section>

      <section class="fulfillment-overview" aria-label="我的履约概况">
        <article>
          <span>最近 {{ status.windowDays }} 天</span>
          <strong>{{ status.validCount }}<small>/{{ status.threshold }} 笔</small></strong>
          <p>有效超时退款记录</p>
        </article>
        <article>
          <span>发货期限</span>
          <strong>{{ policy.deliveryHours }}<small> 小时</small></strong>
          <p>从订单支付成功起连续计算</p>
        </article>
        <article>
          <span>达到阈值后</span>
          <strong>{{ restrictionDays }}<small> 天</small></strong>
          <p>限制新增交易，不影响已有订单</p>
        </article>
      </section>

      <section class="history-card" aria-labelledby="history-title">
        <header class="section-heading history-heading">
          <div>
            <p>可核对、可申诉</p>
            <h2 id="history-title">履约记录</h2>
          </div>
          <span>{{ status.history.length }} 条</span>
        </header>

        <div v-if="status.history.length" class="history-table-wrap">
          <table class="history-table">
            <thead><tr><th scope="col">订单</th><th scope="col">发生时间</th><th scope="col">记录状态</th><th scope="col">说明</th><th scope="col"><span class="sr-only">操作</span></th></tr></thead>
            <tbody>
              <tr v-for="record in status.history" :key="record.id">
                <td data-label="订单"><strong>{{ record.orderNo }}</strong></td>
                <td data-label="发生时间">{{ formatDate(record.occurredAt) }}</td>
                <td data-label="记录状态"><SellerStatusBadge :tone="recordMeta(record).tone" :label="recordMeta(record).label" /></td>
                <td data-label="说明">{{ record.revokeReason || recordMeta(record).description }}</td>
                <td data-label="操作"><router-link :to="`/seller/orders/${encodeURIComponent(record.orderNo)}?source=product`">查看订单</router-link></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="history-empty">
          <ClipboardCheck :size="28" aria-hidden="true" />
          <strong>暂无超时履约记录</strong>
          <p>保持及时发货；有记录时会在这里显示关联订单、计次状态和申诉结果。</p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  ArrowUpRight,
  Ban,
  CheckCircle2,
  CircleAlert,
  CirclePause,
  ClipboardCheck,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck
} from '@lucide/vue'
import type { SellerFulfillment } from '@/contracts/fulfillment'
import { formatDateTime } from '@/utils/format'
import SellerStatusBadge from '@/components/seller/SellerStatusBadge.vue'
import { useSellerFulfillmentStore } from '@/stores/sellerFulfillment'

type FulfillmentRecord = SellerFulfillment['history'][number]

const fulfillmentStore = useSellerFulfillmentStore()
const { policy, status, loading, loaded, acknowledging, error, needsAcknowledgement, versionsAligned } = storeToRefs(fulfillmentStore)
const checked = ref(false)
const confirmationMessage = ref('')
const confirmationResult = ref<HTMLElement | null>(null)

const restrictionDays = computed(() => Math.max(1, Number(policy.value?.restrictionHours || 0) / 24))
const heroTone = computed(() => ({
  'is-warning': policy.value?.enabled && needsAcknowledgement.value,
  'is-success': policy.value?.enabled && !needsAcknowledgement.value,
  'is-neutral': !policy.value?.enabled,
  'is-restricted': Boolean(status.value?.activeRestriction)
}))
const heroTitle = computed(() => !policy.value?.enabled
  ? '发货规则暂未启用，履约记录仍可核对'
  : needsAcknowledgement.value
    ? '完成规则确认，让普通物品恢复成交'
    : '发货规则已确认，履约状态可随时核对')
const heroDescription = computed(() => !policy.value?.enabled
  ? '当前无需确认；规则启用或版本更新后，这里会显示新的明确待办。'
  : needsAcknowledgement.value
    ? '确认前，普通物品无法发布，买家也无法创建订单。读完规则并明确确认后立即生效。'
    : '当前账号已经确认最新规则。请继续优先处理临近截止的订单，并在无法交付时主动退款。')

watch(() => policy.value?.version, () => {
  checked.value = false
  confirmationMessage.value = ''
})

function formatDate(value: string) {
  return formatDateTime(value) || '-'
}

function recordMeta(record: FulfillmentRecord) {
  if (record.revokedAt) return { label: '已撤销', tone: 'success', description: '平台核实后已撤销，不再计入处罚。' }
  if (record.exemptReason) return { label: '不计次', tone: 'neutral', description: '属于旧处罚周期，不重复计入当前阈值。' }
  if (record.penaltyId) return { label: '已用于本轮限制', tone: 'danger', description: '该记录已纳入一次新增交易限制。' }
  return { label: '有效记录', tone: 'warning', description: '当前计入最近 30 天有效超时记录。' }
}

async function confirmRules() {
  if (!checked.value || acknowledging.value) return
  confirmationMessage.value = ''
  const confirmed = await fulfillmentStore.acknowledgeCurrent()
  if (!confirmed) return
  checked.value = false
  confirmationMessage.value = status.value?.activeRestriction
    ? '规则已确认；当前交易限制仍按原截止时间执行。'
    : '规则已确认，普通物品交易已经恢复。'
  await nextTick()
  confirmationResult.value?.focus({ preventScroll: true })
}

function retry() {
  void fulfillmentStore.refresh({ force: true })
}

onMounted(() => { void fulfillmentStore.refresh() })
</script>

<style scoped>
.seller-fulfillment-page { min-width: 0; display: grid; gap: 20px; color: var(--seller-ink); }
.fulfillment-hero,
.rule-card,
.history-card,
.fulfillment-overview article,
.fulfillment-load-error { border: 1px solid var(--seller-border); border-radius: 14px; background: var(--seller-surface); box-shadow: var(--seller-shadow-sm); }
.fulfillment-hero { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 14px; min-height: 0; padding: 18px 20px; overflow: hidden; }
.fulfillment-hero::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--seller-jade); }
.fulfillment-hero.is-warning::before { background: var(--seller-warning); }
.fulfillment-hero.is-neutral::before { background: var(--seller-border-strong); }
.fulfillment-hero.is-restricted::after { content: ''; position: absolute; inset: 0 0 auto; height: 3px; background: var(--seller-danger); }
.hero-mark { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 10px; color: var(--seller-jade-strong); background: var(--seller-jade-soft); }
.is-warning .hero-mark { color: var(--seller-warning); background: color-mix(in srgb, var(--seller-warning) 10%, var(--seller-surface)); }
.is-neutral .hero-mark { color: var(--seller-muted); background: var(--seller-surface-soft); }
.hero-copy { min-width: 0; }
.eyebrow,
.section-heading > div > p { margin: 0 0 7px; color: var(--seller-jade); font-size: 11px; font-weight: 750; letter-spacing: .14em; }
.fulfillment-hero.is-warning .eyebrow { color: var(--seller-warning); }
.hero-copy h2,
.section-heading h2,
.fulfillment-load-error h2 { margin: 0; font: 600 18px/1.35 var(--font-sans); text-wrap: balance; }
.hero-copy > p:not(.eyebrow) { max-width: 720px; margin: 9px 0 0; color: var(--seller-muted); font-size: 14px; line-height: 1.75; }
.hero-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.hero-order-link,
.restriction-card a,
.section-heading a,
.history-table a { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; color: var(--seller-jade-strong); font-size: 13px; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.hero-order-link { padding: 0 15px; border: 1px solid var(--seller-border); border-radius: 10px; background: var(--seller-surface-strong); text-decoration: none; }
.hero-order-link:hover { border-color: var(--seller-jade); }

.restriction-card { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 16px 18px; border: 1px solid color-mix(in srgb, var(--seller-danger) 48%, var(--seller-border)); border-radius: 12px; color: var(--seller-danger); background: color-mix(in srgb, var(--seller-danger) 9%, var(--seller-surface)); }
.restriction-card strong { color: var(--seller-ink); font-size: 14px; }
.restriction-card p { margin: 4px 0 0; color: var(--seller-muted); font-size: 13px; line-height: 1.6; }
.restriction-card a { color: var(--seller-danger); }
.status-refresh-error { min-height: 52px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid color-mix(in srgb, var(--seller-warning) 42%, var(--seller-border)); border-radius: 11px; color: var(--seller-warning); background: color-mix(in srgb, var(--seller-warning) 8%, var(--seller-surface)); }
.status-refresh-error p { margin: 0; color: var(--seller-muted); font-size: 13px; line-height: 1.55; }
.status-refresh-error button { min-height: 44px; padding: 0 12px; border: 1px solid var(--seller-border-strong); border-radius: 9px; color: var(--seller-ink); background: var(--seller-surface); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.status-refresh-error button:disabled { opacity: .55; cursor: not-allowed; }

.rule-card { padding: 20px; }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.section-heading h2 { font-size: 16px; }
.rule-details { margin-top: 16px; }
.rule-details summary { min-height: 44px; display: flex; align-items: center; color: var(--seller-jade-strong); font-size: 13px; font-weight: 650; cursor: pointer; }
.rule-details[open] summary { margin-bottom: 8px; }
.rule-timeline { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; margin: 22px 0 0; padding: 0; overflow: hidden; border: 1px solid var(--seller-border); border-radius: 12px; background: var(--seller-border); list-style: none; }
.rule-timeline li { min-width: 0; display: grid; grid-template-columns: 46px minmax(0, 1fr); align-content: start; gap: 12px; padding: 18px; background: var(--seller-surface-strong); }
.timeline-marker { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; color: var(--seller-jade-strong); background: var(--seller-jade-soft); font: 750 15px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.rule-timeline strong { display: block; margin-top: 2px; font-size: 14px; line-height: 1.5; }
.rule-timeline p { margin: 6px 0 0; color: var(--seller-muted); font-size: 12px; line-height: 1.65; }
.confirmation-form,
.confirmation-complete { margin-top: 20px; padding: 18px; border: 1px solid color-mix(in srgb, var(--seller-warning) 44%, var(--seller-border)); border-radius: 12px; background: color-mix(in srgb, var(--seller-warning) 8%, var(--seller-surface)); }
.confirmation-check { min-height: 44px; display: flex; align-items: flex-start; gap: 11px; color: var(--seller-ink); font-size: 14px; font-weight: 650; line-height: 1.65; cursor: pointer; }
.confirmation-check input { width: 19px; height: 19px; flex: 0 0 auto; margin-top: 2px; accent-color: var(--seller-jade-strong); }
.confirmation-help,
.confirmation-error { margin: 8px 0 0 30px; color: var(--seller-muted); font-size: 12px; line-height: 1.55; }
.confirmation-error { color: var(--seller-warning); }
.confirmation-form button,
.fulfillment-load-error button { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; margin: 15px 0 0 30px; padding: 0 17px; border: 1px solid var(--seller-navy); border-radius: 10px; color: var(--seller-on-navy); background: var(--seller-navy); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.confirmation-form .confirmation-retry { border-color: var(--seller-border-strong); color: var(--seller-ink); background: var(--seller-surface); }
.confirmation-form button:disabled,
.fulfillment-load-error button:disabled { opacity: .55; cursor: not-allowed; }
html.dark .confirmation-form button,
html.dark .fulfillment-load-error button { border-color: var(--seller-jade); color: var(--palette-hex-0d151d); background: var(--seller-jade); }
html.dark .confirmation-form .confirmation-retry { border-color: var(--seller-border-strong); color: var(--seller-ink); background: var(--seller-surface); }
.confirmation-complete { display: flex; align-items: flex-start; gap: 11px; border-color: color-mix(in srgb, var(--seller-jade) 44%, var(--seller-border)); color: var(--seller-jade-strong); background: var(--seller-jade-soft); outline: none; }
.confirmation-complete.is-neutral { border-color: var(--seller-border); color: var(--seller-muted); background: var(--seller-surface-soft); }
.confirmation-complete strong { display: block; color: var(--seller-ink); font-size: 14px; }
.confirmation-complete p { margin: 3px 0 0; color: var(--seller-muted); font-size: 13px; line-height: 1.6; }

.fulfillment-overview { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.fulfillment-overview article { min-width: 0; padding: 19px 20px; }
.fulfillment-overview article > span { color: var(--seller-muted); font-size: 12px; }
.fulfillment-overview strong { display: block; margin: 14px 0 9px; font: 700 30px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.fulfillment-overview strong small { color: var(--seller-muted); font: 500 12px/1 system-ui, sans-serif; }
.fulfillment-overview p { margin: 0; color: var(--seller-muted); font-size: 12px; line-height: 1.5; }

.history-card { min-width: 0; overflow: hidden; }
.history-heading { padding: 22px 24px 13px; }
.history-heading > span { color: var(--seller-muted); font: 650 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.history-table-wrap { max-width: 100%; min-width: 0; padding: 0 16px 18px; overflow-x: auto; }
.history-table { width: 100%; min-width: 820px; border-collapse: collapse; }
.history-table th { position: relative; padding: 10px; color: var(--seller-muted); font-size: 11px; font-weight: 650; text-align: left; }
.history-table td { padding: 12px 10px; border-top: 1px solid var(--seller-border); color: var(--seller-muted); font-size: 12px; line-height: 1.55; vertical-align: middle; }
.history-table td strong { color: var(--seller-ink); font: 650 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
.history-empty { min-height: 190px; display: grid; place-items: center; align-content: center; gap: 7px; padding: 28px; color: var(--seller-muted); text-align: center; }
.history-empty svg { color: var(--seller-jade); }
.history-empty strong { color: var(--seller-ink); font-size: 14px; }
.history-empty p { max-width: 440px; margin: 0; font-size: 12px; line-height: 1.6; }

.fulfillment-load-error { min-height: 360px; display: grid; place-items: center; align-content: center; gap: 10px; padding: 30px; color: var(--seller-muted); text-align: center; }
.fulfillment-load-error svg { color: var(--seller-warning); }
.fulfillment-load-error h2 { color: var(--seller-ink); font-size: 23px; }
.fulfillment-load-error p { margin: 0; font-size: 13px; }
.fulfillment-load-error button { margin-left: 0; }
.fulfillment-loading { display: grid; gap: 16px; }
.skeleton { border-radius: 14px; background: linear-gradient(90deg, var(--seller-surface-soft), var(--seller-surface), var(--seller-surface-soft)); background-size: 200% 100%; animation: skeleton-move 1.4s ease infinite; }
.hero-skeleton { height: 168px; }
.rule-skeleton { height: 390px; }
.sr-only { position: absolute; top: 0; left: 0; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); clip-path: inset(50%); white-space: nowrap; border: 0; }

button:focus-visible,
a:focus-visible,
input:focus-visible { outline: 3px solid var(--seller-jade-strong); outline-offset: 3px; }
@keyframes skeleton-move { to { background-position: -200% 0; } }

@media (max-width: 900px) {
  .fulfillment-hero { grid-template-columns: auto minmax(0, 1fr); }
  .hero-order-link { grid-column: 2; justify-self: start; }
  .rule-timeline { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .seller-fulfillment-page { gap: 16px; }
  .fulfillment-hero { grid-template-columns: minmax(0, 1fr); gap: 14px; padding: 21px 18px 21px 25px; }
  .hero-mark { width: 44px; height: 44px; }
  .hero-order-link { grid-column: 1; width: 100%; }
  .restriction-card { grid-template-columns: auto minmax(0, 1fr); align-items: start; padding: 14px; }
  .restriction-card a { grid-column: 1 / -1; justify-content: flex-start; }
  .status-refresh-error { grid-template-columns: auto minmax(0, 1fr); }
  .status-refresh-error button { grid-column: 1 / -1; width: 100%; }
  .rule-card { padding: 18px 16px; }
  .section-heading { align-items: stretch; flex-direction: column; gap: 7px; }
  .section-heading a { align-self: flex-start; }
  .rule-timeline li { padding: 15px; }
  .confirmation-form,
  .confirmation-complete { padding: 15px; }
  .confirmation-help,
  .confirmation-error,
  .confirmation-form button { margin-left: 0; }
  .confirmation-form button { width: 100%; }
  .fulfillment-overview { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .fulfillment-overview article { padding: 16px; }
  .history-heading { padding: 18px 16px 11px; }
  .history-table-wrap { padding: 0 14px 16px; overflow: visible; }
  .history-table { min-width: 0; }
  .history-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
  .history-table tbody,
  .history-table tr,
  .history-table td { display: block; }
  .history-table tr { padding: 12px 0; border-top: 1px solid var(--seller-border); }
  .history-table td { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 8px; padding: 5px 0; border: 0; overflow-wrap: anywhere; }
  .history-table td::before { content: attr(data-label); color: var(--seller-muted); font-size: 11px; font-weight: 650; }
  .history-table a { min-height: 44px; justify-content: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}
</style>
