import { beforeEach, expect, it, vi } from 'vitest';
const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/utils/api', () => ({ api: client }));
import { reportDetail, submitReport, readReportEvidence } from '@/services/shop/reportService';
beforeEach(() => vi.clearAllMocks());
it('reads normalized dates and private screenshot references without losing the case contract', async () => {
  client.get.mockResolvedValue({
    success: true,
    status: 200,
    data: {
      report: { id: 383, target_type: 'product', status: 'processing', created_at: '2026-10-13T07:06:07.044Z' },
      events: [],
      evidence: [{ id: 1, party: 'reporter' }]
    }
  });
  const result = await reportDetail('product', 383);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.report.targetType).toBe('product');
    expect(result.data.report.createdAt).toBe('2026-10-13T07:06:07.044Z');
    expect(result.data.evidence[0].id).toBe(1);
  }
});
it('requests subject evidence through a separate authenticated boundary', async () => {
  const blob = new Blob(['isolated-evidence'], { type: 'image/jpeg' });
  client.get.mockResolvedValue({ success: true, status: 200, data: { blob, disposition: 'inline' } });
  const result = await readReportEvidence('product', 383, 1, true);
  expect(result.success && result.data).toBe(blob);
  expect(client.get).toHaveBeenCalledWith('/api/shop/report-decisions/product/383/evidence/1', {
    auth: 'required',
    responseType: 'blob'
  });
});
it('preserves submission identifiers for uncertain retries', async () => {
  client.post.mockResolvedValue({ success: true, status: 200, data: { reportId: 23, targetType: 'comment' } });
  const payload = {
    submissionToken: 'isolated-submission-1234',
    category: 'factual_dispute',
    reason: '评论需要核查事实'
  };
  expect((await submitReport('comment', 828, payload)).success).toBe(true);
  expect(client.post).toHaveBeenCalledWith('/api/shop/comments/828/report', payload, { auth: 'required' });
});
