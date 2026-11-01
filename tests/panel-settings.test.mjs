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
    'requirements-display'
];

function resolveChromiumPath() {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        || process.env.CHROME_BIN
        || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'].find(existsSync)
        || undefined;
}

test('settings menu uses panel header width, never clips labels at any font scale and keeps gear button clickable (#62)', async t => {
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

    const fixture = panelFixtureSource();

    for (const [viewportWidth, viewportHeight] of [[1440, 900], [1440, 500], [390, 844], [320, 620]]) {
        await page.setViewportSize({ width: viewportWidth, height: viewportHeight });
        await page.setContent('<!doctype html><html><head></head><body></body></html>');
        await page.evaluate(fixture);

        const levels = await page.evaluate(() => window.panel._fontSizeLevels);

        for (const direction of ['left', 'right']) {
            await t.test(`${viewportWidth}x${viewportHeight} / interactive clicks / expand-${direction}`, async () => {
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

                // Clicking the gear button again must not be intercepted by the open menu.
                await page.locator('.ldsp-settings').click();
                assert.equal(await page.locator('.ldsp-settings-menu').getAttribute('aria-hidden'), 'true');
            });
        }

        for (const width of [260, 300, 380]) {
            for (const level of levels) {
                for (const direction of ['left', 'right']) {
                    await t.test(`${viewportWidth}x${viewportHeight} / ${width}px / ${level.label} / expand-${direction}`, async () => {
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
});
