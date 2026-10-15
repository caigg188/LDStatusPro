<template>
  <section id="order-refund" :class="['refund-card', `is-${isBuyer ? 'buyer' : 'seller'}`]" aria-labelledby="refund-card-title">
    <header class="refund-card__header">
      <div>
        <p class="refund-card__eyebrow">订单保障</p>
        <h3 id="refund-card-title"><RotateCcw :size="18" aria-hidden="true" />退款与售后</h3>
      </div>
      <span class="refund-card__context">{{ isBuyer ? '买家售后' : '卖家处理' }}</span>
    </header>

    <div v-if="loading" class="refund-loading" role="status" aria-live="polite">
      <span class="refund-spinner" aria-hidden="true"></span>
      正在加载售后状态…
    </div>

    <div v-else-if="loadError" class="refund-error-state" role="alert">
      <CircleAlert :size="20" aria-hidden="true" />
      <div><strong>售后状态加载失败</strong><p>{{ loadError }}</p></div>
      <button type="button" @click="loadRefund">重试</button>
    </div>

    <template v-else-if="!refund">
      <div v-if="isBuyer" class="refund-preflight">
        <RefundRequestForm :available="canApplyRefund" :open="formOpen" :submitting="submitting">
        <div class="refund-preflight__intro">
          <ShieldQuestion :size="22" aria-hidden="true" />
          <div>
            <strong>建议优先联系卖家协商处理</strong>
            <p>你可以直接先私信卖家协商，也可以直接申请全额退款。</p>
          </div>
        </div>

        <div class="refund-preflight__steps" aria-label="退款售后处理方式">
          <article>
            <span><RotateCcw :size="16" aria-hidden="true" /></span>
            <div><strong>直接申请退款</strong><p>{{ refundState?.responsePolicyEnabled ? '卖家应在申请后 72 小时内作出决定；逾期未决定，系统自动同意并发起全额退款。' : '待卖家同意退款后，系统将按订单实付金额发起全额退款。' }}</p></div>
          </article>
          <article>
            <span><MessageCircleMore :size="16" aria-hidden="true" /></span>
            <div><strong>联系卖家</strong><p>通常联系卖家协商处理可以更快解决误会和问题。</p></div>
          </article>
        </div>

        <div class="refund-actions refund-actions--intro">
          <button
            type="button"
            class="refund-btn refund-btn--primary"
            :disabled="!canApplyRefund"
            :aria-expanded="canApplyRefund ? formOpen : false"
            aria-describedby="refund-action-availability"
            aria-controls="refund-request-form"
            @click="toggleForm"
          >
            <RotateCcw :size="17" aria-hidden="true" />{{ formOpen ? '收起申请表' : '申请退款' }}
          </button>
          <a
            v-if="counterpartyMessageUrl"
            :href="counterpartyMessageUrl"
            target="_blank"
            rel="noopener"
            class="refund-btn refund-btn--secondary"
          >
            <MessageCircleMore :size="17" aria-hidden="true" />私信卖家（可选）
          </a>
        </div>

        <p
          id="refund-action-availability"
          :class="['refund-availability', { 'is-available': canApplyRefund }]"
        >
          <CircleCheckBig v-if="canApplyRefund" :size="16" aria-hidden="true" />
          <Info v-else :size="16" aria-hidden="true" />
          {{ refundAvailabilityMessage }}
        </p>
        <p class="refund-field__help"><router-link to="/docs/refunds#application-window">了解 7 天申请窗口与后续售后</router-link>。申请入口不可用不等于所有售后责任终止。</p>

        <form v-if="formOpen" id="refund-request-form" class="refund-form" novalidate @submit.prevent="submitRefund">
          <div
            v-if="Object.keys(errors).length"
            ref="errorSummary"
            class="refund-form__errors"
            role="alert"
            tabindex="-1"
            aria-labelledby="refund-error-title"
          >
            <strong id="refund-error-title">请检查以下内容</strong>
            <ul>
              <li v-for="(message, field) in errors" :key="field">
                <a :href="`#refund-${field}`">{{ message }}</a>
              </li>
            </ul>
          </div>

          <div class="refund-form__amount">
            <div><span>原路全额退回</span><strong>{{ refundAmount.toFixed(2) }} LDC</strong></div>
            <small>金额由订单实付金额确定，不可手工修改。</small>
          </div>

          <div class="refund-field">
            <label for="refund-reasonCode">退款原因</label>
            <select
              id="refund-reasonCode"
              v-model="form.reasonCode"
              :aria-invalid="Boolean(errors.reasonCode)"
              :aria-describedby="errors.reasonCode ? 'refund-reason-error' : undefined"
              @blur="validateField('reasonCode')"
            >
              <option value="" disabled>请选择最接近的原因</option>
              <option v-for="option in REFUND_REASON_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <p v-if="errors.reasonCode" id="refund-reason-error" class="refund-field__error">{{ errors.reasonCode }}</p>
          </div>

          <div class="refund-field">
            <div class="refund-field__label-row">
              <label for="refund-reasonDetail">问题说明</label>
              <span>{{ form.reasonDetail.length }}/500</span>
            </div>
            <textarea
              id="refund-reasonDetail"
              v-model.trim="form.reasonDetail"
              rows="5"
              maxlength="500"
              placeholder="请说明发生了什么、已经如何与卖家沟通，以及你希望怎样处理。"
              :aria-invalid="Boolean(errors.reasonDetail)"
              :aria-describedby="errors.reasonDetail ? 'refund-detail-error refund-detail-help' : 'refund-detail-help'"
              @blur="validateField('reasonDetail')"
            ></textarea>
            <p id="refund-detail-help" class="refund-field__help">不要填写登录密码、完整卡密、Client Key 或其他隐私信息。</p>
            <p v-if="errors.reasonDetail" id="refund-detail-error" class="refund-field__error">{{ errors.reasonDetail }}</p>
          </div>

          <label class="refund-checkbox">
            <input v-model="form.buyerContactedSeller" type="checkbox" />
            <span>我已经尝试通过 LINUX DO 联系卖家</span>
          </label>

          <div class="refund-form__actions">
            <button type="button" class="refund-btn refund-btn--secondary" :disabled="submitting" @click="closeForm">取消</button>
            <button type="submit" class="refund-btn refund-btn--danger" :disabled="submitting">
              <LoaderCircle v-if="submitting" class="refund-spin-icon" :size="17" aria-hidden="true" />
              <RotateCcw v-else :size="17" aria-hidden="true" />
              {{ submitting ? '提交中…' : '提交退款申请' }}
            </button>
          </div>
        </form>
        </RefundRequestForm>
      </div>

      <div v-else class="refund-empty-state">
        <span><BadgeCheck :size="24" aria-hidden="true" /></span>
        <div><strong>当前没有退款申请</strong><p>买家提交申请后，你可以在这里查看理由、联系买家并作出处理。</p></div>
      </div>
    </template>

    <template v-else>
      <label v-if="['requested', 'negotiating', 'processing'].includes(refund.status)" class="refund-availability"><input v-model="autoRefreshPaused" type="checkbox" /> 暂停自动刷新退款状态</label>
      <RefundDeadlineNotice :refund="refund" :server-now="refundState?.serverNow" />
      <div class="refund-stage-shell">
        <RefundStageTracker :stages="stages" />
      </div>

      <div class="refund-workspace">
        <div class="refund-main-column">
          <div class="refund-current-area">
            <div :class="['refund-status-panel', `is-${statusMeta.tone}`]" role="status" aria-live="polite" aria-atomic="true">
              <span class="refund-status-panel__icon">
                <component :is="statusIcon" :class="{ 'refund-spin-icon': refund.status === 'processing' }" :size="22" aria-hidden="true" />
              </span>
              <div>
                <span class="refund-status-panel__label">当前状态</span>
                <strong>{{ statusMeta.label }}</strong>
                <p>{{ statusMeta.description }}</p>
              </div>
            </div>

            <div v-if="isBuyer && buyerGuidance" :class="['refund-next-step', `is-${buyerGuidance.tone}`]">
              <Info :size="19" aria-hidden="true" />
              <div><strong>{{ buyerGuidance.title }}</strong><p>{{ buyerGuidance.description }}</p></div>
            </div>

            <div v-if="refund.status === 'external_dispute'" class="refund-dispute">
              <ShieldAlert :size="22" aria-hidden="true" />
              <div>
                <strong>请到 Credit 核对实际处理结果</strong>
                <p>此状态表示原交易不再处于可退款的成功状态，或 Credit 明确返回交易不存在，本站已停止退款流程；不代表争议已受理、已通过或积分已退回。</p>
                <div class="refund-actions">
                  <a :href="disputeGuideUrl" target="_blank" rel="noopener" class="refund-btn refund-btn--primary">查看 Credit 争议指引<ExternalLink :size="15" aria-hidden="true" /></a>
                </div>
              </div>
            </div>

            <div v-if="isBuyer && refund.status === 'rejected'" class="refund-dispute">
              <ShieldQuestion :size="22" aria-hidden="true" />
              <div>
                <strong>协商仍无法解决？</strong>
                <p>可前往 LINUX DO Credit 发起争议。请准备业务单号、Credit 编号、双方沟通记录和相关履约证据。</p>
                <div class="refund-actions">
                  <a v-if="counterpartyMessageUrl" :href="counterpartyMessageUrl" target="_blank" rel="noopener" class="refund-btn refund-btn--secondary">再次私信卖家</a>
                  <router-link to="/docs/refunds#credit-dispute" class="refund-btn refund-btn--secondary">查看内部复核与争议路径</router-link>
                  <a :href="disputeGuideUrl" target="_blank" rel="noopener" class="refund-btn refund-btn--primary">查看 Credit 争议指引<ExternalLink :size="15" aria-hidden="true" /></a>
                </div>
              </div>
            </div>
          </div>

          <div class="refund-history-area">
            <RefundEventTimeline v-if="refund.events?.length" :events="refund.events" />
            <div v-else class="refund-no-events"><Clock3 :size="20" aria-hidden="true" /><p>暂无更多处理记录，当前状态以顶部展示为准。</p></div>
          </div>
        </div>

        <div class="refund-side-column">
          <section class="refund-summary-area" aria-labelledby="refund-summary-title">
          <header>
            <div><p>退款申请</p><h4 id="refund-summary-title">申请信息</h4></div>
            <span>{{ formatRefundDate(refund.requestedAt) }}</span>
          </header>

          <div class="refund-summary__amount">
            <span>全额退回</span>
            <strong>{{ Number(refund.refundAmount || 0).toFixed(2) }} <small>LDC</small></strong>
          </div>

          <dl>
            <div><dt>发起方式</dt><dd>{{ refundSourceLabel }}</dd></div>
            <div><dt>退款原因</dt><dd>{{ getRefundReasonLabel(refund.reasonCode) }}</dd></div>
            <div v-if="String(refund.source || 'buyer') === 'buyer'">
              <dt>联系记录</dt>
              <dd :class="['refund-contact-state', { 'is-confirmed': refund.buyerContactedSeller }]">
                {{ refund.buyerContactedSeller ? '买家表示已联系' : '未记录已联系' }}
              </dd>
            </div>
            <div class="wide"><dt>问题说明</dt><dd>{{ refund.reasonDetail }}</dd></div>
            <div v-if="refund.sellerResponse" class="wide refund-seller-response"><dt>{{ sellerResponseLabel }}</dt><dd>{{ refund.sellerResponse }}</dd></div>
          </dl>
          </section>

          <section v-if="!isBuyer && showSellerActions" class="refund-actions-area" aria-labelledby="refund-actions-title">
          <RefundNegotiationActions :status="String(refund.status || '')" :submitting="sellerSubmitting">
          <header>
            <p>下一步</p>
            <h4 id="refund-actions-title">处理退款申请</h4>
          </header>

          <div v-if="refund.lastErrorMessage" class="refund-seller-error" role="alert">
            <TriangleAlert :size="19" aria-hidden="true" />
            <div><strong>{{ refund.status === 'unknown' ? '先核对 Credit，切勿直接重试' : '上次退款没有完成' }}</strong><p>{{ refund.lastErrorMessage }}</p></div>
          </div>

          <div v-if="canSellerDecide" class="refund-approve-callout">
            <span>将原路全额退回</span>
            <strong>{{ Number(refund.refundAmount || 0).toFixed(2) }} LDC</strong>
            <small>退款成功后不可撤销，库存、优惠券和限购额度不会恢复。</small>
            <button type="button" class="refund-btn refund-btn--primary refund-btn--block" :disabled="sellerSubmitting" @click="approveRefund">
              <LoaderCircle v-if="sellerSubmitting" class="refund-spin-icon" :size="17" aria-hidden="true" />
              <CircleCheckBig v-else :size="17" aria-hidden="true" />
              {{ refund.status === 'failed' ? '重试退款' : '同意并退款' }}
            </button>
          </div>

          <div class="refund-actions refund-seller-actions">
            <a v-if="counterpartyMessageUrl" :href="counterpartyMessageUrl" target="_blank" rel="noopener" class="refund-btn refund-btn--secondary">
              <MessageCircleMore :size="17" aria-hidden="true" />私信买家
            </a>
            <button v-if="canSellerContact" type="button" class="refund-btn refund-btn--secondary" :aria-expanded="sellerActionMode === 'contact'" :disabled="sellerSubmitting" @click="openSellerAction('contact')">
              {{ contactActionLabel }}
            </button>
            <button v-if="canSellerReject" type="button" class="refund-btn refund-btn--outline-danger" :aria-expanded="sellerActionMode === 'reject'" :disabled="sellerSubmitting" @click="openSellerAction('reject')">
              拒绝申请
            </button>
            <router-link v-if="refund.status === 'unknown'" to="/support" class="refund-btn refund-btn--primary">联系平台核对</router-link>
          </div>

          <form v-if="sellerActionMode" class="refund-seller-form" @submit.prevent="submitSellerAction">
            <div class="refund-field__label-row">
              <label for="refund-seller-message">{{ sellerActionMode === 'reject' ? '拒绝理由（必填）' : '协商备注（可选）' }}</label>
              <span v-if="sellerActionMode === 'reject'">{{ sellerMessage.length }}/500</span>
            </div>
            <textarea
              id="refund-seller-message"
              ref="sellerMessageInput"
              v-model.trim="sellerMessage"
              rows="4"
              :required="sellerActionMode === 'reject'"
              :minlength="sellerActionMode === 'reject' ? 5 : undefined"
              maxlength="500"
              :placeholder="sellerActionMode === 'reject' ? '请向买家明确说明未同意退款的原因（至少 5 个字）' : '可记录已经沟通的内容和下一步约定'"
              :aria-invalid="Boolean(sellerActionError)"
              :aria-required="sellerActionMode === 'reject' ? 'true' : undefined"
              :aria-describedby="sellerActionMode === 'reject' ? (sellerActionError ? 'refund-seller-message-hint refund-seller-action-error' : 'refund-seller-message-hint') : (sellerActionError ? 'refund-seller-action-error' : undefined)"
              @blur="validateSellerActionField"
            ></textarea>
            <p v-if="sellerActionMode === 'reject'" id="refund-seller-message-hint" class="refund-field__help">请填写 5–500 字的具体依据；提交后买家可在订单详情和通知中查看。</p>
            <p v-if="sellerActionError" id="refund-seller-action-error" class="refund-field__error" role="alert">{{ sellerActionError }}</p>
            <div class="refund-form__actions">
              <button type="button" class="refund-btn refund-btn--secondary" :disabled="sellerSubmitting" @click="closeSellerAction">取消</button>
              <button type="submit" :class="['refund-btn', sellerActionMode === 'reject' ? 'refund-btn--danger' : 'refund-btn--primary']" :disabled="sellerSubmitting">
                {{ sellerSubmitting ? '处理中…' : (sellerActionMode === 'reject' ? '确认拒绝' : '保存协商记录') }}
              </button>
            </div>
          </form>
          </RefundNegotiationActions>
          </section>

          <section v-else-if="isBuyer && counterpartyMessageUrl && !['refunded', 'rejected', 'external_dispute'].includes(refund.status)" class="refund-actions-area refund-buyer-contact" aria-labelledby="refund-contact-title">
            <header><p>需要沟通？</p><h4 id="refund-contact-title">联系卖家</h4></header>
            <p>请在私信中说明业务单号和最新情况，并保留双方沟通记录。</p>
            <a :href="counterpartyMessageUrl" target="_blank" rel="noopener" class="refund-btn refund-btn--secondary refund-btn--block">
              <MessageCircleMore :size="17" aria-hidden="true" />私信卖家
            </a>
          </section>
        </div>
      </div>
    </template>
    <div v-if="!loading && !loadError && canProactivelyRefund" class="refund-actions">
      <button type="button" class="refund-btn refund-btn--danger" :disabled="sellerSubmitting" @click="proactivelyRefund">{{ sellerSubmitting ? '退款处理中…' : '无法履约，主动全额退款' }}</button>
      <p class="refund-availability">到期前主动退款成功不计超时；请先核对订单实付金额。</p>
    </div>
  </section>
