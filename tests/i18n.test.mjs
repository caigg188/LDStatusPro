import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    CATALOGS,
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    createTranslator,
    getLocale,
    normalizeLocale,
    setLocale,
    t,
    tHtml
} from '../src/i18n/index.mjs';
import { buildI18nSnippet } from '../scripts/embed-i18n.mjs';
import { buildReviewManifest, loadDiskCatalogs, validateI18n } from '../scripts/check-i18n.mjs';

test('locale normalization defaults safely to zh-CN and accepts en-US variants', () => {
    assert.deepEqual(SUPPORTED_LOCALES, ['zh-CN', 'en-US']);
    assert.equal(DEFAULT_LOCALE, 'zh-CN');
    assert.equal(normalizeLocale(undefined), 'zh-CN');
    assert.equal(normalizeLocale(null), 'zh-CN');
    assert.equal(normalizeLocale(''), 'zh-CN');
    assert.equal(normalizeLocale('pt-BR'), 'zh-CN');
    assert.equal(normalizeLocale(42), 'zh-CN');
    assert.equal(normalizeLocale('zh-CN'), 'zh-CN');
    assert.equal(normalizeLocale('en-US'), 'en-US');
    assert.equal(normalizeLocale('  EN-us '), 'en-US');
});

test('translator resolves zh-CN and en-US catalogs, CLDR plurals and single-pass interpolation without fallbacks', () => {
    const fallbacks = [];
    const zh = createTranslator('zh-CN', { onFallback: event => fallbacks.push(event) });
    const en = createTranslator('en-US', { onFallback: event => fallbacks.push(event) });

    assert.equal(zh.t('settings.title'), '设置');
    assert.equal(en.t('settings.title'), 'Settings');
    assert.equal(zh.t('settings.readingGoal.summary', { hours: '1', count: 1 }), '1小时');
    assert.equal(en.t('settings.readingGoal.summary', { hours: '1', count: 1 }), '1 hr');
    assert.equal(en.t('settings.readingGoal.summary', { hours: '2.5', count: 2.5 }), '2.5 hrs');
    assert.equal(en.t('settings.readingGoal.summary', { hours: '0.5', count: 0.5 }), '0.5 hrs');
    assert.equal(fallbacks.length, 0);

    // Single-pass interpolation must never re-expand brace tokens inside parameter values.
    assert.equal(
        en.t('panel.ariaLabel', { site: '{injected}' }),
        '{injected} Trust Level Panel'
    );
});

test('tHtml escapes HTML and attribute quotes while t preserves plain text for DOM properties', () => {
    const en = createTranslator('en-US');
    const malicious = '<img src=x onerror="alert(\'xss\')">&';

    assert.equal(en.t('panel.ariaLabel', { site: malicious }), `${malicious} Trust Level Panel`);
    assert.equal(
        en.tHtml('panel.ariaLabel', { site: malicious }),
        '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;&amp; Trust Level Panel'
    );
});

test('fallback to zh-CN and missing keys are surfaced through onFallback', () => {
    const events = [];
    const customCatalogs = {
        'zh-CN': { panel: { onlyZh: '仅中文 {n}' } },
        'en-US': { panel: {} }
    };
    const en = createTranslator('en-US', {
        catalogs: customCatalogs,
        onFallback: event => events.push(event)
    });

    assert.equal(en.t('panel.onlyZh', { n: 3 }), '仅中文 3');
    assert.equal(en.t('panel.nonexistent'), 'panel.nonexistent');
    assert.deepEqual(events, [
        { key: 'panel.onlyZh', locale: 'en-US', fallbackLocale: 'zh-CN', missing: false },
        { key: 'panel.nonexistent', locale: 'en-US', fallbackLocale: null, missing: true }
    ]);

    // Singleton state switches cleanly and resets back to default.
    assert.equal(setLocale('en-US'), 'en-US');
    assert.equal(getLocale(), 'en-US');
    assert.equal(t('settings.nav.language'), '🌐 Language');
    assert.match(tHtml('panel.ariaLabel', { site: 'Linux.do' }), /Linux\.do Trust Level Panel/);
    assert.equal(setLocale('zh-CN'), 'zh-CN');
});

