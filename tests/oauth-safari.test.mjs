// OAuth callback integration: real managers and panel handling, synthetic browser I/O only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createTranslator } from '../src/i18n/index.mjs';

const source = readFileSync(new URL('../LDStatusPro.user.js', import.meta.url), 'utf8');
const safari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15';
function section(start, end) {
    const a = source.indexOf(start), b = source.indexOf(end, a);
    assert.ok(a >= 0 && b > a, start);
    return source.slice(a, b);
}
function fixture({ ua = safari, status = 200, payload, nativeFailure, locale = 'en-US' } = {}) {
    const requests = [], gmRequests = [];
    const grant = { c: 'g'.repeat(43), s: 'synthetic-state', exp: 123456789 };
    let pending = JSON.stringify({ state: grant.s, verifier: 'synthetic-verifier' });
    const data = payload || { success: true, data: { token: 'synthetic-token', user: { username: 'test-user' } } };
    const ctx = {
        Date, JSON, Number, Array, String, Map, Set, Promise, AbortController,
        setTimeout, clearTimeout,
        navigator: { userAgent: ua }, location: { origin: 'https://linux.do' },
        window: { location: { hash: '' } },
        sessionStorage: { getItem: () => pending, removeItem: () => { pending = null; } },
        I18n: createTranslator(locale),
        Logger: { log() {}, warn() {}, error() {} }, EventBus: { emit() {} },
        CONFIG: { LEADERBOARD_API: 'https://api1.ldspro.qzz.io', NETWORK: { TIMEOUT: 1000 } },
        GM_info: { script: { version: 'synthetic-version' } },
        GM_xmlhttpRequest: options => {
            gmRequests.push(options);
            options.onload({ status, responseText: JSON.stringify(data) });
        },
        fetch: async (url, options) => {
            requests.push({ url, options });
            if (nativeFailure) throw nativeFailure;
            return { status, text: async () => JSON.stringify(data) };
        },
    };
    vm.createContext(ctx);
    const helpers = source.includes('function oauthLoginFailure(')
        ? section('        function oauthLoginFailure(', '        class OAuthManager {') : '';
    vm.runInContext(section('        function isOAuthHandoff(data) {', '        let _pendingOAuthData = null;')
        + section('        class NetworkError extends Error {', '        // ==================== 错误消息格式化工具')
        + section('        class Network {', '        class HistoryManager {')
        + helpers + section('        class OAuthManager {', '        // ==================== 排行榜管理器')
        + '; this.Network=Network; this.OAuthManager=OAuthManager;', ctx);
    const values = new Map();
    const network = new ctx.Network();
    const oauth = new ctx.OAuthManager({
        getGlobal: (key, fallback) => values.has(key) ? values.get(key) : fallback,
        setGlobalNow: (key, value) => values.set(key, value),
    }, network);
    return { ctx, network, oauth, grant, requests, gmRequests, values,
        setPending: value => { pending = value; }, hasPending: () => pending !== null };
}

test('Safari exchanges the original PKCE body once with browser-controlled Origin', async () => {
    const f = fixture();
    const result = await f.oauth._exchangeHandoff(f.grant);
    assert.equal(result.user.username, 'test-user');
    assert.equal(f.requests.length, 1);
    assert.equal(f.gmRequests.length, 0);
    const { url, options } = f.requests[0];
    assert.equal(url, 'https://api1.ldspro.qzz.io/api/auth/exchange');
    assert.equal(options.method, 'POST');
    assert.equal(JSON.stringify(options.headers), '{"Content-Type":"application/json"}');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.equal(typeof options.signal.addEventListener, 'function');
    assert.deepEqual(JSON.parse(options.body), {
        code: 'g'.repeat(43), state: 'synthetic-state', verifier: 'synthetic-verifier',
        origin: 'https://linux.do', audience: 'ldsp',
    });
    assert.equal(f.hasPending(), false);
});

test('Safari other APIs retain GM transport and its existing version header', async () => {
    const f = fixture();
    await f.network.api('/api/config/public');
    assert.equal(f.requests.length, 0);
    assert.equal(f.gmRequests.length, 1);
    assert.equal(f.gmRequests[0].headers['X-Client-Version'], 'synthetic-version');
});

for (const [name, ua] of [
    ['Chrome', 'Mozilla/5.0 AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'],
    ['Edge', 'Mozilla/5.0 AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'],
    ['Firefox', 'Mozilla/5.0 Gecko/20100101 Firefox/130.0'],
    ['Chrome iOS', 'Mozilla/5.0 AppleWebKit/605.1.15 CriOS/130.0.0.0 Mobile/15E148 Safari/604.1'],
    ['Firefox iOS', 'Mozilla/5.0 AppleWebKit/605.1.15 FxiOS/130.0 Mobile/15E148 Safari/605.1.15'],
    ['Edge iOS', 'Mozilla/5.0 AppleWebKit/605.1.15 EdgiOS/130.0 Mobile/15E148 Safari/605.1.15'],
    ['Opera iOS', 'Mozilla/5.0 AppleWebKit/605.1.15 OPiOS/130.0 Mobile/15E148 Safari/605.1.15'],
]) {
    test(`${name} exchange retains GM transport`, async () => {
        const f = fixture({ ua });
        await f.oauth._exchangeHandoff(f.grant);
        assert.equal(f.requests.length, 0);
        assert.equal(f.gmRequests.length, 1);
    });
}

