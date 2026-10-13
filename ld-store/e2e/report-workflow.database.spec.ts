import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

test.skip(process.env.REPORT_DATABASE_E2E !== 'true', 'Separate explicit real-database acceptance command');
const requireBackend = createRequire(new URL('../../../ld-store-backend-new/package.json', import.meta.url));
const databaseUrl = process.env.TEST_DATABASE_URL || '';
if (process.env.REPORT_DATABASE_E2E === 'true' && new URL(databaseUrl).pathname !== '/ldstore_reports_acceptance_test')
  throw new Error('Dedicated local acceptance database required');

async function signIn(page: Page, user: Record<string, unknown>, token: string) {
  await page.addInitScript(
    ({ user, token }) => {
      localStorage.setItem('ld_store_user', JSON.stringify({ value: user, expire: 0 }));
      localStorage.setItem('ld_store_token', JSON.stringify({ value: token, expire: 0 }));
    },
    { user, token }
  );
}
async function isolate(context: BrowserContext) {
  await context.route('**/*', (route) => {
    const hostname = new URL(route.request().url()).hostname;
    return ['127.0.0.1', 'localhost'].includes(hostname) ? route.continue() : route.abort('blockedbyclient');
  });
}
async function act(page: Page, action: string, note: string, disposition = 'none') {
  const dialog = page.getByRole('dialog', { name: '举报核查' });
  await dialog.getByLabel('处理任务').selectOption(action);
  await dialog.getByLabel('给用户的核查说明（必填）').fill(note);
  await dialog.getByLabel('用户下一步').fill('请在原记录补充证据，订单退款继续使用现有售后入口');
  await dialog.getByLabel('内部备注（不会向举报人返回）').fill('ACCEPTANCE_INTERNAL_ONLY');
  await dialog.getByLabel('适用规则版本').fill('acceptance-rule-v1');
  if (action === 'confirm') await dialog.getByLabel('治理动作').selectOption(disposition);
  await dialog.getByRole('button', { name: '确认保存核查结果' }).click();
  await expect(dialog.getByRole('status')).toContainText('站内通知已记录');
}

