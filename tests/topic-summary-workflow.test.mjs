import assert from 'node:assert/strict';
import { test } from 'node:test';
import { componentWindow } from './helpers/topic-fixture.mjs';

const waitFor = async predicate => {
    for (let i = 0; i < 600; i++) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('Summary UI did not reach the expected state');
};
const answer = text => ({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: text }, finish_reason: 'stop' }] }) });

function workflow(t, { respond = () => answer('Complete summary [第1楼]'), config = {}, body = 'Forum source', fetchImpl } = {}) {
    const requests = [];
    const f = componentWindow({
        config: { apiUrl: 'https://ai.invalid/v1', model: 'fixture', ...config },
        fetchImpl: fetchImpl || (async () => new Response(JSON.stringify({ id: 42, title: 'Fixture topic', posts_count: 1, highest_post_number: 1,
            post_stream: { posts: [{ id: 1, topic_id: 42, post_number: 1, username: 'alice', cooked: `<p>${body}</p>` }] } }))),
        gm: options => {
            if (options.data) requests.push(JSON.parse(options.data));
            queueMicrotask(() => {
                const response = respond(requests.length, options);
                if (response) options.onload(response);
            });
            return { abort() { options.onabort(); } };
        }
    });
    f.window.I18n.setLocale('en-US');
    let helper;
    const open = async () => {
        helper = new f.window.MelonHelper(f.panel, f.renderer);
        helper.init(); helper.show();
        await waitFor(() => f.panel.querySelector('#melon-summarize'));
    };
    const click = selector => {
        const el = f.panel.querySelector(selector);
        assert.ok(el, `Missing control: ${selector}`);
        el.click();
    };
    const generate = async () => {
        click('#melon-summarize');
        await waitFor(() => f.panel.querySelector('#melon-summarize')?.disabled === false);
    };
    t.after(() => { helper?.destroy(); f.dom.window.close(); });
    return { ...f, requests, open, click, generate, helper: () => helper, show: () => helper.show(), restart: async () => { helper.destroy(); await open(); } };
}

test('a failed new attempt keeps the last complete summary alongside the partial attempt in history', async t => {
    const f = workflow(t, { respond: (n, options) => {
        if (n === 1) return answer('Saved complete answer [第1楼]');
        options.onprogress({ status: 200, responseText: 'data: {"choices":[{"delta":{"content":"Unfinished replacement"}}]}\n\n' });
        options.onerror();
    } });
    await f.open(); await f.generate();
    await f.restart(); await f.generate();
    f.click('[data-tab="history"]');
    assert.match(f.panel.textContent, /Saved complete answer/);
    assert.match(f.panel.textContent, /Unfinished replacement/);
});

test('buffered long-topic requests honor the output setting and explain empty length-limited answers', async t => {
    const f = workflow(t, { body: 'source '.repeat(1500), config: { buffered: true, maxTokens: 2048 }, respond: (_n, options) => {
        const payload = JSON.parse(options.data);
        assert.equal(payload.max_tokens, 2048);
        assert.equal(payload.stream, false);
        return { status: 200, responseText: JSON.stringify({ choices: [{ message: { content: null, reasoning_content: 'Hidden reasoning' }, finish_reason: 'length' }] }) };
    } });
    await f.open();
    assert.equal(f.panel.querySelector('#melon-output').dataset.placeholder, 'Generate a summary to see it here.');
    await f.generate();
    assert.match(f.panel.textContent, /hit the output limit without an answer/);
    assert.doesNotMatch(f.panel.textContent, /Hidden reasoning/);
    assert.equal(f.requests.length, 1, 'No automatic paid retry');
    f.window.I18n.setLocale('zh-CN'); f.click('[data-tab="home"]');
    await waitFor(() => f.panel.querySelector('#melon-output'));
    assert.equal(f.panel.querySelector('#melon-output').dataset.placeholder, '生成总结后将在此显示。');
});

