# LD 士多品牌标识

项目现行标准见 [design/STORE_BRAND.md](../../design/STORE_BRAND.md)，其中保留最终确认依据、商城专属资产、平板侧栏与配色边界。本文件是商城实现侧的简要生成说明。

沿用官网品牌资源 v0.2 的开环与双切面钻石，商城主体采用明亮金 `#E5A11B`，延续旧版金色的明亮感。
几何源文件为 `../../website/brand/identity.json`，颜色源文件为 `../scripts/build-brand-assets.cjs` 中的 `storeColors`。
此配色调整仅用于商城标识，官网现有产品按钮和文字配色独立维护。
早期 `docs/brand/2026-10-11` 资源包中的小店图形属于 v0.1 提案，勿用于替换。

`StoreLogo.vue` 统一用于商城页头、登录页、帮助中心和卖家工作台。
浅色页面使用色版，深色页面使用反白版；卖家侧栏固定深底，始终反白。
标识旁有相同文字时传入 `decorative`，避免屏幕阅读器重复朗读。
不拉伸图形，不添加阴影或渐变。页面标识至少展示 24 px。

浏览器图标使用透明底 SVG 和含 16/32/48 px 图像的 ICO。
SVG 根据浏览器系统主题切换主体明亮金与浅金 `#F3BE49`，HTML 的版本参数用于刷新缓存。
Apple 收藏图标使用 180 × 180 的不透明 PNG，底色为 `#FFF8E5`，由系统裁切圆角。

普通构建直接使用已提交的静态资源，不需要设计工具。
更新官网品牌源文件后，在 `ld-store` 目录用独立工具环境中的 Sharp 重新导出：

```bash
NODE_PATH=/absolute/path/to/node_modules node scripts/build-brand-assets.cjs
```

生成脚本仅读品牌 JSON/SVG、写本地静态资源，不加载应用环境变量。
