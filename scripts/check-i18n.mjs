#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { PLURAL_CATEGORIES, isPluralForms } from '../src/i18n/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localesRoot = path.join(root, 'src/i18n/locales');
const coreRoot = path.join(root, 'src/core');
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
    'CDKManager',
    'MelonHelper',
    'TopicExporter'
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

// Explicit non-UI tokens allowed inside migrated methods, scoped to the method that needs
// them (parser sentinels, remote-value matchers, locale-dependent punctuation). Value -> method -> reason.
const ALLOWED_CJK_LITERALS = new Map([
    ['未知', new Map([
        ['Panel._showFallbackStats', 'forum username sentinel'],
        ['Panel._parse', 'forum username sentinel']
    ])],
    ['；', new Map([
        ['Panel._showFallbackStats', 'zh-CN hint separator punctuation']
    ])],
    ['已暂停新用户注册', new Map([
        ['Panel._renderLeaderboardContent', 'server REGISTRATION_PAUSED message matcher']
    ])],
    ['原始发帖人', new Map([
        ['Renderer._renderTopicItems', 'forum poster description matcher']
    ])],
    ['请仅回复 OK。', new Map([
        ['MelonHelper', 'connection-test prompt payload sent to the AI service']
    ])],
    ['及所附分段摘要', new Map([
        ['MelonHelper', 'chat prompt fragment kept Chinese for AI output language']
    ])],
    ['本总结尚未完成。', new Map([
        ['MelonHelper', 'chat prompt fragment kept Chinese for AI output language']
    ])],
    ['所有时间', new Map([
        ['Renderer.getTrendFields', 'forum metric-name matcher for the all-time variant']
    ])],
    ['前一日', new Map([
        ['Renderer.renderTodayTrend', 'server compareLabel matcher replaced by trends.prevDay']
    ])]
]);

// AI prompt and citation sentinels that must stay Chinese: they control the model's output
// language and the [第N楼] citation format that the parser and prompts depend on.
// UI language is a separate concern from AI output language (see docs/i18n plan, section 5).
const ALLOWED_PROMPT_FRAGMENTS = new Set([
    '用约150字概括以下论坛讨论的主题、主要结论和重要分歧，关键结论引用 [第N楼]：',
    '结构化总结以下论坛讨论：概要、关键观点、分歧、结论与待确认事项。不要将少数观点写成共识，关键结论引用 [第N楼]：',
    '你帮助用户理解论坛总结。仅根据以下总结',
    '回答，超出资料时明确说明，不推测图片。',
    '[第',
    '楼]',
    '回复第',
    '楼'
]);

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

// Detect duplicate member names before JSON.parse silently keeps only the last one.
export function findDuplicateJsonKeys(text) {
    const duplicates = [];
    const scopes = [];
    let expect = 'value';
    let i = 0;
    const skipWs = () => { while (i < text.length && /\s/.test(text[i])) i++; };
    const readString = () => {
        let out = '';
        i++;
        while (i < text.length) {
            const ch = text[i];
            if (ch === '\\') { out += text[i + 1] ?? ''; i += 2; continue; }
            if (ch === '"') { i++; break; }
            out += ch; i++;
        }
        return out;
    };
    while (i < text.length) {
        skipWs();
        const ch = text[i];
        if (ch === undefined) break;
        if (ch === '{') { scopes.push(new Set()); expect = 'key'; i++; continue; }
        if (ch === '[') { scopes.push(null); expect = 'value'; i++; continue; }
        if (ch === '}' || ch === ']') { scopes.pop(); expect = 'commaOrClose'; i++; continue; }
        if (ch === ',') { i++; expect = scopes[scopes.length - 1] ? 'key' : 'value'; continue; }
        if (ch === ':') { i++; expect = 'value'; continue; }
        if (ch === '"') {
            const value = readString();
            if (expect === 'key') {
                const keys = scopes[scopes.length - 1];
                if (keys.has(value)) duplicates.push(value);
                keys.add(value);
                expect = 'colon';
            } else {
                expect = 'commaOrClose';
            }
            continue;
        }
        while (i < text.length && !/[\s,\]}]/.test(text[i])) i++;
        expect = 'commaOrClose';
    }
    return duplicates;
}

