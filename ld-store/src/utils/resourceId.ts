/** Dual-read during migration; new API responses use UUID v4. Category and external account IDs are separate. */
export type ResourceId = string | number
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function normalizeResourceId(value: unknown): ResourceId {
  const text = String(value ?? '').trim()
  if (uuidV4.test(text)) return text.toLowerCase()
  if (/^[1-9]\d*$/.test(text) && Number.isSafeInteger(Number(text))) return Number(text)
  return 0
}
