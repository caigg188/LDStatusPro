import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { parse } from 'acorn';
import MarkdownIt from 'markdown-it';
import { chromium } from 'playwright';
import { prepareExportHTML, htmlToMarkdown } from '../src/core/topic-export.mjs';
import { assertIndentSafe } from '../scripts/embed-core.mjs';

const origin = 'https://forum.invalid';
const { window } = new JSDOM('', { url: origin });
const document = window.document;
const userscript = readFileSync(new URL('../LDStatusPro.user.js', import.meta.url), 'utf8');

// Markup modelled on what the forum actually serves ("cooked" post HTML).
const icon = name => `<svg class="fa d-icon d-icon-${name} svg-icon" aria-hidden="true"><use href="#${name}"></use></svg>`;
const lightbox = (id, info) => `<div class="lightbox-wrapper"><a class="lightbox" href="https://cdn.invalid/original/${id}.png" title="image"><img src="https://cdn.invalid/optimized/${id}_2_335x500.png" alt="image" width="335" height="500" srcset="https://cdn.invalid/optimized/${id}_2_335x500.png, https://cdn.invalid/original/${id}.png 2x"><div class="meta">${icon('far-image')}<span class="filename">image</span><span class="informations">${info}</span>${icon('discourse-expand')}</div></a></div>`;
const FIXTURES = {
    paragraphs: `<p>第一行<br>\n第二行：<br>\n<a href="https://forum.invalid/t/1">链接标题</a></p>\n<p>第二段</p>\n<p>${lightbox('a1', '576×858 131 KB')}<br>\n图后文字<br>\n${lightbox('b2', '1117×846 221 KB')}</p>`,
    inline: `<p>普通 <strong>加粗</strong>、<em>斜体</em>、<s>删除</s>、<code>inline  code</code>、<kbd>Ctrl</kbd>+<kbd>C</kbd>、<mark>高亮</mark>、H<sub>2</sub>O、x<sup>2</sup>、<a class="mention" href="/u/neo">@neo</a> <img src="https://cdn.invalid/emoji/smile.png" title=":smile:" class="emoji" alt=":smile:"> <a class="hashtag-cooked" href="/c/dev/4"><span class="hashtag-icon-placeholder">${icon('square-full')}</span><span>开发</span></a></p>`,
    headings: `<h2><a name="h-1" class="anchor" href="#h-1"></a>一级标题</h2>\n<p>内容</p>\n<h3><a class="anchor" href="#h-2"></a>二级 <code>code</code></h3>\n<hr>\n<h4>三级</h4>`,
    lists: `<ul>\n<li>一</li>\n<li>二\n<ul>\n<li>二点一</li>\n<li>二点二 <strong>粗</strong></li>\n</ul>\n</li>\n</ul>\n<ol start="3">\n<li>三</li>\n<li>四<pre><code class="lang-bash">echo hi\n</code></pre></li>\n</ol>\n<ul><li><span class="chcklst-box fa fa-square-o fa-fw"></span> 待办</li><li><span class="chcklst-box checked fa fa-square-check-o fa-fw"></span> 完成</li></ul>`,
    code: `<p>代码：</p>\n<pre data-code-wrap="python"><code class="lang-python">def f(x):\n    return x * 2\n\n\nprint(f"{f(2)}")\n</code></pre>\n<pre><code class="lang-auto">  indented first line\n\`\`\`\nfence inside\n\`\`\`\n</code></pre>\n<p>后文</p>`,
    quote: `<aside class="quote no-group" data-username="neo" data-post="2" data-topic="1">\n<div class="title">\n<div class="quote-controls"></div>\n<img alt="" width="24" height="24" src="https://forum.invalid/a.png" class="avatar"> neo:</div>\n<blockquote>\n<p>第一段引用</p>\n<p>第二段引用</p>\n</blockquote>\n</aside>\n<p>我的回复</p>\n<blockquote>\n<p>普通引用<br>\n第二行</p>\n<blockquote><p>嵌套</p></blockquote>\n</blockquote>`,
    table: `<div class="md-table">\n<table>\n<thead>\n<tr>\n<th>型号</th>\n<th style="text-align:right">价格</th>\n<th style="text-align:center">备注</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>A | B</td>\n<td style="text-align:right">$1</td>\n<td style="text-align:center"><code>x</code></td>\n</tr>\n<tr>\n<td>多行<br>内容</td>\n<td style="text-align:right">$2</td>\n<td style="text-align:center"></td>\n</tr>\n</tbody>\n</table>\n</div>`,
    onebox: `<aside class="onebox githubrepo" data-onebox-src="https://github.invalid/a/b">\n  <header class="source">\n      <img src="https://github.invalid/favicon.ico" class="site-icon" width="16" height="16">\n\n      <a href="https://github.invalid/a/b" target="_blank">github.invalid</a>\n  </header>\n\n  <article class="onebox-body">\n    <div class="github-row">\n  <img width="690" height="344" src="https://cdn.invalid/optimized/t.png" class="thumbnail">\n\n  <h3><a href="https://github.invalid/a/b" target="_blank">GitHub - a/b</a></h3>\n\n    <p><span class="github-repo-description">仓库描述</span></p>\n</div>\n\n  </article>\n\n  <div class="onebox-metadata">\n    \n    \n  </div>\n\n  <div style="clear: both"></div>\n</aside>\n<p><a href="https://forum.invalid/t/topic/1" class="inline-onebox">内联链接</a></p>`,
    media: `<p>视频：</p>\n<div class="video-placeholder-container" data-video-src="https://cdn.invalid/v1.mp4"></div>\n<div class="onebox video-onebox"><video controls=""><source src="https://cdn.invalid/v2.mp4"><a href="https://cdn.invalid/v2.mp4">v2.mp4</a></video></div>\n<p><a class="attachment" href="/uploads/short-url/abc.zip">文件.zip</a> (1.2 MB)</p>`,
    fold: `<details>\n<summary>\n点击展开</summary>\n<p>折叠 <strong>内容</strong></p>\n<pre><code class="lang-js">let a = 1;\n</code></pre>\n</details>\n<p><span class="spoiler">剧透文字</span></p>`
};

