import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { chromium } from 'playwright';

const source = readFileSync(new URL('../LDStatusPro.user.js', import.meta.url), 'utf8');
const start = source.indexOf('        const isTopWindow = ');
const end = source.indexOf('        // 确保 DOM 就绪后启动', start);
assert.ok(start > 0 && end > start, 'startup block not found');

async function runStartup(win) {
    const calls = [];
    const context = vm.createContext({
        window: win,
        TabLeader: { init: () => calls.push('leader') },
        Network: { loadReadingLevels: () => Promise.resolve() },
        Panel: class { constructor() { calls.push('panel'); } },
        Logger: { error() {} },
        requestIdleCallback: fn => fn()
    });
    await vm.runInContext(`${source.slice(start, end)}; startup()`, context);
    return calls;
}

function topWindow(extra = {}) {
    const win = { location: { ancestorOrigins: { length: 0 } }, ...extra };
    win.top = win;
    win.self = win;
    return win;
}

function framedWindow(location) {
    const win = { top: {}, location };
    win.self = win;
    return win;
}

test('the top window starts leader election and the panel', async () => {
    assert.deepEqual(await runStartup(topWindow()), ['leader', 'panel']);
});

test('a framed window starts nothing (Chromium/Safari: ancestorOrigins lists the parent)', async () => {
    const win = framedWindow({ ancestorOrigins: { length: 1 } });
    assert.deepEqual(await runStartup(win), []);
});

test('a framed window starts nothing where ancestorOrigins does not exist (Firefox)', async () => {
    assert.deepEqual(await runStartup(framedWindow({})), []);
});

test('a manager that wraps window cannot hide the panel on a real top-level page', async () => {
    // Identity comparison fails although the page is not framed: ancestorOrigins is empty.
    const win = { top: {}, self: {}, location: { ancestorOrigins: { length: 0 } } };
    assert.deepEqual(await runStartup(win), ['leader', 'panel']);
});

test('an unreadable window.top or location is treated as top-level, never as a frame', async () => {
    const blockedTop = { location: {} };
    blockedTop.self = blockedTop;
    Object.defineProperty(blockedTop, 'top', { get() { throw new Error('blocked'); } });
    assert.deepEqual(await runStartup(blockedTop), ['leader', 'panel']);

    const blockedLocation = { top: {} };
    blockedLocation.self = blockedLocation;
    Object.defineProperty(blockedLocation, 'location', { get() { throw new Error('blocked'); } });
    assert.deepEqual(await runStartup(blockedLocation), ['leader', 'panel']);
});

test('the userscript keeps matching frames: the cdk bridge depends on running inside an iframe', () => {
    const header = source.slice(0, source.indexOf('// ==/UserScript=='));
    assert.ok(!/@noframes/.test(header), '@noframes would disable the cdk.linux.do bridge');
});

function resolveChromiumPath() {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        || process.env.CHROME_BIN
        || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'].find(existsSync)
        || undefined;
}

// Boots the complete, unmodified userscript in every matching frame, the way a userscript
// manager does, against documents served with the headers linux.do uses for mini-apps.
const GM_STUBS = `
    const __store = new Map();
    const GM_getValue = (key, fallback) => (__store.has(key) ? __store.get(key) : fallback);
    const GM_setValue = (key, value) => { __store.set(key, value); };
    const GM_addValueChangeListener = () => 1;
    const GM_removeValueChangeListener = () => {};
    const GM_xmlhttpRequest = options => { setTimeout(() => options.onerror && options.onerror({ status: 0 }), 0); return { abort() {} }; };
    const GM_info = { script: { version: '0.0.0-test' }, scriptHandler: 'test' };
    const GM_openInTab = () => {};
    const GM_notification = () => {};
`;
const html = body => `<!doctype html><html><head><meta charset="utf-8"><title>LINUX DO</title></head><body>${body}</body></html>`;
const FRAME_HOST_CSP = "default-src 'none'; script-src 'none'; style-src 'self'; frame-src 'self'; frame-ancestors *";

test('real Chromium: only the top page gets a panel; mini-app, sandboxed and same-origin frames do not (#101)', async t => {
    const browser = await chromium.launch({ executablePath: resolveChromiumPath(), args: ['--no-sandbox'] });
    t.after(() => browser.close());
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript({ content: `(() => { ${GM_STUBS}\n${source}\n})();` });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'cdk.linux.do') return route.fulfill({ contentType: 'text/html', body: html('cdk') });
        if (url.hostname !== 'linux.do') return route.abort();
        if (url.pathname === '/') {
            return route.fulfill({
                contentType: 'text/html',
                body: html(`<iframe class="mini-app-frame-host" src="/mini-app-api/frame-host"></iframe>
                    <iframe src="/t/topic/1"></iframe>
                    <iframe id="cdk" src="https://cdk.linux.do/bridge"></iframe>`)
            });
        }
        if (url.pathname === '/mini-app-api/frame-host') {
            return route.fulfill({
                contentType: 'text/html',
                headers: { 'content-security-policy': FRAME_HOST_CSP },
                body: html('<iframe sandbox="allow-scripts" src="/mini-app-api/app"></iframe>')
            });
        }
        if (url.pathname === '/mini-app-api/app' || url.pathname === '/t/topic/1') {
            return route.fulfill({ contentType: 'text/html', body: html('<p>frame</p>') });
        }
        return route.abort();
    });

    await page.goto('https://linux.do/');
    await page.locator('#ldsp-panel').waitFor({ state: 'attached' });
    // Give framed documents the same time the top page needed, then a margin.
    await page.waitForTimeout(1000);

    const panels = {};
    for (const frame of page.frames()) {
        const url = new URL(frame.url());
        panels[url.host + url.pathname] = await frame.evaluate(() => {
            const panel = document.getElementById('ldsp-panel');
            return panel ? getComputedStyle(panel).position : null;
        });
    }
    assert.deepEqual(panels, {
        'linux.do/': 'fixed',
        'linux.do/mini-app-api/frame-host': null,
        'linux.do/mini-app-api/app': null,
        'linux.do/t/topic/1': null,
        'cdk.linux.do/bridge': null
    });

    const bridge = await page.evaluate(() => new Promise(resolve => {
        const timer = setTimeout(() => resolve('no-response'), 1500);
        window.addEventListener('message', event => {
            if (event.data?.type !== 'ldsp-cdk-response') return;
            clearTimeout(timer);
            resolve(event.data.requestId);
        });
        document.getElementById('cdk').contentWindow.postMessage(
            { type: 'ldsp-cdk-request', requestId: 'bridge-check', url: 'https://not-allowed.example/' },
            'https://cdk.linux.do'
        );
    }));
    assert.equal(bridge, 'bridge-check', 'cdk bridge must still answer from inside an iframe');
    assert.deepEqual(errors, []);
});
