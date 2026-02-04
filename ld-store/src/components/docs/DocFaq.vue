<template>
  <div class="doc-content">
    <h1>❓ 常见问题 FAQ</h1>
    <p class="lead">这里汇总了用户常见的问题和解答，帮助你快速解决疑问。</p>
    
    <h2>账号相关</h2>
    
    <div class="faq-list">
      <div :class="['faq-item', { open: openFaq === 'login' }]">
        <button class="faq-question" @click="toggleFaq('login')">
          <span><span class="q-icon">Q:</span> 如何登录 LD士多？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'login'">
          <p>LD士多 使用 LinuxDo 论坛账号登录，点击右上角「登录」按钮，授权后即可登录。</p>
          <p>你需要先在 <a href="https://linux.do" target="_blank" rel="noopener">linux.do</a> 注册账号。</p>
        </div>
      </div>
      
      <div :class="['faq-item', { open: openFaq === 'logout' }]">
        <button class="faq-question" @click="toggleFaq('logout')">
          <span><span class="q-icon">Q:</span> 如何退出登录？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'logout'">
          <p>点击右上角头像，在下拉菜单中点击「退出登录」即可。</p>
        </div>
      </div>
      
      <div :class="['faq-item', { open: openFaq === 'register' }]">
        <button class="faq-question" @click="toggleFaq('register')">
          <span><span class="q-icon">Q:</span> 没有 LinuxDo 账号怎么办？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'register'">
          <p>LinuxDo 论坛目前采用邀请制注册，你需要获得邀请码才能注册。</p>
          <p>可以找已有账号的朋友邀请，或关注论坛开放注册的公告。</p>
        </div>
      </div>
    </div>
    
    <h2>积分相关</h2>
    
    <div class="faq-list">
      <div :class="['faq-item', { open: openFaq === 'ldc' }]">
        <button class="faq-question" @click="toggleFaq('ldc')">
          <span><span class="q-icon">Q:</span> 什么是 LDC？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'ldc'">
          <p>LDC（Linux.do Credit）是 LinuxDo 社区的积分系统，可用于社区内的各种服务和商品交换。</p>
          <p>访问 <a href="https://credit.linux.do" target="_blank" rel="noopener">credit.linux.do</a> 查看你的积分余额。</p>
        </div>
      </div>
      
      <div :class="['faq-item', { open: openFaq === 'earn' }]">
        <button class="faq-question" @click="toggleFaq('earn')">
          <span><span class="q-icon">Q:</span> 如何获取 LDC？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'earn'">
          <p>可以通过以下方式获取 LDC：</p>
          <ul>
            <li>在论坛活跃参与讨论、发帖</li>
            <li>获得其他用户的点赞和认可</li>
            <li>参与社区活动</li>
            <li>向其他用户提供有价值的服务</li>
          </ul>
        </div>
      </div>
      
      <div :class="['faq-item', { open: openFaq === 'balance' }]">
        <button class="faq-question" @click="toggleFaq('balance')">
          <span><span class="q-icon">Q:</span> 如何查看 LDC 余额？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'balance'">
          <p>访问 <a href="https://credit.linux.do" target="_blank" rel="noopener">credit.linux.do</a> 登录后即可查看你的 LDC 余额和交易记录。</p>
        </div>
      </div>
    </div>
    
    <h2>购买相关</h2>
    
    <div class="faq-list">
      <div :class="['faq-item', { open: openFaq === 'buy-fail' }]">
        <button class="faq-question" @click="toggleFaq('buy-fail')">
          <span><span class="q-icon">Q:</span> 支付成功但没收到商品？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'buy-fail'">
          <p><strong>CDK 物品：</strong></p>
          <ul>
            <li>首先等待 1-2 分钟，刷新订单页面</li>
            <li>检查「我的订单」中订单状态</li>
            <li>如持续未发货，可能是卖家配置问题，请联系卖家或管理员</li>
          </ul>
          <p><strong>外链物品：</strong></p>
          <ul>
            <li>按商品描述中的方式联系卖家</li>
            <li>提供支付凭证（可在 LDC 官网查看交易记录）</li>
          </ul>
        </div>
      </div>
      
      <div :class="['faq-item', { open: openFaq === 'refund' }]">
        <button class="faq-question" @click="toggleFaq('refund')">
          <span><span class="q-icon">Q:</span> 可以申请退款吗？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'refund'">
          <p>退款政策因商品类型而异：</p>
          <ul>
            <li><strong>CDK 物品</strong>：已发放 CDK 的订单一般不支持退款，除非 CDK 确认无效</li>
            <li><strong>外链物品</strong>：交易在平台外完成，需与卖家直接协商</li>
          </ul>
          <p>如遇到诈骗或严重问题，可在论坛反馈。</p>
        </div>
      </div>
      
      <div :class="['faq-item', { open: openFaq === 'cdk-invalid' }]">
        <button class="faq-question" @click="toggleFaq('cdk-invalid')">
          <span><span class="q-icon">Q:</span> CDK 无效怎么办？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'cdk-invalid'">
          <p>请按以下步骤处理：</p>
          <ol>
            <li>确认使用方法是否正确（仔细阅读商品描述）</li>
            <li>确认是否在正确的平台/网站使用</li>
            <li>截图保存无法使用的证据</li>
            <li>联系卖家说明情况</li>
            <li>如卖家不处理，可在论坛反馈</li>
          </ol>
        </div>
      </div>
    </div>
    
    <h2>发布相关</h2>
    
    <div class="faq-list">
      <div :class="['faq-item', { open: openFaq === 'publish-cdk' }]">
        <button class="faq-question" @click="toggleFaq('publish-cdk')">
          <span><span class="q-icon">Q:</span> 发布 CDK 物品需要什么条件？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'publish-cdk'">
          <p>发布 CDK 物品需要先配置 LDC 收款信息：</p>
          <ol>
            <li>在 <a href="https://credit.linux.do/merchant" target="_blank" rel="noopener">LDC 集市</a> 创建应用</li>
            <li>配置正确的通知地址和回调地址</li>
            <li>在 LD士多「收款设置」中填入凭证</li>
          </ol>
          <p>详见 <router-link to="/docs/publish-cdk">发布 CDK 物品</router-link></p>
        </div>
      </div>
      
      <div :class="['faq-item', { open: openFaq === 'audit' }]">
        <button class="faq-question" @click="toggleFaq('audit')">
          <span><span class="q-icon">Q:</span> 商品审核需要多久？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'audit'">
          <p>一般 1-3 个工作日内完成审核。如长时间未审核，可在论坛私信管理员。</p>
          <p>为加快审核，建议：</p>
          <ul>
            <li>商品信息填写完整、描述清晰</li>
            <li>分类选择正确</li>
            <li>不包含违规内容</li>
          </ul>
        </div>
      </div>
      
      <div :class="['faq-item', { open: openFaq === 'audit-fail' }]">
        <button class="faq-question" @click="toggleFaq('audit-fail')">
          <span><span class="q-icon">Q:</span> 商品审核被拒怎么办？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'audit-fail'">
          <p>审核被拒后可以：</p>
          <ol>
            <li>查看拒绝原因</li>
            <li>根据原因修改商品信息</li>
            <li>重新提交审核</li>
          </ol>
          <p>如对审核结果有异议，可联系管理员。</p>
        </div>
      </div>
      
      <div :class="['faq-item', { open: openFaq === 'delivery-fail' }]">
        <button class="faq-question" @click="toggleFaq('delivery-fail')">
          <span><span class="q-icon">Q:</span> 买家付款了但自动发货失败？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'delivery-fail'">
          <p>可能原因：</p>
          <ul>
            <li><strong>通知地址配置错误</strong>：检查 LDC 集市中的通知 URL</li>
            <li><strong>CDK 库存为空</strong>：补充库存</li>
            <li><strong>回调验证失败</strong>：检查 Client Key 是否正确</li>
          </ul>
          <p>如确认配置正确但仍失败，请联系管理员协助排查。</p>
        </div>
      </div>
    </div>
    
    <h2>小店相关</h2>
    
    <div class="faq-list">
      <div :class="['faq-item', { open: openFaq === 'shop-count' }]">
        <button class="faq-question" @click="toggleFaq('shop-count')">
          <span><span class="q-icon">Q:</span> 可以入驻多个小店吗？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'shop-count'">
          <p>目前每个账号只能入驻一个小店。如需展示多个网站，建议选择最主要的一个。</p>
        </div>
      </div>
      
      <div :class="['faq-item', { open: openFaq === 'shop-edit' }]">
        <button class="faq-question" @click="toggleFaq('shop-edit')">
          <span><span class="q-icon">Q:</span> 小店入驻后可以修改信息吗？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'shop-edit'">
          <p>可以。在「我的 → 小店入驻」页面点击「编辑信息」即可修改。</p>
          <p>修改后可能需要重新审核。</p>
        </div>
      </div>
    </div>
    
    <h2>其他问题</h2>
    
    <div class="faq-list">
      <div :class="['faq-item', { open: openFaq === 'mobile' }]">
        <button class="faq-question" @click="toggleFaq('mobile')">
          <span><span class="q-icon">Q:</span> 手机上可以使用吗？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'mobile'">
          <p>可以！LD士多 采用响应式设计，完美支持手机浏览器访问。</p>
          <p>直接在手机浏览器中访问 <a href="https://shop.ldspro.qzz.io" target="_blank" rel="noopener">shop.ldspro.qzz.io</a> 即可。</p>
        </div>
      </div>
      
      <div :class="['faq-item', { open: openFaq === 'security' }]">
        <button class="faq-question" @click="toggleFaq('security')">
          <span><span class="q-icon">Q:</span> LD士多 安全吗？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'security'">
          <p>LD士多 是社区公益项目，采用以下安全措施：</p>
          <ul>
            <li>基于 LinuxDo OAuth 登录，不存储你的密码</li>
            <li>全站 HTTPS 加密传输</li>
            <li>商家收款凭证加密存储</li>
            <li>代码开源可审计</li>
          </ul>
          <p>同时，请注意甄别商品和卖家，避免上当受骗。</p>
        </div>
      </div>
      
      <div :class="['faq-item', { open: openFaq === 'contact' }]">
        <button class="faq-question" @click="toggleFaq('contact')">
          <span><span class="q-icon">Q:</span> 如何联系管理员？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'contact'">
          <p>可以通过以下方式联系：</p>
          <ul>
            <li>LinuxDo 论坛私信 <code>@JackyLiii</code></li>
            <li>在相关帖子下方留言</li>
          </ul>
        </div>
      </div>
      
      <div :class="['faq-item', { open: openFaq === 'fee' }]">
        <button class="faq-question" @click="toggleFaq('fee')">
          <span><span class="q-icon">Q:</span> 平台收手续费吗？</span>
          <span class="faq-arrow">▼</span>
        </button>
        <div class="faq-answer" v-show="openFaq === 'fee'">
          <p>LD士多 是社区公益项目，<strong>不收取任何手续费</strong>。</p>
          <p>但 LDC 官方可能会有交易费用，具体以 LDC 官方说明为准。</p>
        </div>
      </div>
    </div>
    
    <div class="highlight-box info">
      <div class="box-icon">💬</div>
      <div class="box-content">
        <strong>还有其他问题？</strong>
        <p>如果以上内容没有解答你的问题，欢迎在 LinuxDo 论坛反馈或私信管理员。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const openFaq = ref('')

function toggleFaq(id) {
  openFaq.value = openFaq.value === id ? '' : id
}
</script>

<style scoped>
@import './doc-styles.css';
</style>
