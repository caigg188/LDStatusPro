// Read-only probes for baseline 1513b7c; real methods with synthetic state/network.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { JSDOM } from 'jsdom';
import { panelFixtureSource } from '../../tests/helpers/panel-fixture.mjs';

const test = readFileSync(new URL('../../tests/panel-workflows-i18n.test.mjs', import.meta.url), 'utf8');
const scriptUrl = new URL('../../LDStatusPro.user.js', import.meta.url).href;
const build = test.slice(test.indexOf('function buildWorkflowBundle()'), test.indexOf("\ntest('follow"))
    .replace("new URL('../LDStatusPro.user.js', import.meta.url)", `new URL(${JSON.stringify(scriptUrl)})`);
const bundle = new Function('readFileSync', 'parse', build + ';return buildWorkflowBundle();')(readFileSync, parse);
const dom = new JSDOM('<html><body></body></html>', { url: 'https://linux.do/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
const results = [];
async function probe(name, run) {
    try { await run(); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: error.message }); }
}
try {
    w.eval(bundle);
    for (const locale of ['zh-CN', 'en-US']) {
        const h = w.createWorkflowHarness(locale);
        const order = { id: 1, type: 'receive', status: 'success', amount: 5, order_name: 'Example', created_at: '2026-01-02T13:04:00Z' };
        h.ldc._trans = { orders: [order], total: 1, hasMore: false };
        await probe(`${locale}: known LDC type resolves in list and detail`, () => {
            h.ldc._renderTransUI();
            const list = h.ldc.overlay.querySelector('.ldsp-ldc-trans-type').textContent;
            h.ldc._showDetail(order);
            const detail = h.ldc.overlay.querySelector('.ldsp-ldc-trans-type').textContent;
            assert.doesNotMatch(`${list} | ${detail}`, /undefined/);
        });
        await probe(`${locale}: filtered empty LDC list explains active filters`, () => {
            h.ldc._trans.orders = [];
            h.ldc._filter = { timeRange: '7days', type: 'receive' };
            h.ldc._renderTransUI();
            assert.ok(h.ldc.overlay.querySelector('.ldsp-ldc-empty-hint')?.textContent, 'filter explanation is missing');
        });
        await probe(`${locale}: CDK creator text survives exactly once`, () => {
            h.cdk._renderDetail({ name: 'Example', creator_nickname: 'Alice & Bob <3', status: 0 });
            const text = h.cdk.overlay.querySelector('.ldsp-cdk-detail-meta').textContent;
            assert.ok(text.includes('Alice & Bob <3'), text);
        });
        if (locale === 'en-US') await probe('activity error follows en-US', async () => {
            h.activity.network = { fetchJson: async () => ({}) };
            await assert.rejects(h.activity._fetchReadPage(), error => {
                assert.doesNotMatch(error.message, /[\u3400-\u9fff]/);
                return true;
            });
        });
    }
    w.eval(panelFixtureSource({ initialStore: { locale: 'zh-CN' } }));
    w.panel._setLocalePreference('en-US');
    await probe('active follow-up chat blocks locale reload (method-level)', () => {
        w.panel.melonHelper = { _abortController: null, _chatAbortController: new w.AbortController() };
        assert.equal(w.panel._reloadForLocaleChange(), false);
    });
    await probe('pending melon settings block locale reload (method-level)', () => {
        w.panel.melonHelper = { _abortController: null, _chatAbortController: null, hasUnsavedSettings: () => true };
        assert.equal(w.panel._reloadForLocaleChange(), false);
    });
    await probe('reload proceeds once edits are saved or discarded (method-level)', () => {
        w.panel.melonHelper = { _abortController: null, _chatAbortController: null, hasUnsavedSettings: () => false };
        assert.equal(w.panel._reloadForLocaleChange(), true);
    });
} finally { w.close(); }
console.log(JSON.stringify({ baseline: '1513b7c', probes: results.length,
    passed: results.filter(result => result.pass).length, results }, null, 2));
process.exitCode = results.some(result => !result.pass) ? 1 : 0;
