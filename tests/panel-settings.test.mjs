import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { panelFixtureSource } from './helpers/panel-fixture.mjs';

const VIEWS = [
    'root',
    'theme',
    'reading-goal',
    'font-size',
    'actions-root',
    'actions-toggle',
    'actions-order',
    'requirements-display',
    'language'
];

function resolveChromiumPath() {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        || process.env.CHROME_BIN
        || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'].find(existsSync)
        || undefined;
}

test('settings menu never clips zh-CN or en-US labels at any font scale and keeps gear button clickable (#62 + i18n)', async t => {
    const browser = await chromium.launch({
        executablePath: resolveChromiumPath(),
        args: ['--no-sandbox']
    });
    t.after(() => browser.close());

    const page = await browser.newPage();
    page.setDefaultTimeout(2000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.route('**/*', route => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html><head></head><body></body></html>'
    }));
    await page.goto('https://linux.do/');
    await page.unroute('**/*');
    await page.route('**/*', route => route.abort());

    for (const locale of ['zh-CN', 'en-US']) {
        const fixture = panelFixtureSource({ initialStore: { locale } });

        for (const [viewportWidth, viewportHeight] of [[1440, 900], [1440, 500], [390, 844], [320, 620]]) {
            await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
            await page.setContent('<!doctype html><html><head></head><body></body></html>');
            await page.evaluate(fixture);

            const levels = await page.evaluate(() => window.panel._fontSizeLevels);

            for (const direction of ['left', 'right']) {
                await t.test(`${locale} / ${viewportWidth}x${viewportHeight} / interactive clicks / expand-${direction}`, async () => {
                    await page.evaluate(direction => {
                        const panel = window.panel;
                        panel._hideSettingsMenu();
                        panel.size.width = 260;
                        panel.fontSizeLevel = 5;
                        panel._lastSizeKey = '';
                        panel._applyPanelSize();
                        panel.el.classList.toggle('expand-left', direction === 'left');
                        panel.el.classList.toggle('expand-right', direction === 'right');
                        const renderedWidth = panel.el.getBoundingClientRect().width;
                        panel.el.style.left = direction === 'left'
                            ? `${Math.max(4, innerWidth - renderedWidth - 4)}px`
                            : '4px';
                    }, direction);

                    await page.locator('.ldsp-settings').click();
                    assert.deepEqual(errors, []);
                    assert.equal(await page.locator('.ldsp-settings-menu').getAttribute('aria-hidden'), 'false');

                    await page.locator('[data-settings-open="actions-root"]').click();
                    assert.equal(await page.evaluate(() => window.panel._settingsView), 'actions-root');
                    await page.locator('[data-settings-view="actions-root"] [data-settings-back="root"]').click();
                    assert.equal(await page.evaluate(() => window.panel._settingsView), 'root');

                    await page.locator('.ldsp-settings').click();
                    assert.equal(await page.locator('.ldsp-settings-menu').getAttribute('aria-hidden'), 'true');
                });
            }

            for (const width of [260, 300, 380]) {
                for (const level of levels) {
                    for (const direction of ['left', 'right']) {
                        await t.test(`${locale} / ${viewportWidth}x${viewportHeight} / ${width}px / ${level.label} / expand-${direction}`, async () => {
                            const report = await page.evaluate(({ width, level, direction, views }) => {
                                const state = window.panel;
                                state._hideSettingsMenu();
                                state.size.width = width;
                                state.fontSizeLevel = level.level;
                                state._lastSizeKey = '';
                                state._applyPanelSize();
                                state.el.classList.toggle('expand-left', direction === 'left');
                                state.el.classList.toggle('expand-right', direction === 'right');
                                const renderedWidth = state.el.getBoundingClientRect().width;
                                state.el.style.left = direction === 'left'
                                    ? `${Math.max(4, innerWidth - renderedWidth - 4)}px`
                                    : '4px';
                                state._showSettingsMenu();

                                const panel = state.el;
                                const menu = panel.querySelector('.ldsp-settings-menu');
                                const gear = panel.querySelector('.ldsp-settings');
                                const panelRect = panel.getBoundingClientRect();
                                const gearRect = gear.getBoundingClientRect();
                                const insideHdrBtns = !!menu.closest('.ldsp-hdr-btns');
                                const failures = [];

                                for (const view of views) {
                                    if (!menu.querySelector(`.ldsp-settings-view[data-settings-view="${view}"]`)) continue;
                                    state._setSettingsView(view);
                                    const menuRect = menu.getBoundingClientRect();
                                    const active = menu.querySelector(`.ldsp-settings-view[data-settings-view="${view}"]`);
                                    const clipped = [];

                                    for (const el of active.querySelectorAll('*')) {
                                        if (!el.checkVisibility()) continue;
                                        for (const node of el.childNodes) {
                                            if (node.nodeType !== 3 || !node.textContent.trim()) continue;
                                            const range = document.createRange();
                                            range.selectNodeContents(node);
                                            const textRect = range.getBoundingClientRect();
                                            for (let anc = el; anc && anc !== panel; anc = anc.parentElement) {
                                                const overflowX = getComputedStyle(anc).overflowX;
                                                if (!['hidden', 'clip', 'auto', 'scroll'].includes(overflowX)) continue;
                                                const box = anc.getBoundingClientRect();
                                                if (textRect.left < box.left - 1 || textRect.right > box.right + 1) {
                                                    clipped.push({
                                                        text: node.textContent.trim(),
                                                        overflow: Math.round(Math.max(box.left - textRect.left, textRect.right - box.right) * 100) / 100
                                                    });
                                                    break;
                                                }
                                            }
                                        }
                                    }

                                    const overlapsGear = menuRect.top < gearRect.bottom - 1
                                        && menuRect.left < gearRect.right
                                        && menuRect.right > gearRect.left;
                                    const outsidePanel = menuRect.left < panelRect.left - 0.5
                                        || menuRect.right > panelRect.right + 0.5;
                                    const outsideViewport = menuRect.left < -0.5
                                        || menuRect.right > innerWidth + 0.5;
                                    const horizontalOverflow = menu.scrollWidth > menu.clientWidth + 1;

                                    if (insideHdrBtns || clipped.length || overlapsGear || outsidePanel || outsideViewport || horizontalOverflow) {
                                        failures.push({
                                            view,
                                            menuWidth: Math.round(menuRect.width * 100) / 100,
                                            insideHdrBtns,
                                            clipped,
                                            overlapsGear,
                                            outsidePanel,
                                            outsideViewport,
                                            horizontalOverflow
                                        });
                                    }
                                }
                                state._hideSettingsMenu();
                                return failures;
                            }, { width, level, direction, views: VIEWS });

                            assert.deepEqual(errors, []);
                            assert.deepEqual(report, []);
                        });
                    }
                }
            }
        }
    }
});

