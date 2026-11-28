// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authToken } from '../../tests/helpers/auth'
import { clearAuthSession, setAuthSession } from './auth'
import { api } from './api'
import { refreshAccountStatus } from './accountStatus'
import {
  accountSanction, applyAccountSanction, clearAccountSanction, isAccountSuspended,
  isCommentRestricted, nextAccountSanctionExpiry, pruneExpiredAccountSanctions
} from './accountSanction'

describe('current account restrictions', () => {
  beforeEach(() => {
    setAuthSession(authToken('42'))
    clearAccountSanction()
  })

  afterEach(() => {
    clearAuthSession()
    clearAccountSanction()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('preserves the independently active comment restriction when the login ban expires', () => {
    vi.useFakeTimers()
    const until = Math.floor(Date.now() / 1000) + 60
    applyAccountSanction({ measures: [
      { scope: 'login', until, reason: '登录限制' },
      { scope: 'comment', until: null, reason: '评论限制' }
    ] })

    expect(nextAccountSanctionExpiry()).toBe(until)
    expect(isAccountSuspended()).toBe(true)
    vi.setSystemTime(until * 1000)
    pruneExpiredAccountSanctions()

    expect(isAccountSuspended()).toBe(false)
    expect(isCommentRestricted()).toBe(true)
    expect(accountSanction.reason).toBe('评论限制')
  })

  it('handles a comment restriction response without treating the session as banned', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      success: false, error: { code: 'COMMENT_RESTRICTED', message: '评论限制' }
    }, { status: 403 })))
    await api.post('/api/shop/products/1/comments', { content: 'test' })
    expect(isAccountSuspended()).toBe(false)
    expect(isCommentRestricted()).toBe(true)
  })

  it('never applies a delayed status response after the user switches accounts', async () => {
    let respond
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { respond = resolve })))
    const oldRequest = refreshAccountStatus()
    setAuthSession(authToken('43'))
    respond(Response.json({
      success: true,
      data: { accountStatus: { suspended: true, scopes: ['login'], reason: '上一账户' } }
    }))
    await oldRequest
    expect(isAccountSuspended()).toBe(false)
  })
})
