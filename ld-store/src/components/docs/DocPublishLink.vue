<template>
  <div class="doc-content">
    <h1>📦 发布普通物品</h1>
    <p class="lead">普通物品适合服务类、人工交付类商品。买家会在平台内完成支付，平台保留订单记录，卖家需要手动履约。</p>

    <div class="highlight-box warning">
      <div class="box-icon">⚠️</div>
      <div class="box-content">
        <strong>发布前请先确认</strong>
        <p>普通物品同样需要先配置 LDC 收款信息。没有收款配置时，买家无法在平台内下单付款。</p>
      </div>
    </div>

    <h2>发布前准备</h2>
    <ul>
      <li>在「个人中心 → 收款设置」中完成 LDC 收款配置</li>
      <li>准备好商品图片、标题、详细描述和库存数量</li>
      <li>提前想清楚买家支付后应如何联系你，以及你将如何履约</li>
    </ul>

    <h2>发布步骤</h2>

    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-content">
          <h4>填写基础信息</h4>
          <p>输入商品名称、分类、价格、折扣、图片和详细描述。</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-content">
          <h4>选择“普通物品”</h4>
          <p>在“物品类型”区域选择“📦 普通物品”。</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-content">
          <h4>填写库存</h4>
          <p>输入库存数量。库存为 0 时买家无法下单，建议按实际履约能力填写。</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-content">
          <h4>写清楚履约方式</h4>
          <p>在描述中明确说明：买家支付后如何联系你、预计响应时间、交付周期和注意事项。</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">5</div>
        <div class="step-content">
          <h4>提交审核</h4>
          <p>确认信息无误后提交。审核通过后商品上架，买家即可在平台内下单。</p>
        </div>
      </div>
    </div>

    <h2>推荐填写方式</h2>

    <table class="doc-table">
      <thead>
        <tr>
          <th>字段</th>
          <th>建议</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>商品名称</td>
          <td>直接说明服务内容，例如“Claude 代充值”“服务器代部署”</td>
        </tr>
        <tr>
          <td>商品描述</td>
          <td>写清楚服务范围、交付方式、响应时间、买家需提供的信息</td>
        </tr>
        <tr>
          <td>库存</td>
          <td>按照你当前可承接的单量填写，避免超卖</td>
        </tr>
        <tr>
          <td>联系说明</td>
          <td>建议在描述中明确“支付完成后请主动联系卖家”</td>
        </tr>
      </tbody>
    </table>

    <h2>订单与履约</h2>

    <p>普通物品的完整流程如下：</p>

    <div class="flow-diagram">
      <div class="flow-step">
        <span class="step-icon">🛒</span>
        <span>买家下单</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">💳</span>
        <span>平台内支付</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">📨</span>
        <span>买家联系卖家</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">🤝</span>
        <span>卖家履约</span>
      </div>
    </div>

    <div class="highlight-box info">
      <div class="box-icon">💬</div>
      <div class="box-content">
        <strong>重要提醒</strong>
        <p>普通物品不会自动发货。支付成功后，买家和卖家都会在订单中看到提醒，请双方及时沟通完成交付。</p>
      </div>
    </div>

    <h2>常见问题</h2>

    <h3>Q: 普通物品需要填写 CDK 吗？</h3>
    <p>不需要。普通物品只需要填写库存，不会自动发卡。</p>

    <h3>Q: 买家支付后平台会自动发货吗？</h3>
    <p>不会。普通物品需要卖家手动履约，建议卖家及时查看订单并与买家沟通。</p>

    <h3>Q: 可以修改库存吗？</h3>
    <p>可以。商品发布后，仍可在“我的物品”中编辑普通物品库存。</p>

    <h3>Q: 之前的外链物品还能继续发吗？</h3>
    <p>不能。外链物品已停用，如需继续售卖，请重新发布为普通物品。</p>
  </div>
</template>

<script setup>
// 发布普通物品文档
</script>

<style scoped>
@import './doc-styles.css';
</style>
