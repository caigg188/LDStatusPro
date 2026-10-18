// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCheckoutSubmission } from '../src/composables/orders/useCheckoutSubmission'
const order = { orderId: 3, orderNo: 'RECOVERED', paymentUrl: null }
const input = { productId: 7, quantity: 2, couponClaimId: 4, expectedAmount: 20 }
const unknown = { success: false as const, status: 0, error: '', kind: 'network' as const, aborted: false }
const found = { success: true as const, status: 200, data: { exists: true, order } }
const absent = { success: true as const, status: 200, data: { exists: false, order: null } }
let ownerId = 0
beforeEach(() => { sessionStorage.clear() })
function setup(owner = `owner-${++ownerId}`) {
  const create = vi.fn().mockResolvedValue(unknown)
  const lookup = vi.fn().mockResolvedValue(absent)
  const options = { owner, productId: 7, create, lookup, wait: async () => {} }
  return { create, lookup, options, controller: useCheckoutSubmission(options) }
}
describe('checkout result recovery', () => {
  it('refreshes a confirmed but pending payment without creating another order', async () => {
    const { controller, create, lookup } = setup()
    create.mockResolvedValueOnce({ success: true, status: 200, data: { ...order, paymentState: 'unknown', paymentUrl: null } })
    await controller.submit(input)
    const token = controller.pending.value?.token
    lookup.mockResolvedValueOnce({ success: true, status: 200, data: { exists: true, order: { ...order, paymentState: 'ready' } } })
    expect(await controller.recover(true)).toMatchObject({ success: true, data: { paymentState: 'ready' } })
    expect(controller.pending.value?.token).toBe(token)
    expect(create).toHaveBeenCalledTimes(1)
    controller.complete()
  })
  it('recovers an order after a lost response without a second creation', async () => {
    const { controller, create, lookup } = setup()
    lookup.mockResolvedValue(found)
    expect(await controller.submit(input)).toMatchObject({ success: true, data: order })
    expect(create).toHaveBeenCalledTimes(1)
    expect(controller.pending.value).not.toBeNull() // retained until navigation succeeds
    controller.complete()
    expect(controller.pending.value).toBeNull()
  })
  it('keeps the exact token and amount across reload and an explicit retry', async () => {
    const { controller, create, options } = setup()
    await controller.submit(input)
    const original = create.mock.calls[0][0]
    controller.stop()
    const restored = useCheckoutSubmission(options)
    expect(restored.pending.value).toEqual(original)
    options.create.mockResolvedValueOnce({ success: true, status: 200, data: order })
    expect(await restored.recover(true)).toMatchObject({ success: true })
    expect(create.mock.calls[1][0]).toEqual(original)
    expect(create).toHaveBeenCalledTimes(2)
    restored.complete()
  })
  it('blocks double submission, preserves unknown results and isolates accounts', async () => {
    const { controller, create } = setup()
    await Promise.all([controller.submit(input), controller.submit(input)])
    expect(create).toHaveBeenCalledTimes(1)
    expect(controller.pending.value).not.toBeNull()
    expect(setup().controller.pending.value).toBeNull()
    controller.complete()
  })
  it('releases a definitive price rejection but preserves malformed successful responses', async () => {
    const { controller, create } = setup()
    create.mockResolvedValueOnce({ ...unknown, kind: 'http', status: 409, errorCode: 'ORDER_PRICE_CHANGED' })
    await controller.submit(input)
    expect(controller.pending.value).toBeNull()
    create.mockResolvedValueOnce({ ...unknown, kind: 'contract', status: 200 })
    await controller.submit(input)
    expect(controller.pending.value).not.toBeNull()
    controller.complete()
  })
})

it('stops recovering a cancelled unknown intent until the user explicitly submits again', async () => {
  const { controller, create, lookup } = setup()
  create.mockResolvedValueOnce({ success: true, status: 200, data: { ...order, status: 'pending', paymentState: 'unknown' } })
  await controller.submit(input)
  const oldToken = controller.pending.value?.token
  lookup.mockResolvedValueOnce({ success: true, status: 200, data: { exists: true, order: { ...order, status: 'cancelled', paymentState: 'unknown' } } })
  await controller.recover()
  await controller.recover(true)
  expect(lookup).toHaveBeenCalledTimes(1)
  expect(create).toHaveBeenCalledTimes(1)
  controller.complete()
  await controller.submit(input)
  expect(controller.pending.value?.token).not.toBe(oldToken)
  controller.complete()
})

