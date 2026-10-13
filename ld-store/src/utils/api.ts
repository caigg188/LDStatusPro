import { getMaintenanceRequestBlock } from '@/config/maintenance'
import { captureAuthSession, isAuthSessionCurrent, emitAuthExpired, isAuthErrorCode } from './auth'
import { getDiscoveryRequestHeaders } from './discovery'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type AbortReason = 'caller' | 'timeout'
export type ApiAuthMode = 'optional' | 'required' | 'none'
export type ApiFailureKind = 'http' | 'network' | 'abort' | 'maintenance' | 'contract'

export interface ApiSuccess<T> {
  success: true
  status: number
  data: T
  [key: string]: unknown
}

export interface ApiFailure {
  success: false
  status: number
  error: string
  errorCode?: string
  details?: unknown
  aborted: boolean
  abortReason?: AbortReason
  kind: ApiFailureKind
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure

export interface ApiRequestOptions {
  method?: string
  body?: BodyInit | JsonValue
  headers?: HeadersInit
  signal?: AbortSignal
  timeout?: number
  /**
   * `required` (the default) prevents the request from reaching the network
   * without a usable local session. `optional` preserves viewer-aware public
   * responses, while `none` never attaches the stored storefront token.
   */
  auth?: ApiAuthMode
  responseType?: 'blob'
}

export interface ApiReadOptions extends Omit<ApiRequestOptions, 'method' | 'body'> {}

export interface EventStreamOptions {
  signal?: AbortSignal
  headers?: HeadersInit
}

export type EventStreamResult =
  | { success: true; status: number; response: Response }
  | ApiFailure

// API 基础地址
// 开发环境使用相对路径（通过 Vite 代理），生产环境使用完整 URL
const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? '' : 'https://api2.ldspro.qzz.io')
const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE || (import.meta.env.DEV ? '' : 'https://api1.ldspro.qzz.io')
const IMAGE_API_BASE = import.meta.env.VITE_IMAGE_API_BASE || (import.meta.env.DEV ? '' : 'https://api.ldspro.qzz.io')

// Linux.do LDC API 基础地址
export const LDC_API_BASE = 'https://linux.do'

// 请求超时时间
const TIMEOUT = 15000

// HTTP 错误码映射
const ERROR_MESSAGES: Record<number, string> = {
  400: '请求参数错误',
  401: '登录已过期，请重新登录',
  403: '没有权限执行此操作',
  404: '请求的资源不存在',
  429: '请求过于频繁，请稍后再试',
  500: '服务器内部错误',
  502: '服务暂时不可用',
  503: '服务正在维护中',
}

const NETWORK_ERROR_MESSAGE = '网络连接异常，请检查网络后重试'
const UNKNOWN_ERROR_MESSAGE = '请求失败，请稍后重试'
const AUTH_REQUIRED_MESSAGE = '请先登录后再继续'

function normalizeMessage(value: unknown): string {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nestedRecord(value: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(value)) return null
  return isRecord(value[key]) ? value[key] : null
}

function normalizeServerErrorMessage(status: number, data: unknown): string {
  const fallback = ERROR_MESSAGES[status] || `请求失败 (${status})`
  if (!data) return fallback

  if (typeof data === 'string') {
    const msg = normalizeMessage(data)
    return msg || fallback
  }

  if (isRecord(data)) {
    const errorObject = nestedRecord(data, 'error')
    const candidates = [
      errorObject?.message,
      data.error,
      data.message,
    ]
    for (const item of candidates) {
      const msg = normalizeMessage(item)
      if (msg) return msg
    }
  }

  return fallback
}

function normalizeNetworkErrorMessage(error: unknown): string {
  if (!error) return NETWORK_ERROR_MESSAGE
  const message = error instanceof Error ? error.message : normalizeMessage(error)
  const text = normalizeMessage(message).toLowerCase()
  if (!text) return NETWORK_ERROR_MESSAGE
  if (
    text.includes('failed to fetch')
    || text.includes('networkerror')
    || text.includes('network error')
    || text.includes('load failed')
    || text.includes('network request failed')
  ) {
    return NETWORK_ERROR_MESSAGE
  }
  return normalizeMessage(message) || UNKNOWN_ERROR_MESSAGE
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null)
  }
  return response.text().catch(() => '')
}

