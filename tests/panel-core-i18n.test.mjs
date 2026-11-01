import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { parse } from 'acorn';
import { JSDOM } from 'jsdom';
import { chromium } from 'playwright';

const demo = JSON.parse(readFileSync(new URL('../website/brand/plugin-demo.json', import.meta.url), 'utf8'));

function resolveChromiumPath() {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        || process.env.CHROME_BIN
        || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'].find(existsSync)
        || undefined;
}

function buildCorePanelBundle() {
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
    const panelClass = classes.get('Panel');
    const panelMethod = name => panelClass.body.body.find(node => node.key?.name === name);
    const assignments = new Map();
    for (const name of ['_createPanel', '_initState']) {
        walk(panelMethod(name), node => {
            if (node.type === 'AssignmentExpression') assignments.set(code(node.left), node.right);
        });
    }
    const declNames = [
        'COLLAPSED_LOGO_DATA_URI', 'SITE_CONFIGS', 'CURRENT_SITE', 'CONFIG', 'PATTERNS',
        'Logger', 'SafeDom', 'I18n', 'Utils', 'Screen', 'ErrorFormatter', 'Styles', 'LDSPDialog', 'UI'
    ];
    const classNames = ['LRUCache', 'Network', 'HistoryManager', 'ReadingTracker', 'Notifier', 'Renderer'];
    const panelMethods = [
        '_loadLocale', '_getLocaleLabel', '_getPanelSizeBounds', '_getPanelSizeConfig',
        '_applyPanelSize', '_getDefaultFontSizeLevel', '_normalizeFontSizeLevel',
        '_getFontSizeLevelMeta', '_getFontSizeScale', '_getFontSizeLabel',
        '_getThemeModeLabel', '_formatReadingGoalHours', '_normalizeReadingGoalHours',
        '_getDefaultReadingGoalHours', '_applyActionsToggleState', '_formatHomeError', '_showError'
    ];
    const version = source.match(/@version\s+(\S+)/)[1];
    return {
        version,
        script: `
            const GM_info = { script: { version: ${JSON.stringify(version)} } };
            ${declNames.map(name => `const ${code(declarations.get(name))};`).join('\n')}
            ${classNames.map(name => code(classes.get(name))).join('\n')}
            function createPanelHarness({ locale = 'zh-CN', width = 380, requirementsDisplayMode = 'all', storeData = {} } = {}) {
                const store = new Map(Object.entries(storeData));
                I18n.setLocale(locale);
                const storage = {
                    getUser: () => 'alice',
                    get: (key, fallback = null) => store.has(key) ? store.get(key) : fallback,
                    set: (key, value) => store.set(key, value),
                    setNow: (key, value) => store.set(key, value),
                    getGlobal: (key, fallback = null) => {
                        if (key === 'locale') return locale;
                        if (key === 'customSize') return { width, height: 660 };
                        if (key === 'requirementsDisplayMode') return requirementsDisplayMode;
                        return store.has('g:' + key) ? store.get('g:' + key) : fallback;
                    },
                    setGlobal: (key, value) => store.set('g:' + key, value),
                    setGlobalNow: (key, value) => store.set('g:' + key, value)
                };
                const el = document.createElement('div');
                el.id = 'ldsp-panel';
                el.className = 'light';
                el.setAttribute('lang', I18n.getLocale());
                el.setAttribute('role', 'complementary');
                el.setAttribute('aria-label', I18n.t('panel.ariaLabel', { site: CURRENT_SITE.name }));
                const panel = {
                    el,
                    hasLeaderboard: true,
                    locale: I18n.getLocale(),
                    _selectedLocale: I18n.getLocale(),
                    _localePersistFailed: false,
                    storage,
                    fontSizeLevel: 3,
                    themeMode: 'light',
                    readingGoalHours: 3,
                    ${panelMethods.map(name => code(panelMethod(name))).join(',\n')}
                };
                panel._fontSizeLevels = ${code(assignments.get('this._fontSizeLevels'))};
                panel.el.innerHTML = (function() { return ${code(assignments.get('this.el.innerHTML'))}; }).call(panel);
                panel.$ = (function() { return ${code(assignments.get('this.$'))}; }).call(panel);
                document.body.innerHTML = '';
                document.body.appendChild(el);
                let styleEl = document.getElementById('ldsp-test-style');
                if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = 'ldsp-test-style';
                    document.head.appendChild(styleEl);
                }
                styleEl.textContent = Styles._css(Screen.getConfig()) + '#ldsp-panel,#ldsp-panel *{animation:none!important;transition:none!important}';
                panel._applyPanelSize('test');
                panel.renderer = new Renderer(panel);
                panel.historyMgr = new HistoryManager(storage);
                panel.tracker = new ReadingTracker(storage);
                panel.notifier = new Notifier(storage);
                LDSPDialog.init(el);
                return { panel, storage, store };
            }
            Object.assign(globalThis, {
                I18n, Utils, CONFIG, ErrorFormatter, Network, Renderer, HistoryManager, ReadingTracker, Notifier, LDSPDialog, UI, createPanelHarness
            });
        `
    };
}

