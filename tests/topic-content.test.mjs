import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TopicContentClient, retryDelay, sleep } from '../src/core/topic-content.mjs';

const origin = 'https://forum.invalid';
const post = number => ({ id: 1000 + number, topic_id: 42, post_number: number, cooked: `<p>第${number}楼</p>` });
const response = (data, status = 200, headers = {}) => new Response(typeof data === 'string' ? data : JSON.stringify(data), { status, headers });
function fixture(fetchImpl, options = {}) {
    let clock = 10000;
    const waits = [];
    return { waits, client: new TopicContentClient({ origin, fetchImpl, now: () => clock, jitter: () => 0, wait: async (ms, signal) => { if (signal?.aborted) throw Object.assign(new Error(), { name: 'AbortError' }); waits.push(ms); clock += ms; }, ...options }) };
}

test('real floor range reaches the tail despite deleted floors; body cache is reused across readers', async () => {
    const calls = [];
    const { client } = fixture(async url => {
        calls.push(url);
        if (url.endsWith('.json')) return response({ id: 42, title: '有空缺的话题', posts_count: 478, highest_post_number: 495, post_stream: { posts: [post(1), post(2)] } });
        assert.match(url, /post_number=489&asc=true/);
        return response({ post_stream: { posts: [post(495), post(491), post(491), post(492)] } });
    });
    const result = await client.getPosts(42, 490, 495);
    assert.deepEqual(result.posts.map(value => value.post_number), [491, 492, 495]);
    assert.equal(result.topic.postsCount, 478);
    assert.equal(result.topic.highestPostNumber, 495);
    await client.getPosts(42, 491, 495);
    assert.equal(calls.length, 2);
    await client.getPosts(42, 1, 2);
    assert.equal(calls.length, 2);
});

test('gaps, unordered batches and already loaded head do not shift the selected floors', async () => {
    const cursors = [];
    const { client } = fixture(async url => {
        if (url.endsWith('.json')) return response({ id: 42, posts_count: 6, highest_post_number: 10, post_stream: { posts: [post(1), post(3)] } });
        const cursor = Number(new URL(url).searchParams.get('post_number')); cursors.push(cursor);
        return response({ post_stream: { posts: cursor === 3 ? [post(8), post(5)] : [post(10), post(9)] } });
    });
    const { posts } = await client.getPosts(42, 1, 9);
    assert.deepEqual(posts.map(value => value.post_number), [1, 3, 5, 8, 9]);
    assert.deepEqual(cursors, [3, 8]);
});

test('429 waits for server delay; 403 and challenge HTML stop without retry', async () => {
    let calls = 0;
    const { client, waits } = fixture(async () => ++calls === 1 ? response({ extras: { wait_seconds: 7 } }, 429) : response({ id: 42, highest_post_number: 1, post_stream: { posts: [post(1)] } }));
    await client.getPosts(42, 1, 1);
    assert.equal(calls, 2); assert.ok(waits.includes(7000));
    for (const data of [response({}, 403), response('<html>verify</html>')]) {
        let count = 0;
        const denied = fixture(async () => { count++; return data; }).client;
        await assert.rejects(denied.getTopic(42), /登录|验证/); assert.equal(count, 1);
    }
    assert.equal(retryDelay(response({}, 429, { 'retry-after': '3' }), {}), 3000);
    assert.equal(retryDelay(response({}, 429, { 'retry-after': new Date(20000).toUTCString() }), {}, 10000), 10000);
});

test('network errors retry twice; a cancelled queued operation never fetches', async () => {
    let calls = 0;
    const client = fixture(async () => { calls++; throw new TypeError('offline'); }).client;
    await assert.rejects(client.getTopic(42), /offline/); assert.equal(calls, 3);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(client.getTopic(42, { signal: controller.signal }), { name: 'AbortError' }); assert.equal(calls, 3);
    const pending = new AbortController(); const waiting = sleep(60000, pending.signal); pending.abort();
    await assert.rejects(waiting, { name: 'AbortError' });
});

test('identity changes invalidate cached content and reject old responses', async () => {
    let identity = 'one', complete, calls = 0;
    const { client } = fixture(async () => {
        calls++;
        if (calls === 1) await new Promise(resolve => { complete = resolve; });
        return response({ id: 42, highest_post_number: 1, post_stream: { posts: [post(1)] } });
    }, { identity: () => identity });
    const old = client.getTopic(42);
    await new Promise(resolve => setImmediate(resolve)); identity = 'two'; complete();
    await assert.rejects(old, { name: 'AbortError' });
    await client.getTopic(42); assert.equal(calls, 2);
});

test('non advancing responses fail rather than reporting a complete archive', async () => {
    const { client } = fixture(async url => response(url.endsWith('.json') ? { id: 42, highest_post_number: 5, post_stream: { posts: [post(1)] } } : { post_stream: { posts: [post(1)] } }));
    await assert.rejects(client.getPosts(42, 1, 5), /后续楼层/);
});

test('default fetch keeps the global receiver required by native browsers', async t => {
    const original = globalThis.fetch;
    t.after(() => { globalThis.fetch = original; });
    globalThis.fetch = function () {
        assert.equal(this, globalThis);
        return Promise.resolve(response({ id: 42, highest_post_number: 1, post_stream: { posts: [post(1)] } }));
    };
    const client = new TopicContentClient({ origin });
    assert.equal((await client.getTopic(42)).id, '42');
});
