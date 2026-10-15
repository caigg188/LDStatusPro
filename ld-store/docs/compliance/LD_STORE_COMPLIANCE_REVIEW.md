# LD 士多协议与售后对齐记录

核对日期：2026-10-15。本次为用户明确授权的 **B1：协议与售后对齐**。涉及退款权利、平台承诺的文字按实质条款变更记录，不归为 A 类普通文案修正。

## 范围与证据等级

- 商城基线：`LDStatusPro` 的 `9eb2fd5`；后端基线：`ld-store-backend-new` 的 `9a6ae5923c7dbf3439a036047a3c8454739cb038`。均为本地 `main`，本次开始时工作区干净。
- 已核对：源码、接口、既有测试、运行手册、官方公开规则。下述代码路径相对于各自仓库；测试证据另列。
- 运营者在本会话确认，售后复核联系入口为 <https://linux.do/u/jackyliii>。这是 LD 士多管理员 Jacky 的联系入口，不表示 LINUX DO 官方或 Credit 受理。未实际发送私信，不保证第三方账号的私信权限始终可用。
- 实施验收阶段未连接生产；后续用户明确授权提交、推送及部署后，补充了下文的发布前只读核对。未操作真实订单，未以代码已实现代替真实退款执行结果。
- 仅修改规则文字、帮助导航、售后提示和测试，以及后端一份运维文档。无退款状态机、权限、商家准入、退款金额、计时、数据库、隐私授权或业务配置变化。

## 已确认矛盾与实际修改

| 风险与原说法 | 核对依据 | 本次对齐与影响 |
| --- | --- | --- |
| 高：条款称平台仅展示信息、所有环节免费 | 后端 `src/modules/orders/order.service.ts` 创建订单、原商户凭证快照和自动交付；`src/services/top-service.service.ts` 的推广套餐及付费订单；退款及管理接口 | `DocTerms.vue` 明确订单、支付对接、交付、退款与内部处理等服务，以及可选推广收费。区别卖家收款、Credit 上游手续费和平台推广费，不新增收费。 |
| 高：兑换后原则上不退、卡密发放即视为履约 | `refund.service.ts:getRefundEligibility` 接受 paid/delivered/completed；`createRefund` 不要求先联系卖家；交付代码仅保存并展示内容，未验证每份卡密有效 | 条款和退款指南不再用发卡状态一概排除售后；区分交付记录、实际有效性与约定履行。申请不保证批准，不新增无条件退款或垫付。 |
| 高：7 天可能被误解为全部权利期限 | `getRefundEligibility` 对买家新建申请检查支付后 7 天；`executeRefund` 对已有申请没有重新套用该门槛；`tests/refund-response.integration.test.ts` 有超过 7 天继续处理场景 | 新增 `application-window` 说明，订单申请不可用时仍有指向该说明的链接。期限后保留协商、核实和适用争议路径，不开放超过期限的在线新申请。 |
| 高：申请与发货保障的 72 小时被混为一谈 | `refund-response.service.ts`：新申请从申请时间起算，历史申请通知后给完整期限；`fulfillment-policy.ts` / `fulfillment.service.ts`：普通手动交付的新订单按支付时间，历史订单另行通知 | 条款、退款和发货指南分别表述适用范围、起算点、历史安排；不重算或延长已有期限。实际执行仍依赖对应策略启用、自动执行开关和任务健康。 |
| 高：条款否认内部处理，运维文档称拒绝为不可复核终态 | `admin-refund.routes.ts` 的 approve/reject/override/retry/resolve；`refund.service.ts:decideByAdmin/retryByAdmin/resolveByAdmin`，证据必填；到期拒绝受服务端限制 | 说明已有申请可由管理员凭证据内部决定、复核和核实异常；拒绝面板增加指向复核路径的链接。区分内部处理与法定仲裁，不扩大管理员权限。后端 `docs/shop/refunds.md` 同步纠正旧描述。 |
| 高：“已转 Credit 处理”容易被当成已立案或已退款 | `refund.service.ts` 的原交易预检：非成功状态或明确 404 收敛为 external_dispute；网络、鉴权或金额异常不等同于该状态 | 条款、指南和订单面板明确它只表示停止本站退款，不证明已受理、获准或退款。未知结果先核实，不重复调用；“不可撤销”限定为退款成功后。 |
| 中：复核联系入口实际指向赞助页 | 原 `DocRefunds.vue` / `DocQuickStart.vue` 的 `/support`；运营者本会话确认实际入口 | 退款、快速入门、发货保障、条款均指向 Jacky 论坛主页。举报仅处理内容治理，与退款分别跟进。没有新增受理时效承诺。 |
| 中：旧免责把所有风险交给用户 | `DocTerms.vue` 旧第 5、9 节与实际平台服务不一致；格式条款相关官方依据见下文 | 明确卖家履约责任、平台实际服务边界及自身过错/明确承诺/依法应承担责任，不以积分或技术服务一概免责。未承诺统一商品质量担保。 |
| 低：文章页通用日期与条款正文矛盾 | `Docs.vue` 原来所有文章使用统一 `HELP_UPDATED_AT` | 注册表只给本次修订的五篇文章标注日期，页面优先显示单篇日期，其他文章沿用原日期。此日期是内容核对日期，不是用户接受记录或规则生效日。 |