test('locale formatters follow explicit locale without mutating inputs', () => {
    const zh = createTranslator('zh-CN');
    const en = createTranslator('en-US');
    assert.equal(en.formatNumber(1234567), '1,234,567');
    assert.equal(zh.formatNumber(1234567), '1,234,567');
    assert.match(en.formatRelativeTime(-1, 'day'), /yesterday/i);
});

test('check-i18n passes on current repository and catches missing keys, placeholder drift, stale source hashes and uncataloged CJK', () => {
    const clean = validateI18n();
    assert.equal(clean.ok, true, clean.errors.join('\n'));
    assert.ok(clean.summary.totalKeys >= 75);

    // 1. Mutate zh-CN source without updating review-manifest -> must flag stale en-US translation.
    const disks = loadDiskCatalogs();
    const mutatedZh = structuredClone(disks);
    mutatedZh['zh-CN'].settings.title = '偏好设置';
    const staleCheck = validateI18n({ catalogs: mutatedZh });
    assert.equal(staleCheck.ok, false);
    assert.ok(staleCheck.errors.some(err => err.includes('Stale en-US translation') && err.includes('settings.title')));

    // 2. Placeholder mismatch between zh-CN and en-US -> must fail.
    const badPlaceholder = structuredClone(disks);
    badPlaceholder['en-US'].settings.actions.summary = '{enabled} enabled';
    const placeholderCheck = validateI18n({
        catalogs: badPlaceholder,
        manifest: buildReviewManifest(badPlaceholder['zh-CN'])
    });
    assert.equal(placeholderCheck.ok, false);
    assert.ok(placeholderCheck.errors.some(err => err.includes('Placeholder mismatch for settings.actions.summary')));

    // 3. Missing en-US key -> must fail.
    const missingEn = structuredClone(disks);
    delete missingEn['en-US'].panel.header.refresh;
    const missingCheck = validateI18n({
        catalogs: missingEn,
        manifest: buildReviewManifest(missingEn['zh-CN'])
    });
    assert.equal(missingCheck.ok, false);
    assert.ok(missingCheck.errors.some(err => err.includes('Missing en-US translation: panel.header.refresh')));

    // 4. Unresolved key or uncataloged CJK literal inside a migrated Panel method -> must fail.
    const badUserscript = `
        // @@CORE_SANITIZE_END
        // @@I18N_END
        class Panel {
            _getThemeModeLabel() { return '未入库中文'; }
            _getFontSizeLabel() { return I18n.t('settings.doesNotExist'); }
        }
    `;
    const astCheck = validateI18n({
        catalogs: disks,
        manifest: buildReviewManifest(disks['zh-CN']),
        userscriptSource: badUserscript,
        migratedMethods: ['_getThemeModeLabel', '_getFontSizeLabel']
    });
    assert.equal(astCheck.ok, false);
    assert.ok(astCheck.errors.some(err => err.includes('Uncataloged CJK literal in Panel._getThemeModeLabel')));
    assert.ok(astCheck.errors.some(err => err.includes('Unresolved I18n.t key in LDStatusPro.user.js: "settings.doesNotExist"')));
});

test('embedded i18n bundle stays compact with zero external runtime dependencies', async () => {
    const { rawBytes, gzipBytes } = await buildI18nSnippet();
    assert.ok(CATALOGS['zh-CN'] && CATALOGS['en-US']);
    assert.ok(rawBytes < 45_000, `Expected raw I18n bundle < 45 KB, got ${rawBytes} B`);
    assert.ok(gzipBytes < 18_000, `Expected gzipped I18n bundle < 18 KB, got ${gzipBytes} B`);
});
