// Real browser rendering of extracted production methods with isolated storage.
// Does not stand in for installation into Tampermonkey/Violentmonkey.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright';
import { panelFixtureSource } from '../../tests/helpers/panel-fixture.mjs';

const output = resolve(process.argv[2] || '/tmp/opencode/lds-i18n-acceptance');
mkdirSync(output, { recursive: true });
const results = [];
for (const [engineName, engine] of Object.entries({ chromium, firefox })) {
    const browser = await engine.launch(engineName === 'chromium' ? { channel: 'chromium' } : {});
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh-CN"><head></head><body></body></html>' }));
        await page.goto('https://linux.do/');
        await page.unroute('**/*');
        await page.route('**/*', route => route.abort());
        for (const locale of ['zh-CN', 'en-US']) {
            const fixture = panelFixtureSource({ initialStore: { locale } });
            for (const width of [320, 390, 1440]) for (const theme of ['light', 'dark']) {
                await page.setViewportSize({ width, height: 900 });
                await page.setContent('<!doctype html><html lang="zh-CN"><head></head><body></body></html>');
                await page.evaluate(fixture);
                await page.evaluate(theme => {
                    panel.el.classList.toggle('light', theme === 'light');
                    panel.el.style.left = '4px';
                    panel.size.width = Math.min(380, innerWidth - 8);
                    panel._lastSizeKey = '';
                    panel._applyPanelSize();
                }, theme);
                await page.locator('.ldsp-settings').focus();
                await page.keyboard.press('Enter');
                assert.equal(await page.locator('.ldsp-settings-menu').getAttribute('aria-hidden'), 'false');
                await page.locator('[data-settings-open="language"]').click();
                for (const level of [1, 5]) {
                    await page.evaluate(level => { panel.fontSizeLevel = level; panel._lastSizeKey = ''; panel._applyPanelSize(); }, level);
                    const state = await page.evaluate(() => {
                        const view = document.querySelector('[data-settings-view="language"]');
                        const bounds = panel.el.getBoundingClientRect();
                        return {
                            locale: panel.el.lang, forumLocale: document.documentElement.lang,
                            overflow: view.scrollWidth - view.clientWidth,
                            left: bounds.left, right: bounds.right, viewport: innerWidth,
                            options: [...view.querySelectorAll('[data-locale-option]')].map(el => ({ locale: el.dataset.localeOption, text: el.textContent.trim() }))
                        };
                    });
                    assert.equal(state.locale, locale);
                    assert.equal(state.forumLocale, 'zh-CN');
                    assert.ok(state.left >= 0 && state.right <= state.viewport + 1, JSON.stringify(state));
                    assert.ok(state.overflow <= 1, JSON.stringify(state));
                    assert.equal(state.options.length, 2);
                    assert.ok(state.options.every(option => option.text));
                    const name = `${engineName}-${locale}-${theme}-${width}-font${level}`;
                    await page.screenshot({ path: resolve(output, `${name}.png`) });
                    results.push({ name, version: browser.version(), ...state });
                }
                const next = locale === 'zh-CN' ? 'en-US' : 'zh-CN';
                await page.locator(`[data-locale-option="${next}"]`).click();
                assert.equal(await page.evaluate(() => fixtureHarness.store.get('locale')), next);
                assert.equal(await page.evaluate(() => fixtureHarness.getReloadCalls()), 0);
                for (const guard of ['summary', 'chat', 'settings', 'export', 'ticket']) {
                    await page.evaluate(guard => {
                        panel.melonHelper = {}; panel.topicExporter = {}; panel.ticketManager = {};
                        if (guard === 'summary') panel.melonHelper._abortController = new AbortController();
                        if (guard === 'chat') panel.melonHelper._chatAbortController = new AbortController();
                        if (guard === 'settings') panel.melonHelper.hasUnsavedSettings = () => true;
                        if (guard === 'export') panel.topicExporter._abort = new AbortController();
                        if (guard === 'ticket') {
                            const overlay = document.createElement('div'); overlay.className = 'show';
                            overlay.innerHTML = '<textarea>Unsaved ticket</textarea>';
                            panel.ticketManager.overlay = overlay;
                        }
                    }, guard);
                    await page.locator('[data-settings-lang-reload]').click();
                    assert.equal(await page.evaluate(() => fixtureHarness.getReloadCalls()), 0, guard);
                }
                await page.evaluate(() => { panel.melonHelper = {}; panel.topicExporter = {}; panel.ticketManager = {}; });
                await page.locator('[data-settings-lang-reload]').click();
                assert.equal(await page.evaluate(() => fixtureHarness.getReloadCalls()), 1);
                await page.evaluate(() => fixtureHarness.setFailWrites(true));
                await page.locator(`[data-locale-option="${locale}"]`).click();
                assert.equal(await page.evaluate(() => panel._localePersistFailed), true);
                assert.equal(await page.evaluate(() => fixtureHarness.store.get('locale')), next);
            }
        }
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
}
writeFileSync(resolve(output, 'results.json'), JSON.stringify({ date: new Date().toISOString(), scope: 'Extracted production panel, real browser, mocked storage/reload and operation state; external network blocked. Keyboard activation, layout bounds, locale persistence/failure, guards; not manager acceptance.', results }, null, 2) + '\n');
console.log(`Passed ${results.length} browser/locale/theme/viewport/font scenarios; artifacts: ${output}`);
