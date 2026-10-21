import createDOMPurify from 'dompurify';
import { abortError, checkAbort, sleep } from './topic-content.mjs';

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
    if (image && /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|svg\+xml);/i.test(raw)) return raw;
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
    constructor({ origin, document, signal, gm = globalThis.GM_xmlhttpRequest, fetchImpl = (...args) => globalThis.fetch(...args), onProgress = () => {}, interval = 1000, maxImage = 20 * 1024 * 1024, maxTotal = 100 * 1024 * 1024 } = {}) {
        Object.assign(this, { origin, document, signal, gm, fetchImpl, onProgress, interval, maxImage, maxTotal });
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
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                if (Number(response.headers.get('content-length')) > this.maxImage) throw new Error('图片超过单图 20 MiB 限制');
                const reader = response.body?.getReader();
                if (!reader) return response.blob();
                const chunks = []; let bytes = 0;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    bytes += value.byteLength;
                    if (bytes > this.maxImage) { await reader.cancel(); throw new Error('图片超过单图 20 MiB 限制'); }
                    chunks.push(value);
                }
                return new this.document.defaultView.Blob(chunks, { type: response.headers.get('content-type') || '' });
            } finally { clearTimeout(timeout); this.signal?.removeEventListener('abort', stop); }
        }
        if (!this.gm) throw new Error('跨域图片需要脚本管理器授权');
        return new Promise((resolve, reject) => {
            let request, settled = false;
            const finish = (error, blob) => {
                if (settled) return;
                settled = true; clearTimeout(timeout); this.signal?.removeEventListener('abort', stop);
                error ? reject(error) : resolve(blob);
            };
            const stop = () => { finish(abortError()); request?.abort(); };
            const timeout = setTimeout(() => { finish(new Error('图片下载超时')); request?.abort(); }, 20000);
            this.signal?.addEventListener('abort', stop, { once: true });
            try {
                request = this.gm({ method: 'GET', url, anonymous: true, responseType: 'blob',
                    onprogress: response => { if (response.loaded > this.maxImage) { finish(new Error('图片超过单图 20 MiB 限制')); request?.abort(); } },
                    onload: response => response.status >= 200 && response.status < 300 ? finish(null, response.response) : finish(new Error(`HTTP ${response.status}`)),
                    onerror: () => finish(new Error('图片连接失败或目标主机未授权')), ontimeout: () => finish(new Error('图片下载超时')), onabort: () => finish(abortError())
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
                if (this.bytes >= this.maxTotal) throw new Error('资源总量达到 100 MiB 限制');
                const blob = await this._blob(url);
                checkAbort(this.signal);
                if (!blob || !/^image\//i.test(blob.type)) throw new Error('响应不是图片');
                if (blob.size > this.maxImage) throw new Error('图片超过单图 20 MiB 限制');
                if (this.bytes + blob.size > this.maxTotal) throw new Error('资源总量超过 100 MiB 限制');
                this.bytes += blob.size;
                return await new Promise((resolve, reject) => {
                    const reader = new this.document.defaultView.FileReader();
                    const stop = () => { reader.abort(); reject(abortError()); };
                    this.signal?.addEventListener('abort', stop, { once: true });
                    reader.onload = () => { this.signal?.removeEventListener('abort', stop); resolve(reader.result); };
                    reader.onerror = () => { this.signal?.removeEventListener('abort', stop); reject(new Error('图片编码失败')); };
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                checkAbort(this.signal);
                this.warnings.push({ url, reason: error.message || '资源未能嵌入' });
                return url;
            } finally {
                this.completed++;
                this.onProgress({ stage: 'images', message: `正在保存图片 ${this.completed}/${this.cache.size}…`, detail: `已读取 ${(this.bytes / 1024 / 1024).toFixed(1)} MiB；未嵌入 ${this.warnings.length} 项`, current: this.completed, total: this.cache.size });
            }
        });
        this.cache.set(url, promise);
        return promise;
    }
}

export async function prepareExportHTML(html, { document, origin, embed = false, pdf = false, resources, signal, postNumber = 0, topicId = '' } = {}) {
    checkAbort(signal);
    // Template contents are inert, including scripts and image loading.
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const root = template.content;
    for (const math of root.querySelectorAll('script[type^="math/"], .math, [data-math-source]')) {
        if (math.querySelector('math, svg')) continue;
        const source = math.getAttribute('data-math-source') || math.getAttribute('data-math') || math.textContent;
        if (source?.trim()) {
            const pre = document.createElement('pre'); pre.className = 'export-math-source';
            pre.textContent = source.trim(); pre.setAttribute('data-export-label', '公式源码'); math.replaceWith(pre);
        }
    }
    for (const media of root.querySelectorAll('iframe, video, audio, object, embed')) {
        const figure = document.createElement('figure'); figure.className = 'export-media';
        const sources = [media.getAttribute('src'), media.getAttribute('data'), ...[...media.querySelectorAll('source[src]')].map(el => el.getAttribute('src'))].map(src => exportUrl(src, origin)).filter(Boolean);
        const poster = exportUrl(media.getAttribute('poster'), origin);
        if (poster) { const image = document.createElement('img'); image.src = poster; image.alt = '媒体封面'; figure.appendChild(image); }
        const note = document.createElement('figcaption'); note.textContent = `${media.tagName.toLowerCase() === 'audio' ? '音频' : '媒体'}内容需联网查看：`; figure.appendChild(note);
        for (const src of new Set(sources)) { const link = document.createElement('a'); link.href = src; link.textContent = media.getAttribute('title') || src; figure.appendChild(link); }
        if (!sources.length) note.append('请访问原帖');
        media.replaceWith(figure);
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
        if (!src) { img.replaceWith(document.createTextNode(img.alt || '[图片地址不可用]')); return; }
        img.setAttribute('src', embed ? await resources.embed(src) : src);
        img.setAttribute('loading', 'eager');
    }));
    checkAbort(signal);
    return cleanExportHTML(wrapper.innerHTML, document);
}

function escapeText(text) {
    return text.replace(/[\\`*_[\]<>#!~]/g, '\\$&')
        .replace(/^( {0,3})([-+]|\d+[.)])(?=[ \t])/gm, (_, indent, marker) => indent + marker.slice(0, -1) + '\\' + marker.slice(-1));
}
function fenceFor(text, minimum = 3) { return '`'.repeat(Math.max(minimum - 1, ...[...text.matchAll(/`+/g)].map(match => match[0].length)) + 1); }

export function htmlToMarkdown(html, { document, origin } = {}) {
    const template = document.createElement('template');
    template.innerHTML = cleanExportHTML(html, document);
    const children = node => [...node.childNodes].map(convert).join('');
    const convert = node => {
        if (node.nodeType === 3) return escapeText((node.nodeValue || '').replace(/[ \t\r\n\f]+/g, ' '));
        if (node.nodeType !== 1) return '';
        const tag = node.tagName.toLowerCase();
        const text = () => children(node);
        switch (tag) {
            case 'br': return '  \n';
            case 'p': return `${text().trim()}\n\n`;
            case 'strong': case 'b': return `**${text()}**`;
            case 'em': case 'i': return `*${text()}*`;
            case 'del': case 's': return `~~${text()}~~`;
            case 'pre': {
                const code = node.querySelector('code') || node;
                const raw = code.textContent || '';
                const fence = fenceFor(raw);
                const lang = code.className?.match(/(?:language|lang)-([\w-]+)/)?.[1] || (node.classList.contains('export-math-source') ? 'math' : '');
                return `\n\n${fence}${lang}\n${raw}${raw.endsWith('\n') ? '' : '\n'}${fence}\n\n`;
            }
            case 'code': {
                const raw = node.textContent || ''; const fence = fenceFor(raw, 1); const pad = /^`|`$|^ | $/.test(raw) ? ' ' : '';
                return `${fence}${pad}${raw}${pad}${fence}`;
            }
            case 'a': {
                if (node.classList.contains('anchor')) return '';
                const value = node.getAttribute('href') || '';
                const href = value.startsWith('#') ? value : exportUrl(value, origin);
                const label = text().trim();
                return href ? `[${label || escapeText(href)}](<${href.replace(/>/g, '%3E')}>)` : label;
            }
            case 'img': {
                if (node.classList.contains('emoji')) return node.getAttribute('alt') || '';
                const src = selectImage(node, origin); const alt = escapeText(node.getAttribute('alt') || '图片');
                return src ? `![${alt}](<${src.replace(/>/g, '%3E')}>)` : `[${alt}]`;
            }
            case 'ul': case 'ol': {
                const start = Number(node.getAttribute('start')) || 1;
                return '\n' + [...node.children].filter(child => child.tagName === 'LI').map((li, index) => {
                    const prefix = tag === 'ol' ? `${start + index}. ` : '- ';
                    const value = children(li).trim();
                    return prefix + value.replace(/\n/g, '\n' + ' '.repeat(prefix.length));
                }).join('\n') + '\n\n';
            }
            case 'aside': case 'blockquote': {
                if (tag === 'aside' && !node.classList.contains('quote')) return `\n${text()}\n`;
                if (tag === 'aside') { const quote = node.querySelector('blockquote'); if (quote) return convert(quote); }
                return text().trim().split('\n').map(line => '> ' + line).join('\n') + '\n\n';
            }
            case 'table': {
                if (node.querySelector('[rowspan], [colspan], table table')) return `\n\n${node.outerHTML}\n\n`;
                const rows = [...node.rows]; if (!rows.length) return '';
                const width = Math.max(...rows.map(row => row.cells.length));
                const rowText = row => '| ' + Array.from({ length: width }, (_, index) => row.cells[index] ? children(row.cells[index]).trim().replace(/\|/g, '\\|').replace(/\n/g, '<br>') : '').join(' | ') + ' |';
                const hasHeader = [...rows[0].cells].some(cell => cell.tagName === 'TH');
                const header = hasHeader ? rowText(rows.shift()) : '| ' + Array(width).fill(' ').join(' | ') + ' |';
                return '\n\n' + [header, '| ' + Array(width).fill('---').join(' | ') + ' |', ...rows.map(rowText)].join('\n') + '\n\n';
            }
            case 'details': return `\n\n<details${node.hasAttribute('open') ? ' open' : ''}>\n${node.innerHTML}\n</details>\n\n`;
            case 'hr': return '\n\n---\n\n';
            case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': return '\n\n' + '#'.repeat(Math.min(6, Number(tag[1]) + 2)) + ' ' + text().trim() + '\n\n';
            case 'div': case 'figure': case 'section': return `\n${text()}\n`;
            case 'svg': case 'math': return node.outerHTML;
            default: return text();
        }
    };
    return children(template.content).trim();
}

export const EXPORT_EXTRA_CSS = `
.post-content .emoji{display:inline-block;width:1.2em;height:1.2em;max-height:none;margin:0 .1em;vertical-align:-.15em;border-radius:0}
.post-content .lightbox-wrapper,.post-content .lightbox{display:block;max-width:100%}.post-content .meta{color:#667085;font-size:12px;display:block}
.post-content .export-image-caption{display:block;font-size:12px;line-height:1.5;color:#667085;text-align:center;margin:4px 0 8px}.post-content svg{max-width:100%}
.post-content details{border:1px solid #d4dfd9;border-radius:6px;padding:8px 12px;margin:12px 0}.post-content summary{cursor:pointer;font-weight:600}
.post-content .spoiler,.post-content .spoiler-blurred{filter:none!important;opacity:1!important}.post-content .spoiler::before{content:'〔剧透内容〕';font-size:12px;color:#667085}
.post-content .onebox{display:block;border:1px solid #d4dfd9;padding:12px;margin:12px 0;overflow-wrap:anywhere}.post-content .onebox img{max-height:200px}
.post-content .export-media{border-left:3px solid #4b5ea8;padding:8px 12px}.export-media a{display:block}.export-math-source::before{content:'公式源码';display:block;font-size:12px;color:#94a3b8}
.post-content .table-wrapper{overflow-x:auto}.post-content table{table-layout:auto}.post-content th{font-weight:600;background:#f6f8f5}
.export-warnings{padding:14px;border:1px solid #d6a348;background:#fff9ed;margin:16px 0;overflow-wrap:anywhere}.export-warnings li{margin:6px 0}
@media print{.post-content .lightbox-wrapper{break-inside:avoid}.post-content .table-wrapper{overflow:visible}.post-content thead{display:table-header-group}.post-content tr{break-inside:avoid}.post-content pre{overflow:visible;white-space:pre-wrap;overflow-wrap:anywhere}.post-content h1,.post-content h2,.post-content h3,.post-content summary{break-after:avoid}.post-content .emoji{max-height:none}.post-content .onebox{break-inside:auto}}
`;