// Statically resolvable message keys: plain literals, expression-free templates and
// every branch of conditionals/logical expressions (each branch must resolve).
export function staticStringKeys(node, keys = []) {
    if (!node) return keys;
    if (node.type === 'Literal' && typeof node.value === 'string') keys.push(node.value);
    else if (node.type === 'TemplateLiteral' && node.expressions.length === 0) keys.push(node.quasis[0].value.cooked ?? node.quasis[0].value.raw);
    else if (node.type === 'ConditionalExpression') {
        staticStringKeys(node.consequent, keys);
        staticStringKeys(node.alternate, keys);
    } else if (node.type === 'LogicalExpression') {
        staticStringKeys(node.left, keys);
        staticStringKeys(node.right, keys);
    }
    return keys;
}

function isFullyStaticKey(node) {
    if (!node) return false;
    if (node.type === 'Literal') return typeof node.value === 'string';
    if (node.type === 'TemplateLiteral') return node.expressions.length === 0;
    if (node.type === 'ConditionalExpression') return isFullyStaticKey(node.consequent) && isFullyStaticKey(node.alternate);
    if (node.type === 'LogicalExpression') return isFullyStaticKey(node.left) && isFullyStaticKey(node.right);
    return false;
}

function lineOf(source, index) {
    return source.slice(0, index).split('\n').length;
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
            const text = fs.readFileSync(path.join(localeDir, file), 'utf8');
            const duplicates = [...new Set(findDuplicateJsonKeys(text))];
            if (duplicates.length) throw new Error(`Duplicate keys in ${locale}/${file}: ${duplicates.join(', ')}`);
            namespaces[ns] = JSON.parse(text);
        }
        result[locale] = namespaces;
    }
    return result;
}

export function loadCoreSources(dir = coreRoot) {
    const sources = {};
    for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.mjs')).sort()) {
        sources[file] = fs.readFileSync(path.join(dir, file), 'utf8');
    }
    return sources;
}

function walkAst(node, visit) {
    visit(node);
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(child => child?.type && walkAst(child, visit));
        else if (value?.type) walkAst(value, visit);
    }
}

// Full bootstrap manifest for the initial reviewed baseline. Later zh-CN source changes must
// go through approveManifestEntries, which only records the keys a reviewer lists explicitly.
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

// Explicit, per-key approval: only the listed keys update their reviewed hash; additions and
// changes stay pending otherwise, and removals stay flagged until the key is listed.
export function approveManifestEntries(manifest, zhCatalog, keys) {
    const errors = [];
    const zhMap = new Map();
    for (const [ns, data] of Object.entries(zhCatalog)) flattenCatalogNamespace(ns, data, ns, zhMap, errors);
    if (errors.length) throw new Error(errors.join('\n'));
    const next = { ...manifest, entries: { ...(manifest?.entries || {}) } };
    for (const key of keys) {
        if (zhMap.has(key)) next.entries[key] = hashSourceEntry(key, zhMap.get(key));
        else if (Object.prototype.hasOwnProperty.call(next.entries, key)) delete next.entries[key];
        else throw new Error(`Cannot approve unknown key: ${key}`);
    }
    return next;
}

