<template>
  <div class="doc-content">
    <h2 id="choose-route">先选一条路线</h2>
    <p class="lead">不必从头读完全部文档。选择眼前的任务，完成后再按相关文章继续。</p>

    <div class="task-grid">
      <router-link to="/docs/buy-guide" class="task-card">
        <span class="card-kicker">买家路线</span>
        <h3>找到物品并完成购买</h3>
        <p>浏览详情、核对兑换条件，在确认订单页调整数量和优惠券，然后完成平台内支付。</p>
      </router-link>
      <router-link to="/docs/seller-center" class="task-card">
        <span class="card-kicker">卖家路线</span>
        <h3>配置收款并发布物品</h3>
        <p>进入独立卖家后台，先接入 LDC 收款，再发布普通物品或自动发卡物品。</p>
      </router-link>
      <router-link to="/docs/buy-request" class="task-card">
        <span class="card-kicker">求购路线</span>
        <h3>发布需求或承接服务</h3>
        <p>公开需求、在线洽谈，确认方案后通过求购订单支付并解锁联系入口。</p>
      </router-link>
      <router-link to="/docs/faq" class="task-card">
        <span class="card-kicker">问题处理路线</span>
        <h3>快速定位异常</h3>
        <p>按支付、优惠券、发货、库存、审核和收款场景逐项排查。</p>
      </router-link>
    </div>

    <h2 id="shortest-path">最短上手路径</h2>
    <HelpTable :columns="routeColumns" :rows="routeRows" caption="从当前目标直达对应页面">
      <template #cell-path="{ row }">
        <router-link :to="row.to">{{ row.path }}</router-link>
      </template>
    </HelpTable>

    <HelpCallout title="平台内支付是完整订单流程的一部分" tone="info">
      普通物品和自动发卡物品都在 LD 士多内使用 LDC 支付；两者都要求卖家先配置收款。区别只在交付方式，不在支付位置。
    </HelpCallout>

    <h2 id="before-you-start">开始前准备</h2>
    <ul>
      <li>使用 LinuxDo 账号完成登录。</li>
      <li>买家在支付前确认 LDC 余额、物品说明和交付方式。</li>
      <li>卖家准备 LDC 收款应用凭证；发布图片可先使用士多图床。</li>
      <li>涉及卡密时，先决定使用逐条发放的独立卡密，还是重复发放同一内容的共享卡密。</li>
    </ul>

    <h2 id="do-it-now">现在就开始</h2>
    <div class="help-actions">
      <router-link to="/">去物品广场</router-link>
      <router-link to="/seller/products/new">发布物品</router-link>
      <router-link to="/buy-requests/new" class="secondary">发布求购</router-link>
      <router-link to="/ld-image" class="secondary">打开士多图床</router-link>
    </div>

    <h2 id="when-stuck">遇到异常时</h2>
    <p>先记录订单号、物品名称和页面显示的中文状态，再到 <router-link to="/docs/faq">常见问题与排查</router-link> 搜索同一状态。需要人工协助时，可通过 <a href="https://linux.do/u/jackyliii" target="_blank" rel="noopener noreferrer">LD 士多管理员 Jacky 的论坛主页</a>发起私信并提供必要信息，不要公开卡密或收款密钥。退款与争议请同时查看 <router-link to="/docs/refunds">售后处理路径</router-link>。</p>
  </div>
</template>

<script setup>
import HelpCallout from './HelpCallout.vue'
import HelpTable from './HelpTable.vue'

const routeColumns = [
  { key: 'goal', label: '我想要' },
  { key: 'path', label: '页面入口' },
  { key: 'result', label: '到达后完成' }
]

const routeRows = [
  { goal: '购买现有物品', path: '首页 → 选择物品', to: '/', result: '查看详情、用券和支付' },
  { goal: '发布并经营物品', path: '卖家后台 → 发布物品', to: '/seller/products/new', result: '配置交付方式并提交审核' },
  { goal: '提出定制需求', path: '发布求购', to: '/buy-requests/new', result: '写明预算、期限和要求' },
  { goal: '查看自己的交易', path: '个人中心 → 我的订单', to: '/user/orders', result: '查看支付和交付状态' }
]
</script>
