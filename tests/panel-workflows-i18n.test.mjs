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

function buildWorkflowBundle() {
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
        if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') declarations.set(node.id.name, node);
        if (node.type === 'ClassDeclaration' && node.id?.name) classes.set(node.id.name, node);
    });
    const code = node => source.slice(node.start, node.end);
    const declNames = ['SITE_CONFIGS', 'CURRENT_SITE', 'CONFIG', 'Logger', 'SafeDom', 'I18n', 'Utils', 'UI', 'LDSPDialog'];
    const classNames = ['FollowManager', 'TicketManager', 'ActivityManager', 'Renderer'];
    return `
        const GM_info = { script: { version: ${JSON.stringify(source.match(/@version\s+(\S+)/)[1])} } };
        ${declNames.map(name => `const ${code(declarations.get(name))};`).join('\n')}
        ${classNames.map(name => code(classes.get(name))).join('\n')}
        function createWorkflowHarness(locale) {
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
            const oauth = { isLoggedIn: () => true, api: async () => ({ success: true, data: { types: null } }) };
            const activityHost = document.createElement('div');
            activityHost.innerHTML = '<div id="ldsp-activity" class="ldsp-section"></div>';
            el.appendChild(activityHost);
            const panel = {
                $: {
                    activity: activityHost.querySelector('#ldsp-activity'),
                    trends: document.createElement('div'),
                    leaderboard: document.createElement('div')
                },
                storage: { getGlobal: (_k, fallback) => fallback },
                oauth: { getUserInfo: () => null },
                cachedLevel: 2
            };
            const rendererInstance = new Renderer(panel);
            const follow = new FollowManager(null, { getUser: () => 'alice' }, panelBody, renderer);
            follow.init();
            const tickets = new TicketManager(oauth, panelBody);
            tickets.overlay = null;
            tickets.ticketTypes = [];
            tickets.tickets = [];
            tickets._createOverlay();
            const activity = new ActivityManager(null);
            return { el, panelBody, renderer, toasts, follow, tickets, rendererInstance, panel, activity };
        }
        Object.assign(globalThis, { I18n, createWorkflowHarness, LDSPDialog, UI, Utils });
    `;
}

