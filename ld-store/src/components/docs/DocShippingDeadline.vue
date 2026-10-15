<template>
  <div class="doc-content">
    <h2 id="rule">普通物品的发货期限</h2>
    <p class="lead">纳入本规则的新普通物品订单从支付成功起连续计算 72 小时，包含周末；历史订单按下方过渡安排计算。订单页显示准确截止时间，以对应订单的规则记录和通知为准。</p>
    <HelpCallout title="适用范围" tone="info">本规则只适用于普通物品的手动发货订单。自动发卡、求购服务和推广服务不纳入这套时限。</HelpCallout>

    <h2 id="timeline">48 小时与 72 小时会发生什么</h2>
    <HelpTable :columns="timelineColumns" :rows="timelineRows" caption="普通物品履约时间线" />
    <p>有效发货指已完成约定交付或服务开通，并留下买家可用的交付说明。“正在处理”“请联系我”等占位内容不等于真实履约；虚假发货可通过举报和售后核实。</p>

    <h2 id="seller-actions">卖家如何处理临期订单</h2>
    <HelpSteps :steps="sellerSteps" />
    <HelpCallout title="主动退款的计次时间" tone="warning">截止前成功发起的主动退款不计超时。若请求在截止后才发起并最终成功，仍会计入超时记录；失败尝试不会重置截止时间。</HelpCallout>

    <h2 id="refund-results">自动退款结果</h2>
    <p>到期后系统自动<strong>发起</strong>原订单实付全额退款，无需买家申请或卖家批准。确认 Credit 已退回后才显示“已退款”；异常结果可由管理员依据 Credit 交易记录核实并登记，不以发起请求或订单消失推定退款成功。</p>
    <HelpTable :columns="resultColumns" :rows="resultRows" caption="退款结果与处理方式" />
    <p>退款异常超过 24 小时仍未解决时会升级平台待办。买家可通过 <a href="https://linux.do/u/jackyliii" target="_blank" rel="noopener noreferrer">LD 士多管理员 Jacky 的论坛主页</a>发起私信并提供订单号，也可按 Credit 的规则在原交易发起争议。</p>

    <h2 id="seller-restriction">超时记录与卖家限制</h2>
    <ul>
      <li>同一卖家最近连续 30 天内，每笔确认成功且归责明确的超时退款订单计 1 次；退款重试和购买数量不重复计次。</li>
      <li>第 1 次记录提示，第 2 次明确警告，第 3 次限制新增交易功能 168 小时。</li>
      <li>限制期间仍可登录、购物、查看订单、履约已有订单及处理退款售后；在售物品会下架且不会在解封后自动重新上架。</li>
      <li>系统故障、结果未知、Credit 外部争议和未确认归责的情况不直接计罚。卖家可查看关联订单并申诉，管理员核实误判后可撤销。</li>
      <li>自动限制与人工禁用分别保留；临时限制到期不会覆盖仍有效的人工决定。</li>
    </ul>

    <h2 id="legacy">规则上线前的待发货订单</h2>
    <p>历史订单在买卖双方站内通知成功写入后，另给 72 小时处理期。通知写入失败不会开始倒计时；到期时会重新检查订单状态，只处理仍待发货的订单。历史过渡订单不计入新处罚次数。</p>

    <h2 id="inventory">优惠券、库存与限购</h2>
    <p>退款沿用现有订单口径：不会自动恢复优惠券或永久累计限购额度，滚动限购要等该笔支付自然移出统计窗口；物品和库存不会因退款自动重新上架或补回。</p>

    <div class="help-actions">
      <router-link to="/user/orders">查看买家订单</router-link>
      <router-link to="/seller/fulfillment" class="secondary">发货与履约</router-link>
      <router-link to="/seller/orders" class="secondary">处理卖家订单</router-link>
      <router-link to="/docs/refunds" class="secondary">退款与争议</router-link>
    </div>
  </div>
</template>

<script setup>
import HelpCallout from './HelpCallout.vue'
import HelpSteps from './HelpSteps.vue'
import HelpTable from './HelpTable.vue'
const timelineColumns = [{ key: 'time', label: '时间' }, { key: 'system', label: '系统动作' }, { key: 'seller', label: '卖家要做什么' }]
const timelineRows = [
  { time: '支付成功', system: '通知双方截止时间', seller: '核对订单并安排真实交付' },
  { time: '24 小时', system: '提醒剩余 48 小时', seller: '尽快履约或主动退款' },
  { time: '48 小时', system: '下架对应物品，保留原订单入口', seller: '在剩余 24 小时内处理积压' },
  { time: '60 小时', system: '提醒剩余 12 小时', seller: '确认交付可完成，否则主动退款' },
  { time: '70 小时', system: '提醒剩余 2 小时', seller: '完成最后核对' },
  { time: '72 小时', system: '停止发货并发起实付全额退款', seller: '关注退款结果和异常提示' }
]
const sellerSteps = [
  { title: '先处理最早截止订单', description: '卖家经营概览和订单页会显示截止时间与剩余时长。' },
  { title: '完成真实交付', description: '在截止前完成约定内容，并在订单中写入有效交付说明。' },
  { title: '无法履约时主动退款', description: '从订单详情选择“无法履约，主动全额退款”，核对金额并确认不可撤销。' },
  { title: '核对最终结果', description: '退款处理中不要继续发货；失败时按原因修复，结果未知时联系平台核对。' }
]
const resultColumns = [{ key: 'result', label: '结果' }, { key: 'meaning', label: '页面含义' }, { key: 'next', label: '下一步' }]
const resultRows = [
  { result: '明确成功', meaning: 'Credit 已确认退回，订单显示已退款', next: '通知双方，并按规则记录超时' },
  { result: '明确失败', meaning: '没有完成退款，显示具体原因', next: '修复收款凭证、余额等问题后安全重试' },
  { result: '结果不明', meaning: '可能已送达 Credit，本站无法确认', next: '停止自动重试，由平台核对交易记录' },
  { result: '已转 Credit 处理', meaning: '本站查询到原交易已不处于可退款的成功状态或不存在', next: '到 Credit 核对争议、交易与余额；不代表已立案或已退款' }
]
</script>
