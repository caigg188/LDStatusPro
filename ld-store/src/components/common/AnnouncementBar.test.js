// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import Bar from './AnnouncementBar.vue'

const fixtures = vi.hoisted(() => ({ state: null, route: null }))
vi.mock('@/composables/useAnnouncement', () => ({ useAnnouncement: () => fixtures.state }))
vi.mock('vue-router', () => ({ useRoute: () => fixtures.route }))
vi.mock('@/utils/announcementTelemetry', () => ({ announcementImpression: {} }))

let wrapper
let observerNotify = () => {}
const LONG_TEXT = '把熟悉的小店加入书签，发现物品，也发现新的可能。请收藏士多官网，随时回来看看最新物品与公告。'

function banner(overrides = {}) {
  return { id: 12, mode: 'banner', summary: '短公告', content: '正文', ...overrides }
}

function mockMatchMedia(reduce = false) {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: query.includes('prefers-reduced-motion: reduce') ? reduce : false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
}

function mockWidths({ viewport = 200, text = 120 } = {}) {
  const box = wrapper.get('.announcement-marquee').element
  const sizer = wrapper.get('.announcement-marquee-sizer').element
  Object.defineProperty(box, 'clientWidth', { configurable: true, get: () => viewport })
  Object.defineProperty(sizer, 'scrollWidth', { configurable: true, get: () => text })
}

async function render(items = [banner()]) {
  fixtures.state = {
    announcementItems: ref(items),
    announcementError: ref(null),
    announcementLoading: ref(false),
    fetchAnnouncements: vi.fn()
  }
  wrapper = mount(Bar, {
    attachTo: document.body,
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } }
  })
  await flushPromises()
  return wrapper
}

async function measure(widths) {
  mockWidths(widths)
  observerNotify()
  window.dispatchEvent(new Event('resize'))
  await flushPromises()
}

beforeEach(() => {
  fixtures.route = { meta: {} }
  observerNotify = () => {}
  window.ResizeObserver = class {
    constructor(cb) {
      observerNotify = () => cb([])
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  mockMatchMedia(false)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

it('fits on one line without scrolling when the summary is short', async () => {
  await render()
  await measure({ viewport: 240, text: 120 })
  expect(wrapper.get('.announcement-marquee').classes()).not.toContain('is-scrolling')
  expect(wrapper.get('.announcement-marquee').classes()).not.toContain('is-truncated')
  expect(wrapper.findAll('.announcement-marquee-copy')).toHaveLength(1)
  expect(wrapper.get('.announcement-marquee-copy').text()).toBe('短公告')
})

it('keeps a single line and loops the copy when the summary overflows', async () => {
  await render([banner({ summary: LONG_TEXT })])
  await measure({ viewport: 160, text: 420 })
  const marquee = wrapper.get('.announcement-marquee')
  expect(marquee.classes()).toContain('is-scrolling')
  expect(marquee.classes()).not.toContain('is-truncated')
  expect(wrapper.findAll('.announcement-marquee-copy')).toHaveLength(2)
  expect(wrapper.findAll('.announcement-marquee-copy')[1].attributes('aria-hidden')).toBe('true')
  expect(marquee.attributes('style')).toContain('--announcement-marquee-duration')
  expect(wrapper.get('a').text()).toContain('查看详情')
})

it('truncates on one line instead of scrolling when motion is reduced', async () => {
  mockMatchMedia(true)
  await render([banner({ summary: LONG_TEXT })])
  await measure({ viewport: 160, text: 420 })
  expect(wrapper.get('.announcement-marquee').classes()).toContain('is-truncated')
  expect(wrapper.get('.announcement-marquee').classes()).not.toContain('is-scrolling')
  expect(wrapper.findAll('.announcement-marquee-copy')).toHaveLength(1)
})

it('stops scrolling after the summary shrinks to fit', async () => {
  await render([banner({ summary: LONG_TEXT })])
  await measure({ viewport: 160, text: 420 })
  expect(wrapper.get('.announcement-marquee').classes()).toContain('is-scrolling')
  await measure({ viewport: 480, text: 180 })
  expect(wrapper.get('.announcement-marquee').classes()).not.toContain('is-scrolling')
  expect(wrapper.findAll('.announcement-marquee-copy')).toHaveLength(1)
})
