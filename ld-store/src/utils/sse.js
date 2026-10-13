function dispatchEvent(state, onEvent) {
  if (state.data.length === 0) return
  onEvent({ event: state.event || 'message', data: state.data.join('\n'), id: state.id })
  state.event = ''
  state.data = []
}

function processLine(line, state, onEvent) {
  if (line === '') {
    dispatchEvent(state, onEvent)
    return
  }
  if (line.startsWith(':')) return

  const separator = line.indexOf(':')
  const field = separator >= 0 ? line.slice(0, separator) : line
  let value = separator >= 0 ? line.slice(separator + 1) : ''
  if (value.startsWith(' ')) value = value.slice(1)

  if (field === 'event') state.event = value
  else if (field === 'data') state.data.push(value)
  else if (field === 'id' && !value.includes('\0')) state.id = value
}

export async function consumeSseStream(stream, { onEvent, onActivity, signal } = {}) {
  if (!stream?.getReader || typeof onEvent !== 'function') return
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const state = { event: '', data: [], id: '' }
  const handleAbort = () => { void reader.cancel() }
  let buffer = ''

  signal?.addEventListener('abort', handleAbort, { once: true })
  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read()
      if (done || signal?.aborted) break
      onActivity?.()
      buffer += decoder.decode(value, { stream: true })
      let newline = buffer.indexOf('\n')
      while (newline >= 0 && !signal?.aborted) {
        let line = buffer.slice(0, newline)
        buffer = buffer.slice(newline + 1)
        if (line.endsWith('\r')) line = line.slice(0, -1)
        processLine(line, state, onEvent)
        newline = buffer.indexOf('\n')
      }
    }
    if (signal?.aborted) return
    buffer += decoder.decode()
    if (buffer) processLine(buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer, state, onEvent)
    dispatchEvent(state, onEvent)
  } finally {
    signal?.removeEventListener('abort', handleAbort)
    reader.releaseLock()
  }
}
