import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { URL } from 'node:url'
import {
  buildRefundStages,
  buildLinuxDoMessageUrl,
  getRefundActorLabel,
  getRefundEventMeta,
  getRefundReasonLabel,
  getRefundStatusMeta,
  validateRefundForm,
  validateSellerRejectionReason
} from '../src/utils/refund'

const refundPanelSource = readFileSync(new URL('../src/components/order/OrderRefundPanel.vue', import.meta.url), 'utf8')
const refundControllerSource = readFileSync(new URL('../src/composables/orders/useOrderRefund.ts', import.meta.url), 'utf8')
const ordersSource = readFileSync(new URL('../src/views/Orders.vue', import.meta.url), 'utf8')
const orderDetailSource = readFileSync(new URL('../src/views/OrderDetail.vue', import.meta.url), 'utf8')
const sellerRefundsSource = readFileSync(new URL('../src/views/seller/SellerRefunds.vue', import.meta.url), 'utf8')

function getRefundRequestButtonSource() {
  const controlsIndex = refundPanelSource.indexOf('aria-controls="refund-request-form"')
  const buttonStart = refundPanelSource.lastIndexOf('<button', controlsIndex)
  const buttonEnd = refundPanelSource.indexOf('</button>', controlsIndex)
  return refundPanelSource.slice(buttonStart, buttonEnd + '</button>'.length)
}

