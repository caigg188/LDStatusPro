// Read-only audit probes for baseline 1513b7c. Failures describe expected contracts.
// Run from any directory: node docs/i18n/reproduce-audit.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createTranslator, CATALOGS } from '../../src/i18n/index.mjs';
import { CORE_TEXT } from '../../src/core/messages.mjs';
import { prepareExportHTML, ExportResources } from '../../src/core/topic-export.mjs';
import { TopicContentClient } from '../../src/core/topic-content.mjs';
import { componentWindow } from '../../tests/helpers/topic-fixture.mjs';

const results = [];
async function probe(name, run) {
    try { const observed = await run(); results.push({ name, pass: true, observed }); }
    catch (error) { results.push({ name, pass: false, error: error.message }); }
}
await probe('control: normal core URL errors translate correctly', async () => {
    const { normalizeApiUrl } = await import('../../src/core/topic-ai.mjs');
    assert.throws(() => normalizeApiUrl('invalid', createTranslator('en-US').t), /URL must start/);
});
for (const locale of ['zh-CN', 'en-US']) {
    await probe(`media labels resolve in ${locale}`, async () => {
        const dom = new JSDOM('');
        try {
            const html = await prepareExportHTML('<audio></audio><img src="javascript:bad">', {
                document: dom.window.document, origin: 'https://linux.do', t: createTranslator(locale).t
            });
            assert.ok(!html.includes('https://linux.do.media.'), html);
        } finally { dom.window.close(); }
    });
}
await probe('standalone core has complete Chinese fallbacks', () => {
    const missing = [];
    for (const [domain, entries] of Object.entries(CATALOGS['zh-CN'].core)) {
        for (const key of Object.keys(entries)) if (!Object.hasOwn(CORE_TEXT, `core.${domain}.${key}`)) missing.push(`core.${domain}.${key}`);
    }
    assert.deepEqual(missing, []);
});
await probe('standalone topic progress is readable Chinese', async () => {
    const progress = [];
    const client = new TopicContentClient({ origin: 'https://linux.do', now: () => 0,
        wait: async () => {}, interval: 0, jitter: () => 0,
        fetchImpl: async () => new Response(JSON.stringify({ id: 42, post_stream: { posts: [] } })) });
    client.nextRequest = 1000;
    await client.getTopic(42, { onProgress: state => progress.push(state) });
    assert.ok(!JSON.stringify(progress).includes('core.progress.'), JSON.stringify(progress));
});
await probe('forum access errors follow en-US', async () => {
    const client = new TopicContentClient({ origin: 'https://linux.do', t: createTranslator('en-US').t,
        fetchImpl: async () => new Response('{}', { status: 403 }) });
    await assert.rejects(client.getTopic(42), error => {
        assert.doesNotMatch(error.message, /[\u3400-\u9fff]/);
        return error.status === 403;
    });
});
await probe('image failures and progress follow en-US', async () => {
    const dom = new JSDOM('');
    const progress = [];
    try {
        const resources = new ExportResources({ origin: 'https://linux.do', document: dom.window.document,
            t: createTranslator('en-US').t, interval: 0, onProgress: state => progress.push(state),
            gm: options => { queueMicrotask(() => options.onerror()); return { abort() {} }; } });
        await resources.embed('https://images.invalid/a.png');
        assert.doesNotMatch(JSON.stringify({ warnings: resources.warnings, progress }), /[\u3400-\u9fff]/);
    } finally { dom.window.close(); }
});
const fixture = componentWindow();
try {
    const { window, panel, renderer } = fixture;
    window.I18n.setLocale('en-US');
    const exporter = new window.TopicExporter(panel, renderer);
    const data = { topic: { id: 42, title: 'A & B <topic>', views: 1234 },
        exportDate: '2026-11-02T12:00:00Z', postCount: 1, range: { start: 1, end: 1 }, warnings: [],
        posts: [{ postNumber: 1, author: { username: 'alice', name: 'Alice' },
            timestamp: '2026-11-01T10:00:00Z', content: '<p class="spoiler">Original post</p>', likeCount: 0 }] };
    await probe('localization test calls _genHTML unconditionally', () => {
        const testSource = readFileSync(new URL('../../tests/panel-topic-tools-i18n.test.mjs', import.meta.url), 'utf8');
        assert.ok(!testSource.includes('_genHtml'), 'test still references the nonexistent _genHtml');
        assert.ok(testSource.includes('exporter._genHTML(fixture)'), 'test does not call the real _genHTML');
        assert.ok(!testSource.includes('if (report.html)'), 'HTML assertions can still be skipped');
    });
    const document = new JSDOM(exporter._genHTML(data)).window.document;
    await probe('control: export preserves post content and sets document language', () => {
        assert.equal(document.documentElement.lang, 'en-US');
        assert.equal(document.querySelector('.post-content').textContent, 'Original post');
    });
    await probe('export title escapes once', () => {
        assert.ok(document.title.includes('A & B <topic>'), document.title);
    });
    await probe('HTML dates follow en-US', () => {
        assert.equal(document.querySelector('.post-time').textContent,
            new Date(data.posts[0].timestamp).toLocaleString('en-US'));
    });
    await probe('export-owned CSS labels follow en-US', () => {
        assert.ok(!document.querySelector('style').textContent.includes('剧透内容'), 'CSS still emits 〔剧透内容〕');
    });
    document.defaultView.close();
    const melon = new window.MelonHelper(panel, renderer);
    await probe('detached AI viewer declares its own language', () => {
        window.document.documentElement.lang = 'zh-CN';
        window.document.querySelector('#ldsp-panel').lang = 'en-US';
        melon._showViewer({ title: 'Topic', summary: 'Summary', mode: 'brief', topicId: 42 });
        assert.equal(melon._viewerOverlay.closest('[lang]')?.lang, 'en-US');
    });
    melon._closeViewer();
    melon._stopUrlWatch();
} finally { fixture.dom.window.close(); }
console.log(JSON.stringify({ baseline: '1513b7c', probes: results.length,
    passed: results.filter(result => result.pass).length, results }, null, 2));
process.exitCode = results.some(result => !result.pass) ? 1 : 0;
