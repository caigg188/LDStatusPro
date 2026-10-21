import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CompletionDecoder, normalizeApiUrl, requestCompletion, SummaryJob, packRecords } from '../src/core/topic-ai.mjs';

test('endpoint normalization keeps HTTP, port and reverse proxy paths, rejects malformed URLs', () => {
    assert.equal(normalizeApiUrl('http://192.168.1.10:1234'), 'http://192.168.1.10:1234/v1/chat/completions');
    assert.equal(normalizeApiUrl('http://localhost:11434/proxy/v1/'), 'http://localhost:11434/proxy/v1/chat/completions');
    assert.equal(normalizeApiUrl('https://service.invalid/custom?x=1'), 'https://service.invalid/custom?x=1');
    for (const input of ['http:192.168.1.1', '192.168.1.1', 'https://user:secret@service.invalid', 'file:///etc/passwd', 'https://service.invalid/#secret']) assert.throws(() => normalizeApiUrl(input));
});

const event = content => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\r\n\r\n`;
test('SSE split at every character handles CRLF, comments and an unterminated final DONE event', () => {
    let output = ''; const decoder = new CompletionDecoder(chunk => { output += chunk; });
    const input = ': heartbeat\r\n\r\n' + event('中文') + event('🙂') + 'data: [DONE]';
    for (const char of input) decoder.push(char);
    assert.deepEqual(decoder.finish(), { text: '中文🙂', truncated: false }); assert.equal(output, '中文🙂');
});

test('JSON, empty responses, truncation and interrupted SSE have distinct outcomes', () => {
    const json = new CompletionDecoder(); json.push(JSON.stringify({ choices: [{ message: { content: 'OK' }, finish_reason: 'length' }] }));
    assert.deepEqual(json.finish(), { text: 'OK', truncated: true });
    const empty = new CompletionDecoder(); empty.push('data: [DONE]\n\n'); assert.throws(() => empty.finish(), /空内容/);
    const interrupted = new CompletionDecoder(); interrupted.push(event('部分内容')); assert.throws(() => interrupted.finish(), /中断/);
    const html = new CompletionDecoder(); html.push('<html>login</html>'); assert.throws(() => html.finish(), /网页地址/);
});

test('one GM request works without a key and buffers SSE when no progress event is supplied', async () => {
    let calls = 0;
    const result = await requestCompletion({ apiUrl: 'http://127.0.0.1:1234', model: 'local' }, { messages: [{ role: 'user', content: 'OK' }], gm: options => {
        calls++; assert.equal(options.anonymous, true); assert.equal(options.headers.Authorization, undefined);
        assert.equal(JSON.parse(options.data).model, 'local');
        queueMicrotask(() => options.onload({ status: 200, responseText: event('OK') + 'data: [DONE]\n\n' }));
        return { abort() {} };
    } });
    assert.equal(result.text, 'OK'); assert.equal(calls, 1);
});

test('GM progress is incremental; cancel aborts the request and prevents delayed output', async () => {
    const controller = new AbortController(); let handle, aborted = 0, output = '';
    const promise = requestCompletion({ apiUrl: 'http://localhost:1234' }, { messages: [], signal: controller.signal, onChunk: chunk => { output += chunk; }, gm: options => { handle = options; return { abort() { aborted++; options.onabort(); } }; } });
    handle.onprogress({ status: 200, responseText: event('first') });
    handle.onprogress({ status: 200, responseText: event('first') + event('second') });
    controller.abort(); await assert.rejects(promise, { name: 'AbortError' });
    handle.onload({ status: 200, responseText: event('late') });
    assert.equal(output, 'firstsecond'); assert.equal(aborted, 1);
});

test('context overflow is recognized and timeout never repeats a POST', async () => {
    await assert.rejects(requestCompletion({ apiUrl: 'https://ai.invalid/v1' }, { messages: [], gm: options => {
        queueMicrotask(() => options.onload({ status: 400, responseText: JSON.stringify({ error: { code: 'context_length_exceeded', message: 'maximum context length' } }) })); return { abort() {} };
    } }), error => error.contextOverflow && error.status === 400);
    let calls = 0;
    await assert.rejects(requestCompletion({ apiUrl: 'http://localhost' }, { messages: [], idleMs: 5, gm: () => { calls++; return { abort() {} }; } }), /未返回数据/);
    assert.equal(calls, 1);
});

test('long summaries resume successful segments after failure, with every request inside the input budget', async () => {
    const job = new SummaryJob('one'); const records = [1, 2, 3].map(number => `[第${number}楼] ` + String(number).repeat(1400));
    let calls = 0, fail = true;
    const request = async (config, options) => {
        calls++;
        assert.ok(options.messages.reduce((sum, message) => sum + message.content.length, 0) <= 2000);
        if (calls === 2 && fail) throw new Error('offline');
        options.onChunk('摘要 [第1楼]'); return { text: '摘要 [第1楼]', truncated: false };
    };
    const args = { records, title: '长帖', prompt: '请总结', config: { inputBudget: 2000 }, request };
    await assert.rejects(job.run(args), /offline/); const completed = job.completed.size; assert.equal(completed, 1);
    fail = false; const result = await job.run(args); assert.equal(result, '摘要 [第1楼]');
    assert.equal(calls, 2 + 3); // two remaining segments and a final merge
    assert.equal(job.completed.size, 4);
});

test('text packing does not lose content, including emoji and long code', () => {
    const records = ['a'.repeat(3000), '🙂'.repeat(1000)];
    const chunks = packRecords(records, 1000);
    assert.ok(chunks.every(chunk => chunk.length <= 1000));
    assert.equal(chunks.join('').replace(/\n/g, ''), records.join(''));
});
