<template>
  <div class="doc-content">
    <h2 id="purpose">退款有期限，处理有记录</h2>
    <p class="lead">本页的在线退款流程适用于已支付的商品订单（普通物品、独立卡密和共享卡密），不包含求购服务或推广服务订单。符合申请条件的买家可在支付后 7 天内从订单详情直接申请全额退款，也可先通过 LINUX DO 私信协商；联系卖家不是申请的前置条件。</p>

    <HelpCallout title="只支持原订单全额退款" tone="warning">
      Credit 退款接口要求退回原订单全额，LD 士多不支持部分退款。同一订单只建立一条退款记录，后续处理、重试和复核沿用该记录，不重复建单。
    </HelpCallout>
    <HelpCallout title="普通物品超时无需买家申请" tone="info">
      纳入发货保障的普通物品手动交付订单，到显示的发货截止时间仍未发货，系统会自动发起实付全额退款；已有申请、协商或拒绝不会取消原发货期限。确认 Credit 已退回后才显示“已退款”。<router-link to="/docs/shipping-deadline">查看 72 小时时限与历史订单安排</router-link>
    </HelpCallout>

    <HelpCallout title="退款申请 72 小时处理保障" tone="info">
      适用规则的申请会显示准确截止时间（北京时间）。卖家须在申请成功后 72 小时内同意退款或说明理由拒绝；联系协商、发货和确认收货均不延长申请时限。系统在截止前 3 小时提醒卖家，逾期未作决定会自动同意并发起全额退款，Credit 确认成功后通知双方。
    </HelpCallout>
    <p>规则启用前尚未决定的历史申请，通知双方后给予完整 72 小时；原有更早的未发货保障继续有效。具体以订单页显示的期限为准，自动同意不代表即时到账。</p>

    <h2 id="application-window">7 天申请窗口与后续售后</h2>
    <ul>
      <li><strong>7 天限制的是买家新建在线退款申请</strong>，从支付时间计算，不是自然周，也不是 7 天内无条件退款承诺。</li>
      <li>已有申请按原状态继续处理，不会因为支付已超过 7 天自动关闭；申请的 72 小时响应期限从申请成功起算，不从支付时起算。</li>
      <li>超过新申请期限、卖家拒绝或没有申请按钮，不表示未交付、无效或重复卡密、与描述不符、承诺期内失效等问题的责任自动消失。保留证据，继续协商，并按下方争议路径处理；Credit 是否受理及处理结果以其规则为准。</li>
      <li>卡密已经发放、订单显示已发货或已完成，只反映订单流程状态，不等于商品有效性已经核验或承诺期内的服务全部履行。</li>
      <li>买家应如实说明使用情况，不重复或恶意申请；卖家认为内容已有效交付且已使用、不可回收，或不符合退款约定时，应提交具体理由和证据，不以“卡密已发放”为由一概排除售后。</li>
    </ul>

    <h2 id="before-request">申请前先准备</h2>
    <ul>
      <li>确认订单已支付，且当前是已支付、已发货或已完成状态；待支付、已取消或已过期订单不能申请。</li>
      <li>可选择先私信卖家，说明订单号和问题；也可直接提交退款申请。</li>
      <li>保留订单页状态、交付结果、沟通时间线和必要截图，但不要公开卡密、密码或 Client Key。</li>
      <li>退款成功后，该订单已使用的优惠券不会恢复；永久累计限购额度不会恢复，滚动限购则仍计入到该笔支付自然移出时间窗口为止。</li>
      <li>缺少原收款配置、没有可退积分或当前状态不支持申请时，页面会提示原因；不要通过重复创建订单来处理售后。</li>
      <li>退款不会自动补回库存或回收已经展示过的卡密。退款成功后买家不能再从订单查看交付内容，卖家和管理员仍可按原有权限核对记录。</li>
    </ul>

    <h2 id="buyer-request">买家如何申请退款</h2>
    <HelpPath :items="[{ label: '个人中心', to: '/user' }, { label: '我的订单', to: '/user/orders' }, { label: '订单详情' }, { label: '退款与售后' }]" />
    <HelpSteps :steps="buyerSteps" />
    <p>提交后，订单详情会显示退款状态和处理时间线。新申请的金额由系统按订单实付金额确定，不需要手工输入。</p>

    <h2 id="seller-handle">卖家如何处理</h2>
    <HelpPath :items="[{ label: '卖家后台', to: '/seller' }, { label: '退款售后', to: '/seller/refunds' }, { label: '订单详情' }]" />
    <HelpTable :columns="sellerColumns" :rows="sellerRows" caption="卖家可选的退款处理方式" />
    <HelpCallout title="退款成功后不可撤销" tone="danger">
      确认后系统会核对原交易并尝试调用该订单原收款应用的 Credit 退款接口。退款成功后不可撤销；提交请求不等于退款已成功。操作前必须再次核对订单、买家和协商结果。
    </HelpCallout>

    <h2 id="status">看懂退款状态</h2>
    <HelpTable :columns="statusColumns" :rows="statusRows" caption="退款状态与下一步" />

    <h2 id="refund-exceptions">退款执行失败或结果待核实</h2>
    <ul>
      <li><strong>执行失败：</strong>页面已收到明确失败结果。卖家按提示检查原收款凭证、余额或订单状态后，可从订单详情重试；管理员也可在留下核对依据后安全重试。</li>
      <li><strong>结果待核实：</strong>请求可能已送达 Credit，但商城未获得可确认结果。为防止重复退款，页面不提供重试；双方应保留订单号并联系 LD 士多核实。管理员需依据 Credit 交易记录登记结果，确认未退款并修复问题后才可重试，不能仅凭订单消失或余额估计认定已退款。</li>
      <li><strong>已转 Credit 处理：</strong>本站查询到原交易不再处于可退款的成功状态，或 Credit 明确返回交易不存在，便停止本站退款流程。这个状态本身不证明已经立案、争议获准或积分退回，请到 Credit 核对实际交易和争议结果。</li>
      <li>在结果明确前，卖家不要通过其他入口对同一订单重复操作，买家也不必重复提交申请。</li>
    </ul>

    <h2 id="credit-dispute">协商、平台内部复核与 Credit 争议</h2>
    <p>卖家拒绝、超过新申请期限，或退款失败、结果待核实时，可继续与卖家协商，也可通过 <a href="https://linux.do/u/jackyliii" target="_blank" rel="noopener noreferrer">LD 士多管理员 Jacky 的论坛主页</a>发起私信，提供订单号和必要证据，请求核实或内部复核。也可前往 <a href="https://credit.linux.do" target="_blank" rel="noopener noreferrer">credit.linux.do</a> 查找原交易并按其规则发起争议，请求 Credit 平台介入。</p>
    <ol>
      <li>带上 LD 士多订单号、Credit 交易号和退款申请时间线。</li>
      <li>客观说明物品承诺、实际交付、问题和已经完成的协商。</li>
      <li>只提供支持事实的必要证据，隐去卡密、密码和无关个人信息。</li>
    </ol>
    <p>对于已有退款申请，LD 士多管理员可根据证据作出同意或拒绝决定、复核已拒绝申请，并核对退款异常，处理依据会记入时间线并通知双方。已到期的待决定申请不能通过拒绝来绕过保障。内部处理不等于司法判决或法定仲裁，不排除依法投诉、诉讼等途径，也不承诺退款垫付。</p>
    <p>商品或评论举报用于违规受理与内容治理，与退款申请分别跟进；举报结案、下架或隐藏内容不等于已经退款，不能用举报替代退款结果核实。</p>
    <p>可同时阅读 <a href="https://credit.linux.do/docs/how-to-use#%E4%BA%89%E8%AE%AE%E5%A4%84%E7%90%86" target="_blank" rel="noopener noreferrer">Credit 争议处理说明</a>。LD 士多会保留本站退款申请与卖家响应记录，但 Credit 争议的受理和结果以 Credit 平台为准。</p>

    <div class="help-actions">
      <router-link to="/user/orders">查看我的订单</router-link>
      <router-link to="/seller/refunds" class="secondary">打开退款售后</router-link>
      <a href="https://linux.do/u/jackyliii" target="_blank" rel="noopener noreferrer" class="secondary">联系 LD 士多管理员 Jacky</a>
    </div>
  </div>
