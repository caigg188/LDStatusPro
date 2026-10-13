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
