# LD 士多前端文档

| 文档 | 内容 |
| --- | --- |
| [卖家后台 Paper Console](./seller-console.md) | `/seller` 布局、组件套件、信息架构与页面改造验收 |
| [Open Graph 功能说明](./open-graph.md) | Linux DO 分享预览的显示逻辑、接口、OG Image、安全、缓存、部署和验收 |
| [ADR-0001：全站 noindex 与分享元数据并存](./adr/0001-noindex-sharing-metadata.md) | 继续禁止搜索收录、允许分享抓取的决策、门禁与重新评估条件 |
| [前台响应式与密度合同](./responsive-layout.md) | 断点、密度 token、货架列数与小屏桌面 compact 落地顺序 |
| [商城登录态与会话边界](./auth-session.md) | JWT 会话、跨标签页同步、请求隔离、OAuth 和回归验证 |
| [CI / CD](../../CI.md) | 推送时的质量门禁，以及手动的 Pages 发布 |

关键实现入口：

- `public/_worker.js`：Pages 边缘元标签注入、oEmbed 和同源 `/og/*` 图片代理。
- `index.html`：无 Worker 场景的完整静态分享标签。
- `scripts/validate-open-graph.mjs`：生产构建后的标签唯一性与兜底 PNG 校验。
- `scripts/validate-noindex-policy.mjs`：源码与生产构建的 noindex、robots、Worker 和 ADR 一致性门禁。
- `tests/worker-open-graph.test.js`：路由矩阵、失败降级、HEAD、oEmbed 和图片缓存回归测试。

修改分享逻辑后执行 `npm run check`；不要只检查浏览器内由 Vue 更新后的 `<head>`，论坛抓取器读取的是首个 HTTP HTML 响应。
