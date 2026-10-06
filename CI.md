# CI / CD

核对日期：2026-10-06。工作流在 `.github/workflows/`。

推送到 `main` 或打开 Pull Request 时跑 CI。用户脚本 `@version` 在 `main` 上通过检查后会自动创建 GitHub Release。生产 Cloudflare Pages **不会**随推送自动发布。最近两次红灯来自门禁和页面合同不一致，不是 Actions 没有启动。

## 为什么最近的推送失败

| 运行 | 失败点 | 原因 |
|---|---|---|
| [#54](https://github.com/caigg188/LDStatusPro/actions/runs/35563340541) 浏览器 | `commerce.spec.ts` 找不到 `.seller-fulfillment-gate` | Paper Console 在履约页自身隐藏壳层横幅，测试仍要求横幅出现 |
| [#55](https://github.com/caigg188/LDStatusPro/actions/runs/35571995916) 质量 | `media-scheduling.test.js` 要求 `height: 140px` | 封面高度已改成 `--card-cover-h`，140px 只留在标准密度 token |
| [#55](https://github.com/caigg188/LDStatusPro/actions/runs/35571995916) 浏览器 | 手机筛选按钮高度 `43.999… < 44` | Pixel 5 的 2.625 倍像素比把 44px 测成了亚像素 |

更早的 40 次运行里有 36 次成功。`npm audit --audit-level=low` 仍是质量门禁，新的低危公告也会让这一步变红。

## CI

文件：`.github/workflows/ci.yml`。

- 运行器固定 `ubuntu-24.04`。`ubuntu-latest` 将在 2026-10-19 切到 Ubuntu 26。
- Node.js 22，与 `ld-store` 的 `engines` 一致。
- Actions 使用 `actions/checkout@v7`、`actions/setup-node@v7`、`actions/upload-artifact@v7`，避免 v4 在 Node 20 上的弃用警告。
- 同一 ref 的新推送会取消还在跑的 CI。
- 只跑本次 diff 碰到的部分。改了 `.github/workflows/` 时三部分都跑。

| Job | 触发路径 | 命令 |
|---|---|---|
| Userscript | `LDStatusPro.user.js`、根目录 `eslint.config.js`、`package.json`、`package-lock.json`、`src/core/**`、`tests/**`、`scripts/embed-core.mjs`、`scripts/release-notes.mjs` | `npm ci`、`npm run check` |
| Release userscript | 仅 `main` 推送，且 Userscript 检查成功 | 读取 `@version`，若 `v{version}` Release 不存在则创建并附带 `LDStatusPro.user.js` |
| Website | `website/**` | `npm ci`、`npm run lint`、`npm run build` |
| Storefront quality | `ld-store/**` | 与 `ld-store` 的 `npm run check` 相同，分步执行 |
| Storefront browser | `ld-store/**` | 安装 Chromium 后 `npm run test:e2e`。失败时保留报告 7 天 |

浏览器任务通过 `scripts/run-browser-tests.mjs` 丢掉应用密钥和 `VITE_*`，只保留系统环境。不要把生产地址或真实 token 写进这个任务。

根目录 `package.json` 里的 `check:agent-samples` 指向不存在的脚本，CI 不执行它。

## CD

### 用户脚本 Release

`ci.yml` 里的 `Release userscript` 只在 `main` 推送、且 Userscript 检查成功后运行。它读取 `LDStatusPro.user.js` 的 `@version`，用 `README.md` 对应章节生成说明。`v{version}` 已存在时跳过，避免重复发版。士多或官网检查失败不会挡住脚本发版。

发版前把 `@version` 和 `README.md` 的 `### vX.Y.Z` 写好。安装链接仍指向 `main` 上的 `LDStatusPro.user.js`。

### Pages

文件：`.github/workflows/deploy-pages.yml`。在 Actions 页面手动运行 **Deploy Pages**，并且必须选 `main`。

仓库还没有 Cloudflare 或 Faro 密钥。自动发布会让每次推送都因为缺密钥失败，所以发布保持手动。

需要的仓库 Secrets：

| Secret | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Wrangler 发布 Pages |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 |
| `VITE_FARO_API_KEY` | 仅士多。至少 16 个字符，collector 固定为 `https://api1.ldspro.qzz.io/faro/collect` |

`storefront` 调用 `ld-store/scripts/deploy-pages-production.sh`。脚本仍要求工作区干净、`HEAD` 等于 `origin/main`、Faro 开启、公开构建没有 source map，并且公开 JS 与带 source map 的私有构建一致。GitHub Actions 上用 `GITHUB_REF == refs/heads/main` 判断分支，因为 checkout 可能是 detached HEAD。

`website` 先 lint 和 build，再发布到 Pages 项目 `ldstatus-pro`。

本地仍可在对应目录执行 `npm run deploy`。士多的本地发布继续要求当前分支是 `main`。
