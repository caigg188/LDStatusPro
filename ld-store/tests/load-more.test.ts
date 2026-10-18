// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LoadMore from '../src/components/common/LoadMore.vue'

let wrapper
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals() })

describe('load more trigger and feedback', () => {
  it('keeps the manual button usable without IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    wrapper = mount(LoadMore, { props: { hasMore: true, automatic: true } })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('load')).toHaveLength(1)
  })

  it('rechecks a still-visible sentinel after each successful page and pauses on error', async () => {
    const observers = []
    vi.stubGlobal('IntersectionObserver', class {
      target; callback; disconnect = vi.fn()
      constructor(callback) { this.callback = callback; observers.push(this) }
      observe(target) { this.target = target }
      fire() { this.callback([{ target: this.target, isIntersecting: true }]) }
    })
    wrapper = mount(LoadMore, { props: { hasMore: true, automatic: true } })
    await wrapper.vm.$nextTick()
    observers.at(-1).fire()
    expect(wrapper.emitted('load')).toHaveLength(1)
    await wrapper.setProps({ loading: true })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ loading: false })
    observers.at(-1).fire()
    expect(wrapper.emitted('load')).toHaveLength(2)
    await wrapper.setProps({ error: '网络暂不可用' })
    const count = observers.length
    observers.at(-1).fire()
    expect(wrapper.emitted('load')).toHaveLength(2)
    expect(observers).toHaveLength(count)
    expect(wrapper.get('button').text()).toBe('重试')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('load')).toHaveLength(3)
    await wrapper.setProps({ error: '', hasMore: false })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toBe('已加载全部')
  })
})
