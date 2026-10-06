import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    escapeHtml,
    isAllowedBridgeUrl,
    sanitizeHref,
    renderMarkdown
} from '../src/core/sanitize.mjs';

const CDK = 'https://cdk.linux.do';
const LDC = 'https://credit.linux.do';

test('escapeHtml encodes markup', () => {
    assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
    assert.equal(escapeHtml(`a&b"'`), 'a&amp;b&quot;&#x27;');
    assert.equal(escapeHtml(null), '');
});

test('isAllowedBridgeUrl accepts same-origin https API paths', () => {
    assert.equal(isAllowedBridgeUrl('https://cdk.linux.do/api/v1/oauth/user-info', CDK), true);
    assert.equal(isAllowedBridgeUrl('https://credit.linux.do/api/v1/order/transactions', LDC), true);
    assert.equal(isAllowedBridgeUrl('https://cdk.linux.do/api/v1/projects/abc-1', CDK), true);
});

test('isAllowedBridgeUrl rejects host, protocol, credential, and path bypasses', () => {
    assert.equal(isAllowedBridgeUrl('https://cdk.linux.do.evil.com/api/v1/x', CDK), false);
    assert.equal(isAllowedBridgeUrl('https://evil.com/api/v1/x', CDK), false);
    assert.equal(isAllowedBridgeUrl('http://cdk.linux.do/api/v1/x', CDK), false);
    assert.equal(isAllowedBridgeUrl('https://user:pass@cdk.linux.do/api/v1/x', CDK), false);
    assert.equal(isAllowedBridgeUrl('https://cdk.linux.do@evil.com/api/v1/x', CDK), false);
    assert.equal(isAllowedBridgeUrl('https://cdk.linux.do/api/../dashboard', CDK), false);
    assert.equal(isAllowedBridgeUrl('https://cdk.linux.do/dashboard', CDK), false);
    assert.equal(isAllowedBridgeUrl('https://cdk.linux.do/api', CDK), false);
    assert.equal(isAllowedBridgeUrl('https://credit.linux.do/api/v1/x', CDK), false);
    assert.equal(isAllowedBridgeUrl('not a url', CDK), false);
    assert.equal(isAllowedBridgeUrl('', CDK), false);
});

test('sanitizeHref allows http(s) and drops other schemes', () => {
    assert.equal(sanitizeHref('https://linux.do/t/1'), 'https://linux.do/t/1');
    assert.equal(sanitizeHref('http://example.com/a?x=1&amp;y=2'), 'http://example.com/a?x=1&y=2');
    assert.equal(sanitizeHref('javascript:alert(1)'), '');
    assert.equal(sanitizeHref('data:text/html,<script>alert(1)</script>'), '');
    assert.equal(sanitizeHref('https://user:pass@evil.com/'), '');
    assert.equal(sanitizeHref('/relative'), '');
});

test('renderMarkdown escapes raw HTML from model output', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>');
    assert.equal(html.includes('<img'), false);
    assert.equal(html.includes('&lt;img src=x onerror=alert(1)&gt;'), true);
});

test('renderMarkdown drops javascript links and keeps text', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    assert.equal(html.includes('href='), false);
    assert.equal(html.includes('click'), true);
});

test('renderMarkdown keeps https links with noopener', () => {
    const html = renderMarkdown('[docs](https://linux.do/t/1)');
    assert.match(html, /href="https:\/\/linux\.do\/t\/1"/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.match(html, /target="_blank"/);
});

test('renderMarkdown escapes HTML inside code fences', () => {
    const html = renderMarkdown('```\n<script>alert(1)</script>\n```');
    assert.equal(html.includes('<script>'), false);
    assert.equal(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
    assert.match(html, /<pre class="ldsp-melon-codeblock">/);
});

test('renderMarkdown still formats bold and headings', () => {
    const html = renderMarkdown('## Title\n\n**bold** and *em*');
    assert.match(html, /<h3 class="ldsp-melon-h3">Title<\/h3>/);
    assert.match(html, /<strong>bold<\/strong>/);
    assert.match(html, /<em>em<\/em>/);
});