test('real browser → HTTP → PostgreSQL: order report, private evidence, governance, both reviews and comment protection', async ({
  page,
  browser,
  context
}, info) => {
  const sessions = JSON.parse(await readFile('/tmp/ldsp-report-acceptance-session.json', 'utf8'));
  const f = sessions.fixtures[info.project.name];
  const sql = requireBackend('postgres')(databaseUrl, { max: 1 });
  const adminContext = await browser.newContext({
    viewport: info.project.use.viewport,
    isMobile: info.project.use.isMobile
  });
  const sellerContext = await browser.newContext({
    viewport: info.project.use.viewport,
    isMobile: info.project.use.isMobile
  });
  const admin = await adminContext.newPage(),
    seller = await sellerContext.newPage();
  const errors: string[] = [];
  for (const ctx of [context, adminContext, sellerContext]) {
    await isolate(ctx);
    ctx.on('page', (p) => p.on('pageerror', (error) => errors.push(error.message)));
  }
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page, f.buyer, f.buyerToken);
  await signIn(seller, f.seller, f.sellerToken);
  await admin.addInitScript((key) => {
    sessionStorage.setItem('apiUrl', 'http://127.0.0.1:4174');
    sessionStorage.setItem('adminKey', key);
    sessionStorage.setItem('adminType', 'super');
  }, sessions.adminKey);
  const api = async (path: string, body?: Record<string, unknown>, token = f.buyerToken, adminCall = false) => {
    const response = await page.request.fetch('http://127.0.0.1:8798' + path, {
      method: body ? 'POST' : 'GET',
      data: body,
      headers: adminCall ? { 'x-admin-key': sessions.adminKey } : { authorization: 'Bearer ' + token }
    });
    const json = await response.json();
    return { status: response.status(), json: { ...json, data: json.data ?? json } };
  };
  try {
    await page.goto('/order/' + f.orderNo + '?role=buyer');
    await expect(page.getByRole('button', { name: '反馈交付问题' })).toBeVisible();
    await page.getByRole('button', { name: '反馈交付问题' }).click();
    const composer = page.getByRole('dialog', { name: '反馈物品问题' });
    await composer.getByLabel('问题分类').selectOption('delivery_issue');
    await composer.getByLabel('详细说明').fill('关联订单交付的内容无法使用，需要核查报错');
    const submitted = page.waitForResponse(
      (r) => r.url().endsWith('/products/' + f.productId + '/report') && r.request().method() === 'POST'
    );
    await composer.getByRole('button', { name: '提交举报' }).click();
    const submissionResponse = await submitted;
    expect(submissionResponse.status()).toBe(200);
    const receiptWire = await submissionResponse.json();
    const receipt = receiptWire.data ?? receiptWire;
    const id = receipt.reportId,
      detailPath = '/api/shop/reports/product/' + id;
    expect(id).not.toBe(f.productId);
    const submissionBody = submissionResponse.request().postDataJSON();
    expect((await api('/api/shop/products/' + f.productId + '/report', submissionBody)).json.data.replayed).toBe(true);
    expect(
      (await api('/api/shop/products/' + f.productId + '/report', { ...submissionBody, orderNo: '' })).status
    ).toBe(409);
    await composer.getByRole('link', { name: '查看进度 / 补充证据' }).click();
    await expect(page.getByRole('heading', { name: '举报 #' + id, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '查看关联订单与售后' })).toHaveAttribute('href', /REPORT_ACCEPTANCE_/);
    await admin.goto('http://127.0.0.1:4174/shop-reports?reportType=product&reportId=' + id);
    await expect(admin.getByText('处置对象：商品 #' + f.productId)).toBeVisible();
    await act(admin, 'request_info', '目前信息不足，请补充具体报错与发生时间');
    await page.reload();
    await expect(page.getByText('待补充', { exact: true })).toBeVisible();
    const image = await page.screenshot({ clip: { x: 0, y: 0, width: 20, height: 20 } });
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'redacted.png', mimeType: 'image/png', buffer: image });
    await expect(page.getByText('核查中', { exact: true })).toBeVisible();
    await expect(page.getByAltText('你提交的私密证据截图')).toBeVisible();
    expect(
      await page.getByAltText('你提交的私密证据截图').evaluate((image: HTMLImageElement) => image.naturalWidth)
    ).toBeGreaterThan(0);
    await page.getByLabel('问题说明或新证据').fill('已补充截图，报错发生在兑换后第一次使用');
    await page.getByRole('button', { name: '提交补充说明' }).click();
    await expect.poll(async () => (await api(detailPath)).json.data.events.length).toBe(4);
    const detail = (await api(detailPath)).json.data;
    const fileId = detail.evidence[0].id;
    expect((await api(detailPath, undefined, f.strangerToken)).status).toBe(404);
    const forbidden = await page.request.get('http://127.0.0.1:8798' + detailPath + '/evidence/' + fileId, {
      headers: { authorization: 'Bearer ' + f.sellerToken }
    });
    expect(forbidden.status()).toBe(404);
    await admin.reload();
    await act(admin, 'confirm', '已确认物品说明误导，平台已下架该物品', 'offline');
    const products =
      await sql`SELECT id,status,is_deleted FROM shop_products WHERE id IN (${f.productId},${f.commentProductId}) ORDER BY id`;
    expect(products.map((p: Record<string, unknown>) => p.status)).toEqual(['offline_manual', 'approved']);
    await page.reload();
    await expect(page.getByText('已确认问题', { exact: true }).first()).toBeVisible();
    expect(await page.textContent('body')).not.toContain('ACCEPTANCE_INTERNAL_ONLY');
    const subjectPath = '/api/shop/report-decisions/product/' + id;
    const subjectDetail = (await api(subjectPath, undefined, f.sellerToken)).json.data;
    expect(JSON.stringify(subjectDetail)).not.toContain(f.buyer.id);
    expect(subjectDetail.evidence).toHaveLength(0);
    await seller.goto('http://127.0.0.1:4198/user/reports/product/' + id + '?party=subject');
    await seller.getByLabel('问题说明或新证据').fill('卖家已更新说明，提供新的事实申请复核');
    await seller.getByRole('button', { name: '提交复核申请' }).click();
    await expect(seller.getByText('复核正在进行，请在此补充原记录。')).toBeVisible();
    await admin.reload();
    await act(admin, 'start', '已开始核查卖家补充的新事实，原处置仍保留');
    expect((await api(detailPath)).json.data.report.governance_action).toBe('offline');
    await act(admin, 'confirm', '复核已完成，原问题成立，继续维持物品下架');
    await page.reload();
    await page.getByLabel('问题说明或新证据').fill('举报人提供新报错记录，申请一次复核');
    await page.getByRole('button', { name: '提交复核申请' }).click();
    await expect(page.getByText('复核正在进行，请在此补充原记录。')).toBeVisible();
    const reopened = (await api(detailPath)).json.data;
    const common = {
      operationId: crypto.randomUUID(),
      expectedRevision: reopened.report.revision,
      publicNote: '核查后转交现有售后处理订单交付',
      nextStep: '请在原订单跟进退款或 Credit 争议',
      ruleVersion: 'report-governance-v1',
      disposition: 'none'
    };
    const concurrent = await Promise.all([
      api('/api/admin/shop/report-cases/product/' + id + '/actions', { ...common, action: 'refer' }, '', true),
      api(
        '/api/admin/shop/report-cases/product/' + id + '/actions',
        { ...common, operationId: crypto.randomUUID(), action: 'refer' },
        '',
        true
      )
    ]);
    expect(concurrent.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = concurrent.find((r) => r.status === 200)!;
    expect(winner.json.data.changed).toBe(1);
    expect((await api(detailPath)).json.data.report.decision).toBe('referred');
    // A seller reporting a low score must receive a factual decision, never automatic deletion.
    await seller.goto('http://127.0.0.1:4198/product/' + f.commentProductId);
    await expect(seller.getByRole('button', { name: '评论操作', exact: true })).toBeVisible();
    await seller.getByRole('button', { name: '评论操作', exact: true }).click();
    await seller.locator('.comment-action-menu').getByRole('button', { name: '举报', exact: true }).click();
    const commentComposer = seller.getByRole('dialog', { name: '举报评论' });
    await expect(commentComposer).toBeVisible();
    await commentComposer.getByLabel('问题分类').selectOption('factual_dispute');
    await commentComposer.getByLabel('详细说明').fill('卖家认为低分影响生意，请核查具体事实');
    const commentResponse = seller.waitForResponse((r) => r.url().endsWith('/comments/' + f.commentId + '/report'));
    await commentComposer.getByRole('button', { name: '提交举报' }).click();
    const commentId = (await (await commentResponse).json()).data.reportId;
    await commentComposer.getByRole('link', { name: '查看进度 / 补充证据' }).click();
    await expect(seller.getByRole('heading', { name: '举报 #' + commentId, exact: true })).toBeVisible();
    await admin.goto('http://127.0.0.1:4174/shop-reports?reportType=comment&reportId=' + commentId);
    await act(admin, 'reject', '真实负面体验可以保留，低分本身不构成违规');
    expect((await sql`SELECT status FROM shop_product_comments WHERE id=${f.commentId}`)[0].status).toBe(
      'manual_approved'
    );
    await seller.reload();
    await seller.getByLabel('问题说明或新证据').fill('提供新的沟通事实申请复核，请核对时间');
    await seller.getByRole('button', { name: '提交复核申请' }).click();
    await expect(seller.getByText('复核正在进行，请在此补充原记录。')).toBeVisible();
    await admin.reload();
    await act(admin, 'confirm', '新证据确认评价包含违规内容，平台隐藏该评论', 'hide_comment');
    expect((await sql`SELECT status FROM shop_product_comments WHERE id=${f.commentId}`)[0].status).toBe(
      'manual_rejected'
    );
    const events =
      await sql`SELECT action,decision FROM shop_report_events WHERE target_type='comment' AND report_id=${commentId} ORDER BY id`;
    expect(events.map((e: Record<string, unknown>) => e.action)).toEqual([
      'create',
      'reject',
      'review_requested',
      'confirm'
    ]);
    const history =
      await sql`SELECT status FROM shop_product_reports WHERE id=${f.historicalProductReportId} UNION ALL SELECT status FROM shop_product_comment_reports WHERE id=${f.historicalCommentReportId}`;
    expect(history.map((r: Record<string, unknown>) => r.status)).toEqual(['pending', 'pending']);
    const notices =
      await sql`SELECT dedupe_key FROM shop_user_messages WHERE related_type IN ('report','report_decision') AND related_id IN (${'product:' + id},${'comment:' + commentId})`;
    expect(notices.length).toBeGreaterThanOrEqual(10);
    expect(new Set(notices.map((n: Record<string, unknown>) => n.dedupe_key)).size).toBe(notices.length);
    expect(errors).toEqual([]);
    for (const [name, p] of [
      ['user', page],
      ['admin', admin],
      ['subject', seller]
    ] as const) {
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await p.screenshot({
        path: 'test-results/report-database-' + info.project.name + '-' + name + '.png',
        fullPage: true
      });
    }
  } finally {
    await sql.end();
    await adminContext.close();
    await sellerContext.close();
  }
});
