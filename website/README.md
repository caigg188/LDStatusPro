# LDSP 官网

LDStatusPro 插件与 LD 士多的双产品入口，生产地址 `https://ldspro.qzz.io/`。Cloudflare Pages 项目名 `ldstatus-pro`。

## 页面与内容

| 路径            | 内容                                                             |
| --------------- | ---------------------------------------------------------------- |
| `/`             | 双产品介绍、安装与访问入口、开源维护入口、简短的 Jacky 署名、FAQ |
| `/report/2025*` | 2025 年报，包括 OAuth 回调                                       |

首页顺序：Header → Hero → Features → Installation → Maintenance → FAQ → Footer。网站以 LDSP 及两款产品为中心；维护者介绍仅链接到 Jacky 的 GitHub 主页。

首页文案由组件维护；外部地址集中在 `src/config/links.ts`。顶部 Star 徽标读取 GitHub 的公开仓库 API，缓存十分钟；网络失败时仍保留可点击的 Star 入口。不调用生产业务 API。

插件版本由 `vite.config.ts` 读取仓库根目录 `LDStatusPro.user.js` 的 `@version`，构建时注入。发布新脚本后需要重新采集对应版本的插件图片，再构建官网；构建会校验源码、演示数据与图片来源哈希，防止旧截图标注为新版本。

## 真实产品展示

- 插件：`scripts/build-plugin-preview.mjs` 从当前用户脚本抽取原生面板模板、尺寸设置、样式和 Renderer，在无网络的 JSDOM / VM 中生成浅深主题的升级要求与阅读趋势 HTML。仅执行明确选取的展示方法，不启动 Panel、OAuth、阅读追踪或存储服务。
- 演示数据：`brand/plugin-demo.json` 提供模拟昵称、阅读时长、关注数量及升级进度。网站标注“演示数据”，这些数字不对应真实账号。头像也使用插件原有的字母头像生成方法。
- 官网只加载预先渲染的高清 WebP 面板图，不嵌入插件 iframe，不运行插件动画、滤镜或业务逻辑。保留浅深主题和升级要求 / 阅读趋势切换。面板采用插件支持的 380px 宽度、660px 高度上限和“仅未完成要求”设置；按网站展示要求移除完成度下方的等级徽标。
- 士多：`public/screenshots/store-{home,shops}.{jpg,webp}` 来自 2026-10-11 的匿名公开物品广场与小店集市 DOM，使用原始样式与资源、移除脚本后在固定 1280 × 800 桌面视口中以 CSS 2 倍缩放重新渲染，采集为 2560 × 1600 像素。页面内容没有改动；保留 JPEG 和质量 96 的 WebP，来源见 `public/screenshots/source.json`。统计、物品及价格是截图时的状态。

动效参考 [Pure Music](https://qingyueyin.github.io/Pure-music/) 的产品界面层次和浅深主题展示，以及 [Apple](https://www.apple.com/) 的滚动展开节奏；没有复制它们的代码或素材。实际动效由 Framer Motion 驱动，包括轻微首屏视差、段落进入和主题切换；截图保持平整，避免持续 3D 变换造成文字模糊，尊重 `prefers-reduced-motion`，不接管页面滚动。

年报仍由 `src/pages/AnnualReport2025.tsx` 处理，使用 `https://api.ldspro.qzz.io` 的认证和年报 API。首页改造没有修改这条链路；本地检查年报时不执行真实登录。

## 视觉与静态资源

- `src/brand.css`：首页布局与样式，作用域为 `.brand-site`；年报保留 `src/index.css` 的既有样式。
- `brand/identity.json`：颜色、标志几何与版本的源文件。
- `src/brand-tokens.css`：由设计源文件生成的色彩变量。
- `public/brand/`：母品牌、插件沙漏、士多钻石、Jacky 标志的彩色、单色和反白 SVG；分享图、图标与视觉规范图。
- `public/brand/fonts/`：本地 WOFF2 字体子集及 OFL 许可文件。首页无需请求 Google Fonts。

SVG 不依赖远程字体，分享图和规范图文字已经转为路径。资源再生成方式见 [brand/README.md](./brand/README.md)。

首页适配手机与桌面，提供跳过导航链接、键盘焦点、Escape 关闭手机导航、原生 FAQ 折叠和减少动态效果支持。既有 `#features`、`#levels`、`#updates` 链接保留落点。

## 开发与验证

使用 React 19、TypeScript 5.9、Vite 7、Tailwind CSS 4、Framer Motion 和 Lucide React；路由在 `App.tsx` 中根据 pathname 判断。

```bash
npm install
npm run dev -- --host 127.0.0.1
npm run lint
npm run build
npm run preview -- --host 127.0.0.1
```

构建先生成插件预览，再运行 `tsc -b` 和 Vite，生成 `dist/`。`public/_headers` 和 `_redirects` 随构建复制。`npm run preview:plugin` 生成原生展示 HTML 并校验图片来源。要准备新截图，先运行 `npm run preview:plugin -- --prepare`，用浏览器在 1440 × 900 的内层桌面 iframe 中渲染四个 HTML，按 CSS 2 倍缩放采集并裁切到面板边界，保存 WebP 后更新 `public/product-preview/capture.json`。HTML 内禁止脚本与网络请求，仅供采集；首页不引用它们。当前升级要求图片为 760 × 1186，趋势图片为 760 × 1211。

统计 SDK 仅在 `ldspro.qzz.io` 加载，localhost 和 Pages 预览域名不会发送统计数据。不要在本地验收过程中连接生产账号或执行订单、支付等业务操作。

## 发布

```bash
npm run deploy
```

该命令构建后执行 `wrangler pages deploy dist --project-name=ldstatus-pro`。推送 `main` 只触发 GitHub Actions 检查，实际上线需在本机执行发布命令，见 [CI.md](../CI.md)。本地检查通过不代表已经发布。