主要前端文件均位于 `ld-store/src/`：`components/docs/DocTerms.vue`、`DocRefunds.vue`、`DocShippingDeadline.vue`、`DocBuyGuide.vue`、`DocQuickStart.vue`，`components/order/OrderRefundPanel.vue`，`config/helpCenter.js`，`views/Docs.vue`。

## 已排除和明确不变的事项

- 不是“完全没有退款/人工复核能力”：买家申请、卖家处理和管理员接口已存在，无需新增退款系统。
- 联系卖家不是申请前置条件，`buyerContactedSeller=false` 可以提交；不新增强制勾选。
- 7 天不是本次新设规则；已受理申请超过 7 天后可继续处理。没有因为文字对齐开放无条件退款。
- 超时退款不等于即时到账；`unknown` 禁止盲目重试，`failed` 与 `external_dispute` 分别处理。没有把未知结果改成成功。
- 退款不自动恢复优惠券、库存、永久累计限购；滚动限购按原支付时间自然移出。`order.service.ts:canViewOrderDeliveryContent` 已规定退款后买家不可再查看，卖家/管理员按原权限核对，不改为撤回所有已暴露内容。
- 商品举报/评论举报不是正式退款申请，也不以举报结案证明退款完成。
- 商品卡片广告标识与库存展示保持用户上一轮确定的状态；本次未改 `ProductCard.vue` 或 `shopProduct.js`。
- 未追溯变更历史协议、订单、通知或同意记录；旧文字保留于 Git 基线。Git 历史不替代面向用户的协议历史展示或有效同意证据。

## 官方规则核对与适用限度

以下来源于 2026-10-15 联网读取，仅提取与本批次直接相关的规则，不据此宣称平台“全面合规”。