test('popular summary reads late selected replies, preserves full range and restores source mode', async t => {
    const post = number => ({ id: number, topic_id: 42, post_number: number, username: 'alice', cooked: `<p>Evidence floor ${number}</p>` });
    const f = workflow(t, { fetchImpl: async url => new Response(JSON.stringify(url.includes('filter=summary')
        ? { id: 42, highest_post_number: 1, post_stream: { stream: [1, 900], posts: [post(1)] } }
        : url.includes('post_ids') ? { post_stream: { posts: [post(900)] } }
        : { id: 42, title: 'Long topic', has_summary: true, highest_post_number: 1000, posts_count: 1000, post_stream: { posts: [post(1)] } })) });
    await f.open();
    f.panel.querySelector('#melon-source-mode').value = 'popular';
    await f.generate();
    assert.match(JSON.stringify(f.requests[0]), /Evidence floor 900/);
    assert.match(f.requests[0].messages[0].content, /only forum-selected popular replies/);
    assert.equal(f.helper().history[0].range.end, 1000);
    assert.equal(f.helper().history[0].sourceMode, 'popular');
    f.click('[data-tab="history"]'); f.click('[data-tab="home"]');
    await waitFor(() => f.panel.querySelector('#melon-source-mode'));
    assert.equal(f.panel.querySelector('#melon-source-mode').value, 'popular');
    f.click('#melon-expand');
    const viewer = f.window.document.querySelector('.ldsp-melon-viewer-overlay');
    assert.match(viewer.textContent, /Popular replies/);
    viewer.querySelector('#viewer-chat-input').value = 'Any corrections?'; viewer.querySelector('#viewer-chat-send').click();
    await waitFor(() => !viewer.querySelector('#viewer-chat-send').disabled);
    assert.match(f.requests.at(-1).messages[0].content, /may omit corrections or minority views/);
});

test('global continuation setting persists and completes summaries and follow-up replies', async t => {
    const f = workflow(t, { respond: n => ({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: n % 2 ? 'First ' : 'remainder [第1楼]' }, finish_reason: n % 2 ? 'length' : 'stop' }] }) }) });
    await f.open(); f.click('[data-tab="settings"]'); f.click('#melon-edit-settings');
    assert.equal(f.panel.querySelector('#melon-continuations').value, '0');
    f.panel.querySelector('#melon-continuations').value = '2'; f.click('#melon-save-settings');
    assert.equal(JSON.parse(f.values.get('ldsp_melon_config')).maxContinuations, 2);
    await f.restart(); await f.generate();
    assert.equal(f.requests.length, 2);
    assert.match(f.panel.querySelector('#melon-output').textContent, /First remainder/);
    f.click('#melon-expand');
    const viewer = f.window.document.querySelector('.ldsp-melon-viewer-overlay');
    viewer.querySelector('#viewer-chat-input').value = 'Explain'; viewer.querySelector('#viewer-chat-send').click();
    await waitFor(() => !viewer.querySelector('#viewer-chat-send').disabled);
    assert.equal(f.requests.length, 4);
    assert.match(viewer.querySelector('#viewer-chat-content').lastElementChild.textContent, /First remainder/);
});

test('official API fields, connection check, summaries and follow-ups use the entered configuration', async t => {
    const sent = [];
    const f = workflow(t, { respond: (_n, options) => {
        sent.push(options);
        assert.equal(options.headers.Authorization, 'Bearer fixture-key');
        assert.equal(options.url, 'https://custom.invalid/v1/chat/completions');
        const body = JSON.parse(options.data);
        assert.equal(body.model, 'vendor/user-choice'); assert.equal(body.max_tokens, 1024);
        return answer('API answer [第1楼]');
    } });
    await f.open(); f.click('[data-tab="settings"]'); f.click('#melon-edit-settings');
    for (const selector of ['#melon-provider', '#melon-nvidia-python', '#melon-load-models', '#melon-output-language']) assert.equal(f.panel.querySelector(selector), null);
    const fill = (id, value) => { const input = f.panel.querySelector(id); input.value = value; input.dispatchEvent(new f.window.Event('input')); };
    fill('#melon-api-url', 'https://custom.invalid/v1'); fill('#melon-api-key', 'fixture-key'); fill('#melon-model', 'vendor/user-choice'); fill('#melon-max-tokens', '1024');
    f.click('#melon-test-connection'); await waitFor(() => /Connected/.test(f.panel.querySelector('#melon-connection-status').textContent));
    f.click('#melon-save-settings');
    const saved = JSON.parse(f.values.get('ldsp_melon_config')); assert.equal(saved.provider, undefined); assert.equal(saved.model, 'vendor/user-choice');
    f.click('[data-tab="home"]'); await waitFor(() => f.panel.querySelector('#melon-summarize'));
    await f.generate(); assert.match(f.panel.querySelector('#melon-output').textContent, /API answer/);
    f.click('#melon-expand');
    f.window.document.querySelector('#viewer-chat-input').value = 'Explain'; f.window.document.querySelector('#viewer-chat-send').click();
    await waitFor(() => sent.length === 3 && !f.window.document.querySelector('#viewer-chat-send').disabled);
    assert.match(f.window.document.querySelector('.ldsp-melon-viewer-overlay').textContent, /API answer/);
});