const prepare = html => prepareExportHTML(html, { document, origin, postNumber: 1, topicId: '1' });
const toMarkdown = async html => htmlToMarkdown(await prepare(html), { document, origin });

test('the build never indents the inside of a string: multi-line templates are rejected', () => {
    assert.doesNotThrow(() => assertIndentSafe('const a = `one line ${1}`; const b = "x\\ny";'));
    assert.throws(() => assertIndentSafe('const a = `first\nsecond`;'), /multi-line template literal/);
    const begin = userscript.indexOf('// @@CORE_SANITIZE_BEGIN');
    const end = userscript.indexOf('// @@CORE_SANITIZE_END');
    const bundle = userscript.slice(userscript.indexOf('\n', userscript.indexOf('prettier-ignore', begin)) + 1, userscript.lastIndexOf('\n', end));
    assert.doesNotThrow(() => assertIndentSafe(bundle), 'the embedded SafeDom bundle must not contain multi-line templates');
});

test('the SafeDom bundle shipped inside the userscript converts exactly like the tested source', async () => {
    const begin = userscript.indexOf('// @@CORE_SANITIZE_BEGIN');
    const end = userscript.indexOf('// @@CORE_SANITIZE_END');
    const bundle = userscript.slice(userscript.indexOf('\n', userscript.indexOf('prettier-ignore', begin)) + 1, userscript.lastIndexOf('\n', end));
    const shippedDom = new JSDOM('<!doctype html><html><body></body></html>', { url: origin, runScripts: 'outside-only' });
    shippedDom.window.eval(`${bundle}\nwindow.__SafeDom = SafeDom;`);
    const shipped = shippedDom.window.__SafeDom;
    const options = { document: shippedDom.window.document, origin, postNumber: 1, topicId: '1' };
    for (const [name, html] of Object.entries(FIXTURES)) {
        const prepared = await prepare(html);
        assert.equal(await shipped.prepareExportHTML(html, options), prepared, `${name}: prepared HTML differs`);
        assert.equal(shipped.htmlToMarkdown(prepared, options), htmlToMarkdown(prepared, { document, origin }), `${name}: Markdown differs`);
    }
    // The original defect: every newline emitted by the bundle carried the bundle's 12-space indent.
    const markdown = shipped.htmlToMarkdown('<p>一</p><p>二</p><pre><code>x\n</code></pre>', options);
    assert.equal(markdown, '一\n\n二\n\n```\nx\n```');
});

