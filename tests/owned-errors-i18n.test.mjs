import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'acorn';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../LDStatusPro.user.js', import.meta.url), 'utf8');
const classes = new Map();
let authHandler;
function walk(node) {
    if (node.type === 'ClassDeclaration') classes.set(node.id.name, node);
    if (node.type === 'CallExpression' && node.callee.object?.name === 'EventBus' && node.arguments[0]?.value === 'auth:expired') authHandler = node.arguments[1];
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(child => child?.type && walk(child));
        else if (value?.type) walk(value);
    }
}
walk(parse(source, { ecmaVersion: 'latest' }));
const code = node => source.slice(node.start, node.end);
function fixture(locale) {
    const dom = new JSDOM('', { url: 'https://linux.do/', runScripts: 'outside-only' });
    const w = dom.window;
    w.eval(source.slice(source.indexOf('// @@I18N_BEGIN') + '// @@I18N_BEGIN'.length, source.indexOf('// @@I18N_END')));
    w.eval(`const CONFIG = { NETWORK: { TIMEOUT: 1000 }, LEADERBOARD_API: 'https://api.invalid' };
        const CURRENT_SITE = { domain: 'linux.do' };
        const Logger = { warn() {} };
        const GM_info = { script: { version: 'test' } };
        ${['NetworkError', 'Network', 'ActivityManager', 'OAuthManager', 'LDCManager', 'CDKManager'].map(name => code(classes.get(name))).join('\n')}
        Object.assign(globalThis, { I18n, Network, ActivityManager, OAuthManager, LDCManager, CDKManager, authHandler: function(payload) { return (${code(authHandler)})(payload); } });`);
    w.I18n.setLocale(locale);
    return { dom, w, t: w.I18n.t };
}

test('owned API and GM errors translate without changing requests, cooldowns or remote details', async () => {
    for (const locale of ['en-US', 'zh-CN']) {
        const { dom, w, t } = fixture(locale);
        try {
            const network = new w.Network();
            assert.equal(w.Network.timeoutError().message, t('common.errors.codes.TIMEOUT'));
            assert.equal(w.Network.networkFail().message, t('common.errors.codes.NETWORK_ERROR'));
            const cases = [
                [429, { error: { retryAfter: 17 } }, t('common.errors.rateLimitWaitSeconds', { n: 17 })],
                [403, { error: { code: 'IP_BANNED' } }, t('common.errors.codes.IP_BANNED')],
                [403, { error: { code: 'IP_PERMANENTLY_BANNED' } }, t('common.errors.codes.IP_PERMANENTLY_BANNED')],
                [429, '<html>', t('common.errors.rateLimitWaitMinutes', { n: 2 })],
                [403, '<html>', t('common.errors.possibleIpBlock')],
                [503, '<html>', t('common.errors.codes.SERVER_ERROR')],
                [418, '<html>', t('common.errors.http4xx', { status: 418 })],
                [422, { error: { code: 'REMOTE_CODE', message: '原始远端详情 & detail' } }, 'REMOTE_CODE: 原始远端详情 & detail']
            ];
            for (const [status, body, message] of cases) {
                let calls = 0;
                w.Network._rateLimitedAt = 0;
                w.GM_xmlhttpRequest = options => {
                    calls++;
                    assert.equal(options.url, 'https://api.invalid/test');
                    assert.equal(options.headers.Authorization, 'Bearer fixture');
                    options.onload({ status, responseText: typeof body === 'string' ? body : JSON.stringify(body) });
                };
                await assert.rejects(network._doApiRequest('/test', { token: 'fixture' }, 'GET', 0), error => {
                    assert.equal(error.message, message);
                    if (status === 422) { assert.equal(error.code, 'REMOTE_CODE'); assert.equal(error.status, 422); }
                    return true;
                });
                assert.equal(calls, 1);
                assert.equal(w.Network.isRateLimited(), status === 429);
            }
            w.Network.recordRateLimit();
            await assert.rejects(network.api('/test'), { message: t('common.errors.rateLimitWaitSeconds', { n: w.Network.getRateLimitRemaining() }) });
            for (const [callback, key] of [['onerror', 'NETWORK_ERROR'], ['ontimeout', 'TIMEOUT']]) {
                w.GM_xmlhttpRequest = options => options[callback]();
                await assert.rejects(network._doApiRequest('/test', {}, 'GET', 0), { message: t(`common.errors.codes.${key}`) });
                await assert.rejects(network._fetchJsonGM('https://remote.invalid', 1000), error => {
                    assert.equal(error.message, t(`common.errors.codes.${key}`));
                    assert.equal(error.code, key);
                    assert.equal(error.status, 0);
                    return true;
                });
            }
            w.GM_xmlhttpRequest = options => options.onload({ status: 200, responseText: 'invalid json' });
            await assert.rejects(network._fetchJsonGM('https://remote.invalid', 1000), { message: t('common.errors.parseResponse') });
            w.fetch = async () => { throw Object.assign(new Error(), { name: 'AbortError' }); };
            await assert.rejects(network._fetchJsonNative('/test', 1000), { message: t('common.errors.codes.TIMEOUT'), code: 'TIMEOUT' });
        } finally { dom.window.close(); }
    }
});

