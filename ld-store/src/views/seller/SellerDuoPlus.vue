<template>
  <div class="duo-page" :aria-busy="loading || busy">
    <SellerPageToolbar eyebrow="推广 / DUO+" description="让合适的买家看到你的物品，按有效曝光交付。">
      <template #actions><SellerButton :disabled="loading || busy" @click="load()">{{ loading ? '更新中…' : '刷新进度' }}</SellerButton></template>
    </SellerPageToolbar>
    <div class="duo-intro"><div><span class="duo-kicker">DUO+</span><h2>多一次被看见的机会</h2><p>在“全部”和物品所属分类的默认推荐中展示。仅推广展示消耗额度，自然曝光不扣量。</p></div><router-link to="/seller/services">查看甄选与优选服务</router-link></div>
    <p v-if="error" class="duo-alert" role="alert">{{ error }} <button :disabled="loading || busy" @click="load()">重试</button></p>
    <p v-if="notice" class="duo-notice" role="status">{{ notice }}</p>
    <section class="duo-card" aria-labelledby="duo-buy-title">
      <h2 id="duo-buy-title">购买曝光套餐</h2>
      <p v-if="!options?.settings.purchaseEnabled" class="duo-muted">暂未开放购买。套餐与分类容量准备完成后开放，已有权益可在下方查看。</p>
      <form v-if="options" @submit.prevent="purchase">
        <div class="duo-fields"><label>推广物品<select v-model="productId" :disabled="busy"><option value="">选择物品</option><option v-for="p in options.products" :key="p.id" :value="p.id">{{ p.name }}{{ p.reason ? ` · ${p.reason}` : '' }}</option></select></label>
        <label>曝光套餐<select v-model="packageId" :disabled="busy"><option value="">选择套餐</option><option v-for="p in options.packages" :key="p.id" :value="p.id">{{ p.name }} · {{ p.target }} 次 / {{ p.price }} LDC</option></select></label></div>
        <div v-if="currentPackage" class="duo-summary"><strong>{{ currentPackage.target.toLocaleString() }} 次有效曝光</strong><span>{{ currentPackage.price }} LDC · 预计 {{ currentPackage.expected_days }} 天</span></div>
        <details class="duo-rules" open><summary>曝光与交付规则</summary><ul><li>已登录用户前台看见卡片至少 50%，持续 1 秒，才计有效曝光。</li><li>同账号同物品每天最多计 1 次，首页与分类合并去重，卖家自览不计。</li><li>不保证点击、成交或固定名次；预计周期内未完成将免费延长，剩余额度不失效。</li><li>缺货、下架或禁售会暂停投放。永久无法投放时，可联系站长审核转移至本人的合格物品。</li><li>不支持退款；同一物品不能同时开通置顶与未完成 DUO+。</li></ul></details>
        <label class="duo-accept"><input v-model="accepted" type="checkbox" :disabled="busy">我已阅读并接受以上规则</label>
        <p v-if="reason" class="duo-muted" id="duo-purchase-reason">{{ reason }}</p>
        <SellerButton type="submit" variant="primary" :disabled="!!reason || busy || loading" aria-describedby="duo-purchase-reason">{{ busy ? '正在处理…' : '创建 LDC 支付订单' }}</SellerButton>
      </form>
    </section>
    <section class="duo-card" aria-labelledby="duo-progress-title"><h2 id="duo-progress-title">曝光进度</h2><p class="duo-muted">{{ records.updatedAt ? `更新于 ${formatTime(records.updatedAt)}` : '正在读取进度…' }}</p>
      <p v-if="!loading && !records.campaigns.length" class="duo-empty">还没有推广活动。开通后可在这里查看实际交付与剩余额度。</p>
      <div class="duo-campaigns"><article v-for="c in records.campaigns" :key="c.id" class="duo-campaign">
        <div class="duo-row"><strong>{{ c.product_name || `物品 #${c.product_id}` }} <span v-if="c.internal">· 内部试投</span></strong><span>{{ status(c.state) }}{{ c.extended ? ' · 已延长交付' : '' }}</span></div>
        <p><strong class="duo-number">{{ c.delivered.toLocaleString() }}</strong> / {{ c.target.toLocaleString() }} 次有效曝光</p>
        <progress :value="c.delivered" :max="c.target" :aria-label="`物品 ${c.product_id} 已完成 ${c.delivered}，目标 ${c.target}`"></progress>
        <div class="duo-row duo-muted"><span>剩余 {{ c.remaining }} 次</span><span>{{ c.expected_at ? `预计周期至 ${formatTime(c.expected_at)}` : '等待排期' }}</span></div>
        <p class="duo-muted">今日交付 {{ c.today_impressions ?? 0 }} 次 · 推广去重点击 {{ c.clicks ?? 0 }} 次</p>
        <p v-if="c.pause_reason" class="duo-muted">暂停原因：{{ pauseReason(c.pause_reason) }}</p>
        <div class="duo-actions"><SellerButton :disabled="busy" @click="showDetail(c)">每日明细</SellerButton><SellerButton v-if="c.state === 'active'" :disabled="busy" @click="campaignAction(c, 'pause')">暂停</SellerButton><SellerButton v-if="['paused', 'waiting'].includes(c.state)" :disabled="busy" @click="campaignAction(c, 'resume')">恢复并重新排期</SellerButton></div>
      </article></div>
      <div v-if="detail" class="duo-detail"><h3>物品 #{{ detail.campaign.product_id }} 的每日交付</h3><p v-if="!detail.series.length" class="duo-muted">尚无交付数据，完成时间估算中。</p><div v-for="d in detail.series" :key="d.day" class="duo-row"><span>{{ String(d.day).slice(0, 10) }}</span><span>{{ d.impressions }} 次曝光 · {{ d.clicks }} 次去重点击</span></div><p class="duo-muted">点击用于观察，不消耗套餐额度；不代表独立成交。</p></div>
    </section>
    <section class="duo-card" aria-labelledby="duo-orders-title"><h2 id="duo-orders-title">购买记录</h2><p v-if="!records.orders.length" class="duo-muted">暂无购买记录。</p>
      <article v-for="o in records.orders" :key="o.orderNo" class="duo-order"><div class="duo-row"><strong>{{ o.package.name }}</strong><span>{{ orderStatus(o.status) }} · {{ o.amount }} LDC</span></div><p class="duo-order-no">{{ o.orderNo }}</p><div class="duo-actions"><a v-if="safePaymentUrl(o.paymentUrl)" class="duo-pay" :href="safePaymentUrl(o.paymentUrl)" target="_blank" rel="noopener noreferrer">继续支付</a><SellerButton v-if="o.status !== 'paid'" :disabled="busy" @click="orderAction(o, 'refresh')">核对支付</SellerButton><SellerButton v-if="o.status === 'pending'" :disabled="busy" @click="orderAction(o, 'cancel')">关闭未支付订单</SellerButton></div></article>
      <div class="duo-actions"><SellerButton :disabled="page <= 1 || busy || loading" @click="page--; load()">上一页</SellerButton><span>第 {{ page }} 页</span><SellerButton :disabled="busy || loading || (records.orders.length < 50 && records.campaigns.length < 50)" @click="page++; load()">下一页</SellerButton></div>
    </section>
  </div>