export function normalizeResponsePayload<T = unknown>(data: unknown, status = 200): ApiSuccess<T> {
  if (
    isRecord(data)
    && data.success === true
    && isRecord(data.data)
    && data.data.success === true
    && Object.prototype.hasOwnProperty.call(data.data, 'data')
  ) {
    return { success: true, status, data: data.data.data as T }
  }

  if (isRecord(data) && data.success === true) {
    const hasDataProperty = Object.prototype.hasOwnProperty.call(data, 'data')
    const envelopeData = hasDataProperty
      ? data.data
      : Object.fromEntries(Object.entries(data).filter(([key]) => !['success', 'status'].includes(key)))
    const hasEnvelopeFields = hasDataProperty || (isRecord(envelopeData) && Object.keys(envelopeData).length > 0)
    return {
      ...data,
      success: true,
      status,
      data: (hasEnvelopeFields ? envelopeData : null) as T
    }
  }

  return { success: true, status, data: data as T }
}

function isJsonBody(body: ApiRequestOptions['body']): boolean {
  if (body === undefined || body === null) return false
  if (typeof body === 'string') return false
  if (
    (typeof FormData === 'function' && body instanceof FormData)
    || (typeof URLSearchParams === 'function' && body instanceof URLSearchParams)
    || (typeof Blob === 'function' && body instanceof Blob)
    || (typeof ArrayBuffer === 'function' && body instanceof ArrayBuffer)
  ) {
    return false
  }
  return typeof body === 'object' || typeof body === 'boolean' || typeof body === 'number'
}

function createHeaders(url: string, input?: HeadersInit): Headers {
  const headers = new Headers(input)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  for (const [name, value] of Object.entries(getDiscoveryRequestHeaders(url))) {
    if (!headers.has(name)) headers.set(name, String(value))
  }
  return headers
}

function prepareRequestBody(body: ApiRequestOptions['body']): BodyInit | undefined {
  if (body === undefined || body === null) return undefined
  return isJsonBody(body) ? JSON.stringify(body) : body as BodyInit
}

function createAbortContext(callerSignal: AbortSignal | undefined, timeout: number) {
  const controller = new AbortController()
  let abortReason: AbortReason | undefined

  const abortFromCaller = () => {
    if (controller.signal.aborted) return
    abortReason = 'caller'
    controller.abort(callerSignal?.reason)
  }

  if (callerSignal?.aborted) {
    abortFromCaller()
  } else {
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true })
  }

  const timeoutId = setTimeout(() => {
    if (controller.signal.aborted) return
    abortReason = 'timeout'
    controller.abort()
  }, timeout)

  return {
    signal: controller.signal,
    getAbortReason: () => abortReason,
    cleanup() {
      clearTimeout(timeoutId)
      callerSignal?.removeEventListener('abort', abortFromCaller)
    }
  }
}

function abortedResponse(abortReason: AbortReason): ApiFailure {
  return {
    success: false,
    status: 0,
    error: '',
    aborted: true,
    abortReason,
    kind: 'abort'
  }
}

function maintenanceBlockedResponse(message = '站点维护中，当前操作暂不可用'): ApiFailure {
  return {
    success: false,
    error: message,
    status: 503,
    aborted: false,
    kind: 'maintenance'
  }
}

function hasAuthFailure(status: number, payload: unknown): boolean {
  return status === 401 || isAuthErrorCode(payload)
}

function readPayloadStatus(payload: unknown, fallback: number): number {
  if (!isRecord(payload)) return fallback
  const parsed = Number(payload.status)
  return Number.isInteger(parsed) && parsed >= 100 && parsed <= 599 ? parsed : fallback
}

function readPayloadErrorCode(payload: unknown): string {
  if (!isRecord(payload)) return ''
  const errorObject = nestedRecord(payload, 'error')
  return normalizeMessage(errorObject?.code || payload.code)
}

