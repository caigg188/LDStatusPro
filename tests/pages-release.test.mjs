import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { requireSuccessfulCi } from '../scripts/verify-pages-release.mjs';

const sha = 'a'.repeat(40);
const run = { databaseId: 1, headSha: sha, headBranch: 'main', event: 'push', status: 'completed', conclusion: 'success' };
const jobs = [{ name: 'CI gate', status: 'completed', conclusion: 'success' }];

test('release requires matching main push CI and an actual successful gate', () => {
    requireSuccessfulCi(run, jobs, sha);
    for (const patch of [{ headSha: 'b'.repeat(40) }, { headBranch: 'feature' }, { event: 'pull_request' }, { status: 'in_progress' }, { conclusion: 'failure' }, { conclusion: 'cancelled' }]) {
        assert.throws(() => requireSuccessfulCi({ ...run, ...patch }, jobs, sha));
    }
    for (const invalidJobs of [[], [{ ...jobs[0], conclusion: 'skipped' }], [{ ...jobs[0], conclusion: 'failure' }]]) {
        assert.throws(() => requireSuccessfulCi(run, invalidJobs, sha));
    }
    assert.throws(() => requireSuccessfulCi(undefined, jobs, sha));
});

test('local deployment guards and both entrypoints run without network or real credentials', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'ldsp-release-test-')));
    try {
        mkdirSync(join(dir, 'bin'));
        mkdirSync(join(dir, 'scripts'));
        const guard = join(dir, 'scripts/verify-pages-release.mjs');
        copyFileSync(new URL('../scripts/verify-pages-release.mjs', import.meta.url), guard);
        const mock = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const name = path.basename(process.argv[1]);
const args = process.argv.slice(2).join(' ');
fs.appendFileSync(process.env.LOG, name + ' ' + args + '\\n');
const fixture = JSON.parse(process.env.FIXTURE);
if (name === 'git') {
  const responses = {'remote get-url origin': 'git@github.com:caigg188/LDStatusPro.git', 'branch --show-current': 'main', 'status --porcelain': '', 'fetch origin main': '', 'rev-parse HEAD': '${sha}', 'rev-parse origin/main': '${sha}', ...fixture.git};
  if (!(args in responses)) process.exit(91);
  console.log(responses[args]);
} else if (name === 'gh') {
  if (fixture.apiFailure) process.exit(1);
  console.log(JSON.stringify(args.startsWith('run list ') ? (fixture.runs || [${JSON.stringify(run)}]) : {jobs: fixture.jobs || ${JSON.stringify(jobs)}}));
} else if (name === 'npm') {
  fs.mkdirSync('dist/assets', {recursive:true});
  fs.writeFileSync('dist/assets/app.js', '/* isolated fixture */');
  if (fixture.drift && args === 'run check:artifact') {
    fixture.git = {'rev-parse HEAD': 'b'.repeat(40), 'rev-parse origin/main': 'b'.repeat(40)};
    fs.writeFileSync(process.env.DRIFT, JSON.stringify(fixture));
  }
} else if (name !== 'npx') process.exit(92);
`;
        // Drift persists between subprocesses, without modifying a Git checkout.
        const code = mock.replace('const fixture = JSON.parse(process.env.FIXTURE);', 'const fixture = JSON.parse(fs.existsSync(process.env.DRIFT) ? fs.readFileSync(process.env.DRIFT) : process.env.FIXTURE);');
        for (const name of ['git', 'gh', 'npm', 'npx']) writeFileSync(join(dir, 'bin', name), code, { mode: 0o755 });
        const env = fixture => ({ PATH: `${join(dir, 'bin')}:${dirname(process.execPath)}:/usr/bin:/bin`, HOME: dir, LOG: join(dir, 'log'), DRIFT: join(dir, 'drift'), FIXTURE: JSON.stringify(fixture), VITE_FARO_API_KEY: 'isolated-test-identifier' });
        const verify = (fixture, args = []) => spawnSync(process.execPath, [guard, ...args], { env: env(fixture), encoding: 'utf8' });
        const success = verify({});
        assert.equal(success.status, 0, success.stderr);
        assert.equal(success.stdout.trim(), sha);
        for (const fixture of [
            { git: { 'branch --show-current': 'feature' } },
            { git: { 'status --porcelain': ' M file' } },
            { git: { 'remote get-url origin': 'https://github.com/other/repo.git' } },
            { git: { 'rev-parse origin/main': 'b'.repeat(40) } },
            { runs: [] }, { runs: [{ ...run, conclusion: 'failure' }] },
            { jobs: [] }, { apiFailure: true },
        ]) assert.notEqual(verify(fixture).status, 0, JSON.stringify(fixture));
        assert.notEqual(verify({}, ['b'.repeat(40)]).status, 0);
        assert.notEqual(spawnSync(process.execPath, [guard], { env: { ...env({}), GITHUB_ACTIONS: 'true' } }).status, 0);

        for (const project of ['ld-store', 'website']) {
            const target = join(dir, project, 'scripts');
            mkdirSync(target, { recursive: true });
            const script = join(target, 'deploy-pages-production.sh');
            copyFileSync(new URL(`../${project}/scripts/deploy-pages-production.sh`, import.meta.url), script);
            writeFileSync(join(dir, 'log'), '');
            const result = spawnSync('/bin/bash', [script], { env: env({}), encoding: 'utf8' });
            assert.equal(result.status, 0, result.stderr);
            const log = readFileSync(join(dir, 'log'), 'utf8');
            assert.match(log, new RegExp('--commit-hash=' + sha + ' --commit-dirty=false'));
            assert.doesNotMatch(log, /npm run (test|check)(\s|$)/);
            assert.equal(log.match(/gh run list/g).length, 2);
        }
        writeFileSync(join(dir, 'log'), '');
        const drift = spawnSync('/bin/bash', [join(dir, 'ld-store/scripts/deploy-pages-production.sh')], { env: env({ drift: true }), encoding: 'utf8' });
        assert.notEqual(drift.status, 0);
        assert.match(drift.stderr, /HEAD changed during the release/);
        assert.doesNotMatch(readFileSync(join(dir, 'log'), 'utf8'), /npx/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
