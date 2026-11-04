import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'acorn';
import { chromium } from 'playwright';

function resolveChromiumPath() {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        || process.env.CHROME_BIN
        || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'].find(existsSync)
        || undefined;
}

function buildTopicToolsBundle() {
    const source = readFileSync(new URL('../LDStatusPro.user.js', import.meta.url), 'utf8');
    const ast = parse(source, { ecmaVersion: 'latest' });
    const declarations = new Map();
    const classes = new Map();
    function walk(node, visit) {
        visit(node);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(child => child?.type && walk(child, visit));
            else if (value?.type) walk(value, visit);
        }
    }
    walk(ast, node => {
        // First declaration wins: module-level bindings come first in source order and
        // inner shadowed names (e.g. `const currentTopicId` inside MelonHelper) must not win.
        if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && !declarations.has(node.id.name)) declarations.set(node.id.name, node);
        if (node.type === 'ClassDeclaration' && node.id?.name) classes.set(node.id.name, node);
    });
    const code = node => source.slice(node.start, node.end);
    const declNames = ['SITE_CONFIGS', 'CURRENT_SITE', 'CONFIG', 'Logger', 'SafeDom', 'I18n', 'Utils', 'UI', 'LDSPDialog'];
    const classNames = ['TopicExporter', 'MelonHelper'];
    return `
        const GM_info = { script: { version: ${JSON.stringify(source.match(/@version\s+(\S+)/)[1])} } };
        const GM_getValue = (_key, fallback) => fallback;
        const GM_setValue = () => {};
        const GM_xmlhttpRequest = () => { throw new Error('external GM requests blocked'); };
        ${declNames.map(name => `const ${code(declarations.get(name))};`).join('\n')}
        const ${code(declarations.get('currentTopicId'))};
        let topicContentClient;
        ${classNames.map(name => code(classes.get(name))).join('\n')}
        function createTopicToolsHarness(locale) {
            I18n.setLocale(locale);
            const el = document.createElement('div');
            el.id = 'ldsp-panel';
            el.className = 'light';
            document.body.innerHTML = '';
            document.body.appendChild(el);
            const panelBody = document.createElement('div');
            panelBody.className = 'ldsp-body';
            el.appendChild(panelBody);
            const toasts = [];
            const renderer = { showToast: message => toasts.push(message) };
            const exporter = new TopicExporter(panelBody, renderer);
            exporter.init();
            const melon = new MelonHelper(panelBody, renderer);
            melon.init();
            return { el, panelBody, toasts, exporter, melon };
        }
        Object.assign(globalThis, { I18n, createTopicToolsHarness, LDSPDialog, Utils, SafeDom, MelonHelper, TopicExporter });
    `;
}

const exportFixture = () => ({
    topic: { id: 42, title: 'Fixture topic', views: 1234, category: 'Dev', tags: ['alpha', 'beta'] },
    posts: [
        {
            postNumber: 1,
            author: { username: 'alice', name: 'Alice' },
            timestamp: '2026-11-01T10:00:00Z',
            replyTo: null,
            likeCount: 3,
            content: '<p>Hello <strong>world</strong></p>'
        },
        {
            postNumber: 2,
            author: { username: 'bob', name: '' },
            timestamp: '2026-11-01T11:00:00Z',
            replyTo: { postNumber: 1, username: 'alice' },
            likeCount: 0,
            content: '<p>Reply body</p>'
        }
    ],
    exportDate: '2026-11-02T12:00:00Z',
    postCount: 2,
    range: { start: 1, end: 2 },
    warnings: []
});

