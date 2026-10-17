# LDSP 项目约定

## 分支命名与生命周期

- `main` 是稳定分支。新工作从最新 `origin/main` 创建短期任务分支，通过 PR 和 `CI gate` 后合并；一个分支对应一个明确目标，不混入无关修改。
- 本地与远程使用同一个分支名，格式为 `<类型>/<简短描述>`。描述使用小写英文和连字符，例如 `feat/seller-progress`、`fix/login-redirect`。
- 类型按实际用途选择：`feat/` 新功能、`fix/` 缺陷修复、`refactor/` 重构、`perf/` 性能优化、`docs/` 文档、`test/` 测试、`ci/` 流水线、`chore/` 其他维护。不额外建立长期 `develop` 分支。
- 分支名不得包含 Codex、Claude、ChatGPT、agent 等 AI 工具或执行者署名；名称描述工作本身。
- 仓库开启 PR 合并后自动删除远程任务分支。未合并分支和 `main` 不在此清理范围；无需为每次提交创建新分支。
- 合并后切回 `main` 并快进同步，使用 `git fetch --prune` 清理失效的远程跟踪引用。确认本地任务分支已交付且没有独有工作后再删除；普通删除被拒绝时先检查是否 squash/rebase 合并，不自动用 `-D` 强制删除。
- 创建本地任务分支不等于获得提交、推送、合并或部署授权，仍按当前任务的授权范围执行。

## 品牌、界面与运营规范

涉及品牌名称、Logo、静态资源、官网、插件或士多界面、动效、产品截图及对外运营文案时，先阅读 [design/README.md](design/README.md)，再按任务阅读对应现行规范。后续工作以 `design/` 的已确认标准为准，Jacky 当前明确要求优先。

- 项目品牌为 LDSP；产品展示名为 LDStatusPro 插件、LD 士多；Jacky 为维护者和独立个人身份。
- 当前标志是抽象沙漏与双切面钻石，favicon 为透明底。`design/archive/` 只作历史参考，不恢复旧表格、商店内核或旧配色。
- 官网以双产品介绍为中心，Jacky 只作简短署名与 GitHub 回链。真实界面、模拟数据、截图日期与来源要明确。
- 共用标志几何与官网配色源为 `website/brand/identity.json`；LD 士多标识采用明亮金 `#E5A11B`，配色源为 `ld-store/scripts/build-brand-assets.cjs` 的 `storeColors`，使用规则见 [design/STORE_BRAND.md](design/STORE_BRAND.md)。不要用官网矿金色或旧商店图案覆盖商城标识。
- `design/system/` 与 `design/assets/` 是按产品来源维护的同步镜像，勿分别编辑；官网按钮、文字及商城业务主题不随标识换色自动变更。
- 设计决策变化时同步更新相关规范和 `design/CHANGELOG.md`，生成资源后运行 `node design/scripts/sync-assets.mjs` 与 `--check`。
- 保留各产品业务结构、可访问性和减少动态效果支持；官网不加载真实插件业务运行时。

这些要求补充工作区协议，不替代生产安全、发布授权或文件范围约束。