test('follow, tickets, activity and LDC/CDK structural labels render in both locales without residual Chinese (workflows slice)', async t => {
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
    await page.evaluate(buildWorkflowBundle());

    const cjk = '[\\u3400-\\u9FFF]';

    await t.test('zh-CN keeps current copy for follow overlay, ticket tabs and activity tabs', async () => {
        const report = await page.evaluate(() => {
            const h = createWorkflowHarness('zh-CN');
            h.follow._renderList('following');
            const followTitle = h.panelBody.querySelector('.ldsp-follow-title').textContent.trim();
            const followTabs = [...h.panelBody.querySelectorAll('.ldsp-follow-tab-text')].map(el => el.textContent.trim());
            const followEmpty = h.panelBody.querySelector('.ldsp-follow-empty')?.textContent.trim();
            const ticketTabs = [...h.tickets.overlay.querySelectorAll('.ldsp-ticket-tab')].map(el => el.textContent.trim());
            h.tickets._renderList();
            const ticketEmpty = h.tickets.overlay.querySelector('.ldsp-ticket-empty')?.textContent.trim();
            h.rendererInstance.renderActivity('read');
            const activityTabs = [...h.panel.$.activity.querySelectorAll('.ldsp-trend-tab-text')].map(el => el.textContent.trim());
            return { followTitle, followTabs, followEmpty, ticketTabs, ticketEmpty, activityTabs };
        });
        assert.equal(report.followTitle, '关注与粉丝');
        assert.deepEqual(report.followTabs, ['关注', '粉丝']);
        assert.equal(report.followEmpty, '还没有关注任何人');
        assert.deepEqual(report.ticketTabs, ['我的工单', '提交工单']);
        assert.ok(report.ticketEmpty.includes('暂无工单记录'));
        assert.deepEqual(report.activityTabs, ['已读', '收藏', '回复', '互动', '赞过', '我的话题']);
    });

    await t.test('en-US renders English for follow overlay, ticket form, activity tabs and bookmark toolbar', async () => {
        const report = await page.evaluate(({ cjkPattern }) => {
            const cjk = new RegExp(cjkPattern);
            const h = createWorkflowHarness('en-US');
            h.follow._renderList('following');
            const followTitle = h.panelBody.querySelector('.ldsp-follow-title').textContent.trim();
            const followTabs = [...h.panelBody.querySelectorAll('.ldsp-follow-tab-text')].map(el => el.textContent.trim());
            const followEmpty = h.panelBody.querySelector('.ldsp-follow-empty')?.textContent.trim();
            const ticketTabs = [...h.tickets.overlay.querySelectorAll('.ldsp-ticket-tab')].map(el => el.textContent.trim());
            h.tickets._renderList();
            const ticketEmpty = h.tickets.overlay.querySelector('.ldsp-ticket-empty')?.textContent.trim();
            h.tickets._renderCreate();
            const createText = h.tickets.overlay.querySelector('.ldsp-ticket-form')?.textContent || '';
            const createPlaceholders = [...h.tickets.overlay.querySelectorAll('.ldsp-ticket-form input, .ldsp-ticket-form textarea')].map(el => el.placeholder);
            h.rendererInstance.renderActivity('read');
            const activityTabs = [...h.panel.$.activity.querySelectorAll('.ldsp-trend-tab-text')].map(el => el.textContent.trim());
            const topicToolbar = h.rendererInstance.renderTopicListWithSearch([], false, '', 20, 0);
            const bookmarkToolbar = h.rendererInstance.renderBookmarkListWithSearch([], false, '', 20, 0, {});
            const residualCjk = [];
            for (const [surface, html] of Object.entries({ topicToolbar, bookmarkToolbar })) {
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                if (cjk.test(tmp.textContent)) residualCjk.push({ surface, sample: tmp.textContent.slice(0, 80) });
            }
            if (cjk.test(createText)) residualCjk.push({ surface: 'ticketCreate', sample: createText.slice(0, 80) });
            return { followTitle, followTabs, followEmpty, ticketTabs, ticketEmpty, createText, createPlaceholders, activityTabs, residualCjk };
        }, { cjkPattern: cjk });

        assert.equal(report.followTitle, 'Following & Followers');
        assert.deepEqual(report.followTabs, ['Following', 'Followers']);
        assert.equal(report.followEmpty, 'Not following anyone yet');
        assert.deepEqual(report.ticketTabs, ['My Tickets', 'New Ticket']);
        assert.ok(report.ticketEmpty.includes('No tickets yet'));
        assert.deepEqual(report.activityTabs, ['Read', 'Bookmarks', 'Replies', 'Reactions', 'Liked', 'My Topics']);
        assert.deepEqual(report.residualCjk, []);
        assert.match(report.createText, /Ticket type/);
        assert.match(report.createText, /Submit ticket/);
        assert.match(report.createPlaceholders[0], /Briefly describe/);
    });

    await t.test('ticket validation and reply states follow the active locale', async () => {
        const report = await page.evaluate(async () => {
            const h = createWorkflowHarness('en-US');
            const warnings = [];
            const originalWarning = LDSPDialog.warning;
            LDSPDialog.warning = message => warnings.push(message);
            h.tickets._renderCreate();
            await h.tickets._submitTicket();
            h.tickets.overlay.querySelector('.ldsp-ticket-input').value = 'Valid title';
            await h.tickets._submitTicket();
            const closedDetail = h.tickets._getTypeLabel('feature_request');
            LDSPDialog.warning = originalWarning;

            const zh = createWorkflowHarness('zh-CN');
            const zhWarnings = [];
            const originalZhWarning = LDSPDialog.warning;
            LDSPDialog.warning = message => zhWarnings.push(message);
            zh.tickets._renderCreate();
            await zh.tickets._submitTicket();
            LDSPDialog.warning = originalZhWarning;
            return { warnings, closedDetail, zhWarnings };
        });
        assert.deepEqual(report.warnings, [
            'Title must be at least 4 characters',
            'Description must be at least 8 characters'
        ]);
        assert.equal(report.closedDetail, 'Feature Request');
        assert.deepEqual(report.zhWarnings, ['标题至少需要4个字符']);
    });

    await t.test('activity sub-tab selection keeps canonical ids while labels switch locale', async () => {
        const report = await page.evaluate(() => {
            const h = createWorkflowHarness('en-US');
            h.rendererInstance.renderActivity('bookmarks');
            const ids = [...h.panel.$.activity.querySelectorAll('.ldsp-subtab')].map(el => el.dataset.activity);
            const labels = [...h.panel.$.activity.querySelectorAll('.ldsp-trend-tab-text')].map(el => el.textContent.trim());
            const activeId = h.panel.$.activity.querySelector('.ldsp-subtab.active')?.dataset.activity;
            return { ids, labels, activeId };
        });
        assert.deepEqual(report.ids, ['read', 'bookmarks', 'replies', 'reactions', 'likes', 'topics']);
        assert.deepEqual(report.labels, ['Read', 'Bookmarks', 'Replies', 'Reactions', 'Liked', 'My Topics']);
        assert.equal(report.activeId, 'bookmarks');
    });
});
