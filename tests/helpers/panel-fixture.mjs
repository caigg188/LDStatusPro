import { readFileSync } from 'node:fs';
import { parse } from 'acorn';

// Extract the real presentation code without starting auth, storage or networking.
// Like the website preview, fail loudly if the userscript structure changes.
export function panelFixtureSource({ initialStore = {} } = {}) {
    const source = readFileSync(process.env.LDSP_USERSCRIPT_PATH || new URL('../../LDStatusPro.user.js', import.meta.url), 'utf8');
    const declarations = new Map();
    let panel;
    function walk(node, visit) {
        visit(node);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(child => child?.type && walk(child, visit));
            else if (value?.type) walk(value, visit);
        }
    }
    walk(parse(source, { ecmaVersion: 'latest' }), node => {
        if (node.type === 'VariableDeclarator') declarations.set(node.id.name, node);
        if (node.type === 'ClassDeclaration' && node.id.name === 'Panel') panel = node;
    });
    const code = node => source.slice(node.start, node.end);
    const method = name => panel.body.body.find(node => node.key.name === name);
    const assignments = new Map();
    for (const name of ['_createPanel', '_initState']) walk(method(name), node => {
        if (node.type === 'AssignmentExpression') assignments.set(code(node.left), node.right);
    });
    const methods = [
        '_loadLocale', '_getLocaleLabel', '_hasActiveOperationBeforeReload',
        '_setLocalePreference', '_reloadForLocaleChange', '_updateArrow',
        '_getPanelSizeBounds', '_getPanelSizeConfig', '_applyPanelSize',
        '_getDefaultFontSizeLevel', '_normalizeFontSizeLevel', '_getFontSizeLevelMeta',
        '_getFontSizeScale', '_getFontSizeLabel', '_getThemeModeLabel',
        '_formatReadingGoalHours', '_normalizeReadingGoalHours', '_getDefaultReadingGoalHours', '_isActionVisible', '_getDefaultActionOrder',
        '_normalizeActionOrder', '_renderActionOrderList', '_syncSettingsMenuState',
        '_setSettingsView', '_showSettingsMenu', '_hideSettingsMenu', '_toggleSettingsMenu'
    ];
    const hasI18n = declarations.has('I18n');
    const declNames = [
        'COLLAPSED_LOGO_DATA_URI', 'SITE_CONFIGS', 'CURRENT_SITE', 'CONFIG', 'SafeDom',
        ...(hasI18n ? ['I18n'] : []),
        'Utils', 'Screen', 'Styles', 'UI'
    ];
    const presentMethods = methods.filter(name => method(name));
    return `(() => {
        const GM_info = { script: { version: ${JSON.stringify(source.match(/@version\s+(\S+)/)[1])} } };
        const GM_getValue = (_key, fallback) => fallback;
        ${declNames.map(name => `const ${code(declarations.get(name))};`).join('\n')}
        const store = new Map(Object.entries(${JSON.stringify(initialStore)}));
        const toasts = [];
        let reloadCalls = 0;
        let failWrites = false;
        const panel = {
            el: document.createElement('div'), hasLeaderboard: true,
            renderer: { showToast: msg => toasts.push(msg) },
            _performPageReload: () => { reloadCalls++; },
            storage: {
                getGlobal: (key, fallback) => {
                    if (key === 'customSize') return panel.size;
                    if (store.has(key)) return store.get(key);
                    if (key === 'requirementsDisplayMode') return 'incomplete';
                    return fallback;
                },
                setGlobalNow: (key, value) => {
                    if (failWrites) throw new Error('simulated storage write failure');
                    store.set(key, value);
                }
            },
            size: { width: 380, height: 660 }, fontSizeLevel: 3,
            themeMode: 'auto', readingGoalHours: 2, _actionVisibility: {},
            _actionOrder: [], _actionOrderDefaults: ['shop', 'ldc', 'cdk', 'melon', 'export', 'ticket'],
            ${presentMethods.map(name => code(method(name))).join(',\n')}
        };
        if (typeof panel._loadLocale === 'function') {
            panel.locale = panel._loadLocale();
            panel._selectedLocale = panel.locale;
            panel._localePersistFailed = false;
            I18n.setLocale(panel.locale);
        }
        panel._fontSizeLevels = ${code(assignments.get('this._fontSizeLevels'))};
        panel.el.id = 'ldsp-panel';
        if (panel.locale) panel.el.setAttribute('lang', panel.locale);
        panel.el.setAttribute('role', 'complementary');
        panel.el.setAttribute('aria-label', typeof I18n !== 'undefined' ? I18n.t('panel.ariaLabel', { site: CURRENT_SITE.name }) : CURRENT_SITE.name);
        panel.el.innerHTML = (function() { return ${code(assignments.get('this.el.innerHTML'))}; }).call(panel);
        panel.$ = (function() { return ${code(assignments.get('this.$'))}; }).call(panel);
        document.body.append(panel.el);
        const style = document.createElement('style');
        style.textContent = Styles._css(Screen.getConfig()) + '#ldsp-panel,#ldsp-panel *{animation:none!important;transition:none!important}';
        document.head.append(style);
        panel._applyPanelSize();
        panel.el.style.top = '24px';
        panel.el.querySelector('.ldsp-settings').addEventListener('click', () => panel._toggleSettingsMenu());
        panel.$.settingsMenu.addEventListener('click', event => {
            const open = event.target.closest('[data-settings-open]');
            const back = event.target.closest('[data-settings-back]');
            const localeBtn = event.target.closest('[data-locale-option]');
            const reloadBtn = event.target.closest('[data-settings-lang-reload]');
            if (open) panel._setSettingsView(open.dataset.settingsOpen);
            if (back) panel._setSettingsView(back.dataset.settingsBack);
            if (localeBtn && panel._setLocalePreference) panel._setLocalePreference(localeBtn.dataset.localeOption);
            if (reloadBtn && panel._reloadForLocaleChange) panel._reloadForLocaleChange();
        });
        window.panel = panel;
        window.fixtureHarness = {
            store,
            toasts,
            getReloadCalls: () => reloadCalls,
            setFailWrites: value => { failWrites = value; }
        };
    })()`;
}