</template>

<script setup lang="ts">
onMounted(() => { if (window.location.hash === '#order-refund') document.getElementById('order-refund')?.scrollIntoView({ block: 'start' }) })
import { computed, onMounted, toRef } from 'vue'
import RefundDeadlineNotice from './RefundDeadlineNotice.vue'
import {
  BadgeCheck,
  CircleAlert,
  CircleCheckBig,
  Clock3,
  ExternalLink,
  Info,
  LoaderCircle,
  MessageCircleMore,
  RotateCcw,
  ShieldAlert,
  ShieldQuestion,
  TriangleAlert
} from '@lucide/vue'
import RefundEventTimeline from '@/components/order/RefundEventTimeline.vue'
import RefundNegotiationActions from '@/components/order/RefundNegotiationActions.vue'
import RefundRequestForm from '@/components/order/RefundRequestForm.vue'
import RefundStageTracker from '@/components/order/RefundStageTracker.vue'
import { useOrderRefund } from '@/composables/orders/useOrderRefund'

const props = withDefaults(defineProps<{
  order: Record<string, unknown>
  role?: string
}>(), { role: 'buyer' })
const emit = defineEmits<{ updated: [] }>()
const {
  canProactivelyRefund,
  proactivelyRefund,
  loading,
  loadError,
  refund,
  refundState,
  autoRefreshPaused,
  formOpen,
  submitting,
  errors,
  errorSummary,
  sellerActionMode,
  sellerMessage,
  sellerActionError,
  sellerMessageInput,
  sellerSubmitting,
  form,
  isBuyer,
  canApplyRefund,
  refundAvailabilityMessage,
  disputeGuideUrl,
  statusMeta,
  stages,
  refundAmount,
  counterpartyMessageUrl,
  canSellerDecide,
  canSellerReject,
  canSellerContact,
  showSellerActions,
  contactActionLabel,
  refundSourceLabel,
  sellerResponseLabel,
  buyerGuidance,
  loadRefund,
  toggleForm,
  closeForm,
  validateField,
  submitRefund,
  openSellerAction,
  closeSellerAction,
  validateSellerActionField,
  submitSellerAction,
  approveRefund,
  REFUND_REASON_OPTIONS,
  formatRefundDate,
  getRefundReasonLabel
} = useOrderRefund({
  order: toRef(props, 'order'),
  role: toRef(props, 'role'),
  onUpdated: () => emit('updated')
})
const statusIcon = computed(() => {
  if (refund.value?.status === 'refunded') return CircleCheckBig
  if (refund.value?.status === 'external_dispute') return ShieldAlert
  if (['failed', 'unknown', 'rejected'].includes(String(refund.value?.status || ''))) return TriangleAlert
  if (refund.value?.status === 'processing') return LoaderCircle
  return Clock3
})

