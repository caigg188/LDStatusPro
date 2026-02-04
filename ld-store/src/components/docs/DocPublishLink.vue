<template>
  <div class="doc-content">
    <h1>🔗 发布外链物品</h1>
    <p class="lead">外链物品使用 LDC 积分流转链接完成交易，发布简单快捷，无需配置收款信息。</p>
    
    <div class="highlight-box tip">
      <div class="box-icon">✨</div>
      <div class="box-content">
        <strong>发布门槛低</strong>
        <p>外链物品不需要配置 LDC 收款信息，只需准备好积分流转链接即可发布。</p>
      </div>
    </div>
    
    <h2>准备工作</h2>
    
    <h3>1. 创建积分流转链接</h3>
    <p>积分流转链接是 LDC 官方提供的收款链接，买家点击后可以向你支付 LDC 积分。</p>
    
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-content">
          <h4>访问 LDC 官网</h4>
          <p>打开 <a href="https://credit.linux.do" target="_blank" rel="noopener">credit.linux.do</a>，使用 LinuxDo 账号登录</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-content">
          <h4>创建收款链接</h4>
          <p>进入「我的 → 创建收款链接」，或直接访问「收款」页面</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-content">
          <h4>填写信息</h4>
          <p>填写积分数额、备注说明等信息，点击生成链接</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-content">
          <h4>复制链接</h4>
          <p>生成的链接格式为：<code>https://credit.linux.do/paying/...</code></p>
        </div>
      </div>
    </div>
    
    <div class="highlight-box info">
      <div class="box-icon">📖</div>
      <div class="box-content">
        <strong>详细教程</strong>
        <p>更多关于积分流转链接的使用说明，请参考：<a href="https://linux.do/t/topic/1356124" target="_blank" rel="noopener">创建自己的积分流转链接</a></p>
      </div>
    </div>
    
    <h2>发布步骤</h2>
    
    <h3>1. 进入发布页面</h3>
    <p>登录后，点击网站右上角的「+」按钮，或在个人中心点击「发布商品」。</p>
    
    <h3>2. 填写基本信息</h3>
    
    <table class="doc-table">
      <thead>
        <tr>
          <th>字段</th>
          <th>说明</th>
          <th>要求</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>物品名称</strong></td>
          <td>商品的标题，展示在列表和详情页</td>
          <td>2-50 字符</td>
        </tr>
        <tr>
          <td><strong>物品描述</strong></td>
          <td>详细介绍商品信息、服务内容</td>
          <td>10-1000 字符</td>
        </tr>
        <tr>
          <td><strong>物品分类</strong></td>
          <td>选择合适的分类便于买家查找</td>
          <td>必选</td>
        </tr>
        <tr>
          <td><strong>价格 (LDC)</strong></td>
          <td>商品售价，单位为 LDC 积分</td>
          <td>大于 0</td>
        </tr>
        <tr>
          <td><strong>折扣</strong></td>
          <td>可选，0.8 表示 8 折</td>
          <td>0.01-1</td>
        </tr>
        <tr>
          <td><strong>物品图片</strong></td>
          <td>商品展示图片 URL</td>
          <td>可选，https 链接</td>
        </tr>
      </tbody>
    </table>
    
    <h3>3. 选择物品类型</h3>
    <p>在「物品类型」区域选择「🔗 链接类型」。</p>
    
    <h3>4. 填写积分流转链接</h3>
    <p>将之前准备好的积分流转链接粘贴到「积分流转链接」输入框中。</p>
    
    <div class="highlight-box warning">
      <div class="box-icon">⚠️</div>
      <div class="box-content">
        <strong>链接格式要求</strong>
        <p>链接必须以 <code>https://credit.linux.do/</code> 开头，否则无法通过验证。</p>
      </div>
    </div>
    
    <h3>5. 提交审核</h3>
    <p>确认信息无误后，点击「发布物品」按钮提交。商品将进入审核队列，审核通过后自动上架。</p>
    
    <h2>审核标准</h2>
    
    <p>为了保证商品质量，请确保你的商品符合以下要求：</p>
    
    <ul>
      <li>✅ 商品名称准确描述商品内容</li>
      <li>✅ 商品描述详细清晰，包含服务内容、交付方式</li>
      <li>✅ 价格合理，与商品价值相符</li>
      <li>✅ 分类选择正确</li>
      <li>✅ 不包含违规内容</li>
    </ul>
    
    <div class="highlight-box danger">
      <div class="box-icon">🚫</div>
      <div class="box-content">
        <strong>禁止发布</strong>
        <p>诈骗、虚假信息、违法内容、侵权内容、色情低俗内容等。违规将被封禁账号。</p>
      </div>
    </div>
    
    <h2>交易流程</h2>
    
    <p>买家购买外链物品的完整流程：</p>
    
    <div class="flow-diagram">
      <div class="flow-step">
        <span class="step-icon">🛒</span>
        <span>点击购买</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">🔗</span>
        <span>跳转链接</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">💳</span>
        <span>LDC 支付</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">✅</span>
        <span>积分到账</span>
      </div>
    </div>
    
    <h2>常见问题</h2>
    
    <h3>Q: 积分流转链接有有效期吗？</h3>
    <p>积分流转链接一般没有有效期限制，可以长期使用。但建议定期检查链接是否有效。</p>
    
    <h3>Q: 买家付款后我怎么知道？</h3>
    <p>外链物品的支付在 <code>credit.linux.do</code> 完成，你可以在 LDC 网站的交易记录中查看收款情况。建议在商品描述中留下联系方式，方便买家支付后联系你。</p>
    
    <h3>Q: 可以修改商品的积分流转链接吗？</h3>
    <p>可以。在「我的商品」中找到对应商品，点击编辑即可修改链接。修改后需要重新审核。</p>
    
    <h3>Q: 价格和链接中的积分不一致可以吗？</h3>
    <p>可以，商品显示的价格仅供参考，实际支付积分以积分流转链接中设置的积分为准。但建议保持一致，避免买家产生疑惑。</p>
  </div>
</template>

<script setup>
// 发布外链物品文档
</script>

<style scoped>
@import './doc-styles.css';
</style>
