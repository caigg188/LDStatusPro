// In-memory mutations only. Never updates catalogs or the review manifest.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadDiskCatalogs, validateI18n, buildReviewManifest, approveManifestEntries, findDuplicateJsonKeys } from '../../scripts/check-i18n.mjs';

const catalogs = loadDiskCatalogs();
const manifest = JSON.parse(readFileSync(new URL('../../src/i18n/review-manifest.json', import.meta.url)));
const source = readFileSync(new URL('../../LDStatusPro.user.js', import.meta.url), 'utf8');
const results = [];
function probe(name, run) {
    try { run(); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: error.message }); }
}
probe('control: unchanged catalog passes', () => assert.equal(validateI18n({ catalogs, manifest }).ok, true));
const changed = structuredClone(catalogs);
changed['zh-CN'].melon.title += '（新含义）';
probe('control: source change with old review manifest fails', () => {
    assert.equal(validateI18n({ catalogs: changed, manifest }).ok, false);
});
probe('manifest approval is explicit per key', () => {
    const empty = approveManifestEntries(manifest, changed['zh-CN'], []);
    assert.equal(validateI18n({ catalogs: changed, manifest: empty }).ok, false, 'empty approval approved the changed key');
    const unrelated = approveManifestEntries(manifest, changed['zh-CN'], ['settings.title']);
    assert.equal(validateI18n({ catalogs: changed, manifest: unrelated }).ok, false, 'unrelated approval approved the changed key');
    const approved = approveManifestEntries(manifest, changed['zh-CN'], ['melon.title']);
    assert.equal(validateI18n({ catalogs: changed, manifest: approved }).ok, true, 'explicit approval did not clear the pending key');
});
probe('conditional missing keys are rejected', () => {
    const original = "I18n.t('common.time.justNow')";
    assert.ok(source.includes(original));
    const mutated = source.replace(original, "I18n.t(true ? 'audit.missingKey' : 'common.time.justNow')");
    assert.equal(validateI18n({ catalogs, manifest, userscriptSource: mutated }).ok, false,
        'missing key in conditional expression passes');
});
probe('core module tr() keys are validated', () => {
    const result = validateI18n({
        catalogs, manifest,
        coreSources: { 'topic-ai.mjs': "import { tr } from './messages.mjs';\nexport const x = t => tr(t, 'core.missing.key');\n" }
    });
    assert.equal(result.ok, false, 'missing core message key passed');
});
probe('duplicate JSON keys are detected before parsing', () => {
    assert.deepEqual([...new Set(findDuplicateJsonKeys('{"a":{"b":1,"b":2},"a":3}'))].sort(), ['a', 'b']);
});
probe('escaped CJK cannot hide visible text', () => {
    const userscriptSource = [
        '// @@I18N_END',
        '// @@CORE_SANITIZE_END',
        "class Panel { _getThemeModeLabel() { return '\\u5f20\\u5e16'; } }"
    ].join('\n');
    const result = validateI18n({ catalogs, manifest, userscriptSource, migratedMethods: ['_getThemeModeLabel'], coreSources: {} });
    assert.equal(result.ok, false, 'escaped Chinese passed the CJK scan');
});
console.log(JSON.stringify({ baseline: '1513b7c', probes: results.length,
    passed: results.filter(result => result.pass).length, results }, null, 2));
process.exitCode = results.some(result => !result.pass) ? 1 : 0;