</script>

<style scoped>
.refund-card {
  --refund-radius: 14px;
  --refund-success: var(--status-success);
  --refund-info: var(--status-info);
  --refund-warning: var(--status-warning);
  --refund-danger: var(--status-danger);
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  container-type: inline-size;
  margin-bottom: 20px;
  padding: clamp(18px, 3vw, 26px);
  border: 1px solid var(--border-medium);
  border-radius: var(--refund-radius);
  background: var(--bg-card);
  box-shadow: var(--shadow-sm, 0 3px 14px var(--palette-rgba-31-42-52-p06));
}

.refund-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
}

.refund-card__eyebrow,
.refund-summary-area header p,
.refund-actions-area header p {
  margin: 0 0 4px;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: .09em;
}

.refund-card h3,
.refund-summary-area h4,
.refund-actions-area h4 {
  margin: 0;
  color: var(--text-primary);
  font-weight: 750;
}

.refund-card h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 19px;
}

.refund-card__context {
  padding: 5px 10px;
  border: 1px solid var(--border-light);
  border-radius: 999px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.refund-loading {
  min-height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 14px;
}

.refund-spinner {
  width: 20px;
  height: 20px;
  border: 3px solid var(--border-light);
  border-top-color: var(--color-primary-hover);
  border-radius: 50%;
  animation: refund-spin 800ms linear infinite;
}

.refund-error-state {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--color-danger-light);
  border-radius: 12px;
  color: var(--refund-danger);
  background: var(--color-danger-bg);
}

