<template>
  <div class="doc-content">
    <h2 id="purpose">为什么发布前必须配置收款</h2>
    <p class="lead">普通物品和自动发卡物品都在平台内创建 LDC 支付订单。卖家收款配置用于生成支付、接收通知并让订单进入正确的交付流程。</p>

    <HelpPath :items="[{ label: '卖家后台', to: '/seller' }, { label: '收款设置', to: '/seller/payment' }]" />

    <h2 id="prepare">准备 LDC 应用</h2>
    <ul>
      <li>在 LDC 相关应用管理页面创建用于 LD 士多收款的应用。</li>
      <li>准备 Client ID（PID）和 Client Key 两项凭证；PID 是收款设置中 Client ID 的名称，并非第三个字段。</li>
      <li>只在卖家后台保存这些凭证，不要发到评论、聊天、截图或公开工单。</li>
      <li>如果应用端需要通知地址或回调地址，直接复制 LD 士多页面生成的当前地址。</li>
    </ul>

    <h2 id="save-credentials">保存收款凭证</h2>
    <HelpSteps :steps="credentialSteps" />
    <HelpCallout title="Client Key 是密钥" tone="danger">
      不要把它当成公开 ID。怀疑泄露时，应在 LDC 应用端更换密钥，并立即更新 LD 士多收款设置后重新测试。
    </HelpCallout>

    <h2 id="callback-urls">配置通知地址和回调地址</h2>
    <p>收款设置页会显示当前可用的通知 URL 与回调 URL，并提供复制操作。把它们分别粘贴到 LDC 应用要求的对应字段：</p>
    <dl class="definition-list">
      <div><dt>通知地址 / Notify URL</dt><dd>服务器用于接收支付结果。它关系到订单状态更新和自动发卡，必须可以由支付服务访问。</dd></div>
      <div><dt>回调地址 / Return URL</dt><dd>买家支付完成后返回的页面地址，用于继续查看订单结果。</dd></div>
    </dl>
    <p>不要手抄旧教程中的域名，也不要自行拼接路径；部署地址变化时，页面复制出的值才是当前配置。</p>

    <h2 id="test-payment">测试 LDC 收款通知</h2>
    <HelpSteps :steps="testSteps" />
    <p>测试通过后再发布正式物品。测试只验证当前页面提示的连接或通知能力，不代表每个物品资料和卡密库存都已正确。</p>

    <h2 id="result">完成后的页面结果</h2>
    <ul>
      <li>卖家后台显示收款已配置或当前可用状态。</li>
      <li>发布普通物品和自动发卡物品时不再被“未配置收款”拦截。</li>
      <li>支付通知成功后，订单能从等待支付更新，并触发对应的手动或自动交付流程。</li>
    </ul>

    <h2 id="troubleshooting">收款或通知异常</h2>
    <HelpTable :columns="issueColumns" :rows="issueRows" />
    <HelpCallout title="删除配置会影响后续收款" tone="warning">
      删除或替换凭证前，先处理在途订单并确认新配置已完成测试。不要为了重试支付而反复删除配置。
    </HelpCallout>

    <div class="help-actions">
      <router-link to="/seller/payment">打开收款设置</router-link>
      <router-link to="/docs/publish-product" class="secondary">继续发布物品</router-link>
    </div>
  </div>
</template>

<script setup>
import HelpCallout from './HelpCallout.vue'
import HelpPath from './HelpPath.vue'
import HelpSteps from './HelpSteps.vue'
import HelpTable from './HelpTable.vue'

const credentialSteps = [
  { title: '打开收款设置', description: '进入独立卖家后台的收款设置，阅读当前字段提示。' },
  { title: '填写应用凭证', description: '从 LDC 应用管理页复制 Client ID（PID）和 Client Key，分别填写到对应字段。' },
  { title: '保存配置', description: '确认没有多余空格，也没有把公开 ID 与私密密钥填反。' },
  { title: '复制回调信息', description: '把页面生成的通知与回调地址配置到 LDC 应用端。' }
]
const testSteps = [
  { title: '先保存最新凭证', description: '测试基于当前保存的配置，不要测试尚未保存的输入。' },
  { title: '检查 LDC 应用地址', description: '确认通知 URL 和回调 URL 与卖家后台复制值一致。' },
  { title: '执行页面测试', description: '使用收款设置页提供的测试操作，并阅读返回结果。' },
  { title: '处理失败原因后重试', description: '按提示检查凭证、应用状态、地址和网络可达性。', result: '测试通过后再创建正式销售订单。' }
]
const issueColumns = [
  { key: 'symptom', label: '现象' },
  { key: 'check', label: '优先检查' },
  { key: 'risk', label: '不要这样做' }
]
const issueRows = [
  { symptom: '提示凭证无效', check: '字段是否填反、复制是否完整、应用是否可用', risk: '不要公开 Client Key 求助' },
  { symptom: '支付后订单不更新', check: '通知 URL、通知测试和订单号', risk: '不要重复发货或重复支付' },
  { symptom: '支付后无法返回', check: 'Return URL 是否来自当前页面', risk: '不要照抄旧域名' },
  { symptom: '自动发卡未触发', check: '订单支付状态、通知与卡密库存', risk: '不要直接改成已完成掩盖问题' }
]
</script>
