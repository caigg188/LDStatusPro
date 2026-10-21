export function abortError() {
    const error = new Error('已停止');
    error.name = 'AbortError';
    return error;
}

export function checkAbort(signal) {
    if (signal?.aborted) throw abortError();
}

export function sleep(ms, signal) {
    checkAbort(signal);
    return new Promise((resolve, reject) => {
        const finish = () => { signal?.removeEventListener('abort', stop); resolve(); };
        const timer = setTimeout(finish, Math.max(0, ms));
        const stop = () => { clearTimeout(timer); signal?.removeEventListener('abort', stop); reject(abortError()); };
        signal?.addEventListener('abort', stop, { once: true });
    });
}

export function retryDelay(response, body, now = Date.now()) {
    const header = response.headers?.get('retry-after');
    if (header && /^\d+(?:\.\d+)?$/.test(header)) return Math.ceil(Number(header) * 1000);
    if (header && Number.isFinite(Date.parse(header))) return Math.max(0, Date.parse(header) - now);
    const seconds = Number(body?.extras?.wait_seconds ?? body?.wait_seconds ?? body?.error?.retryAfter);
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 120000;
}

/** A forum-only queue: never shares credentials or cooldown with the LDSP APIs. */
export class TopicContentClient {
    constructor({ origin, fetchImpl = (...args) => globalThis.fetch(...args), identity = () => '', csrf = () => '', interval = 1000, jitter = () => Math.random() * 250, wait = sleep, now = Date.now } = {}) {
        this.origin = origin;
        this.fetchImpl = fetchImpl;
        this.identity = identity;
        this.csrf = csrf;
        this.interval = interval;
        this.jitter = jitter;
        this.wait = wait;
        this.now = now;
        this.tail = Promise.resolve();
        this.nextRequest = 0;
        this.cooldownUntil = 0;
        this.cache = new Map();
        this.account = identity();
        this.generation = 0;
    }

    clear(topicId) {
        if (topicId) this.cache.delete(String(topicId));
        else { this.cache.clear(); this.generation++; }
    }

    _scope() {
        const account = this.identity();
        if (account !== this.account) { this.clear(); this.account = account; }
        return this.generation;
    }

