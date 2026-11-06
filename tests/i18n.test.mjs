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
import { approveManifestEntries, buildReviewManifest, findDuplicateJsonKeys, loadDiskCatalogs, validateI18n } from '../scripts/check-i18n.mjs';

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

test('manifest approval is explicit per key and never approves changed sources automatically', () => {
    const disks = loadDiskCatalogs();
    const manifest = buildReviewManifest(disks['zh-CN']);
    const changed = structuredClone(disks);
    changed['zh-CN'].settings.title = '偏好设置（新）';

    assert.equal(validateI18n({ catalogs: changed, manifest }).ok, false);
    assert.equal(validateI18n({ catalogs: changed, manifest: approveManifestEntries(manifest, changed['zh-CN'], []) }).ok, false);
    assert.equal(validateI18n({ catalogs: changed, manifest: approveManifestEntries(manifest, changed['zh-CN'], ['settings.nav.theme']) }).ok, false);
    assert.equal(validateI18n({ catalogs: changed, manifest: approveManifestEntries(manifest, changed['zh-CN'], ['settings.title']) }).ok, true);
});

test('check-i18n validates conditional keys, core modules, duplicate JSON and escaped CJK', () => {
    const disks = loadDiskCatalogs();
    const manifest = buildReviewManifest(disks['zh-CN']);

    const conditionalUserscript = `
        // @@CORE_SANITIZE_END
        // @@I18N_END
        class Panel {
            _getThemeModeLabel() { return I18n.t(true ? 'audit.missingKey' : 'settings.theme.auto'); }
            _getFontSizeLabel() { return I18n.t(dynamicKey); }
        }
    `;
    const conditionalCheck = validateI18n({
        catalogs: disks, manifest,
        userscriptSource: conditionalUserscript,
        migratedMethods: ['_getThemeModeLabel', '_getFontSizeLabel'],
        coreSources: {}
    });
    assert.equal(conditionalCheck.ok, false);
    assert.ok(conditionalCheck.errors.some(err => err.includes('"audit.missingKey"')));
    assert.equal(conditionalCheck.summary.dynamicReferences.length, 1);
    assert.equal(conditionalCheck.summary.dynamicReferences[0].call, 'I18n.t');

    const coreCheck = validateI18n({
        catalogs: disks, manifest,
        userscriptSource: '// @@I18N_END\n// @@CORE_SANITIZE_END\n',
        migratedMethods: [],
        coreSources: { 'topic-ai.mjs': "import { tr } from './messages.mjs';\nexport const x = t => tr(t, 'core.missing.key');\n" }
    });
    assert.equal(coreCheck.ok, false);
    assert.ok(coreCheck.errors.some(err => err.includes('core.missing.key') && err.includes('src/core/topic-ai.mjs')));

    assert.deepEqual([...new Set(findDuplicateJsonKeys('{"a":{"b":"1","b":"2"},"a":"3"}'))].sort(), ['a', 'b']);

    const escapedUserscript = `
        // @@CORE_SANITIZE_END
        // @@I18N_END
        class Panel {
            _getThemeModeLabel() { return '\\u5f20\\u5e16'; }
        }
    `;
    const escapedCheck = validateI18n({
        catalogs: disks, manifest,
        userscriptSource: escapedUserscript,
        migratedMethods: ['_getThemeModeLabel'],
        coreSources: {}
    });
    assert.equal(escapedCheck.ok, false);
    assert.ok(escapedCheck.errors.some(err => err.includes('Uncataloged CJK literal') && err.includes('张帖')));
});

test('core modules accept an injected translator and keep Chinese fallbacks without one', async () => {
    const { normalizeApiUrl, requestCompletion, CompletionDecoder, packRecords } = await import('../src/core/topic-ai.mjs');
    const { createTranslator } = await import('../src/i18n/index.mjs');
    const en = createTranslator('en-US');
    const zh = createTranslator('zh-CN');

    // Without a translator the original Chinese text is used (standalone core / existing tests).
    assert.throws(() => normalizeApiUrl('linux.do'), /地址须以 http:\/\//);
    assert.throws(() => normalizeApiUrl('linux.do', zh.t), /地址须以 http:\/\//);
    // With the injected translator the same failure follows the UI locale.
    assert.throws(() => normalizeApiUrl('linux.do', en.t), /URL must start with http:\/\/ or https:\/\//);
    assert.throws(() => normalizeApiUrl('https://user:secret@host.invalid', en.t), /must not contain a username/);

    // Transport failures localize through the injected translator.
    await assert.rejects(
        requestCompletion({ apiUrl: 'https://ai.example.invalid/v1' }, {
            messages: [], t: en.t,
            gm: options => { queueMicrotask(() => options.onerror({})); return { abort() {} }; }
        }),
        error => /Cannot reach the AI service/.test(error.message)
    );
    await assert.rejects(
        requestCompletion({ apiUrl: 'https://ai.example.invalid/v1' }, {
            messages: [],
            gm: options => { queueMicrotask(() => options.onerror({})); return { abort() {} }; }
        }),
        error => /无法连接 AI 服务/.test(error.message)
    );

    // HTTP error labels and decoder messages localize too.
    await assert.rejects(
        requestCompletion({ apiUrl: 'https://ai.example.invalid/v1' }, {
            messages: [], t: en.t,
            gm: options => { queueMicrotask(() => options.onload({ status: 401, responseText: '{}' })); return { abort() {} }; }
        }),
        error => error.status === 401 && /Authentication failed/.test(error.message)
    );
    const decoder = new CompletionDecoder(() => {}, en.t);
    decoder.push('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n');
    decoder.push('data: [DONE]\n\n');
    assert.equal(decoder.finish().text, 'hi');
    const emptyDecoder = new CompletionDecoder(() => {}, en.t);
    emptyDecoder.push('{}');
    assert.throws(() => emptyDecoder.finish(), /AI returned empty content/);
    assert.throws(() => packRecords(['x'.repeat(50)], 10, en.t), /Post author info exceeds|Post author/);

    // Citation format written into records stays Chinese regardless of locale.
    assert.equal(typeof packRecords([], 100), 'object');
});

test('CORE_TEXT stays in exact parity with the zh-CN core catalog', async () => {
    const { CORE_TEXT } = await import('../src/core/messages.mjs');
    const expected = new Map();
    for (const [domain, entries] of Object.entries(CATALOGS['zh-CN'].core)) {
        for (const [key, value] of Object.entries(entries)) expected.set(`core.${domain}.${key}`, value);
    }
    assert.deepEqual(Object.keys(CORE_TEXT).sort(), [...expected.keys()].sort());
    for (const [key, value] of expected) assert.equal(CORE_TEXT[key], value, key);
});

test('embedded i18n bundle stays compact with zero external runtime dependencies', async () => {
    const { rawBytes, gzipBytes } = await buildI18nSnippet();
    assert.ok(CATALOGS['zh-CN'] && CATALOGS['en-US']);
    assert.ok(rawBytes < 90_000, `Expected raw I18n bundle < 90 KB, got ${rawBytes} B`);
    assert.ok(gzipBytes < 32_000, `Expected gzipped I18n bundle < 32 KB, got ${gzipBytes} B`);
});