test('canonical Chinese metric keys, history deltas, reading levels and milestone storage stay invariant across locales', () => {
    const { script } = buildCorePanelBundle();
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://linux.do/' });
    const notifications = [];
    const context = vm.createContext({
        window: dom.window,
        document: dom.window.document,
        location: dom.window.location,
        DOMParser: dom.window.DOMParser,
        requestAnimationFrame: fn => fn(),
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        GM_getValue: (_k, fallback) => fallback,
        GM_setValue: () => {},
        GM_notification: payload => notifications.push(payload)
    });
    context.window.innerWidth = 1440;
    context.window.innerHeight = 900;
    vm.runInContext(script, context);

    const { I18n, Utils, Network, ErrorFormatter } = context;

    // 1. Canonical simplification never changes when switching to en-US, only presentation formatting changes.
    I18n.setLocale('en-US');
    assert.equal(Utils.simplifyName('被禁言（过去 6 个月）'), '被禁言(近6个月)');
    assert.equal(Utils.normalizeMetricName('访问天数'), '访问次数');
    assert.equal(Utils.formatMetricName('被禁言（过去 6 个月）'), 'Silenced (last 6m)');
    assert.equal(Utils.formatMetricName('获赞：点赞用户数量'), 'Users who liked');
    assert.equal(Utils.formatMetricName('自定义未知指标'), '自定义未知指标');

    I18n.setLocale('zh-CN');
    assert.equal(Utils.formatMetricName('被禁言（过去 6 个月）'), '被禁言(近6个月)');
    assert.equal(Utils.formatMetricName('获赞：点赞用户数量'), '点赞用户');

    // 2. Reading levels normalize server aliases to canonical Chinese while formatting per locale and preserving unknown custom labels.
    const normalizedLevels = Network._normalizeReadingLevels([
        { min: 0, label: 'starter' },
        { min: 60, label: 'deep reader' },
        { min: 180, label: '星辰大海' }
    ]);
    assert.deepEqual(normalizedLevels.map(l => l.label), ['刚起步', '沉浸阅读', '星辰大海']);
    context.CONFIG.READING_LEVELS = normalizedLevels;

    I18n.setLocale('en-US');
    assert.equal(Utils.getReadingLevel(10).canonicalLabel, '刚起步');
    assert.equal(Utils.getReadingLevel(10).label, 'Starter');
    assert.equal(Utils.getReadingLevel(90).label, 'Deep Focus');
    assert.equal(Utils.getReadingLevel(200).label, '星辰大海');

    // 3. History records & milestones written in zh-CN are read seamlessly in en-US without duplicate notifications.
    const sharedStore = {};
    const zhHarness = context.createPanelHarness({ locale: 'zh-CN', storeData: sharedStore });
    const sampleReqs = [
        { name: '浏览话题', currentValue: 120, requiredValue: 500, isSuccess: false },
        { name: '已读帖子', currentValue: 20500, requiredValue: 20000, isSuccess: true }
    ];
    zhHarness.panel.notifier.check(sampleReqs);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].title, '🎉 达成里程碑！');
    const savedMilestones = zhHarness.storage.get('milestones');
    assert.equal(savedMilestones['浏览话题_100'], true);
    assert.equal(savedMilestones['req_浏览话题'], undefined);
    assert.equal(savedMilestones['req_已读帖子'], true);

    // Switch to en-US with the same persisted milestones: already-achieved milestones must NOT re-fire; new threshold formats in English.
    const enHarness = context.createPanelHarness({
        locale: 'en-US',
        storeData: { milestones: savedMilestones, lastNotify: 0 }
    });
    enHarness.panel.notifier.check(sampleReqs);
    assert.equal(notifications.length, 1);

    enHarness.panel.notifier.check([
        { name: '浏览话题', currentValue: 520, requiredValue: 500, isSuccess: true },
        { name: '已读帖子', currentValue: 20500, requiredValue: 20000, isSuccess: true }
    ]);
    assert.equal(notifications.length, 2);
    assert.equal(notifications[1].title, '🎉 Milestone Reached!');
    assert.match(notifications[1].text, /Topics entered → 500/);

    // 4. ErrorFormatter handles status codes, error codes and rate-limit wait durations in en-US and zh-CN.
    I18n.setLocale('en-US');
    assert.match(ErrorFormatter.withIcon({ status: 403 }), /^🔐 Access denied.*HTTP 403/);
    assert.equal(ErrorFormatter.withIcon({ code: 'IP_BANNED' }), '🚫 IP address blocked. Try switching networks.');
    assert.equal(ErrorFormatter.withIcon(new Error('请求过于频繁，请等待 15 秒后重试')), '⏳ Too many requests. Wait 15s and try again.');

    I18n.setLocale('zh-CN');
    assert.match(ErrorFormatter.withIcon({ status: 403 }), /^🔐 没有访问权限.*HTTP 403/);
    dom.window.close();
});

