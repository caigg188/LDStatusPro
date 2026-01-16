<template>
  <div class="doc-content">
    <h1>📦 物品类型</h1>
    <p class="lead">LD士多 支持两种物品类型，分别适用于不同的交易场景。选择正确的类型可以让你的交易更加顺畅。</p>
    
    <h2>类型总览</h2>
    
    <div class="feature-cards">
      <div class="feature-card">
        <div class="card-icon">🔗</div>
        <h4>外链物品</h4>
        <p>使用 LDC 积分流转链接完成交易，买家点击后跳转到外部支付页面。适合服务类、咨询类商品。</p>
      </div>
      <div class="feature-card">
        <div class="card-icon">🎫</div>
        <h4>CDK 物品</h4>
        <p>平台内完成支付，支付成功后自动发放 CDK 卡密。适合虚拟商品、激活码、充值卡等。</p>
      </div>
    </div>
    
    <h2>🔗 外链物品详解</h2>
    
    <h3>什么是外链物品？</h3>
    <p>外链物品使用 LDC 官方的<strong>积分流转链接</strong>进行交易。买家在商品详情页点击购买后，会跳转到 <code>credit.linux.do</code> 完成支付。</p>
    
    <h3>交易流程</h3>
    <div class="flow-diagram">
      <div class="flow-step">
        <span class="step-icon">👀</span>
        <span>浏览商品</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">🔗</span>
        <span>点击购买</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">💳</span>
        <span>跳转支付</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">✅</span>
        <span>完成交易</span>
      </div>
    </div>
    
    <h3>适用场景</h3>
    <ul>
      <li><strong>服务类</strong>：代购、代注册、技术咨询等需要人工处理的服务</li>
      <li><strong>定制类</strong>：按需定制的商品或服务</li>
      <li><strong>实体类</strong>：需要邮寄的实物商品</li>
      <li><strong>不定价类</strong>：根据具体情况协商价格的商品</li>
    </ul>
    
    <h3>优势与特点</h3>
    <table class="doc-table">
      <tbody>
        <tr>
          <td>✓ 无需配置收款</td>
          <td>直接使用积分流转链接，发布简单</td>
        </tr>
        <tr>
          <td>✓ 灵活度高</td>
          <td>可自定义支付积分和流转说明</td>
        </tr>
        <tr>
          <td>✓ 即时到账</td>
          <td>买家支付后积分直接转入你的账户</td>
        </tr>
      </tbody>
    </table>
    
    <div class="highlight-box warning">
      <div class="box-icon">⚠️</div>
      <div class="box-content">
        <strong>注意事项</strong>
        <p>外链物品的交易在平台外完成，请确保在商品描述中写清楚交易后的联系方式和获取方式。</p>
      </div>
    </div>
    
    <h2>🎫 CDK 物品详解</h2>
    
    <h3>什么是 CDK 物品？</h3>
    <p>CDK（Card Key）物品是指包含卡密、激活码、兑换码等数字内容的商品。买家在平台内完成支付后，系统会自动发放一个 CDK 给买家。</p>
    
    <h3>交易流程</h3>
    <div class="flow-diagram">
      <div class="flow-step">
        <span class="step-icon">👀</span>
        <span>浏览商品</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">🛒</span>
        <span>点击购买</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">💳</span>
        <span>平台内支付</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">🎫</span>
        <span>自动发货</span>
      </div>
    </div>
    
    <h3>适用场景</h3>
    <ul>
      <li><strong>激活码</strong>：软件激活码、游戏 CDK</li>
      <li><strong>充值卡</strong>：各类平台充值卡密</li>
      <li><strong>会员卡</strong>：会员激活码、订阅码</li>
      <li><strong>兑换码</strong>：礼品兑换码、优惠券码</li>
    </ul>
    
    <h3>优势与特点</h3>
    <table class="doc-table">
      <tbody>
        <tr>
          <td>✓ 自动发货</td>
          <td>支付成功后系统自动发放 CDK，无需人工干预</td>
        </tr>
        <tr>
          <td>✓ 平台担保</td>
          <td>在平台内完成交易，安全有保障</td>
        </tr>
        <tr>
          <td>✓ 库存管理</td>
          <td>可在后台管理 CDK 库存，批量导入导出</td>
        </tr>
        <tr>
          <td>✓ 订单追踪</td>
          <td>完整的订单记录，便于售后管理</td>
        </tr>
      </tbody>
    </table>
    
    <div class="highlight-box danger">
      <div class="box-icon">❗</div>
      <div class="box-content">
        <strong>重要前提</strong>
        <p>发布 CDK 物品前，<strong>必须先配置 LDC 收款信息</strong>，并确保通知地址配置正确。否则买家支付后无法自动发货！</p>
      </div>
    </div>
    
    <h2>类型对比</h2>
    
    <table class="compare-table">
      <thead>
        <tr>
          <th>对比项</th>
          <th>🔗 外链物品</th>
          <th>🎫 CDK 物品</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>发布门槛</td>
          <td>低（只需积分流转链接）</td>
          <td>需配置收款信息</td>
        </tr>
        <tr>
          <td>交易位置</td>
          <td>跳转至 credit.linux.do</td>
          <td>平台内完成</td>
        </tr>
        <tr>
          <td>发货方式</td>
          <td>手动</td>
          <td>自动</td>
        </tr>
        <tr>
          <td>库存管理</td>
          <td>不支持</td>
          <td>支持</td>
        </tr>
        <tr>
          <td>订单记录</td>
          <td>无</td>
          <td>完整记录</td>
        </tr>
        <tr>
          <td>适合商品</td>
          <td>服务、定制、实物</td>
          <td>卡密、激活码</td>
        </tr>
      </tbody>
    </table>
    
    <h2>如何选择？</h2>
    
    <div class="decision-guide">
      <p>根据你的商品特点选择合适的类型：</p>
      
      <div class="highlight-box tip">
        <div class="box-icon">💡</div>
        <div class="box-content">
          <strong>选择外链物品，如果：</strong>
          <p>• 你的商品需要人工处理（服务、定制）<br>
          • 你不想配置复杂的收款设置<br>
          • 你的商品无法标准化（价格不固定）</p>
        </div>
      </div>
      
      <div class="highlight-box tip">
        <div class="box-icon">💡</div>
        <div class="box-content">
          <strong>选择 CDK 物品，如果：</strong>
          <p>• 你的商品是数字卡密、激活码<br>
          • 你希望自动发货，减少人工操作<br>
          • 你有多个库存需要管理</p>
        </div>
      </div>
    </div>
    
    <p>接下来，你可以查看具体的发布教程：</p>
    <ul>
      <li><router-link to="/docs/publish-link">发布外链物品 →</router-link></li>
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

.decision-guide .box-content p {
  margin: 0;
  line-height: 2;
}
</style>