function readPayloadDetails(payload: unknown): unknown {
  if (!isRecord(payload)) return undefined
  const errorObject = nestedRecord(payload, 'error')
  return errorObject?.details ?? payload.details
}

function failureResponse(
  kind: ApiFailureKind,
  status: number,
  error: string,
  payload?: unknown
): ApiFailure {
  const errorCode = readPayloadErrorCode(payload)
  const details = readPayloadDetails(payload)
  return {
    success: false,
    status,
    error,
    aborted: false,
    kind,
    ...(errorCode ? { errorCode } : {}),
    ...(details === undefined ? {} : { details })
  }
}

function sessionChangedResponse(): ApiFailure {
  return { ...abortedResponse('caller'), errorCode: 'SESSION_CHANGED' }
}

/**
 * 发起 HTTP 请求
 */
async function request<T = unknown>(url: string, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
  const method = (options.method || 'GET').toUpperCase()
  const maintenanceBlock = getMaintenanceRequestBlock(method, url)
  if (maintenanceBlock) {
    return maintenanceBlockedResponse(maintenanceBlock.message)
  }

  const base = url.startsWith('/api/image')
    ? IMAGE_API_BASE
    : (url.startsWith('/api/auth') ? AUTH_API_BASE : API_BASE)
  const fullUrl = url.startsWith('http') ? url : `${base}${url}`

  const authMode = options.auth || 'required'
  const session = authMode === 'none' ? null : captureAuthSession()
  const token = session?.token
  if (session?.changed) return sessionChangedResponse()
  // 私有接口在客户端会话边界内失败，避免匿名请求进入后端。
  if (authMode === 'required' && !token) {
    return failureResponse('http', 401, AUTH_REQUIRED_MESSAGE, { code: 'AUTH_REQUIRED' })
  }

  const jsonBody = isJsonBody(options.body)
  const headers = createHeaders(url, options.headers)
  if (jsonBody && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  // 添加认证头
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const timeout = options.timeout ?? TIMEOUT
  const abortContext = createAbortContext(options.signal, timeout)

  try {
    if (abortContext.signal.aborted) {
      return abortedResponse(abortContext.getAbortReason() || 'caller')
    }
    const response = await fetch(fullUrl, {
      method,
      headers,
      body: prepareRequestBody(options.body),
      signal: abortContext.signal,
      credentials: 'include'
    })

    if (session && !isAuthSessionCurrent(session)) return sessionChangedResponse()
    if (response.ok && options.responseType === 'blob' && !response.headers.get('content-type')?.includes('application/json')) {
      const blob = await response.blob()
      if (session && !isAuthSessionCurrent(session)) return sessionChangedResponse()
      return { success: true, status: response.status, data: { blob, disposition: response.headers.get('content-disposition') || '' } as T }
    }
    // 解析响应
    const data = await parseResponseBody(response)

    if (session && !isAuthSessionCurrent(session)) return sessionChangedResponse()

    // 检查响应状态
    if (!response.ok) {
      if (token && hasAuthFailure(response.status, data)) {
        emitAuthExpired({ source: 'request', url, method, reason: 'server_unauthorized', status: response.status }, session)
      }
      return failureResponse('http', response.status, normalizeServerErrorMessage(response.status, data), data)
    }

    if (isRecord(data) && data.success === false) {
      const payloadStatus = readPayloadStatus(data, response.status)
      if (token && hasAuthFailure(payloadStatus, data)) {
        emitAuthExpired({ source: 'request', url, method, reason: 'payload_auth_error', status: payloadStatus }, session)
      }
      return failureResponse('http', payloadStatus, normalizeServerErrorMessage(payloadStatus, data), data)
    }

    if (options.responseType === 'blob') return failureResponse('contract', response.status, '导出文件响应无效，请重试')
    return normalizeResponsePayload<T>(data, response.status)
  } catch (error) {
    if (session && !isAuthSessionCurrent(session)) return sessionChangedResponse()
    if (abortContext.signal.aborted) {
      return abortedResponse(abortContext.getAbortReason() || 'caller')
    }
    return failureResponse('network', 0, normalizeNetworkErrorMessage(error))
  } finally {
    abortContext.cleanup()
  }
}

/**
 * 打开需要 Bearer 鉴权的流式响应。与普通 request() 不同，这里不设置固定超时，
 * 生命周期由调用方的 AbortSignal 和服务端心跳共同管理。
 */
async function openEventStream(url: string, { signal, headers: extraHeaders }: EventStreamOptions = {}): Promise<EventStreamResult> {
  const maintenanceBlock = getMaintenanceRequestBlock('GET', url)
  if (maintenanceBlock) return maintenanceBlockedResponse(maintenanceBlock.message)

  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`
  const session = captureAuthSession()
  const token = session.token
  if (session.changed) return sessionChangedResponse()
  if (!token) return failureResponse('http', 401, AUTH_REQUIRED_MESSAGE, { code: 'AUTH_REQUIRED' })

  try {
    const headers = new Headers(extraHeaders)
    headers.set('Accept', 'text/event-stream')
    headers.set('Authorization', `Bearer ${token}`)
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal
    })

    if (!isAuthSessionCurrent(session)) {
      void response.body?.cancel().catch(() => {})
      return sessionChangedResponse()
    }
    if (!response.ok) {
      const data = await parseResponseBody(response)
      if (!isAuthSessionCurrent(session)) return sessionChangedResponse()
      if (hasAuthFailure(response.status, data)) {
        emitAuthExpired({ source: 'event-stream', url, method: 'GET', reason: 'server_unauthorized', status: response.status }, session)
      }
      return failureResponse('http', response.status, normalizeServerErrorMessage(response.status, data), data)
    }
    if (!response.body) return failureResponse('network', 0, '浏览器不支持消息实时连接')
    return { success: true, status: response.status, response }
  } catch (error) {
    if (!isAuthSessionCurrent(session)) return sessionChangedResponse()
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      return abortedResponse('caller')
    }
    return failureResponse('network', 0, normalizeNetworkErrorMessage(error))
  }
}

/**
 * GET 请求
 */
function get<T = unknown>(url: string, options: ApiReadOptions = {}): Promise<ApiResult<T>> {
  return request<T>(url, { ...options, method: 'GET' })
}

/**
 * POST 请求
 */
function post<TResponse = unknown, TBody extends ApiRequestOptions['body'] = JsonValue>(
  url: string,
  body?: TBody,
  options: ApiReadOptions = {}
): Promise<ApiResult<TResponse>> {
  return request<TResponse>(url, { ...options, method: 'POST', body })
}

/**
 * PUT 请求
 */
function put<TResponse = unknown, TBody extends ApiRequestOptions['body'] = JsonValue>(
  url: string,
  body: TBody,
  options: ApiReadOptions = {}
): Promise<ApiResult<TResponse>> {
  return request<TResponse>(url, { ...options, method: 'PUT', body })
}

/**
 * DELETE 请求
 */
function del<T = unknown>(url: string, options: ApiReadOptions = {}): Promise<ApiResult<T>> {
  return request<T>(url, { ...options, method: 'DELETE' })
}

/**
 * 上传文件（FormData 请求）
 */
async function upload<T = unknown>(url: string, formData: FormData, options: ApiReadOptions = {}): Promise<ApiResult<T>> {
  return request<T>(url, {
    ...options,
    method: 'POST',
    body: formData,
    timeout: options.timeout ?? 60000
  })
}

function download(url: string, options: ApiReadOptions = {}): Promise<ApiResult<{ blob: Blob; disposition: string }>> {
  return request(url, { ...options, method: 'GET', responseType: 'blob' })
}

/**
 * 并发请求
 */
async function all<T extends readonly unknown[]>(requests: T): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
  return Promise.all(requests)
}

export const api = {
  request,
  get,
  post,
  put,
  delete: del,
  upload,
  openEventStream,
  download,
  all,
  BASE_URL: API_BASE
}
