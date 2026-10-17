import test from 'node:test';
import assert from 'node:assert/strict';
import { requireCiGate } from '../scripts/ci-gate.mjs';

function needs(affected = true) {
    return {
        changes: { result: 'success', outputs: Object.fromEntries(['userscript', 'website', 'storefront'].map(key => [key, String(affected)])) },
        ...Object.fromEntries(['userscript', 'website', 'storefront-quality', 'storefront-browser'].map(key => [key, { result: affected ? 'success' : 'skipped' }])),
    };
}

test('CI gate accepts passing affected jobs and intentional skips', () => {
    requireCiGate(needs());
    requireCiGate(needs(false));
    const mixed = needs(false);
    mixed.changes.outputs.website = 'true';
    mixed.website.result = 'success';
    requireCiGate(mixed);
});

test('CI gate rejects failed detection, missing flags and every unsuccessful affected job', () => {
    for (const job of ['changes', 'userscript', 'website', 'storefront-quality', 'storefront-browser']) {
        for (const result of ['failure', 'cancelled', 'skipped', undefined]) {
            const input = needs();
            input[job].result = result;
            assert.throws(() => requireCiGate(input));
        }
    }
    const input = needs(false);
    delete input.changes.outputs.website;
    assert.throws(() => requireCiGate(input));
    const unexpected = needs(false);
    unexpected.website.result = 'failure';
    assert.throws(() => requireCiGate(unexpected));
});
