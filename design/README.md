# LDSP 品牌与设计规范

**状态：现行规范 · v1.0 · 2026-10-11（Asia/Shanghai）**

本目录是 LDSP 项目的品牌、运营表达和界面设计依据。基线为 Jacky 已确认并发布的官网提交 `9842b08c1d6458c72d0a98021d1d36450043c2a9`，标志几何版本为 v0.2。后续官网、插件、LD 士多、帮助中心、卖家端、公开文档和传播素材都以这里的现行规则为准；各产品功能和业务信息保持自己的结构。

## 从这里开始

| 文件 | 用途 |
| --- | --- |
| [品牌与运营方案](BRAND_STRATEGY.md) | 名称、定位、双产品入口、Jacky 个人 IP、渠道、内容节奏、90 天计划与指标口径 |
| [设计语言](DESIGN_LANGUAGE.md) | 颜色、字体、布局、组件、文案、桌面／平板／手机适配 |
| [Logo 与静态资源规范](LOGO_GUIDELINES.md) | 沙漏、钻石、开放圆环、透明 favicon、分享图、字体许可与资源用法 |
| [动效与产品展示规范](MOTION_AND_MEDIA.md) | 组件反馈、滚动编排、减少动态效果、真实界面与高清截图 |
| [维护与验收](GOVERNANCE.md) | 规则优先级、资源同步、变更步骤和交付检查 |
| [变更记录](CHANGELOG.md) | 已确认的品牌与设计决策 |
| [现行资源清单](manifest.json) | 可检查的来源路径、SHA-256 与派生文件列表 |
| [规范版本元数据](standard.json) | 现行版本、日期、状态与已确认官网基线 |

## 目录与版本边界

```text
design/
  README.md                    现行规范入口
  BRAND_STRATEGY.md             品牌与运营方案
  DESIGN_LANGUAGE.md            视觉、交互与终端适配
  LOGO_GUIDELINES.md            标志与资产用法
  MOTION_AND_MEDIA.md           动效和真实产品展示
  GOVERNANCE.md                 更新与验收规则
  CHANGELOG.md                  决策记录
  system/                      当前机器可读设计源的同步镜像
  assets/brand/                当前标志、分享图、规范图、字体与许可
  assets/icons/                当前透明 SVG / ICO
  assets/product/              当前插件面板和士多高清截图及来源
  examples/                    已发布官网与透明图标的参考图
  scripts/sync-assets.mjs       资源同步与一致性检查
  archive/2026-10-11-v0.1/      原始品牌运营提案及完整离线资源
```

`archive/` 仅用于追溯。其中的状态刻度／表格内核、商店内核、旧配色、旧首屏文案和较重的个人展示结构已被后续确认替代，不能作为新设计的起点。原提案里的公开计数、核验范围和实施状态只代表其采集时刻。

规范文本在 `design/` 维护。当前颜色和几何的唯一编辑源仍是 [website/brand/identity.json](../website/brand/identity.json)，官网布局与动效分别在 [brand.css](../website/src/brand.css) 和 [useHomepageMotion.ts](../website/src/hooks/useHomepageMotion.ts) 实现；`system/` 与 `assets/` 是同步产物，避免在两处分别修改同一份资源。

在仓库根目录执行：

```bash
node design/scripts/sync-assets.mjs          # 已确认设计更新后同步归档
node design/scripts/sync-assets.mjs --check  # 检查归档与实现资源是否一致
```

同步不会发布网站、加载应用环境变量或连接生产业务服务。它也不自动把设计提案变成已确认的标准；新决策需按 [维护规则](GOVERNANCE.md) 记录。

![当前 Logo、颜色与反白规范](assets/brand/identity-sheet.png)

![透明 favicon 的浅深背景与小尺寸参考](examples/favicon-transparency-preview.png)

![已发布官网参考，2026-10-11](examples/homepage-2026-10-11.jpg)