it('does not recover or replay an intent after its session is changed', async () => {
  const { setAuthSession, clearAuthSession } = await import('../src/utils/auth')
  const { authToken } = await import('./helpers/auth')
  setAuthSession(authToken())
  const { controller, create, lookup } = setup()
  let resolve!: (value: typeof unknown) => void
  create.mockImplementationOnce(() => new Promise(yes => { resolve = yes }))
  const request = controller.submit(input)
  await vi.waitFor(() => expect(create).toHaveBeenCalled())
  setAuthSession(authToken('22'))
  resolve(unknown)
  expect(await request).toMatchObject({ errorCode: 'SESSION_CHANGED', aborted: true })
  expect(lookup).not.toHaveBeenCalled()
  expect(controller.confirmed.value).toBeNull()
  clearAuthSession()
})
it('ignores late recovered orders after the checkout is unmounted', async () => {
  const { controller, lookup } = setup()
  let resolve!: (value: typeof found) => void
  lookup.mockImplementationOnce(() => new Promise(yes => { resolve = yes }))
  const request = controller.submit(input)
  await vi.waitFor(() => expect(lookup).toHaveBeenCalled())
  controller.stop()
  resolve(found)
  expect(await request).toMatchObject({ errorCode: 'SESSION_CHANGED' })
  expect(controller.confirmed.value).toBeNull()
})
it('still recovers a committed order after the transport times out', async () => {
  const { controller, create, lookup } = setup()
  create.mockResolvedValueOnce({ ...unknown, aborted: true, kind: 'abort', abortReason: 'timeout' })
  lookup.mockResolvedValueOnce(found)
  expect(await controller.submit(input)).toMatchObject({ success: true, data: order })
  expect(create).toHaveBeenCalledTimes(1)
  expect(lookup).toHaveBeenCalledTimes(1)
  controller.complete()
})