test('HTTP400 INVALID_ORIGIN preserves error metadata without replay or GM fallback', async () => {
    const f = fixture({ status: 400, payload: {
        success: false, error: { code: 'INVALID_ORIGIN', message: 'PRIVATE_SERVER_BODY' },
    } });
    await assert.rejects(f.oauth._exchangeHandoff(f.grant), error => {
        assert.equal(error.code, 'INVALID_ORIGIN');
        assert.equal(error.status, 400);
        assert.doesNotMatch(error.message, /PRIVATE_SERVER_BODY/);
        return true;
    });
    await assert.rejects(f.oauth._exchangeHandoff(f.grant), error => error.reason === 'OAUTH_PENDING_MISSING');
    assert.equal(f.requests.length, 1);
    assert.equal(f.gmRequests.length, 0);
});

test('CORS rejection does not fall back to GM or reuse the single-use code', async () => {
    const f = fixture({ nativeFailure: new TypeError('PRIVATE_CORS_DIAGNOSTIC') });
    await assert.rejects(f.oauth._exchangeHandoff(f.grant), error => {
        assert.equal(error.reason, 'OAUTH_EXCHANGE_FAILED');
        assert.doesNotMatch(error.message, /PRIVATE_CORS_DIAGNOSTIC/);
        return true;
    });
    await assert.rejects(f.oauth._exchangeHandoff(f.grant), error => error.reason === 'OAUTH_PENDING_MISSING');
    assert.equal(f.requests.length, 1);
    assert.equal(f.gmRequests.length, 0);
});

test('Safari keeps a serialized body unchanged rather than double-encoding it', async () => {
    const f = fixture();
    const body = '{"synthetic":"body"}';
    await f.network.api('/api/auth/exchange', { method: 'POST', body });
    assert.equal(f.requests[0].options.body, body);
});

function pendingPanel(f) {
    f.ctx._pendingOAuthData = f.grant;
    vm.runInContext('class CallbackPanel {'
        + section('            async _checkPendingOAuthLogin() {', '            // 处理待处理的登录结果')
        + '}; this.CallbackPanel=CallbackPanel;', f.ctx);
    const messages = [];
    const panel = new f.ctx.CallbackPanel();
    panel.oauth = f.oauth;
    panel.renderer = { showToast: text => messages.push(text) };
    panel._updateLoginUI = () => {};
    panel._handlePendingLoginResult = () => {};
    return { panel, messages };
}

for (const [locale, expectedText] of [
    ['en-US', 'Script sign-in failed: The sign-in result could not be exchanged (INVALID_ORIGIN; HTTP 400). Click Sign in again to start a new authorization.'],
    ['zh-CN', '脚本登录失败：登录结果兑换失败（INVALID_ORIGIN; HTTP 400）。请重新点击“登录”授权。'],
]) {
    test(`the returned user sees a localized exchange failure in ${locale}`, async () => {
        const f = fixture({ locale, status: 400, payload: {
            success: false, error: { code: 'INVALID_ORIGIN', message: 'PRIVATE_SERVER_RESPONSE' },
        } });
        const { panel, messages } = pendingPanel(f);
        assert.equal(await panel._checkPendingOAuthLogin(), false);
        assert.deepEqual(messages, [expectedText]);
        assert.equal(f.values.size, 0);
        assert.doesNotMatch(messages[0], /PRIVATE_SERVER_RESPONSE|synthetic-state|synthetic-verifier|g{43}/);
    });
}

test('a callback without its original PKCE session offers a new login without sending a code', async () => {
    const f = fixture();
    f.setPending(null);
    const { panel, messages } = pendingPanel(f);
    assert.equal(await panel._checkPendingOAuthLogin(), false);
    assert.equal(f.requests.length, 0);
    assert.equal(f.gmRequests.length, 0);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /original sign-in session is missing/);
    assert.match(messages[0], /OAUTH_PENDING_MISSING/);
});

test('untrusted server text cannot become a failure toast', async () => {
    const f = fixture({ status: 400, payload: {
        success: false, error: { code: '<img src=x onerror=PRIVATE>', message: 'PRIVATE_SERVER_BODY' },
    } });
    const { panel, messages } = pendingPanel(f);
    assert.equal(await panel._checkPendingOAuthLogin(), false);
    assert.match(messages[0], /OAUTH_EXCHANGE_FAILED; HTTP 400/);
    assert.doesNotMatch(messages[0], /<img|PRIVATE/);
});

test('normal page loads are silent and an incomplete exchange result is visible', async () => {
    const f = fixture({ payload: { success: true, data: { token: 'synthetic-token' } } });
    const { panel, messages } = pendingPanel(f);
    assert.equal(await panel._checkPendingOAuthLogin(), false);
    assert.match(messages[0], /incomplete result/);
    assert.equal(f.values.size, 0);
    assert.equal(await panel._checkPendingOAuthLogin(), false);
    assert.equal(messages.length, 1);
    assert.equal(f.requests.length, 1);
});
