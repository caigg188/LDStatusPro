#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { assertIndentSafe } from './embed-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BEGIN = '// @@I18N_BEGIN';
const END = '// @@I18N_END';

export async function buildI18nSnippet() {
    const result = await build({
        entryPoints: [path.join(root, 'src/i18n/index.mjs')],
        bundle: true,
        write: false,
        format: 'iife',
        globalName: 'I18n',
        platform: 'browser',
        target: 'es2020',
        minifyWhitespace: true,
        minifyIdentifiers: true,
        minifySyntax: false,
        legalComments: 'inline',
        charset: 'utf8'
    });
    const raw = result.outputFiles[0].text.trim();
    // 目前该包没有多行模板字符串；一旦出现，缩进会改写翻译文本，这里直接让构建失败
    assertIndentSafe(raw);
    const indented = raw
        .split('\n')
        .map(line => (line ? `            ${line}` : ''))
        .join('\n');
    const snippet = [
        `        ${BEGIN}`,
        '        // prettier-ignore',
        indented,
        `        ${END}`
    ].join('\n');
    return {
        snippet,
        rawBytes: Buffer.byteLength(raw, 'utf8'),
        gzipBytes: zlib.gzipSync(Buffer.from(raw, 'utf8')).byteLength
    };
}

async function embed({ check = false, stats = false } = {}) {
    const userPath = path.join(root, 'LDStatusPro.user.js');
    const text = fs.readFileSync(userPath, 'utf8');
    const beginIdx = text.indexOf(BEGIN);
    const endIdx = text.indexOf(END);
    if (beginIdx < 0 || endIdx < 0 || endIdx < beginIdx) {
        throw new Error('i18n markers missing in LDStatusPro.user.js');
    }
    const lineStart = text.lastIndexOf('\n', beginIdx) + 1;
    const lineEnd = text.indexOf('\n', endIdx);
    const next = lineEnd < 0 ? text.length : lineEnd;
    const { snippet, rawBytes, gzipBytes } = await buildI18nSnippet();
    const updated = `${text.slice(0, lineStart)}${snippet}${text.slice(next)}`;
    if (stats) {
        console.log(`I18n bundle: ${rawBytes} B (${gzipBytes} B gzip)`);
    }
    if (check) {
        if (updated !== text) {
            console.error('LDStatusPro.user.js I18n is stale. Run npm run embed:i18n');
            process.exit(1);
        }
        return;
    }
    fs.writeFileSync(userPath, updated);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await embed({
        check: process.argv.includes('--check'),
        stats: process.argv.includes('--stats')
    });
}
