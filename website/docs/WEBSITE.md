# LDStatus Pro 官网技术文档

> 官网 (`website/`) 是基于 React 19 + TypeScript 构建的单页展示网站，用于介绍 LDStatus Pro 功能、提供安装指南，**内容通过后端 API 动态管理**。

## 📋 概述

| 项目 | 说明 |
|:--|:--|
| 框架 | React 19 |
| 语言 | TypeScript 5.9 |
| 构建工具 | Vite 7 |
| 样式 | Tailwind CSS 4.1 |
| 动画 | Framer Motion |
| 图标 | Lucide React |
| 部署 | Cloudflare Pages / Vercel |

---

## 🏗️ 项目结构

```
website/
├── src/
│   ├── App.tsx                # 根组件（路由 + 页面布局）
│   ├── main.tsx               # 应用入口
│   ├── index.css              # 全局样式 / Tailwind 导入
│   ├── assets/                # 静态资源
│   ├── hooks/                 # 自定义 Hooks
│   │   └── useSiteData.ts     # API 数据获取 (站点设置/更新日志/FAQ)
│   ├── pages/                 # 页面组件
│   │   └── AnnualReport2025.tsx  # 2025 年度阅读报告页面
│   └── components/            # 组件
│       ├── Header.tsx         # 顶部导航栏
│       ├── Hero.tsx           # 首页主视觉区
│       ├── Features.tsx       # 功能特点展示
│       ├── Installation.tsx   # 安装指南
│       ├── Levels.tsx         # 阅读等级说明
│       ├── PanelPreview.tsx   # 面板预览（CSS 复刻）
│       ├── UpdateLog.tsx      # 更新日志（动态数据）
│       ├── FAQ.tsx            # 常见问题（动态数据）
│       ├── Footer.tsx         # 页脚
│       └── Logo.tsx           # Logo 组件
├── public/
│   ├── _headers               # HTTP 头配置
│   └── _redirects             # SPA 重定向规则
├── index.html                 # HTML 模板
├── vite.config.ts             # Vite 配置
├── tsconfig.json              # TypeScript 配置
├── tsconfig.app.json          # 应用 TS 配置
├── tsconfig.node.json         # Node TS 配置
├── eslint.config.js           # ESLint 配置
├── tailwind.config.js         # Tailwind CSS 配置
└── package.json
```

---

## 🌐 动态数据集成

官网内容通过后端 API 动态获取，在管理面板的「官网管理」页面可以编辑。

### 数据来源

| 数据 | API 端点 | 管理入口 |
|:--|:--|:--|
| 站点设置 | `/api/site/settings` | 管理面板 → 官网管理 → 站点设置 |
| 更新日志 | `/api/site/update-logs` | 管理面板 → 官网管理 → 更新日志 |
| 常见问题 | `/api/site/faqs` | 管理面板 → 官网管理 → 常见问题 |

### useSiteData Hook

```typescript
// hooks/useSiteData.ts
const API_BASE = 'https://api.ldspro.qzz.io'

// 缓存配置
const CACHE_TTL = 5 * 60 * 1000  // 5 分钟

// 站点设置
export interface SiteSettings {
  plugin_version: string       // 插件版本号
  hero_badge_text: string      // 首页徽章文字
  install_button_text: string  // 安装按钮文字
}

// 更新日志
export interface UpdateLog {
  id: number
  version: string
  date: string
  badge: string           // 徽章文字 (如 "最新", "重大更新")
  badge_color: string     // 徽章渐变色 CSS 类
  title: string           // 更新标题
  highlights: string[]    // 更新要点列表
  sort_order: number
}

// FAQ
export interface FAQ {
  id: number
  question: string
  answer: string
  icon: string       // 图标名称 (Shield, Trophy, Cloud...)
  icon_color: string // 图标颜色 Tailwind 类
  sort_order: number
}

// Hook 导出
export function useSiteSettings()  // 返回 { data, loading, error }
export function useUpdateLogs()    // 返回 { data, loading, error }
export function useFaqs()          // 返回 { data, loading, error }
```

### 缓存机制

- 使用 `localStorage` 缓存 API 响应
- 缓存有效期 5 分钟
- 缓存失效后自动重新请求
- 内置默认数据作为 API 失败时的回退

