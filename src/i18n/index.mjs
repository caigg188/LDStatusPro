import zhCommon from './locales/zh-CN/common.json' with { type: 'json' };
import zhPanel from './locales/zh-CN/panel.json' with { type: 'json' };
import zhSettings from './locales/zh-CN/settings.json' with { type: 'json' };
import zhMetrics from './locales/zh-CN/metrics.json' with { type: 'json' };
import zhTrends from './locales/zh-CN/trends.json' with { type: 'json' };
import zhLeaderboard from './locales/zh-CN/leaderboard.json' with { type: 'json' };
import zhFollow from './locales/zh-CN/follow.json' with { type: 'json' };
import zhTickets from './locales/zh-CN/tickets.json' with { type: 'json' };
import zhActivity from './locales/zh-CN/activity.json' with { type: 'json' };
import zhLdc from './locales/zh-CN/ldc.json' with { type: 'json' };
import zhCdk from './locales/zh-CN/cdk.json' with { type: 'json' };
import enCommon from './locales/en-US/common.json' with { type: 'json' };
import enPanel from './locales/en-US/panel.json' with { type: 'json' };
import enSettings from './locales/en-US/settings.json' with { type: 'json' };
import enMetrics from './locales/en-US/metrics.json' with { type: 'json' };
import enTrends from './locales/en-US/trends.json' with { type: 'json' };
import enLeaderboard from './locales/en-US/leaderboard.json' with { type: 'json' };
import enFollow from './locales/en-US/follow.json' with { type: 'json' };
import enTickets from './locales/en-US/tickets.json' with { type: 'json' };
import enActivity from './locales/en-US/activity.json' with { type: 'json' };
import enLdc from './locales/en-US/ldc.json' with { type: 'json' };
import enCdk from './locales/en-US/cdk.json' with { type: 'json' };

export const DEFAULT_LOCALE = 'zh-CN';
export const SUPPORTED_LOCALES = Object.freeze(['zh-CN', 'en-US']);
export const PLURAL_CATEGORIES = Object.freeze(['zero', 'one', 'two', 'few', 'many', 'other']);

export const CATALOGS = Object.freeze({
    'zh-CN': Object.freeze({
        common: zhCommon,
        panel: zhPanel,
        settings: zhSettings,
        metrics: zhMetrics,
        trends: zhTrends,
        leaderboard: zhLeaderboard,
        follow: zhFollow,
        tickets: zhTickets,
        activity: zhActivity,
        ldc: zhLdc,
        cdk: zhCdk
    }),
    'en-US': Object.freeze({
        common: enCommon,
        panel: enPanel,
        settings: enSettings,
        metrics: enMetrics,
        trends: enTrends,
        leaderboard: enLeaderboard,
        follow: enFollow,
        tickets: enTickets,
        activity: enActivity,
        ldc: enLdc,
        cdk: enCdk
    })
});

export function normalizeLocale(value) {
    if (typeof value !== 'string') return DEFAULT_LOCALE;
    const trimmed = value.trim().toLowerCase();
    if (trimmed === 'en-us' || trimmed === 'en') return 'en-US';
    if (trimmed === 'zh-cn' || trimmed === 'zh') return 'zh-CN';
    return DEFAULT_LOCALE;
}

export function escapeHtmlText(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => (
        ch === '&' ? '&amp;'
            : ch === '<' ? '&lt;'
                : ch === '>' ? '&gt;'
                    : ch === '"' ? '&quot;'
                        : '&#39;'
    ));
}

export function isPluralForms(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const keys = Object.keys(entry);
    return keys.length > 0
        && Object.prototype.hasOwnProperty.call(entry, 'other')
        && keys.every(key => PLURAL_CATEGORIES.includes(key) && typeof entry[key] === 'string');
}

function lookupEntry(catalog, key) {
    if (typeof key !== 'string' || !key) return undefined;
    const parts = key.split('.');
    let node = catalog;
    for (const part of parts) {
        if (!node || typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, part)) {
            return undefined;
        }
        node = node[part];
    }
    return typeof node === 'string' || isPluralForms(node) ? node : undefined;
}

function interpolate(template, params) {
    if (!params || typeof params !== 'object') return template;
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => (
        Object.prototype.hasOwnProperty.call(params, name) && params[name] !== undefined && params[name] !== null
            ? String(params[name])
            : match
    ));
}

export function createTranslator(locale = DEFAULT_LOCALE, { catalogs = CATALOGS, onFallback } = {}) {
    const resolvedLocale = normalizeLocale(locale);
    const pluralRulesCache = new Map();
    const getPluralRules = tag => {
        if (!pluralRulesCache.has(tag)) pluralRulesCache.set(tag, new globalThis.Intl.PluralRules(tag));
        return pluralRulesCache.get(tag);
    };

    function resolve(key, params = {}) {
        const primary = lookupEntry(catalogs[resolvedLocale], key);
        let entry = primary;
        let entryLocale = resolvedLocale;

        if (entry === undefined && resolvedLocale !== DEFAULT_LOCALE) {
            entry = lookupEntry(catalogs[DEFAULT_LOCALE], key);
            entryLocale = DEFAULT_LOCALE;
            if (entry !== undefined) onFallback?.({ key, locale: resolvedLocale, fallbackLocale: DEFAULT_LOCALE, missing: false });
        }

        if (entry === undefined) {
            onFallback?.({ key, locale: resolvedLocale, fallbackLocale: null, missing: true });
            return String(key ?? '');
        }

        if (isPluralForms(entry)) {
            const countNum = Number(params?.count ?? 0);
            const category = Number.isFinite(countNum) ? getPluralRules(entryLocale).select(countNum) : 'other';
            const template = entry[category] ?? entry.other;
            return interpolate(template, params);
        }

        return interpolate(entry, params);
    }

    return Object.freeze({
        locale: resolvedLocale,
        t: (key, params) => resolve(key, params),
        tHtml: (key, params) => escapeHtmlText(resolve(key, params)),
        formatNumber: (value, options) => new globalThis.Intl.NumberFormat(resolvedLocale, options).format(value),
        formatDateTime: (value, options) => new globalThis.Intl.DateTimeFormat(resolvedLocale, options).format(value),
        formatRelativeTime: (value, unit, options) => new globalThis.Intl.RelativeTimeFormat(resolvedLocale, { numeric: 'auto', ...options }).format(value, unit)
    });
}

let activeTranslator = createTranslator(DEFAULT_LOCALE);

export function getLocale() {
    return activeTranslator.locale;
}

export function setLocale(locale) {
    activeTranslator = createTranslator(locale);
    return activeTranslator.locale;
}

export function t(key, params) {
    return activeTranslator.t(key, params);
}

export function tHtml(key, params) {
    return activeTranslator.tHtml(key, params);
}

export function formatNumber(value, options) {
    return activeTranslator.formatNumber(value, options);
}

export function formatDateTime(value, options) {
    return activeTranslator.formatDateTime(value, options);
}

export function formatRelativeTime(value, unit, options) {
    return activeTranslator.formatRelativeTime(value, unit, options);
}
