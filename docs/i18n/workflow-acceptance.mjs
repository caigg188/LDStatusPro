// Browser acceptance for production topic-tool methods and bridge pages.
// Uses synthetic metadata and browser APIs; it does not use forum credentials.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox } from 'playwright';
import { componentSource, topicMetadata } from '../../tests/helpers/topic-fixture.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const userscript = readFileSync(resolve(root, 'LDStatusPro.user.js'), 'utf8');
const components = componentSource();
const out = resolve(process.argv[2] || '/tmp/opencode/lds-workflow-acceptance');
mkdirSync(out, { recursive: true });
const results = [];

async function installComponents(page, { config = {}, locale = 'en-US' } = {}) {
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
    await page.goto('https://forum.invalid/t/42');
    await page.setContent('<!doctype html><html><body><div id="ldsp-panel" class="light"><div id="panel-body"></div></div></body></html>');
    await page.evaluate(({ source, metadata, config, locale }) => {
        const values = new Map([['ldsp_melon_config', JSON.stringify(config)]]);
        window.fetch = async () => new Response(JSON.stringify(metadata), { status: 200, headers: { 'content-type': 'application/json' } });
        window.GM_xmlhttpRequest = () => { throw new Error('cross-origin requests are blocked in this fixture'); };
        window.GM_getValue = (key, fallback) => values.get(key) ?? fallback;
        window.GM_setValue = (key, value) => values.set(key, value);
        window.Logger = { log() {}, error() {}, warn() {} };
        window.UI = { empty: ({ text }) => text, loading: ({ text = 'Loading' } = {}) => `<div>${text}</div>`, spinner: () => '' };
        window.Screen = { getConfig: () => ({}) };
        window.Utils = {
            escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]),
            hexToRgb: () => ({ r: 0, g: 0, b: 0 })
        };
        window.eval(source);
        window.I18n.setLocale(locale);
        window.topicMetadata = metadata;
        const panel = document.querySelector('#panel-body');
        window.__fixture = { panel, values, renderer: { showToast(message) { window.__toast = message; } } };
    }, { source: components, metadata: topicMetadata, config, locale });
}

async function runTopicTools(browser, engineName, locale) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await installComponents(page, { locale });
    await page.evaluate(() => {
        const { panel, renderer } = window.__fixture;
        const exporter = window.__exporter = new window.TopicExporter(panel, renderer);
        exporter.init();
        exporter.show();
    });
    await page.locator('#export-end').waitFor({ timeout: 5000 });
    const assertions = await page.evaluate(async locale => {
        const { panel, renderer } = window.__fixture;
        const exporter = window.__exporter;
        document.querySelector('#export-end').value = '1';
        exporter._embedImg = false;
        const artifacts = [];
        exporter._download = (content, filename, type) => artifacts.push({ content, filename, type });
        await exporter._doExport({ ...window.topicMetadata, id: '42', highestPostNumber: 10 });
        exporter._format = 'md';
        await exporter._doExport({ ...window.topicMetadata, id: '42', highestPostNumber: 10 });
        const html = artifacts.find(item => item.filename.endsWith('.html'));
        const markdown = artifacts.find(item => item.filename.endsWith('.md'));
        if (!html || !html.content.includes('Content-Security-Policy') || !html.content.includes('const x = 1;')) throw new Error('HTML export artifact missing expected safe content');
        if (!markdown || !markdown.content.includes('https://forum.invalid/t/42/1')) throw new Error('Markdown export artifact missing canonical post URL');
        exporter.destroy();

        const helper = new window.MelonHelper(panel, renderer);
        helper.init();
        await helper._showViewer({ topicId: 42, title: 'Title <safe>', summary: 'Summary **text**', mode: 'brief', timestamp: 1, site: 'https://forum.invalid' });
        const viewer = helper._viewerOverlay;
        const viewerState = {
            lang: viewer.lang,
            role: viewer.getAttribute('role'),
            modal: viewer.getAttribute('aria-modal'),
            label: viewer.getAttribute('aria-label'),
            escapedTitle: viewer.querySelector('.ldsp-melon-viewer-topic-title').textContent,
            controls: [...viewer.querySelectorAll('button')].map(button => button.getAttribute('title')).filter(Boolean),
            inputLabel: viewer.querySelector('#viewer-chat-input').getAttribute('placeholder')
        };
        if (viewerState.lang !== locale || viewerState.role !== 'dialog' || viewerState.modal !== 'true') throw new Error('viewer accessibility attributes missing');
        if (viewerState.escapedTitle !== 'Title <safe>') throw new Error('viewer title was not rendered as text');
        viewer.querySelector('#viewer-font').click();
        viewer.querySelector('[data-size="lg"]').click();
        if (!viewer.querySelector('#viewer-chat-content').classList.contains('font-lg')) throw new Error('viewer font control did not apply');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        if (helper._viewerOverlay) throw new Error('viewer Escape close failed');
        helper.destroy();
        return { artifacts: artifacts.map(({ filename, type }) => ({ filename, type })), viewerState };
    }, locale);
    assert.deepEqual(errors, []);
    results.push({ engine: engineName, locale, scope: 'topic export HTML/Markdown and AI viewer', ...assertions });
    await page.close();
}

