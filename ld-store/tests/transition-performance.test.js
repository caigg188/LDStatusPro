import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { describe, expect, it } from 'vitest'

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

const mainStyles = readSource('../src/styles/main.css')
const themeSource = readSource('../src/composables/useTheme.js')
const themeToggleSource = readSource('../src/components/common/ThemeToggle.vue')
const homeSource = readSource('../src/views/Home.vue')
const productCardSource = readSource('../src/components/product/ProductCard.vue')
const productsSource = readSource('../src/components/home/ProductsMarketplace.vue')
const storesSource = readSource('../src/components/home/StoresMarketplace.vue')
const buyRequestsSource = readSource('../src/components/home/BuyRequestMarketplace.vue')
const hotboardSource = readSource('../src/components/home/HotboardMarketplace.vue')
const hotboardRowSource = readSource('../src/components/home/HotboardProductRow.vue')

describe('主题过渡边界', () => {
  it('只通过短暂主题类应用颜色过渡，不为每个页面元素常驻 transition', () => {
    expect(mainStyles).toContain('html.theme-transition *')
    expect(mainStyles).toContain('background-color 0.3s ease')
    expect(mainStyles).not.toContain('html.dark *')
    expect(mainStyles).not.toContain('html:not(.dark) *')

    const themeTransitionRule = mainStyles.slice(
      mainStyles.indexOf('html.theme-transition,'),
      mainStyles.indexOf('/* CSS 变量')
    )
    expect(themeTransitionRule).not.toContain('box-shadow')
  })

  it('用户选择主题才启用过渡，首次恢复和系统主题变化即时应用', () => {
    const systemHandler = themeSource.slice(
      themeSource.indexOf('function handleSystemChange()'),
      themeSource.indexOf('// 设置主题模式')
    )
    const initialTheme = themeSource.slice(themeSource.indexOf('export function initTheme()'))

    expect(systemHandler).toContain('updateTheme(false)')
    expect(initialTheme).toContain('updateTheme(false)')
    expect(initialTheme).not.toContain('updateTheme(true)')
    expect(themeSource).toContain("document.documentElement.classList.add('theme-transition')")
    expect(themeSource).toContain("document.documentElement.classList.remove('theme-transition')")
    expect(themeSource).toContain('window.clearTimeout(transitionTimer)')
  })
})

describe('商城动效性能约束', () => {
  it('目标页面和组件不使用 transition all 或布局属性过渡', () => {
    const targetSources = [homeSource, productCardSource, themeToggleSource, productsSource, storesSource, buyRequestsSource, hotboardSource]

    for (const source of targetSources) {
      expect(source).not.toMatch(/transition:\s*all\b/)
      expect(source).not.toMatch(/transition:[^;\n]*(?:width|height|padding|margin|top|right|bottom|left)/)
    }

    expect(productCardSource).not.toMatch(/transition:[^;\n]*box-shadow/)
    expect(hotboardSource).not.toMatch(/transition:[^;\n]*box-shadow/)
    expect(buyRequestsSource).not.toMatch(/transition:[^;\n]*box-shadow/)
  })

  it('减少动态效果时停止持续动画、位移和缩放', () => {
    for (const source of [productsSource, storesSource]) {
      const reducedMotion = source.slice(source.indexOf('@media (prefers-reduced-motion: reduce)'))
      expect(reducedMotion).toContain('.section-content { animation: none; }')
    }

    const themeReducedMotion = themeToggleSource.slice(themeToggleSource.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(themeReducedMotion).toContain('.menu-enter-active,')
    expect(themeReducedMotion).toContain('animation: none')
    expect(themeReducedMotion).toContain('.arrow-icon')
    expect(themeReducedMotion).toContain('transition: none')

    const productReducedMotion = productCardSource.slice(productCardSource.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(productReducedMotion).toContain('.selection-badge::before')
    expect(productReducedMotion).toContain('animation: none')
    expect(productReducedMotion).toContain('.product-card')
    expect(productReducedMotion).toContain('transition: none')

    for (const source of [buyRequestsSource, hotboardSource, hotboardRowSource]) {
      const reducedMotion = source.slice(source.indexOf('@media (prefers-reduced-motion: reduce)'))
      expect(reducedMotion).toContain(':hover { transform: none; }')
    }
  })

  it('保留主题菜单退出动画的类型判定和结束态', () => {
    expect(themeToggleSource).toContain('<Transition name="menu" type="animation">')
    expect(themeToggleSource).toContain('animation: menuOut 0.15s ease-in forwards')
  })
})