test('paragraphs, line breaks and lightbox images produce clean Markdown with no stray whitespace', async () => {
    assert.equal(await toMarkdown(FIXTURES.paragraphs), [
        '第一行  ',
        '第二行：  ',
        '[链接标题](<https://forum.invalid/t/1>)',
        '',
        '第二段',
        '',
        '![image](<https://cdn.invalid/original/a1.png> "image · 576×858 131 KB")',
        '',
        '图后文字',
        '',
        '![image](<https://cdn.invalid/original/b2.png> "image · 1117×846 221 KB")'
    ].join('\n'));
});

test('inline formatting that Markdown cannot express is kept as HTML instead of being flattened', async () => {
    const markdown = await toMarkdown(FIXTURES.inline);
    assert.equal(markdown, '普通 **加粗**、*斜体*、~~删除~~、`inline  code`、<kbd>Ctrl</kbd>+<kbd>C</kbd>、<mark>高亮</mark>、H<sub>2</sub>O、x<sup>2</sup>、[@neo](<https://forum.invalid/u/neo>) :smile: [开发](<https://forum.invalid/c/dev/4>)');
});

test('emphasis that CommonMark would not recognise next to CJK punctuation falls back to tags', async () => {
    assert.equal(await toMarkdown('<p><strong>注意：</strong>内容，<strong>重点</strong>文字，前<strong>（括号）</strong>后</p>'),
        '<strong>注意：</strong>内容，**重点**文字，前<strong>（括号）</strong>后');
    assert.equal(await toMarkdown('<p>a<strong> spaced </strong>b <em>斜体。</em>后续 <s>删。</s>x</p>'),
        'a **spaced** b <em>斜体。</em>后续 <del>删。</del>x');
    assert.equal(await toMarkdown('<p><strong>粗<em>斜</em></strong> a<strong></strong>b</p>'), '**粗*斜*** ab');
    const rendered = new MarkdownIt({ html: true }).render(await toMarkdown('<p><strong>注意：</strong>内容和<strong>重点</strong>文字</p>'));
    assert.equal((rendered.match(/<strong>/g) || []).length, 2);
});

test('text that looks like Markdown syntax stays literal, without escaping ordinary prose', async () => {
    assert.equal(await toMarkdown('<p># not heading<br>- not list<br>+ plus<br>1. one<br>2) two<br>&gt; quote<br>===<br>---</p>'),
        '\\# not heading  \n\\- not list  \n\\+ plus  \n1\\. one  \n2\\) two  \n\\> quote  \n\\===  \n\\---');
    assert.equal(await toMarkdown('<p>issue #12, 1. inline - dash, snake_case_name, a &amp; b, &amp;copy; &lt;b&gt;</p>'),
        'issue #12, 1. inline - dash, snake_case_name, a & b, \\&copy; \\<b\\>');
    assert.equal(await toMarkdown('<ul><li># hash</li><li>- dash</li><li>1. num</li></ul>'), '- \\# hash\n- \\- dash\n- 1\\. num');
    assert.equal(await toMarkdown('<p>__init__ a*b _lead ~t~ `tick`</p>'), '\\_\\_init\\_\\_ a\\*b \\_lead \\~t\\~ \\`tick\\`');
});

test('lists keep nesting, numbering, task state and fenced code inside items', async () => {
    assert.equal(await toMarkdown(FIXTURES.lists), [
        '- 一',
        '- 二',
        '  - 二点一',
        '  - 二点二 **粗**',
        '',
        '3. 三',
        '',
        '4. 四',
        '',
        '   ```bash',
        '   echo hi',
        '   ```',
        '',
        '- [ ] 待办',
        '- [x] 完成'
    ].join('\n'));
});

