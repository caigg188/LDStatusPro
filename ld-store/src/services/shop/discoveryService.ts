import { normalizeResourceId } from '@/utils/resourceId'
import { api, type JsonValue } from '@/utils/api'
import { validateApiResult } from '@/contracts/apiContract'
import {
  DiscoveryEventResponseSchema,
  DiscoveryPreferenceResponseSchema,
  SearchSuggestionsResponseSchema
} from '@/contracts/catalog'

const TOKEN_STORAGE_KEY = 'ld-store-discovery-tokens-v2'
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const MAX_STORED_TOKENS = 100
const MAX_EVENT_BATCH = 50

type DiscoveryEventType = 'impression' | 'click' | 'search_submit' | 'search_zero_result' | 'search_reformulation'

interface DiscoveryProduct {
  id?: unknown
  discoveryToken?: unknown
}

interface DiscoveryEventOptions {
  discoveryToken?: string
  searchToken?: string
  query?: string
}

interface DiscoveryEvent {
  [key: string]: JsonValue
  eventId: string
  type: DiscoveryEventType
  occurredAt: string
}

interface StoredDiscoveryToken {
  token: string
  expiresAt: number
}

let eventQueue: DiscoveryEvent[] = []
let flushTimer: number | null = null
let flushing = false

function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function discoveryTokenFor(product: DiscoveryProduct | null | undefined): string {
  return String(product?.discoveryToken || '').trim()
}

function readTokenMap(): Record<string, StoredDiscoveryToken> {
  const sessionStorage = getSessionStorage()
  if (!sessionStorage) return {}
  try {
    const parsed = JSON.parse(sessionStorage.getItem(TOKEN_STORAGE_KEY) || '{}') as Record<string, StoredDiscoveryToken>
    const now = Date.now()
    return Object.fromEntries(Object.entries(parsed || {}).filter(([, entry]) => (
      entry && typeof entry.token === 'string' && Number(entry.expiresAt || 0) > now
    )))
  } catch {
    return {}
  }
}

function writeTokenMap(value: Record<string, StoredDiscoveryToken>): void {
  const sessionStorage = getSessionStorage()
  if (!sessionStorage) return
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Attribution is best-effort and must not interfere with navigation.
  }
}

export function rememberDiscoveryToken(product: DiscoveryProduct): string {
  const productId = normalizeResourceId(product?.id)
  const token = discoveryTokenFor(product)
  if (!productId || !token) return ''
  const entries = readTokenMap()
  entries[String(productId)] = { token, expiresAt: Date.now() + TOKEN_TTL_MS }
  const boundedEntries = Object.entries(entries)
    .sort((left, right) => Number(right[1].expiresAt || 0) - Number(left[1].expiresAt || 0))
    .slice(0, MAX_STORED_TOKENS)
  writeTokenMap(Object.fromEntries(boundedEntries))
  return token
}

export function getDiscoveryTokenForProduct(productId: string | number): string {
  return readTokenMap()[String(productId)]?.token || ''
}

export function clearDiscoveryTokenForProduct(productId: string | number): void {
  const entries = readTokenMap()
  delete entries[String(productId)]
  writeTokenMap(entries)
}

function eventId(): string {
  return typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : ''
}

async function flushDiscoveryEvents(retry = true): Promise<void> {
  if (flushing || eventQueue.length === 0) return
  flushing = true
  const events = eventQueue.splice(0, MAX_EVENT_BATCH)
  try {
    const result = validateApiResult(
      await api.post('/api/shop/discovery/events', { events }, { auth: 'optional', timeout: 5000 }),
      DiscoveryEventResponseSchema,
      { endpoint: '/api/shop/discovery/events', schemaName: 'DiscoveryEventResponse' }
    )
    if (!result?.success && retry) {
      eventQueue = [...events, ...eventQueue].slice(0, 200)
      window.setTimeout(() => void flushDiscoveryEvents(false), 1000)
    }
  } catch {
    if (retry) eventQueue = [...events, ...eventQueue].slice(0, 200)
  } finally {
    flushing = false
    if (eventQueue.length > 0 && !flushTimer) {
      flushTimer = window.setTimeout(() => {
        flushTimer = null
        void flushDiscoveryEvents()
      }, 500)
    }
  }
}

export function queueDiscoveryEvent(type: DiscoveryEventType, options: DiscoveryEventOptions = {}): void {
  const id = eventId()
  if (!id) return
  const event: DiscoveryEvent = {
    eventId: id,
    type,
    occurredAt: new Date().toISOString()
  }
  if (options.discoveryToken) event.discoveryToken = options.discoveryToken
  if (options.searchToken) event.searchToken = options.searchToken
  if (options.query) event.query = String(options.query).slice(0, 500)
  eventQueue.push(event)
  if (eventQueue.length >= MAX_EVENT_BATCH) {
    void flushDiscoveryEvents()
  } else if (!flushTimer) {
    flushTimer = window.setTimeout(() => {
      flushTimer = null
      void flushDiscoveryEvents()
    }, 500)
  }
}

export function recordProductImpression(product: DiscoveryProduct): void {
  const token = discoveryTokenFor(product)
  if (token) queueDiscoveryEvent('impression', { discoveryToken: token })
}

export function recordProductClick(product: DiscoveryProduct): void {
  const token = rememberDiscoveryToken(product)
  if (token) queueDiscoveryEvent('click', { discoveryToken: token })
}

export function recordSearchOutcome({
  query,
  products = [],
  searchToken,
  zeroResult = false,
  reformulation = false
}: {
  query: string
  products?: DiscoveryProduct[]
  searchToken?: string
  zeroResult?: boolean
  reformulation?: boolean
}): void {
  const token = discoveryTokenFor(products[0])
  if (reformulation) queueDiscoveryEvent('search_reformulation', { query, discoveryToken: token, searchToken })
  queueDiscoveryEvent('search_submit', { query, discoveryToken: token, searchToken })
  if (zeroResult) queueDiscoveryEvent('search_zero_result', { query, searchToken })
}

export async function fetchSearchSuggestionsRequest(query: string, limit = 8) {
  const params = new URLSearchParams({ q: String(query || '').trim(), limit: String(limit) })
  return validateApiResult(
    await api.get(`/api/shop/search/suggestions?${params.toString()}`, { auth: 'optional' }),
    SearchSuggestionsResponseSchema,
    { endpoint: '/api/shop/search/suggestions', schemaName: 'SearchSuggestionsResponse' }
  )
}

export async function fetchDiscoveryPreferenceRequest() {
  return validateApiResult(
    await api.get('/api/shop/discovery/preferences', { auth: 'required' }),
    DiscoveryPreferenceResponseSchema,
    { endpoint: '/api/shop/discovery/preferences', schemaName: 'DiscoveryPreferenceResponse' }
  )
}

export async function updateDiscoveryPreferenceRequest(personalizationEnabled: boolean) {
  return validateApiResult(
    await api.put('/api/shop/discovery/preferences', { personalizationEnabled: !!personalizationEnabled }, { auth: 'required' }),
    DiscoveryPreferenceResponseSchema,
    { endpoint: '/api/shop/discovery/preferences', schemaName: 'DiscoveryPreferenceResponse' }
  )
}
