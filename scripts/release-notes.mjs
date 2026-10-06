#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readUserscriptVersion(src) {
    const match = String(src).match(/^\/\/ @version\s+(\S+)/m);
    return match ? match[1].trim() : '';
}

export function isReleaseVersion(version) {
    return /^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version);
}

export function extractReadmeNotes(readme, version) {
    if (!version) return '';
    const heading = `### v${version}`;
    const lines = String(readme).split(/\r?\n/);
    const start = lines.findIndex((line) => line.trim() === heading);
    if (start < 0) return '';
    const body = [];
    for (let i = start + 1; i < lines.length; i++) {
        if (/^###\s/.test(lines[i])) break;
        body.push(lines[i]);
    }
    return body.join('\n').trim();
}

export function buildReleaseBody({ version, notes, repository }) {
    const changelog = notes?.trim()
        ? notes.trim()
        : '请查看 [README.md](./README.md) 了解详细更新内容。';
    const repo = repository || 'caigg188/LDStatusPro';
    return `## 🎉 v${version} 更新内容

${changelog}

---

## 📥 安装方式

### 方式一：直接安装（推荐）

确保已安装脚本管理器，然后点击下方链接：

**[🔗 点击安装 LDStatus Pro](https://raw.githubusercontent.com/${repo}/main/LDStatusPro.user.js)**

### 方式二：从 GreasyFork 安装

访问 [GreasyFork 页面](https://greasyfork.org/zh-CN/scripts/558575-ldstatus-pro) 安装（可能有延迟）

---

## 📋 支持的脚本管理器

| 平台 | 脚本管理器 | 状态 |
|------|-----------|------|
| Chrome/Edge/Firefox | Tampermonkey | ✅ 完全支持 |
| Chrome/Edge/Firefox | Violentmonkey | ✅ 完全支持 |
| Safari (macOS) | Tampermonkey / Userscripts | ✅ 完全支持 |
| Safari (iOS) | Stay | ✅ 完全支持 |

---

## 🔄 如何更新

- **自动更新**: 脚本管理器会定期检查更新（通常 1-24 小时）
- **手动更新**: 在脚本管理器中点击"检查更新"
`;
}

function main() {
    const versionArg = process.argv[2];
    const userscript = fs.readFileSync(path.join(root, 'LDStatusPro.user.js'), 'utf8');
    const version = versionArg || readUserscriptVersion(userscript);
    if (!isReleaseVersion(version)) {
        console.error(`Invalid userscript version: ${version || '(empty)'}`);
        process.exit(1);
    }
    const notes = extractReadmeNotes(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), version);
    const repository = process.env.GITHUB_REPOSITORY || 'caigg188/LDStatusPro';
    process.stdout.write(buildReleaseBody({ version, notes, repository }));
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
