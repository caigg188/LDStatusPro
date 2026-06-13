import { marked } from 'marked'
import { escapeHtml } from './security'
import { sanitizeHtml } from './sanitizeHtml'

marked.setOptions({
  breaks: true,
  gfm: true
})

export function renderAnnouncementContent(content, contentType = 'text') {
  const raw = String(content || '')
  if (!raw) return ''

  if (contentType === 'html') {
    return sanitizeHtml(raw)
  }

  if (contentType === 'markdown') {
    return sanitizeHtml(marked.parse(raw))
  }

  return escapeHtml(raw).replace(/\n/g, '<br>')
}