export function validateI18n({
    catalogs = loadDiskCatalogs(),
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
    userscriptSource = fs.readFileSync(userscriptPath, 'utf8'),
    migratedMethods = MIGRATED_PANEL_METHODS,
    coreSources = loadCoreSources()
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
    const dynamicReferences = [];

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
            for (const key of staticStringKeys(arg)) {
                if (!zhMap.has(key)) errors.push(`Unresolved I18n.${node.callee.property.name} key in LDStatusPro.user.js: "${key}"`);
            }
            if (!isFullyStaticKey(arg)) {
                dynamicReferences.push({ file: 'LDStatusPro.user.js', call: `I18n.${node.callee.property.name}`, line: lineOf(userscriptSource, node.start) });
            }
        }
    });

    const scanNodeForUncatalogedCjk = (label, rootNode) => {
        if (!rootNode) return;
        walkAst(rootNode, node => {
            if (node.type === 'Literal' && typeof node.value === 'string') {
                // The decoded value decides: \uXXXX escapes must not hide visible Chinese text.
                const allowed = ALLOWED_CJK_LITERALS.get(node.value);
                if (CJK_RE.test(node.value) && !allowed?.has(label)) {
                    const hint = allowed ? ` (allowed in ${[...allowed.keys()].join(', ')})` : '';
                    errors.push(`Uncataloged CJK literal in ${label}: ${JSON.stringify(node.value)}${hint}`);
                }
            } else if (node.type === 'TemplateElement') {
                const cooked = node.value?.cooked ?? node.value?.raw ?? '';
                if (CJK_RE.test(cooked) && !ALLOWED_PROMPT_FRAGMENTS.has(cooked.trim())) {
                    errors.push(`Uncataloged CJK template text in ${label}: ${JSON.stringify(cooked.trim().slice(0, 40))}`);
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

    // src/core message keys are validated against the zh-CN catalog; dynamic keys are reported.
    for (const [file, source] of Object.entries(coreSources)) {
        let coreAst;
        try { coreAst = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }); }
        catch (error) { errors.push(`Cannot parse src/core/${file}: ${error.message}`); continue; }
        walkAst(coreAst, node => {
            if (node.type !== 'CallExpression' || node.callee?.type !== 'Identifier' || node.callee.name !== 'tr') return;
            const arg = node.arguments[1];
            for (const key of staticStringKeys(arg)) {
                if (!zhMap.has(key)) errors.push(`Unresolved core message key in src/core/${file}: "${key}"`);
            }
            if (!isFullyStaticKey(arg)) {
                dynamicReferences.push({ file: `src/core/${file}`, call: 'tr', line: lineOf(source, node.start) });
            }
        });
    }

    return {
        ok: errors.length === 0,
        errors,
        summary: {
            totalKeys: zhMap.size,
            added,
            changed,
            removed,
            reviewed: zhMap.size - added.length - changed.length,
            dynamicReferences,
            scannedCoreFiles: Object.keys(coreSources)
        }
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const catalogs = loadDiskCatalogs();
    const approveIndex = process.argv.indexOf('--approve');
    if (approveIndex >= 0) {
        const keys = process.argv.slice(approveIndex + 1).filter(arg => !arg.startsWith('--'));
        if (!keys.length) {
            console.error('Usage: node scripts/check-i18n.mjs --approve <key> [key...]');
            process.exit(2);
        }
        const currentManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const nextManifest = approveManifestEntries(currentManifest, catalogs['zh-CN'], keys);
        fs.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2) + '\n');
        console.log(`Approved ${keys.length} key(s): ${keys.join(', ')}`);
        process.exit(0);
    }

    const result = validateI18n({ catalogs });
    if (process.argv.includes('--status')) {
        const { summary } = result;
        console.log(
            `i18n status: ${summary.reviewed}/${summary.totalKeys} reviewed | `
            + `added: ${summary.added.length}, changed source: ${summary.changed.length}, removed: ${summary.removed.length} | `
            + `dynamic references: ${summary.dynamicReferences.length}`
        );
        for (const [label, keys] of [['added', summary.added], ['changed source', summary.changed], ['removed', summary.removed]]) {
            if (keys.length) console.log(`  ${label}: ${keys.join(', ')}`);
        }
        if (summary.dynamicReferences.length) {
            console.log('  dynamic references (not statically verifiable):');
            for (const ref of summary.dynamicReferences) console.log(`    ${ref.file}:${ref.line} ${ref.call}`);
        }
    }
    if (!result.ok) {
        console.error(result.errors.join('\n'));
        process.exit(1);
    }
    console.log(`Verified ${result.summary.totalKeys} i18n keys (zh-CN / en-US).`);
}