test('language selector persists immediately, handles storage failure, guards active tasks and renders en-US on reload', async t => {
    const browser = await chromium.launch({
        executablePath: resolveChromiumPath(),
        args: ['--no-sandbox']
    });
    t.after(() => browser.close());

    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(2000);
    await page.route('**/*', route => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html lang="zh"><head></head><body></body></html>'
    }));
    await page.goto('https://linux.do/');
    await page.unroute('**/*');
    await page.route('**/*', route => route.abort());

    // 1. Corrupt/unsupported locale falls back to zh-CN without mutating forum <html lang>.
    await page.setContent('<!doctype html><html lang="zh"><head></head><body></body></html>');
    await page.evaluate(panelFixtureSource({ initialStore: { locale: 'unsupported-locale' } }));
    assert.equal(await page.locator('#ldsp-panel').getAttribute('lang'), 'zh-CN');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'zh');
    assert.equal(await page.locator('#ldsp-panel').getAttribute('aria-label'), 'Linux.do 信任级别面板');

    // 2. Storage write failure warns in chosen language and does not show reload button.
    await page.locator('.ldsp-settings').click();
    await page.locator('[data-settings-open="language"]').click();
    await page.evaluate(() => window.fixtureHarness.setFailWrites(true));
    await page.locator('[data-locale-option="en-US"]').click();
    const failNotice = await page.locator('[data-settings-lang-notice]').textContent();
    assert.match(failNotice, /Could not save language preference/);
    assert.equal(await page.locator('[data-settings-lang-reload]').isVisible(), false);

    // 3. Successful persistence stores en-US immediately and reveals safe reload button.
    await page.evaluate(() => window.fixtureHarness.setFailWrites(false));
    await page.locator('[data-locale-option="en-US"]').click();
    assert.equal(await page.evaluate(() => window.fixtureHarness.store.get('locale')), 'en-US');
    assert.equal(await page.locator('[data-settings-lang-reload]').isVisible(), true);
    assert.equal(await page.locator('[data-settings-lang-reload]').textContent(), 'Reload page to apply');

    // 4. Active task blocks reload so summaries/exports are never interrupted.
    await page.evaluate(() => { window.panel.melonHelper = { _abortController: new AbortController() }; });
    await page.locator('[data-settings-lang-reload]').click();
    assert.equal(await page.evaluate(() => window.fixtureHarness.getReloadCalls()), 0);
    assert.match(await page.locator('[data-settings-lang-notice]').textContent(), /Finish or stop the active task/);

    // 4b. An active follow-up chat and unsaved melon settings also block reload.
    await page.evaluate(() => { window.panel.melonHelper = { _abortController: null, _chatAbortController: new AbortController() }; });
    await page.locator('[data-settings-lang-reload]').click();
    assert.equal(await page.evaluate(() => window.fixtureHarness.getReloadCalls()), 0);
    await page.evaluate(() => { window.panel.melonHelper = { _abortController: null, hasUnsavedSettings: () => true }; });
    await page.locator('[data-settings-lang-reload]').click();
    assert.equal(await page.evaluate(() => window.fixtureHarness.getReloadCalls()), 0);

    // 5. Once tasks finish and edits are saved or discarded, reload proceeds cleanly.
    await page.evaluate(() => { window.panel.melonHelper = { _abortController: null, _chatAbortController: null, hasUnsavedSettings: () => false }; });
    await page.locator('[data-settings-lang-reload]').click();
    assert.equal(await page.evaluate(() => window.fixtureHarness.getReloadCalls()), 1);

    // 6. After reload with persisted en-US, panel container and header/settings render in English without touching forum <html>.
    await page.setContent('<!doctype html><html lang="zh"><head></head><body></body></html>');
    await page.evaluate(panelFixtureSource({ initialStore: { locale: 'en-US' } }));
    assert.equal(await page.locator('#ldsp-panel').getAttribute('lang'), 'en-US');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'zh');
    assert.equal(await page.locator('#ldsp-panel').getAttribute('aria-label'), 'Linux.do Trust Level Panel');
    assert.equal(await page.locator('.ldsp-settings').getAttribute('aria-label'), 'Settings');

    await page.locator('.ldsp-settings').click();
    const rootItems = await page.locator('[data-settings-view="root"] .ldsp-settings-nav-main').allTextContents();
    assert.deepEqual(rootItems, [
        '🎨 Appearance',
        '🎯 Reading Goal',
        '🔤 Font Size',
        '🔘 Actions',
        '📋 Requirements',
        '🌐 Language'
    ]);
    const rootValues = await page.locator('[data-settings-view="root"] .ldsp-settings-nav-value').allTextContents();
    assert.deepEqual(rootValues, [
        'System',
        '2 hrs',
        'Default',
        '6/6 on',
        'Unmet',
        'English'
    ]);
});
