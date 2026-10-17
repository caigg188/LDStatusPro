import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function requireCiGate(needs) {
    if (needs.changes?.result !== 'success') throw new Error('Change detection did not succeed');
    const outputs = needs.changes.outputs;
    for (const [job, component] of Object.entries({
        userscript: 'userscript',
        website: 'website',
        'storefront-quality': 'storefront',
        'storefront-browser': 'storefront',
    })) {
        const affected = outputs?.[component];
        if (affected !== 'true' && affected !== 'false') throw new Error(`Missing change flag: ${component}`);
        const expected = affected === 'true' ? 'success' : 'skipped';
        if (needs[job]?.result !== expected) throw new Error(`${job}: expected ${expected}, got ${needs[job]?.result}`);
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    requireCiGate(JSON.parse(process.env.CI_NEEDS));
    console.log('All affected checks passed');
}
