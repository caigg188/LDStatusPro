<template>
  <div class="doc-content">
    <h1>🎫 发布 CDK 物品</h1>
    <p class="lead">CDK 物品支持平台内支付和自动发货，非常适合销售激活码、卡密等数字商品。</p>
    
    <div class="highlight-box danger">
      <div class="box-icon">❗</div>
      <div class="box-content">
        <strong>发布前必读</strong>
        <p>发布 CDK 物品<strong>必须先配置 LDC 收款信息</strong>，包括通知地址和回调地址。配置错误会导致买家支付后无法自动发货！</p>
      </div>
    </div>
    
    <h2>准备工作</h2>
    
    <h3>1. 在 LDC 集市创建应用</h3>
    
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-content">
          <h4>访问 LDC 集市</h4>
          <p>打开 <a href="https://credit.linux.do/merchant" target="_blank" rel="noopener">credit.linux.do/merchant</a>，登录你的 LinuxDo 账号</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-content">
          <h4>创建应用</h4>
          <p>点击「创建应用」按钮，填写应用名称（如：LD士多收款）</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-content">
          <h4>配置通知地址（最重要⚠️）</h4>
          <p>这是支付成功后自动发货的关键，<strong>必须正确填写！</strong></p>
          <code class="url-code">https://api.ldspro.qzz.io/api/shop/ldc/notify</code>
        </div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-content">
          <h4>配置回调地址</h4>
          <p>支付完成后浏览器跳转的地址：</p>
          <code class="url-code">https://api.ldspro.qzz.io/api/shop/ldc/return</code>
        </div>
      </div>
      <div class="step">
        <div class="step-num">5</div>
        <div class="step-content">
          <h4>获取凭证</h4>
          <p>保存后，复制应用的 <code>Client ID (PID)</code> 和 <code>Client Key</code></p>
        </div>
      </div>
    </div>
    
    <div class="highlight-box warning">
      <div class="box-icon">⚠️</div>
      <div class="box-content">
        <strong>通知地址配置说明</strong>
        <p>通知地址（Notify URL）是 LDC 在支付成功后向 LD士多 服务器发送通知的地址。配置错误会导致：</p>
        <ul style="margin: 8px 0 0; padding-left: 20px;">
          <li>买家支付成功但订单状态不更新</li>
          <li>CDK 无法自动发放给买家</li>
          <li>需要人工处理退款等问题</li>
        </ul>
      </div>
    </div>
    
    <h3>2. 在 LD士多 配置收款</h3>
    
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-content">
          <h4>进入收款设置</h4>
          <p>登录 LD士多，点击右上角头像 → 「收款设置」</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-content">
          <h4>填写凭证</h4>
          <p>输入刚才获取的 <code>Client ID</code> 和 <code>Client Key</code></p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-content">
          <h4>保存验证</h4>
          <p>点击「保存配置」，系统会自动验证凭证有效性</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-content">
          <h4>测试通知（重要）</h4>
          <p>保存成功后，点击「🔔 测试通知」按钮验证通知地址是否配置正确</p>
        </div>
      </div>
    </div>
    
    <div class="highlight-box tip">
      <div class="box-icon">💡</div>
      <div class="box-content">
        <strong>建议</strong>
        <p>配置完成后，建议自己购买一次自己的商品进行全流程测试，确保支付和发货都正常。</p>
      </div>
    </div>
    
    <h2>发布步骤</h2>
    
    <h3>1. 进入发布页面</h3>
    <p>点击网站右上角的「+」按钮，进入发布页面。</p>
    
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
          <td>如：某某会员月卡、某某游戏 CDK</td>
          <td>2-50 字符</td>
        </tr>
        <tr>
          <td><strong>物品描述</strong></td>
          <td>详细说明 CDK 内容、使用方法、有效期等</td>
          <td>10-1000 字符</td>
        </tr>
        <tr>
          <td><strong>物品分类</strong></td>
          <td>选择合适的分类</td>
          <td>必选</td>
        </tr>
        <tr>
          <td><strong>价格 (LDC)</strong></td>
          <td>单个 CDK 的售价</td>
          <td>大于 0</td>
        </tr>
        <tr>
          <td><strong>折扣</strong></td>
          <td>可选，用于促销活动</td>
          <td>0.01-1</td>
        </tr>
        <tr>
          <td><strong>物品图片</strong></td>
          <td>商品展示图片</td>
          <td>可选，https 链接</td>
        </tr>
      </tbody>
    </table>
    
    <div class="highlight-box info">
      <div class="box-icon">📝</div>
      <div class="box-content">
        <strong>描述建议</strong>
        <p>CDK 物品的描述应包含：商品内容、使用方式（如在哪里兑换）、有效期限、注意事项等。买家购买后可在订单详情中查看这些说明。</p>
      </div>
    </div>
    
    <h3>3. 选择物品类型</h3>
    <p>在「物品类型」区域选择「🎫 CDK 类型」。</p>
    
    <h3>4. 测试模式（可选）</h3>
    <p>测试模式是为卖家测试支付回调和 CDK 发货流程而设计的特殊模式。</p>
    
    <div class="highlight-box info">
      <div class="box-icon">🧪</div>
      <div class="box-content">
        <strong>测试模式说明</strong>
        <ul style="margin: 8px 0 0; padding-left: 20px;">
          <li><strong>开启后</strong>：只有卖家自己可以购买该商品，其他用户无法购买</li>
          <li><strong>用途</strong>：验证通知地址、回调地址是否配置正确，测试 CDK 发货流程</li>
          <li><strong>标识</strong>：测试模式商品会在商品卡片左上角显示「🧪 测试」标记</li>
          <li><strong>注意</strong>：测试购买会真实扣除 LDC 并发放 CDK，请使用低价测试</li>
        </ul>
      </div>
    </div>
    
    <div class="highlight-box warning">
      <div class="box-icon">⚠️</div>
      <div class="box-content">
        <strong>使用测试模式前</strong>
        <p>如果你需要测试 LDC 应用的通知回调功能，请先在 LDC 集市中将你的应用切换到「测试模式」，这样测试购买不会真正扣除 LDC。</p>
      </div>
    </div>
    
    <h3>5. 添加 CDK 卡密（可选）</h3>
    <p>你可以在发布时直接填入 CDK 卡密，也可以发布后在「我的物品」中管理库存。</p>
    
    <ul>
      <li><strong>批量添加</strong>：在文本框中输入 CDK，每行一个</li>
      <li><strong>后续添加</strong>：发布后在商品管理中随时补充库存</li>
    </ul>
    
    <h3>6. 提交审核</h3>
    <p>点击「发布并上传CDK」按钮提交。审核通过后商品自动上架。</p>
    
    <h2>库存管理</h2>
    
    <p>发布成功后，你可以在「我的物品」中管理 CDK 库存：</p>
    
    <ul>
      <li>📥 <strong>添加库存</strong>：批量导入新的 CDK</li>
      <li>📊 <strong>查看库存</strong>：查看剩余 CDK 数量</li>
      <li>📋 <strong>导出记录</strong>：导出已售出的 CDK 记录</li>
    </ul>
    
    <div class="highlight-box warning">
      <div class="box-icon">⚠️</div>
      <div class="box-content">
        <strong>库存提醒</strong>
        <p>当 CDK 库存为 0 时，商品会自动显示「缺货」状态，买家无法购买。请及时补充库存。</p>
      </div>
    </div>
    
    <h2>交易流程</h2>
    
    <p>买家购买 CDK 物品的完整流程：</p>
    
    <div class="flow-diagram">
      <div class="flow-step">
        <span class="step-icon">🛒</span>
        <span>点击购买</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">💳</span>
        <span>跳转支付</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">🔔</span>
        <span>支付回调</span>
      </div>
      <span class="flow-arrow">→</span>
      <div class="flow-step">
        <span class="step-icon">🎫</span>
        <span>自动发货</span>
      </div>
    </div>
    
    <p>买家支付成功后：</p>
    <ol class="numbered-list">
      <li>LDC 服务器向 LD士多 发送支付成功通知</li>
      <li>LD士多 系统自动从库存中取出一个 CDK</li>
      <li>CDK 写入订单记录，买家可在「我的订单」中查看</li>
      <li>积分转入卖家账户</li>
    </ol>
    
    <h2>收入查看</h2>
    
    <p>在「收款设置」页面可以查看收入统计：</p>
    
    <ul>
      <li>📊 总订单数</li>
      <li>💰 总收入 (LDC)</li>
      <li>📅 本月订单数</li>
      <li>💵 本月收入 (LDC)</li>
    </ul>
    
    <h2>常见问题</h2>
    
    <h3>Q: 买家支付了但没有收到 CDK？</h3>
    <p>可能原因：</p>
    <ul>
      <li>通知地址配置错误 - 请检查 LDC 集市中的通知 URL 是否正确</li>
      <li>CDK 库存为空 - 请检查商品库存</li>
      <li>网络延迟 - 等待几分钟后刷新订单页面</li>
    </ul>
    <p>如问题持续，请联系管理员协助处理。</p>
    
    <h3>Q: 如何修改已上传的 CDK？</h3>
    <p>已上传的 CDK 无法直接修改。如果 CDK 有误，可以删除该库存重新添加。已售出的 CDK 无法删除。</p>
    
    <h3>Q: CDK 会重复发送吗？</h3>
    <p>不会。每个 CDK 只能发送给一个买家，发送后会标记为已使用，不会重复发送。</p>
    
    <h3>Q: 可以设置 CDK 发送顺序吗？</h3>
    <p>系统默认按照添加时间顺序发送（先添加的先发送）。暂不支持自定义顺序。</p>
    
    <h3>Q: 发布 CDK 物品需要手续费吗？</h3>
    <p>LD士多 平台目前不收取手续费。但 LDC 支付可能有官方的交易费用，具体以 LDC 官方说明为准。</p>
    
    <h3>Q: 测试模式商品可以被其他人购买吗？</h3>
    <p>不能。开启测试模式的商品只允许卖家自己购买，其他用户看到的购买按钮会显示「🧪 测试商品」且无法点击。</p>
    
    <h3>Q: 如何关闭测试模式？</h3>
    <p>在「我的物品」中找到对应商品，点击编辑，关闭测试模式开关后保存即可。关闭后其他用户就可以正常购买了。</p>
  </div>
</template>

<script setup>
// 发布 CDK 物品文档
</script>

<style scoped>
@import './doc-styles.css';
</style>
