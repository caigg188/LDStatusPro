# CI / CD

## 目标与边界

更新日期：2026-10-17。LDStatusPro 插件合并 `main` 即视为发布；Pages（商城和官网）只在本机显式发布。GitHub 不保存 Pages 发布凭据，不提供远程部署工作流。

第一批已补齐官网依赖触发、审计失败处理、共享发布检查、CI 汇总门禁及同一 SHA 的本机发布校验。第二批补齐 Wrangler 固定版本、发布回执、回退目标和发布后的只读验收。保留现有目录、测试隔离和商城私有 source map 校验，不引入新的构建框架或发布平台。

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

### 分支保护配置

仓库已启用 `main-quality` Ruleset 和合并后自动删除远程任务分支；以下是重建或核对步骤：

1. 确认工作流至少运行过一次，检查名称 `CI gate` 已出现。
2. GitHub 仓库 Settings → Rules → Rulesets → New branch ruleset，名称可用 `main-quality`，目标为默认分支 `main`，Enforcement status 设为 Active。
3. 启用 Require a pull request before merging、Require status checks to pass，选择 `CI gate`（来源 GitHub Actions）。启用 Require branches to be up to date before merging，防止在旧基线上通过后直接合并。
4. 启用 Block force pushes 和 Restrict deletions。单人维护将 Required approvals 设为 0；日常操作不设置无限制 bypass。
5. 用临时 PR 验证失败检查确实阻止合并、修复后可合并。不要合并故意失败的代码。以后通过分支和 PR 修改 `main`。

官方依据：[必需检查与跳过行为](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)。仅修改工作流不会自动开启分支保护。

## 本机 Pages 发布

前提：已获发布授权、Node.js 22.12 或更新版本（CI 使用 22）、GitHub CLI 已登录且可读取 Actions、依赖已通过 `npm ci` 安装、Wrangler 已具备对应 Cloudflare 账户发布权限。可先用 `gh auth status` 检查 GitHub 登录；无需向 GitHub 添加 Cloudflare Secrets。

在对应目录执行 `npm run deploy`：

- 商城：`ld-store`，项目 `ld-store`。
- 官网：`website`，项目 `ldstatus-pro`。

两个入口共用 `scripts/verify-pages-release.mjs`，依次校验：

1. 本机运行，canonical `origin` 为 `caigg188/LDStatusPro`，当前分支 `main`，整个工作区干净。
2. `git fetch origin main` 后，`HEAD == origin/main`；只 fetch，不自动切分支或拉取工作区代码。
3. 该完整 SHA 最新的 `main` push CI 已完成且成功，且包含真正成功的 `CI gate`。没有 CI、仍在运行、失败、取消或旧工作流没有 gate，一律拒绝；GitHub 查询失败也不会跳过检查。
4. 记录 SHA，执行本产品构建与静态检查；上传前再次校验上述条件及 SHA 未变化。
5. 发布器直接调用本项目安装的 Wrangler，不用 npx 临时下载。两个项目及其 lockfile 均固定 `wrangler: 4.151.1`，运行前检查安装版本与声明一致；显式传入 `--branch main --commit-hash=<SHA> --commit-dirty=false`。

商城保留 Faro 配置检查，以及私有 source map 构建和公开 JS 哈希一致性检查。`check:source` 汇总 lint、类型、架构、样式、CSP、noindex、依赖审计；`check:artifact` 汇总构建后的 CSP、noindex、OG、体积检查。`check:deploy` 复用这两个入口，禁止加入测试。官网 `check:deploy` 复用 lint 和构建。

依赖审计允许已有的明确公告豁免，但网络/工具失败、无效 JSON 或无效报告必须失败；合法的 npm audit 退出码 1 仍按具体漏洞和豁免判断。

### 发布回执与回退