test('activity owned errors translate and nonempty remote errors are preserved', async () => {
    for (const locale of ['en-US', 'zh-CN']) {
        const { dom, w, t } = fixture(locale);
        try {
            const cases = [
                ['getReadTopics', [], 'readFailed'], ['getBookmarks', [0, 'alice'], 'bookmarksFailed'],
                ['deleteBookmark', ['42'], 'deleteFailed'], ['getReplies', [0, 'alice'], 'repliesFailed'],
                ['getLikes', [0, 'alice'], 'likesFailed'], ['getMyTopics', [0, 'alice'], 'topicsFailed'],
                ['getReactions', [null, 'alice'], 'reactionsFailed']
            ];
            for (const [method, args, key] of cases) {
                for (const detail of ['', '远端错误 & detail']) {
                    const fail = async () => { throw new Error(detail); };
                    const activity = new w.ActivityManager({ fetchJson: fail, fetch: fail });
                    await assert.rejects(activity[method](...args), { message: detail || t(`activity.errors.${key}`) });
                }
            }
            for (const method of ['getBookmarks', 'getReplies', 'getLikes', 'getMyTopics', 'getReactions']) {
                await assert.rejects(new w.ActivityManager(null)[method](), { message: t('activity.errors.notLoggedIn') });
            }
            await assert.rejects(new w.ActivityManager(null).deleteBookmark(''), { message: t('activity.errors.invalidBookmarkId') });
            await assert.rejects(new w.ActivityManager({ fetchJson: async () => ({}) })._fetchReadPage(), { message: t('activity.errors.invalidResponse') });
        } finally { dom.window.close(); }
    }
});

test('authentication reasons and authorization-link fallback translate without changing reason tokens', async () => {
    for (const locale of ['en-US', 'zh-CN']) {
        const { dom, w, t } = fixture(locale);
        try {
            for (const [reason, key] of Object.entries({ TOKEN_EXPIRED: 'authExpired', AUTH_EXPIRED: 'authExpired', INVALID_TOKEN: 'authInvalid', AUTH_INVALID: 'authInvalid', AUTH_REQUIRED: 'authRequired', NOT_LOGGED_IN: 'authLost', UNAUTHORIZED: 'authRequired', UNKNOWN: 'authRequired' })) {
                const toasts = [];
                const host = { renderer: { showToast: text => toasts.push(text) }, _updateLoginUI() {}, _renderLeaderboardContent: async () => {} };
                w.authHandler.call(host, { reason });
                assert.deepEqual(toasts, [t(`panel.toasts.${key}`)]);
                assert.equal(host.registrationPaused, false);
            }
            const oauth = new w.OAuthManager(null, { api: async () => ({ success: false }) });
            oauth._checkUrlHashLogin = () => null;
            await assert.rejects(oauth.login(), { message: t('panel.toasts.authLinkFailed') });
        } finally { dom.window.close(); }
    }
});

test('LDC and CDK dates follow the selected locale and reject invalid dates', () => {
    for (const locale of ['zh-CN', 'en-US']) {
        const { dom, w } = fixture(locale);
        try {
            const value = '2020-02-03T15:04:05Z';
            const ldc = w.LDCManager.prototype;
            const cdk = w.CDKManager.prototype;
            for (const invalid of ['bad-date', null, '']) {
                assert.equal(ldc._fmtTime(invalid), '—');
                assert.equal(cdk._formatTime(invalid, true), '—');
            }
            const full = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
            assert.equal(ldc._fmtTime(value, true), new Date(value).toLocaleString(locale, { ...full, second: '2-digit' }));
            assert.equal(ldc._fmtTime(value), new Date(value).toLocaleString(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
            assert.equal(cdk._formatTime(value, true), new Date(value).toLocaleString(locale, full));
            assert.equal(cdk._formatTime(value), new Date(value).toLocaleDateString(locale, { month: '2-digit', day: '2-digit' }));
        } finally { dom.window.close(); }
    }
});
