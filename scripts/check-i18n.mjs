#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { PLURAL_CATEGORIES, isPluralForms } from '../src/i18n/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localesRoot = path.join(root, 'src/i18n/locales');
const manifestPath = path.join(root, 'src/i18n/review-manifest.json');
const userscriptPath = path.join(root, 'LDStatusPro.user.js');

const CJK_RE = /[\u3400-\u9FFF]/;

// Panel methods migrated to semantic i18n keys. Adding methods here as slices land
// prevents uncataloged Chinese UI strings from regressing inside migrated areas.
export const MIGRATED_PANEL_METHODS = Object.freeze([
    '_createPanel',
    '_getThemeModeLabel',
    '_getFontSizeLabel',
    '_getLocaleLabel',
    '_syncSettingsMenuState',
    '_setLocalePreference',
    '_reloadForLocaleChange',
    '_checkUpdate',
    '_doUpdate',
    '_updateArrow',
    '_applyActionsToggleState',
    '_formatHomeError',
    '_showError',
    '_showFallbackStats',
    '_renderTrendContent',
    '_handlePendingLoginResult',
    '_doLogin',
    '_bindLoginPrompt',
    '_renderLeaderboard',
    '_renderLeaderboardContent',
    '_bindLeaderboardEvents'
]);

export const MIGRATED_RENDERER_METHODS = Object.freeze([
    'renderUser',
    'renderReqs',
    'renderReading',
    'renderAvatar',
    'renderTrends',
    'getTrendFields',
    'renderTodayTrend',
    'renderWeekTrend',
    'renderMonthTrend',
    'renderYearTrend',
    'renderAllTrend',
    '_renderSparkRows',
    '_renderWeekChart',
    '_renderMonthChart',
    '_renderYearChart',
    '_calcAbsoluteMonthlyTrend',
    '_calcMonthlyTrend',
    'showLoginPrompt',
    'renderLeaderboard',
    'renderLeaderboardLogin',
    'renderLeaderboardJoin',
    'renderRegistrationPaused',
    'renderLeaderboardData',
    'renderLeaderboardLoading',
    'renderLeaderboardError',
    'renderActivity',
    'renderActivityLoading',
    'renderActivityEmpty',
    'renderActivityError',
    'renderTopicListWithSearch',
    '_renderTopicItems',
    'renderTopicList',
    'renderBookmarkList',
    'renderBookmarkListWithSearch',
    '_renderBookmarkItems',
    'renderReplyList',
    'renderLikeList',
    'renderMyTopicList',
    'renderReactionList'
]);

export const MIGRATED_STANDALONE_CLASSES = Object.freeze([
    'FollowManager',
    'TicketManager',
    'LDCManager',
    'CDKManager'
]);

export const MIGRATED_PANEL_EXTRA_METHODS = Object.freeze([
    '_renderActivity',
    '_renderActivityContent',
    '_buildBookmarkExportRows',
    '_exportBookmarks',
    '_deleteSelectedBookmarks',
    '_bindBookmarkManageEvents',
    '_bindActivityScroll'
]);

// Explicit non-UI tokens allowed inside migrated methods (parser sentinels, server error matchers, punctuation).
const ALLOWED_CJK_LITERALS = new Set(['未知', '；', '已暂停新用户注册', '原始发帖人']);

export function hashSourceEntry(key, value) {
    const canonical = typeof value === 'string'
        ? value
        : JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(k => [k, value[k]])));
    return createHash('sha256').update(`${key}\n${canonical}`).digest('hex').slice(0, 16);
}

export function flattenCatalogNamespace(namespace, obj, prefix = namespace, out = new Map(), errors = []) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        errors.push(`Invalid catalog object at ${prefix}`);
        return out;
    }
    for (const [k, v] of Object.entries(obj)) {
        if (!/^[a-zA-Z0-9_]+$/.test(k)) {
            errors.push(`Invalid key segment "${k}" in ${prefix}`);
            continue;
        }
        const fullKey = `${prefix}.${k}`;
        if (typeof v === 'string' || isPluralForms(v)) {
            if (out.has(fullKey)) errors.push(`Duplicate key: ${fullKey}`);
            out.set(fullKey, v);
        } else if (v && typeof v === 'object' && !Array.isArray(v)) {
            const keys = Object.keys(v);
            if (keys.length > 0 && keys.every(item => PLURAL_CATEGORIES.includes(item))) {
                errors.push(`Plural object missing required "other" form: ${fullKey}`);
            } else {
                flattenCatalogNamespace(namespace, v, fullKey, out, errors);
            }
        } else {
            errors.push(`Unsupported catalog value at ${fullKey}`);
        }
    }
    return out;
}

export function extractPlaceholders(entry) {
    const collect = text => new Set([...text.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m => m[1]));
    if (typeof entry === 'string') return collect(entry);
    const sets = Object.values(entry).map(collect);
    const union = new Set();
    for (const s of sets) for (const item of s) union.add(item);
    return union;
}

function allowedPluralCategories(locale) {
    return new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
}

