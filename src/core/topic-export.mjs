import createDOMPurify from 'dompurify';
import { abortError, checkAbort, sleep } from './topic-content.mjs';
import { tr } from './messages.mjs';

const purifiers = new WeakMap();
export function cleanExportHTML(html, document) {
    const window = document.defaultView || globalThis.window;
    if (!purifiers.has(window)) purifiers.set(window, createDOMPurify(window));
    return purifiers.get(window).sanitize(html, {
        FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'link', 'meta', 'base'],
        FORBID_ATTR: ['style', 'srcdoc', 'autofocus'], ALLOW_DATA_ATTR: true
    });
}

export function exportUrl(value, origin, { image = false } = {}) {
    const raw = String(value || '').trim();
    if (image && /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|svg\+xml|x-icon|vnd\.microsoft\.icon);/i.test(raw)) return raw;
    if (!raw) return '';
    try {
        const url = new URL(raw, origin);
        return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
}

export function selectImage(img, origin) {
    const lightbox = img.closest('a.lightbox')?.getAttribute('href');
    const candidates = [lightbox, img.getAttribute('data-original'), img.getAttribute('data-src'), img.getAttribute('data-lazy-src')];
    const sourceSet = img.getAttribute('data-srcset') || img.getAttribute('srcset') || '';
    const sources = sourceSet.split(',').map(entry => {
        const [url, size] = entry.trim().split(/\s+/);
        return { url, size: parseFloat(size) || 0 };
    }).sort((a, b) => b.size - a.size);
    candidates.push(...sources.map(source => source.url), img.getAttribute('src'));
    return candidates.map(url => exportUrl(url, origin, { image: true })).find(Boolean) || '';
}

