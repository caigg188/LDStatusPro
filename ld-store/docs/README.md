# LD士多前端文档索引

本文档用于说明 `ld-store/` 当前真实可用的维护入口，避免继续引用仓库中并不存在的占位文档。

## 当前文档入口

| 文档 | 作用 |
|------|------|
| [../README.md](../README.md) | 项目介绍、开发命令、Cloudflare Pages 部署说明 |
| [../../PROJECT_STRUCTURE.md](../../PROJECT_STRUCTURE.md) | 仓库级项目边界、后端域名语义、服务职责分工 |
| [../.env.example](../.env.example) | 前端运行时环境变量示例 |

## 维护时优先查看的文件

| 文件 | 作用 |
|------|------|
| `src/utils/api.js` | 前端请求封装、超时、鉴权失效处理 |
| `src/router/index.js` | 路由定义、登录守卫、维护模式跳转 |
| `src/stores/shop.js` | 商城核心状态与大部分业务请求入口 |
| `src/config/maintenance.js` | 维护模式开关与维护页文案 |
| `public/_worker.js` | Cloudflare Pages 边缘元信息注入逻辑 |
| `vite.config.js` | 本地开发代理、构建分包配置 |
| `eslint.config.js` | 当前前端代码规范入口 |

## 当前约定

- 所有文件编码统一为 UTF-8（无 BOM）。
- 新增或修改文件时，优先保持中文注释和中文文案可正常显示，避免乱码。
- 环境变量命名以 `VITE_API_BASE`、`VITE_AUTH_API_BASE`、`VITE_IMAGE_API_BASE` 为准，不再继续扩散旧命名。
- Cloudflare Pages 相关能力优先收敛到 `public/_worker.js`、`public/_headers`、`public/_redirects`、`wrangler.toml`。

## 建议的补充方向

如果后续需要继续完善文档，建议只补这三类：

1. 部署与回滚说明。
2. 前端架构与目录职责说明。
3. 常见故障排查与发布检查清单。

不要再保留“技术文档 / 产品文档”这类没有实体文件的索引占位，避免误导维护者。
