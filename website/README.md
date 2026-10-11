# LDSP by Jacky 官网

LDStatusPro 插件与 LD 士多的双产品入口，生产地址 `https://ldspro.qzz.io/`。Cloudflare Pages 项目名 `ldstatus-pro`。

## 页面与内容

| 路径            | 内容                                                      |
| --------------- | --------------------------------------------------------- |
| `/`             | 双产品介绍、安装与访问入口、Jacky 介绍、开源维护入口、FAQ |
| `/report/2025*` | 2025 年报，包括 OAuth 回调                                |

首页顺序：Header → Hero → Features → Installation → AboutJacky → Maintenance → FAQ → Footer。

首页文案由组件维护；外部地址集中在 `src/config/links.ts`。不调用 CMS、GitHub 统计或生产业务 API。功能示意图的阅读数字明确标注为示例数据。

插件版本由 `vite.config.ts` 读取仓库根目录 `LDStatusPro.user.js` 的 `@version`，构建时注入。发布新脚本后重新构建官网即可同步展示，不再维护独立版本常量。

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

使用 React 19、TypeScript 5.9、Vite 7、Tailwind CSS 4 和 Lucide React。年度报告保留 Framer Motion；路由在 `App.tsx` 中根据 pathname 判断。

```bash
npm install
npm run dev -- --host 127.0.0.1
npm run lint
npm run build
npm run preview -- --host 127.0.0.1
```

构建先运行 `tsc -b`，再生成 `dist/`。`public/_headers` 和 `_redirects` 随构建复制。

统计 SDK 仅在 `ldspro.qzz.io` 加载，localhost 和 Pages 预览域名不会发送统计数据。不要在本地验收过程中连接生产账号或执行订单、支付等业务操作。

## 发布

```bash
npm run deploy
```

该命令构建后执行 `wrangler pages deploy dist --project-name=ldstatus-pro`。推送 `main` 只触发 GitHub Actions 检查，实际上线需在本机执行发布命令，见 [CI.md](../CI.md)。本地检查通过不代表已经发布。