.refund-error-state p,
.refund-empty-state p,
.refund-preflight p,
.refund-next-step p,
.refund-dispute p,
.refund-buyer-contact > p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.65;
}

.refund-error-state button {
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid currentColor;
  border-radius: 10px;
  color: inherit;
  background: var(--bg-card);
  font-weight: 700;
  cursor: pointer;
}

.refund-preflight {
  display: grid;
  gap: 18px;
}

.refund-preflight__intro,
.refund-empty-state {
  display: flex;
  gap: 14px;
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--refund-info) 28%, var(--border-light));
  border-radius: 13px;
  background: color-mix(in srgb, var(--color-info-bg) 68%, var(--bg-card));
}

.refund-preflight__intro > svg { flex: 0 0 auto; color: var(--refund-info); }
.refund-preflight__intro strong,
.refund-empty-state strong { color: var(--text-primary); font-size: 15px; }

.refund-preflight__steps {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.refund-preflight__steps article {
  min-width: 0;
  display: flex;
  gap: 12px;
  padding: 15px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-secondary);
}

.refund-preflight__steps article > span,
.refund-empty-state > span {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--color-primary-hover);
  background: var(--color-primary-light);
  font-size: 13px;
  font-weight: 800;
}

.refund-preflight__steps strong { color: var(--text-primary); font-size: 14px; }
.refund-preflight__steps p { margin-top: 3px; }