test('experimental settings are removed on save while API fields and custom prompts survive', async t => {
    const f = workflow(t, { config: { provider: 'nvidia', apiKey: 'saved-key', outputLanguage: 'zh-CN',
        nvidiaConfig: { model: 'fixture', parameters: { seed: 42, chat_template_kwargs: { enable_thinking: false } } },
        promptBrief: 'My saved custom prompt' } });
    await f.open(); f.click('[data-tab="settings"]'); f.click('#melon-edit-settings');
    assert.equal(f.panel.querySelector('#melon-api-key').value, 'saved-key');
    assert.equal(f.panel.querySelector('#melon-model').value, 'fixture');
    assert.equal(f.panel.querySelector('#melon-prompt-brief').value, 'My saved custom prompt');
    f.click('#melon-save-settings');
    const saved = JSON.parse(f.values.get('ldsp_melon_config'));
    for (const key of ['provider', 'nvidiaConfig', 'outputLanguage']) assert.equal(saved[key], undefined);
    assert.equal(saved.apiUrl, 'https://ai.invalid/v1/chat/completions');
    assert.equal(saved.apiKey, 'saved-key');
    assert.equal(saved.promptBrief, 'My saved custom prompt');
    await f.restart(); await f.generate();
    assert.equal(f.requests[0].seed, undefined);
    assert.equal(f.requests[0].chat_template_kwargs, undefined);
    assert.match(f.requests[0].messages[0].content, /^Answer in English\./);
});

test('Generate again requests a fresh answer while Resume reuses completed segments after failure', async t => {
    const f = workflow(t, { config: { inputBudget: 2000 }, body: 'source '.repeat(500), respond: (n, options) => {
        if (n === 2) { options.onerror(); return; }
        return answer(`Answer ${n} [第1楼]`);
    } });
    await f.open(); await f.generate();
    assert.equal(f.panel.querySelector('#melon-summarize').textContent.trim(), 'Generate again');
    assert.equal(f.panel.querySelector('#melon-resume').hidden, false);
    const successfulSegment = f.requests[0].messages[1].content;
    f.click('#melon-resume');
    await waitFor(() => f.panel.querySelector('#melon-summarize')?.disabled === false);
    assert.equal(f.requests.filter(r => r.messages[1].content === successfulSegment).length, 1);
    assert.equal(f.panel.querySelector('#melon-resume').hidden, true);
    const before = f.requests.length;
    await f.generate();
    assert.ok(f.requests.length > before);
    assert.equal(f.requests.filter(r => r.messages[1].content === successfulSegment).length, 2);
});

test('returning Home and reopening the panel restores the result, selected range and mode', async t => {
    const f = workflow(t);
    await f.open();
    f.click('input[value="brief"]');
    await f.generate();
    f.click('[data-tab="history"]');
    f.click('[data-tab="home"]');
    await waitFor(() => f.panel.querySelector('#melon-output'));
    assert.match(f.panel.querySelector('#melon-output').textContent, /Complete summary/);
    assert.equal(f.panel.querySelector('input[value="brief"]').checked, true);
    f.click('.ldsp-melon-close');
    f.show();
    await waitFor(() => f.panel.querySelector('#melon-output'));
    assert.match(f.panel.querySelector('#melon-output').textContent, /Complete summary/);
    assert.equal(f.requests.length, 1);
});

