<template>
  <div class="doc-content">
    <h2 id="purpose">经营增长分成两件事</h2>
    <p class="lead">小店用于沉淀长期展示资料，商家服务用于为符合条件的物品增加阶段性曝光。两者都在独立卖家后台管理。</p>

    <h2 id="shop-management">管理小店</h2>
    <HelpPath :items="[{ label: '卖家后台', to: '/seller' }, { label: '小店管理', to: '/seller/store' }]" />
    <p>填写店名、介绍、链接、分类和页面要求的展示资料。保存后从小店集市或预览入口检查访客看到的内容。</p>
    <HelpSteps :steps="shopSteps" />
    <HelpCallout title="小店资料与物品订单分开" tone="info">
      小店是展示和发现入口，不替代 LD 士多内的物品订单。需要平台支付和订单记录的内容，应发布为普通物品或自动发卡物品。
    </HelpCallout>

    <h2 id="promotion-services">士多甄选和士多优选</h2>
    <p>士多甄选和士多优选是付费推广服务。</p>
    <HelpPath :items="[{ label: '卖家后台', to: '/seller' }, { label: '商家服务', to: '/seller/services' }]" />
    <HelpTable :columns="serviceColumns" :rows="serviceRows" caption="具体位置、可用名额和所需条件以商家服务页为准" />
    <p>推广通常与物品及分类绑定。选择前检查物品是否审核通过、资料是否完整、库存是否充足，以及分类是否正确。页面显示的可用数量、时段、范围和名额均可能动态变化。</p>

    <h2 id="growth-steps">使用推广服务</h2>
    <HelpSteps :steps="promotionSteps" />

    <h2 id="result">如何判断结果</h2>
    <ul>
      <li>回到商家服务页确认当前服务状态和适用物品。</li>
      <li>从经营概览观察物品浏览与成交变化，并结合库存和优惠活动判断。</li>
      <li>推广不改变审核、支付或交付规则；自动发卡仍需库存和收款通知正常。</li>
      <li>服务结束后是否继续展示，以页面当前状态为准。</li>
    </ul>

    <h2 id="troubleshooting">无法选择小店或推广时</h2>
    <ul>
      <li>检查小店资料的必填项、链接格式和当前页面状态。</li>
      <li>检查物品是否属于推广要求的状态或分类。</li>
      <li>检查当前页面是否仍有可用名额，不使用旧文档中的固定数量判断。</li>
      <li>检查选中的物品是否售罄、暂停或重新审核中。</li>
    </ul>

    <div class="help-actions">
      <router-link to="/seller/store">管理小店</router-link>
      <router-link to="/seller/services" class="secondary">查看商家服务</router-link>
    </div>
  </div>
</template>

<script setup>
import HelpCallout from './HelpCallout.vue'
import HelpPath from './HelpPath.vue'
import HelpSteps from './HelpSteps.vue'
import HelpTable from './HelpTable.vue'

const shopSteps = [
  { title: '填写基础资料', description: '按页面填写店名、介绍、访问链接和分类等必填内容。' },
  { title: '检查访客视角', description: '确认链接可访问、描述不过期、分类与实际服务一致。' },
  { title: '保存并查看状态', description: '提交后按页面中文状态跟进，不重复创建相同小店。' },
  { title: '持续维护', description: '店名、链接或经营方向变化时及时更新。', result: '访客可从小店集市发现并了解你的服务。' }
]
const serviceColumns = [
  { key: 'service', label: '服务' },
  { key: 'goal', label: '主要目标' },
  { key: 'check', label: '使用前检查' }
]
const serviceRows = [
  { service: '士多甄选', goal: '获得页面指定区域的精选曝光', check: '物品状态、资料、库存与当前名额' },
  { service: '士多优选', goal: '在页面指定分类或位置获得优先展示', check: '分类绑定、适用条件与当前名额' }
]
const promotionSteps = [
  { title: '打开商家服务', description: '阅读当前服务说明、适用范围、时段和可用名额。' },
  { title: '选择物品和分类', description: '只选择资料完整、库存充足且分类准确的物品。' },
  { title: '确认页面提示', description: '核对服务效果、持续方式和当前条件后提交。' },
  { title: '跟进经营数据', description: '观察浏览、订单和库存，并及时处理待发货。' }
]
</script>