- [Credit 使用指南](https://credit.linux.do/docs/how-to-use)：上游服务手续费与平台可选服务费用需要区分；争议由 Credit 按自己的流程受理。本地客服入口或状态不会自动建立 Credit 争议。
- [Credit API 文档](https://credit.linux.do/docs/api)：退款使用原支付订单全额；提交请求与退款成功不同。查询中交易不存在也不能单独作为积分已退回的证据。
- [民法典官方全文](https://www.court.gov.cn/zixun/xiangqing/233181.html)：第 496–498 条涉及格式条款提示和不合理免责等，第 506 条涉及免责效力。此次文字避免一概免责；具体主体、交易性质、责任及法律适用仍须结合运营事实判断。
- [网络交易平台规则监督管理办法官方文本](https://www.cac.gov.cn/2026-01/07/c_1769515215345420.htm)：自 2026-02-01 施行；涉及规则可获取性、修改公示与过渡、历史版本及接受方式。是否适用及具体发布要求需结合运营者/业务性质核实，不能只凭 LDC 积分定性。本次未实施发布或更改用户同意机制。

## 验证记录

环境：本地商城测试配置 `envDir:false`，Vitest 网络沙箱；浏览器使用 `vite.e2e.config.js` 的回环测试服务器，显式模拟 API、阻断外网和 WebSocket，未加载生产配置或凭据。浏览器场景只对订单/退款 API 执行 GET，不提交退款。

验证目标：条款到退款指南链接可达，确认的联系地址一致；7 天新建申请入口关闭与后续售后说明并存；拒绝申请可到内部复核说明；移动端 320px 可阅读、页面无横向溢出；按篇显示更新日期而不污染其他文章日期。

执行命令（工作目录 `LDStatusPro/ld-store`）：

```sh
env -i PATH="$PATH" NODE_ENV=test npm run test -- tests/help-center.test.js tests/refund.test.js tests/refund-deadline.test.js tests/refund-event-timeline.test.js
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test npm run test:e2e -- e2e/after-sales-alignment.spec.ts --project=desktop --project=mobile
env -i PATH="$PATH" npm run lint
env -i PATH="$PATH" npm run typecheck
env -i PATH="$PATH" npm run check:architecture
env -i PATH="$PATH" npm run check:styles
env -i PATH="$PATH" node -e 'import("vite").then(({build}) => build({envDir:false, mode:"test"}))'
```

执行结果：4 个定向测试文件共 **37 项通过**；桌面及 320px 移动端浏览器共 **6 项通过**；lint、类型检查、架构边界、样式检查均通过；不加载环境文件的测试模式构建成功（8.45 秒），仅有插件耗时提示。两仓库 `git diff --check` 通过。

首轮测试发现旧文案精确匹配断言需随语义更新；新浏览器用例的日期格式和带角色查询参数的模拟路由匹配有误。修正测试后重跑通过，未为通过测试修改退款业务逻辑。已人工查看桌面超窗提示与移动端复核按钮截图，文本和入口可见。浏览器截图在忽略的 `test-results/after-sales-alignment-*/`；构建日志为 `/tmp/ld-store-b1-build.log`。

已读取后端退款边界与集成测试源文件，但本次后端仅文档改动，未启动后端测试、数据库或缓存。前端模拟接口的通过不等于真实 Credit 调用、持久化或生产端到端验收通过。

## 保留的 B/C 事项和发布前决策

1. **条款发布与接受机制（B/C）**：本地改稿完成不代表已经生效。需要确定公示/生效日期、适用对象、历史版本展示和必要的接受方式；旧有“登录即同意”“继续使用即接受”机制未在本次调整，不能用内容更新日期补造用户同意。
2. **生产启用事实**：发布前只读核对已补齐，见下文；只是该时点的启用与运行证据，不保证未来每笔退款都成功。不得静默删除既有保障承诺或擅自调整业务开关。
3. **超窗无申请的复核执行（C）**：Jacky 已确认联系入口；已有申请具备管理员操作接口，但未建立“超过 7 天且从未申请也能自动创建退款”的新权限。此类案件先核实，再按原有能力或 Credit 规则处理，不承诺必然退款或固定答复时效。
4. **其他实质事项暂不实施（B/C）**：用户年龄/准入、隐私与第三方数据处理、商家权限、运营主体及法律适用、推广标识等保留原范围和未决原因；本批次不能替代这些事项的专项审查。

## 后续发布授权与发布前核对

2026-10-15，用户在本地验收完成后明确要求“提交并推送然后部署”。发布范围为本会话的 A 类已提交修正和 B1 对齐；后端只有运维文档，不涉及运行逻辑、迁移或重启。发布不重算历史期限，也不补造用户同意记录。

- 已读取 `ld-store/scripts/deploy-pages-production.sh`：本机干净 main 与 origin/main 一致后，执行 lint、安全依赖检查、构建、私有 source map 与公共 JS 一致性检查、体积检查，再部署 Pages。不运行生产环境测试。
- Pages 回退点：部署 `9d53a048-1708-41b0-a34c-961707ae0b73`，源提交 `c51881f`，访问地址 <https://9d53a048.ld-store.pages.dev>；保留现有部署，可从 Cloudflare Pages 部署历史回退。
- 生产后端 `/opt/ld-store-backend-new` 为干净 main，HEAD `9a6ae5923c7dbf3439a036047a3c8454739cb038`，API 与 Worker 均 active。
- 使用显式 `BEGIN READ ONLY` 查询策略表：退款响应策略已启用且 `auto_refund_enabled=true`；发货策略版本 `shipment-72h-v1`，已启用且自动退款、自动计罚均为 true。未修改开关。
- 最近扫描日志：退款响应扫描 failed=0、overdue=0、pendingNotifications=0；发货期限扫描 active=true、failed=0。这是发布前时点证据，不代表已逐笔核验真实退款结果。
- 发布完成的提交、Pages 部署标识和线上验收结果由本次交付回执记录，不能将上文发布前状态误认为新版本已经上线。
