import { api, type JsonValue } from '@/utils/api';
import { validateApiResult } from '@/contracts/apiContract';
import { array, looseObject, number, string, union } from 'valibot';

const record = looseObject({ id: union([number(), string()]), targetType: string(), status: string() });
const listSchema = looseObject({
  reports: array(record),
  stats: looseObject({}),
  pagination: looseObject({ total: number(), totalPages: number() })
});
const detailSchema = looseObject({
  report: record,
  events: array(looseObject({})),
  evidence: array(looseObject({ id: union([number(), string()]) }))
});
const receiptSchema = looseObject({ reportId: union([number(), string()]), targetType: string() });
export async function listReports(query: Record<string, string>) {
  return validateApiResult(
    await api.get('/api/shop/reports?' + new URLSearchParams(query), { auth: 'required' }),
    listSchema,
    { endpoint: '/api/shop/reports', schemaName: 'ReportList' }
  );
}
export async function reportDetail(type: string, id: string | number, subject = false) {
  return validateApiResult(
    await api.get(`/api/shop/${subject ? 'report-decisions' : 'reports'}/${type}/${id}`, { auth: 'required' }),
    detailSchema,
    { endpoint: '/api/shop/reports/:type/:id', schemaName: 'ReportDetail' }
  );
}
export async function submitReport(type: string, objectId: string | number, body: JsonValue) {
  return validateApiResult(
    await api.post(
      type === 'comment' ? `/api/shop/comments/${objectId}/report` : `/api/shop/products/${objectId}/report`,
      body,
      { auth: 'required' }
    ),
    receiptSchema,
    { endpoint: '/api/shop/report', schemaName: 'ReportReceipt' }
  );
}
export function supplementReport(type: string, id: string | number, body: JsonValue, subject = false) {
  return api.post(
    `/api/shop/${subject ? 'report-decisions' : 'reports'}/${type}/${id}/${subject ? 'review' : 'supplements'}`,
    body,
    { auth: 'required' }
  );
}
export function attachReportEvidence(type: string, id: string | number, body: JsonValue, subject = false) {
  return api.post(`/api/shop/${subject ? 'report-decisions' : 'reports'}/${type}/${id}/evidence`, body, {
    auth: 'required',
    timeout: 60000
  });
}
export async function readReportEvidence(type: string, id: string | number, fileId: string | number, subject = false) {
  const result = await api.get<{ blob: Blob; disposition: string }>(`/api/shop/${subject ? 'report-decisions' : 'reports'}/${type}/${id}/evidence/${fileId}`, {
    auth: 'required',
    responseType: 'blob'
  });
  return result.success ? { ...result, data: result.data.blob } : result;
}
export const reportStates: Record<string, string> = {
  pending: '待受理',
  processing: '核查中',
  awaiting_info: '待补充',
  resolved: '已结案',
  rejected: '已结案'
};
export const reportDecisions: Record<string, string> = {
  confirmed_issue: '已确认问题',
  no_violation: '未确认违规',
  referred: '已转交售后'
};
export const reportCategories: Record<string, string> = {
  delivery_issue: '无法使用或交付异常',
  content_mismatch: '描述或价格不符',
  promotion: '推广引流',
  fraud_risk: '疑似欺诈或违规转售',
  purchase_flow_issue: '购买异常',
  privacy: '隐私泄露',
  harassment: '辱骂骚扰',
  factual_dispute: '事实争议',
  other: '其他'
};
