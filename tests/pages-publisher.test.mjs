import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pagesRelease, buildManifest } from '../scripts/pages-release.mjs';
import { injectMetadataIntoHtml, resolvePageMetadata } from '../ld-store/public/_worker.js';

globalThis.fetch = async () => { throw new Error('Network disabled in release tests; use the injected request'); };

const sha = 'a'.repeat(40);
const account = 'b'.repeat(32);
const deploymentId = 'new-deployment';

function fixture(project = 'ld-store', overrides = {}) {
    const root = mkdtempSync(resolve(tmpdir(), 'ldsp-publisher-'));
    const cwd = resolve(root, project === 'ld-store' ? project : 'website');
    const files = {
        '/': `<!doctype html><div id="${project === 'ld-store' ? 'app' : 'root'}"></div><script type="module" src="/assets/app.js"></script><link href="/assets/app.css" rel="stylesheet"><script src="https://external.invalid/ignore.js"></script>`,
        '/assets/app.js': '/* isolated JS */', '/assets/app.css': 'body{color:black}',
    };
    for (const dir of ['dist/assets', 'node_modules/wrangler', '.private-artifacts']) mkdirSync(resolve(cwd, dir), { recursive: true });
    for (const [path, content] of Object.entries(files)) writeFileSync(resolve(cwd, path === '/' ? 'dist/index.html' : 'dist' + path), content);
    writeFileSync(resolve(cwd, 'dist/_headers'), '/*\n  X-Content-Type-Options: nosniff\n/assets/*\n  Cache-Control: immutable\n');
    writeFileSync(resolve(cwd, 'package.json'), JSON.stringify({ devDependencies: { wrangler: '4.151.1' } }));
    writeFileSync(resolve(cwd, 'node_modules/wrangler/package.json'), '{"version":"4.151.1"}');
    writeFileSync(resolve(cwd, `.private-artifacts/ldstore-web-${sha.slice(0, 12)}.tar.gz`), 'isolated source maps');
    const calls = [], http = [];
    let deployed = false, queries = 0;
    const canonical = id => ({
        id, url: `https://${id}.${project}.pages.dev`, environment: 'production',
        latest_stage: { name: 'deploy', status: 'success' },
        deployment_trigger: { metadata: { commit_hash: id === deploymentId ? sha : 'c'.repeat(40) } },
    });
    const run = (_bin, args, settings) => {
        calls.push(args);
        if (args[0].endsWith('verify-pages-release.mjs')) return { status: overrides.guardFailure ? 1 : 0 };
        assert.equal(args[0], resolve(cwd, 'node_modules/wrangler/bin/wrangler.js'));
        if (args[1] === 'auth') return { status: 0, stdout: overrides.invalidAuth ? 'fixture-private-token not json' : JSON.stringify({ type: 'oauth', token: 'fixture-private-token' }) };
        if (args[1] === 'whoami') return { status: 0, stdout: JSON.stringify({ accounts: overrides.multipleAccounts ? [{ id: account }, { id: 'd'.repeat(32) }] : [{ id: account }] }) };
        assert.deepEqual(args.slice(1), ['pages', 'deploy', 'dist', `--project-name=${project}`, '--branch=main', `--commit-hash=${sha}`, '--commit-dirty=false']);
        assert.equal(settings.env.CLOUDFLARE_ACCOUNT_ID, account);
        deployed = true;
        if (!overrides.missingOutput) writeFileSync(settings.env.WRANGLER_OUTPUT_FILE_PATH, JSON.stringify({
            type: 'pages-deploy-detailed', version: 1, pages_project: project,
            deployment_id: deploymentId, url: canonical(deploymentId).url, environment: 'production',
            deployment_trigger: { metadata: { commit_hash: overrides.wrongCommit ? 'd'.repeat(40) : sha } },
        }) + '\n');
        return { status: overrides.uploadFailure ? 1 : 0 };
    };
    const request = async (url, settings) => {
        http.push({ url, settings });
        assert.equal(settings.method, 'GET');
        if (url.startsWith('https://api.cloudflare.com/')) {
            assert.equal(settings.headers.Authorization, 'Bearer fixture-private-token');
            queries++;
            if (overrides.apiFailure) return new Response('{}', { status: 403 });
            const active = deployed && !(overrides.staleCanonical || overrides.propagation && queries < 3) ? deploymentId : 'previous-production';
            return Response.json({ success: true, result: {
                name: project, production_branch: overrides.wrongBranch ? 'preview' : 'main',
                canonical_deployment: overrides.noPrevious && !deployed ? null : canonical(overrides.changedDuringVerification && queries >= 3 ? 'concurrent-release' : active),
                // A more recent preview must never become the rollback target.
                latest_deployment: canonical('unrelated-preview'),
                env_vars: { SHOULD_NOT_BE_SAVED: { value: 'fixture-private-value' } },
            } });
        }
        assert.equal(settings.headers.Authorization, undefined);
        const path = new URL(url).pathname;
        assert.ok(path in files, 'Only static entry resources may be probed');
        const contentType = path === '/' ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'text/javascript';
        const body = overrides.rewriteHtml && path === '/' ? injectMetadataIntoHtml(files[path], await resolvePageMetadata(new URL('https://ldcstore.com/'))) : files[path];
        return new Response(overrides.hashMismatch && path !== '/' ? 'stale-resource' : overrides.htmlMissingMount && path === '/' ? '<html>maintenance</html>' : body, {
            status: overrides.status || 200,
            headers: { 'Content-Type': overrides.wrongMime || overrides.assetWrongMime && path !== '/' ? 'text/plain' : contentType, ...overrides.missingHeader ? {} : { 'X-Content-Type-Options': 'nosniff' } },
        });
    };
    const options = { root, run, request, delay: async () => {} };
    const receipt = () => {
        const dir = resolve(cwd, '.release-receipts');
        return JSON.parse(readFileSync(resolve(dir, readdirSync(dir).find(name => name.endsWith('.json'))), 'utf8'));
    };
    return { root, cwd, calls, http, options, receipt, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('both projects write a private receipt with actual canonical rollback target, hashes and GET-only verification', async () => {
    for (const project of ['ld-store', 'ldstatus-pro']) {
        const f = fixture(project, { rewriteHtml: true });
        try {
            assert.equal(buildManifest(resolve(f.cwd, 'dist')).length, 3);
            const path = await pagesRelease('deploy', project, sha, f.options);
            const receipt = f.receipt();
            assert.equal(receipt.state, 'verified');
            assert.equal(receipt.rollback.id, 'previous-production');
            assert.equal(receipt.rollback.method, 'POST');
            assert.match(receipt.rollback.apiUrl, /previous-production\/rollback$/);
            assert.equal(receipt.deployment.id, deploymentId);
            assert.equal(receipt.verification.checks.length, 6);
            assert.equal(receipt.verification.attempts, 1);
            assert.equal(receipt.sourceMaps?.path, project === 'ld-store' ? `.private-artifacts/ldstore-web-${sha.slice(0, 12)}.tar.gz` : undefined);
            const content = readFileSync(path, 'utf8');
            assert.doesNotMatch(content, /fixture-private|env_vars|Authorization/);
            assert.equal(statSync(path).mode & 0o777, 0o600);
            assert.equal(f.calls.filter(args => args[1] === 'pages').length, 1);
            assert.equal(readdirSync(resolve(f.cwd, '.release-receipts')).length, 1);
            const before = f.calls.length;
            await pagesRelease('verify', path, undefined, f.options);
            assert.equal(f.calls.slice(before).filter(args => args[1] === 'pages' || args[0].endsWith('verify-pages-release.mjs')).length, 0);
        } finally { f.cleanup(); }
    }
});

test('rejects unsafe preflight or changed checkout without deploying', async () => {
    for (const overrides of [{ noPrevious: true }, { wrongBranch: true }, { apiFailure: true }, { guardFailure: true }, { invalidAuth: true }, { multipleAccounts: true }]) {
        const f = fixture('ld-store', overrides);
        try {
            await assert.rejects(pagesRelease('deploy', 'ld-store', sha, f.options), error => !error.message.includes('fixture-private'));
            assert.equal(f.calls.filter(args => args[1] === 'pages').length, 0);
        } finally { f.cleanup(); }
    }
});

test('failed upload or verification exits with failed receipt and rollback details, never redeploys or rolls back', async () => {
    for (const overrides of [
        { uploadFailure: true }, { uploadFailure: true, missingOutput: true }, { missingOutput: true }, { wrongCommit: true },
        { hashMismatch: true }, { missingHeader: true }, { wrongMime: true }, { assetWrongMime: true },
        { htmlMissingMount: true }, { status: 503 }, { staleCanonical: true }, { changedDuringVerification: true },
    ]) {
        const f = fixture('ld-store', overrides);
        try {
            await assert.rejects(pagesRelease('deploy', 'ld-store', sha, f.options));
            const receipt = f.receipt();
            assert.equal(receipt.state, 'failed');
            assert.ok(receipt.error);
            assert.equal(receipt.rollback.id, 'previous-production');
            if (overrides.uploadFailure) {
                assert.match(receipt.error, /Wrangler pages deploy failed/);
                assert.equal(receipt.deployment?.id, overrides.missingOutput ? undefined : deploymentId);
            }
            assert.equal(f.calls.filter(args => args[1] === 'pages').length, 1);
            assert.ok(f.http.every(call => call.settings.method === 'GET'));
            assert.doesNotMatch(JSON.stringify(receipt), /fixture-private/);
        } finally { f.cleanup(); }
    }
});

test('retries read-only checks for propagation and clears previous verification errors', async () => {
    const f = fixture('ldstatus-pro', { propagation: true });
    try {
        await pagesRelease('deploy', 'ldstatus-pro', sha, f.options);
        assert.equal(f.receipt().verification.attempts, 2);
        assert.equal(f.receipt().verification.lastError, null);
        assert.equal(f.calls.filter(args => args[1] === 'pages').length, 1);
    } finally { f.cleanup(); }
});

test('pinned Wrangler mismatch and incomplete verification receipt fail closed', async () => {
    const f = fixture();
    try {
        const path = await pagesRelease('deploy', 'ld-store', sha, f.options);
        const receipt = f.receipt();
        receipt.manifest = [];
        writeFileSync(path, JSON.stringify(receipt));
        await assert.rejects(pagesRelease('verify', path, undefined, f.options));
        writeFileSync(resolve(f.cwd, 'node_modules/wrangler/package.json'), '{"version":"0.0.1"}');
        const before = f.calls.length;
        await assert.rejects(pagesRelease('deploy', 'ld-store', sha, f.options));
        assert.equal(f.calls.length, before);
    } finally { f.cleanup(); }
});
