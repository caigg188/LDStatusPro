<template>
  <div class="doc-content">
    <h1>🌱 求购操作指南</h1>
    <p class="lead">
      求购广场用于“我有需求，但市场暂时没有合适商品”的场景。你可以发布需求、在线洽谈、协商价格，并在平台支付订单回调完成后开放真实私信联系方式。
    </p>

    <div class="highlight-box info">
      <div class="box-icon">🛡️</div>
      <div class="box-content">
        <strong>核心保护机制</strong>
        <p>页面默认展示公开账号与公开密码，不直接暴露真实身份。只有订单完成后才开放真实私信入口。</p>
      </div>
    </div>

    <h2>一、角色与入口</h2>
    <ul>
      <li><strong>求购方</strong>：发布需求、调价、创建支付订单、刷新订单状态。</li>
      <li><strong>服务方</strong>：发起洽谈、沟通交付方案、在完成后通过私信交付。</li>
      <li><strong>管理员</strong>：审核求购、管理会话、查看日志与违禁词。</li>
      <li><strong>入口页面</strong>：<code>/publish</code>、<code>/buy-request/:id</code>、<code>/user/buy-requests</code>、<code>/user/buy-chats</code>、<code>/user/orders?tab=buy</code>。</li>
    </ul>

    <h2>二、发布与审核</h2>
    <ol class="numbered-list">
      <li>进入 <code>/publish</code>，切换到“发布求购”。</li>
      <li>填写标题、详细需求、预算价格并提交。</li>
      <li>新求购状态为 <code>pending_review</code>，需要管理员人工审核。</li>
      <li>审核通过后状态进入开放，其他用户才能发起洽谈。</li>
    </ol>

    <h2>三、洽谈与调价</h2>
    <ul>
      <li>服务方在求购详情页点击“发起洽谈”进入独立会话。</li>
      <li>聊天中仅展示公开身份，系统会拦截违禁词消息。</li>
      <li>求购方可以在详情页调价，更新预算。</li>
      <li>会话内可持续沟通需求边界、交付方式、时效等细节。</li>
      <li>会话可由任一方主动关闭，管理员也可强制关闭。</li>
    </ul>

    <h2>四、支付闭环（关键）</h2>
    <div class="flow-diagram">
      <div class="flow-step"><span class="step-icon">💬</span><span>洽谈确认</span></div>
      <span class="flow-arrow">→</span>
      <div class="flow-step"><span class="step-icon">💳</span><span>求购方创建并支付订单</span></div>
      <span class="flow-arrow">→</span>
      <div class="flow-step"><span class="step-icon">🔁</span><span>LDC 回调确认订单完成</span></div>
      <span class="flow-arrow">→</span>
      <div class="flow-step"><span class="step-icon">📨</span><span>开放真实私信入口</span></div>
    </div>

    <p>
      只有在“平台回调确认订单已完成”后，双方的真实联系入口才会解锁（跳转 Linux.do 私信）。
    </p>

    <h2>五、求购订单状态说明</h2>
    <ul>
      <li><code>pending</code>：待支付，求购方可继续支付或刷新状态。</li>
      <li><code>completed</code>：已完成，联系方式自动开放。</li>
      <li><code>expired</code>：已过期，需要重新创建支付订单。</li>
      <li><code>cancelled</code>：已取消，当前订单不再可用。</li>
    </ul>

    <h2>六、我该去哪里看进度</h2>
    <ul>
      <li><strong>我的求购</strong>：查看自己发布的求购状态、会话数量、待确认数量。</li>
      <li><strong>聊天洽谈</strong>：集中查看自己参与的会话、未读消息与最新进展。</li>
      <li><strong>求购订单</strong>：在“我的订单”中的“求购订单”Tab 查看支付状态与回调结果。</li>
      <li><strong>消息提醒</strong>：用户中心与顶部菜单会显示未读会话提醒。</li>
    </ul>

    <h2>七、常见问题</h2>
    <ul>
      <li><strong>支付后未立即解锁</strong>：先在“求购订单”里点“刷新状态”，等待回调同步。</li>
      <li><strong>订单过期</strong>：回到会话重新发起支付订单。</li>
      <li><strong>看不到支付按钮</strong>：仅求购方可在会话中创建支付订单。</li>
      <li><strong>看不到私信入口</strong>：只有订单状态变为 <code>completed</code> 才开放。</li>
    </ul>

    <h2>八、使用建议</h2>
    <ul>
      <li>标题写清核心需求关键词，便于服务方快速判断是否可接单。</li>
      <li>详细信息尽量包含交付标准、时间要求、验收方式。</li>
      <li>先聊清需求再支付，避免误解和争议。</li>
      <li>不要在聊天中发布违规内容，系统会拦截并记录。</li>
      <li>不要引导场外交易，保护双方权益。</li>
    </ul>
  </div>
</template>

<script setup>
// 求购操作指南
</script>

<style scoped>
@import './doc-styles.css';
</style>
