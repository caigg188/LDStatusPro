# LD 士多 - Web 版

<p align="center">
  <img src="https://ldspro.qzz.io/favicon.ico" alt="LD Status Pro Logo" width="80">
</p>

<p align="center">
  <strong>基于 LDC (Linux.do Credit) 的在线商品交易平台</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#技术栈">技术栈</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#部署指南">部署指南</a> •
  <a href="#项目结构">项目结构</a>
</p>

---

## 📖 简介

LD 士多 Web 版是 [LDStatus Pro](https://ldspro.qzz.io) 客户端脚本中「LD 士多」功能的独立网页版本。它提供了一个基于 LDC 积分系统的在线商品交易平台，支持 CDK 密钥、链接和寄存三种商品类型的发布与购买。

### 为什么选择 Web 版？

- 🌐 **无需安装** - 直接通过浏览器访问，无需安装浏览器扩展
- 📱 **响应式设计** - 完美支持桌面端和移动端
- 🎨 **更好的 UI/UX** - 采用现代化的莫兰迪配色设计
- 🔐 **安全可靠** - 前端安全防护，防止 XSS 等攻击

## ✨ 功能特性

### 🛒 商品浏览
- 分类浏览（AI、存储、小鸡、咨询）
- 商品搜索
- 商品详情查看
- 无限滚动加载

### 💰 商品购买
- CDK 自动发放
- 链接商品跳转
- 寄存商品对接
- LDC 支付集成

### 📦 商家功能
- 发布商品
- 编辑商品
- CDK 库存管理
- 订单管理
- 收款设置

### 👤 用户功能
- Linux.do OAuth 登录
- LDC 余额查询
- 订单历史查看
- 个人信息管理

### 🏪 小店集市
- 小店入驻与管理
- 小店商品浏览
- 店主信息展示

### 📚 帮助文档
- 快速入门指南
- 商品类型说明（链接/CDK）
- 发布流程详解
- 常见问题解答

## 🛠 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| [Vue.js](https://vuejs.org/) | 3.4+ | 渐进式 JavaScript 框架 |
| [Vue Router](https://router.vuejs.org/) | 4.2+ | 官方路由管理器 |
| [Pinia](https://pinia.vuejs.org/) | 2.1+ | Vue 状态管理库 |
| [Tailwind CSS](https://tailwindcss.com/) | 3.4+ | 原子化 CSS 框架 |
| [Vite](https://vitejs.dev/) | 5.0+ | 下一代前端构建工具 |

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 pnpm

### 安装依赖

```bash
cd ld-store
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:5173 查看应用。

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录。

### 预览生产版本

```bash
npm run preview
```

## 📦 部署指南

### 方式一：Cloudflare Pages（推荐）

1. **连接 GitHub 仓库**
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - 进入 Pages
   - 点击 "Create a project" → "Connect to Git"
   - 选择您的仓库

2. **配置构建设置**
   ```
   构建命令: npm run build
   构建输出目录: dist
   根目录: ld-store
   ```

3. **环境变量**（如需要）
   ```
   NODE_VERSION: 18
   ```

4. **自动部署**
   - 每次推送到指定分支时自动触发部署

### 方式二：使用 Wrangler CLI

1. **安装 Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **登录 Cloudflare**
   ```bash
   wrangler login
   ```

3. **部署**
   ```bash
   npm run deploy
   ```

### 方式三：其他静态托管平台

本项目可以部署到任何支持静态网站托管的平台：

- **Vercel**
- **Netlify**
- **GitHub Pages**
- **阿里云 OSS**
- **腾讯云 COS**

只需运行 `npm run build` 并上传 `dist` 目录即可。

## 📁 项目结构

```
ld-store/
├── public/                 # 静态资源
│   ├── _headers           # Cloudflare 安全头配置
│   └── _redirects         # SPA 路由重定向配置
├── src/
│   ├── components/        # Vue 组件
│   │   ├── common/        # 通用组件
│   │   ├── layout/        # 布局组件
│   │   ├── product/       # 商品相关组件
│   │   ├── shop/          # 小店相关组件
│   │   └── docs/          # 文档内容组件
│   ├── composables/       # Vue Composables
│   ├── router/            # 路由配置
│   ├── stores/            # Pinia 状态管理
│   │   ├── user.js        # 用户状态
│   │   ├── shop.js        # 商城状态
│   │   └── ui.js          # UI 状态
│   ├── utils/             # 工具函数
│   │   ├── api.js         # API 请求封装
│   │   ├── security.js    # 安全工具（XSS 防护等）
│   │   ├── storage.js     # 本地存储封装
│   │   └── format.js      # 格式化工具
│   ├── views/             # 页面视图
│   │   ├── Home.vue       # 首页
│   │   ├── ProductDetail.vue  # 商品详情
│   │   ├── Search.vue     # 搜索页
│   │   ├── Category.vue   # 分类页
│   │   ├── Login.vue      # 登录页
│   │   ├── User.vue       # 用户中心
│   │   ├── Orders.vue     # 订单列表
│   │   ├── MyProducts.vue # 我的商品
│   │   ├── Publish.vue    # 发布商品
│   │   ├── Edit.vue       # 编辑商品
│   │   ├── Settings.vue   # 收款设置
│   │   ├── Docs.vue       # 帮助文档
│   │   ├── MyShop.vue     # 我的小店
│   │   └── ShopDetail.vue # 小店详情
│   ├── styles/            # 全局样式
│   ├── App.vue            # 根组件
│   └── main.js            # 应用入口
├── index.html             # HTML 入口
├── vite.config.js         # Vite 配置
├── tailwind.config.js     # Tailwind 配置
├── postcss.config.js      # PostCSS 配置
├── wrangler.toml          # Cloudflare 配置
└── package.json           # 项目配置
```

## 🔐 安全特性

### XSS 防护
- HTML 实体转义
- 内容净化处理
- 严格的输入验证

### CSP 策略
- 严格的内容安全策略
- 限制外部资源加载
- 防止内联脚本执行

### 认证安全
- JWT Token 认证
- 自动 Token 刷新
- 安全的 Cookie 存储

### 输入验证
- 商品名称长度限制
- 商品描述内容过滤
- 价格范围验证
- URL 格式验证

## 🎨 设计规范

### 莫兰迪配色

本项目采用柔和的莫兰迪色系，给用户带来舒适的视觉体验：

| 颜色名 | 色值 | 用途 |
|--------|------|------|
| Sage | `#a5b4a3` | 主色调、按钮、链接 |
| Dusty | `#778d9c` | 次要色、信息提示 |
| Rose | `#ad9090` | 警告、删除操作 |
| Warm | `#cfa76f` | 强调色、价格显示 |
| Morandi | `#f5f3f0` | 背景色、卡片底色 |

### 响应式断点

- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

## 📝 开发指南

### 代码规范

- 使用 Vue 3 Composition API
- 组件使用 `<script setup>` 语法
- 遵循 ESLint 规则
- CSS 类名使用 BEM 命名

### 提交规范

```
feat: 新功能
fix: 修复问题
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试相关
chore: 构建/工具
```

### 添加新页面

1. 在 `src/views/` 创建 Vue 文件
2. 在 `src/router/index.js` 添加路由
3. 如需认证，添加 `meta: { requiresAuth: true }`

### 添加新组件

1. 在 `src/components/` 对应目录创建组件
2. 使用 `<script setup>` 语法
3. 样式使用 `<style scoped>`

## 🔗 相关链接

- [LDStatus Pro 主站](https://ldspro.qzz.io)
- [LDC 官网](https://credit.linux.do)
- [Linux.do 社区](https://linux.do)

## 📄 许可证

本项目遵循 MIT 许可证。

---

<p align="center">
  Made with ❤️ by LDStatus Pro Team
</p>
