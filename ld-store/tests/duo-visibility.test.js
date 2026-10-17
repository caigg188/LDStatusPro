import { afterEach, describe, expect, it, vi } from 'vitest'
import { observeDuoVisibility } from '../src/utils/duoVisibility'
afterEach(() => vi.useRealTimers())
function setup() {
  vi.useFakeTimers()
  let receive
  const doc = new globalThis.EventTarget()
  doc.visibilityState = 'visible'
  const callback = vi.fn(), disconnect = vi.fn(), element = {}
  class Observer { constructor(fn) { receive = fn } observe() {} disconnect() { disconnect() } }
  const stop = observeDuoVisibility(element, callback, { document: doc, Observer })
  const showBatch = ratios => receive(ratios.map((ratio, time) => ({ target: element, time, isIntersecting: ratio > 0, intersectionRatio: ratio })))
  return { callback, stop, doc, show: ratio => showBatch([ratio]), showBatch }
}
describe('DUO+ continuous foreground viewability', () => {
  it('requires half visibility for a full second, and records once', () => {
    const { show, callback } = setup()
    show(0.49); vi.advanceTimersByTime(2000); expect(callback).not.toHaveBeenCalled()
    show(0.5); vi.advanceTimersByTime(999); expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1); expect(callback).toHaveBeenCalledTimes(1)
    show(1); vi.advanceTimersByTime(2000); expect(callback).toHaveBeenCalledTimes(1)
  })
  it('resets when leaving viewport or moving to background', () => {
    const { show, callback, doc } = setup()
    show(1); vi.advanceTimersByTime(600); show(0); vi.advanceTimersByTime(1000)
    expect(callback).not.toHaveBeenCalled()
    show(1); vi.advanceTimersByTime(600); doc.visibilityState = 'hidden'; doc.dispatchEvent(new globalThis.Event('visibilitychange'))
    vi.advanceTimersByTime(5000); expect(callback).not.toHaveBeenCalled()
    doc.visibilityState = 'visible'; doc.dispatchEvent(new globalThis.Event('visibilitychange'))
    vi.advanceTimersByTime(999); expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1); expect(callback).toHaveBeenCalledTimes(1)
  })
  it('cancels on disposal and ignores stale timer work', () => {
    const { show, callback, stop } = setup()
    show(1); vi.advanceTimersByTime(500); stop(); vi.advanceTimersByTime(1000)
    expect(callback).not.toHaveBeenCalled()
  })
  it('uses the last queued intersection when a batch enters then leaves half visibility', () => {
    const { showBatch, show, callback } = setup()
    showBatch([0.8, 0.1]); vi.advanceTimersByTime(1000)
    expect(callback).not.toHaveBeenCalled()
    showBatch([0.1, 0.8]); vi.advanceTimersByTime(600)
    showBatch([0.8, 0.1]); vi.advanceTimersByTime(1000)
    expect(callback).not.toHaveBeenCalled()
    show(0.5); vi.advanceTimersByTime(1000)
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