describe('订单退款买家流程', () => {
  it('始终展示退款入口，并用禁用态说明申请资格', () => {
    const requestButton = getRefundRequestButtonSource()

    expect(requestButton).not.toContain('v-if=')
    expect(requestButton).toContain(':disabled="!canApplyRefund"')
    expect(requestButton).toContain('aria-describedby="refund-action-availability"')
    expect(refundControllerSource).toContain('联系卖家是可选的协商方式，不影响申请资格')
  })

  it('校验原因与 10-500 字问题说明', () => {
    expect(validateRefundForm({ reasonCode: '', reasonDetail: '太短' })).toEqual({
      reasonCode: '请选择退款原因',
      reasonDetail: '请至少填写 10 个字，说明遇到的问题'
    })
    expect(validateRefundForm({
      reasonCode: 'not_as_described',
      reasonDetail: '收到内容与物品详情描述不一致，希望协商退款处理。'
    })).toEqual({})
    expect(validateRefundForm({ reasonCode: 'other', reasonDetail: 'a'.repeat(501) }).reasonDetail)
      .toBe('问题说明不能超过 500 个字')
  })

  it('校验卖家拒绝理由为去空格后的 5-500 字', () => {
    expect(validateSellerRejectionReason('   ')).toBe('请至少填写 5 个字，向买家说明拒绝原因')
    expect(validateSellerRejectionReason('不退')).toBe('请至少填写 5 个字，向买家说明拒绝原因')
    expect(validateSellerRejectionReason(' 理由刚好五 ')).toBe('')
    expect(validateSellerRejectionReason('a'.repeat(500))).toBe('')
    expect(validateSellerRejectionReason('a'.repeat(501))).toBe('拒绝理由不能超过 500 个字')
  })

  it('明确拒绝理由必填、可见范围与错误焦点', () => {
    expect(refundPanelSource).toContain('拒绝理由（必填）')
    expect(refundPanelSource).toContain('refund-seller-message-hint')
    expect(refundPanelSource).toContain('@blur="validateSellerActionField"')
    expect(refundControllerSource).toContain('sellerMessageInput.value?.focus()')
    expect(refundControllerSource).toContain('你填写的拒绝理由将展示给买家')
    expect(refundControllerSource).toContain("? '卖家拒绝理由'")
  })

  it('未申请时不展示虚假进度，申请后准确标记当前阶段', () => {
    expect(buildRefundStages('', false)).toEqual([])
    expect(buildRefundStages('requested').map(stage => stage.state)).toEqual(['done', 'current', 'pending', 'pending'])
    expect(buildRefundStages('negotiating')[1]).toMatchObject({ state: 'current', description: '双方正在协商' })
    expect(buildRefundStages('processing')[2]).toMatchObject({ state: 'current', label: '退款执行' })
  })

  it('为成功、拒绝与执行异常提供真实的分支语义', () => {
    const refunded = buildRefundStages('refunded')
    expect(refunded.map(stage => stage.state)).toEqual(['done', 'done', 'done', 'done'])
    expect(refunded[3]).toMatchObject({ label: '已退款', current: true })

    const rejected = buildRefundStages('rejected')
    expect(rejected[2]).toMatchObject({ state: 'skipped', description: '未执行积分退款' })
    expect(rejected[3]).toMatchObject({ state: 'error', label: '已拒绝', current: true })

    expect(buildRefundStages('failed')[2]).toMatchObject({ state: 'error', tone: 'danger' })
    expect(buildRefundStages('unknown')[2]).toMatchObject({ state: 'error', tone: 'warning' })
    expect(getRefundStatusMeta('unknown')).toMatchObject({ tone: 'danger', label: '退款结果待核对' })
  })

  it('将 Credit 外部处理展示为独立终态，不冒充已退款', () => {
    expect(getRefundStatusMeta('external_dispute')).toMatchObject({
      tone: 'warning',
      label: '已转 Credit 处理'
    })
    expect(getRefundStatusMeta('external_dispute').description).toContain('不代表积分已退回')

    const stages = buildRefundStages('external_dispute')
    expect(stages.map(stage => stage.state)).toEqual(['done', 'skipped', 'skipped', 'current'])
    expect(stages[2].description).toBe('未从 LD 士多发起退款')
    expect(stages[3]).toMatchObject({ label: 'Credit 处理', tone: 'warning' })
    expect(refundPanelSource).toContain('不代表争议已受理、已通过或积分已退回')
    expect(refundControllerSource).toContain("refundState.value?.refund?.status === 'external_dispute'")
    expect(refundControllerSource).toContain('本站状态不代表积分已经退回')
  })

  it('订单列表归并终态，详情与卖家退款台账保留独立语义', () => {
    expect(ordersSource).toContain("<OrderStatusFilter")
    expect(orderDetailSource).toContain("refund_external_dispute: '订单已转 Credit 处理'")
    expect(sellerRefundsSource).not.toContain('<template #summary>')
    expect(sellerRefundsSource).toContain("{ value: 'external_dispute', label: 'Credit 处理'")
  })

  it('按退款板块实际宽度切换布局，避免窄详情页被桌面视口强制分栏', () => {
    expect(refundPanelSource).toContain('container-type: inline-size')
    expect(refundPanelSource).toContain('@container (min-width: 760px)')
    expect(refundPanelSource).not.toContain('@media (min-width: 960px)')
  })

  it('为时间线事件提供稳定的语义色调与操作者标签', () => {
    expect(getRefundEventMeta('refund_succeeded')).toMatchObject({ tone: 'success', icon: 'success' })
    expect(getRefundEventMeta('rejected')).toMatchObject({ tone: 'danger', label: '卖家拒绝退款申请' })
    expect(getRefundEventMeta('external_dispute_detected')).toMatchObject({ tone: 'warning', icon: 'external' })
    expect(getRefundEventMeta('not_supported')).toMatchObject({ tone: 'neutral', label: '售后状态更新' })
    expect(getRefundActorLabel({ actorType: 'seller', actorName: '@alice' })).toBe('卖家 · @alice')
    expect(getRefundActorLabel({ actorType: 'system' })).toBe('系统')
  })

  it('展示稳定的原因文案并生成安全的 Linux DO 私信地址', () => {
    expect(getRefundReasonLabel('seller_agreed')).toBe('卖家已同意退款')
    const url = new URL(buildLinuxDoMessageUrl('@seller_name', 'LS202608230001', 'buyer'))
    expect(url.origin).toBe('https://linux.do')
    expect(url.pathname).toBe('/new-message')
    expect(url.searchParams.get('username')).toBe('seller_name')
    expect(url.searchParams.get('title')).toContain('LS202608230001')
  })
})