test('saved long-topic summaries retain the same bounded follow-up context after reopening history', async t => {
    const f = workflow(t, { body: 'source '.repeat(500), config: { inputBudget: 2000 }, respond: n => answer(n < 4 ? `Digest ${n} [第1楼]` : 'Final summary [第1楼]') });
    await f.open(); await f.generate();
    f.click('#melon-expand');
    const ask = async () => {
        const viewer = f.window.document.querySelector('.ldsp-melon-viewer-overlay');
        viewer.querySelector('#viewer-chat-input').value = 'What is supported?';
        viewer.querySelector('#viewer-chat-send').click();
        await waitFor(() => !viewer.querySelector('#viewer-chat-send').disabled);
        return f.requests.at(-1).messages[0].content;
    };
    const fresh = await ask();
    assert.match(fresh, /Digest 1/);
    f.window.document.querySelector('#viewer-close').click();
    await f.restart();
    f.click('[data-tab="history"]');
    f.click('.ldsp-melon-history-expand');
    const saved = await ask();
    assert.equal(saved, fresh);
    assert.ok(f.requests.at(-1).messages.reduce((sum, m) => sum + m.content.length, 0) <= 2000);
    assert.match(f.window.document.querySelector('.ldsp-melon-viewer-chat').textContent, /not the original posts/i);
});

test('window language applies to segments, final summary and follow-ups despite old output-language settings', async t => {
    const f = workflow(t, { body: 'source '.repeat(500), config: { inputBudget: 2000, outputLanguage: 'zh-CN' } });
    await f.open(); await f.generate();
    assert.ok(f.requests.length > 1);
    for (const request of f.requests) assert.match(request.messages[0].content, /Write all summaries and answers in English/);
    f.window.I18n.setLocale('zh-CN');
    f.click('#melon-expand');
    const viewer = f.window.document.querySelector('.ldsp-melon-viewer-overlay');
    viewer.querySelector('#viewer-chat-input').value = 'Explain';
    viewer.querySelector('#viewer-chat-send').click();
    await waitFor(() => !viewer.querySelector('#viewer-chat-send').disabled);
    assert.match(f.requests.at(-1).messages[0].content, /Write all summaries and answers in Simplified Chinese/);
    f.window.document.querySelector('#viewer-close').click();
    const before = f.requests.length;
    await f.generate();
    for (const request of f.requests.slice(before)) assert.match(request.messages[0].content, /Write all summaries and answers in Simplified Chinese/);
});

test('history and displayed answers are isolated when the forum account changes, without deleting legacy storage', async t => {
    const f = workflow(t);
    const user = f.window.document.createElement('a'); user.className = 'current-user'; user.href = '/u/alice';
    f.window.document.body.appendChild(user);
    f.values.set('ldsp_melon_history', JSON.stringify([{ title: 'Unscoped legacy secret', summary: 'Legacy content' }]));
    await f.open(); await f.generate();
    user.href = '/u/bob';
    await waitFor(() => f.panel.querySelector('#melon-output')?.textContent === '');
    f.click('[data-tab="history"]');
    assert.doesNotMatch(f.panel.textContent, /Complete summary|Legacy content/);
    assert.ok(f.values.get('ldsp_melon_history').includes('Legacy content'));
    user.href = '/u/alice';
    await new Promise(resolve => setTimeout(resolve, 550));
    f.click('[data-tab="history"]');
    assert.match(f.panel.textContent, /Complete summary/);
});

test('an account change during a stream cancels it and never stores the old answer in the new account', async t => {
    let pending;
    const f = workflow(t, { respond: (_n, options) => { pending = options; } });
    const user = f.window.document.createElement('a'); user.className = 'current-user'; user.href = '/u/alice'; f.window.document.body.appendChild(user);
    await f.open(); f.click('#melon-summarize'); await waitFor(() => pending);
    user.href = '/u/bob';
    pending.onload(answer('Alice private answer'));
    await waitFor(() => !f.panel.querySelector('#melon-summarize')?.disabled);
    f.click('[data-tab="history"]');
    assert.doesNotMatch(f.panel.textContent, /Alice private answer/);
    user.href = '/u/alice'; await f.restart(); f.click('[data-tab="history"]');
    assert.doesNotMatch(f.panel.textContent, /Alice private answer/);
});

