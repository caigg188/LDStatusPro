import assert from 'node:assert/strict';
import { test } from 'node:test';
import { componentWindow, topicMetadata } from './helpers/topic-fixture.mjs';

const waitFor = async predicate => {
    for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
    throw new Error('component did not reach the expected state');
};
const metadataFetch = async () => new Response(JSON.stringify(topicMetadata));

test('actual exporter renders highest floor, outputs safe artifacts and opens PDF before awaiting the network', async t => {
    const fixture = componentWindow({ fetchImpl: metadataFetch }); t.after(() => fixture.dom.window.close());
    const { window, panel, renderer } = fixture;
    const exporter = new window.TopicExporter(panel, renderer); exporter.init(); exporter.show(); t.after(() => exporter.destroy());
    await waitFor(() => panel.querySelector('#export-end'));
    assert.equal(panel.querySelector('#export-end').value, '10');
    panel.querySelector('#export-end').value = '1'; exporter._embedImg = false;
    let artifact;
    exporter._download = (content, filename) => { artifact = { content, filename }; };
    await exporter._doExport({ ...topicMetadata, id: '42', highestPostNumber: 10 });
    assert.match(artifact.content, /Content-Security-Policy/); assert.match(artifact.content, /const x = 1;/);
    exporter._format = 'md';
    await exporter._doExport({ ...topicMetadata, id: '42', highestPostNumber: 10 });
    assert.ok(artifact.content.includes('const x = 1;\n\n\nconsole.log(x);'));
    assert.ok(artifact.content.includes('https://forum.invalid/t/42/1'));
    exporter._format = 'pdf';
    let opened = false;
    window.open = () => { opened = true; return { document: { body: {}, title: '' }, closed: false, close() {} }; };
    exporter._fetchPosts = async () => { assert.equal(opened, true); throw new Error('fixture read error'); };
    await exporter._doExport({ ...topicMetadata, id: '42', highestPostNumber: 10 });
    assert.match(panel.querySelector('#export-status').textContent, /fixture read error/);
});

test('actual summary component accepts no key, stores coverage and keeps old records readable', async t => {
    const fixture = componentWindow({ fetchImpl: metadataFetch, config: { apiUrl: 'http://localhost:1234', model: 'fixture' }, gm: options => {
        assert.equal(options.headers.Authorization, undefined);
        queueMicrotask(() => options.onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: '结论 [第1楼]，未知 [第999楼]' }, finish_reason: 'stop' }] }) })); return { abort() {} };
    } }); t.after(() => fixture.dom.window.close());
    const { window, panel, renderer } = fixture;
    const helper = new window.MelonHelper(panel, renderer); helper.init(); helper.show(); t.after(() => helper.destroy());
    await waitFor(() => panel.querySelector('#melon-end'));
    assert.equal(panel.querySelector('#melon-end').value, '10'); assert.equal(panel.querySelector('#melon-summarize').disabled, false);
    panel.querySelector('#melon-end').value = '1';
    await helper._doSummarize({ id: '42', title: '测试', highestPostNumber: 10 });
    assert.equal(helper.history[0].status, 'complete'); assert.deepEqual([...helper.history[0].postNumbers], [1]);
    assert.match(panel.querySelector('#melon-output').innerHTML, /\/t\/42\/1/); assert.ok(!panel.querySelector('#melon-output').innerHTML.includes('/42/999'));
    helper.history.push({ topicId: '42', title: '旧记录', summary: '旧总结', mode: 'brief', timestamp: 1 });
    helper._showHistoryDetail(1); assert.match(panel.textContent, /旧记录（未记录站点及范围）/);
    let copied;
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async text => { copied = text; } } });
    helper._showViewer(helper.history[0]);
    helper._viewerOverlay.querySelector('#viewer-copy').click();
    await waitFor(() => copied);
    assert.match(copied, /【AI 总结】\n结论/);
    helper.hide(); helper._closeViewer();
    assert.equal(helper._urlCheckInterval, null);
    helper._renderSettings();
    assert.equal(panel.querySelector('#melon-api-key').value, ''); assert.match(panel.textContent, /API Key（可选）/);
});

test('closing a running summary cancels GM and late callbacks cannot store a completed history', async t => {
    let callbacks, cancelled = 0;
    const fixture = componentWindow({ fetchImpl: metadataFetch, config: { apiUrl: 'http://localhost' }, gm: options => { callbacks = options; return { abort() { cancelled++; options.onabort(); } }; } }); t.after(() => fixture.dom.window.close());
    const helper = new fixture.window.MelonHelper(fixture.panel, fixture.renderer); helper.init(); helper.show(); t.after(() => helper.destroy());
    await waitFor(() => fixture.panel.querySelector('#melon-end')); fixture.panel.querySelector('#melon-end').value = '1';
    const running = helper._doSummarize({ id: '42', title: '测试', highestPostNumber: 10 });
    await waitFor(() => callbacks); helper.hide(); await running;
    callbacks.onload({ status: 200, responseText: '{"choices":[{"message":{"content":"late"}}]}' });
    assert.equal(cancelled, 1); assert.equal(helper.history.length, 0);
});

test('switching topics between segments prevents another AI request before the route watcher runs', async t => {
    let calls = 0, fixture;
    fixture = componentWindow({ fetchImpl: metadataFetch, config: { apiUrl: 'http://localhost', inputBudget: 2000 }, gm: options => {
        calls++;
        queueMicrotask(() => {
            fixture.window.history.pushState({}, '', '/t/43');
            options.onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: '已完成的一段 [第1楼]' }, finish_reason: 'stop' }] }) });
        });
        return { abort() {} };
    } }); t.after(() => fixture.dom.window.close());
    const helper = new fixture.window.MelonHelper(fixture.panel, fixture.renderer); helper.init(); helper.show(); t.after(() => helper.destroy());
    await waitFor(() => fixture.panel.querySelector('#melon-end')); fixture.panel.querySelector('#melon-end').value = '1';
    helper._fetchDialogues = async () => ({ records: Array.from({ length: 4 }, () => '[第1楼] 作者\n' + '内容'.repeat(500)), posts: [{ post_number: 1 }], range: { start: 1, end: 1 } });
    await helper._doSummarize({ id: '42', title: '测试', highestPostNumber: 10 });
    assert.equal(calls, 1);
    assert.ok(helper.history.every(record => record.status !== 'complete'));
});