test('code blocks are byte-exact, including blank lines, leading spaces and inner fences', async () => {
    const markdown = await toMarkdown(FIXTURES.code);
    assert.equal(markdown, '代码：\n\n```python\ndef f(x):\n    return x * 2\n\n\nprint(f"{f(2)}")\n```\n\n````auto\n  indented first line\n```\nfence inside\n```\n````\n\n后文');
    const nested = await toMarkdown('<ul><li>项<blockquote><p>引</p><pre><code class="lang-js">a\n\n  b\n</code></pre></blockquote></li></ul>');
    assert.equal(nested, '- 项\n\n  > 引\n  >\n  > ```js\n  > a\n  >\n  >   b\n  > ```');
    const back = document.createElement('div');
    back.innerHTML = new MarkdownIt({ html: true }).render(nested);
    assert.equal(back.querySelector('li blockquote pre code').textContent, 'a\n\n  b\n');
});

test('quotes keep who is being quoted, and nested quotes keep their depth', async () => {
    assert.equal(await toMarkdown(FIXTURES.quote), [
        '> **neo:**',
        '>',
        '> 第一段引用',
        '>',
        '> 第二段引用',
        '',
        '我的回复',
        '',
        '> 普通引用  ',
        '> 第二行',
        '>',
        '> > 嵌套'
    ].join('\n'));
    assert.equal(await toMarkdown('<aside class="quote" data-topic="9"><div class="title"><div class="quote-controls"></div><img class="avatar" src="/a.png"> <a href="https://forum.invalid/t/topic/9/1">别的话题</a></div><blockquote><p>引文</p></blockquote></aside>'),
        '> **[别的话题](<https://forum.invalid/t/topic/9/1>)**\n>\n> 引文');
});

test('tables keep column alignment in both formats; cells with block content stay as HTML', async () => {
    const prepared = await prepare(FIXTURES.table);
    assert.match(prepared, /<th align="right">价格<\/th>/);
    assert.match(prepared, /<td align="center"><code>x<\/code><\/td>/);
    assert.equal(htmlToMarkdown(prepared, { document, origin }), [
        '| 型号 | 价格 | 备注 |',
        '| --- | ---: | :---: |',
        '| A \\| B | $1 | `x` |',
        '| 多行<br>内容 | $2 | |'
    ].join('\n'));
    const complex = await toMarkdown('<table><tbody><tr><td><ul><li>x</li><li>y</li></ul></td><td>z</td></tr></tbody></table>');
    assert.match(complex, /^<table>/);
    assert.match(complex, /<li>x<\/li><li>y<\/li>/);
});

test('uploaded-video placeholders and media elements survive as links in both formats', async () => {
    const prepared = await prepare(FIXTURES.media);
    assert.equal((prepared.match(/<figure class="export-media">/g) || []).length, 2);
    assert.match(prepared, /href="https:\/\/cdn\.invalid\/v1\.mp4"/);
    const markdown = htmlToMarkdown(prepared, { document, origin });
    assert.match(markdown, /\[https:\/\/cdn\.invalid\/v1\.mp4\]\(<https:\/\/cdn\.invalid\/v1\.mp4>\)/);
    assert.match(markdown, /\[https:\/\/cdn\.invalid\/v2\.mp4\]\(<https:\/\/cdn\.invalid\/v2\.mp4>\)/);
    assert.match(markdown, /\[文件\.zip\]\(<https:\/\/forum\.invalid\/uploads\/short-url\/abc\.zip>\) \(1\.2 MB\)$/);
});

test('task-list boxes are visible without the forum icon font', async () => {
    const prepared = await prepare(FIXTURES.lists);
    assert.match(prepared, /<span class="export-check" data-checked="false">☐<\/span> 待办/);
    assert.match(prepared, /<span class="export-check" data-checked="true">☑<\/span> 完成/);
    assert.ok(!prepared.includes('chcklst-box'));
});

