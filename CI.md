# CI / CD

## 目标与边界

更新日期：2026-10-17。LDStatusPro 插件合并 `main` 即视为发布；Pages（商城和官网）只在本机显式发布。GitHub 不保存 Pages 发布凭据，不提供远程部署工作流。

本轮优化范围：官网依赖触发、审计失败处理、共享发布检查、CI 汇总门禁、同一 SHA 的本机发布校验。保留现有目录、测试隔离和商城私有 source map 校验，不引入新的构建框架或发布平台。

## CI 与分支保护

`.github/workflows/ci.yml` 在 `main` push 和 Pull Request 上运行，使用 Ubuntu 24.04、Node.js 22、`npm ci` 和 lockfile 缓存。同一 ref 的新运行取消旧运行。

| 检查 | 触发条件 | 检查入口 |
|---|---|---|
| Userscript | 插件、根配置、核心模块、根测试变更 | 根目录 `npm run check` |
| Website | `website/**` 或根目录 `LDStatusPro.user.js` 变更 | `website` 的 `npm run check:deploy` |
| Storefront quality | `ld-store/**` 变更 | `check:source` → `test` → `build` → `check:artifact` |
| Storefront browser | `ld-store/**` 变更 | 隔离的 `npm run test:e2e` |
| CI gate | 每次运行，即使依赖失败 | 变更检测成功；受影响任务全部成功；未受影响任务正常跳过 |

修改 `.github/workflows/**` 或根目录 `scripts/**` 时检查全部组件。官网从插件源码生成展示资源，所以插件源码变更必须验证官网；若截图哈希过期，按官网既有截图流程更新，不能绕过校验。

CI gate 拒绝失败、取消、缺少变更标记及受影响任务被跳过。它不依赖 Release 任务，避免循环依赖。Release 等待 CI gate 和 Userscript 成功，仅在 `main` push 时创建新版本；已存在的版本不会重建。插件更新地址仍指向 `main`，因此 **PR 合并前的必需检查才是插件发布门禁**。

### 仓库管理员配置（本地修改完成后，尚需在 GitHub 操作）

1. 先按授权提交、推送本批改动，让新工作流至少运行一次，确认检查名称 `CI gate` 已出现。
2. GitHub 仓库 Settings → Rules → Rulesets → New branch ruleset，名称可用 `main-quality`，目标为默认分支 `main`，Enforcement status 设为 Active。
3. 启用 Require a pull request before merging、Require status checks to pass，选择 `CI gate`（来源 GitHub Actions）。启用 Require branches to be up to date before merging，防止在旧基线上通过后直接合并。
4. 启用 Block force pushes 和 Restrict deletions。单人维护将 Required approvals 设为 0；日常操作不设置无限制 bypass。
5. 用临时 PR 验证失败检查确实阻止合并、修复后可合并。不要合并故意失败的代码。以后通过分支和 PR 修改 `main`。

官方依据：[必需检查与跳过行为](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)。仅修改工作流不会自动开启分支保护。

## 本机 Pages 发布

前提：已获发布授权、Node.js 22、GitHub CLI 已登录且可读取 Actions、依赖已通过 `npm ci` 安装、Wrangler 已具备对应 Cloudflare 账户发布权限。可先用 `gh auth status` 检查 GitHub 登录；无需向 GitHub 添加 Cloudflare Secrets。

在对应目录执行 `npm run deploy`：

- 商城：`ld-store`，项目 `ld-store`。
- 官网：`website`，项目 `ldstatus-pro`。

两个入口共用 `scripts/verify-pages-release.mjs`，依次校验：

1. 本机运行，canonical `origin` 为 `caigg188/LDStatusPro`，当前分支 `main`，整个工作区干净。
2. `git fetch origin main` 后，`HEAD == origin/main`；只 fetch，不自动切分支或拉取工作区代码。
3. 该完整 SHA 最新的 `main` push CI 已完成且成功，且包含真正成功的 `CI gate`。没有 CI、仍在运行、失败、取消或旧工作流没有 gate，一律拒绝；GitHub 查询失败也不会跳过检查。
4. 记录 SHA，执行本产品构建与静态检查；上传前再次校验上述条件及 SHA 未变化。
5. Wrangler 显式接收 `--branch main --commit-hash=<SHA> --commit-dirty=false`。

商城保留 Faro 配置检查，以及私有 source map 构建和公开 JS 哈希一致性检查。`check:source` 汇总 lint、类型、架构、样式、CSP、noindex、依赖审计；`check:artifact` 汇总构建后的 CSP、noindex、OG、体积检查。`check:deploy` 复用这两个入口，禁止加入测试。官网 `check:deploy` 复用 lint 和构建。

依赖审计允许已有的明确公告豁免，但网络/工具失败、无效 JSON 或无效报告必须失败；合法的 npm audit 退出码 1 仍按具体漏洞和豁免判断。

任何发布前应保留上次 Pages 部署 ID 作为回退入口；发布后核对稳定域名、关键资源和响应内容，交互变化补实际页面验收。这些仍是发布验收要求，当前脚本成功输出不代表已经完成线上验收。原生回退见 [Cloudflare Rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)。

## 测试与验收

- 根目录 `npm run check`：插件 lint、核心嵌入一致性、单测，包含 CI gate 和本机发布守卫回归。
- `ld-store` 的 `npm test -- tests/check-audit.test.js tests/deploy-script-policy.test.js`：审计错误/豁免、发布安全检查入口。
- 本机发布回归在临时目录替换 Git、GitHub CLI、npm 和 Wrangler；覆盖成功、脏工作区、错误分支/远程、未同步 SHA、失败或缺失 CI、API 不可用、构建中提交变化。不会调用真实部署服务或加载生产凭据。
- 商城单测禁用真实网络；浏览器任务丢弃应用环境并使用本地 Mock。真实数据库验收默认跳过，不把 Mock 通过视为数据库集成验收。
- 本轮本地验证（2026-10-17，基线 `e4dd46684ff4ec399aae964c3c149d6be70ca385` 加未提交改动，Node 22.23.3）：根检查通过，根测试合计 19 项通过；商城目标单测 6 项通过；商城源码检查、真实依赖审计、构建及产物检查通过；官网 lint 与构建通过。官网已有 `AnnualReport2025.tsx:1128` React Hook 依赖警告，本轮未改动。
- `actionlint 1.7.12`、ShellCheck、`git diff --check` 通过。发布入口通过假命令验证，不等于真实发布；本轮没有重跑浏览器或数据库集成测试。初次本地验收时尚未提交或推送，GitHub 实际执行、分支保护阻断及线上发布均未验证。后续 CI 结果以对应提交的 Actions 记录为准；本批不部署、不修改仓库设置。

后续可独立处理：锁定 Wrangler 版本、自动发布回执与稳定域名验收。本轮不新增测试分片、远程缓存或自托管 Runner。