两个入口在构建后调用 `scripts/pages-release.mjs`。发布器沿用 Wrangler OAuth 登录或 `CLOUDFLARE_API_TOKEN`，凭据只在内存中用于 API 请求，不写入回执或终端。未指定 `CLOUDFLARE_ACCOUNT_ID` 时仅自动选择唯一账户；多账户必须显式指定，Token 方式也建议同时设置账户 ID。不要使用全局 API Key。若本机依赖 HTTP(S) 代理，使用 Node 22.21+ 或 24+ 并在启动发布/复验命令前设置 `NODE_USE_ENV_PROXY=1`，使内置 fetch 沿用 `HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY`；参见 [Node.js 代理配置](https://nodejs.org/learn/http/enterprise-network-configuration)。

上传前只读查询 Pages 项目，确认生产分支为 `main`，读取 `canonical_deployment` 作为当前真正提供服务的生产部署。要求已有成功生产部署才能发布；查询失败或没有可用回退目标时停止上传。不会把最新预览部署或回滚前的历史最新记录当成当前版本。

每次发布在对应项目的 `.release-receipts/` 中生成唯一 JSON 回执（目录 0700、文件 0600，Git 忽略）。回执包含：

- 完整 Git SHA、固定的 Wrangler 版本、账户 ID、开始和更新时间、发布状态。
- 发布前的生产部署 ID、提交、地址、Cloudflare 控制台入口与回滚 API 地址。
- 本次实际部署 ID、部署地址、首页及入口 JS/CSS 的本地哈希、逐项验收结果。商城另记录私有 source map 压缩包路径和 SHA-256。

上传前先保存回执，再复核 Git/CI 门禁。Wrangler 结构化输出中的项目、环境、提交必须与本次发布一致，不能仅凭命令退出码判断上线。上传或验收失败会保留 `failed` 回执并返回非零；异常中断留下的 `prepared`、`deploying`、`verifying` 也不能视为成功。只有全部验收通过才标为 `verified`。

验收失败时部署可能已经生效，先查看回执中的当前部署和 `rollback` 信息。需要回退时，在 `rollback.dashboardUrl` 对应的 Cloudflare 控制台选择回执记录的旧生产部署执行 Rollback；API 方式的 HTTP 方法和精确地址也保存在回执中。回退属于生产变更，必须有相应授权，本脚本不会自动回退或自动重试上传。参见 [Cloudflare Rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)。

回执和商城私有 source map 是本机证据；归档发布 worktree 前应妥善保留这些忽略文件。

### 发布后只读验收

发布器自动进行以下 GET 检查，不调用订单、支付等业务 API：

1. Cloudflare 当前生产部署必须是本次实际部署 ID 和完整 SHA，且部署阶段成功。
2. 部署专属域名和稳定域名（商城 `https://ldcstore.com`，官网 `https://ldspro.qzz.io`）的首页返回 200、HTML 内容类型、预期挂载节点及精确匹配的本地入口资源引用。
3. 本地 index.html 引用的 JS、CSS、modulepreload 及本地启动脚本逐个返回 200，内容类型正确，SHA-256 与本地构建匹配。第三方资源不在此验收范围。
4. 首页安全响应头与构建产物 `_headers` 的全局规则匹配；商城包括 CSP 和 noindex。商城 Worker 会改写首页元数据，因此记录首页响应哈希，但不要求整页字节等同于本地 index.html。
5. 最后再次检查当前生产部署，避免验收中途被其他发布替换后仍报告成功。

为等待部署和域名传播，只读检查最多执行 6 轮、轮间等待 5 秒，每个请求超时 15 秒，不跟随重定向。全过程不执行生产测试、不写业务数据。Cloudflare 元数据和凭据原文不进入回执。

在对应项目目录可再次执行：

```bash
npm run verify:release -- .release-receipts/<回执文件名>.json
```

复验仅查询和 GET 资源、更新同一份本地回执，不构建、不上传、不回退。若稳定域名当前已发布其他版本，旧回执复验会明确失败。静态资源及响应头验收不等于浏览器交互验收；涉及用户流程的发布仍需补页面检查。

## 测试与验收

- 根目录 `npm run check`：插件 lint、核心嵌入一致性、单测，包含 CI gate 和本机发布守卫回归。
- `ld-store` 的 `npm test -- tests/check-audit.test.js tests/deploy-script-policy.test.js`：审计错误/豁免、发布安全检查入口。
- 本机发布回归在临时目录替换 Git、GitHub CLI、npm 和 Wrangler；覆盖成功、脏工作区、错误分支/远程、未同步 SHA、失败或缺失 CI、API 不可用、构建中提交变化。不会调用真实部署服务或加载生产凭据。
- 商城单测禁用真实网络；浏览器任务丢弃应用环境并使用本地 Mock。真实数据库验收默认跳过，不把 Mock 通过视为数据库集成验收。
- 本轮本地验证（2026-10-17，基线 `e4dd46684ff4ec399aae964c3c149d6be70ca385` 加未提交改动，Node 22.23.3）：根检查通过，根测试合计 19 项通过；商城目标单测 6 项通过；商城源码检查、真实依赖审计、构建及产物检查通过；官网 lint 与构建通过。官网已有 `AnnualReport2025.tsx:1128` React Hook 依赖警告，本轮未改动。
- `actionlint 1.7.12`、ShellCheck、`git diff --check` 通过。发布入口通过假命令验证，不等于真实发布；本轮没有重跑浏览器或数据库集成测试。初次本地验收时尚未提交或推送，GitHub 实际执行、分支保护阻断及线上发布均未验证。后续 CI 结果以对应提交的 Actions 记录为准；本批不部署、不修改仓库设置。

第二批本地验收结果在交付时记录；GitHub CI、实际 Cloudflare 发布、回退执行及生产验收均未在本轮运行。本轮不新增测试分片、远程缓存或自托管 Runner。

### 第二批本地验收记录

2026-10-17，基线 `7aaaed4f0744dbaf8ad2b7c699409ac0e2364783` 加 `ci/pages-release-receipts` 未提交改动；使用 Node 22.23.3：

- 两个项目 `npm ci --ignore-scripts` 成功，实际 Wrangler `--version` 均为 4.151.1；原有锁定依赖无版本变动。
- 根 `npm run check` 通过：24 项测试（含发布器、入口与门禁）通过。发布器测试屏蔽真实 fetch，Cloudflare 请求与上传使用注入的假响应/命令；覆盖 OAuth、账户选择、回退快照、凭据不落盘、失败回执、静态资源/响应头/类型不匹配、只读复验、传播重试及并发发布替换。
- 商城目标单测 6 项通过；两项目 `npm run check:deploy` 均通过，商城依赖审计无阻断项。官网保留一条原有 React Hook 依赖警告。
- 使用实际构建产物生成清单：商城首页与 14 个入口资源，官网首页与 2 个入口资源。ShellCheck、`git diff --check` 通过。
- 初次本地验收未提交、推送或部署；未做生产 HTTP 验收、浏览器或数据库集成测试。后续 CI 结果以对应提交的 Actions 记录为准，实际 Cloudflare 发布/回退及外部接口行为仍需在将来获授权发布时验证。

复审补充：上传失败且无结构化输出时保留上传错误，避免被 JSON 解析错误覆盖；新增隔离回归用例。未新增运行时依赖或自动回退机制。