test('settings disclose source sharing, model limits and API format without exposing the key', async t => {
    const f = workflow(t, { config: { apiKey: 'private-fixture-key' } });
    await f.open();
    assert.match(f.panel.textContent, /post content and author/i);
    f.click('[data-tab="settings"]');
    assert.match(f.panel.textContent, /characters.*not tokens/i);
    assert.match(f.panel.textContent, /Chat Completions/);
    assert.match(f.panel.textContent, /HTTPS.*remote/i);
    assert.doesNotMatch(f.panel.textContent, /private-fixture-key/);
    assert.equal(f.panel.querySelector('#melon-api-key').type, 'password');
});

test('existing custom prompts keep their output-language behavior and are never overwritten', async t => {
    const custom = 'Answer in French. My custom prompt.';
    const f = workflow(t, { config: { promptDetailed: custom } });
    await f.open(); await f.generate();
    assert.match(f.requests[0].messages[0].content, /Answer in French\. My custom prompt\./);
    assert.doesNotMatch(f.requests[0].messages[0].content, /Write all summaries and answers in/);
    f.click('[data-tab="settings"]');
    assert.equal(f.panel.querySelector('#melon-prompt-detailed').value, custom);
    assert.equal(f.panel.querySelector('#melon-output-language'), null);
    f.window.I18n.setLocale('zh-CN');
    f.click('[data-tab="settings"]');
    assert.equal(f.panel.querySelector('#melon-prompt-detailed').value, custom);
    f.click('[data-tab="home"]');
    await waitFor(() => f.panel.querySelector('#melon-summarize'));
    await f.generate();
    assert.ok(f.requests.at(-1).messages[0].content.startsWith(custom));
});

test('both default modes request evidence, corrections and uncertainty without altering source posts', async t => {
    const source = 'First claim. Later correction. Disagreement remains.';
    const f = workflow(t, { body: source, config: { outputLanguage: 'en' } });
    await f.open(); f.click('input[value="brief"]'); await f.generate();
    const brief = f.requests.at(-1);
    f.click('input[value="detailed"]'); await f.generate();
    const detailed = f.requests.at(-1);
    for (const request of [brief, detailed]) {
        assert.match(request.messages[0].content, /corrections and disagreements/);
        assert.match(request.messages[0].content, /unverified claims/);
        assert.match(request.messages[0].content, /never invent sources/);
        assert.match(request.messages[1].content, /First claim\. Later correction\. Disagreement remains\./);
    }
    assert.match(brief.messages[0].content, /100/);
    assert.notEqual(brief.messages[0].content, detailed.messages[0].content);
});

test('default prompt previews and AI requests follow the app language in both modes', async t => {
    const f = workflow(t, { config: { outputLanguage: 'pt-BR' } });
    await f.open();
    for (const [locale, briefStart, detailedStart] of [
        ['en-US', 'Answer in English.', 'Answer in English.'],
        ['zh-CN', '请用简体中文回答。', '请用简体中文回答。'],
        ['en-US', 'Answer in English.', 'Answer in English.']
    ]) {
        f.window.I18n.setLocale(locale);
        f.click('[data-tab="settings"]');
        const brief = f.panel.querySelector('#melon-prompt-brief');
        const detailed = f.panel.querySelector('#melon-prompt-detailed');
        assert.ok(brief.placeholder.startsWith(briefStart));
        assert.ok(detailed.placeholder.startsWith(detailedStart));
        assert.equal(brief.value, '', 'A default preview must not become a saved custom prompt');
        assert.equal(detailed.value, '');
        for (const [mode, preview] of [['brief', brief.placeholder], ['detailed', detailed.placeholder]]) {
            f.click('[data-tab="home"]');
            await waitFor(() => f.panel.querySelector('#melon-summarize'));
            f.click(`input[value="${mode}"]`); await f.generate();
            assert.ok(f.requests.at(-1).messages[0].content.startsWith(preview));
            assert.match(f.requests.at(-1).messages[0].content, locale === 'en-US' ? /answers in English/ : /answers in Simplified Chinese/);
            assert.doesNotMatch(f.requests.at(-1).messages[0].content, locale === 'en-US' ? /answers in Simplified Chinese|请用.*中文回答|Brazilian Portuguese/ : /Answer in English|answers in English|Brazilian Portuguese/);
        }
    }
});