.refund-empty-state {
  border-style: dashed;
  border-color: var(--border-medium);
  background: var(--bg-secondary);
}

.refund-stage-shell {
  margin-bottom: 22px;
  padding: 18px;
  border: 1px solid var(--border-light);
  border-radius: 13px;
  background: color-mix(in srgb, var(--bg-secondary) 72%, var(--bg-card));
}

.refund-workspace {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.refund-main-column,
.refund-side-column { display: contents; }
.refund-current-area { min-width: 0; display: grid; gap: 12px; order: 1; }
.refund-summary-area { order: 2; }
.refund-actions-area { order: 3; }
.refund-history-area { min-width: 0; order: 4; }

.refund-status-panel {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--border-light);
  border-left-width: 4px;
  border-radius: 13px;
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.refund-status-panel__icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  color: currentColor;
  background: color-mix(in srgb, currentColor 11%, var(--bg-card));
}

.refund-status-panel__label {
  display: block;
  margin-bottom: 2px;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 700;
}

.refund-status-panel strong { display: block; font-size: 17px; }
.refund-status-panel p { margin: 5px 0 0; color: var(--text-secondary); font-size: 13px; line-height: 1.65; }
.refund-status-panel.is-warning { border-left-color: var(--refund-warning); }
.refund-status-panel.is-warning .refund-status-panel__icon { color: var(--refund-warning); }
.refund-status-panel.is-info { border-left-color: var(--refund-info); }
.refund-status-panel.is-info .refund-status-panel__icon { color: var(--refund-info); }
.refund-status-panel.is-success { border-left-color: var(--refund-success); }
.refund-status-panel.is-success .refund-status-panel__icon { color: var(--refund-success); }
.refund-status-panel.is-danger { border-left-color: var(--refund-danger); }
.refund-status-panel.is-danger .refund-status-panel__icon { color: var(--refund-danger); }