---

## 🧱 核心组件

### App.tsx (路由 + 页面结构)

```tsx
function HomePage() {
  return (
    <div className="min-h-screen bg-[#0c0c14]">
      <Header />
      <main>
        <Hero />
        <Features />
        <Levels />
        <Installation />
        <UpdateLog />   {/* 动态数据 */}
        <FAQ />         {/* 动态数据 */}
      </main>
      <Footer />
    </div>
  )
}

function App() {
  const path = window.location.pathname
  
  // 简单路由
  if (path === '/report/2025') {
    return <AnnualReport2025 />
  }
  
  return <HomePage />
}
```

### AnnualReport2025.tsx (年度报告页面)

独立的 2025 年度阅读报告页面，功能包括：
- OAuth 登录（支持 linux.do 和 idcflare.com）
- 阅读数据可视化（总时长、排名、月度趋势）
- 成就徽章展示
- 分享功能

### Hero.tsx (首页主视觉)

从 API 获取动态文本：
- `settings.hero_badge_text` - 徽章文字
- `settings.install_button_text` - 安装按钮文字

**特性**:
- 极光背景效果 (CSS)
- 动态光斑动画 (Framer Motion + GPU 加速)
- 面板预览交互展示
- 响应式布局

### UpdateLog.tsx (更新日志)

从 `/api/site/update-logs` 获取数据，展示：
- 时间线样式布局
- 版本号、日期、徽章
- 可展开的更新要点
- 桌面端左右交错排列

### FAQ.tsx (常见问题)

从 `/api/site/faqs` 获取数据，展示：
- 手风琴式展开/收起
- 自定义图标和颜色
- 流畅的展开动画

---

## 🎨 设计系统

### 配色方案 (暗色主题)

| 用途 | 颜色值 |
|:--|:--|
| 主背景 | `#0c0c14` |
| 卡片背景 | `rgba(26, 26, 36, 0.6)` |
| 主色 | `#3b82f6` (蓝) |
| 强调色1 | `#8b5cf6` (紫) |
| 强调色2 | `#ec4899` (粉) |
| 强调色3 | `#10b981` (绿) |
| 文字主色 | `#ffffff` |
| 文字次色 | `#9ca3af` |

### 字体

- **英文**: Inter
- **中文**: Noto Sans SC (系统回退)

### 毛玻璃效果

```css
.glass {
  background: rgba(26, 26, 36, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glass-hover:hover {
  background: rgba(26, 26, 36, 0.8);
  border-color: rgba(255, 255, 255, 0.15);
}
```

### 渐变文字动画

```css
.gradient-text-animated {
  background: linear-gradient(
    135deg,
    #3b82f6 0%,    /* 蓝 */
    #8b5cf6 25%,   /* 紫 */
    #ec4899 50%,   /* 粉 */
    #10b981 75%,   /* 绿 */
    #3b82f6 100%   /* 回到蓝 */
  );
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradient-flow 8s ease infinite;
}
```

### 极光背景

```css
.bg-aurora {
  background: radial-gradient(
    ellipse at 50% 0%,
    rgba(59, 130, 246, 0.15) 0%,
    transparent 50%
  ),
  radial-gradient(
    ellipse at 80% 20%,
    rgba(139, 92, 246, 0.1) 0%,
    transparent 40%
  ),
  linear-gradient(180deg, #0c0c14 0%, #0f0f1a 100%);
}
```

---

## 🎬 动画系统

### Framer Motion 常用模式

```tsx
// 淡入上移
<motion.div
  initial={{ opacity: 0, y: 30 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6 }}
/>

// 滚动触发 (只触发一次)
<motion.div
  initial={{ opacity: 0, y: 30 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-100px" }}
/>

// 交错动画
{items.map((item, index) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
  />
))}

// 循环动画 (装饰元素)
<motion.div
  animate={{ y: [0, -8, 0] }}
  transition={{ 
    duration: 3, 
    repeat: Infinity, 
    ease: "easeInOut" 
  }}
  className="will-change-transform"  // GPU 加速
/>

// 悬停缩放
<motion.button
  whileHover={{ scale: 1.02, y: -2 }}
  whileTap={{ scale: 0.98 }}
/>
```

