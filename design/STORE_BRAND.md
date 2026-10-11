# LD 士多品牌标识规范

**现行方案：明亮金钻石 · 2026-10-11 · 规范包 v1.1。**

依据 Jacky 在[更换网页端 LD 士多 LOGO](codex://threads/01a12b52-6a43-75d3-beb0-32ce44460590)中的最终确认：中心是有设计感的极简钻石，保留新版几何；主体金色应接近原商城的明亮金橙，而不是较暗的矿金。实现基线为商城提交 `59d13d1fdf44a38646f1b3d031a5c615e3298485`。这里规范的是产品标识、标签页图标和收藏图标，不把 Logo 换色扩展为整个交易界面换肤。

![最新标识与图标规范](examples/store-brand-2026-10-11.png)

## 形状与配色

标志是开放圆环与两片极简切面组成的钻石。与 LDSP、LDStatusPro 共享 v0.2 几何家族；不使用商店门洞、购物袋、具象金币或旧表格内核。

| 用途 | 颜色 | 规则 |
| --- | --- | --- |
| 浅色页面／普通传播素材 | 明亮金 `#E5A11B` | 当前士多主体识别色；整枚标志同色 |
| 深色页面／固定深底 | 白 `#FFFFFF` | 使用反白资源，不能把页面深色版误设为浅金 |
| SVG favicon 的深色标签栏 | 浅金 `#F3BE49` | 随浏览器系统主题切换；与页面深色主题分开 |
| Apple 收藏图标底色 | 浅暖色 `#FFF8E5` | 不透明方形 PNG，中心为明亮金标志 |

母版 64 × 64，页面圆环线宽 5.5；favicon 圆环线宽 6，保留相同钻石。中心路径是 `M25 22H39L44 28H20Z` 与 `M20 31H44L32 44Z`，开放圆环路径为 `M32 8A24 24 0 1 1 15.03 48.97`。保持原有开口、切面间隙、1:1 比例和至少 1/8 图标宽度的安全留白。

页面标志至少 24px。不拉伸、旋转、增加阴影、光晕、渐变或立体细节。明亮金用于标识，不直接拿来替换正文颜色、白字按钮背景、订单状态或支付提示；这些内容仍按现有语义变量与对比度要求维护。

## 页面组件与终端适配

商城统一使用 [StoreLogo.vue](../ld-store/src/components/common/StoreLogo.vue)，不在各页面复制几何路径或另造颜色。

| 场景 | 已确认实现与规则 |
| --- | --- |
| 商城页头 | 32px 标志与产品名称相邻，浅色用金色，`html.dark` 下用白色 |
| 登录页 | 使用同一组件，尺寸由登录布局控制，仍保留钻石与开放圆环 |
| 帮助中心 | 品牌入口使用同一组件，随页面浅深主题切换；移动工具栏允许文字入口 |
| 卖家工作台 | 深色侧栏使用 `inverted`，固定反白；侧栏容器装饰不属于 Logo 母版 |
| 卖家平板侧栏 | 768–1023px 收窄侧栏时仅隐藏品牌文字，保留可见、可点击的钻石标志 |
| 手机 | 随各产品导航布局适配，不为塞入空间压扁标志或隐藏唯一产品入口 |

标志旁已有产品文字时传入 `decorative`，避免屏幕阅读器重复朗读；独立展示保留「LD 士多」可访问名称，独立链接还需明确目的地。页面深色主题由应用控制，标签栏颜色由浏览器系统主题控制，两者可能不同。

以上是来源提交的实现记录，不表示每次规范更新都重新完成了所有浏览器或视口验收。后续界面修改仍按 [设计语言](DESIGN_LANGUAGE.md) 和 [维护规则](GOVERNANCE.md) 检查。

## 可直接使用的静态资源

| 资源 | 要求与运行时来源 |
| --- | --- |
| [明亮金 SVG](assets/store/brand/store-mark.svg) | 64 × 64，透明底；`ld-store/public/brand/store-mark.svg` |
| [反白 SVG](assets/store/brand/store-mark-white.svg) | 64 × 64，透明底；`ld-store/public/brand/store-mark-white.svg` |
| [SVG favicon](assets/store/icons/favicon.svg) | 透明底；浅色明亮金，深色标签栏浅金；`ld-store/public/favicon.svg` |
| [ICO favicon](assets/store/icons/favicon.ico) | 16／32／48px、alpha 透明通道；静态金色回退；`ld-store/public/favicon.ico` |
| [Apple Touch PNG](assets/store/brand/apple-touch-icon.png) | 180 × 180，不透明，系统裁切圆角；`ld-store/public/brand/apple-touch-icon.png` |

当前 HTML 图标缓存参数为 `store-v02-gold1`，见 [ld-store/index.html](../ld-store/index.html)。资源变化时同步更新版本参数；SVG、ICO 和 Apple Touch 必须一起核对。ICO 不随主题切换，Apple Touch 也不套用标签页透明要求。

新的士多公告、头像、教程或产品封面从本节的明亮金／反白 SVG 制作；代码许可与品牌身份表达遵循 [通用 Logo 规范](LOGO_GUIDELINES.md)。未按最新 Logo 重制的旧封面不自动成为新官方素材。

## 源文件与归档边界

共用几何来自 [website/brand/identity.json](../website/brand/identity.json)；士多标识的独立配色来自 [build-brand-assets.cjs](../ld-store/scripts/build-brand-assets.cjs) 中的 `storeColors`。完整导出逻辑镜像保存在 [store-asset-generator.cjs](system/store-asset-generator.cjs)，用于离线追溯，实际编辑仍在 `ld-store/scripts/`。

官网 `identity.json` 中的 `store: #916625`、`store-soft: #F6F0E3` 是官网既有产品按钮、文字和表面的配色。`assets/brand/identity-sheet.*`、`assets/brand/store-*` 与既有官网截图记录的是该官网基线，不能拿它们覆盖最新商城标识或用于新的士多专属传播素材。`archive/2026-10-11-v0.1/` 的商店内核更早，已失效。

仅更新品牌规范不自动修改或部署官网、商城主题、分享卡片与历史截图。新采集截图应使用当时真实的线上界面，记录日期与提交；不能给旧截图局部贴上新 Logo 后宣称重新采集。

已确认设计变更后，在有 Sharp 的独立工具环境中导出商城资源，再在仓库根目录同步规范：

```bash
# 在 ld-store 目录；不加载应用 .env
NODE_PATH=/absolute/path/to/node_modules node scripts/build-brand-assets.cjs

# 在仓库根目录
node design/scripts/sync-assets.mjs
node design/scripts/sync-assets.mjs --check
NODE_PATH=/absolute/path/to/node_modules node design/scripts/render-store-proof.cjs
```

导出与归档仅读写本地文件。更新配色时一并维护本文件、`standard.json`、规范图与 `CHANGELOG.md`；发布仍是独立流程。
