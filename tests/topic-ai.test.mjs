import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CompletionDecoder, normalizeApiUrl, requestCompletion, requestWithContinuation, SummaryJob, packRecords, outputLanguageInstruction } from '../src/core/topic-ai.mjs';

test('endpoint normalization keeps HTTP, port and reverse proxy paths, rejects malformed URLs', () => {
    assert.equal(normalizeApiUrl('http://192.168.1.10:1234'), 'http://192.168.1.10:1234/v1/chat/completions');
    assert.equal(normalizeApiUrl('http://localhost:11434/proxy/v1/'), 'http://localhost:11434/proxy/v1/chat/completions');
    assert.equal(normalizeApiUrl('https://service.invalid/custom?x=1'), 'https://service.invalid/custom?x=1');
    for (const input of ['http:192.168.1.1', '192.168.1.1', 'https://user:secret@service.invalid', 'file:///etc/passwd', 'https://service.invalid/#secret']) assert.throws(() => normalizeApiUrl(input));
});

const event = content => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\r\n\r\n`;

test('Chat Completions uses the entered model and Bearer auth with streaming or buffered answers', async () => {
    const config = { apiUrl: 'https://ai.invalid/v1', apiKey: 'fixture-key', model: 'vendor/user-choice' };
    for (const buffered of [false, true]) {
        let output = '';
        const result = await requestCompletion({ ...config, buffered }, { messages: [{ role: 'user', content: 'Hi' }], maxTokens: 1024, onChunk: chunk => { output += chunk; }, gm: options => {
            assert.equal(options.url, 'https://ai.invalid/v1/chat/completions');
            assert.equal(options.headers.Authorization, 'Bearer fixture-key');
            assert.deepEqual(JSON.parse(options.data), { model: 'vendor/user-choice', messages: [{ role: 'user', content: 'Hi' }], max_tokens: 1024, stream: !buffered });
            const responseText = buffered ? '{"choices":[{"message":{"reasoning_content":"Hidden reasoning","content":"Answer"},"finish_reason":"stop"}]}'
                : 'data: {"choices":[{"delta":{"reasoning_content":"Hidden reasoning","content":null}}]}\n\n' + event('Answer') + 'data: [DONE]\n\n';
            queueMicrotask(() => { options.onprogress({ status: 200, responseText }); options.onload({ status: 200, responseText }); }); return { abort() {} };
        } });
        assert.deepEqual(result, { text: 'Answer', truncated: false }); assert.equal(output, 'Answer');
    }
});

test('API problem details are visible and context overflow is recognized without retrying', async () => {
    let calls = 0;
    await assert.rejects(requestCompletion({ apiUrl: 'https://ai.invalid/v1', model: 'vendor/user-choice' }, { messages: [], gm: options => {
        calls++;
        queueMicrotask(() => options.onload({ status: 422, responseText: '{"title":"Unprocessable Entity","detail":"maximum context length exceeded"}' })); return { abort() {} };
    } }), error => error.status === 422 && error.contextOverflow && /maximum context length exceeded/.test(error.message));
    assert.equal(calls, 1);
});

test('text summaries preserve source replies without adding model-specific parameters', async () => {
    for (const model of ['vendor/user-choice', 'another-model']) {
        for (const buffered of [false, true]) {
            let calls = 0;
            const records = ['[第1楼] Launch Friday, $20/month.', '[第2楼] Correction: Monday, 50 GB.', '[第3楼] I disagree with the price.'];
            const result = await new SummaryJob('text-only').run({
                records, title: 'Release discussion', prompt: 'Summarize the topic and replies.',
                config: { model, buffered, apiUrl: 'https://ai.invalid/v1', outputLanguage: 'en' },
                request: (config, options) => requestCompletion(config, { ...options, gm: request => {
                    calls++;
                    const payload = JSON.parse(request.data);
                    assert.equal(payload.model, model);
                    assert.equal(payload.stream, !buffered);
                    assert.equal(payload.chat_template_kwargs, undefined);
                    assert.equal(payload.reasoning_effort, undefined);
                    assert.ok(payload.messages.every(message => typeof message.content === 'string'));
                    for (const record of records) assert.ok(payload.messages[1].content.includes(record));
                    const responseText = buffered ? JSON.stringify({ choices: [{ message: { content: 'Monday launch [第2楼]; price disputed [第3楼].' }, finish_reason: 'stop' }] })
                        : event('Monday launch [第2楼]; price disputed [第3楼].') + 'data: [DONE]\n\n';
                    queueMicrotask(() => request.onload({ status: 200, responseText }));
                    return { abort() {} };
                } })
            });
            assert.equal(result, 'Monday launch [第2楼]; price disputed [第3楼].');
            assert.equal(calls, 1);
        }
    }
});

test('Chat Completions accepts root, base and full endpoint URLs', () => {
    for (const path of ['', '/v1', '/v1/', '/v1/chat/completions']) {
        assert.equal(normalizeApiUrl('https://ai.invalid' + path), 'https://ai.invalid/v1/chat/completions');
    }
});

test('generation without an explicitly chosen model never sends a request', () => {
    assert.throws(() => requestCompletion({ apiUrl: 'https://ai.invalid/v1' }, { messages: [], gm: () => assert.fail('Must choose a model first') }), /模型/);
});
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

test('reasoning-only length exhaustion reports the output limit rather than generic empty content', async () => {
    for (const buffered of [false, true]) {
        const choice = { [buffered ? 'message' : 'delta']: { content: null, reasoning_content: 'Private reasoning' }, finish_reason: 'length' };
        const responseText = buffered ? JSON.stringify({ choices: [choice] }) : `data: ${JSON.stringify({ choices: [choice] })}\n\ndata: [DONE]\n\n`;
        await assert.rejects(requestCompletion({ apiUrl: 'https://ai.invalid/v1', model: 'fixture', buffered }, {
            messages: [], t: key => key, gm: options => {
                queueMicrotask(() => options.onload({ status: 200, responseText })); return { abort() {} };
            }
        }), /输出上限但未返回答案/);
    }
});

test('segment requests honor the configured output allowance instead of a hidden 768-token cap', async () => {
    const limits = [];
    await new SummaryJob('segment-allowance').run({ records: ['source '.repeat(700)], title: 'Topic', prompt: 'Summarize',
        config: { inputBudget: 2000, maxTokens: 4096 }, request: async (_config, options) => {
            limits.push(options.maxTokens); return { text: 'Short digest', truncated: false };
        }
    });
    assert.ok(limits.length > 1);
    assert.ok(limits.every(limit => limit === 4096), JSON.stringify(limits));
});

test('generic continuation works across model IDs and buffered/streaming APIs with original evidence retained', async () => {
    for (const model of ['vendor/model-a', 'local-model']) for (const buffered of [true, false]) {
        let calls = 0, output = '';
        const messages = [{ role: 'system', content: 'Answer in English.' }, { role: 'user', content: 'Source [第1楼]' }];
        const result = await requestWithContinuation({ apiUrl: 'https://ai.invalid/v1', model, buffered, maxContinuations: 2 }, {
            messages, onChunk: chunk => { output += chunk; }, gm: options => {
                calls++;
                const payload = JSON.parse(options.data);
                assert.equal(payload.model, model);
                assert.deepEqual(payload.messages.slice(0, 2), messages);
                if (calls === 2) {
                    assert.equal(payload.messages[2].content, 'First ');
                    assert.match(payload.messages[3].content, /Continue the unfinished answer/);
                }
                const choice = { [buffered ? 'message' : 'delta']: { content: calls === 1 ? 'First ' : 'second [第1楼]' }, finish_reason: calls === 1 ? 'length' : 'stop' };
                queueMicrotask(() => options.onload({ status: 200, responseText: buffered ? JSON.stringify({ choices: [choice] }) : `data: ${JSON.stringify({ choices: [choice] })}\n\ndata: [DONE]\n\n` }));
                return { abort() {} };
            }
        });
        assert.equal(calls, 2); assert.equal(output, 'First second [第1楼]');
        assert.deepEqual(result, { text: output, truncated: false });
    }
});

test('continuation obeys off/maximum settings, context limits, cancellation and network errors', async () => {
    for (const maxContinuations of [0, 2]) {
        let calls = 0;
        const result = await requestWithContinuation({ maxContinuations }, { messages: [] }, async () => {
            calls++; return { text: 'part', truncated: true };
        });
        assert.equal(calls, maxContinuations + 1); assert.equal(result.truncated, true);
    }
    let calls = 0;
    await assert.rejects(requestWithContinuation({ maxContinuations: 3 }, { messages: [] }, async () => {
        calls++; throw new Error('Network failure');
    }), /Network failure/);
    assert.equal(calls, 1);
    calls = 0;
    await assert.rejects(requestWithContinuation({ maxContinuations: 2, inputBudget: 2000 }, { messages: [{ role: 'user', content: 'x'.repeat(1800) }] }, async () => {
        calls++; return { text: 'y'.repeat(500), truncated: true };
    }), /输入预算/);
    assert.equal(calls, 1);
    const controller = new AbortController(); calls = 0;
    await assert.rejects(requestWithContinuation({ maxContinuations: 2 }, { messages: [], signal: controller.signal, onContinuation: () => controller.abort() }, async () => {
        calls++; return { text: 'part', truncated: true };
    }), { name: 'AbortError' });
    assert.equal(calls, 1);
});

test('GM progress is incremental; cancel aborts the request and prevents delayed output', async () => {
    const controller = new AbortController(); let handle, aborted = 0, output = '';
    const promise = requestCompletion({ apiUrl: 'http://localhost:1234', model: 'fixture' }, { messages: [], signal: controller.signal, onChunk: chunk => { output += chunk; }, gm: options => { handle = options; return { abort() { aborted++; options.onabort(); } }; } });
    handle.onprogress({ status: 200, responseText: event('first') });
    handle.onprogress({ status: 200, responseText: event('first') + event('second') });
    controller.abort(); await assert.rejects(promise, { name: 'AbortError' });
    handle.onload({ status: 200, responseText: event('late') });
    assert.equal(output, 'firstsecond'); assert.equal(aborted, 1);
});

test('context overflow is recognized and timeout never repeats a POST', async () => {
    await assert.rejects(requestCompletion({ apiUrl: 'https://ai.invalid/v1', model: 'fixture' }, { messages: [], gm: options => {
        queueMicrotask(() => options.onload({ status: 400, responseText: JSON.stringify({ error: { code: 'context_length_exceeded', message: 'maximum context length' } }) })); return { abort() {} };
    } }), error => error.contextOverflow && error.status === 400);
    let calls = 0;
    await assert.rejects(requestCompletion({ apiUrl: 'http://localhost', model: 'fixture' }, { messages: [], idleMs: 5, gm: () => { calls++; return { abort() {} }; } }), /未返回数据/);
    assert.equal(calls, 1);
});

test('long summaries resume successful segments after failure, with every request inside the input budget', async () => {
    const job = new SummaryJob('one'); const records = [1, 2, 3].map(number => `[第${number}楼] ` + String(number).repeat(1400));
    let calls = 0, fail = true;
    const successfulInputs = new Set();
    const request = async (config, options) => {
        calls++;
        assert.ok(options.messages.reduce((sum, message) => sum + message.content.length, 0) <= 2000);
        if (calls === 2 && fail) throw new Error('offline');
        assert.ok(!successfulInputs.has(options.messages[1].content), 'A completed segment must not be requested again');
        successfulInputs.add(options.messages[1].content);
        options.onChunk('摘要 [第1楼]'); return { text: '摘要 [第1楼]', truncated: false };
    };
    const args = { records, title: '长帖', prompt: '请总结', config: { inputBudget: 2000 }, request };
    await assert.rejects(job.run(args), /offline/); const completed = job.completed.size; assert.equal(completed, 1);
    fail = false; const result = await job.run(args); assert.equal(result, '摘要 [第1楼]');
    assert.equal(job.completed.size, successfulInputs.size);
});

test('text packing does not lose content, including emoji and long code', () => {
    const records = ['a'.repeat(3000), '🙂'.repeat(1000)];
    const chunks = packRecords(records, 1000);
    assert.ok(chunks.every(chunk => chunk.length <= 1000));
    assert.equal(chunks.join('').replace(/\n/g, ''), records.join(''));
});

test('summary instructions preserve corrections, uncertainty, evidence and citation syntax in every pass', async () => {
    const sent = [];
    await new SummaryJob('language').run({
        records: ['[第1楼] Original claim', '[第2楼] Correction'], title: 'Fixture', prompt: 'Custom instruction: concise',
        config: { outputLanguage: 'en', inputBudget: 2000 },
        request: async (_config, options) => { sent.push(options.messages); return { text: 'Supported conclusion [第2楼]', truncated: false }; }
    });
    assert.match(sent[0][0].content, /Custom instruction: concise/);
    assert.match(sent[0][0].content, /English/);
    assert.match(sent[0][0].content, /corrections/i);
    assert.match(sent[0][0].content, /unverified/i);
    assert.match(sent[0][0].content, /\[第N楼\]/);
    assert.match(sent[0][0].content, /untrusted/i);
});

test('every supported language keeps citation syntax; custom language adds no override', () => {
    for (const [language, name] of [['zh-CN', 'Simplified Chinese'], ['en', 'English'], ['pt-BR', 'Brazilian Portuguese'], ['es', 'Spanish'], ['ja', 'Japanese']]) {
        assert.ok(outputLanguageInstruction(language).includes(name));
        assert.ok(outputLanguageInstruction(language).includes('[第N楼]'));
    }
    assert.equal(outputLanguageInstruction('custom'), '');
    assert.equal(outputLanguageInstruction('unknown'), '');
});

test('context overflow splits source data and merges within the character budget', async () => {
    let rejected = false;
    const sent = [];
    const summary = await new SummaryJob('overflow').run({ records: ['[第1楼] ' + 'a'.repeat(2400)], title: 'Topic', prompt: 'Summarize', config: { inputBudget: 6000, outputLanguage: 'en' },
        request: async (_config, options) => {
            assert.ok(options.messages.reduce((sum, m) => sum + m.content.length, 0) <= 6000);
            if (!rejected) { rejected = true; throw Object.assign(new Error('context exceeded'), { contextOverflow: true }); }
            sent.push(options.messages[1].content);
            return { text: 'Digest [第1楼]', truncated: false };
        }
    });
    assert.equal(summary, 'Digest [第1楼]');
    assert.equal(sent.length, 3);
    assert.ok(sent[0].includes('aaa') && sent[1].includes('aaa'));
});

test('truncated results stay incomplete and retry never reuses them as completed answers', async () => {
    const job = new SummaryJob('truncated');
    const args = { records: ['[第1楼] source'], title: 'Topic', prompt: 'Summarize', config: {}, request: async (_config, options) => {
        options.onChunk('Partial answer'); return { text: 'Partial answer', truncated: true };
    } };
    await assert.rejects(job.run(args), /输出/);
    const result = await job.run({ ...args, request: async () => ({ text: 'Complete answer', truncated: false }) });
    assert.equal(result, 'Complete answer');
});
