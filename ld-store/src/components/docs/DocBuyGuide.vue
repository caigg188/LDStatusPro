<template>
  <div class="doc-content">
    <h1>🛒 购买指南</h1>
    <p class="lead">在 LD士多 购买商品非常简单，本文将介绍完整的购买流程和注意事项。</p>
    
    <h2>购买前准备</h2>
    
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-content">
          <h4>登录账号</h4>
          <p>使用 LinuxDo 论坛账号登录 LD士多</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-content">
          <h4>确认余额</h4>
          <p>在 <a href="https://credit.linux.do" target="_blank">credit.linux.do</a> 确认你的 LDC 余额充足</p>
        </div>
      </div>
    </div>
    
    <h2>购买外链物品</h2>
    
    <p>外链物品的购买流程：</p>
    
    <div class="flow-diagram">
      <div class="flow-step">
        <span class="step-icon">👀</span>
        <span>浏览商品</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">📖</span>
        <span>查看详情</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">🔗</span>
        <span>点击购买</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">💳</span>
        <span>LDC 支付</span>
      </div>
    </div>
    
    <h3>详细步骤</h3>
    
    <ol class="numbered-list">
      <li><strong>浏览商品</strong>：在首页或分类页面找到想要的商品</li>
      <li><strong>查看详情</strong>：点击商品卡片进入详情页，了解商品信息</li>
      <li><strong>点击购买</strong>：点击「立即购买」按钮</li>
      <li><strong>跳转支付</strong>：自动跳转到 <code>credit.linux.do</code> 支付页面</li>
      <li><strong>确认支付</strong>：核对金额后完成支付</li>
      <li><strong>联系卖家</strong>：支付成功后，按商品描述中的方式联系卖家获取商品</li>
    </ol>
    
    <div class="highlight-box warning">
      <div class="box-icon">⚠️</div>
      <div class="box-content">
        <strong>注意事项</strong>
        <p>外链物品的交易在平台外完成，请仔细阅读商品描述，了解获取商品的方式。如有疑问，先联系卖家确认后再支付。</p>
      </div>
    </div>
    
    <h2>购买 CDK 物品</h2>
    
    <p>CDK 物品支持平台内自动发货，购买流程更加便捷：</p>
    
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
        <span>LDC 支付</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">🎫</span>
        <span>获取 CDK</span>
      </div>
    </div>
    
    <h3>详细步骤</h3>
    
    <ol class="numbered-list">
      <li><strong>浏览商品</strong>：找到想要的 CDK 商品</li>
      <li><strong>查看详情</strong>：确认商品信息、使用说明等</li>
      <li><strong>点击购买</strong>：点击「立即购买」→「确认购买」</li>
      <li><strong>完成支付</strong>：跳转到 LDC 支付页面完成支付</li>
      <li><strong>自动发货</strong>：支付成功后，系统自动发放 CDK</li>
      <li><strong>查看 CDK</strong>：在「我的订单」中查看获得的 CDK</li>
    </ol>
    
    <div class="highlight-box tip">
      <div class="box-icon">💡</div>
      <div class="box-content">
        <strong>快速查看</strong>
        <p>支付成功后会自动跳转回 LD士多，你可以直接在订单详情页查看获得的 CDK。</p>
      </div>
    </div>
    
    <h2>查看订单</h2>
    
    <p>所有购买记录都可以在「我的订单」中查看：</p>
    
    <ul>
      <li>📋 订单列表：查看所有订单</li>
      <li>📝 订单详情：查看具体订单信息</li>
      <li>🎫 CDK 查看：CDK 物品可以在订单详情中复制 CDK</li>
    </ul>
    
    <h3>进入方式</h3>
    <ul>
      <li>点击右上角头像 → 「我的订单」</li>
      <li>移动端：点击底部「订单」Tab</li>
    </ul>
    
    <h2>订单状态说明</h2>
    
    <table class="doc-table">
      <thead>
        <tr>
          <th>状态</th>
          <th>说明</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>待支付</code></td>
          <td>订单已创建，等待支付</td>
          <td>去支付 / 取消订单</td>
        </tr>
        <tr>
          <td><code>已支付</code></td>
          <td>支付成功，等待发货</td>
          <td>查看详情</td>
        </tr>
        <tr>
          <td><code>已完成</code></td>
          <td>交易完成</td>
          <td>查看 CDK / 复制</td>
        </tr>
        <tr>
          <td><code>已取消</code></td>
          <td>订单已取消</td>
          <td>-</td>
        </tr>
        <tr>
          <td><code>已退款</code></td>
          <td>已申请退款</td>
          <td>-</td>
        </tr>
      </tbody>
    </table>
    
    <h2>常见问题</h2>
    
    <h3>Q: 购买 CDK 物品后没有收到 CDK？</h3>
    <p>可能的原因和解决方法：</p>
    <ul>
      <li><strong>支付未完成</strong>：检查 LDC 是否已扣除，可能支付过程中断</li>
      <li><strong>网络延迟</strong>：等待 1-2 分钟后刷新订单页面</li>
      <li><strong>商品缺货</strong>：卖家 CDK 库存不足，需联系卖家补货或退款</li>
    </ul>
    <p>如问题持续，请联系卖家或管理员。</p>
    
    <h3>Q: 外链物品支付后如何获取商品？</h3>
    <p>外链物品的获取方式由卖家指定，请仔细阅读商品描述中的说明。通常是：</p>
    <ul>
      <li>联系卖家提供支付凭证</li>
      <li>在指定平台填写信息</li>
      <li>卖家主动联系发货</li>
    </ul>
    
    <h3>Q: 可以申请退款吗？</h3>
    <p>退款政策：</p>
    <ul>
      <li><strong>CDK 物品</strong>：已发放 CDK 的订单一般不支持退款，除非 CDK 无效</li>
      <li><strong>外链物品</strong>：需与卖家协商，平台不介入外链交易</li>
    </ul>
    <p>如有纠纷，可在论坛反馈或联系管理员。</p>
    
    <h3>Q: 购买的 CDK 无效怎么办？</h3>
    <ol class="numbered-list">
      <li>首先确认使用方法是否正确（参考商品描述）</li>
      <li>联系卖家说明情况</li>
      <li>如卖家不处理，可在论坛反馈或联系管理员</li>
    </ol>
    
    <h3>Q: 支付页面打不开？</h3>
    <p>请检查：</p>
    <ul>
      <li>网络连接是否正常</li>
      <li>是否已登录 LinuxDo 账号</li>
      <li>浏览器是否阻止了弹出窗口</li>
    </ul>
    
    <div class="highlight-box info">
      <div class="box-icon">💬</div>
      <div class="box-content">
        <strong>需要帮助？</strong>
        <p>如遇到其他问题，可在 LinuxDo 论坛私信 <code>@JackyLiii</code> 寻求帮助。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
// 购买指南文档
</script>

<style scoped>
@import './doc-styles.css';
</style>
