import fs from 'node:fs';
import { JSDOM } from 'jsdom';

export function componentSource() {
    const source = fs.readFileSync(new URL('../../LDStatusPro.user.js', import.meta.url), 'utf8');
    const core = source.slice(source.indexOf('// @@CORE_SANITIZE_BEGIN') + '// @@CORE_SANITIZE_BEGIN'.length, source.indexOf('// @@CORE_SANITIZE_END'));
    const shared = source.slice(source.indexOf('        let topicContentClient;'), source.indexOf('        const LDSPDialog'));
    const melon = source.slice(source.indexOf('        class MelonHelper'), source.indexOf('        class FollowManager'));
    const styles = source.slice(source.indexOf('        const Styles ='), source.indexOf('        const Tooltip ='));
    return `${core}\n${styles}\n${shared}\n${melon}\nObject.assign(globalThis, { TopicExporter, MelonHelper, SafeDom, Styles });`;
}

export function componentWindow({ fetchImpl, gm, config = {} } = {}) {
    const dom = new JSDOM('<div id="ldsp-panel" class="light"><div id="panel-body"></div></div>', { url: 'https://forum.invalid/t/42', runScripts: 'outside-only', pretendToBeVisual: true });
    const values = new Map([['ldsp_melon_config', JSON.stringify(config)]]);
    const { window } = dom;
    Object.assign(window, {
        fetch: fetchImpl || (() => { throw new Error('External network blocked in component tests'); }),
        GM_xmlhttpRequest: gm || (() => { throw new Error('External GM requests blocked in component tests'); }),
        GM_getValue: (key, fallback) => values.get(key) ?? fallback,
        GM_setValue: (key, value) => values.set(key, value),
        Logger: { log() {}, error() {}, warn() {} },
        UI: { empty: ({ text }) => text },
        Screen: { getConfig: () => ({}) },
        Utils: { escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]), hexToRgb: () => ({ r: 0, g: 0, b: 0 }) }
    });
    window.eval(componentSource());
    return { dom, window, values, panel: window.document.querySelector('#panel-body'), renderer: { showToast() {} } };
}

export const topicMetadata = { id: 42, title: '隔离样例 · 图文与复杂内容', posts_count: 7, highest_post_number: 10, post_stream: { posts: [
    { id: 1, topic_id: 42, post_number: 1, username: 'fixture', name: '示例作者', created_at: '2026-10-20T00:00:00Z', cooked: '<h2 id="heading">标题与 <em>强调</em></h2><p>正文与表情 <img class="emoji" src="/fixture.png" alt=":smile:"></p><a class="lightbox" href="/fixture.png" title="原图"><img src="/missing.png" data-src="/fixture.png"></a><pre><code class="language-js">const x = 1;\n\n\nconsole.log(x);\n</code></pre><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>甲</td><td>乙</td></tr></tbody></table><details><summary>展开详情</summary><p>隐藏的内容完整保留</p></details><aside class="quote"><blockquote><p>这是引用</p></blockquote></aside><p class="spoiler">剧透示例</p><iframe src="https://video.invalid/fixture" title="媒体示例"></iframe><span class="math">E=mc^2</span>' },
    { id: 3, topic_id: 42, post_number: 3, username: 'reply', created_at: '2026-10-20T01:00:00Z', cooked: '<p>回复内容与来源楼层。</p>', reply_to_post_number: 1 }
] } };
