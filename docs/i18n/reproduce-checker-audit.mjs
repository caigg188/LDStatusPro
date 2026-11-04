// In-memory mutations only. Never updates catalogs or the review manifest.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadDiskCatalogs, validateI18n, buildReviewManifest } from '../../scripts/check-i18n.mjs';

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
probe('manifest regeneration cannot approve unchanged English automatically', () => {
    const result = validateI18n({ catalogs: changed, manifest: buildReviewManifest(changed['zh-CN']) });
    assert.equal(result.ok, false, 'changed Chinese + unchanged English + regenerated manifest passes');
});
probe('conditional missing keys are rejected', () => {
    const original = "I18n.t('common.time.justNow')";
    assert.ok(source.includes(original));
    const mutated = source.replace(original, "I18n.t(true ? 'audit.missingKey' : 'common.time.justNow')");
    assert.equal(validateI18n({ catalogs, manifest, userscriptSource: mutated }).ok, false,
        'missing key in conditional expression passes');
});
console.log(JSON.stringify({ baseline: '1513b7c', probes: results.length,
    passed: results.filter(result => result.pass).length, results }, null, 2));
process.exitCode = results.some(result => !result.pass) ? 1 : 0;