### 性能优化

- 使用 `will-change-transform` 启用 GPU 加速
- 大量动画元素使用 CSS 动画替代
- 滚动触发使用 `viewport={{ once: true }}` 只触发一次

---

## 📱 响应式设计

### Tailwind 断点

| 断点 | 最小宽度 | 典型设备 |
|:--|:--|:--|
| (默认) | 0px | 手机 |
| `sm:` | 640px | 大手机 |
| `md:` | 768px | 平板 |
| `lg:` | 1024px | 笔记本 |
| `xl:` | 1280px | 桌面 |
| `2xl:` | 1536px | 大桌面 |

### 响应式示例

```tsx
<div className="
  px-4 sm:px-6 lg:px-8           /* 内边距递增 */
  text-4xl sm:text-5xl lg:text-6xl /* 字体递增 */
  grid-cols-1 md:grid-cols-2 lg:grid-cols-4  /* 网格列数 */
  hidden md:flex                  /* 移动端隐藏 */
">
```

---

## 🚀 部署

### 本地开发

```bash
npm install
npm run dev          # http://localhost:5173
```

### 构建

```bash
npm run build        # 输出到 dist/
npm run preview      # 本地预览构建结果
```

### 部署到 Cloudflare Pages

```bash
npm run deploy
# 或手动:
npx wrangler pages deploy dist --project-name=ldstatus-pro
```

### 部署到 Vercel

```bash
vercel --prod
```

### 静态文件配置

```
# public/_redirects (SPA 路由支持)
/*    /index.html   200

# public/_headers (缓存策略)
/*
  Cache-Control: public, max-age=31536000
/index.html
  Cache-Control: no-cache
```

---

## 🔒 SEO 优化

### HTML Meta 标签

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LDStatus Pro - Linux.do 状态增强插件</title>
  <meta name="description" content="LDStatus Pro 是一款功能强大的 Linux.do 状态面板增强插件，提供阅读统计、云同步、排行榜等功能。" />
  <meta name="keywords" content="linux.do, 状态, 插件, 油猴脚本, tampermonkey" />
  
  <!-- Open Graph -->
  <meta property="og:title" content="LDStatus Pro" />
  <meta property="og:description" content="Linux.do 状态增强插件" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="/og-image.png" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
</head>
```

---

## 📊 性能优化

### 代码层面

1. **代码分割**: Vite 自动按路由分割
2. **动态导入**: 大型组件懒加载
3. **图片优化**: 使用 WebP 格式、响应式图片
4. **字体优化**: `font-display: swap`

### 网络层面

1. **缓存策略**: 静态资源长期缓存，HTML 不缓存
2. **API 缓存**: localStorage 缓存 5 分钟
3. **预加载**: 关键资源使用 `<link rel="preload">`

### 动画性能

1. **GPU 加速**: `will-change-transform`, `transform: translateZ(0)`
2. **减少重绘**: 使用 `transform`/`opacity` 而非 `top`/`left`
3. **滚动优化**: `viewport={{ once: true }}` 只触发一次

---

## 🔧 开发指南

### 添加新页面区块

1. 创建组件 `src/components/NewSection.tsx`
2. 在 `App.tsx` 中导入并放置位置
3. 添加锚点 ID 用于导航跳转

### 修改动态内容

官网展示的以下内容可通过管理面板「官网管理」页面修改：

- **站点设置**: 插件版本号、徽章文字、按钮文字
- **更新日志**: 版本号、日期、标题、要点、徽章样式
- **常见问题**: 问答内容、图标、颜色

修改后无需重新部署官网，刷新页面即可看到更新（受 5 分钟缓存影响）。

### 修改静态内容

以下内容需要修改代码并重新部署：

- 功能特点 (`Features.tsx`)
- 安装指南 (`Installation.tsx`)
- 阅读等级 (`Levels.tsx`)
- 面板预览 (`PanelPreview.tsx`)
- 导航/页脚

---

## 📦 依赖说明

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "framer-motion": "^12.x",
    "lucide-react": "^0.4xx"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.x",
    "@tailwindcss/vite": "^4.x",
    "tailwindcss": "^4.x",
    "typescript": "~5.9.x",
    "vite": "^7.x"
  }
}
```
