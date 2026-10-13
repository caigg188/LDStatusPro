import { describe, expect, it } from 'vitest'
import { ReadableStream } from 'node:stream/web'
import { TextEncoder } from 'node:util'
import { consumeSseStream } from '../src/utils/sse'

function streamChunks(chunks) {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    }
  })
}

describe('SSE 流解析', () => {
  it('支持分片、心跳注释和多行 data', async () => {
    const events = []
    let activityCount = 0
    const stream = streamChunks([
      ': heartbeat\n\nid: 1\nevent: summary.',
      'updated\ndata: {"totalUnread":2,\n',
      'data: "systemUnread":1}\n\n',
      'event: buy-message.created\ndata: {"sessionId":9,"messageId":12}\n\n'
    ])

    await consumeSseStream(stream, {
      onEvent: event => events.push(event),
      onActivity: () => { activityCount += 1 }
    })

    expect(events).toEqual([
      {
        event: 'summary.updated',
        id: '1',
        data: '{"totalUnread":2,\n"systemUnread":1}'
      },
      {
        event: 'buy-message.created',
        id: '1',
        data: '{"sessionId":9,"messageId":12}'
      }
    ])
    expect(activityCount).toBe(4)
  })
})

it('does not dispatch a buffered event after cancellation while a read is pending', async () => {
  const encoder = new TextEncoder()
  const controller = new globalThis.AbortController()
  const events = []
  let next
  let sent = false
  const reader = {
    read: () => {
      if (!sent) { sent = true; return Promise.resolve({ done: false, value: encoder.encode('event: summary.updated\ndata: {"totalUnread":9}\n') }) }
      return new Promise(resolve => { next = resolve })
    },
    cancel: () => Promise.resolve(), releaseLock: () => {}
  }
  const consuming = consumeSseStream({ getReader: () => reader }, { signal: controller.signal, onEvent: event => events.push(event) })
  await Promise.resolve()
  await Promise.resolve()
  controller.abort()
  next({ done: false, value: encoder.encode('\n') })
  await consuming
  expect(events).toEqual([])
})
it('stops processing the remaining events in a chunk when its session is cancelled', async () => {
  const controller = new globalThis.AbortController()
  const events = []
  await consumeSseStream(streamChunks(['data: first\n\ndata: old-account\n\n']), {
    signal: controller.signal,
    onEvent: event => { events.push(event.data); controller.abort() }
  })
  expect(events).toEqual(['first'])
})
