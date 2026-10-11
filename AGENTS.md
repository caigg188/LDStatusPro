# LDSP 项目约定

## 品牌、界面与运营规范

涉及品牌名称、Logo、静态资源、官网、插件或士多界面、动效、产品截图及对外运营文案时，先阅读 [design/README.md](design/README.md)，再按任务阅读对应现行规范。后续工作以 `design/` 的已确认标准为准，Jacky 当前明确要求优先。

- 项目品牌为 LDSP；产品展示名为 LDStatusPro 插件、LD 士多；Jacky 为维护者和独立个人身份。
- 当前标志是抽象沙漏与双切面钻石，favicon 为透明底。`design/archive/` 只作历史参考，不恢复旧表格、商店内核或旧配色。
- 官网以双产品介绍为中心，Jacky 只作简短署名与 GitHub 回链。真实界面、模拟数据、截图日期与来源要明确。
- 颜色与几何的唯一编辑源为 `website/brand/identity.json`；`design/system/` 与 `design/assets/` 是同步镜像，勿分别编辑。
- 设计决策变化时同步更新相关规范和 `design/CHANGELOG.md`，生成资源后运行 `node design/scripts/sync-assets.mjs` 与 `--check`。
- 保留各产品业务结构、可访问性和减少动态效果支持；官网不加载真实插件业务运行时。

这些要求补充工作区协议，不替代生产安全、发布授权或文件范围约束。
