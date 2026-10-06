/**
 * Pure sanitizers shared by the userscript (embedded as SafeDom) and unit tests.
 * Edit this file, then run `npm run embed:core`.
 */

const HTML_ENTITIES = Object.freeze({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;'
});

export function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str).replace(/[&<>"']/g, (c) => HTML_ENTITIES[c] || c);
}

/**
 * Allow only https URLs on an exact origin, with no credentials.
 * By default the path must be under /api/.
 */
export function isAllowedBridgeUrl(url, expectedOrigin, options = {}) {
    if (typeof url !== 'string' || !url || typeof expectedOrigin !== 'string') return false;

    let expected;
    try {
        expected = new URL(expectedOrigin);
    } catch {
        return false;
    }
    if (expected.protocol !== 'https:') return false;
    if (expected.username || expected.password) return false;

    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    if (parsed.origin !== expected.origin) return false;
    if (options.apiPathOnly !== false) {
        const path = parsed.pathname || '';
        if (!path.startsWith('/api/')) return false;
    }
    return true;
}

export function sanitizeHref(url) {
    if (typeof url !== 'string') return '';
    const decoded = url.trim().replace(/&amp;/gi, '&');
    if (!decoded) return '';
    let parsed;
    try {
        parsed = new URL(decoded);
    } catch {
        return '';
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (parsed.username || parsed.password) return '';
    return parsed.href;
}

export function renderMarkdown(md) {
    if (md === undefined || md === null || md === '') return '';

    const codeBlocks = [];
    const inlineCodes = [];
    const cbPh = (i) => `\uE000CB${i}\uE001`;
    const icPh = (i) => `\uE000IC${i}\uE001`;

    let html = String(md).replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
        const placeholder = cbPh(codeBlocks.length);
        codeBlocks.push(`<pre class="ldsp-melon-codeblock"><code>${escapeHtml(String(code).trim())}</code></pre>`);
        return placeholder;
    });

    html = html.replace(/`([^`\n]+)`/g, (_match, code) => {
        const placeholder = icPh(inlineCodes.length);
        inlineCodes.push(`<code class="ldsp-melon-inline-code">${escapeHtml(code)}</code>`);
        return placeholder;
    });

    html = escapeHtml(html);

    html = html.replace(/^#### (.+)$/gm, '<h5 class="ldsp-melon-h5">$1</h5>');
    html = html.replace(/^### (.+)$/gm, '<h4 class="ldsp-melon-h4">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 class="ldsp-melon-h3">$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2 class="ldsp-melon-h2">$1</h2>');

    html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="ldsp-melon-quote">$1</blockquote>');
    html = html.replace(/<\/blockquote>\n<blockquote class="ldsp-melon-quote">/g, '<br>');

    html = html.replace(/^[-*] (.+)$/gm, '<li class="ldsp-melon-li">$1</li>');
    html = html.replace(/((?:<li class="ldsp-melon-li">[^<]*<\/li>\n?)+)/g, '<ul class="ldsp-melon-ul">$1</ul>');

    html = html.replace(/^\d+\. (.+)$/gm, '<li class="ldsp-melon-oli">$1</li>');
    html = html.replace(/((?:<li class="ldsp-melon-oli">[^<]*<\/li>\n?)+)/g, '<ol class="ldsp-melon-ol">$1</ol>');

    html = html.replace(/^---+$/gm, '<hr class="ldsp-melon-hr">');
    html = html.replace(/^\*\*\*+$/gm, '<hr class="ldsp-melon-hr">');

    html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '<em>$1</em>');

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
        const safe = sanitizeHref(url);
        if (!safe) return text;
        return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer" class="ldsp-melon-link">${text}</a>`;
    });

    html = html.replace(/\n\n+/g, '</p><p class="ldsp-melon-p">');
    html = html.replace(/\n/g, '<br>');

    html = html.replace(/<p class="ldsp-melon-p"><\/p>/g, '');
    html = html.replace(/<p class="ldsp-melon-p">(<h[2-5])/g, '$1');
    html = html.replace(/(<\/h[2-5]>)<\/p>/g, '$1');
    html = html.replace(/<p class="ldsp-melon-p">(<ul)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p class="ldsp-melon-p">(<ol)/g, '$1');
    html = html.replace(/(<\/ol>)<\/p>/g, '$1');
    html = html.replace(/<p class="ldsp-melon-p">(<blockquote)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
    html = html.replace(/<p class="ldsp-melon-p">(<pre)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');
    html = html.replace(/<br><(h[2-5]|ul|ol|blockquote|pre)/g, '<$1');
    html = html.replace(/<\/(h[2-5]|ul|ol|blockquote|pre)><br>/g, '</$1>');

    codeBlocks.forEach((block, i) => {
        html = html.replace(cbPh(i), block);
    });
    inlineCodes.forEach((code, i) => {
        html = html.replace(icPh(i), code);
    });

    return `<div class="ldsp-melon-markdown"><p class="ldsp-melon-p">${html}</p></div>`;
}
