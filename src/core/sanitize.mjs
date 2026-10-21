import MarkdownIt from 'markdown-it';

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

const markdown = new MarkdownIt({ html: false, breaks: true, linkify: false });
markdown.renderer.rules.text = (tokens, index, options, env) => {
    const text = escapeHtml(tokens[index].content);
    if (!env.topicId || !Array.isArray(env.postNumbers)) return text;
    const origin = sanitizeHref(env.site || '');
    if (!origin) return text;
    return text.replace(/\[第(\d+)楼\]/g, (label, number) => env.postNumbers.includes(Number(number))
        ? `<a class="ldsp-melon-link" href="${escapeHtml(new URL(`/t/${encodeURIComponent(env.topicId)}/${number}`, origin).href)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label);
};
const defaultOpen = markdown.renderer.rules.link_open || ((tokens, index, options, env, renderer) => renderer.renderToken(tokens, index, options));
markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    const href = sanitizeHref(token.attrGet('href'));
    if (!href) { token.attrSet('href', '#'); }
    else token.attrSet('href', href);
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
    token.attrSet('class', 'ldsp-melon-link');
    return defaultOpen(tokens, index, options, env, renderer);
};
markdown.renderer.rules.image = (tokens, index) => {
    const token = tokens[index];
    const label = escapeHtml(token.content || '图片');
    const href = sanitizeHref(token.attrGet('src'));
    return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">[${label}]</a>` : label;
};
markdown.renderer.rules.fence = (tokens, index) => `<pre class="ldsp-melon-codeblock"><code>${escapeHtml(tokens[index].content)}</code></pre>`;
markdown.renderer.rules.code_inline = (tokens, index) => `<code class="ldsp-melon-inline-code">${escapeHtml(tokens[index].content)}</code>`;

export function renderMarkdown(md, context = {}) {
    if (md === undefined || md === null || md === '') return '';
    return `<div class="ldsp-melon-markdown">${markdown.render(String(md), context).replace(/<h([1-6])>/g, (_match, level) => `<h${Math.min(Number(level) + 1, 6)} class="ldsp-melon-h${Math.min(Number(level) + 1, 6)}">`).replace(/<\/h([1-6])>/g, (_match, level) => `</h${Math.min(Number(level) + 1, 6)}>` )}</div>`;
}