.refund-next-step,
.refund-dispute {
  display: flex;
  gap: 12px;
  padding: 15px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-card);
}

.refund-next-step > svg,
.refund-dispute > svg { flex: 0 0 auto; margin-top: 1px; }
.refund-next-step.is-info > svg { color: var(--refund-info); }
.refund-next-step.is-warning > svg { color: var(--refund-warning); }
.refund-next-step.is-success > svg { color: var(--refund-success); }
.refund-next-step.is-danger > svg { color: var(--refund-danger); }
.refund-next-step strong,
.refund-dispute strong { color: var(--text-primary); font-size: 14px; }

.refund-dispute {
  border-color: color-mix(in srgb, var(--refund-warning) 32%, var(--border-light));
  background: color-mix(in srgb, var(--color-warning-bg) 65%, var(--bg-card));
}
.refund-dispute > svg { color: var(--refund-warning); }
.refund-dispute .refund-actions { margin-top: 13px; }

.refund-summary-area,
.refund-actions-area,
.refund-history-area {
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--border-light);
  border-radius: 13px;
  background: var(--bg-card);
}

.refund-summary-area > header,
.refund-actions-area > header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 15px;
}

.refund-summary-area h4,
.refund-actions-area h4 { font-size: 16px; }
.refund-summary-area > header > span { color: var(--text-tertiary); font-size: 11px; font-variant-numeric: tabular-nums; }

.refund-summary__amount {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  padding: 14px;
  border-radius: 11px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  font-size: 13px;
}

.refund-summary__amount strong { color: var(--text-primary); font-size: 22px; font-variant-numeric: tabular-nums; }
.refund-summary__amount small { font-size: 12px; }