export function loadDiskCatalogs(dir = localesRoot) {
    const result = {};
    for (const locale of ['zh-CN', 'en-US']) {
        const localeDir = path.join(dir, locale);
        const files = fs.readdirSync(localeDir).filter(name => name.endsWith('.json')).sort();
        const namespaces = {};
        for (const file of files) {
            const ns = file.slice(0, -5);
            namespaces[ns] = JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf8'));
        }
        result[locale] = namespaces;
    }
    return result;
}

function walkAst(node, visit) {
    visit(node);
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(child => child?.type && walkAst(child, visit));
        else if (value?.type) walkAst(value, visit);
    }
}

export function buildReviewManifest(zhCatalog) {
    const errors = [];
    const zhMap = new Map();
    for (const [ns, data] of Object.entries(zhCatalog).sort(([a], [b]) => a.localeCompare(b))) {
        flattenCatalogNamespace(ns, data, ns, zhMap, errors);
    }
    if (errors.length) throw new Error(errors.join('\n'));
    const entries = {};
    for (const key of [...zhMap.keys()].sort()) {
        entries[key] = hashSourceEntry(key, zhMap.get(key));
    }
    return {
        schemaVersion: 1,
        sourceLocale: 'zh-CN',
        targetLocale: 'en-US',
        entries
    };
}