describe('historical product pending intents across the UUID cutover', () => {
  const productId = 7
  const couponClaimId = 'bbbbbbbb-2222-4222-8222-222222222222'
  const token = 'ord_original_numeric_pending_1234'
  const original = { ...input, token }
  const key = (owner: string, id: string | number) => `ld-store-order-submission:${JSON.stringify([owner, id])}`
  function legacySetup() {
    const owner = JSON.stringify(['linux.do', `legacy-${++ownerId}`])
    sessionStorage.setItem(key(owner, 7), JSON.stringify(original))
    const create = vi.fn().mockResolvedValue({ success: true, status: 200, data: order })
    const lookup = vi.fn().mockImplementation(async (_token, legacy) => ({
      ...(legacy ? absent : found), data: { ...(legacy ? absent.data : found.data), legacyIntent: { productId, couponClaimId } }
    }))
    const options = { owner, productId, create, lookup, wait: async () => {} }
    return { owner, create, lookup, options, controller: useCheckoutSubmission(options) }
  }
  it('keeps the numeric product key and recovers the original committed order', async () => {
    const { owner, controller, create, lookup } = legacySetup()
    expect(await controller.restore()).toBe(true)
    expect(controller.pending.value).toEqual({ ...original, productId, couponClaimId })
    expect(lookup).toHaveBeenCalledWith(token, original)
    expect(JSON.parse(sessionStorage.getItem(key(owner, 7))!).productId).toBe(7)
    expect(await controller.recover(true)).toMatchObject({ success: true, data: order })
    expect(create).not.toHaveBeenCalled()
    controller.complete()
    expect(sessionStorage.getItem(key(owner, productId))).toBeNull()
  })
  it('replays the same token, coupon, quantity and amount only after explicit retry', async () => {
    const { controller, create, lookup } = legacySetup()
    lookup.mockImplementation(async (_token, legacy) => ({ ...absent, data: { ...absent.data, ...(legacy ? { legacyIntent: { productId, couponClaimId } } : {}) } }))
    await controller.restore()
    expect(await controller.recover()).toMatchObject({ success: false })
    expect(create).not.toHaveBeenCalled()
    expect(await controller.recover(true)).toMatchObject({ success: true })
    expect(create).toHaveBeenCalledExactlyOnceWith({ ...original, productId, couponClaimId })
    controller.complete()
  })
  it('keeps the original intent locked when mapping fails or returns an old numeric coupon', async () => {
    const { owner, controller, create, lookup } = legacySetup()
    for (const result of [unknown, { ...absent, data: { ...absent.data, legacyIntent: { productId, couponClaimId: 4 } } }]) {
      lookup.mockResolvedValue(result)
      expect(await controller.submit({ ...input, productId, couponClaimId: null })).toMatchObject({ success: false })
      expect(controller.restorationBlocked.value).toBe(true)
      expect(create).not.toHaveBeenCalled()
      expect(JSON.parse(sessionStorage.getItem(key(owner, 7))!)).toEqual(original)
    }
  })
  it('isolates different users and sites when scanning old browser keys', async () => {
    const { controller, options, lookup } = legacySetup()
    for (const owner of [JSON.stringify(['idcflare.com', JSON.parse(options.owner)[1]]), JSON.stringify(['linux.do', 'another-user'])]) {
      const other = useCheckoutSubmission({ ...options, owner })
      expect(await other.restore()).toBe(true)
      expect(other.pending.value).toBeNull()
      expect(lookup).not.toHaveBeenCalled()
      other.stop()
    }
    controller.stop()
  })
  it('does not let an unrelated product pending record block this checkout', async () => {
    const { owner, controller, lookup } = legacySetup()
    sessionStorage.setItem(key(owner, 8), JSON.stringify({ ...original, productId: 8, token: 'ord_another_numeric_pending_1234' }))
    expect(await controller.restore()).toBe(true)
    expect(lookup).toHaveBeenCalledExactlyOnceWith(token, original)
    expect(controller.pending.value?.token).toBe(token)
    controller.complete()
    expect(sessionStorage.getItem(key(owner, 8))).not.toBeNull()
  })
  it('rechecks a numeric coupon when the same page crosses the server cutover', async () => {
    const { controller, lookup, create } = legacySetup()
    lookup.mockResolvedValue(absent) // Preparation-mode server, no mapping yet.
    expect(await controller.restore()).toBe(true)
    expect(controller.pending.value).toEqual(original)
    lookup.mockResolvedValue(unknown) // The cutover happens while this page stays open.
    expect(await controller.recover(true)).toMatchObject({ success: false })
    expect(controller.restorationBlocked.value).toBe(true)
    expect(controller.pending.value?.token).toBe(token)
    expect(create).not.toHaveBeenCalled()
    lookup.mockImplementation(async (_token, legacy) => ({ ...absent, data: { ...absent.data, ...(legacy ? { legacyIntent: { productId, couponClaimId } } : {}) } }))
    expect(await controller.recover(true)).toMatchObject({ success: true })
    expect(create).toHaveBeenCalledExactlyOnceWith({ ...original, productId, couponClaimId })
    controller.complete()
  })
  it('retains an uncertain token when the server requires public IDs instead of treating it as a definitive rejection', async () => {
    const { controller, lookup, create } = legacySetup()
    lookup.mockResolvedValue(absent)
    create.mockResolvedValue({ ...unknown, kind: 'http', status: 400, errorCode: 'PUBLIC_ID_REQUIRED' })
    await controller.recover(true)
    expect(controller.pending.value?.token).toBe(token)
    create.mockClear()
    lookup.mockResolvedValue(unknown)
    await controller.recover(true)
    expect(create).not.toHaveBeenCalled()
    expect(controller.pending.value?.token).toBe(token)
    controller.complete()
  })
  it('restores memory-only intents when browser storage is unavailable', async () => {
    const { options: oldOptions, controller: oldController } = setup()
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage blocked') })
    try {
      await oldController.submit(input)
      oldController.stop()
      const lookup = vi.fn().mockImplementation(async (_token, legacy) => ({ ...found, data: { ...found.data, ...(legacy ? { legacyIntent: { productId, couponClaimId } } : {}) } }))
      const controller = useCheckoutSubmission({ ...oldOptions, productId, lookup })
      expect(await controller.restore()).toBe(true)
      expect(controller.pending.value?.token).toBe(oldController.pending.value?.token)
      expect(await controller.recover()).toMatchObject({ success: true, data: order })
      controller.complete()
    } finally { storage.mockRestore() }
  })
  it('clears the numeric memory key after a definitive rejection of a restored intent', async () => {
    const { options: oldOptions, controller: oldController } = setup()
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage blocked') })
    try {
      await oldController.submit(input)
      oldController.stop()
      const lookup = vi.fn().mockImplementation(async (_token, legacy) => ({ ...absent, data: { ...absent.data, ...(legacy ? { legacyIntent: { productId, couponClaimId } } : {}) } }))
      const create = vi.fn().mockResolvedValue({ ...unknown, kind: 'http', status: 409, errorCode: 'ORDER_PRICE_CHANGED' })
      const options = { ...oldOptions, productId, create, lookup }
      const controller = useCheckoutSubmission(options)
      await controller.restore()
      await controller.recover(true)
      expect(controller.pending.value).toBeNull()
      controller.stop()
      lookup.mockClear()
      const reopened = useCheckoutSubmission(options)
      expect(await reopened.restore()).toBe(true)
      expect(reopened.pending.value).toBeNull()
      expect(lookup).not.toHaveBeenCalled()
      reopened.stop()
    } finally { storage.mockRestore() }
  })
})