.refund-summary-area dl { margin: 0; }
.refund-summary-area dl > div { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--border-light); }
.refund-summary-area dl > div:last-child { border-bottom: 0; padding-bottom: 0; }
.refund-summary-area dt { color: var(--text-tertiary); font-size: 12px; font-weight: 650; }
.refund-summary-area dd { min-width: 0; margin: 0; color: var(--text-primary); font-size: 13px; line-height: 1.65; overflow-wrap: anywhere; white-space: pre-wrap; }
.refund-summary-area .wide { grid-template-columns: 1fr; gap: 4px; }

.refund-contact-state { color: var(--text-secondary) !important; }
.refund-contact-state.is-confirmed { color: var(--refund-success) !important; font-weight: 700; }
.refund-seller-response { margin-top: 2px; padding: 12px !important; border: 1px solid var(--border-medium) !important; border-radius: 10px; background: var(--bg-secondary); }

.refund-actions-area { align-self: start; }
.refund-approve-callout { display: grid; gap: 6px; margin-bottom: 14px; padding: 14px; border: 1px solid color-mix(in srgb, var(--refund-success) 30%, var(--border-light)); border-radius: 11px; background: color-mix(in srgb, var(--color-success-bg) 60%, var(--bg-card)); }
.refund-approve-callout > span { color: var(--text-secondary); font-size: 12px; }
.refund-approve-callout > strong { color: var(--text-primary); font-size: 21px; font-variant-numeric: tabular-nums; }
.refund-approve-callout > small { margin-bottom: 7px; color: var(--text-secondary); font-size: 12px; line-height: 1.55; }

.refund-seller-error { display: flex; gap: 10px; margin-bottom: 14px; padding: 13px; border: 1px solid var(--color-danger-light); border-radius: 10px; color: var(--refund-danger); background: var(--color-danger-bg); }
.refund-seller-error svg { flex: 0 0 auto; }
.refund-seller-error strong { color: var(--text-primary); font-size: 13px; }
.refund-seller-error p { margin: 4px 0 0; color: var(--text-secondary); font-size: 12px; line-height: 1.6; }

.refund-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.refund-actions--intro { justify-content: flex-end; }
.refund-seller-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }

.refund-btn {
  min-height: 44px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--text-primary);
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition: border-color 180ms ease, background-color 180ms ease, transform 180ms ease;
}

.refund-btn--block { width: 100%; }
.refund-btn--primary { color: var(--palette-hex-ffffff); border-color: var(--color-primary-hover); background: var(--color-primary-hover); }
.refund-btn--primary:hover:not(:disabled) { background: var(--color-primary); transform: translateY(-1px); }
.refund-btn--secondary { border-color: var(--border-medium); background: var(--bg-card); }
.refund-btn--secondary:hover:not(:disabled) { border-color: var(--color-primary); background: var(--color-primary-light); }
.refund-btn--danger { color: var(--palette-hex-ffffff); border-color: var(--refund-danger); background: var(--refund-danger); }
.refund-btn--outline-danger { color: var(--refund-danger); border-color: color-mix(in srgb, var(--refund-danger) 65%, var(--border-medium)); background: var(--bg-card); }
.refund-btn--outline-danger:hover:not(:disabled) { background: var(--color-danger-bg); }
.refund-btn:disabled { cursor: not-allowed; opacity: .52; transform: none; }

.refund-btn:focus-visible,
.refund-field select:focus-visible,
.refund-field textarea:focus-visible,
.refund-seller-form textarea:focus-visible,
.refund-checkbox:focus-within,
.refund-error-state button:focus-visible {
  outline: 2px solid var(--color-primary-hover);
  outline-offset: 2px;
}

.refund-availability { display: flex; align-items: flex-start; gap: 8px; margin: 0; color: var(--text-secondary); font-size: 13px; line-height: 1.55; }
.refund-availability svg { flex: 0 0 auto; margin-top: 2px; color: var(--refund-warning); }
.refund-availability.is-available svg { color: var(--refund-success); }

.refund-form {
  display: grid;
  gap: 18px;
  padding: 20px;
  border: 1px solid var(--border-medium);
  border-radius: 13px;
  background: var(--bg-secondary);
}

.refund-form__errors { padding: 14px; border: 1px solid var(--color-danger-light); border-radius: 10px; color: var(--refund-danger); background: var(--color-danger-bg); font-size: 13px; }
.refund-form__errors ul { margin: 7px 0 0; padding-left: 20px; }
.refund-form__errors a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }

