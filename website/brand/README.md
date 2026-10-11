# 品牌资源 v0.2

官网使用 `LDSP` 作为项目品牌，两个产品保留 `LDStatusPro` 和 `LD 士多` 名称。Jacky 作为维护者署名并链接到 GitHub 主页，不设置个人作品展示区。

| 标志        | 内核                             | 颜色           |
| ----------- | -------------------------------- | -------------- |
| LDSP        | 圆角菱形，连接两个产品           | `#32665C` 松绿 |
| LDStatusPro | 上下收束的抽象沙漏，阅读与成长   | `#4B5EA8` 靛蓝 |
| LD 士多     | 两片简洁切面组成钻石，发现与兑换 | `#916625` 矿金 |
| Jacky       | J 与一个方点，开发者签名         | `#233C3D` 深墨 |

产品标志共用开放圆环，采用 64 × 64 画布。最小建议展示尺寸 24 px；四周至少保留 8/64 图标宽度的空白。不拉伸、不增加细节、不使用阴影或多色渐变重绘 Logo。深底使用 `*-white.svg`，普通单色使用 `*-mono.svg`。

`identity.json` 是颜色和几何路径的源文件。修改源文件后重新生成资源，避免 SVG 与 CSS 变量分开修改。

## 再生成

正常 `npm run build` 直接使用已提交的资源，不需要设计工具或原始字体。仅编辑视觉资源时需要以下可选依赖：

- Python：`fonttools[woff]`
- Node.js：`sharp`
- Google Fonts 的 Manrope 和 Noto Sans SC 原始可变 TTF，来源分别为 [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope) 和 [Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc)。

在 `website` 目录运行：

```bash
python scripts/build-brand-assets.py /absolute/path/Manrope.ttf /absolute/path/NotoSansSC.ttf
node scripts/render-brand-assets.cjs
```

第一步生成 SVG、色彩变量和本地字体子集，第二步生成 PNG 与多尺寸 ICO。可通过 `PYTHONPATH`、`NODE_PATH` 指向独立工具环境，不必修改网站依赖。

字体子集覆盖当前 TSX 中的中文字符，正文增加新字时重新生成，未覆盖字符会使用系统字体。子集内部字体名已更改为 `LDSP Site Display` / `LDSP Site Sans`，许可原文保留在 `public/brand/fonts/*-OFL.txt`。

## 产物

- `public/brand/{ldsp,plugin,store,jacky}-mark.svg` 及 `-white`、`-mono` 版本。
- `public/brand/identity-sheet.{svg,png}`：标志、颜色、小尺寸与反白规范图。
- `public/brand/og-default.{svg,png}`：1200 × 630 社交分享图，文字转路径。
- `public/brand/apple-touch-icon.{svg,png}`：180 × 180 图标。
- `public/favicon.svg` 与 `public/favicon.ico`：ICO 包含 16、32、48 px 图像。
- `src/brand-tokens.css`：首页色彩变量。
