import { readFileSync } from 'node:fs'
import { test, expect } from './fixtures'
const source = readFileSync(new URL('../../LDStatusPro.user.js', import.meta.url), 'utf8')
const start = source.indexOf('        class OAuthManager {')
const end = source.indexOf('        // ==================== 排行榜管理器', start)
const oauthCode = source.slice(start, end)
const oldToken = 'header.' + Buffer.from(JSON.stringify({ sub: 7, exp: 4102444800, name: 'old' })).toString('base64url') + '.signature'
const newToken = 'header.' + Buffer.from(JSON.stringify({ sub: 7, exp: 4102444800, name: 'new' })).toString('base64url') + '.signature'

for (const sameToken of [false, true]) {
  test(`userscript shared browser tabs preserve a ${sameToken ? 'same-JWT' : 'new-JWT'} reauthorization after an old 401`, async ({ page, context }) => {
    await context.addInitScript(code => {
      const bootstrap = `
        const Logger = {log(){},error(){}};
        const EventBus = {emit:(...args)=>window.__authEvents.push(args)};
        class NetworkError extends Error {}
        ${code}
        window.__authEvents=[];
        window.__oauth=new OAuthManager({
          getGlobal:(key,fallback)=>{const value=localStorage.getItem('fixture.'+key);return value===null?fallback:JSON.parse(value)},
          setGlobalNow:(key,value)=>localStorage.setItem('fixture.'+key,JSON.stringify(value))
        },{api:()=>new Promise(resolve=>{window.__releaseAuth=resolve})});
      `
      // Isolated GM storage shim; no userscript manager or real network is used.
      const script = document.createElement('script')
      script.textContent = bootstrap
      document.documentElement?.appendChild(script)
      if (!(window as unknown as { __oauth: unknown }).__oauth) {
        // Playwright evaluation is independent of the application's CSP.
        (0, eval)(bootstrap)
      }
    }, oauthCode)
    await page.goto('/')
    const other = await context.newPage(); await other.goto('/')
    await page.evaluate(token => {
      const w = window as unknown as { __oauth: { setToken(t: string): void; setUserInfo(u: object): void; setJoined(v: boolean): void; api(p: string): Promise<unknown> }; __pendingAuth: Promise<unknown> }
      w.__oauth.setToken(token); w.__oauth.setUserInfo({ id: 7 }); w.__oauth.setJoined(true)
      w.__pendingAuth = w.__oauth.api('/api/user/self')
    }, oldToken)
    const expectedToken = sameToken ? oldToken : newToken
    await other.evaluate(token => {
      const w = window as unknown as { __oauth: { setToken(t: string): void; setUserInfo(u: object): void; setJoined(v: boolean): void } }
      w.__oauth.setToken(token); w.__oauth.setUserInfo({ id: 7 }); w.__oauth.setJoined(true)
    }, expectedToken)
    const state = await page.evaluate(async () => {
      const w = window as unknown as { __oauth: { getToken(): string; isJoined(): boolean }; __releaseAuth(value: object): void; __pendingAuth: Promise<{ error: { code: string } }>; __authEvents: unknown[] }
      w.__releaseAuth({ success: false, error: { code: 'INVALID_TOKEN' } })
      const result = await w.__pendingAuth
      return { code: result.error.code, token: w.__oauth.getToken(), joined: w.__oauth.isJoined(), events: w.__authEvents.length }
    })
    expect(state).toEqual({ code: 'SESSION_CHANGED', token: expectedToken, joined: true, events: 0 })
    expect(await other.evaluate(() => (window as unknown as { __oauth: { getToken(): string } }).__oauth.getToken())).toBe(expectedToken)
  })
}
