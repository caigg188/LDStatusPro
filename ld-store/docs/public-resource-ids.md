# 对外资源编号

资源 ID 支持 UUID v4 与切换前历史数字链接双读，分类和第三方账号 ID 保留原类型。历史商品的 `id`/关联 ID 继续使用数字，新商品及其他 UUID 资源使用 UUID；订单使用业务订单号，优惠券活动继续使用 publicToken。

资源 ID 必须保持为不透明值，不做 Number()/parseInt() 转换，不按 UUID 排序。`normalizeResourceId` 只在接收路由或旧缓存时兼容历史数字；后端决定数字兼容边界，前端不能放开新数字入口。字典 ID 不使用 UUID 合同。

历史商品保留原数字 URL 和读写编号；编辑、下架、重新上架不重编。新商品只使用 UUID。小店、求购的历史链接仍规范化为 UUID。checkout 在规范编号确定后初始化；历史商品 UUID 别名解析失败时先回商品详情重试，不能按未知 UUID key 另建意图。历史 pending 保留原数字 key，原 token、数量和金额不变；旧数字优惠券由买家/站点受限的只读查单接口映射。页面跨过服务端切换时再次解析数字券，PUBLIC_ID_REQUIRED 或查询不明保留原 token；仅明确重试才重放原 token，已有订单直接恢复。私聊消息游标/已读位置传消息 UUID，排序依赖服务器结果与时间，不能用 UUID 做减法。优惠券、举报、推广和分享 Worker 均按各实体规则使用资源引用。

精确公开统计不变。浏览器回归默认阻断所有外部 API/OAuth/支付网络，UUID 场景见 e2e/public-resource-ids.spec.ts，核心工具和合同见 tests/public-resource-ids.test.ts。真实支付、生产数据库和生产发布未在本任务执行。

发布顺序、历史边界冻结、回填 CLI、安全回退与旧小店身份遗留问题见 API2 的 docs/security/public-resource-ids.md；开启服务端输出前须先发布商城（含 Worker）与后台。迁移不能通过重写历史订单/审核证据完成。
