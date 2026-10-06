import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
    buildReleaseBody,
    extractReadmeNotes,
    isReleaseVersion,
    readUserscriptVersion
} from '../scripts/release-notes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('readUserscriptVersion reads the metadata header', () => {
    assert.equal(readUserscriptVersion('// @version      3.9.0.6\n'), '3.9.0.6');
    assert.equal(readUserscriptVersion('// @name x\n'), '');
});

test('isReleaseVersion accepts dotted product versions', () => {
    assert.equal(isReleaseVersion('3.9.0.6'), true);
    assert.equal(isReleaseVersion('3.9.0'), true);
    assert.equal(isReleaseVersion('v3.9.0.6'), false);
    assert.equal(isReleaseVersion('3.9.0.6-beta'), false);
});

test('extractReadmeNotes returns the matching version section', () => {
    const readme = `## 更新日志\n\n### v3.9.0.6\n\n- first\n- second\n\n### v3.9.0.3\n\n- old\n`;
    assert.equal(extractReadmeNotes(readme, '3.9.0.6'), '- first\n- second');
    assert.equal(extractReadmeNotes(readme, '9.9.9'), '');
});

test('userscript version has a README changelog section', () => {
    const version = readUserscriptVersion(fs.readFileSync(path.join(root, 'LDStatusPro.user.js'), 'utf8'));
    assert.equal(isReleaseVersion(version), true);
    const notes = extractReadmeNotes(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), version);
    assert.ok(notes.length > 0, `README.md missing ### v${version} notes`);
});

test('buildReleaseBody includes install link and changelog', () => {
    const body = buildReleaseBody({
        version: '3.9.0.6',
        notes: '- harden bridges',
        repository: 'caigg188/LDStatusPro'
    });
    assert.match(body, /v3\.9\.0\.6 更新内容/);
    assert.match(body, /- harden bridges/);
    assert.match(body, /raw\.githubusercontent\.com\/caigg188\/LDStatusPro\/main\/LDStatusPro\.user\.js/);
});
