// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { resolveGuestOnlyRedirect, sanitizePostLoginRedirect } from './navigation'

describe('sanitizePostLoginRedirect', () => {
  it('keeps in-app destinations and rejects auth loops', () => {
    expect(sanitizePostLoginRedirect('/user/orders', '/')).toBe('/user/orders')
    expect(sanitizePostLoginRedirect('/login', '/')).toBe('/')
    expect(sanitizePostLoginRedirect('/auth/callback', '/user')).toBe('/user')
    expect(sanitizePostLoginRedirect('https://evil.example/phish', '/')).toBe('/')
  })
})

describe('resolveGuestOnlyRedirect', () => {
  const loginRoute = {
    name: 'Login',
    meta: { guestOnly: true },
    query: {}
  }

  it('sends authenticated users home from /login', () => {
    expect(resolveGuestOnlyRedirect(loginRoute, true)).toEqual({
      path: '/',
      replace: true
    })
  })

  it('honors a safe redirect query when already logged in', () => {
    expect(resolveGuestOnlyRedirect({
      ...loginRoute,
      query: { redirect: '/user/orders' }
    }, true)).toEqual({
      path: '/user/orders',
      replace: true
    })
  })

  it('ignores auth-page redirects so logged-in users still leave /login', () => {
    expect(resolveGuestOnlyRedirect({
      ...loginRoute,
      query: { redirect: '/login' }
    }, true)).toEqual({
      path: '/',
      replace: true
    })
  })

  it('leaves guests on the login page', () => {
    expect(resolveGuestOnlyRedirect(loginRoute, false)).toBeNull()
    expect(resolveGuestOnlyRedirect({
      name: 'Home',
      meta: {},
      query: {}
    }, true)).toBeNull()
  })
})
