<template>
  <div class="doc-content">
    <h2 id="purpose">这篇能帮你完成什么</h2>
    <p class="lead">从物品广场找到合适物品，在平台内支付，并在订单页确认自动发卡或等待卖家履约。</p>

    <HelpPath :items="[{ label: '首页', to: '/' }, { label: '选择物品' }, { label: '物品详情' }, { label: '确认订单' }, { label: 'LDC 支付' }]" />

    <h2 id="prepare">购买前准备</h2>
    <ul>
      <li>登录 LinuxDo 账号并确认 LDC 余额。</li>
      <li>阅读物品说明、兑换限制、账号要求、交付方式和售后约定。</li>
      <li>如要使用优惠券，先领取并确认它适用于当前商品或店铺。</li>
      <li>卡密属于敏感信息，交付后不要截屏公开或转发给他人。</li>
    </ul>

    <h2 id="buy-steps">购买步骤</h2>
    <HelpSteps :steps="buySteps" />

    <h2 id="purchase-limit">理解兑换限制</h2>
    <ul>
      <li>“每单最多 X 件”只约束当前订单；“永久累计限购 X 件”会按当前账号统计该物品的全部历史购买。</li>
      <li>“最近 N 天限购 X 件”按最近 N × 24 小时滚动统计，不按自然周或每天零点重置。</li>
      <li>待支付或支付中的订单会暂时占用额度，取消或过期后释放。</li>
      <li>支付成功后即使退款也继续计入；永久模式不会恢复，滚动模式会在该笔支付超出统计周期后自然释放。</li>
      <li>确认订单页会显示“已购买 + 待支付 + 本次”的额度等式；并发下单时以创建订单的最终校验为准。</li>
    </ul>

    <h2 id="delivery-result">支付后会得到什么</h2>
    <HelpTable :columns="deliveryColumns" :rows="deliveryRows" caption="按物品类型查看交付结果" />
    <HelpCallout title="普通物品最晚 72 小时发货" tone="warning">
      订单页会显示服务端截止时间。48 小时仍未发货会下架对应物品；72 小时仍未发货，系统自动发起实付全额退款。<router-link to="/docs/shipping-deadline">查看完整规则</router-link>
    </HelpCallout>

    <h2 id="order-status">查看购买订单状态</h2>
    <HelpPath :items="[{ label: '个人中心', to: '/user' }, { label: '我的订单', to: '/user/orders' }]" />
    <dl class="status-list">
      <div><dt>待支付</dt><dd>订单已创建但尚未完成 LDC 支付。不要重复创建多个订单。</dd></div>
      <div><dt>支付中</dt><dd>正在等待支付结果同步，可稍后刷新订单详情。</dd></div>
      <div><dt>待发货</dt><dd>普通物品等待卖家履约；自动发卡异常时卖家也会在这里处理。</dd></div>
      <div><dt>超时退款处理中</dt><dd>发货入口已经停止，系统正在处理全额退款；以最终退款结果和 Credit 记录为准。</dd></div>
      <div><dt>已发货 / 已完成</dt><dd>进入订单详情查看交付内容、卖家说明或后续联系入口。</dd></div>
      <div><dt>已退款</dt><dd>退款已经 Credit 确认成功；可在订单详情查看退款时间线。</dd></div>
      <div><dt>已取消 / 已过期</dt><dd>订单已关闭；有效且仅被该订单占用的优惠券会自动释放。</dd></div>
    </dl>

    <h2 id="troubleshooting">异常处理</h2>
    <div class="faq-list">
      <details><summary>支付完成后状态没有变化</summary><div><p>先等待短暂同步并刷新订单详情，确认没有在新标签页重复支付。如果持续停留在“待支付”或“支付中”，保留订单号和支付页面结果后提交反馈。</p></div></details>
      <details><summary>自动发卡订单没有看到卡密</summary><div><p>进入订单详情检查状态和交付区域。若显示待发货，可能是支付通知或库存交付异常，联系卖家处理，不要再次购买同一物品。</p></div></details>
      <details><summary>普通物品一直待发货</summary><div><p>订单页会持续显示准确截止时间。可联系卖家询问安排；到期仍未发货时系统自动发起全额退款，无需另行申请。</p></div></details>
      <details><summary>订单有问题，怎么申请退款</summary><div><p>符合条件时，可直接到已支付订单详情的“退款与售后”提交全额退款申请，也可先私信卖家协商；联系卖家不是申请的前置条件。申请期限、处理结果与后续争议路径见 <router-link to="/docs/refunds">退款、协商与争议</router-link>。</p></div></details>
    </div>

    <div class="help-actions">
      <router-link to="/">去物品广场</router-link>
      <router-link to="/user/orders" class="secondary">查看我的订单</router-link>
      <router-link to="/docs/buyer-coupons" class="secondary">了解优惠券</router-link>
    </div>
  </div>
</template>

<script setup>
import HelpPath from './HelpPath.vue'
import HelpSteps from './HelpSteps.vue'
import HelpTable from './HelpTable.vue'
import HelpCallout from './HelpCallout.vue'

const buySteps = [
  { title: '筛选并查看详情', description: '按分类、关键词或物品类型浏览，进入详情确认价格、兑换条件和交付方式。' },
  { title: '进入确认订单页', description: '点击“立即兑换”后调整数量；系统会自动选择当前最优惠的可用券，也可以改选或不用券。进入或修改确认页不会保留库存。' },
  { title: '确认兑换并支付', description: '核对应付合计后确认兑换。此时系统才创建订单、校验库存并打开 LDC 支付。' },
  { title: '查看交付', description: '回到订单详情查看卡密或等待卖家手动履约。', result: '订单和站内沟通记录会保留在个人中心。' }
]
const deliveryColumns = [
  { key: 'type', label: '物品类型' },
  { key: 'afterPay', label: '支付后' },
  { key: 'yourAction', label: '你需要做什么' }
]
const deliveryRows = [
  { type: '普通物品', afterPay: '订单进入待发货，由卖家手动履约', yourAction: '留意订单和消息，按约定配合交付' },
  { type: '独立卡密', afterPay: '系统从库存逐条发放不同卡密', yourAction: '在订单详情复制并妥善保存' },
  { type: '共享卡密', afterPay: '系统发放同一份共享内容', yourAction: '每位用户永久累计限购一件，按说明使用' }
]
</script>
