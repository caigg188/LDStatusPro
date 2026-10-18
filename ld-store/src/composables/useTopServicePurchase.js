import { normalizeResourceId } from '@/utils/resourceId'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchProductImagesRequest } from '@/services/shop/inventoryService'
import {
  cancelTopServiceOrderRequest,
  createTopServiceOrderRequest,
  fetchTopServiceOptionsRequest,
  fetchTopServiceOrdersRequest,
  getTopServicePaymentUrlRequest,
  refreshTopServiceOrderRequest
} from '@/services/shop/topServiceService'
import { useDialog } from '@/composables/useDialog'
import { cleanupPreparedTab, preparePaymentPopup, openPaymentPopup, watchPaymentPopup } from '@/utils/newTab'
import {
  canPayTopServiceOrder, canCancelTopServiceOrder, getTopServiceError,
  getTopServicePaymentRemainingSeconds, topServiceQuoteChanged
} from '@/utils/topServiceOrder'

const emptyPagination = () => ({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
const ORDER_POLL_INTERVAL_MS = 15000
const AUTO_VERIFY_COOLDOWN_MS = 30000
const hasImageField = product => product.imageUrl !== undefined

export function useTopServicePurchase() {
  const route = useRoute()
  const router = useRouter()
  const dialog = useDialog()
  const packages = ref([])
  const products = ref([])
  const optionsLoading = ref(false)
  const optionsLoaded = ref(false)
  const optionsError = ref('')
  const selectionNotice = ref('')
  const selectedProductId = ref('')
  const selectedPackageType = ref('')
  const selectedDurationDays = ref(0)
  const submitting = ref(false)
  const uncertainProductId = ref(0)
  let uncertainProductName = ''
  const purchaseError = ref('')
  const focusedOrder = ref(null)
  const focusLoading = ref(false)
  const focusError = ref('')
  const orderNotice = ref('')
  const orderFeedback = ref('')
  const fallbackPaymentUrl = ref('')
  const orderClockMs = ref(Date.now())
  const orderActions = ref({})
  const orders = ref([])
  const ordersLoading = ref(false)
  const ordersError = ref('')
  const orderSearch = ref('')
  const orderFilterStatus = ref('')
  const pagination = ref(emptyPagination())
  let disposed = false
  let optionsFlight = null
  let imagesFlight = null
  const productImages = new Map()
  let ordersSequence = 0
  let focusSequence = 0
  let timer = null
  let lastPollAt = 0
  let expiryChecked = ''
  const reads = new Map()
  const mutations = new Map()
  const revisions = new Map()
  const lastVerifications = new Map()
  const popupCleanups = new Set()

  const selectedProduct = computed(() => products.value.find(p => String(p.id) === String(selectedProductId.value)) || null)
  const selectedGroup = computed(() => packages.value.find(p => p.type === selectedPackageType.value) || null)
  const selectedConfig = computed(() => {
    const option = selectedGroup.value?.options?.find(o => Number(o.durationDays) === Number(selectedDurationDays.value) && o.isEnabled)
    return option ? { ...option, packageType: selectedGroup.value.type, groupName: selectedGroup.value.name } : null
  })
  const pendingOrders = computed(() => products.value.map(p => p.currentTopOrder).filter(o => o?.status === 'pending'))
  const submitReason = computed(() => {
    if (submitting.value) return '正在创建订单，请稍候'
    if (uncertainProductId.value) return '请先核对上一笔订单是否已创建'
    if (optionsError.value || !optionsLoaded.value) return '服务信息未更新，请先重新加载'
    if (optionsLoading.value) return '正在更新名额与方案'
    if (!selectedProduct.value) return '请选择需要推广的物品'
    if (selectedProduct.value.currentTopOrder) return '该物品已有进行中的服务，请先查看订单状态'
    if (!selectedGroup.value) return '请选择推广服务'
    if (!selectedConfig.value) return '请选择服务时长'
    if (!Number.isFinite(Number(selectedConfig.value.price)) || Number(selectedConfig.value.price) <= 0) return '方案价格暂不可用，请刷新后重试'
    const quota = selectedProduct.value.quota || {}
    const remaining = Number(selectedGroup.value.type === 'global' ? quota.globalRemaining : quota.categoryRemaining)
    if (!Number.isFinite(remaining)) return '暂未取得可用名额，请刷新后重试'
    if (remaining <= 0) return '所选服务名额已满，请刷新或更换服务'
    return ''
  })
  const canSubmit = computed(() => !submitReason.value)

  function resetPlan() {
    selectedPackageType.value = ''
    selectedDurationDays.value = 0
  }

  async function selectProduct(id) {
    if (submitting.value || uncertainProductId.value) return
    selectedProductId.value = String(id)
    resetPlan()
    selectionNotice.value = ''
    purchaseError.value = ''
    clearFocus()
    if (selectedProduct.value?.currentTopOrder) await focusOrder(selectedProduct.value.currentTopOrder)
  }

  function selectService(type) {
    if (submitting.value) return
    selectedPackageType.value = type
    selectedDurationDays.value = 0
    selectionNotice.value = ''
  }

  function selectDuration(days) {
    if (submitting.value) return
    selectedDurationDays.value = Number(days)
    selectionNotice.value = ''
  }

  function loadOptions() {
    if (disposed) return Promise.resolve(false)
    if (optionsFlight) return optionsFlight
    optionsFlight = (async () => {
      optionsLoading.value = true
      const previous = selectedConfig.value ? { amount: selectedConfig.value.price, categoryId: selectedProduct.value?.categoryId } : null
      try {
        const response = await fetchTopServiceOptionsRequest()
        if (!response?.success) throw new Error(getTopServiceError(response, '无法加载服务信息，请重试'))
        if (disposed) return false
        packages.value = Array.isArray(response.data?.packages) ? response.data.packages : []
        products.value = (Array.isArray(response.data?.products) ? response.data.products : []).map(product =>
          !hasImageField(product) && productImages.has(String(product.id))
            ? { ...product, imageUrl: productImages.get(String(product.id)) } : product)
        void loadProductImages()
        optionsError.value = ''
        optionsLoaded.value = true
        if (selectedProductId.value && !selectedProduct.value) {
          selectedProductId.value = ''
          resetPlan()
          selectionNotice.value = '原物品已不符合开通条件，请重新选择。'
        } else if (previous && (!selectedConfig.value || Number(previous.amount) !== Number(selectedConfig.value.price) || Number(previous.categoryId) !== Number(selectedProduct.value?.categoryId))) {
          resetPlan()
          selectionNotice.value = '物品分类或方案价格已更新，请重新选择并核对费用。'
        }
        return true
      } catch (error) {
        if (!disposed) optionsError.value = error.message || '无法更新服务信息，请重试'
        return false
      } finally {
        optionsLoading.value = false
      }
    })().finally(() => { optionsFlight = null })
    return optionsFlight
  }

  function loadProductImages() {
    if (disposed) return Promise.resolve()
    if (imagesFlight) return imagesFlight
    const missingIds = new Set(products.value.filter(p => !hasImageField(p)).map(p => String(p.id)))
    if (!missingIds.size) return Promise.resolve()
    products.value = products.value.map(p => missingIds.has(String(p.id)) ? { ...p, imageLoading: true, imageError: false } : p)
    // Older options responses omit images. Only enrich the cover from the
    // seller's existing list; price, category and quota still come from options.
    imagesFlight = (async () => {
      try {
        let page = 1
        let totalPages = 1
        do {
          const response = await fetchProductImagesRequest({ status: 'approved', page, pageSize: 100, timeout: 8000 })
          if (disposed) return
          if (!response?.success || !Array.isArray(response.data?.products)) throw new Error('图片暂未加载')
          for (const product of response.data.products) {
            const id = String(product.id)
            if (!missingIds.has(id)) continue
            productImages.set(id, String(product.imageUrl || '').trim())
            missingIds.delete(id)
          }
          products.value = products.value.map(p => !hasImageField(p) && productImages.has(String(p.id))
            ? { ...p, imageUrl: productImages.get(String(p.id)), imageLoading: false, imageError: false } : p)
          totalPages = Number(response.data.pagination?.totalPages || 1)
          page++
        } while (missingIds.size && page <= totalPages)
      } catch {
        // A cover lookup must never invalidate an otherwise valid purchase quote.
      } finally {
        if (!disposed) products.value = products.value.map(p => !hasImageField(p) ? { ...p, imageLoading: false, imageError: true } : p)
      }
    })().finally(() => { imagesFlight = null })
    return imagesFlight
  }

  async function loadOrders(page = 1) {
    if (disposed) return
    const sequence = ++ordersSequence
    ordersLoading.value = true
    try {
      const response = await fetchTopServiceOrdersRequest({
        status: orderFilterStatus.value,
        search: orderSearch.value,
        page,
        pageSize: 20
      })
      if (!response?.success) throw new Error(getTopServiceError(response, '无法读取购买记录，请重试'))
      if (disposed || sequence !== ordersSequence) return
      orders.value = response.data?.orders || []
      pagination.value = response.data?.pagination || emptyPagination()
      ordersError.value = ''
    } catch (error) {
      if (!disposed && sequence === ordersSequence) ordersError.value = error.message
    } finally {
      if (sequence === ordersSequence) ordersLoading.value = false
    }
  }

  function applyOrder(order) {
    if (disposed) return
    if (focusedOrder.value?.orderNo === order.orderNo) focusedOrder.value = order
    orders.value = orders.value.map(o => o.orderNo === order.orderNo ? order : o)
    const ongoing = ['pending', 'active', 'suspended'].includes(order.status)
    products.value = products.value.map(p => String(p.id) === String(order.productId)
      ? { ...p, currentTopOrder: ongoing ? order : (p.currentTopOrder?.orderNo === order.orderNo ? null : p.currentTopOrder) } : p)
    if (focusedOrder.value?.orderNo === order.orderNo && !canPayTopServiceOrder(order)) fallbackPaymentUrl.value = ''
  }

  function readOrder(orderNo) {
    if (disposed) return Promise.reject(new Error('页面已关闭'))
    const revision = revisions.get(orderNo) || 0
    const key = `${orderNo}:${revision}`
    if (reads.has(key)) return reads.get(key)
    const request = (async () => {
      const response = await fetchTopServiceOrdersRequest({ search: orderNo, page: 1, pageSize: 20 })
      if (!response?.success) throw new Error(getTopServiceError(response, '订单状态暂未更新，请重试，不要重复付款。'))
      const order = response.data?.orders?.find(o => o.orderNo === orderNo)
      if (!order) throw new Error('未找到这笔订单，请检查订单号或当前登录账号。')
      // An older read must not roll back a payment/cancellation that started later.
      if ((revisions.get(orderNo) || 0) !== revision) return readOrder(orderNo)
      applyOrder(order)
      return order
    })().finally(() => reads.delete(key))
    reads.set(key, request)
    return request
  }

  function updateOrderQuery(orderNo) {
    const query = { ...route.query }
    if (orderNo) query.orderNo = orderNo
    else delete query.orderNo
    if (String(route.query.orderNo || '') !== String(orderNo || '')) void router.replace({ query })
  }

  function clearFocus() {
    focusSequence++
    focusedOrder.value = null
    focusError.value = ''
    orderNotice.value = ''
    orderFeedback.value = ''
    fallbackPaymentUrl.value = ''
    focusLoading.value = false
    updateOrderQuery('')
  }

  async function focusOrder(orderOrNo, { syncQuery = true } = {}) {
    const orderNo = typeof orderOrNo === 'string' ? orderOrNo : orderOrNo?.orderNo
    if (!orderNo) return
    const sequence = ++focusSequence
    const changing = focusedOrder.value?.orderNo !== orderNo
    lastPollAt = Date.now()
    if (changing) {
      orderNotice.value = ''
      orderFeedback.value = ''
      fallbackPaymentUrl.value = ''
    }
    focusedOrder.value = typeof orderOrNo === 'object' ? orderOrNo : (changing ? null : focusedOrder.value)
    focusLoading.value = true
    focusError.value = ''
    if (syncQuery) updateOrderQuery(orderNo)
    try {
      const order = await readOrder(orderNo)
      if (!disposed && sequence === focusSequence) focusedOrder.value = order
    } catch (error) {
      if (!disposed && sequence === focusSequence) focusError.value = error.message
    } finally {
      if (sequence === focusSequence) focusLoading.value = false
    }
  }

  async function refreshRelated() {
    if (disposed) return
    const tasks = [loadOptions()]
    if (route.query.tab === 'orders') tasks.push(loadOrders(pagination.value.page || 1))
    await Promise.all(tasks)
  }

  function runAction(order, type, action) {
    if (mutations.has(order.orderNo)) return mutations.get(order.orderNo)
    revisions.set(order.orderNo, (revisions.get(order.orderNo) || 0) + 1)
    orderActions.value = { ...orderActions.value, [order.orderNo]: type }
    const request = action().finally(() => {
      const next = { ...orderActions.value }
      delete next[order.orderNo]
      orderActions.value = next
      mutations.delete(order.orderNo)
    })
    mutations.set(order.orderNo, request)
    return request
  }

  function feedback(orderNo, text) {
    if (!disposed && focusedOrder.value?.orderNo === orderNo) orderFeedback.value = text
  }

  function refreshOrder(order = focusedOrder.value, { manual = true } = {}) {
    if (!order?.orderNo || disposed) return Promise.resolve()
    if (!manual && document.visibilityState === 'hidden') return Promise.resolve()
    order = focusedOrder.value?.orderNo === order.orderNo ? focusedOrder.value : orders.value.find(o => o.orderNo === order.orderNo) || order
    const unresolvedRefund = order.paymentReversalStatus && order.paymentReversalStatus !== 'refunded'
    if (order.status !== 'pending' && !(manual && unresolvedRefund)) return Promise.resolve()
    if (!manual && order.paymentReversalStatus) return Promise.resolve()
    if (mutations.has(order.orderNo)) return mutations.get(order.orderNo)
    if (!manual && Date.now() - (lastVerifications.get(order.orderNo) || 0) < AUTO_VERIFY_COOLDOWN_MS) return Promise.resolve()
    lastVerifications.set(order.orderNo, Date.now())
    lastPollAt = Date.now()
    return runAction(order, 'refresh', async () => {
      feedback(order.orderNo, unresolvedRefund ? '正在检查退款进度，请勿重复付款。' : '正在检查 Credit 支付结果，请勿重复付款。')
      try {
        const response = await refreshTopServiceOrderRequest(order.orderNo)
        if (!response?.success) throw new Error(getTopServiceError(response, '暂时无法核验支付结果，请稍后重试，不要重复付款。'))
        const latest = await readOrder(order.orderNo)
        lastPollAt = Date.now()
        feedback(order.orderNo, latest.status === 'pending' && !latest.paymentReversalStatus ? '暂未确认付款。如已支付，请稍后再次检查，不要重复付款。' : '')
        if (focusedOrder.value?.orderNo === order.orderNo) focusError.value = ''
        if (latest.status !== order.status || latest.paymentReversalStatus !== order.paymentReversalStatus) await refreshRelated()
      } catch (error) {
        feedback(order.orderNo, error.message)
      }
    })
  }

  function launchPayment(order, preparedWindow) {
    if (disposed || !canPayTopServiceOrder(order) || !order.paymentUrl) {
      cleanupPreparedTab(preparedWindow)
      return
    }
    if (!preparedWindow || preparedWindow.closed) {
      fallbackPaymentUrl.value = order.paymentUrl
      feedback(order.orderNo, '浏览器未打开支付窗口，请点击“继续支付”在新标签页打开。')
      return
    }
    try {
      const { popup } = openPaymentPopup(order.paymentUrl, preparedWindow)
      if (popup) {
        let stop = () => {}
        stop = watchPaymentPopup(popup, () => {
          popupCleanups.delete(stop)
          if (!disposed) void refreshOrder(order, { manual: false })
        })
        popupCleanups.add(stop)
      }
      feedback(order.orderNo, '请在 Credit 完成支付。返回后会自动核验，也可以手动核验结果。')
    } catch {
      cleanupPreparedTab(preparedWindow)
      fallbackPaymentUrl.value = order.paymentUrl
      feedback(order.orderNo, '未能打开支付窗口，请点击“继续支付”在新标签页打开。')
    }
  }

  async function reconcileCreation() {
    const productId = uncertainProductId.value
    if (!productId) return
    const loaded = await loadOptions()
    if (!loaded || disposed) return
    let existing = products.value.find(p => normalizeResourceId(p.id) === productId)?.currentTopOrder
    // The product may have been taken off sale while creation was in flight, so
    // absence from purchase options alone cannot establish that no order exists.
    if (!existing) {
      try {
        let page = 1
        let totalPages = 1
        do {
          const response = await fetchTopServiceOrdersRequest({
            search: uncertainProductName.slice(0, 80),
            page,
            pageSize: 100
          })
          if (!response?.success) throw new Error(getTopServiceError(response, '暂时无法核对购买记录，请重试，不要重复下单。'))
          if (disposed) return
          existing = response.data?.orders?.find(order => normalizeResourceId(order.productId) === productId && ['pending', 'active', 'suspended'].includes(order.status))
          totalPages = Number(response.data?.pagination?.totalPages || 1)
          page++
        } while (!existing && page <= totalPages)
      } catch (error) {
        purchaseError.value = error.message
        return
      }
    }
    if (existing) {
      await focusOrder(existing)
      purchaseError.value = ''
      orderNotice.value = '已找到这件物品的服务订单，请核对后继续处理，不要重复下单。'
    } else {
      purchaseError.value = '暂未查到进行中的订单。请先检查购买记录；确认没有订单后，可重新下单。'
    }
    uncertainProductId.value = 0
  }

  async function submitOrder() {
    if (!canSubmit.value || submitting.value) return
    const quote = Object.freeze({
      productId: normalizeResourceId(selectedProduct.value.id), productName: selectedProduct.value.name, categoryId: Number(selectedProduct.value.categoryId),
      packageType: selectedConfig.value.packageType, durationDays: Number(selectedConfig.value.durationDays), amount: Number(selectedConfig.value.price)
    })
    submitting.value = true
    purchaseError.value = ''
    const preparedWindow = preparePaymentPopup()
    try {
      const response = await createTopServiceOrderRequest({
        productId: quote.productId, packageType: quote.packageType, durationDays: quote.durationDays
      })
      if (disposed) { cleanupPreparedTab(preparedWindow); return }
      if (!response?.success) {
        cleanupPreparedTab(preparedWindow)
        purchaseError.value = getTopServiceError(response, '未能确认订单创建结果，请先核对订单。')
        if (!response?.status || response.status >= 500 || (response.errorCode || response.code) === 'TOP_SERVICE_EXISTS') {
          uncertainProductId.value = quote.productId
          uncertainProductName = quote.productName
          await reconcileCreation()
        } else await loadOptions()
        return
      }
      const order = response.data?.order || (response.data?.orderNo ? await readOrder(response.data.orderNo) : null)
      if (!order?.orderNo) throw new Error('订单信息不完整，请先核对购买记录。')
      focusedOrder.value = order
      focusError.value = ''
      orderFeedback.value = ''
      orderNotice.value = ''
      updateOrderQuery(order.orderNo)
      applyOrder(order)
      if (topServiceQuoteChanged(quote, order)) {
        cleanupPreparedTab(preparedWindow)
        orderNotice.value = '订单价格或绑定分类已更新。请核对以下实际订单信息，确认无误后再继续支付。'
      } else launchPayment(order, preparedWindow)
      void refreshRelated()
    } catch (error) {
      cleanupPreparedTab(preparedWindow)
      if (disposed) return
      purchaseError.value = error.message || '暂未确认订单创建结果，请先核对订单。'
      uncertainProductId.value = quote.productId
      uncertainProductName = quote.productName
      await reconcileCreation()
    } finally {
      submitting.value = false
    }
  }

  function repayOrder(order) {
    if (!canPayTopServiceOrder(order) || mutations.has(order.orderNo) || disposed) return
    const preparedWindow = preparePaymentPopup()
    return runAction(order, 'pay', async () => {
      try {
        const response = await getTopServicePaymentUrlRequest(order.orderNo)
        if (!response?.success || !response.data?.paymentUrl) throw new Error(getTopServiceError(response, '支付链接不可用，请核验订单状态。'))
        const latest = await readOrder(order.orderNo)
        if (disposed) { cleanupPreparedTab(preparedWindow); return }
        if (focusedOrder.value?.orderNo !== order.orderNo) {
          focusedOrder.value = latest
          updateOrderQuery(latest.orderNo)
        }
        if (topServiceQuoteChanged({ ...order, categoryId: order.boundCategoryId ?? order.categoryId }, latest)) {
          cleanupPreparedTab(preparedWindow)
          orderNotice.value = '订单金额、分类或时长已更新。请核对最新订单信息，再继续支付。'
          return
        }
        launchPayment({ ...latest, paymentUrl: response.data.paymentUrl }, preparedWindow)
      } catch (error) {
        cleanupPreparedTab(preparedWindow)
        feedback(order.orderNo, error.message)
      }
    })
  }

  function cancelOrder(order) {
    if (!canCancelTopServiceOrder(order) || mutations.has(order.orderNo) || disposed) return
    return runAction(order, 'confirm-cancel', async () => {
      const confirmed = await dialog.confirm('取消后会立即释放名额，操作不可撤销。若已经打开 Credit 支付页，请不要再继续付款。', {
        title: '取消待支付订单', confirmText: '确认取消', cancelText: '保留订单', danger: true
      })
      if (!confirmed || disposed) return
      orderActions.value = { ...orderActions.value, [order.orderNo]: 'cancel' }
      try {
        const response = await cancelTopServiceOrderRequest(order.orderNo)
        // Always read the authoritative result: payment may win the cancellation race.
        await readOrder(order.orderNo)
        feedback(order.orderNo, response?.success ? '' : getTopServiceError(response, '未能取消，请核对最新订单状态。'))
        await refreshRelated()
      } catch (error) {
        feedback(order.orderNo, error.message || '取消结果暂未确认，请刷新核验。')
      }
    })
  }

  function tick() {
    const now = Date.now()
    orderClockMs.value = now
    const order = focusedOrder.value
    if (document.visibilityState === 'hidden' || route.query.tab === 'board' || !order || order.status !== 'pending' || order.paymentReversalStatus || mutations.has(order.orderNo)) return
    const expired = getTopServicePaymentRemainingSeconds(order, now) === 0 && expiryChecked !== order.orderNo
    if (expired || now - lastPollAt >= ORDER_POLL_INTERVAL_MS) {
      lastPollAt = now
      if (expired) expiryChecked = order.orderNo
      void readOrder(order.orderNo).then(latest => {
        if (focusedOrder.value?.orderNo === latest.orderNo) focusError.value = ''
        if (latest.status !== 'pending') void refreshRelated()
      }).catch(error => { if (focusedOrder.value?.orderNo === order.orderNo) focusError.value = error.message })
    }
  }

  function handleReturn() {
    orderClockMs.value = Date.now()
    if (document.visibilityState === 'hidden' || route.query.tab === 'board') return
    const order = focusedOrder.value
    if (order?.status === 'pending' && !order.paymentReversalStatus) void refreshOrder(order, { manual: false })
  }

  watch(() => route.query.orderNo, value => {
    const orderNo = typeof value === 'string' ? value.slice(0, 80) : ''
    if (orderNo && orderNo !== focusedOrder.value?.orderNo) void focusOrder(orderNo, { syncQuery: false })
    else if (!orderNo && focusedOrder.value) clearFocus()
  })

  onMounted(async () => {
    timer = window.setInterval(tick, 1000)
    document.addEventListener('visibilitychange', handleReturn)
    window.addEventListener('focus', handleReturn)
    const tasks = [loadOptions()]
    if (typeof route.query.orderNo === 'string') tasks.push(focusOrder(route.query.orderNo.slice(0, 80), { syncQuery: false }))
    await Promise.all(tasks)
    // Mounting/reopening a record only reads our order state. Credit verification
    // is reserved for a real return from payment or the explicit check action.
  })

  onUnmounted(() => {
    disposed = true
    focusSequence++
    ordersSequence++
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', handleReturn)
    window.removeEventListener('focus', handleReturn)
    popupCleanups.forEach(stop => stop())
    popupCleanups.clear()
  })

  return {
    packages, products, optionsLoading, optionsLoaded, optionsError, selectionNotice,
    selectedProductId, selectedProduct, selectedPackageType, selectedDurationDays, selectedGroup, selectedConfig,
    submitting, uncertainProductId, purchaseError, canSubmit, submitReason, pendingOrders,
    focusedOrder, focusLoading, focusError, orderNotice, orderFeedback, fallbackPaymentUrl, orderClockMs, orderActions,
    orders, ordersLoading, ordersError, orderSearch, orderFilterStatus, pagination,
    loadOptions, selectProduct, selectService, selectDuration, submitOrder, reconcileCreation,
    loadOrders, focusOrder, clearFocus, refreshOrder, repayOrder, cancelOrder, loadProductImages
  }
}
