import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { duoApi } from '@/services/shop/duoPlusService'
import { authSession, captureAuthSession, isAuthSessionCurrent } from '@/utils/auth'
export function useDuoPlus() {
  const options = ref(null), records = ref({ orders: [], campaigns: [] }), detail = ref(null)
  const loading = ref(false), busy = ref(false), error = ref(''), notice = ref('')
  const productId = ref(''), packageId = ref(''), accepted = ref(false), requestKey = ref(''), page = ref(1)
  let timer, stopped = false, generation = 0
  const currentProduct = computed(() => options.value?.products.find(p => String(p.id) === String(productId.value)))
  const currentPackage = computed(() => options.value?.packages.find(p => String(p.id) === String(packageId.value)))
  const reason = computed(() => !options.value?.settings.purchaseEnabled ? '暂未开放购买，已有权益可继续查看' : !currentProduct.value ? '请选择商品' : currentProduct.value.reason || (!currentPackage.value ? '请选择套餐' : !accepted.value ? '请先阅读并接受曝光规则' : ''))
  async function unwrap(promise, session) {
    const r = await promise
    if (stopped || !isAuthSessionCurrent(session)) throw new Error('登录身份已变化，请重新加载')
    if (!r.success) throw new Error(r.error || '请求失败，请重试')
    return r.data
  }
  async function load(silent = false) {
    if (loading.value || busy.value) return
    const session = captureAuthSession(), g = ++generation
    loading.value = true
    if (!silent) error.value = ''
    try {
      const [o, r] = await Promise.all([unwrap(duoApi.options(), session), unwrap(duoApi.list(page.value), session)])
      if (g !== generation || stopped) return
      options.value = o; records.value = r
      if (detail.value) detail.value = await unwrap(duoApi.detail(detail.value.campaign.id), session)
    } catch (e) { if (g === generation) error.value = e.message } finally { if (g === generation) loading.value = false }
  }
  async function mutate(fn) {
    if (busy.value) return
    const session = captureAuthSession()
    busy.value = true; error.value = ''; notice.value = ''
    try { await fn(session) } catch (e) { if (isAuthSessionCurrent(session)) error.value = e.message } finally { busy.value = false }
    await load(true)
  }
  async function purchase() {
    if (reason.value) return
    if (!requestKey.value) requestKey.value = crypto.randomUUID()
    await mutate(async session => {
      const o = await unwrap(duoApi.create({ productId: Number(productId.value), packageId: Number(packageId.value), requestKey: requestKey.value }), session)
      notice.value = o.paymentUrl ? '订单已创建，请在下方购买记录中继续支付。' : '订单已保留，正在核实支付链接，请勿重复下单。'
      requestKey.value = ''
    })
  }
  const orderAction = (o, action) => mutate(async s => { await unwrap(duoApi.orderAction(o.orderNo, action), s); notice.value = action === 'cancel' ? '已核对并处理订单。' : '已核对支付状态。' })
  const campaignAction = (c, action) => mutate(async s => { await unwrap(duoApi.campaignAction(c.id, action), s); notice.value = action === 'pause' ? '已暂停，剩余额度保留。' : '已恢复活动并重新排期。' })
  const showDetail = (c) => mutate(async s => { detail.value = await unwrap(duoApi.detail(c.id), s) })
  watch([productId, packageId], () => { requestKey.value = ''; accepted.value = false })
  watch(() => authSession.value.revision, () => {
    generation++; options.value = null; records.value = { orders: [], campaigns: [] }; detail.value = null
    productId.value = ''; packageId.value = ''; requestKey.value = ''; loading.value = false
    void load()
  })
  const refreshVisible = () => { if (document.visibilityState === 'visible') void load(true) }
  onMounted(() => { void load(); timer = window.setInterval(refreshVisible, 30000); document.addEventListener('visibilitychange', refreshVisible) })
  onUnmounted(() => { stopped = true; generation++; window.clearInterval(timer); document.removeEventListener('visibilitychange', refreshVisible) })
  return { options, records, detail, loading, busy, error, notice, productId, packageId, accepted, currentProduct, currentPackage, reason, page, load, purchase, orderAction, campaignAction, showDetail }
}
