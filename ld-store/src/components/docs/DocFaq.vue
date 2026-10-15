<template>
  <div class="doc-content">
    <h2 id="how-to-use">按页面现象排查</h2>
    <p class="lead">先找到最接近的现象，按顺序检查。反馈时提供订单号、物品名和用户可见中文状态，不要提交卡密或密钥。</p>

    <h2 id="payment">支付与订单</h2>
    <div class="faq-list">
      <details>
        <summary>普通物品为什么也要求卖家配置收款？</summary>
        <div><p>普通物品和自动发卡物品都在 LD 士多订单内使用 LDC 支付。普通物品只是改为卖家手动履约，不是站外支付，因此同样需要卖家收款配置。</p><p><router-link to="/docs/payment-settings">查看收款配置</router-link></p></div>
      </details>
      <details>
        <summary>支付完成后订单仍显示待支付或支付中</summary>
        <div><p>稍后刷新订单详情，确认没有重复创建或支付。卖家同时检查通知地址和通知测试。持续不更新时，保留订单号、时间和支付页面结果后反馈。</p></div>
      </details>
      <details>
        <summary>我找不到订单</summary>
        <div><p>买家到个人中心的“我的订单”；卖家到独立卖家后台的“订单管理”。卖家订单还要确认当前选中“商品销售”还是“求购服务”，并清除过窄筛选。</p></div>
      </details>
      <details>
        <summary>为什么显示“最近 7 天已达限购”，第 8 天还不能买？</summary>
        <div><p>时间限购按每笔订单的支付时间滚动计算 7 × 24 小时，不会在第 8 个自然日零点统一重置。页面显示的预计释放时间表示最早一笔记录何时移出当前统计窗口；待支付订单取消或过期也会释放它占用的额度。</p></div>
      </details>
    </div>

    <h2 id="refunds">退款与争议</h2>
    <div class="faq-list">
      <details>
        <summary>为什么不能只退一部分 LDC？</summary>
        <div><p>Credit 订单退款要求退回原订单全额，所以 LD 士多不提供部分退款。页面会按原订单实付金额显示退款数值。</p></div>
      </details>
      <details>
        <summary>退款显示“结果待核实”，可以再点一次吗？</summary>
        <div><p>不可以。这表示请求可能已送达 Credit，只是商城没有获得可确认的返回结果。重复操作可能造成风险，请保留订单号并联系 LD 士多核实。</p></div>
      </details>
      <details>
        <summary>卖家拒绝退款后怎么办？</summary>
        <div><p>先查看拒绝理由并继续与卖家协商。如果仍无法解决且买家希望继续争议，可到 credit.linux.do 查找原交易并发起争议。</p><p><router-link to="/docs/refunds#credit-dispute">查看退款与争议完整流程</router-link></p></div>
      </details>
    </div>

    <h2 id="delivery">发货与卡密</h2>
    <div class="faq-list">
      <details>
        <summary>普通物品 72 小时没发货会怎样？</summary>
        <div><p>系统在 48 小时下架对应物品，72 小时停止发货并自动发起原订单实付全额退款。退款可能成功、失败或进入待核对，只有 Credit 明确成功后才显示已退款。</p><p><router-link to="/docs/shipping-deadline">查看完整发货保障规则</router-link></p></div>
      </details>
      <details>
        <summary>订单为什么一直待发货？</summary>
        <div><p>普通物品需要卖家手动履约。自动发卡订单待发货时，卖家应检查支付通知、独立卡密可用库存或共享内容，再从订单详情处理。</p><p><router-link to="/docs/seller-orders#pending-delivery">处理待发货订单</router-link></p></div>
      </details>
      <details>
        <summary>共享卡密的库存为什么是 9999？</summary>
        <div><p>共享卡密重复发放同一内容，商城统一显示 9999 作为展示库存，不代表录入了 9999 条卡密。系统固定每位用户永久累计限购一件，销量仍按实际成交累计。</p></div>
      </details>
      <details>
        <summary>切换共享与独立卡密后，旧库存去哪了？</summary>
        <div><p>独立切共享时，独立卡密被暂停；共享切独立时，共享内容迁移成一条可用独立卡密。切回独立会恢复此前暂停库存。每次切换都要重新审核。</p><p><router-link to="/docs/inventory-management#switch-cdk-mode">查看完整切换规则</router-link></p></div>
      </details>
    </div>

    <h2 id="coupons">优惠券</h2>
    <div class="faq-list">
      <details>
        <summary>优惠券为什么显示“订单占用中”？</summary>
        <div><p>它已被一个未结束订单临时锁定，不能同时用于其他订单。订单取消或过期后，仍在有效期内的券会自动释放；已过期的券不会恢复。</p></div>
      </details>
      <details>
        <summary>买了多件，优惠为什么没有乘以数量？</summary>
        <div><p>固定减额整单只减一次；单件折扣只优惠其中一件。一单最多使用一张券，最低消费按适用物品的优惠前小计判断。</p></div>
      </details>
      <details>
        <summary>卖家暂停领取后，买家手里的券还能用吗？</summary>
        <div><p>可以。暂停只阻止新的领取，已经领取且仍有效的优惠券继续按原规则使用，卖家恢复领取后新买家可再次领取。旧版“永久停领”活动仍不可恢复。</p></div>
      </details>
    </div>

    <h2 id="seller-and-review">卖家后台与审核</h2>
    <div class="faq-list">
      <details>
        <summary>在哪里查看经营数据和待办？</summary>
        <div><p>进入“卖家后台 → 经营概览”，查看收入、成交订单、服务买家、物品浏览、收款状态和待办。买家个人中心不会展示这些经营卡片。</p></div>
      </details>
      <details>
        <summary>审核需要多久？</summary>
        <div><p>帮助中心不承诺固定审核时长。请以“我的物品”或“我的求购”显示的中文状态为准；自动检查无法确认时可能进入人工复核。</p></div>
      </details>
      <details>
        <summary>推广名额或发布限额和旧教程不同</summary>
        <div><p>发布限额、批量卡密操作限制、推广条件和名额可能动态调整，当前页面实时提示优先于帮助文档中的历史描述。</p></div>
      </details>
    </div>

    <h2 id="payment-settings">收款与通知地址</h2>
    <div class="faq-list">
      <details>
        <summary>通知地址和回调地址应该填什么？</summary>
        <div><p>直接从“卖家后台 → 收款设置”复制当前 Notify URL 和 Return URL，分别粘贴到 LDC 应用对应字段。不要照抄旧域名或手动拼路径。</p></div>
      </details>
      <details>
        <summary>收款测试失败怎么办？</summary>
        <div><p>检查 Client ID（PID）和 Client Key 两个字段是否完整且没有填反，应用是否可用，通知与回调地址是否来自当前页面。不要公开 Client Key 请求帮助。</p></div>
      </details>
    </div>

    <h2 id="requests-and-images">求购与图床</h2>
    <div class="faq-list">
      <details>
        <summary>求购支付后没有看到联系入口</summary>
        <div><p>回到求购订单详情刷新，确认订单已从等待支付更新。不要在状态未确认时重复创建订单；持续异常时提供求购订单号反馈。</p></div>
      </details>
      <details>
        <summary>图床链接在物品页不显示</summary>
        <div><p>确认复制的是完整 HTTPS 地址，先在新标签页打开验证，再检查物品字段是否有多余空格。图片已删除时需要上传替代图片并更新物品。</p></div>
      </details>
    </div>

    <h2 id="contact">仍未解决</h2>
    <HelpCallout title="提交最少但足够的信息" tone="info">
      提供页面地址、订单号或物品名、发生时间、当前中文状态、已完成的排查步骤。截图请遮挡卡密、Client Key、联系方式和其他隐私。
    </HelpCallout>
    <div class="help-actions">
      <router-link to="/docs/account-safety">账号与交易安全</router-link>
      <router-link to="/user/reports" class="secondary">查看我的举报</router-link>
    </div>
  </div>
</template>

<script setup>
import HelpCallout from './HelpCallout.vue'
</script>