    async _request(path, { signal, onProgress } = {}) {
        const generation = this._scope();
        const run = async () => {
            for (let attempt = 0; attempt < 3; attempt++) {
                checkAbort(signal);
                if (this._scope() !== generation) throw abortError();
                const delay = Math.max(this.nextRequest, this.cooldownUntil) - this.now();
                if (delay > 0) {
                    onProgress?.({ stage: 'wait', message: this.cooldownUntil > this.now() ? '站点限流，等待后继续…' : '正在按间隔读取…', detail: `等待约 ${Math.ceil(delay / 1000)} 秒，可随时停止` });
                    await this.wait(delay, signal);
                }
                checkAbort(signal);
                if (this._scope() !== generation) throw abortError();
                this.nextRequest = this.now() + this.interval + this.jitter();
                const controller = new AbortController();
                const stop = () => controller.abort();
                signal?.addEventListener('abort', stop, { once: true });
                const timeout = setTimeout(stop, 30000);
                let response, body;
                try {
                    response = await this.fetchImpl(`${this.origin}${path}`, {
                        credentials: 'same-origin', signal: controller.signal,
                        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(this.csrf() ? { 'X-CSRF-Token': this.csrf() } : {}) }
                    });
                    const text = await response.text();
                    checkAbort(signal);
                    if (this._scope() !== generation) throw abortError();
                    try { body = JSON.parse(text); } catch { body = null; }
                    if (response.status === 429) {
                        this.cooldownUntil = this.now() + retryDelay(response, body, this.now());
                        if (attempt < 2) continue;
                        throw Object.assign(new Error(`站点限流，请约 ${Math.ceil((this.cooldownUntil - this.now()) / 1000)} 秒后重试`), { status: 429 });
                    }
                    if (response.status === 401 || response.status === 403 || /\/login(?:[/?]|$)/.test(response.url || '')) {
                        throw Object.assign(new Error('当前登录或访问权限不可用，请先在站点完成登录或验证'), { status: response.status || 403 });
                    }
                    if (!response.ok) throw Object.assign(new Error(`读取帖子失败（HTTP ${response.status}）`), { status: response.status });
                    if (!body || typeof body !== 'object') throw Object.assign(new Error('站点返回了非 JSON 内容，请在网页检查登录或访问验证'), { status: 403 });
                    return body;
                } catch (error) {
                    checkAbort(signal);
                    if (this._scope() !== generation) throw abortError();
                    if (error.status && error.status < 500 || attempt === 2) throw error;
                    onProgress?.({ stage: 'wait', message: '读取暂时失败，稍后重试…' });
                    await this.wait(1000 * 2 ** attempt, signal);
                } finally {
                    clearTimeout(timeout);
                    signal?.removeEventListener('abort', stop);
                }
            }
        };
        const result = this.tail.then(run, run);
        this.tail = result.catch(() => {});
        return result;
    }

    _merge(entry, posts) {
        for (const post of posts || []) {
            if (String(post.topic_id ?? entry.info.id) !== String(entry.info.id)) throw new Error('站点返回了不属于当前话题的帖子');
            if (post.id && Number.isInteger(post.post_number) && !post.deleted_at && !post.hidden) entry.posts.set(post.id, post);
        }
    }

    async getTopic(topicId, options = {}) {
        this._scope();
        const key = String(topicId);
        const cached = this.cache.get(key);
        if (!options.refresh && cached && this.now() - cached.at < 300000) return cached.info;
        if (options.refresh) this.clear(key);
        const data = await this._request(`/t/${encodeURIComponent(key)}.json`, options);
        checkAbort(options.signal);
        if (String(data.id) !== key || !Array.isArray(data.post_stream?.posts)) throw new Error('话题信息格式异常');
        const info = {
            id: key, title: data.title || '未命名话题', postsCount: data.posts_count || 0,
            highestPostNumber: data.highest_post_number || Math.max(1, ...data.post_stream.posts.map(p => p.post_number)),
            views: data.views || 0, likeCount: data.like_count || 0,
            tags: (data.tags || []).map(tag => typeof tag === 'string' ? tag : tag.name).filter(Boolean),
            createdAt: data.created_at, lastPostedAt: data.last_posted_at
        };
        const entry = { info, at: this.now(), posts: new Map(), coverage: [] };
        this._merge(entry, data.post_stream.posts);
        const numbers = data.post_stream.posts.map(p => p.post_number);
        if (numbers.includes(1)) entry.coverage.push([0, Math.max(...numbers)]);
        this.cache.set(key, entry);
        // Bound memory to the current few topics, without persisting forum bodies.
        if (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value);
        return info;
    }

    async getPosts(topicId, start, end, options = {}) {
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) throw new Error('请输入有效的整数楼层范围');
        const info = await this.getTopic(topicId, options);
        const entry = this.cache.get(String(topicId));
        const generation = this.generation;
        const last = Math.min(end, info.highestPostNumber);
        let cursor = start - 1;
        while (cursor < last) {
            checkAbort(options.signal);
            if (this._scope() !== generation || this.cache.get(String(topicId)) !== entry) throw abortError();
            const covered = entry.coverage.filter(([from, to]) => from <= cursor && to > cursor);
            if (covered.length) { cursor = Math.max(...covered.map(([, to]) => to)); continue; }
            options.onProgress?.({ stage: 'fetch', message: `正在读取第 ${cursor + 1}—${last} 楼…`, detail: '楼层空缺保留原编号，只读取当前账户可见的内容', current: cursor - start + 1, total: last - start + 1 });
            const data = await this._request(`/t/${encodeURIComponent(topicId)}/posts.json?post_number=${cursor}&asc=true&include_suggested=false&include_related=false`, options);
            if (!Array.isArray(data.post_stream?.posts)) throw new Error('帖子正文格式异常');
            const posts = data.post_stream.posts;
            const next = posts.length ? Math.max(...posts.map(p => p.post_number)) : last;
            if (!Number.isFinite(next) || next <= cursor) throw new Error('站点未返回后续楼层，请刷新后重试');
            this._merge(entry, posts);
            entry.coverage.push([cursor, next]);
            cursor = next;
        }
        checkAbort(options.signal);
        if (this._scope() !== generation) throw abortError();
        const posts = [...entry.posts.values()].filter(p => p.post_number >= start && p.post_number <= last).sort((a, b) => a.post_number - b.post_number);
        return { topic: info, posts, range: { start, end: last }, warnings: posts.length ? [] : ['所选范围没有当前账户可见的帖子'] };
    }
}