test('folded sections convert their body to Markdown; footnotes use footnote syntax', async () => {
    assert.equal(await toMarkdown(FIXTURES.fold), [
        '<details>',
        '<summary>点击展开</summary>',
        '',
        '折叠 **内容**',
        '',
        '```js',
        'let a = 1;',
        '```',
        '',
        '</details>',
        '',
        '剧透文字'
    ].join('\n'));
    assert.equal(await toMarkdown('<p>正文<sup class="footnote-ref"><a href="#footnote-1-1" id="footnote-ref-1-1">[1]</a></sup></p><hr class="footnotes-sep"><ol class="footnotes-list"><li id="footnote-1-1" class="footnote-item"><p>脚注内容 <a href="#footnote-ref-1-1" class="footnote-backref">↩︎</a></p></li></ol>'),
        '正文[^1]\n\n[^1]: 脚注内容');
});

test('a formula inside a sentence stays inline; a standalone formula becomes a math block', async () => {
    const prepared = await prepare('<p>行内 <span class="math">E=mc^2</span> 结束</p><div class="math">\\int_0^1 x dx</div>');
    assert.match(prepared, /<p>行内 <code class="export-math-inline"[^>]*>E=mc\^2<\/code> 结束<\/p>/);
    assert.equal(htmlToMarkdown(prepared, { document, origin }), '行内 $`E=mc^2`$ 结束\n\n```math\n\\int_0^1 x dx\n```');
});