test('all core panel sections (user card, requirements, trends, leaderboard, modals) render cleanly in en-US and zh-CN in Chromium', async t => {
    const { script } = buildCorePanelBundle();
    const browser = await chromium.launch({
        executablePath: resolveChromiumPath(),
        args: ['--no-sandbox']
    });
    t.after(() => browser.close());

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/*', route => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html><head></head><body></body></html>'
    }));
    await page.goto('https://linux.do/');
    await page.unroute('**/*');
    await page.route('**/*', route => route.abort());
    await page.evaluate(script);

    const cjkRegexSource = '[\\u3400-\\u9FFF]';

    for (const width of [260, 380]) {
        await t.test(`en-US core panel views at ${width}px width have zero residual Chinese UI and zero tab overflow`, async () => {
            const report = await page.evaluate(({ demoData, width, cjkPattern }) => {
                const cjk = new RegExp(cjkPattern);
                const now = Date.now();
                const day1 = new Date(now - 2 * 86400000);
                const day2 = new Date(now - 86400000);
                const today = new Date(now);
                const history = [
                    { dayKey: day1.toDateString(), ts: day1.getTime(), data: { '浏览的话题': 300, '已读帖子': 15000 }, endData: { '浏览的话题': 300, '已读帖子': 15000 }, baselineData: { '浏览的话题': 280, '已读帖子': 14800 }, readingTime: 45 },
                    { dayKey: day2.toDateString(), ts: day2.getTime(), data: { '浏览的话题': 320, '已读帖子': 16000 }, endData: { '浏览的话题': 320, '已读帖子': 16000 }, baselineData: { '浏览的话题': 300, '已读帖子': 15000 }, readingTime: 95 },
                    { dayKey: today.toDateString(), ts: today.getTime(), data: { '浏览的话题': 342, '已读帖子': 16840 }, endData: { '浏览的话题': 342, '已读帖子': 16840 }, baselineData: { '浏览的话题': 320, '已读帖子': 16000 }, readingTime: 138 }
                ];
                const readingTimeStore = {
                    dailyData: {
                        [day1.toDateString()]: { totalMinutes: 45 },
                        [day2.toDateString()]: { totalMinutes: 95 },
                        [today.toDateString()]: { totalMinutes: 138 }
                    }
                };
                const { panel } = window.createPanelHarness({
                    locale: 'en-US',
                    width,
                    requirementsDisplayMode: 'all',
                    storeData: { history, readingTime: readingTimeStore }
                });

                panel.renderer.renderUser('alice', '2', false, demoData.requirements, 'Alice Dev');
                panel.renderer.renderReading(138, true);
                panel.el.querySelector('.ldsp-join-days-site').textContent = window.I18n.t('panel.user.siteShortLinuxDo');
                panel.el.querySelector('.ldsp-join-days-num').textContent = '365';
                panel.renderer.renderReqs(demoData.requirements, 2);

                const afterTracking = getComputedStyle(panel.$.reading, '::after').content;
                panel.renderer.renderReading(138, false);
                const afterPaused = getComputedStyle(panel.$.reading, '::after').content;

                // Render all 5 trend views (including persisted Chinese '前一日' compareLabel to verify legacy storage compatibility).
                panel.renderer.renderTrends('today');
                const trendOutputs = {
                    today: panel.renderer.renderTodayTrend(demoData.requirements, 138, {
                        startTs: demoData.startedAt,
                        baselineData: demoData.baselineData,
                        compareLabel: '前一日'
                    }, 3),
                    week: panel.renderer.renderWeekTrend(history, demoData.requirements, panel.historyMgr, panel.tracker),
                    month: panel.renderer.renderMonthTrend(history, demoData.requirements, panel.historyMgr, panel.tracker),
                    year: panel.renderer.renderYearTrend(history, demoData.requirements, panel.historyMgr, panel.tracker),
                    all: panel.renderer.renderAllTrend(history, demoData.requirements, panel.tracker)
                };

                // Render all leaderboard states.
                panel.renderer.renderLeaderboard('daily');
                const lbOutputs = {
                    login: panel.renderer.renderLeaderboardLogin(),
                    join: panel.renderer.renderLeaderboardJoin(),
                    paused: panel.renderer.renderRegistrationPaused(),
                    empty: panel.renderer.renderLeaderboardData({ rankings: [] }, 1, true, 'daily'),
                    ranked: panel.renderer.renderLeaderboardData({
                        period: '2026-11-01',
                        myRank: { in_top: false, rank: null, minutes: 25 },
                        rankings: [
                            { user_id: 1, username: 'alice', name: 'Alice', minutes: 240 },
                            { user_id: 2, username: 'bob', name: 'Bob', minutes: 125 }
                        ]
                    }, 1, true, 'daily')
                };

                const loginModal = panel.renderer.showLoginPrompt(false);
                const upgradeModal = panel.renderer.showLoginPrompt(true);

                // Collect visible text across body (excluding closed settings menu autonym '简体中文').
                const bodyText = panel.$.panelBody.textContent;
                const reqsText = panel.$.reqs.textContent;
                const residualCjk = [];
                if (cjk.test(bodyText)) residualCjk.push({ surface: 'panelBody', sample: bodyText.match(new RegExp(`.{0,12}${cjkPattern}.{0,12}`))?.[0] });
                for (const [k, html] of Object.entries(trendOutputs)) {
                    const tmp = document.createElement('div');
                    tmp.innerHTML = html;
                    if (cjk.test(tmp.textContent)) residualCjk.push({ surface: `trend:${k}`, sample: tmp.textContent });
                }
                for (const [k, html] of Object.entries(lbOutputs)) {
                    const tmp = document.createElement('div');
                    tmp.innerHTML = html;
                    if (cjk.test(tmp.textContent)) residualCjk.push({ surface: `lb:${k}`, sample: tmp.textContent });
                }
                if (cjk.test(loginModal.textContent)) residualCjk.push({ surface: 'loginModal', sample: loginModal.textContent });
                if (cjk.test(upgradeModal.textContent)) residualCjk.push({ surface: 'upgradeModal', sample: upgradeModal.textContent });

                return {
                    residualCjk,
                    afterTracking,
                    afterPaused,
                    reqsText,
                    joinDaysText: panel.el.querySelector('.ldsp-join-days').textContent,
                    mainTabs: [...panel.el.querySelectorAll('.ldsp-tab-text')].map(el => el.textContent),
                    trendSubtabs: [...panel.$.trends.querySelectorAll('.ldsp-trend-tab-text')].map(el => el.textContent),
                    lbSubtabs: [...panel.$.leaderboard.querySelectorAll('.ldsp-trend-tab-text')].map(el => el.textContent),
                    todayHtml: trendOutputs.today,
                    rankedHtml: lbOutputs.ranked
                };
            }, { demoData: demo, width, cjkPattern: cjkRegexSource });

            assert.deepEqual(report.residualCjk, []);
            assert.match(report.afterTracking, /Tracking reading/);
            assert.match(report.afterPaused, /Idle · Paused/);
            assert.equal(report.joinDaysText, 'Joined 365d');
            assert.deepEqual(report.mainTabs, ['Reqs', 'Trends', 'Ranks', 'Profile']);
            assert.deepEqual(report.trendSubtabs, ['Today', 'Week', 'Month', 'Year', 'All']);
            assert.deepEqual(report.lbSubtabs, ['Daily', 'Weekly', 'Monthly']);
            assert.match(report.reqsText, /requirements left to advance/);
            assert.match(report.reqsText, /Days visited/);
            assert.match(report.reqsText, /Posts read/);
            assert.match(report.todayHtml, /vs prev\. day/);
            assert.match(report.rankedHtml, /My Rank/);
            assert.match(report.rankedHtml, /\(Unranked\)/);
            assert.match(report.rankedHtml, /\(You\)/);
        });
    }
});