test('topic tools (AI summary + export) render localized UI and documents while keeping AI prompt and citation formats intact', async t => {
    const browser = await chromium.launch({
        executablePath: resolveChromiumPath(),
        args: ['--no-sandbox']
    });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(2000);
    await page.route('**/*', route => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html><head></head><body></body></html>'
    }));
    await page.goto('https://linux.do/');
    await page.unroute('**/*');
    await page.route('**/*', route => route.abort());
    await page.evaluate(buildTopicToolsBundle());

    const cjk = '[\\u3400-\\u9FFF]';

    await t.test('en-US localizes melon overlay, settings, history and export UI with zero residual Chinese', async () => {
        const report = await page.evaluate(({ cjkPattern, fixture }) => {
            const cjk = new RegExp(cjkPattern);
            const h = createTopicToolsHarness('en-US');
            const melon = h.melon;
            melon.show();
            const tabs = [...melon.overlay.querySelectorAll('.ldsp-melon-tab')].map(el => el.textContent.trim());
            const title = melon.overlay.querySelector('.ldsp-melon-title').textContent.trim();
            melon._renderSettings();
            // Prompt textareas intentionally keep the Chinese default prompts (AI output language
            // and [第N楼] citations are separate from UI language); exclude them from the UI check.
            const settingsNode = melon.overlay.querySelector('.ldsp-melon-settings')?.cloneNode(true);
            settingsNode?.querySelectorAll('textarea').forEach(node => node.remove());
            const settingsText = settingsNode?.textContent || '';
            melon._renderHistory();
            const historyText = melon.overlay.querySelector('.ldsp-melon-history')?.textContent || '';

            const exporter = h.exporter;
            exporter.show();
            const exportTitle = exporter.overlay.querySelector('.ldsp-export-title').textContent.trim();
            const exportUiText = exporter.overlay.querySelector('.ldsp-export-body')?.textContent || '';

            const markdown = exporter._genMarkdown(fixture);
            const html = exporter._genHtml ? exporter._genHtml(fixture) : '';

            const residual = [];
            for (const [surface, text] of Object.entries({ settingsText, historyText, exportUiText })) {
                if (cjk.test(text)) residual.push({ surface, sample: text.slice(0, 90) });
            }
            return { title, tabs, exportTitle, residual, markdown, html };
        }, { cjkPattern: cjk, fixture: exportFixture() });

        assert.equal(report.title, '🍉 AI Topic Summary');
        assert.deepEqual(report.tabs, ['Home', 'History', 'Settings']);
        assert.equal(report.exportTitle, '📥 Export Topic');
        assert.deepEqual(report.residual, []);
        assert.match(report.markdown, /# Fixture topic/);
        assert.match(report.markdown, /> Topic ID: 42/);
        assert.match(report.markdown, /> Floor range: 1-2 \(2 floors\)/);
        assert.match(report.markdown, /> Category: Dev/);
        assert.match(report.markdown, /> Source link:/);
        assert.match(report.markdown, /> Time: /);
        assert.match(report.markdown, /> Reply to: #1 @alice/);
        assert.match(report.markdown, /> Likes: 3/);
        if (report.html) {
            assert.match(report.html, /lang="en-US"/);
            assert.match(report.html, /Topic #42/);
            assert.match(report.html, /2 floors \(1-2\)/);
            assert.match(report.html, /views/);
        }
    });

    await t.test('zh-CN keeps current copy for melon overlay, settings and export UI', async () => {
        const report = await page.evaluate(({ fixture }) => {
            const h = createTopicToolsHarness('zh-CN');
            h.melon.show();
            const title = h.melon.overlay.querySelector('.ldsp-melon-title').textContent.trim();
            const tabs = [...h.melon.overlay.querySelectorAll('.ldsp-melon-tab')].map(el => el.textContent.trim());
            h.melon._renderSettings();
            const settingsText = h.melon.overlay.querySelector('.ldsp-melon-settings')?.textContent || '';
            const exportTitle = (h.exporter.overlay.querySelector('.ldsp-export-title') || {}).textContent?.trim();
            const markdown = h.exporter._genMarkdown(fixture);
            return { title, tabs, settingsText, exportTitle, markdown };
        }, { fixture: exportFixture() });
        assert.equal(report.title, '🍉 吃瓜助手');
        assert.deepEqual(report.tabs, ['首页', '历史', '设置']);
        assert.match(report.settingsText, /API 地址/);
        assert.match(report.settingsText, /测试连接/);
        assert.equal(report.exportTitle, '📥 导出帖子');
        assert.match(report.markdown, /> 话题ID: 42/);
        assert.match(report.markdown, /> 楼层范围: 1-2（共 2 楼）/);
    });

    await t.test('AI prompt and citation sentinels stay Chinese in both locales (parser compatibility)', async () => {
        const report = await page.evaluate(() => {
            const results = {};
            for (const locale of ['zh-CN', 'en-US']) {
                createTopicToolsHarness(locale);
                results[locale] = {
                    brief: MelonHelper.PROMPT_BRIEF,
                    detailed: MelonHelper.PROMPT_DETAILED
                };
            }
            return results;
        });
        for (const locale of ['zh-CN', 'en-US']) {
            assert.match(report[locale].brief, /\[第N楼\]/);
            assert.match(report[locale].detailed, /\[第N楼\]/);
        }
        assert.equal(report['en-US'].brief, report['zh-CN'].brief);
        assert.equal(report['en-US'].detailed, report['zh-CN'].detailed);
    });
});