test('stopping a partial summary and reopening Home keeps Resume available without saving it as complete', async t => {
    let pending;
    const f = workflow(t, { respond: (_n, options) => {
        pending = options;
        options.onprogress({ status: 200, responseText: 'data: {"choices":[{"delta":{"content":"Partial draft"}}]}\n\n' });
    } });
    await f.open(); f.click('#melon-summarize'); await waitFor(() => pending);
    f.click('.ldsp-melon-btn-stop:not([hidden])');
    await waitFor(() => !f.panel.querySelector('#melon-summarize').disabled);
    f.click('[data-tab="history"]'); f.click('.ldsp-melon-history-view');
    assert.match(f.panel.querySelector('.ldsp-melon-history-detail-meta').textContent, /Partial/);
    f.click('[data-tab="home"]'); await waitFor(() => f.panel.querySelector('#melon-resume'));
    assert.equal(f.panel.querySelector('#melon-resume').hidden, false);
    assert.match(f.panel.querySelector('#melon-output').textContent, /Partial draft/);
});

test('switching topics while the panel is closed never restores another topic’s answer', async t => {
    const f = workflow(t);
    await f.open(); await f.generate(); f.click('.ldsp-melon-close');
    f.window.history.pushState({}, '', '/t/43'); f.show();
    await waitFor(() => f.panel.querySelector('#melon-retry-info'));
    assert.doesNotMatch(f.panel.textContent, /Complete summary/);
});

test('follow-ups that cannot fit are refused without another AI request', async t => {
    const f = workflow(t, { config: { inputBudget: 2000 }, respond: () => answer('x'.repeat(2200)) });
    await f.open(); await f.generate(); f.click('#melon-expand');
    const viewer = f.window.document.querySelector('.ldsp-melon-viewer-overlay');
    viewer.querySelector('#viewer-chat-input').value = 'Question';
    viewer.querySelector('#viewer-chat-send').click();
    assert.equal(f.requests.length, 1);
    assert.equal(viewer.querySelector('#viewer-chat-input').value, 'Question');
});

test('follow-up retrieval sends real topic text only when selected and validates citation links', async t => {
    const f = workflow(t, { config: { inputBudget: 6000 }, body: 'Exact original detail: storage corrected to 50 GB.',
        respond: n => answer(n === 1 ? 'A short summary [第1楼]' : 'Storage is 50 GB [第1楼]. Unsupported [第99楼].') });
    await f.open(); await f.generate(); f.click('#melon-expand');
    const viewer = f.window.document.querySelector('.ldsp-melon-viewer-overlay');
    const ask = async question => {
        viewer.querySelector('#viewer-chat-input').value = question;
        viewer.querySelector('#viewer-chat-send').click();
        await waitFor(() => !viewer.querySelector('#viewer-chat-send').disabled);
    };
    await ask('What is the storage?');
    assert.doesNotMatch(JSON.stringify(f.requests.at(-1)), /Exact original detail/);
    viewer.querySelector('#viewer-chat-sources').checked = true;
    await ask('Check the storage in [第1楼]');
    const sent = f.requests.at(-1).messages;
    assert.match(sent[0].content, /Exact original detail: storage corrected to 50 GB/);
    assert.match(sent[0].content, /partial selection/);
    assert.ok(sent.reduce((sum, item) => sum + item.content.length, 0) <= 6000);
    assert.match(viewer.querySelector('#viewer-source-status').textContent, /sent 1 excerpts/);
    const last = viewer.querySelector('#viewer-chat-content').lastElementChild;
    assert.match(last.querySelector('a').href, /\/t\/42\/1$/);
    assert.equal(last.querySelector('a[href$="/99"]'), null);
    assert.match(last.textContent, /outside the supplied evidence: 99/);
});

