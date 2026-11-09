import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source = readFileSync(new URL('../LDStatusPro.user.js', import.meta.url), 'utf8');
const start = source.indexOf('            async _exchangeHandoff(grant)');
const end = source.indexOf('            async login()', start);
function fixture(state = 'signed-state') {
  const data = new Map([['ldsp.oauth.pkce', JSON.stringify({ verifier: 'v'.repeat(64), state })]]);
  const context = vm.createContext({ Date, JSON, location: { origin: 'https://linux.do' }, sessionStorage: {
    getItem: key => data.get(key), removeItem: key => data.delete(key)
  } });
  const oauth = vm.runInContext(`new (class { ${source.slice(start, end)} })()`, context);
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
  const grant = { c: 'code', s: 'signed-state', exp: Date.now() + 60000 };
  assert.equal((await f.oauth._exchangeHandoff(grant)).token, 'mock-response-token');
  assert.equal(await f.oauth._exchangeHandoff(grant), null);
  assert.equal(f.calls(), 1);
});
test('userscript rejects wrong state and expired code before a network request', async () => {
  const f = fixture();
  assert.equal(await f.oauth._exchangeHandoff({ c: 'code', s: 'other-state', exp: Date.now() + 60000 }), null);
  assert.equal(await f.oauth._exchangeHandoff({ c: 'code', s: 'signed-state', exp: Date.now() - 1 }), null);
  assert.equal(f.calls(), 0);
});
