import { api } from '@/utils/api'
import { captureAuthSession, isAuthSessionCurrent } from '@/utils/auth'

const MAX_BATCH_EVENTS = 20
const MAX_BODY_BYTES = 32 * 1024
const EMPTY_BODY_BYTES = '{"events":[]}'.length
const encoder = new TextEncoder()
let pending

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function sendBatch(events, session) {
  // Reuse the same signed tickets so a partial failure can be retried safely.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!isAuthSessionCurrent(session)) return
    const result = await api.post('/api/shop/duo-plus/events', { events }, { timeout: 5000 })
    if (result.status === 429) {
      // The endpoint limits requests by minute. Pause this queue, including later batches.
      await wait(60_000)
      continue
    }
    if (result.success || (result.status > 0 && result.status < 500)) return
    if (attempt < 2) await wait(800 * (attempt + 1))
  }
}

async function flush(queue) {
  await wait(150)
  try {
    while (queue.batches.length && isAuthSessionCurrent(queue.session)) {
      const { events } = queue.batches.shift()
      await sendBatch(events, queue.session)
    }
  } finally {
    if (pending === queue) pending = undefined
  }
}

export function reportDuo(token, type, session = captureAuthSession()) {
  if (!session.token || !isAuthSessionCurrent(session) || typeof token !== 'string' || !token || token.length > 4096) return
  const start = pending?.session.revision !== session.revision
  if (start) {
    if (pending) pending.batches.length = 0
    pending = { session, batches: [] }
  }

  const event = { token, type }
  const bytes = encoder.encode(JSON.stringify(event)).byteLength
  const batch = pending.batches.at(-1)
  if (batch && batch.events.length < MAX_BATCH_EVENTS && batch.bytes + 1 + bytes <= MAX_BODY_BYTES) {
    batch.events.push(event)
    batch.bytes += 1 + bytes
  } else {
    pending.batches.push({ events: [event], bytes: EMPTY_BODY_BYTES + bytes })
  }
  if (start) void flush(pending)
}
