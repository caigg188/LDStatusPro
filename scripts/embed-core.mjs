#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BEGIN = '// @@CORE_SANITIZE_BEGIN';
const END = '// @@CORE_SANITIZE_END';

// 缩进只能作用于代码，不能落在字符串内容里：任何带真实换行的模板字符串都会被缩进改写。
export function assertIndentSafe(code) {
    const visit = (node) => {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'TemplateElement' && /[\r\n]/.test(node.value.raw)) {
            throw new Error('SafeDom bundle contains a multi-line template literal; indenting it would change its content.');
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value.type === 'string') visit(value);
        }
    };
    visit(parse(code, { ecmaVersion: 'latest' }));
}

async function buildSnippet() {
    const result = await build({
        entryPoints: [path.join(root, 'src/core/browser-core.mjs')], bundle: true,
        write: false, format: 'iife', globalName: 'SafeDom', platform: 'browser',
        target: 'es2020', minifyWhitespace: true, minifyIdentifiers: true,
        minifySyntax: false, legalComments: 'inline', charset: 'utf8',
        // 模板字符串里的真实换行会被下面的缩进改写（每个换行后多出 12 个空格），
        // 导致导出的 Markdown、代码块和提示词内容被破坏；统一降级为普通字符串。
        supported: { 'template-literal': false }
    });
    const bundle = result.outputFiles[0].text.trim();
    assertIndentSafe(bundle);
    const indented = bundle
        .split('\n')
        .map((line) => (line ? `            ${line}` : ''))
        .join('\n');
    return [
        `        ${BEGIN}`,
        '        // prettier-ignore',
        indented,
        `        ${END}`
    ].join('\n');
}

async function embed(check) {
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
    const snippet = await buildSnippet();
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

// 仅在作为脚本直接执行时写入；被测试导入时不产生副作用
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await embed(process.argv.includes('--check'));
}
