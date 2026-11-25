import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { componentSource } from './helpers/topic-fixture.mjs';

test('Chromium: summary controls, regeneration, history follow-ups and language settings work on both forum origins', async t => {
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || process.env.CHROME_BIN
        || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
    const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
    t.after(() => browser.close());
    for (const origin of ['https://linux.do', 'https://idcflare.com']) {
        for (const width of [320, 390, 768, 1280]) {
            await t.test(`${origin} at ${width}px`, async () => {
                const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
                const errors = [];
                page.on('pageerror', error => errors.push(error.message));
                await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><div id="ldsp-panel" class="light"><div id="panel-body"></div></div><a class="current-user" href="/u/alice">Alice</a>' }));
                await page.goto(`${origin}/t/42`);
                // All traffic is local fixtures: no forum writes, real login or paid AI requests.
                await page.evaluate(() => {
                    const values = new Map([['ldsp_melon_config', JSON.stringify({ apiUrl: 'https://ai.invalid/v1', model: 'fixture', outputLanguage: 'en' })]]);
                    window.GM_getValue = (key, fallback) => values.get(key) ?? fallback;
                    window.GM_setValue = (key, value) => values.set(key, value);
                    window.requests = [];
                    window.GM_xmlhttpRequest = options => {
                        requests.push(JSON.parse(options.data));
                        queueMicrotask(() => options.onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: `Answer ${requests.length} [第1楼]` }, finish_reason: 'stop' }] }) }));
                        return { abort() { options.onabort(); } };
                    };
                    window.fetch = async url => {
                        const href = String(url);
                        if (href.includes('filter=summary')) return new Response(JSON.stringify({ id: 42, highest_post_number: 1,
                            post_stream: { stream: [1, 900], posts: [{ id: 1, topic_id: 42, post_number: 1, username: 'alice', cooked: '<p>Source text</p>' }] } }));
                        if (href.includes('post_ids')) return new Response(JSON.stringify({ post_stream: { posts: [{ id: 900, topic_id: 42, post_number: 900, username: 'bob', cooked: '<p>Late selected reply</p>' }] } }));
                        if (href.includes('post_number')) return new Response(JSON.stringify({ post_stream: { posts: [{ id: 900, topic_id: 42, post_number: 900, username: 'alice', cooked: '<p>Source text</p>' }] } }));
                        return new Response(JSON.stringify({ id: 42, title: 'Browser fixture', has_summary: true, highest_post_number: 900, posts_count: 900,
                            post_stream: { posts: [{ id: 1, topic_id: 42, post_number: 1, username: 'alice', cooked: '<p>Source text</p>' }] } }));
                    };
                    window.Logger = { log() {}, error() {}, warn() {} };
                    window.UI = { empty: ({ text }) => text };
                    window.Screen = { getConfig: () => ({}) };
                    window.Utils = { escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]), hexToRgb: () => ({ r: 0, g: 0, b: 0 }) };
                });
                await page.evaluate(componentSource());
                await page.evaluate(() => {
                    I18n.setLocale('en-US'); Styles.inject();
                    const panel = document.querySelector('#ldsp-panel');
                    panel.style.cssText = 'position:fixed;top:10px;left:10px;width:min(380px,calc(100vw - 20px));height:850px;display:block;opacity:1;visibility:visible;transform:none';
                    window.helper = new MelonHelper(document.querySelector('#panel-body'), { showToast() {} });
                    helper.init(); helper.show();
                });
                await page.locator('#melon-summarize').click();
                await page.locator('#melon-output').getByText('Answer 1', { exact: false }).waitFor();
                assert.equal(await page.locator('#melon-resume').isVisible(), false);
                await page.getByRole('button', { name: 'Generate again', exact: true }).click();
                await page.locator('#melon-output').getByText('Answer 2', { exact: false }).waitFor();
                await page.locator('[data-tab="history"]').click();
                await page.locator('[data-tab="home"]').click();
                await page.locator('#melon-output').getByText('Answer 2', { exact: false }).waitFor();
                await page.locator('#melon-expand').click();
                await page.locator('#viewer-chat-input').fill('Explain the conclusion');
                await page.locator('#viewer-chat-input').press('Enter');
                await page.locator('#viewer-chat-content').getByText('Answer 3', { exact: false }).waitFor();
                await page.locator('#viewer-close').click();
                await page.locator('[data-tab="settings"]').click();
                await page.locator('#melon-edit-settings').click();
                assert.equal(await page.locator('#melon-provider, #melon-nvidia-python, #melon-output-language, #melon-load-models').count(), 0);
                assert.match(await page.locator('#melon-prompt-detailed').getAttribute('placeholder'), /^Answer in English\./);
                await page.locator('#melon-api-url').fill('https://custom.invalid/v1');
                await page.locator('#melon-api-key').fill('fixture-key');
                await page.locator('#melon-model').fill('vendor/browser-choice');
                await page.locator('#melon-save-settings').click();
                assert.equal(await page.locator('#melon-model').inputValue(), 'vendor/browser-choice');
                const overflow = await page.locator('.ldsp-melon-body').evaluate(el => el.scrollWidth > el.clientWidth + 1);
                assert.equal(overflow, false, 'Settings must fit the panel width');
                await page.locator('[data-tab="home"]').click();
                await page.locator('#melon-summarize').click();
                await page.locator('#melon-output').getByText('Answer 4', { exact: false }).waitFor();
                const payload = await page.evaluate(() => requests.at(-1));
                assert.equal(payload.chat_template_kwargs, undefined);
                assert.match(payload.messages[0].content, /^Answer in English\./);
                assert.ok(payload.messages.every(message => typeof message.content === 'string'));
                await page.evaluate(() => I18n.setLocale('zh-CN'));
                await page.locator('[data-tab="settings"]').click();
                assert.match(await page.locator('#melon-prompt-detailed').getAttribute('placeholder'), /^请用简体中文回答。/);
                await page.locator('[data-tab="home"]').click();
                await page.locator('#melon-summarize').click();
                await page.locator('#melon-output').getByText('Answer 5', { exact: false }).waitFor();
                assert.match(await page.evaluate(() => requests.at(-1).messages[0].content), /^请用简体中文回答。/);
                await page.locator('#melon-expand').click();
                await page.locator('#viewer-chat-sources').check();
                await page.locator('#viewer-chat-input').fill('Explain [第1楼]');
                await page.locator('#viewer-chat-send').click();
                await page.locator('#viewer-chat-content').getByText('Answer 6', { exact: false }).waitFor();
                assert.match(await page.evaluate(() => requests.at(-1).messages[0].content), /Original reply excerpts[\s\S]*Source text/);
                assert.equal(await page.locator('#viewer-chat-content .assistant').last().locator('a[href$="/t/42/1"]').count(), 1);
                if (width === 1280) {
                    await page.locator('#viewer-close').click();
                    await page.locator('#melon-source-mode').selectOption('popular');
                    await page.locator('#melon-summarize').click();
                    await page.locator('#melon-output').getByText('Answer 7', { exact: false }).waitFor();
                    const popular = await page.evaluate(() => JSON.stringify(requests.at(-1)));
                    assert.match(popular, /Late selected reply/);
                    assert.match(popular, /热门回复/);
                    await page.locator('#melon-expand').click();
                    assert.equal(await page.locator('.ldsp-melon-viewer-mode.popular').count(), 1);
                }
                assert.deepEqual(errors, []);
                await page.evaluate(() => helper.destroy());
                await page.close();
            });
        }
    }
});