async function runBridge(browser, engineName, host, kind) {
    const page = await browser.newPage();
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
    await page.goto(kind === 'cdk' ? 'https://linux.do/' : `https://${host}/`);
    let target = page;
    if (kind === 'cdk') {
        await page.evaluate(async host => {
            window.__responses = [];
            window.addEventListener('message', event => {
                if (event.origin === `https://${host}` && event.data?.type === 'ldsp-cdk-response') window.__responses.push(event.data);
            });
            const frame = document.createElement('iframe');
            frame.src = `https://${host}/`;
            const loaded = new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('CDK fixture frame did not load')), 5000);
                frame.onload = () => { clearTimeout(timer); resolve(); };
            });
            document.body.appendChild(frame);
            await loaded;
        }, host);
        target = page.frames().find(frame => frame.url() === `https://${host}/`);
        assert.ok(target, 'CDK fixture frame must be attached');
    }
    let outcome = await target.evaluate(async ({ source, kind }) => {
        const writes = [];
        const listeners = new Map();
        let listenerId = 0;
        const values = new Map();
        window.GM_getValue = (key, fallback) => values.has(key) ? values.get(key) : fallback;
        window.GM_setValue = (key, value) => {
            values.set(key, value); writes.push({ key, value });
            listeners.get(key)?.forEach(callback => callback(key, null, value));
        };
        window.GM_addValueChangeListener = (key, callback) => { const id = ++listenerId; if (!listeners.has(key)) listeners.set(key, new Map()); listeners.get(key).set(id, callback); return id; };
        window.GM_removeValueChangeListener = (key, id) => listeners.get(key)?.delete(id);
        window.fetch = async url => new Response(JSON.stringify({ ok: true, path: new URL(url, location.href).pathname }), { status: 200 });
        window.eval(source);
        if (kind === 'cdk') {
            return { fetchOrigin: location.origin };
        }
        const request = { requestId: 8, url: 'https://credit.linux.do/api/v1/dashboard/stats/daily?days=7', method: 'GET' };
        const callback = listeners.get('ldsp_ldc_bridge_req')?.values().next().value;
        if (!callback) throw new Error('LDC bridge request listener was not installed');
        callback('ldsp_ldc_bridge_req', null, request);
        for (let i = 0; i < 100 && !writes.some(item => item.key === 'ldsp_ldc_bridge_res'); i++) await new Promise(resolve => setTimeout(resolve, 5));
        const result = writes.find(item => item.key === 'ldsp_ldc_bridge_res')?.value;
        if (result?.requestId !== 8 || result.status !== 200 || !result.data.ok) throw new Error('LDC bridge did not write the fetched payload');
        callback('ldsp_ldc_bridge_req', null, { ...request, requestId: 9, url: 'https://outside.invalid/api/v1/dashboard/stats/daily' });
        for (let i = 0; i < 100 && !writes.some(item => item.value?.requestId === 9); i++) await new Promise(resolve => setTimeout(resolve, 5));
        const denied = writes.find(item => item.value?.requestId === 9)?.value;
        if (denied?.status !== 0 || denied.data?._error !== '非法请求') throw new Error('LDC bridge did not reject an external URL');
        return { result, denied, fetchOrigin: location.origin, writes: writes.map(item => item.key) };
    }, { source: userscript, kind });
    if (kind === 'cdk') {
        await page.evaluate(() => {
            const bridge = document.querySelector('iframe').contentWindow;
            bridge.postMessage({ type: 'ldsp-cdk-request', requestId: 7, url: 'https://cdk.linux.do/api/v1/projects/demo' }, 'https://cdk.linux.do');
            bridge.postMessage({ type: 'ldsp-cdk-request', requestId: 9, url: 'https://outside.invalid/api/v1/projects/demo' }, 'https://cdk.linux.do');
        });
        await page.waitForFunction(() => window.__responses.length === 2, null, { timeout: 5000 });
        const responses = await page.evaluate(() => window.__responses);
        assert.equal(responses.find(item => item.requestId === 7)?.data?.ok, true);
        assert.equal(responses.find(item => item.requestId === 9)?.status, 0);
        assert.equal(responses.find(item => item.requestId === 9)?.data?._error, '非法请求');
        outcome = { ...outcome, responses };
    }
    results.push({ engine: engineName, scope: `${kind} bridge synthetic protocol`, ...outcome });
    await page.close();
}

for (const [engineName, engine] of Object.entries({ chromium, firefox })) {
    const browser = await engine.launch(engineName === 'chromium' ? { channel: 'chromium' } : {});
    try {
        for (const locale of ['zh-CN', 'en-US']) await runTopicTools(browser, engineName, locale);
        await runBridge(browser, engineName, 'cdk.linux.do', 'cdk');
        await runBridge(browser, engineName, 'credit.linux.do', 'ldc');
    } finally { await browser.close(); }
}

writeFileSync(resolve(out, 'results.json'), JSON.stringify({ date: new Date().toISOString(), scope: 'Synthetic browser acceptance with production extracted topic methods and full bridge-page branch; no credentials or external API data.', results }, null, 2) + '\n');
console.log(`Passed ${results.length} topic-tool/bridge browser scenarios; artifacts: ${out}`);
