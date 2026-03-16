<template>
  <div class="doc-content">
    <h1>📦 物品类型</h1>
    <p class="lead">LD士多当前支持两种物品类型：普通物品与 CDK 物品。两者都会在平台内付款并保留订单记录，区别主要在于发货方式。</p>

    <h2>类型总览</h2>

    <div class="feature-cards">
      <div class="feature-card">
        <div class="card-icon">📦</div>
        <h4>普通物品</h4>
        <p>买家在平台内完成支付，平台保留订单记录。支付后买家需要主动联系卖家，卖家手动履约。</p>
      </div>
      <div class="feature-card">
        <div class="card-icon">🎫</div>
        <h4>CDK 物品</h4>
        <p>买家在平台内完成支付，系统自动从库存中发放 CDK。适合卡密、激活码、兑换码等数字内容。</p>
      </div>
    </div>

    <h2>📦 普通物品</h2>

    <h3>适合哪些商品</h3>
    <ul>
      <li><strong>人工服务</strong>：代购、咨询、陪跑、代配置、定制开发等</li>
      <li><strong>非标准交付</strong>：需要卖家根据买家情况再处理的商品或服务</li>
      <li><strong>需人工确认的数字服务</strong>：账号协助、代开通、代部署等</li>
    </ul>

    <h3>核心特点</h3>
    <table class="doc-table">
      <tbody>
        <tr>
          <td>✅ 平台内支付</td>
          <td>买家在 LD士多 内完成支付，订单全程留痕</td>
        </tr>
        <tr>
          <td>✅ 库存可管理</td>
          <td>发布时填写库存，库存耗尽后商品无法继续下单</td>
        </tr>
        <tr>
          <td>⚠️ 不自动发货</td>
          <td>买家支付后需主动联系卖家，卖家手动履约</td>
        </tr>
        <tr>
          <td>✅ 适合服务类</td>
          <td>平台负责支付与订单记录，交付由卖家线下或站内沟通完成</td>
        </tr>
      </tbody>
    </table>

    <div class="highlight-box warning">
      <div class="box-icon">⚠️</div>
      <div class="box-content">
        <strong>履约提醒</strong>
        <p>普通物品不会自动发货。买家付款后会收到“请主动联系卖家获取服务”的提示，卖家也应及时查看订单并完成交付。</p>
      </div>
    </div>

    <h2>🎫 CDK 物品</h2>

    <h3>适合哪些商品</h3>
    <ul>
      <li><strong>激活码</strong>：软件、游戏、会员权益激活码</li>
      <li><strong>兑换码</strong>：礼品、点数、折扣券等兑换内容</li>
      <li><strong>卡密</strong>：可标准化批量发放的数字商品</li>
    </ul>

    <h3>核心特点</h3>
    <table class="doc-table">
      <tbody>
        <tr>
          <td>✅ 平台内支付</td>
          <td>买家在 LD士多 内完成支付并保留订单记录</td>
        </tr>
        <tr>
          <td>✅ 自动发货</td>
          <td>支付成功后系统自动发放 CDK 到订单中</td>
        </tr>
        <tr>
          <td>✅ 库存自动同步</td>
          <td>库存来自可用 CDK 数量，支持后续补充卡密</td>
        </tr>
        <tr>
          <td>⚠️ 需要先配置收款</td>
          <td>必须正确配置 LDC 收款信息、通知地址与回调地址</td>
        </tr>
      </tbody>
    </table>

    <h2>类型对比</h2>

    <table class="compare-table">
      <thead>
        <tr>
          <th>对比项</th>
          <th>📦 普通物品</th>
          <th>🎫 CDK 物品</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>支付位置</td>
          <td>平台内</td>
          <td>平台内</td>
        </tr>
        <tr>
          <td>订单记录</td>
          <td>完整保留</td>
          <td>完整保留</td>
        </tr>
        <tr>
          <td>发货方式</td>
          <td>卖家手动履约</td>
          <td>系统自动发卡</td>
        </tr>
        <tr>
          <td>库存来源</td>
          <td>卖家填写库存</td>
          <td>可用 CDK 数量</td>
        </tr>
        <tr>
          <td>买家是否需主动联系卖家</td>
          <td>需要</td>
          <td>通常不需要</td>
        </tr>
        <tr>
          <td>适用场景</td>
          <td>服务、人工处理商品</td>
          <td>卡密、激活码、兑换码</td>
        </tr>
      </tbody>
    </table>

    <h2>如何选择</h2>

    <div class="decision-guide">
      <div class="highlight-box tip">
        <div class="box-icon">💡</div>
        <div class="box-content">
          <strong>选择普通物品，如果：</strong>
          <p>你的商品或服务需要人工交付，或者支付后还需要买卖双方进一步沟通确认。</p>
        </div>
      </div>

      <div class="highlight-box tip">
        <div class="box-icon">💡</div>
        <div class="box-content">
          <strong>选择 CDK 物品，如果：</strong>
          <p>你的商品可以标准化为卡密、激活码、兑换码，并且希望支付成功后自动发货。</p>
        </div>
      </div>
    </div>

    <p>继续阅读具体发布教程：</p>
    <ul>
      <li><router-link to="/docs/publish-link">发布普通物品 →</router-link></li>
      <li><router-link to="/docs/publish-cdk">发布 CDK 物品 →</router-link></li>
    </ul>
  </div>
</template>

<script setup>
// 物品类型文档
</script>

<style scoped>
@import './doc-styles.css';

.decision-guide {
  margin: 20px 0;
}

.decision-guide .highlight-box {
  margin-bottom: 12px;
}
</style>
