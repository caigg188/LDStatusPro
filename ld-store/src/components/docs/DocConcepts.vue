<template>
  <div class="doc-content">
    <h1>💡 基本概念</h1>
    <p class="lead">在开始使用 LD士多 之前，了解一些基本概念可以帮助你更好地使用平台。</p>
    
    <h2>LDC 积分</h2>
    <p>LDC（Linux.do Credit）是 LinuxDo 社区的积分系统，用于在社区生态内进行价值交换。</p>
    
    <div class="highlight-box info">
      <div class="box-icon">💰</div>
      <div class="box-content">
        <strong>如何获取 LDC？</strong>
        <p>在 LinuxDo 论坛活跃参与讨论、发帖、获得点赞等都可以积累 LDC 积分。访问 <a href="https://credit.linux.do" target="_blank" rel="noopener">credit.linux.do</a> 查看你的积分余额。</p>
      </div>
    </div>
    
    <h2>平台角色</h2>
    
    <h3>买家</h3>
    <p>任何登录 LD士多 的用户都可以作为买家浏览和购买物品。购买物品需要消耗 LDC 积分。</p>
    
    <h3>卖家（商家）</h3>
    <p>任何登录用户都可以发布物品成为卖家。发布的物品需要经过管理员审核后才会上架展示。</p>
    
    <div class="highlight-box warning">
      <div class="box-icon">⚠️</div>
      <div class="box-content">
        <strong>卖家须知</strong>
        <p>发布 CDK 类型物品需要先配置 LDC 收款信息，请在「个人中心 → 收款设置」中完成配置。</p>
      </div>
    </div>
    
    <h2>物品类型</h2>
    <p>LD士多 支持两种类型的物品：</p>
    
    <table class="compare-table">
      <thead>
        <tr>
          <th>特性</th>
          <th>🔗 外链物品</th>
          <th>🎫 CDK 物品</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>交易方式</td>
          <td>跳转外部链接</td>
          <td>平台内支付</td>
        </tr>
        <tr>
          <td>发货方式</td>
          <td>手动/自行处理</td>
          <td>自动发货</td>
        </tr>
        <tr>
          <td>需要配置收款</td>
          <td><span class="cross">✕</span></td>
          <td><span class="check">✓</span></td>
        </tr>
        <tr>
          <td>适用场景</td>
          <td>服务、咨询、定制</td>
          <td>激活码、卡密、Key</td>
        </tr>
      </tbody>
    </table>
    
    <h2>积分流转链接</h2>
    <p>积分流转链接是 LDC 官方提供的支付链接，用于外链类型物品的交易。</p>
    
    <p>创建方法：</p>
    <ol class="numbered-list">
      <li>访问 <a href="https://credit.linux.do" target="_blank" rel="noopener">credit.linux.do</a></li>
      <li>点击「创建收款链接」</li>
      <li>填写积分数额和备注信息</li>
      <li>生成链接后复制使用</li>
    </ol>
    
    <p>更多详情参考：<a href="https://linux.do/t/topic/1356124" target="_blank" rel="noopener">创建自己的积分流转链接</a></p>
    
    <h2>小店集市</h2>
    <p>小店集市是 LD士多 为社区用户提供的友情链接展示区域。如果你有自己的网站、博客、项目，可以申请入驻获得曝光。</p>
    
    <p>小店与普通物品的区别：</p>
    <ul>
      <li><strong>小店</strong>：展示外部链接，用于推广网站或服务</li>
      <li><strong>物品</strong>：在平台内完成浏览、购买流程</li>
    </ul>
    
    <h2>订单状态</h2>
    <p>了解订单的各种状态：</p>
    
    <table class="doc-table">
      <thead>
        <tr>
          <th>状态</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>待支付</code></td>
          <td>订单已创建，等待买家完成支付</td>
        </tr>
        <tr>
          <td><code>已支付</code></td>
          <td>买家已完成支付，等待发货（CDK 物品会自动发货）</td>
        </tr>
        <tr>
          <td><code>已完成</code></td>
          <td>交易完成，买家已收到商品</td>
        </tr>
        <tr>
          <td><code>已取消</code></td>
          <td>订单已取消，积分已退还（如适用）</td>
        </tr>
        <tr>
          <td><code>已退款</code></td>
          <td>交易发生退款</td>
        </tr>
      </tbody>
    </table>
    
    <h2>审核机制</h2>
    <p>为了保证平台商品质量，所有发布的商品都需要经过人工审核：</p>
    
    <ul>
      <li><strong>提交审核</strong>：商品发布后状态为「待审核」</li>
      <li><strong>审核通过</strong>：商品上架，在首页可见</li>
      <li><strong>审核拒绝</strong>：商品不会上架，可修改后重新提交</li>
    </ul>
    
    <div class="highlight-box tip">
      <div class="box-icon">💡</div>
      <div class="box-content">
        <strong>审核技巧</strong>
        <p>请确保商品信息完整、描述清晰、图片清晰，这样可以更快通过审核。禁止发布违规内容。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
// 基本概念文档
</script>

<style scoped>
@import './doc-styles.css';
</style>