test('every realistic fixture renders back to the same text and structure', async () => {
    const renderer = new MarkdownIt({ html: true });
    const squash = text => text.replace(/\s+/g, '');
    for (const [name, html] of Object.entries(FIXTURES)) {
        const prepared = await prepare(html);
        const markdown = htmlToMarkdown(prepared, { document, origin });
        const outside = markdown.replace(/^( *(?:> ?)*)(`{3,})[^\n]*\n[\s\S]*?\n\1\2 *$/gm, '$1CODE');
        assert.ok(!/\n{3,}/.test(outside), `${name}: more than one blank line in a row`);
        assert.ok(!/[ \t]$/m.test(outside.replace(/\S {2}$/gm, 'x')), `${name}: trailing whitespace`);

        const source = document.createElement('div');
        source.innerHTML = prepared;
        source.querySelectorAll('img.emoji').forEach(node => node.replaceWith(node.alt));
        source.querySelectorAll('.export-image-caption, .export-check').forEach(node => node.remove());
        const quoteTitles = source.querySelectorAll('aside.quote .title').length;
        const back = document.createElement('div');
        back.innerHTML = renderer.render(markdown);
        assert.equal(squash(back.textContent).replace(/\[x?\]/g, ''), squash(source.textContent), `${name}: text changed`);
        for (const selector of ['em', 'code', 'pre', 'li', 'table', 'kbd', 'mark', 'sub', 'sup', 'h4, h5, h6', 'details']) {
            const expected = selector === 'h4, h5, h6' ? source.querySelectorAll('h2, h3, h4').length : source.querySelectorAll(selector).length;
            assert.equal(back.querySelectorAll(selector).length, expected, `${name}: <${selector}> count`);
        }
        assert.equal(back.querySelectorAll('strong').length, source.querySelectorAll('strong').length + quoteTitles, `${name}: <strong> count`);
        assert.deepEqual([...back.querySelectorAll('pre')].map(node => node.textContent), [...source.querySelectorAll('pre')].map(node => node.textContent), `${name}: code content`);
        assert.equal(back.querySelectorAll('img').length, source.querySelectorAll('img:not(.avatar):not(.site-icon)').length, `${name}: images`);
    }
});

test('the userscript may fetch images from every host the forum serves them from', () => {
    const header = userscript.slice(0, userscript.indexOf('// ==/UserScript=='));
    const hosts = [...header.matchAll(/@connect\s+(\S+)/g)].map(match => match[1]);
    // Emoji come from cdn.ldstatic.com and uploads from cdn3.ldstatic.com; an unlisted host makes
    // Tampermonkey hold the request until the 20s export timeout.
    for (const host of ['cdn.ldstatic.com', 'cdn3.ldstatic.com', 'ldstatic.com']) assert.ok(hosts.includes(host), `missing @connect ${host}`);
});

function resolveChromiumPath() {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        || process.env.CHROME_BIN
        || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'].find(existsSync)
        || undefined;
}

// Builds a document with the userscript's own TopicExporter._genHTML and embedded bundles.
async function generateExportDocument(posts, topic = { id: '1', title: 'layout', tags: [] }) {
    const program = parse(userscript, { ecmaVersion: 'latest' }).body.find(node => node.type === 'ExpressionStatement').expression.callee.body.body;
    const sourceOf = node => userscript.slice(node.start, node.end);
    const declaration = name => sourceOf(program.find(node => node.type === 'VariableDeclaration' && node.declarations[0].id.name === name));
    const exporterClass = sourceOf(program.find(node => node.type === 'ClassDeclaration' && node.id.name === 'TopicExporter'));
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: `${origin}/t/topic/1`, runScripts: 'outside-only' });
    dom.window.eval(`${declaration('SafeDom')}; ${declaration('I18n')};
        const Utils = { escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, ch => '&#' + ch.charCodeAt(0) + ';'), hexToRgb: () => null };
        ${exporterClass}; window.__kit = { SafeDom, exporter: new TopicExporter(null, null), t: I18n.t };`);
    const { SafeDom, exporter, t } = dom.window.__kit;
    const prepared = [];
    for (const [index, html] of posts.entries()) {
        prepared.push({ postNumber: index + 1, author: { username: `user${index + 1}`, name: `user${index + 1}`, avatarUrl: '' }, timestamp: '2026-01-01T00:00:00Z', replyTo: null, likeCount: 0,
            content: await SafeDom.prepareExportHTML(html, { document: dom.window.document, origin, postNumber: index + 1, topicId: '1', t }) });
    }
    const data = { topic, posts: prepared, exportDate: '2026-01-01T00:00:00Z', postCount: prepared.length, range: { start: 1, end: prepared.length }, warnings: [] };
    return { html: exporter._genHTML(data), markdown: exporter._genMarkdown(data) };
}

test('the Markdown document keeps forum-supplied names literal and its header lines separate', async () => {
    const { markdown } = await generateExportDocument(['<p>正文</p>'], { id: '1', title: '标题 <b>*x*</b> # _y_', category: '分类_a*', tags: ['t`1', 'tag two'], views: 1234 });
    const lines = markdown.split('\n');
    assert.equal(lines[0], '# 标题 \\<b\\>\\*x\\*\\</b\\> # \\_y\\_');
    const header = lines.slice(2, lines.indexOf('---') - 1);
    assert.ok(header.length >= 5 && header.every(line => line.startsWith('> ')));
    assert.ok(header.slice(0, -1).every(line => line.endsWith('  ')), 'each header line needs a hard break or they merge into one');
    assert.ok(!header.at(-1).endsWith(' '));
    assert.ok(header.some(line => line.includes('分类_a\\*')));
    assert.ok(header.some(line => line.includes('`t 1` `tag two`')));
    assert.ok(header.at(-1).endsWith('<https://forum.invalid/t/1>'));
    const rendered = new MarkdownIt({ html: true }).render(markdown);
    assert.ok(!/<b>/.test(rendered), 'a title must not inject HTML');
    assert.equal((rendered.match(/<br>/g) || []).length >= header.length - 1, true);
    assert.match(rendered, /<h1>标题 &lt;b&gt;\*x\*&lt;\/b&gt; # _y_<\/h1>/);
});

test('real Chromium: images that cannot load never distort the exported page', async t => {
    const { html } = await generateExportDocument([
        '<p>文字 <img src="https://cdn.invalid/emoji/sweat_smile.png" title=":sweat_smile:" class="emoji" alt=":sweat_smile:" width="20" height="20"> 之后</p>',
        FIXTURES.quote,
        FIXTURES.table,
        FIXTURES.lists,
        FIXTURES.onebox
    ]);
    const browser = await chromium.launch({ executablePath: resolveChromiumPath(), args: ['--no-sandbox'] });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 980, height: 900 } });
    // Every image request fails, as it does when an export is opened offline.
    await page.route('**/*', route => route.abort());
    await page.setContent(html, { waitUntil: 'load' });

    const layout = await page.evaluate(() => {
        const box = selector => { const rect = document.querySelector(selector).getBoundingClientRect(); return { width: Math.round(rect.width), height: Math.round(rect.height) }; };
        const style = selector => getComputedStyle(document.querySelector(selector));
        return {
            emojiLine: box('#post-1 .post-content p'),
            quoteAvatar: box('#post-2 aside.quote img.avatar'),
            quote: box('#post-2 aside.quote'),
            innerQuoteBorder: style('#post-2 aside.quote blockquote').borderLeftWidth,
            priceAlign: style('#post-3 th:nth-child(2)').textAlign,
            noteAlign: style('#post-3 td:nth-child(3)').textAlign,
            checks: [...document.querySelectorAll('#post-4 .export-check')].map(node => node.textContent),
            siteIcon: box('#post-5 img.site-icon')
        };
    });
    assert.ok(layout.emojiLine.height < 60, `a failed emoji stretched its line to ${layout.emojiLine.height}px`);
    assert.deepEqual(layout.quoteAvatar, { width: 20, height: 20 });
    assert.ok(layout.quote.height < 200, `quote block is ${layout.quote.height}px tall`);
    assert.equal(layout.innerQuoteBorder, '0px');
    assert.equal(layout.priceAlign, 'right');
    assert.equal(layout.noteAlign, 'center');
    assert.deepEqual(layout.checks, ['\u2610', '\u2611']);
    assert.deepEqual(layout.siteIcon, { width: 16, height: 16 }, 'a link-preview favicon must stay icon-sized');
});

