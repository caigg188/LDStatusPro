import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { describe, expect, it } from 'vitest'

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

const searchSource = readSource('../src/views/Search.vue')
const apiSource = readSource('../src/utils/api.ts')
const sanctionSource = readSource('../src/utils/accountSanction.js')

describe('search requires login', () => {
  it('blocks the query when the visitor is not signed in', () => {
    expect(searchSource).toContain('const searchLocked = computed(() => !userStore.isLoggedIn)')
    expect(searchSource).toMatch(/if \(searchLocked\.value\) \{[\s\S]*?resetSearchState\(\)[\s\S]*?return/)
  })

  it('disables the input and explains why instead of silently returning nothing', () => {
    expect(searchSource).toContain(':disabled="searchLocked"')
    expect(searchSource).toContain('登录后才能搜索商品')
    expect(searchSource).toContain('未登录可以浏览首页与商品详情，搜索需要先登录。')
    expect(searchSource).toContain('search-login-gate__action')
  })
})

describe('account sanction handling', () => {
  it('never expires the storefront session on a suspension response', () => {
    expect(apiSource).toContain('applyAccountSanctionFromPayload')
    expect(apiSource).not.toMatch(/ACCOUNT_SUSPENDED'\s*,\s*'AUTH_REQUIRED'/)
  })

  it('treats login bans as comment restrictions and keeps browse access', () => {
    expect(sanctionSource).toContain('isAccountSuspended')
    expect(sanctionSource).toMatch(/scopes\.includes\('login'\) \|\| scopes\.includes\('comment'\)/)
  })
})