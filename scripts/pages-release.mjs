import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const projects = {
    'ld-store': { directory: 'ld-store', origin: 'https://ldcstore.com', mount: 'app' },
    'ldstatus-pro': { directory: 'website', origin: 'https://ldspro.qzz.io', mount: 'root' },
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function parseJson(text, label) {
    try { return JSON.parse(text); }
    catch { throw new Error(`${label} returned invalid JSON`); }
}

function entryPaths(html) {
    const paths = new Set();
    for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
        if (/^<link/i.test(tag) && !/\brel=["'](?:stylesheet|modulepreload)["']/i.test(tag)) continue;
        const ref = tag.match(/\b(?:src|href)=["']([^"']+)["']/i)?.[1];
        if (!ref) continue;
        const url = new URL(ref, 'https://build.invalid/');
        if (url.origin === 'https://build.invalid') paths.add(url.pathname + url.search);
    }
    return [...paths];
}

// Only entry assets referenced by index.html are probed. No application API is called.
export function buildManifest(dist) {
    const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
    return ['/', ...entryPaths(html)].map(path => {
        const name = path === '/' ? 'index.html' : decodeURIComponent(new URL(path, 'https://build.invalid').pathname).slice(1);
        const file = resolve(dist, name);
        if (!file.startsWith(resolve(dist) + '/')) throw new Error('Entry asset is outside dist');
        const bytes = readFileSync(file);
        return { path, sha256: digest(bytes), bytes: bytes.length };
    });
}

function globalHeaders(dist) {
    const headers = {};
    let global = false;
    for (const line of readFileSync(resolve(dist, '_headers'), 'utf8').split(/\r?\n/)) {
        if (/^\S/.test(line)) global = line.trim() === '/*';
        const match = global && line.match(/^\s+([^:]+):\s*(.+)$/);
        if (match) headers[match[1].toLowerCase()] = match[2].trim();
    }
    return headers;
}

function summary(deployment) {
    return {
        id: deployment.id,
        url: deployment.url,
        commit: deployment.deployment_trigger?.metadata?.commit_hash || null,
    };
}

function requireProduction(deployment) {
    if (!deployment?.id || !deployment.url || deployment.environment !== 'production'
        || deployment.latest_stage?.name !== 'deploy' || deployment.latest_stage?.status !== 'success') {
        throw new Error('A successful canonical production deployment is required');
    }
}

function saveReceipt(path, receipt) {
    receipt.updatedAt = new Date().toISOString();
    writeFileSync(path + '.tmp', JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
    renameSync(path + '.tmp', path);
}

// Dependencies are injectable so release tests never need credentials or a real endpoint.
export async function pagesRelease(mode, target, sha, options = {}) {
    const root = options.root || repositoryRoot;
    const request = options.request || fetch;
    const run = options.run || spawnSync;
    const delay = options.delay || sleep;
    let receiptPath, receipt;
    if (mode === 'verify') {
        receiptPath = resolve(target);
        receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
        target = receipt.project;
        sha = receipt.commit;
    } else if (mode !== 'deploy') throw new Error('Use deploy <project> <SHA> or verify <receipt.json>');
    const project = projects[target];
    if (!project || !/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('Invalid project or full Git SHA');
    const cwd = resolve(root, project.directory);
    const packageJson = JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8'));
    const version = packageJson.devDependencies.wrangler;
    const installed = JSON.parse(readFileSync(resolve(cwd, 'node_modules/wrangler/package.json'), 'utf8')).version;
    if (!/^\d+\.\d+\.\d+$/.test(version) || installed !== version) throw new Error('Run npm ci: Wrangler must match the pinned version');
    const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
    const wrangler = (args, extraEnv = {}, inherit = false) => {
        const result = run(process.execPath, [resolve(cwd, 'node_modules/wrangler/bin/wrangler.js'), ...args], {
            cwd, env: { ...env, ...extraEnv }, encoding: 'utf8',
            stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
        });
        // Never include captured auth output or provider response bodies in errors/receipts.
        if (result.error || result.status !== 0) throw new Error(`Wrangler ${args.slice(0, 2).join(' ')} failed`);
        return result.stdout;
    };
    const auth = parseJson(wrangler(['auth', 'token', '--json']), 'Wrangler auth');
    if (!['oauth', 'api_token'].includes(auth.type) || !auth.token) throw new Error('Wrangler OAuth login or CLOUDFLARE_API_TOKEN is required');
    let accountId = env.CLOUDFLARE_ACCOUNT_ID;
    if (!accountId) {
        const { accounts } = parseJson(wrangler(['whoami', '--json']), 'Wrangler whoami');
        if (accounts?.length !== 1) throw new Error('Set CLOUDFLARE_ACCOUNT_ID to select the production account');
        accountId = accounts[0].id;
    }
    if (!/^[0-9a-f]{32}$/i.test(accountId)) throw new Error('Invalid Cloudflare account ID');
    env.CLOUDFLARE_ACCOUNT_ID = accountId;
    const projectUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${target}`;
    const getProject = async () => {
        const response = await request(projectUrl, {
            method: 'GET', headers: { Authorization: `Bearer ${auth.token}` },
            redirect: 'error', signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`Cloudflare project query returned HTTP ${response.status}`);
        const body = parseJson(await response.text(), 'Cloudflare project query');
        if (!body.success || !body.result) throw new Error('Cloudflare project query did not succeed');
        if (body.result.name !== target || body.result.production_branch !== 'main') throw new Error('Unexpected Pages project or production branch');
        return body.result;
    };
    const startedAt = new Date().toISOString();
    let outputPath;
    try {
        if (mode === 'deploy') {
            const manifest = buildManifest(resolve(cwd, 'dist'));
            const headers = globalHeaders(resolve(cwd, 'dist'));
            if (manifest.length < 2 || !Object.keys(headers).length) throw new Error('Missing entry assets or global security headers');
            const before = await getProject();
            requireProduction(before.canonical_deployment);
            const previous = summary(before.canonical_deployment);
            const directory = resolve(cwd, '.release-receipts');
            mkdirSync(directory, { recursive: true, mode: 0o700 });
            receiptPath = resolve(directory, `${startedAt.replaceAll(':', '-')}-${sha.slice(0, 12)}-${randomUUID().slice(0, 8)}.json`);
            outputPath = receiptPath + '.wrangler.jsonl';
            receipt = {
                project: target, commit: sha, wrangler: version, startedAt, state: 'prepared',
                accountId, origin: project.origin, manifest, headers, deployment: null,
                rollback: {
                    ...previous,
                    dashboardUrl: `https://dash.cloudflare.com/${accountId}/pages/view/${target}/${previous.id}`,
                    method: 'POST', apiUrl: `${projectUrl}/deployments/${previous.id}/rollback`,
                },
            };
            if (target === 'ld-store') {
                const artifact = resolve(cwd, `.private-artifacts/ldstore-web-${sha.slice(0, 12)}.tar.gz`);
                receipt.sourceMaps = { path: relative(cwd, artifact), sha256: digest(readFileSync(artifact)) };
            }
            saveReceipt(receiptPath, receipt);
            console.log(`Release receipt: ${receiptPath}`);
            const guard = run(process.execPath, [resolve(root, 'scripts/verify-pages-release.mjs'), sha], { cwd, env, stdio: ['ignore', 'ignore', 'inherit'] });
            if (guard.error || guard.status !== 0) throw new Error('Release guard failed before upload');
            receipt.state = 'deploying';
            saveReceipt(receiptPath, receipt);
            writeFileSync(outputPath, '', { mode: 0o600 });
            let uploadError;
            try {
                wrangler(['pages', 'deploy', 'dist', `--project-name=${target}`, '--branch=main', `--commit-hash=${sha}`, '--commit-dirty=false'], { WRANGLER_OUTPUT_FILE_PATH: outputPath }, true);
            } catch (error) { uploadError = error; }
            const contents = readFileSync(outputPath, 'utf8').trim();
            let output = [];
            try {
                output = contents ? contents.split('\n').map(line => parseJson(line, 'Wrangler deployment output')) : [];
            } catch (error) {
                if (!uploadError) throw error;
            }
            const deployment = output.find(entry => entry.type === 'pages-deploy-detailed');
            if (deployment?.pages_project !== target || deployment.environment !== 'production'
                || deployment.deployment_trigger?.metadata?.commit_hash !== sha || !deployment.deployment_id) {
                throw uploadError || new Error('Wrangler output does not identify the expected production deployment');
            }
            receipt.deployment = { id: deployment.deployment_id, url: deployment.url, commit: sha };
            if (uploadError) throw uploadError;
        } else if (receipt.accountId !== accountId || receipt.origin !== project.origin || !receipt.deployment?.id
            || !Array.isArray(receipt.manifest) || receipt.manifest.length < 2 || !receipt.manifest.some(asset => asset.path === '/')
            || !receipt.headers || Object.keys(receipt.headers).length === 0) {
            throw new Error('Receipt account, origin or deployment does not match');
        }

        receipt.state = 'verifying';
        receipt.error = null;
        receipt.verification = { startedAt, attempts: 0, checks: [] };
        saveReceipt(receiptPath, receipt);
        // Bounded retries allow the canonical deployment and public aliases to propagate.
        for (let attempt = 1; attempt <= 6; attempt++) {
            receipt.verification.attempts = attempt;
            receipt.verification.checks = [];
            try {
                const current = await getProject();
                requireProduction(current.canonical_deployment);
                const active = summary(current.canonical_deployment);
                if (active.id !== receipt.deployment.id || active.commit !== sha) throw new Error('Canonical production deployment does not match this release');
                const deploymentUrl = new URL(receipt.deployment.url);
                if (deploymentUrl.protocol !== 'https:' || !deploymentUrl.hostname.endsWith(`.${target}.pages.dev`)) throw new Error('Unexpected deployment URL');
                for (const origin of [deploymentUrl.origin, project.origin]) {
                    for (const asset of receipt.manifest) {
                        const url = new URL(asset.path, origin);
                        if (url.origin !== origin) throw new Error('Receipt asset must be same-origin');
                        const response = await request(url.href, {
                            method: 'GET', redirect: 'error', cache: 'no-store',
                            headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15_000),
                        });
                        const bytes = Buffer.from(await response.arrayBuffer());
                        const actual = digest(bytes);
                        const contentType = response.headers.get('content-type') || '';
                        const check = { url: url.href, status: response.status, contentType, sha256: actual, expectedSha256: asset.path === '/' ? null : asset.sha256, checkedAt: new Date().toISOString() };
                        receipt.verification.checks.push(check);
                        if (response.status !== 200 || (asset.path !== '/' && actual !== asset.sha256)) throw new Error(`Resource verification failed: ${url.href}`);
                        if (asset.path === '/') {
                            // The storefront Worker rewrites metadata. Validate the app shell
                            // and exact entry references, then hash the referenced assets.
                            const html = bytes.toString('utf8');
                            const expected = receipt.manifest.filter(item => item.path !== '/').map(item => item.path).sort();
                            if (!contentType.includes('text/html') || !new RegExp(`<div\\b[^>]*\\bid=["']${project.mount}["']`, 'i').test(html)
                                || entryPaths(html).sort().join('\n') !== expected.join('\n')) throw new Error(`HTML entry verification failed: ${url.href}`);
                            check.headers = Object.fromEntries(Object.keys(receipt.headers).map(name => [name, response.headers.get(name)]));
                            for (const [name, value] of Object.entries(receipt.headers)) {
                                if (response.headers.get(name) !== value) throw new Error(`Header verification failed: ${name} at ${url.href}`);
                            }
                        } else if ((url.pathname.endsWith('.css') && !contentType.includes('text/css'))
                            || (url.pathname.endsWith('.js') && !/(?:text|application)\/javascript/.test(contentType))) {
                            throw new Error(`Content type verification failed: ${url.href}`);
                        }
                    }
                }
                const after = (await getProject()).canonical_deployment;
                requireProduction(after);
                if (after.id !== active.id || summary(after).commit !== sha) throw new Error('Production deployment changed during verification');
                receipt.state = 'verified';
                receipt.verification.lastError = null;
                receipt.verification.completedAt = new Date().toISOString();
                saveReceipt(receiptPath, receipt);
                console.log(`Pages release verified: ${target} ${sha}\nReceipt: ${receiptPath}`);
                return receiptPath;
            } catch (error) {
                receipt.verification.lastError = error.message;
                saveReceipt(receiptPath, receipt);
                if (attempt === 6) throw error;
                await delay(5_000);
            }
        }
    } catch (error) {
        if (receiptPath && receipt) {
            receipt.state = 'failed';
            receipt.error = error.message;
            saveReceipt(receiptPath, receipt);
            console.error(`Release failed; inspect receipt and rollback information: ${receiptPath}`);
        }
        throw error;
    } finally {
        if (outputPath && existsSync(outputPath)) rmSync(outputPath);
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    pagesRelease(...process.argv.slice(2)).catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