test('an already embedded favicon is still accepted as an image', async () => {
    const icon = 'data:image/x-icon;base64,AAABAAEAAQEAAAEAIAAwAAAAFgAAAA==';
    const prepared = await prepare(`<aside class="onebox"><header class="source"><img src="${icon}" class="site-icon" width="16" height="16"><a href="https://site.invalid/">site.invalid</a></header></aside>`);
    assert.ok(prepared.includes(`src="${icon}"`));
    assert.equal(htmlToMarkdown(prepared, { document, origin }), '[site.invalid](<https://site.invalid/>)');
});

test('icons inside link previews never leak placeholders or raw markup into Markdown', async () => {
    const path = '<path fill-rule="evenodd" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75Z"></path>';
    const github = `<p>前文</p><aside class="onebox githubrepo github-onebox" data-onebox-src="https://github.invalid/a/b">
    <header class="source github-onebox__header">
  <span class="github-onebox__label">
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${path}</svg>
    <span>仓库</span>
  </span>
    <a class="github-onebox__repo" href="https://github.invalid/a/b">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${path}</svg>
      a/b
    </a>
    </header>
  <article class="onebox-body"><h3><a href="https://github.invalid/a/b">GitHub - a/b: 描述</a></h3></article>
</aside>`;
    const markdown = await toMarkdown(github);
    assert.equal(markdown, '前文\n\n仓库 [a/b](<https://github.invalid/a/b>)\n\n##### [GitHub - a/b: 描述](<https://github.invalid/a/b>)');
    // A drawing that is real content survives, even inside a link, without breaking the link.
    const drawing = await toMarkdown(`<p><a href="https://site.invalid/"><svg viewBox="0 0 4 4"><rect width="4" height="4"></rect></svg> 图</a></p><svg viewBox="0 0 4 4"><circle r="2"></circle></svg>`);
    assert.match(drawing, /^\[<svg viewBox="0 0 4 4"><rect width="4" height="4"><\/rect><\/svg> 图\]\(<https:\/\/site\.invalid\/>\)\n\n<svg viewBox="0 0 4 4"><circle r="2"><\/circle><\/svg>$/);
    for (const output of [markdown, drawing, await toMarkdown('<p>a\u0001b</p>')]) assert.ok(!/[\u0000\u0001]/.test(output), 'placeholder characters must never reach the file');
});

test('no fixture leaves a control character in the output', async () => {
    for (const [name, html] of Object.entries(FIXTURES)) assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(await toMarkdown(html)), `${name}: control character in Markdown`);
});
