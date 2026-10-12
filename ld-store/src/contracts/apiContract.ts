import { safeParse, type BaseIssue, type BaseSchema, type InferOutput } from 'valibot'
import type { ApiFailure, ApiResult } from '@/utils/api'

export type { ApiResult } from '@/utils/api'

type ContractSchema = BaseSchema<unknown, unknown, BaseIssue<unknown>>

export interface ContractContext {
  endpoint: string
  schemaName: string
}

function toCamelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase())
}

/**
 * Wire payloads still contain a mix of snake_case and camelCase. Normalize that
 * once at the service boundary. An explicit camelCase field wins independently
 * of serialized field order, including its null/false/zero values.
 */
export function camelizeWireValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelizeWireValue)
  if (!value || typeof value !== 'object') return value

  const source = value as Record<string, unknown>
  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(source)) {
    const camelKey = toCamelKey(key)
    if (camelKey !== key && Object.prototype.hasOwnProperty.call(source, camelKey)) continue
    output[camelKey] = camelizeWireValue(item)
  }
  return output
}

function issuePath(issue: BaseIssue<unknown>): string {
  const path = issue.path?.map((item) => String(item.key)).filter(Boolean).join('.')
  return path || '$'
}

function invalidResponse(status: number, context: ContractContext, issues: readonly BaseIssue<unknown>[]): ApiFailure {
  const issuePaths = Array.from(new Set(issues.map(issuePath))).slice(0, 12)
  console.warn('[api-contract] Invalid response', {
    endpoint: context.endpoint,
    schema: context.schemaName,
    issuePaths
  })
  return {
    success: false,
    status,
    error: '服务返回的数据格式异常，请稍后重试',
    errorCode: 'INVALID_RESPONSE',
    details: {
      schema: context.schemaName,
      issuePaths
    },
    aborted: false,
    kind: 'contract'
  }
}

export function validateApiResult<TSchema extends ContractSchema>(
  result: ApiResult<unknown>,
  schema: TSchema,
  context: ContractContext
): ApiResult<InferOutput<TSchema>> {
  if (!result.success) return result
  const parsed = safeParse(schema, camelizeWireValue(result.data), { abortEarly: false })
  if (!parsed.success) return invalidResponse(result.status, context, parsed.issues)
  return { ...result, data: parsed.output }
}