</template>
<script setup>
import SellerPageToolbar from '@/components/seller/SellerPageToolbar.vue'
import SellerButton from '@/components/seller/SellerButton.vue'
import { useDuoPlus } from '@/composables/useDuoPlus'
const { options, records, detail, loading, busy, error, notice, productId, packageId, accepted, currentPackage, reason, page, load, purchase, orderAction, campaignAction, showDetail } = useDuoPlus()
const status = s => ({ active: '投放中', paused: '已暂停', waiting: '等待排期', completed: '已完成' }[s] || s)
const orderStatus = s => ({ pending: '待支付', closed: '已关闭', paid: '已支付', review: '待人工核对' }[s] || s)
const pauseReason = s => ({ manual: '手动暂停', product_unavailable: '商品不可售或分类变化', payment_requires_scheduling: '付款已确认，等待重新排期' }[s] || s)
function formatTime(v) { return new Date(v).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) }
function safePaymentUrl(v) { try { const u = new URL(v); return u.protocol === 'https:' ? u.href : '' } catch { return '' } }
</script>
<style scoped>
.duo-page { display:grid; gap:24px; color:var(--seller-ink); }
.duo-intro { display:flex; align-items:center; justify-content:space-between; gap:24px; padding:28px; border:1px solid var(--seller-border); border-radius:18px; background:var(--seller-surface-soft); }
.duo-intro h2 { margin:8px 0; font-size:26px; line-height:1.3; }
.duo-intro p { max-width:56ch; margin:0; color:var(--seller-muted); line-height:1.7; }
.duo-intro a { color:var(--seller-jade); font-weight:650; white-space:nowrap; }
.duo-kicker { font-weight:750; letter-spacing:.12em; color:var(--seller-jade); }
.duo-card { min-width:0; padding:24px; border:1px solid var(--seller-border); border-radius:16px; background:var(--seller-surface); }
.duo-card h2 { margin:0 0 16px; font-size:20px; }.duo-card h3 { font-size:16px; }
.duo-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin-bottom:20px; }
.duo-fields label { display:grid; gap:8px; font-size:14px; font-weight:600; }
.duo-fields select { width:100%; min-width:0; min-height:44px; padding:10px; border:1px solid var(--seller-border); border-radius:10px; color:var(--seller-ink); background:var(--seller-surface); }
.duo-summary,.duo-row { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }
.duo-summary { padding:16px; border-radius:10px; background:var(--seller-surface-soft); }
.duo-rules { margin:20px 0; line-height:1.8; font-size:14px; }.duo-rules summary { cursor:pointer; font-weight:650; }.duo-rules ul { padding-left:20px; }
.duo-accept { display:flex; align-items:center; gap:10px; margin:16px 0; font-size:14px; }.duo-accept input { width:20px; height:20px; }
.duo-muted { color:var(--seller-muted); font-size:13px; line-height:1.7; }.duo-alert,.duo-notice { margin:0; padding:16px; border:1px solid var(--seller-border); border-radius:12px; overflow-wrap:anywhere; }.duo-alert { color:var(--seller-danger); }
.duo-campaigns { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr)); gap:16px; }.duo-campaign { padding:20px; border:1px solid var(--seller-border); border-radius:12px; }.duo-number { font-size:28px; font-variant-numeric:tabular-nums; }
progress::-webkit-progress-bar { background:var(--seller-surface-soft); border-radius:8px; }
progress::-webkit-progress-value { background:var(--seller-jade); border-radius:8px; }
progress::-moz-progress-bar { background:var(--seller-jade); border-radius:8px; }
progress { border:0; border-radius:8px; overflow:hidden; width:100%; height:12px; accent-color:var(--seller-jade); margin:0 0 10px; }.duo-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:16px; }.duo-detail { padding-top:20px; margin-top:20px; border-top:1px solid var(--seller-border); }.duo-detail .duo-row { padding:10px 0; }
.duo-order { padding:16px 0; border-bottom:1px solid var(--seller-border); }.duo-order-no { color:var(--seller-muted); font-size:12px; overflow-wrap:anywhere; }.duo-pay { display:inline-flex; align-items:center; min-height:44px; padding:0 14px; color:var(--seller-jade); border:1px solid var(--seller-border); border-radius:10px; }.duo-empty { padding:20px 0; color:var(--seller-muted); }
@media(max-width:640px) { .duo-intro { flex-direction:column; align-items:flex-start; padding:20px; }.duo-card { padding:16px; }.duo-fields { grid-template-columns:1fr; }.duo-intro h2 { font-size:23px; } }
</style>