export class ExportResources {
    constructor({ origin, document, signal, gm = globalThis.GM_xmlhttpRequest, fetchImpl = (...args) => globalThis.fetch(...args), onProgress = () => {}, interval = 1000, maxImage = 20 * 1024 * 1024, maxTotal = 100 * 1024 * 1024, t = null } = {}) {
        Object.assign(this, { origin, document, signal, gm, fetchImpl, onProgress, interval, maxImage, maxTotal, t });
        this.cache = new Map(); this.warnings = []; this.bytes = 0; this.active = 0; this.queue = []; this.hosts = new Map(); this.completed = 0;
    }
    _schedule(fn) {
        return new Promise((resolve, reject) => { this.queue.push({ fn, resolve, reject }); this._drain(); });
    }
    _drain() {
        while (this.active < 2 && this.queue.length) {
            const task = this.queue.shift();
            this.active++;
            Promise.resolve().then(task.fn).then(task.resolve, task.reject).finally(() => { this.active--; this._drain(); });
        }
    }
    async _blob(url) {
        checkAbort(this.signal);
        const host = new URL(url).host;
        const time = Math.max(Date.now(), this.hosts.get(host) || 0);
        this.hosts.set(host, time + this.interval);
        await sleep(time - Date.now(), this.signal);
        checkAbort(this.signal);
        if (new URL(url).origin === this.origin) {
            const controller = new AbortController();
            const stop = () => controller.abort();
            this.signal?.addEventListener('abort', stop, { once: true });
            const timeout = setTimeout(stop, 20000);
            try {
                const response = await this.fetchImpl(url, { signal: controller.signal, credentials: 'same-origin' });
                if (!response.ok) throw new Error(tr(this.t, 'core.errors.httpStatus', { status: response.status }));
                if (Number(response.headers.get('content-length')) > this.maxImage) throw new Error(tr(this.t, 'core.warnings.imageTooLarge'));
                const reader = response.body?.getReader();
                if (!reader) return response.blob();
                const chunks = []; let bytes = 0;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    bytes += value.byteLength;
                    if (bytes > this.maxImage) { await reader.cancel(); throw new Error(tr(this.t, 'core.warnings.imageTooLarge')); }
                    chunks.push(value);
                }
                return new this.document.defaultView.Blob(chunks, { type: response.headers.get('content-type') || '' });
            } finally { clearTimeout(timeout); this.signal?.removeEventListener('abort', stop); }
        }
        if (!this.gm) throw new Error(tr(this.t, 'core.warnings.crossOriginNeedsGrant'));
        return new Promise((resolve, reject) => {
            let request, settled = false;
            const finish = (error, blob) => {
                if (settled) return;
                settled = true; clearTimeout(timeout); this.signal?.removeEventListener('abort', stop);
                error ? reject(error) : resolve(blob);
            };
            const stop = () => { finish(abortError()); request?.abort(); };
            const timeout = setTimeout(() => { finish(new Error(tr(this.t, 'core.warnings.imageDownloadTimeout'))); request?.abort(); }, 20000);
            this.signal?.addEventListener('abort', stop, { once: true });
            try {
                request = this.gm({ method: 'GET', url, anonymous: true, responseType: 'blob',
                    onprogress: response => { if (response.loaded > this.maxImage) { finish(new Error(tr(this.t, 'core.warnings.imageTooLarge'))); request?.abort(); } },
                    onload: response => response.status >= 200 && response.status < 300 ? finish(null, response.response) : finish(new Error(tr(this.t, 'core.errors.httpStatus', { status: response.status }))),
                    onerror: () => finish(new Error(tr(this.t, 'core.warnings.imageDownloadFailed'))), ontimeout: () => finish(new Error(tr(this.t, 'core.warnings.imageDownloadTimeout'))), onabort: () => finish(abortError())
                });
                if (this.signal?.aborted) stop();
            } catch (error) { finish(error); }
        });
    }
    async embed(url) {
        checkAbort(this.signal);
        if (!url || url.startsWith('data:')) return url;
        if (this.cache.has(url)) return this.cache.get(url);
        const promise = this._schedule(async () => {
            try {
                checkAbort(this.signal);
                if (this.bytes >= this.maxTotal) throw new Error(tr(this.t, 'core.warnings.imageBudgetTotal'));
                const blob = await this._blob(url);
                checkAbort(this.signal);
                if (!blob || !/^image\//i.test(blob.type)) throw new Error(tr(this.t, 'core.warnings.notAnImage'));
                if (blob.size > this.maxImage) throw new Error(tr(this.t, 'core.warnings.imageTooLarge'));
                if (this.bytes + blob.size > this.maxTotal) throw new Error(tr(this.t, 'core.warnings.imagesTooLargeTotal'));
                this.bytes += blob.size;
                return await new Promise((resolve, reject) => {
                    const reader = new this.document.defaultView.FileReader();
                    const stop = () => { reader.abort(); reject(abortError()); };
                    this.signal?.addEventListener('abort', stop, { once: true });
                    reader.onload = () => { this.signal?.removeEventListener('abort', stop); resolve(reader.result); };
                    reader.onerror = () => { this.signal?.removeEventListener('abort', stop); reject(new Error(tr(this.t, 'core.warnings.imageEncodeFailed'))); };
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                checkAbort(this.signal);
                this.warnings.push({ url, reason: error.message || tr(this.t, 'core.warnings.resourceNotEmbedded') });
                return url;
            } finally {
                this.completed++;
                this.onProgress({ stage: 'images', message: tr(this.t, 'core.progress.savingImages', { current: this.completed, total: this.cache.size }), detail: tr(this.t, 'core.progress.imagesDetail', { size: (this.bytes / 1024 / 1024).toFixed(1), count: this.warnings.length }), current: this.completed, total: this.cache.size });
            }
        });
        this.cache.set(url, promise);
        return promise;
    }
}

export async function prepareExportHTML(html, { document, origin, embed = false, pdf = false, resources, signal, postNumber = 0, topicId = '', t = null } = {}) {
    checkAbort(signal);
    // Template contents are inert, including scripts and image loading.
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const root = template.content;
    for (const math of root.querySelectorAll('script[type^="math/"], .math, [data-math-source]')) {
        if (math.querySelector('math, svg')) continue;
        const source = math.getAttribute('data-math-source') || math.getAttribute('data-math') || math.textContent;
        if (source?.trim()) {
            // A formula inside a sentence must stay inline; a block element there would split the paragraph.
            const inline = math.tagName === 'SPAN' && !!math.closest('p, li, td, th, h1, h2, h3, h4, h5, h6');
            const holder = document.createElement(inline ? 'code' : 'pre'); holder.className = inline ? 'export-math-inline' : 'export-math-source';
            holder.textContent = source.trim(); holder.setAttribute('data-export-label', tr(t, 'core.media.mathSource')); math.replaceWith(holder);
        }
    }
    for (const media of root.querySelectorAll('iframe, video, audio, object, embed, .video-placeholder-container[data-video-src]')) {
        const figure = document.createElement('figure'); figure.className = 'export-media';
        const sources = [media.getAttribute('src'), media.getAttribute('data'), media.getAttribute('data-video-src'), ...[...media.querySelectorAll('source[src]')].map(el => el.getAttribute('src'))].map(src => exportUrl(src, origin)).filter(Boolean);
        const poster = exportUrl(media.getAttribute('poster'), origin);
        if (poster) { const image = document.createElement('img'); image.src = poster; image.alt = tr(t, 'core.media.coverAlt'); figure.appendChild(image); }
        const note = document.createElement('figcaption'); note.textContent = media.tagName.toLowerCase() === 'audio' ? tr(t, 'core.media.audioNote') : tr(t, 'core.media.mediaNote'); figure.appendChild(note);
        for (const src of new Set(sources)) { const link = document.createElement('a'); link.href = src; link.textContent = media.getAttribute('title') || src; figure.appendChild(link); }
        if (!sources.length) note.append(tr(t, 'core.media.visitOriginal'));
        media.replaceWith(figure);
    }
    // Inline styles are stripped by the sanitizer; carry column alignment over as an attribute.
    for (const cell of root.querySelectorAll('th[style], td[style]')) {
        const align = cell.getAttribute('style').match(/text-align:\s*(left|right|center)/i)?.[1];
        if (align) cell.setAttribute('align', align.toLowerCase());
    }
    // Task-list boxes are icon-font glyphs on the forum; without the font they render as nothing.
    for (const box of root.querySelectorAll('span.chcklst-box')) {
        const checked = box.classList.contains('checked');
        const mark = document.createElement('span'); mark.className = 'export-check';
        mark.setAttribute('data-checked', String(checked)); mark.textContent = checked ? '\u2611' : '\u2610';
        box.replaceWith(mark);
    }
    const ids = new Map();
    for (const node of root.querySelectorAll('[id]')) { const old = node.id; node.id = `post-${postNumber}-${old}`; ids.set(old, node.id); }
    for (const node of root.querySelectorAll('svg [href], svg [xlink\\:href]')) {
        for (const attr of ['href', 'xlink:href']) {
            const value = node.getAttribute(attr);
            if (value?.startsWith('#') && ids.has(value.slice(1))) node.setAttribute(attr, '#' + ids.get(value.slice(1)));
        }
    }
    for (const node of root.querySelectorAll('svg *')) {
        for (const attr of ['fill', 'stroke', 'filter', 'mask', 'clip-path', 'marker-start', 'marker-mid', 'marker-end']) {
            const value = node.getAttribute(attr);
            if (value) node.setAttribute(attr, value.replace(/url\(#([^)]*)\)/g, (match, id) => ids.has(id) ? `url(#${ids.get(id)})` : match));
        }
    }
    for (const meta of root.querySelectorAll('.lightbox-wrapper .meta')) {
        const caption = document.createElement('span'); caption.className = 'export-image-caption';
        caption.textContent = [...meta.querySelectorAll('.filename, .informations')].map(node => node.textContent.trim()).filter(Boolean).join(' · ');
        meta.replaceWith(caption);
    }
    root.querySelectorAll('a.anchor').forEach(node => node.remove());
    for (const link of root.querySelectorAll('a[href]')) {
        const raw = link.getAttribute('href');
        const local = raw.startsWith('#') ? ids.get(raw.slice(1)) : '';
        const href = local ? `#${local}` : exportUrl(raw, `${origin}/t/${topicId}`);
        if (href) { link.setAttribute('href', href); link.setAttribute('rel', 'noopener noreferrer'); }
        else link.removeAttribute('href');
    }
    for (const use of root.querySelectorAll('svg use')) if (!use.getAttribute('href')?.startsWith('#') && !use.getAttribute('xlink:href')?.startsWith('#')) use.remove();
    for (const svg of root.querySelectorAll('svg')) if (svg.classList.contains('svg-icon') || !svg.querySelector('path, rect, circle, ellipse, line, polyline, polygon, text, image, use')) svg.remove();
    if (pdf) root.querySelectorAll('details').forEach(node => node.setAttribute('open', ''));
    const wrapper = document.createElement('template');
    wrapper.innerHTML = cleanExportHTML(template.innerHTML, document);
    await Promise.all([...wrapper.content.querySelectorAll('img')].map(async img => {
        checkAbort(signal);
        const src = selectImage(img, origin);
        const hint = img.closest('a.lightbox')?.getAttribute('title');
        if (!img.getAttribute('alt') && hint) img.setAttribute('alt', hint);
        for (const attr of ['srcset', 'sizes', 'data-src', 'data-srcset', 'data-original', 'data-lazy-src', 'loading', 'onerror']) img.removeAttribute(attr);
        if (!src) { img.replaceWith(document.createTextNode(img.alt || tr(t, 'core.media.imageUnavailable'))); return; }
        img.setAttribute('src', embed ? await resources.embed(src) : src);
        img.setAttribute('loading', 'eager');
    }));
    checkAbort(signal);
    return cleanExportHTML(wrapper.innerHTML, document);
}

const PUNCT = /[\p{P}\p{S}]/u;
const WORD = /[\p{L}\p{N}]/u;

// Escapes only what would change meaning, so prose stays readable in the Markdown source.
// `lineStart` is true when the text begins a line: block markers only matter there.
function escapeText(text, lineStart = false) {
    let out = text.replace(/[\\`*[\]<>~]/g, '\\$&')
        .replace(/_/g, (ch, index, all) => WORD.test(all[index - 1] || '') && WORD.test(all[index + 1] || '') ? ch : '\\_')
        .replace(/&(?=#?[0-9a-zA-Z]+;)/g, '\\&');
    if (lineStart) {
        out = out.replace(/^(\s*)(#{1,6})(?=\s|$)/, '$1\\$2')
            .replace(/^(\s*)([-+])(?=\s|$)/, '$1\\$2')
            .replace(/^(\s*)(\d{1,9})([.)])(?=\s|$)/, '$1$2\\$3')
            .replace(/^(\s*)([=-])(?=[=-]*\s*$)/, '$1\\$2');
    }
    return out;
}
// For values placed into the document by the exporter itself (title, names, category): one line, literal.
export function escapeMarkdownText(value) { return escapeText(String(value ?? '').replace(/\s+/g, ' ').trim(), true); }
function fenceFor(text, minimum = 3) { return '`'.repeat(Math.max(minimum - 1, ...[...text.matchAll(/`+/g)].map(match => match[0].length)) + 1); }

// Trailing spaces are noise except the two that mark a hard line break before more text.
function tidy(markdown) {
    const lines = markdown.replace(/\r/g, '').split('\n');
    const out = lines.map((line, index) => {
        const body = line.replace(/[ \t]+$/, '').replace(/(\S) {2,}(?=\S)/g, '$1 ');
        const next = lines[index + 1];
        return /\S {2,}$/.test(line) && next !== undefined && next.trim() ? body + '  ' : body;
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
}
// Blank lines get the bare prefix; lines with content keep their own ending (it may be a hard break).
const prefixLines = (text, first, rest) => text.split('\n').map((line, index) => line ? (index ? rest : first) + line : (index ? rest : first).replace(/[ \t]+$/, '')).join('\n');
const cellAlign = cell => (cell.getAttribute('align') || cell.getAttribute('style')?.match(/text-align:\s*(left|right|center)/i)?.[1] || '').toLowerCase();

export function htmlToMarkdown(html, { document, origin, t = null } = {}) {
    const template = document.createElement('template');
    template.innerHTML = cleanExportHTML(html, document);
    // Code and raw HTML are parked so whitespace tidying never touches them; a token always
    // sits alone on its line and inherits that line's list/quote prefix when restored.
    const parked = [];
    const park = text => { parked.push(text); return `\n\n\u0000${parked.length - 1}\u0000\n\n`; };
    const held = [];
    const hold = text => { held.push(text); return `\u0001${held.length - 1}\u0001`; };
    const restore = markdown => markdown.replace(/^(.*)\u0000(\d+)\u0000[ \t]*$/gm, (_, prefix, id) => {
        const rest = /^[\s>]*$/.test(prefix) ? prefix : prefix.replace(/[^\s>]/g, ' ');
        return prefixLines(parked[Number(id)], prefix, rest);
    })
        // A parked block that ended up inside inline content (an icon in a link label, say) is put back on one line.
        .replace(/\u0000(\d+)\u0000/g, (_, id) => parked[Number(id)].replace(/\s*\n\s*/g, ' '))
        .replace(/\u0001(\d+)\u0001/g, (_, id) => held[Number(id)]);

    const children = (node, atLineStart = true) => {
        let out = '';
        for (const child of node.childNodes) {
            const lineStart = out ? out.endsWith('\n') : atLineStart;
            let part = convert(child, lineStart);
            if (child.nodeType === 3) {
                if (lineStart || out.endsWith(' ')) part = part.replace(/^ +/, '');
            }
            out += part;
        }
        return out;
    };
    const block = text => { const body = tidy(text); return body ? `\n\n${body}\n\n` : ''; };
    const neighbour = (node, direction) => {
        for (let current = node; current && current !== template.content; current = current.parentNode) {
            for (let sibling = current[direction]; sibling; sibling = sibling[direction]) {
                const text = sibling.textContent || '';
                if (text) return direction === 'previousSibling' ? text.at(-1) : text[0];
            }
            if (/^(P|LI|TD|TH|DIV|BLOCKQUOTE|H[1-6]|SUMMARY|FIGCAPTION)$/.test(current.parentNode?.tagName || '')) break;
        }
        return '';
    };
    // CommonMark only treats a delimiter run as emphasis when it is "flanking": `**注意：**内容`
    // stays literal. Fall back to the equivalent tag exactly where the rule would fail.
    const emphasis = (node, marker, tag) => {
        const [, lead, body, trail] = children(node, false).match(/^(\s*)([\s\S]*?)(\s*)$/);
        if (!body) return lead + trail;
        const before = lead ? ' ' : neighbour(node, 'previousSibling');
        const after = trail ? ' ' : neighbour(node, 'nextSibling');
        const free = ch => !ch || /\s/.test(ch) || PUNCT.test(ch);
        const opens = !PUNCT.test(body[0]) || free(before);
        const closes = !PUNCT.test(body.at(-1)) || free(after);
        const flat = !body.includes('\n\n') && !body.includes('\u0000');
        return lead + (opens && closes && flat ? `${marker}${body}${marker}` : `<${tag}>${body}</${tag}>`) + trail;
    };
    const inlineTag = (node, tag) => { const body = children(node, false); return body.trim() ? `<${tag}>${body}</${tag}>` : body; };
    const title = text => text ? ` "${text.replace(/\s+/g, ' ').trim().replace(/["\\]/g, '\\$&')}"` : '';
    const link = (label, href) => `[${label}](<${href.replace(/>/g, '%3E')}>)`;
    const footnoteId = node => (node.getAttribute('href') || node.id || '').match(/footnote-(?:ref-)?(?:\d+-)*?(\d+)$/)?.[1] || '';

    const convert = (node, lineStart = false) => {
        // The two control characters are reserved for the placeholders above and never valid in a post.
        if (node.nodeType === 3) return escapeText((node.nodeValue || '').replace(/[\u0000\u0001]/g, '').replace(/[ \t\r\n\f]+/g, ' '), lineStart);
        if (node.nodeType !== 1) return '';
        const tag = node.tagName.toLowerCase();
        const has = name => node.classList.contains(name);
        switch (tag) {
            case 'br': return '  \n';
            case 'p': return block(children(node));
            case 'strong': case 'b': return emphasis(node, '**', 'strong');
            case 'em': case 'i': return emphasis(node, '*', 'em');
            case 'del': case 's': case 'strike': return emphasis(node, '~~', 'del');
            case 'sub': case 'kbd': case 'mark': case 'ins': case 'u': return inlineTag(node, tag);
            case 'sup': {
                const reference = has('footnote-ref') && footnoteId(node.querySelector('a') || node);
                return reference ? `[^${reference}]` : inlineTag(node, tag);
            }
            case 'pre': {
                const code = node.querySelector('code') || node;
                const raw = code.textContent || '';
                const fence = fenceFor(raw);
                const lang = code.className?.match(/(?:language|lang)-([\w-]+)/)?.[1] || (has('export-math-source') ? 'math' : '');
                return park(`${fence}${lang}\n${raw}${raw.endsWith('\n') ? '' : '\n'}${fence}`);
            }
            case 'code': {
                const raw = (node.textContent || '').replace(/\n/g, ' ');
                if (!raw) return '';
                const fence = fenceFor(raw, 1); const pad = /^`|`$|^ | $/.test(raw) ? ' ' : '';
                const span = `${fence}${pad}${raw}${pad}${fence}`;
                // $`...`$ renders as inline math on GitHub and stays a readable code span elsewhere.
                return hold(has('export-math-inline') ? `$${span}$` : span);
            }
            case 'a': {
                if (has('anchor') || has('footnote-backref')) return '';
                const value = node.getAttribute('href') || '';
                const href = value.startsWith('#') ? value : exportUrl(value, origin);
                if (has('lightbox')) {
                    const image = node.querySelector('img');
                    const caption = node.querySelector('.export-image-caption, .meta');
                    const src = image && (exportUrl(value, origin, { image: true }) || selectImage(image, origin));
                    if (src) return `![${escapeText(image.getAttribute('alt') || tr(t, 'core.media.imageAlt'))}](<${src.replace(/>/g, '%3E')}>${title(caption ? [...caption.querySelectorAll('.filename, .informations')].map(part => part.textContent.trim()).filter(Boolean).join(' · ') || caption.textContent : '')})`;
                }
                const label = children(node, false).trim().replace(/\n+/g, ' ');
                return href ? link(label || escapeText(href), href) : label;
            }
            case 'img': {
                if (has('emoji')) return node.getAttribute('alt') || '';
                if (has('avatar') || has('site-icon')) return '';
                const src = selectImage(node, origin); const alt = escapeText(node.getAttribute('alt') || tr(t, 'core.media.imageAlt'));
                return src ? `![${alt}](<${src.replace(/>/g, '%3E')}>${title(node.getAttribute('title'))})` : `[${alt}]`;
            }
            case 'span': {
                if (has('chcklst-box') || has('export-check')) return has('checked') || node.getAttribute('data-checked') === 'true' ? '[x] ' : '[ ] ';
                return children(node, lineStart);
            }
            case 'ul': case 'ol': {
                if (has('footnotes-list')) {
                    return block([...node.children].filter(child => child.tagName === 'LI').map((li, index) =>
                        prefixLines(tidy(children(li)), `[^${footnoteId(li) || index + 1}]: `, '    ')).join('\n\n'));
                }
                const start = Number(node.getAttribute('start')) || 1;
                const items = [...node.children].filter(child => child.tagName === 'LI').map((li, index) => {
                    const prefix = tag === 'ol' ? `${start + index}. ` : '- ';
                    return prefixLines(tidy(children(li)) || '', prefix, ' '.repeat(prefix.length));
                });
                const loose = items.some(item => /\n\n/.test(item));
                const list = items.join(loose ? '\n\n' : '\n');
                // A list nested directly in an item continues that item instead of opening a new paragraph.
                return node.parentNode?.tagName === 'LI' ? `\n${list}\n` : block(list);
            }
            case 'li': return block(children(node));
            case 'aside': case 'blockquote': {
                if (tag === 'aside' && !has('quote')) return block(children(node));
                let body = tidy(children(tag === 'aside' ? node.querySelector('blockquote') || node : node));
                if (tag === 'aside') {
                    const heading = node.querySelector('.title');
                    const name = heading ? tidy(children(heading)).replace(/\n+/g, ' ') : '';
                    if (name) body = `**${name}**${body ? '\n\n' + body : ''}`;
                }
                return body ? block(prefixLines(body, '> ', '> ')) : '';
            }
            case 'table': {
                if (node.querySelector('[rowspan], [colspan], table table, td ul, td ol, td pre, td blockquote, td details, th ul, th ol, th pre')) return park(node.outerHTML);
                const rows = [...node.rows]; if (!rows.length) return '';
                const width = Math.max(...rows.map(row => row.cells.length));
                const cell = value => tidy(children(value)).replace(/\|/g, '\\|').replace(/ *\n+ */g, '<br>');
                const rowText = row => '| ' + Array.from({ length: width }, (_, index) => row.cells[index] ? cell(row.cells[index]) : '').join(' | ') + ' |';
                const hasHeader = [...rows[0].cells].some(value => value.tagName === 'TH');
                const marks = Array.from({ length: width }, (_, index) => ({ left: ':---', right: '---:', center: ':---:' })[cellAlign(rows[0].cells[index] || rows[0].cells[0])] || '---');
                const header = hasHeader ? rowText(rows.shift()) : '| ' + Array(width).fill(' ').join(' | ') + ' |';
                return block([header, '| ' + marks.join(' | ') + ' |', ...rows.map(rowText)].join('\n'));
            }
            case 'details': {
                const summary = [...node.children].find(child => child.tagName === 'SUMMARY');
                const heading = summary ? summary.textContent.replace(/\s+/g, ' ').trim().replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]) : '';
                const body = tidy([...node.childNodes].filter(child => child !== summary).map(child => convert(child, true)).join(''));
                return `${park(`<details${node.hasAttribute('open') ? ' open' : ''}>\n<summary>${heading}</summary>`)}${body}${park('</details>')}`;
            }
            case 'summary': return '';
            case 'hr': return has('footnotes-sep') ? '' : block('---');
            case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
                const heading = tidy(children(node)).replace(/\s*\n+\s*/g, ' ');
                return heading ? block('#'.repeat(Math.min(6, Number(tag[1]) + 2)) + ' ' + heading) : '';
            }
            case 'figure': {
                if (!has('export-media')) return block(children(node));
                const note = node.querySelector('figcaption');
                const links = [...node.querySelectorAll('a[href]')].map(anchor => convert(anchor)).filter(Boolean);
                const cover = [...node.querySelectorAll('img')].map(image => convert(image)).filter(Boolean);
                return block([...cover, note ? escapeText(note.textContent.trim(), true) : '', ...links].filter(Boolean).join('  \n'));
            }
            case 'div': case 'section': case 'article': case 'header': case 'footer': case 'figcaption': case 'tbody': case 'thead': case 'tr': case 'td': case 'th': return block(children(node));
            case 'svg': case 'math': {
                // Decorative icons carry no content; a drawing that is the content is kept as raw markup.
                if (tag === 'svg' && (node.getAttribute('aria-hidden') === 'true' || node.getAttribute('role') === 'presentation')) return '';
                return node.closest('a, h1, h2, h3, h4, h5, h6, td, th, summary') ? hold(node.outerHTML.replace(/\s*\n\s*/g, ' ')) : park(node.outerHTML);
            }
            default: return children(node, lineStart);
        }
    };
    return restore(tidy(children(template.content)));
}

// Hex-escape CSS controls and '<' as well: this stylesheet is embedded in an HTML style element.
function cssText(value) { return String(value).replace(/[\\'<>\u0000-\u001f\u007f]/g, ch => `\\${ch.codePointAt(0).toString(16)} `); }
export function getExportExtraCSS(t = null) {
    const spoilerLabel = cssText(tr(t, 'core.media.spoilerLabel'));
    const mathSource = cssText(tr(t, 'core.media.mathSource'));
    return `
.post-content .emoji{display:inline-block;width:1.2em;height:1.2em;max-height:none;margin:0 .1em;vertical-align:-.15em;border-radius:0;white-space:nowrap;overflow:hidden}
.post-content .lightbox-wrapper,.post-content .lightbox{display:block;max-width:100%}.post-content .meta{color:#667085;font-size:12px;display:block}
.post-content .export-image-caption{display:block;font-size:12px;line-height:1.5;color:#667085;text-align:center;margin:4px 0 8px}.post-content svg{max-width:100%}
.post-content details{border:1px solid #d4dfd9;border-radius:6px;padding:8px 12px;margin:12px 0}.post-content summary{cursor:pointer;font-weight:600}
.post-content .spoiler,.post-content .spoiler-blurred{filter:none!important;opacity:1!important}.post-content .spoiler::before{content:'${spoilerLabel}';font-size:12px;color:#667085}
.post-content .onebox{display:block;border:1px solid #d4dfd9;padding:12px;margin:12px 0;overflow-wrap:anywhere}.post-content .onebox img{max-height:200px}
.post-content .export-media{border-left:3px solid #4b5ea8;padding:8px 12px}.export-media a{display:block}.export-math-source::before{content:'${mathSource}';display:block;font-size:12px;color:#94a3b8}
.post-content .table-wrapper{overflow-x:auto}.post-content table{table-layout:auto}.post-content th{font-weight:600;background:#f6f8f5}
.post-content th[align=center],.post-content td[align=center]{text-align:center}.post-content th[align=right],.post-content td[align=right]{text-align:right}
.post-content .export-check{display:inline-block;margin-right:.35em;font-size:1.05em;line-height:1}
.post-content code.export-math-inline{font-style:italic;white-space:nowrap}
.post-content img.avatar{display:inline-block;width:20px;height:20px;max-height:none;margin:0 6px 0 0;vertical-align:middle;border-radius:50%;white-space:nowrap;overflow:hidden}
.post-content img.site-icon{display:inline-block;width:16px;height:16px;max-height:none;margin:0 6px 0 0;vertical-align:-.15em;border-radius:2px;white-space:nowrap;overflow:hidden}
.post-content aside.quote .title{font-size:13px;font-weight:600;margin-bottom:6px}.post-content aside.quote blockquote{background:none;border:0;padding:0;margin:0;border-radius:0}
.export-warnings{padding:14px;border:1px solid #d6a348;background:#fff9ed;margin:16px 0;overflow-wrap:anywhere}.export-warnings li{margin:6px 0}
@media print{.post-content .lightbox-wrapper{break-inside:avoid}.post-content .table-wrapper{overflow:visible}.post-content thead{display:table-header-group}.post-content tr{break-inside:avoid}.post-content pre{overflow:visible;white-space:pre-wrap;overflow-wrap:anywhere}.post-content h1,.post-content h2,.post-content h3,.post-content summary{break-after:avoid}.post-content .emoji{max-height:none}.post-content .onebox{break-inside:auto}}
`;
}
export const EXPORT_EXTRA_CSS = getExportExtraCSS();
