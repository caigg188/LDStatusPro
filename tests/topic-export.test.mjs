import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { cleanExportHTML, exportUrl, prepareExportHTML, htmlToMarkdown, ExportResources } from '../src/core/topic-export.mjs';
import { renderMarkdown } from '../src/core/sanitize.mjs';

const origin = 'https://forum.invalid';
const { window } = new JSDOM('', { url: origin });
const document = window.document;

test('archive removes executable markup, normalizes links and chooses the full lightbox image', async () => {
    const seen = [];
    const html = await prepareExportHTML('<h2 id="title">A <em>heading</em></h2><a href="#title">jump</a><script>alert(1)</script><img src="/x" onerror="alert(1)"><a href="javascript:alert(1)">bad</a><a class="lightbox" href="//cdn.invalid/full.png" title="原图"><img src="/thumb" srcset="/preview 2x" data-src="/lazy" loading="lazy"></a>', { document, origin, postNumber: 2, embed: true, resources: { embed: async url => { seen.push(url); return 'data:image/png;base64,YQ=='; } } });
    assert.ok(!html.includes('<script') && !html.includes('onerror') && !html.includes('javascript:'));
    assert.ok(!html.includes('srcset') && !html.includes('data-src'));
    assert.ok(html.includes('<em>heading</em>'));
    assert.ok(html.includes('href="#post-2-title"'));
    assert.deepEqual(seen, [origin + '/x', 'https://cdn.invalid/full.png']);
    assert.equal(exportUrl('javascript:alert(1)', origin), '');
});

test('media, math source, folding, emoji and complex tables preserve meaningful content', async () => {
    const html = await prepareExportHTML('<details><summary>展开</summary><p>内容</p></details><iframe src="https://video.invalid/embed/1" title="演示"></iframe><span class="math">x^2</span><img class="emoji" src="/emoji.png" alt=":smile:"><table><tr><td colspan="2">合并</td></tr></table>', { document, origin, pdf: true });
    assert.match(html, /<details open="">/); assert.match(html, /演示/); assert.ok(!html.includes('iframe'));
    const md = htmlToMarkdown(html, { document, origin });
    assert.match(md, /x\^2/); assert.match(md, /colspan="2"/); assert.match(md, /:smile:/);
});

test('Discourse lightbox icons do not create blank print areas and static SVG paint references survive namespacing', async () => {
    const html = await prepareExportHTML('<div class="lightbox-wrapper"><a class="lightbox" href="/image.png"><img src="/thumb.png"><div class="meta"><svg class="svg-icon"><use href="/sprites.svg#image"></use></svg><span class="filename">图</span><span class="informations">1262×572</span><svg class="svg-icon"></svg></div></a></div><svg viewBox="0 0 10 10"><defs><linearGradient id="paint"><stop stop-color="red"/></linearGradient></defs><rect width="10" height="10" fill="url(#paint)"/></svg>', { document, origin, postNumber: 3 });
    assert.ok(!html.includes('svg-icon'));
    assert.match(html, /export-image-caption/);
    assert.match(html, /图 · 1262×572/);
    assert.match(html, /id="post-3-paint"/);
    assert.match(html, /fill="url\(#post-3-paint\)"/);
});

test('Markdown preserves code whitespace, escaping, long fences, list numbering and headerless tables', () => {
    const source = '<p>literal * and [label]</p><p>1. literal number</p><p>- literal dash</p><p>~~literal tildes~~</p><pre><code class="language-js">a\n\n\n````\nb\n</code></pre><ol start="9"><li>nine<ul><li>child</li></ul></li><li>ten</li></ol><table><tr><td>first</td></tr><tr><td>second</td></tr></table>';
    const md = htmlToMarkdown(source, { document, origin });
    assert.ok(md.includes('literal \\* and \\[label\\]'));
    assert.ok(md.includes('1\\. literal number')); assert.ok(md.includes('\\- literal dash')); assert.ok(md.includes('\\~\\~literal tildes\\~\\~'));
    assert.ok(md.includes('`````js\na\n\n\n````\nb\n`````'));
    assert.match(md, /9\. nine/); assert.match(md, /10\. ten/); assert.match(md, /\n   - child/);
    assert.equal((md.match(/first/g) || []).length, 1);
    const indented = htmlToMarkdown('\n    <p>normal  words\n    wrap</p>\n    <div>\n        <a href="/x">link</a>\n    </div>', { document, origin });
    assert.ok(indented.includes('normal words wrap'));
    assert.ok(!renderMarkdown(indented).includes('<pre'));
});

test('model Markdown formats tables and nested lists without loading remote model images; only known floors link', () => {
    const html = renderMarkdown('|a|b|\n|-|-|\n|1|2|\n\n- **item**\n  - child\n\n[第491楼] [第999楼]\n\n![x](https://track.invalid/image)', { site: origin, topicId: 42, postNumbers: [491] });
    assert.match(html, /<table>/); assert.match(html, /<strong>item<\/strong>/); assert.match(html, /href="https:\/\/forum.invalid\/t\/42\/491"/);
    assert.ok(!html.includes('/42/999') && !html.includes('<img'));
    assert.ok(!cleanExportHTML('<img src=x onerror=alert(1)><svg onload=alert(1)></svg>', document).includes('onerror'));
});

test('assets are deduplicated, bounded and visibly reported when they cannot be embedded', async () => {
    let calls = 0;
    const resources = new ExportResources({ document, origin, interval: 0, maxImage: 4, gm: options => {
        calls++; queueMicrotask(() => options.onload({ status: 200, response: new window.Blob(['12345'], { type: 'image/png' }) })); return { abort() {} };
    } });
    const url = 'https://cdn.invalid/image.png';
    assert.deepEqual(await Promise.all([resources.embed(url), resources.embed(url)]), [url, url]);
    assert.equal(calls, 1); assert.equal(resources.warnings.length, 1);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(new ExportResources({ document, origin, signal: controller.signal }).embed(url), { name: 'AbortError' });
});
