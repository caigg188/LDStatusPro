<template>
  <div class="doc-content">
    <h2 id="purpose">集中管理账号内的交易线索</h2>
    <p class="lead">个人中心先展示需要处理的支付、收货、退款和消息，再提供订单、优惠券、求购、收藏与拉黑、举报等记录入口。发生问题时，先回到对应记录，而不是只依赖站外聊天。</p>

    <HelpPath :items="[{ label: '右上角头像' }, { label: '个人中心', to: '/user' }]" />

    <h2 id="account-tools">常用功能</h2>
    <HelpTable :columns="toolColumns" :rows="toolRows">
      <template #cell-entry="{ row }"><router-link :to="row.to">{{ row.entry }}</router-link></template>
    </HelpTable>

    <h2 id="favorites-comments">收藏与拉黑、评论和消息</h2>
    <ul>
      <li><strong>收藏：</strong>用于保存感兴趣的物品，价格、库存和可见状态仍以再次打开详情时为准。</li>
      <li><strong>不感兴趣：</strong>隐藏不想再看到的物品，并可在“收藏与拉黑”中恢复展示。</li>
      <li><strong>评论与回复：</strong>围绕真实体验说明事实，不公开卡密、密钥、联系方式或他人隐私。</li>
      <li><strong>站内消息：</strong>求购洽谈和重要约定尽量保留在站内，便于双方复核。</li>
      <li><strong>评分：</strong>交易结束后按实际交付评价，不用差评威胁对方接受额外条件。</li>
    </ul>

    <h2 id="safety-checklist">交易安全清单</h2>
    <div class="status-grid">
      <div class="status-card"><h3>支付前</h3><p>核对卖家、物品说明、数量、优惠、交付方式和应付 LDC。</p></div>
      <div class="status-card"><h3>交付时</h3><p>只在订单详情查看卡密；不要向任何人提供 LDC 应用密钥或登录验证码。</p></div>
      <div class="status-card"><h3>沟通中</h3><p>把调价、期限和交付变更写进站内消息，拒绝绕过平台订单。</p></div>
      <div class="status-card"><h3>发生异常</h3><p>记录订单号、页面状态、时间和必要截图；敏感字段先遮挡。</p></div>
    </div>

    <h2 id="dispute">举报与争议处理</h2>
    <HelpSteps :steps="disputeSteps" />
    <HelpCallout title="不要公开敏感证据" tone="danger">
      卡密、账号密码、Client Key、支付凭证中的私密字段不应出现在公开评论或帖子。提交给平台时也只提供定位问题所需的最少信息。
    </HelpCallout>

    <h2 id="troubleshooting">找不到记录时</h2>
    <p>先确认当前登录的是创建订单或求购时的同一账号，再检查买家订单和卖家订单是否选错入口。商品销售与求购服务也分开显示；仍找不到时，提供大致时间和物品名称请求协助。</p>

    <div class="help-actions">
      <router-link to="/user">打开个人中心</router-link>
      <router-link to="/user/reports" class="secondary">查看我的举报</router-link>
      <router-link to="/support" class="secondary">联系与反馈</router-link>
    </div>
  </div>
</template>

<script setup>
import HelpCallout from './HelpCallout.vue'
import HelpPath from './HelpPath.vue'
import HelpSteps from './HelpSteps.vue'
import HelpTable from './HelpTable.vue'

const toolColumns = [
  { key: 'tool', label: '功能' },
  { key: 'entry', label: '入口' },
  { key: 'use', label: '用途' }
]
const toolRows = [
  { tool: '待办', entry: '个人中心', to: '/user', use: '查看待支付、待收货、退款、未读消息和即将过期的优惠券' },
  { tool: '购买订单', entry: '我的订单', to: '/user/orders', use: '查看支付、发货和交付信息' },
  { tool: '优惠券', entry: '我的优惠券', to: '/user/coupons', use: '查看未使用、占用、已使用和已过期状态' },
  { tool: '收藏与拉黑', entry: '收藏与拉黑', to: '/user/favorites', use: '保存感兴趣的物品，或隐藏不感兴趣的物品' },
  { tool: '消息', entry: '我的消息', to: '/user/messages', use: '查看求购洽谈和站内沟通' },
  { tool: '举报', entry: '我的举报', to: '/user/reports', use: '提交并跟进违规或争议问题' }
]
const disputeSteps = [
  { title: '先固定事实', description: '保存订单号、页面状态、约定内容、时间线和实际交付结果。' },
  { title: '在站内联系对方', description: '明确说明期望处理方式，并给对方合理回应机会。' },
  { title: '提交举报或反馈', description: '沟通无果或发现违规时，选择对应入口并附上必要证据。' },
  { title: '跟进处理结果', description: '到“我的举报”查看状态和平台回复，不重复提交相同问题。' }
]
</script>
