#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BEGIN = '// @@CORE_SANITIZE_BEGIN';
const END = '// @@CORE_SANITIZE_END';

function buildSnippet() {
    const src = fs.readFileSync(path.join(root, 'src/core/sanitize.mjs'), 'utf8');
    const transformed = src
        .replace(/^export function /gm, 'function ')
        .replace(/\r\n/g, '\n')
        .replace(/\s+$/, '');
    const indented = transformed
        .split('\n')
        .map((line) => (line ? `            ${line}` : ''))
        .join('\n');
    return [
        `        ${BEGIN}`,
        '        // prettier-ignore',
        '        const SafeDom = (() => {',
        indented,
        '            return { escapeHtml, isAllowedBridgeUrl, sanitizeHref, renderMarkdown };',
        '        })();',
        `        ${END}`
    ].join('\n');
}

function embed(check) {
    const userPath = path.join(root, 'LDStatusPro.user.js');
    const text = fs.readFileSync(userPath, 'utf8');
    const beginIdx = text.indexOf(BEGIN);
    const endIdx = text.indexOf(END);
    if (beginIdx < 0 || endIdx < 0 || endIdx < beginIdx) {
        throw new Error('sanitize markers missing in LDStatusPro.user.js');
    }
    const lineStart = text.lastIndexOf('\n', beginIdx) + 1;
    const lineEnd = text.indexOf('\n', endIdx);
    const next = lineEnd < 0 ? text.length : lineEnd;
    const snippet = buildSnippet();
    const updated = `${text.slice(0, lineStart)}${snippet}${text.slice(next)}`;
    if (check) {
        if (updated !== text) {
            console.error('LDStatusPro.user.js SafeDom is stale. Run npm run embed:core');
            process.exit(1);
        }
        return;
    }
    fs.writeFileSync(userPath, updated);
}

const check = process.argv.includes('--check');
embed(check);
