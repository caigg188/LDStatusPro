import { readFileSync } from 'node:fs';
import { parse } from 'acorn';

// Extract the real presentation code without starting auth, storage or networking.
// Like the website preview, fail loudly if the userscript structure changes.
export function panelFixtureSource() {
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
        '_getPanelSizeBounds', '_getPanelSizeConfig', '_applyPanelSize',
        '_getDefaultFontSizeLevel', '_normalizeFontSizeLevel', '_getFontSizeLevelMeta',
        '_getFontSizeScale', '_getFontSizeLabel', '_getThemeModeLabel',
        '_formatReadingGoalHours', '_normalizeReadingGoalHours', '_getDefaultReadingGoalHours', '_isActionVisible', '_getDefaultActionOrder',
        '_normalizeActionOrder', '_renderActionOrderList', '_syncSettingsMenuState',
        '_setSettingsView', '_showSettingsMenu', '_hideSettingsMenu', '_toggleSettingsMenu'
    ];
    return `(() => {
        const GM_info = { script: { version: ${JSON.stringify(source.match(/@version\s+(\S+)/)[1])} } };
        const GM_getValue = (_key, fallback) => fallback;
        ${['COLLAPSED_LOGO_DATA_URI', 'SITE_CONFIGS', 'CURRENT_SITE', 'CONFIG', 'SafeDom', 'Utils', 'Screen', 'Styles', 'UI'].map(name => `const ${code(declarations.get(name))};`).join('\n')}
        const panel = {
            el: document.createElement('div'), hasLeaderboard: true,
            storage: { getGlobal: (key, fallback) => key === 'customSize' ? panel.size : key === 'requirementsDisplayMode' ? 'incomplete' : fallback },
            size: { width: 380, height: 660 }, fontSizeLevel: 3,
            themeMode: 'auto', readingGoalHours: 2, _actionVisibility: {},
            _actionOrder: [], _actionOrderDefaults: ['shop', 'ldc', 'cdk', 'melon', 'export', 'ticket'],
            _fontSizeLevels: ${code(assignments.get('this._fontSizeLevels'))},
            ${methods.map(name => code(method(name))).join(',\n')}
        };
        panel.el.id = 'ldsp-panel';
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
            if (open) panel._setSettingsView(open.dataset.settingsOpen);
            if (back) panel._setSettingsView(back.dataset.settingsBack);
        });
        window.panel = panel;
    })()`;
}
