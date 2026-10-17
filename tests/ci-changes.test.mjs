import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('workflow change detection includes website dependencies and shared release tooling', () => {
    const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
    const body = workflow.split('        run: |\n')[1].split('\n  userscript:')[0];
    const dir = mkdtempSync(join(tmpdir(), 'ldsp-ci-changes-'));
    try {
        // Only the diff output is substituted; no repository or network is touched.
        writeFileSync(join(dir, 'git'), '#!/bin/sh\nif [ "$1" = diff ]; then printf "%s\\n" "$CHANGED_FILES"; fi\n', { mode: 0o755 });
        for (const [files, expected] of [
            ['LDStatusPro.user.js', [true, true, false]],
            ['website/src/App.tsx', [false, true, false]],
            ['ld-store/src/App.vue', [false, false, true]],
            ['scripts/verify-pages-release.mjs', [true, true, true]],
            ['.github/workflows/ci.yml', [true, true, true]],
            ['CI.md', [false, false, false]],
        ]) {
            const output = join(dir, 'output');
            writeFileSync(output, '');
            const result = spawnSync('/bin/bash', ['-c', body], {
                env: { PATH: `${dir}:/usr/bin:/bin`, EVENT_NAME: 'push', EVENT_BEFORE: 'a'.repeat(40), CHANGED_FILES: files, GITHUB_OUTPUT: output },
                encoding: 'utf8',
            });
            assert.equal(result.status, 0, result.stderr);
            assert.deepEqual(readFileSync(output, 'utf8').trim().split('\n'),
                ['userscript', 'website', 'storefront'].map((key, index) => `${key}=${expected[index]}`), files);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
