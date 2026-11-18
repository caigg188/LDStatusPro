import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { parse } from 'acorn';

const source = readFileSync(new URL('../LDStatusPro.user.js', import.meta.url), 'utf8');
const classes = new Map();
function walk(node) {
    if (node.type === 'ClassDeclaration') classes.set(node.id.name, source.slice(node.start, node.end));
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(child => child?.type && walk(child));
        else if (value?.type) walk(value);
    }
}
walk(parse(source, { ecmaVersion: 'latest' }));
const token = (name = 'old') => `header.${Buffer.from(JSON.stringify({ sub: 7, exp: 4102444800, name })).toString('base64url')}.signature`;
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture(values = new Map()) {
    const events = [];
    const context = vm.createContext({ Date, Math, JSON, atob, Logger: { log() {}, error() {} },
        EventBus: { emit: (...args) => events.push(args) } });
    const OAuth = vm.runInContext(`${classes.get('NetworkError')}\n${classes.get('OAuthManager')}\nOAuthManager`, context);
    const pending = deferred();
    const calls = [];
    const oauth = new OAuth({ getGlobal: (key, fallback) => values.has(key) ? values.get(key) : fallback,
        setGlobalNow: (key, value) => values.set(key, value) }, { api: (path, options) => { calls.push({ path, options }); return pending.promise; } });
    const login = (value = token()) => { oauth.setToken(value); oauth.setUserInfo({ id: 7, username: 'fixture' }); oauth.setJoined(true); };
    return { oauth, pending, events, calls, values, login };
}

for (const tabs of [1, 2]) {
    for (const sameToken of [false, true]) {
        for (const result of ['payload', 'exception', 'success', 'network']) {
            test(`${tabs} tab(s): a stale ${result} preserves a ${sameToken ? 'same-JWT' : 'new-JWT'} login`, async () => {
                const old = fixture(); old.login();
                const pending = old.oauth.api('/api/user/self');
                const current = tabs === 1 ? old : fixture(old.values);
                const nextToken = sameToken ? token() : token('new'); current.login(nextToken);
                if (result === 'payload') old.pending.resolve({ success: false, error: { code: 'INVALID_TOKEN' } });
                else if (result === 'exception') old.pending.reject(Object.assign(new Error('UNAUTHORIZED'), { code: 'UNAUTHORIZED', status: 401 }));
                else if (result === 'network') old.pending.reject(new Error('Network error'));
                else old.pending.resolve({ success: true, data: { isJoined: false, stale: true } });
                assert.equal((await pending).error.code, 'SESSION_CHANGED');
                assert.equal(current.oauth.getToken(), nextToken);
                assert.equal(current.oauth.getUserInfo().username, 'fixture');
                assert.equal(current.oauth.isJoined(), true);
                assert.equal(old.events.length, 0);
                assert.equal(old.calls[0].options.token, token());
            });
        }
    }
}

test('a current 401 clears only the current shared session and emits a matching logout generation', async () => {
    const f = fixture(); f.login();
    const pending = f.oauth.api('/api/user/self');
    f.pending.resolve({ success: false, error: { code: 'UNAUTHORIZED' } });
    assert.equal((await pending).error.code, 'UNAUTHORIZED');
    assert.equal(f.oauth.getToken(), null);
    assert.equal(f.oauth.getUserInfo(), null);
    assert.equal(f.oauth.isJoined(), false);
    assert.equal(f.events[0][0], 'auth:expired');
    assert.equal(f.events[0][1].generation, f.values.get('leaderboardAuthGeneration'));
});
test('a shared-tab logout is not undone by an older success', async () => {
    const old = fixture(); old.login(); const pending = old.oauth.api('/api/user/self');
    fixture(old.values).oauth.logout();
    old.pending.resolve({ success: true, data: { isJoined: true } });
    assert.equal((await pending).error.code, 'SESSION_CHANGED');
    assert.equal(old.oauth.getToken(), null);
});
test('a public request without credentials cannot expire a later login', async () => {
    const old = fixture(); const pending = old.oauth.api('/api/config', { requireAuth: false });
    fixture(old.values).login(token('new'));
    old.pending.resolve({ success: false, error: { code: 'AUTH_REQUIRED' } });
    assert.equal((await pending).error.code, 'SESSION_CHANGED');
    assert.equal(old.events.length, 0);
});
test('pre-generation credentials still work and genuinely expired credentials stop before the network', async () => {
    const f = fixture(new Map([['leaderboardToken', token()], ['leaderboardUser', { id: 7 }]]));
    const pending = f.oauth.api('/api/user/self'); f.pending.resolve({ success: true });
    assert.equal((await pending).success, true);
    f.oauth.setToken('header.' + Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url') + '.signature');
    assert.equal((await f.oauth.api('/api/user/self')).error.code, 'TOKEN_EXPIRED');
    assert.equal(f.calls.length, 1);
    assert.equal(f.oauth.getToken(), null);
});