test('failed original-reply retrieval preserves the question and never sends an AI request', async t => {
    let reads = 0;
    const f = workflow(t, { fetchImpl: async () => {
        reads++;
        if (reads > 1) return new Response('{}', { status: 403 });
        return new Response(JSON.stringify({ id: 42, title: 'Topic', posts_count: 1, highest_post_number: 1,
            post_stream: { posts: [{ id: 1, topic_id: 42, post_number: 1, username: 'alice', cooked: '<p>Source</p>' }] } }));
    } });
    await f.open(); await f.generate(); f.click('#melon-expand');
    const viewer = f.window.document.querySelector('.ldsp-melon-viewer-overlay');
    viewer.querySelector('#viewer-chat-sources').checked = true;
    viewer.querySelector('#viewer-chat-input').value = 'Verify original replies';
    viewer.querySelector('#viewer-chat-send').click();
    await waitFor(() => !viewer.querySelector('#viewer-chat-send').disabled);
    assert.equal(f.requests.length, 1);
    assert.equal(viewer.querySelector('#viewer-chat-input').value, 'Verify original replies');
});

test('closing the viewer during original-reply retrieval prevents a delayed AI call', async t => {
    let reads = 0, release;
    const source = () => new Response(JSON.stringify({ id: 42, title: 'Topic', posts_count: 1, highest_post_number: 1,
        post_stream: { posts: [{ id: 1, topic_id: 42, post_number: 1, username: 'alice', cooked: '<p>Private source</p>' }] } }));
    const f = workflow(t, { fetchImpl: async () => ++reads === 1 ? source() : new Promise(resolve => { release = () => resolve(source()); }) });
    await f.open(); await f.generate(); f.click('#melon-expand');
    const viewer = f.window.document.querySelector('.ldsp-melon-viewer-overlay');
    viewer.querySelector('#viewer-chat-sources').checked = true;
    viewer.querySelector('#viewer-chat-input').value = 'Read the original';
    viewer.querySelector('#viewer-chat-send').click();
    await waitFor(() => release);
    viewer.querySelector('#viewer-close').click(); release();
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(f.requests.length, 1);
});

test('an ambiguous signed-in session cannot read anonymous history', async t => {
    const f = workflow(t);
    f.window.document.documentElement.classList.add('anon');
    await f.open(); await f.generate();
    f.window.document.documentElement.classList.remove('anon');
    const token = f.window.document.createElement('meta'); token.name = 'csrf-token'; token.content = 'new-session'; f.window.document.head.appendChild(token);
    await new Promise(resolve => setTimeout(resolve, 550));
    f.click('[data-tab="history"]');
    assert.doesNotMatch(f.panel.textContent, /Complete summary/);
});

test('an account switch closes an active follow-up and discards delayed private replies', async t => {
    let pending;
    const f = workflow(t, { respond: (n, options) => {
        if (n === 1) return answer('Alice summary [第1楼]');
        pending = options;
    } });
    const user = f.window.document.createElement('a'); user.className = 'current-user'; user.href = '/u/alice'; f.window.document.body.appendChild(user);
    await f.open(); await f.generate(); f.click('#melon-expand');
    const viewer = f.window.document.querySelector('.ldsp-melon-viewer-overlay');
    viewer.querySelector('#viewer-chat-input').value = 'Private question';
    viewer.querySelector('#viewer-chat-send').click();
    await waitFor(() => pending);
    user.href = '/u/bob';
    pending.onprogress({ status: 200, responseText: 'data: {"choices":[{"delta":{"content":"Alice private reply"}}]}\n\n' });
    pending.onload(answer('Alice private reply'));
    await waitFor(() => !f.window.document.querySelector('.ldsp-melon-viewer-overlay'));
    f.click('[data-tab="history"]');
    assert.doesNotMatch(f.window.document.body.textContent, /Alice summary|Alice private reply|Private question/);
});
