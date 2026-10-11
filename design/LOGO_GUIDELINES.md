# Logo 与静态资源规范

当前标志共用几何为 v0.2；LD 士多采用后续确认的明亮金配色，详见 [士多专属规范](STORE_BRAND.md) 和 [最新规范图](examples/store-brand-2026-10-11.svg)。[官网规范图](assets/brand/identity-sheet.svg) 与 [identity 镜像](system/identity.json) 保留官网 `9842b08` 基线，其中士多矿金不能覆盖商城最新标识。

## 标志家族

| 标志 | 内核 | 颜色 | 主要使用场景 |
| --- | --- | --- | --- |
| LDSP | 圆角菱形，连接两个产品 | 松绿 `#32665C` | 官网、项目总览、通用公告 |
| LDStatusPro | 上下收束的抽象沙漏 | 靛蓝 `#4B5EA8` | 插件介绍、安装、文档与产品公告 |
| LD 士多 | 两片极简切面构成的钻石 | 明亮金 `#E5A11B`；深底白色 | 士多导航、登录、帮助、卖家端和新产品传播 |
| Jacky | 独立几何 J 与方点 | 深墨 `#233C3D` | 作者署名与独立个人身份 |

三个项目／产品标志共用开放圆环；Jacky 的 J 不套圆环。插件不使用表格、刻度内核，士多不恢复商店门洞图案，也不另造具象金币版本。

## 几何与使用

- 母版为 64 × 64，常规圆环线宽 5.5，开口方向和中心路径按源文件保留。
- 普通页面标志至少 24px，推荐 24–40px；安全留白至少为标志宽度的 1/8。
- 保持 1:1，不拉伸、不旋转、不加立体厚度、阴影、发光或渐变，不私自改变中心形状。
- 普通浅底使用彩色 SVG；深底使用 `*-white.svg`；单色场景使用 `*-mono.svg`。
- 标志旁有完整产品名时避免重复朗读，独立标志链接有明确可访问名称。
- 项目总览用 LDSP；单产品教程／公告用对应产品标志；作者内容用 Jacky，不用个人标志替代所有产品标识。

LDSP、插件与 Jacky 复用 [官网 SVG 目录](assets/brand/)；**士多新素材使用 [明亮金／反白 SVG 目录](assets/store/brand/)**。官网目录中的矿金士多资产保留为既有部署记录，不是商城标准。运行时尽量统一使用现有 Logo 组件，商城使用 `StoreLogo.vue`，避免把多份路径散落在页面中；本规范不要求为换品牌同时重做所有应用界面。

## 标签页与收藏图标

LDSP 标签页 favicon 是透明底的开放圆环与菱形，**没有白色或浅色底板**。它直接使用完整 64 × 64 几何、6px 圆环线宽，让 16px 下的轮廓更清楚。

| 文件 | 要求 |
| --- | --- |
| [favicon.svg](assets/icons/favicon.svg) | 透明底；浅色标签栏松绿，深色标签栏浅松绿 `#A7D9C8` |
| [favicon.ico](assets/icons/favicon.ico) | 16／32／48px 的 PNG 编码图像，保留 alpha 透明通道 |
| [Apple Touch PNG](assets/brand/apple-touch-icon.png) | 180 × 180 的不透明方形图标，由系统处理圆角；与标签页透明要求分开 |

HTML 先声明 ICO 的真实尺寸，再声明 `sizes="any"` 的 SVG；图标更新时同步修改链接版本参数，避免浏览器继续使用旧缓存。当前参数为 `v=2`，实际部署路径仍是 `/favicon.svg` 和 `/favicon.ico`。

新增产品 favicon 从对应标志源生成，遵循透明背景、简化小尺寸、深浅背景辨识和缓存版本规则；不能用 LDSP 母品牌 favicon 冒充单产品标志。导出后检查每个 ICO 尺寸的 alpha、16px 可辨细节、深浅底以及完整轮廓。

LD 士多现有产品 favicon 位于 [assets/store/icons/](assets/store/icons/)：SVG 浅色标签栏明亮金 `#E5A11B`、深色标签栏浅金 `#F3BE49`；页面的深色 Logo 则使用白色。其 [Apple Touch PNG](assets/store/brand/apple-touch-icon.png) 使用 `#FFF8E5` 不透明底，缓存参数为 `store-v02-gold1`。不要把 LDSP 的浅松绿、`v=2` 或透明收藏底板套给士多。

## 分享、截图与字体

[官网基线分享封面](assets/brand/og-default.png) 为 1200 × 630 PNG，SVG 编辑源同时保留，其中的矿金士多图形记录既有官网部署，不是最新士多专属封面模板；用实际部署的 PNG 地址提供 Open Graph / Twitter 预览，不把 SVG 当成所有平台通用分享格式。官网规范图和分享图的字形已转路径。

1200 × 630 用于通用分享，1080 × 1080 可以作为后续内容模板的制作尺寸。新封面使用现行标志与配色、简短标题、产品归属和作者署名。原始提案中的头像、字标、公告模板和封面全部在历史目录，尚未按当前内核重制，不能直接作为当前官方素材发布。

Manrope 和 Noto Sans SC 的本地字体子集与 OFL 许可保存在 [fonts](assets/brand/fonts/)。分发字体时保留许可与版权，不分发操作系统字体。中文文案新增字形后检查子集覆盖，缺字时按原生成流程更新并同步归档。

第三方文章与 fork 可说明来源、使用源码许可，但不要把衍生项目包装成 Jacky 维护的官方产品。代码许可与项目名称／标志的身份表达分别说明；本规范不声称做过商标确权，也不新增代码许可限制。

## 再生成和归档

普通应用构建使用已提交资产，不引入设计工具依赖。现有生成方式见 [website/brand/README.md](../website/brand/README.md)：Python 处理标志、字体与路径文字，Sharp 导出 PNG／ICO。仅更新 favicon 时可运行 `node website/scripts/render-brand-assets.cjs --favicon-only`，工具环境中需提供 Sharp。

士多标识使用独立的 [build-brand-assets.cjs](../ld-store/scripts/build-brand-assets.cjs)，共用官网几何、采用士多明亮金配色。导出步骤与专属图标要求见 [STORE_BRAND.md](STORE_BRAND.md)，不要通过重跑官网生成器把矿金产物复制回商城。

修改已确认的设计源、导出运行时资源后，再运行 `node design/scripts/sync-assets.mjs`。不要单独编辑 `design/assets/` 或 `design/system/`；检查方式与版本规则见 [GOVERNANCE.md](GOVERNANCE.md)。
