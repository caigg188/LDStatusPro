// Distribution and isolated bundle initialization, not full userscript startup.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { cpus, platform, release } from 'node:os';
import { chromium, firefox } from 'playwright';

const baseline = '7f337671ae0053d920d3241cd5a6712c01b27c00';
const old = execFileSync('git', ['show', `${baseline}:LDStatusPro.user.js`], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
});
const current = readFileSync(new URL('../../LDStatusPro.user.js', import.meta.url), 'utf8');
const block = (source, name) => {
    const start = `// @@${name}_BEGIN`, end = `// @@${name}_END`;
    if (!source.includes(start) || !source.includes(end)) throw new Error(`Missing ${name} markers`);
    return source.slice(source.indexOf(start) + start.length, source.indexOf(end)).trim();
};
const samples = {
    baselineCore: block(old, 'CORE_SANITIZE'),
    currentCore: block(current, 'CORE_SANITIZE'),
    currentI18n: block(current, 'I18N')
};
samples.currentCombined = samples.currentCore + '\n' + samples.currentI18n;
const size = text => ({ bytes: Buffer.byteLength(text), gzipBytes: gzipSync(text).length });
const result = {
    measuredAt: new Date().toISOString(), baseline,
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    environment: { node: process.version, os: `${platform()} ${release()}`, cpu: cpus()[0].model },
    method: '5 warmups, 30 samples; new Function parse/compile and invocation measured separately. Warm engine/cache, isolated embedded declarations, no application boot/network/manager. Not cold startup or real-device latency.',
    distribution: { baselineUserscript: size(old), currentUserscript: size(current), ...Object.fromEntries(Object.entries(samples).map(([key, text]) => [key, size(text)])) },
    browsers: {}
};
for (const [name, engine] of Object.entries({ chromium, firefox })) {
    const browser = await engine.launch(name === 'chromium' ? { channel: 'chromium' } : {});
    try {
        const page = await browser.newPage();
        result.browsers[name] = { version: browser.version(), timings: await page.evaluate(samples => {
            const summary = values => {
                values.sort((a, b) => a - b);
                return { medianMs: values[Math.floor(values.length / 2)], p95Ms: values[Math.ceil(values.length * 0.95) - 1] };
            };
            return Object.fromEntries(Object.entries(samples).map(([key, code]) => {
                const compile = [], initialize = [];
                for (let i = 0; i < 35; i++) {
                    const start = performance.now();
                    const fn = new Function(code);
                    const parsed = performance.now();
                    fn();
                    const end = performance.now();
                    if (i >= 5) { compile.push(parsed - start); initialize.push(end - parsed); }
                }
                return [key, { compile: summary(compile), initialize: summary(initialize) }];
            }));
        }, samples) };
    } finally { await browser.close(); }
}
const out = process.argv[2];
if (out) writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
