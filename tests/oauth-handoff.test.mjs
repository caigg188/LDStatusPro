import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source = readFileSync(new URL('../LDStatusPro.user.js', import.meta.url), 'utf8');
const start = source.indexOf('            async _exchangeHandoff(grant)');
const end = source.indexOf('            async login()', start);
const validatorStart = source.indexOf('        function isOAuthHandoff(data)');
const validatorEnd = source.indexOf('        let _pendingOAuthData', validatorStart);
const validator = source.slice(validatorStart, validatorEnd);
function fixture(state = 'signed-state', browserNow = Date.now()) {
  const data = new Map([['ldsp.oauth.pkce', JSON.stringify({ verifier: 'v'.repeat(64), state })]]);
  const context = vm.createContext({ Date: { now: () => browserNow }, Number, JSON, location: { origin: 'https://linux.do' }, sessionStorage: {
    getItem: key => data.get(key), removeItem: key => data.delete(key)
  } });
  const oauth = vm.runInContext(`${validator} new (class { ${source.slice(start, end)} })()`, context);
  let calls = 0;
  oauth.network = { api: async (path, options) => {
    calls++; assert.equal(path, '/api/auth/exchange');
    assert.equal(options.body.audience, 'ldsp');
    assert.equal(options.body.verifier, 'v'.repeat(64));
    return { success: true, data: { token: 'mock-response-token', user: { id: 7 } } };
  } };
  return { oauth, data, calls: () => calls };
}
test('userscript consumes the expected browser state and exchanges code once', async () => {
  const f = fixture();
  const grant = { c: 'c'.repeat(43), s: 'signed-state', exp: Date.now() + 60000 };
  assert.equal((await f.oauth._exchangeHandoff(grant)).token, 'mock-response-token');
  assert.equal(await f.oauth._exchangeHandoff(grant), null);
  assert.equal(f.calls(), 1);
});
test('userscript rejects wrong state and malformed grants before a network request', async () => {
  const f = fixture();
  assert.equal(await f.oauth._exchangeHandoff({ c: 'c'.repeat(43), s: 'other-state', exp: Date.now() + 60000 }), null);
  assert.equal(await f.oauth._exchangeHandoff({ c: 'short', s: 'signed-state', exp: Date.now() + 60000 }), null);
  assert.equal(f.calls(), 0);
});

for (const offset of [-30000, -5000, 120000]) {
  test(`userscript delegates expiry to the issuer with browser offset ${offset}ms`, async () => {
    const serverNow = Date.now();
    const f = fixture('signed-state', serverNow + offset);
    const grant = { c: 'c'.repeat(43), s: 'signed-state', exp: serverNow + 60000 };
    assert.equal((await f.oauth._exchangeHandoff(grant)).token, 'mock-response-token');
    assert.equal(f.calls(), 1);
  });
}
test('early capture and fallback parse also use the clock-independent validator', () => {
  const early = source.slice(source.indexOf('let _pendingOAuthData'), source.indexOf('// ==================== 浏览器兼容性检查'));
  assert.match(early, /isOAuthHandoff\(decoded\)/);
  const parse = source.slice(source.indexOf('_checkUrlHashLogin() {'), source.indexOf('_clearUrlHash() {'));
  assert.match(parse, /isOAuthHandoff\(decoded\)/);
  assert.doesNotMatch(early + parse, /exp\s*[<>]=?\s*Date\.now/);
});