.refund-form__amount { padding: 15px; border: 1px solid var(--border-light); border-radius: 11px; background: var(--bg-card); }
.refund-form__amount > div { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.refund-form__amount span { color: var(--text-secondary); font-size: 13px; }
.refund-form__amount strong { color: var(--text-primary); font-size: 23px; }
.refund-form__amount small { display: block; margin-top: 5px; color: var(--text-tertiary); font-size: 12px; }

.refund-field { display: grid; gap: 7px; }
.refund-field label,
.refund-seller-form label { color: var(--text-primary); font-size: 13px; font-weight: 700; }
.refund-field__label-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.refund-field__label-row span { color: var(--text-tertiary); font-size: 12px; }

.refund-field select,
.refund-field textarea,
.refund-seller-form textarea {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  padding: 11px 13px;
  border: 1px solid var(--border-medium);
  border-radius: 10px;
  color: var(--text-primary);
  background: var(--bg-card);
  font: inherit;
  font-size: 14px;
  line-height: 1.6;
}

.refund-field textarea { min-height: 120px; resize: vertical; }
.refund-field select:focus,
.refund-field textarea:focus,
.refund-seller-form textarea:focus { border-color: var(--color-primary-hover); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 16%, transparent); outline: 0; }
.refund-field select[aria-invalid='true'],
.refund-field textarea[aria-invalid='true'],
.refund-seller-form textarea[aria-invalid='true'] { border-color: var(--refund-danger); }
.refund-field__help,
.refund-field__error { margin: 0; font-size: 12px; line-height: 1.55; }
.refund-field__help { color: var(--text-tertiary); }
.refund-field__error { color: var(--refund-danger); font-weight: 700; }

.refund-checkbox { display: flex; align-items: center; gap: 9px; width: fit-content; color: var(--text-primary); font-size: 13px; cursor: pointer; }
.refund-checkbox input { width: 18px; height: 18px; accent-color: var(--color-primary-hover); cursor: pointer; }
.refund-form__actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }

.refund-seller-form { display: grid; gap: 10px; margin-top: 14px; padding: 14px; border: 1px solid var(--border-medium); border-radius: 11px; background: var(--bg-secondary); }
.refund-seller-form textarea { min-height: 100px; resize: vertical; }

.refund-buyer-contact > p { margin: -5px 0 13px; }
.refund-no-events { min-height: 120px; display: grid; place-items: center; align-content: center; gap: 8px; color: var(--text-tertiary); text-align: center; }
.refund-no-events p { margin: 0; font-size: 13px; }

.refund-spin-icon { animation: refund-spin 800ms linear infinite; }
@keyframes refund-spin { to { transform: rotate(360deg); } }

@container (min-width: 760px) {
  .refund-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 350px);
    align-items: start;
  }

  .refund-main-column,
  .refund-side-column {
    min-width: 0;
    display: grid;
    gap: 16px;
    align-content: start;
  }
}

@media (max-width: 767px) {
  .refund-card__header { margin-bottom: 18px; }
  .refund-preflight__steps { grid-template-columns: 1fr; }
  .refund-actions--intro { justify-content: stretch; }
  .refund-actions--intro .refund-btn { flex: 1 1 180px; }
  .refund-stage-shell { padding: 16px; }
}

@media (max-width: 479px) {
  .refund-card { padding: 16px; }
  .refund-card__header { align-items: flex-start; flex-direction: column; gap: 10px; }
  .refund-error-state { grid-template-columns: auto minmax(0, 1fr); }
  .refund-error-state button { grid-column: 1 / -1; width: 100%; }
  .refund-status-panel { padding: 15px; }
  .refund-summary-area,
  .refund-actions-area,
  .refund-history-area { padding: 15px; }
  .refund-summary-area > header { align-items: flex-start; flex-direction: column; gap: 4px; }
  .refund-summary-area dl > div { grid-template-columns: 1fr; gap: 3px; }
  .refund-summary__amount { align-items: flex-start; flex-direction: column; }
  .refund-seller-actions { grid-template-columns: 1fr; }
  .refund-actions .refund-btn,
  .refund-form__actions .refund-btn { flex: 1 1 100%; }
  .refund-form { padding: 15px; }
  .refund-form__amount > div { align-items: flex-start; flex-direction: column; }
  .refund-dispute { flex-direction: column; }
}

@media (prefers-reduced-motion: reduce) {
  .refund-spinner,
  .refund-spin-icon { animation: none; }
  .refund-btn { transition: none; }
  .refund-btn:hover { transform: none; }
}
</style>
