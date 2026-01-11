# LDStatus Pro 官网

> LDStatus Pro 项目的官方网站，展示功能特性和使用教程。**内容通过后端 API 动态管理。**

## ✨ 特性

- 🌐 **动态内容**: 版本号、更新日志、FAQ 通过 API 获取，管理面板可编辑
- 🎨 **暗色主题**: 极光背景 + 毛玻璃效果
- 🎬 **流畅动画**: Framer Motion 驱动的交互动画
- 📱 **响应式设计**: 适配手机到桌面
- ⚡ **高性能**: Vite 构建 + 缓存优化

---

## 🛠️ 技术栈

- **框架**: React 19 + TypeScript
- **构建工具**: Vite 7
- **样式**: Tailwind CSS 4
- **动画**: Framer Motion
- **图标**: Lucide React
- **部署**: Cloudflare Pages

---

## 🚀 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

---

## 📦 部署

### Cloudflare Pages (推荐)

```bash
npm run deploy
```

### 手动部署

```bash
npm run build
npx wrangler pages deploy dist --project-name=ldstatus-pro
```

### Vercel

```bash
vercel --prod
```

---

## 📁 项目结构

```
website/
├── src/
│   ├── App.tsx                # 根组件
│   ├── main.tsx               # 入口文件
│   ├── index.css              # 全局样式 + Tailwind
│   ├── hooks/
│   │   └── useSiteData.ts     # API 数据获取 Hook
│   └── components/
│       ├── Header.tsx         # 导航栏
│       ├── Hero.tsx           # 首屏区域 (动态徽章/按钮文字)
│       ├── Features.tsx       # 功能特点
│       ├── Levels.tsx         # 阅读等级
│       ├── Installation.tsx   # 安装教程
│       ├── PanelPreview.tsx   # 面板预览（CSS复刻）
│       ├── UpdateLog.tsx      # 更新日志 (动态数据)
│       ├── FAQ.tsx            # 常见问题 (动态数据)
│       ├── Footer.tsx         # 页脚
│       └── Logo.tsx           # Logo
├── public/
│   ├── _headers               # Cloudflare 响应头
│   └── _redirects             # SPA 路由重定向
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── package.json
```

---

## 🌐 动态内容管理

以下内容通过后端 API 获取，可在管理面板「官网管理」页面编辑：

| 内容 | API | 刷新时间 |
|:--|:--|:--|
| 站点设置 (版本号、徽章、按钮) | `/api/site/settings` | 5 分钟 |
| 更新日志 | `/api/site/update-logs` | 5 分钟 |
| 常见问题 | `/api/site/faqs` | 5 分钟 |

> 修改后刷新页面即可看到更新（受 5 分钟本地缓存影响）

### 缓存机制

- 使用 `localStorage` 缓存 API 响应
- 缓存有效期 5 分钟
- 内置默认数据作为 API 失败时的回退

---

## 🎨 设计规范

### 配色

| 用途 | 颜色 |
|:--|:--|
| 主背景 | `#0c0c14` |
| 卡片背景 | `rgba(26, 26, 36, 0.6)` |
| 主色 | `#3b82f6` (蓝) |
| 强调色1 | `#8b5cf6` (紫) |
| 强调色2 | `#ec4899` (粉) |
| 强调色3 | `#10b981` (绿) |

### 字体

- **英文**: Inter
- **中文**: Noto Sans SC / 系统字体

### 特效

- **毛玻璃**: `backdrop-filter: blur(12px)`
- **渐变文字**: 4 色渐变流动动画
- **极光背景**: 多层径向渐变叠加

---

## 📖 详细文档

完整技术文档请参考: [docs/technicaDocs/WEBSITE.md](../docs/technicaDocs/WEBSITE.md)

---

## 🔗 线上地址

- **主域名**: https://ldstatus-pro.pages.dev

---

## 📄 License

MIT