</template>

<script setup>
import HelpCallout from './HelpCallout.vue'
import HelpPath from './HelpPath.vue'
import HelpSteps from './HelpSteps.vue'
import HelpTable from './HelpTable.vue'

const buyerSteps = [
  { title: '可先联系卖家', description: '可通过 LINUX DO 私信协商，也可以直接申请退款。' },
  { title: '打开退款表单', description: '在订单详情的“退款与售后”中选择申请退款。' },
  { title: '说清原因', description: '选择最接近的原因，用 10–500 字写明实际问题，并如实标记是否已联系卖家。' },
  { title: '核对后提交', description: '确认页面显示的全额退款金额和订单号。', result: '卖家会收到新的退款待办。' }
]
const sellerColumns = [
  { key: 'action', label: '处理方式' },
  { key: 'when', label: '适用情况' },
  { key: 'result', label: '结果' }
]
const sellerRows = [
  { action: '联系买家 / 标记协商', when: '需要补充信息或希望先直接解决', result: '状态变为“协商中”，留下卖家备注' },
  { action: '拒绝退款', when: '核对后认为不符合退款约定', result: '必须填写具体理由，买家可查看并继续协商或争议' },
  { action: '同意并退款', when: '卖家核对后同意按原订单全额退回', result: '核对原交易并尝试退款；确认成功后订单变为已退款' }
]
const statusColumns = [
  { key: 'status', label: '状态' },
  { key: 'meaning', label: '含义' },
  { key: 'next', label: '下一步' }
]
const statusRows = [
  { status: '待卖家处理', meaning: '申请已提交，等待卖家首次响应', next: '卖家联系、拒绝或同意' },
  { status: '协商中', meaning: '双方还在核对事实，响应期限不延长', next: '在截止前作出决定，争议可按规则请求内部复核' },
  { status: '退款中', meaning: '系统正在向 Credit 提交全额退款', next: '不要重复操作，等待结果' },
  { status: '已退款', meaning: '已确认 Credit 退回，订单和退款记录已更新', next: '买家到 Credit 余额或交易记录核对' },
  { status: '已拒绝', meaning: '卖家或管理员已给出拒绝理由', next: '查看处理依据，继续协商、请求内部复核或到 Credit 发起争议' },
  { status: '已转 Credit 处理', meaning: '本站已停止退款，不代表已经退款或争议获准', next: '到 Credit 核对实际争议或退回结果' },
  { status: '执行失败 / 结果待核实', meaning: '退款未能正常确认', next: '按页面的差异化提示处理，待核实状态不要重试' }
]
</script>