export function validateI18n({
    catalogs = loadDiskCatalogs(),
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
    userscriptSource = fs.readFileSync(userscriptPath, 'utf8'),
    migratedMethods = MIGRATED_PANEL_METHODS
} = {}) {
    const errors = [];
    const zhMap = new Map();
    const enMap = new Map();

    for (const [ns, data] of Object.entries(catalogs['zh-CN'] || {})) {
        flattenCatalogNamespace(ns, data, ns, zhMap, errors);
    }
    for (const [ns, data] of Object.entries(catalogs['en-US'] || {})) {
        flattenCatalogNamespace(ns, data, ns, enMap, errors);
    }

    const zhCategories = allowedPluralCategories('zh-CN');
    const enCategories = allowedPluralCategories('en-US');

    for (const [key, zhVal] of zhMap) {
        if (!enMap.has(key)) {
            errors.push(`Missing en-US translation: ${key}`);
            continue;
        }
        const enVal = enMap.get(key);

        if (isPluralForms(zhVal)) {
            for (const cat of Object.keys(zhVal)) {
                if (!zhCategories.has(cat)) errors.push(`Invalid zh-CN plural category "${cat}" in ${key}`);
            }
        }
        if (isPluralForms(enVal)) {
            for (const cat of Object.keys(enVal)) {
                if (!enCategories.has(cat)) errors.push(`Invalid en-US plural category "${cat}" in ${key}`);
            }
            const firstSet = [...extractPlaceholders(enVal)].sort().join(',');
            for (const [cat, form] of Object.entries(enVal)) {
                const formSet = [...extractPlaceholders(form)].sort().join(',');
                if (formSet !== firstSet) {
                    errors.push(`Inconsistent placeholders in en-US plural form "${cat}" for ${key}: [${formSet}] vs [${firstSet}]`);
                }
            }
        }

        const zhParams = [...extractPlaceholders(zhVal)].sort().join(',');
        const enParams = [...extractPlaceholders(enVal)].sort().join(',');
        if (zhParams !== enParams) {
            errors.push(`Placeholder mismatch for ${key}: zh-CN [${zhParams}] vs en-US [${enParams}]`);
        }
    }

    for (const key of enMap.keys()) {
        if (!zhMap.has(key)) errors.push(`Obsolete en-US key not in zh-CN: ${key}`);
    }

    // Source hash drift tracking (added / changed source / removed).
    const manifestEntries = manifest?.entries || {};
    const added = [];
    const changed = [];
    const removed = [];

    for (const [key, zhVal] of zhMap) {
        const currentHash = hashSourceEntry(key, zhVal);
        if (!Object.prototype.hasOwnProperty.call(manifestEntries, key)) {
            added.push(key);
        } else if (manifestEntries[key] !== currentHash) {
            changed.push(key);
        }
    }
    for (const key of Object.keys(manifestEntries)) {
        if (!zhMap.has(key)) removed.push(key);
    }

    for (const key of added) errors.push(`Unreviewed translation (missing from review-manifest.json): ${key}`);
    for (const key of changed) errors.push(`Stale en-US translation (zh-CN source changed): ${key}`);
    for (const key of removed) errors.push(`Removed key still in review-manifest.json: ${key}`);

    // Syntax-aware check on LDStatusPro.user.js (excluding embedded bundles).
    const i18nEnd = userscriptSource.indexOf('// @@I18N_END');
    const coreEnd = userscriptSource.indexOf('// @@CORE_SANITIZE_END');
    const scanOffset = Math.max(i18nEnd >= 0 ? i18nEnd : 0, coreEnd >= 0 ? coreEnd : 0);
    const ast = parse(userscriptSource, { ecmaVersion: 'latest' });

    let panelClass = null;
    let rendererClass = null;
    let notifierClass = null;
    let leaderboardClass = null;
    let uiDecl = null;
    let dialogDecl = null;
    const standaloneClasses = new Map();
    walkAst(ast, node => {
        if (node.start < scanOffset) return;
        if (node.type === 'ClassDeclaration') {
            if (node.id?.name === 'Panel') panelClass = node;
            if (node.id?.name === 'Renderer') rendererClass = node;
            if (node.id?.name === 'Notifier') notifierClass = node;
            if (node.id?.name === 'LeaderboardManager') leaderboardClass = node;
            if (node.id?.name) standaloneClasses.set(node.id.name, node);
        }
        if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') {
            if (node.id.name === 'UI') uiDecl = node;
            if (node.id.name === 'LDSPDialog') dialogDecl = node;
        }
        if (
            node.type === 'CallExpression'
            && node.callee?.type === 'MemberExpression'
            && node.callee.object?.type === 'Identifier'
            && node.callee.object.name === 'I18n'
            && node.callee.property?.type === 'Identifier'
            && (node.callee.property.name === 't' || node.callee.property.name === 'tHtml')
        ) {
            const arg = node.arguments[0];
            if (arg?.type === 'Literal' && typeof arg.value === 'string' && !zhMap.has(arg.value)) {
                errors.push(`Unresolved I18n.${node.callee.property.name} key in LDStatusPro.user.js: "${arg.value}"`);
            }
        }
    });

    const scanNodeForUncatalogedCjk = (label, rootNode) => {
        if (!rootNode) return;
        walkAst(rootNode, node => {
            if (node.type === 'Literal' && typeof node.value === 'string') {
                // Skip raw unicode escape sequences used intentionally as canonical parser tokens
                const rawSrc = userscriptSource.slice(node.start, node.end);
                if (/\\u[0-9a-fA-F]{4}/.test(rawSrc) && !CJK_RE.test(rawSrc)) return;
                if (CJK_RE.test(node.value) && !ALLOWED_CJK_LITERALS.has(node.value)) {
                    errors.push(`Uncataloged CJK literal in ${label}: ${JSON.stringify(node.value)}`);
                }
            } else if (node.type === 'TemplateElement') {
                const rawText = node.value?.raw || '';
                if (CJK_RE.test(rawText)) {
                    errors.push(`Uncataloged CJK template text in ${label}: ${JSON.stringify(rawText.trim().slice(0, 40))}`);
                }
            }
        });
    };

    const checkClassMethods = (className, classNode, methods) => {
        if (!classNode || !methods?.length) return;
        const methodMap = new Map(
            classNode.body.body
                .filter(member => member.type === 'MethodDefinition' && member.key?.type === 'Identifier')
                .map(member => [member.key.name, member])
        );
        for (const methodName of methods) {
            const methodNode = methodMap.get(methodName);
            if (!methodNode) {
                errors.push(`Migrated ${className} method missing: ${methodName}`);
                continue;
            }
            scanNodeForUncatalogedCjk(`${className}.${methodName}`, methodNode.value);
        }
    };

    checkClassMethods('Panel', panelClass, migratedMethods);
    if (migratedMethods === MIGRATED_PANEL_METHODS) {
        checkClassMethods('Renderer', rendererClass, MIGRATED_RENDERER_METHODS);
        checkClassMethods('Panel', panelClass, MIGRATED_PANEL_EXTRA_METHODS);
        for (const className of MIGRATED_STANDALONE_CLASSES) {
            const classNode = standaloneClasses.get(className);
            if (!classNode) {
                errors.push(`Migrated class missing: ${className}`);
                continue;
            }
            scanNodeForUncatalogedCjk(className, classNode);
        }
        scanNodeForUncatalogedCjk('Notifier', notifierClass);
        scanNodeForUncatalogedCjk('LeaderboardManager', leaderboardClass);
        scanNodeForUncatalogedCjk('UI', uiDecl);
        scanNodeForUncatalogedCjk('LDSPDialog', dialogDecl);
    }

    return {
        ok: errors.length === 0,
        errors,
        summary: {
            totalKeys: zhMap.size,
            added,
            changed,
            removed,
            reviewed: zhMap.size - added.length - changed.length
        }
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const catalogs = loadDiskCatalogs();
    if (process.argv.includes('--sync-manifest')) {
        const nextManifest = buildReviewManifest(catalogs['zh-CN']);
        fs.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2) + '\n');
        console.log(`Updated review-manifest.json (${Object.keys(nextManifest.entries).length} reviewed keys).`);
        process.exit(0);
    }

    const result = validateI18n({ catalogs });
    if (process.argv.includes('--status')) {
        const { summary } = result;
        console.log(
            `i18n status: ${summary.reviewed}/${summary.totalKeys} reviewed | `
            + `added: ${summary.added.length}, changed source: ${summary.changed.length}, removed: ${summary.removed.length}`
        );
    }
    if (!result.ok) {
        console.error(result.errors.join('\n'));
        process.exit(1);
    }
    console.log(`Verified ${result.summary.totalKeys} i18n keys (zh-CN / en-US).`);
}
