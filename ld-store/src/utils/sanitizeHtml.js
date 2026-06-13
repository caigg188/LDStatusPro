import DOMPurify from 'dompurify'

const SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onmouseenter']
}

export function sanitizeHtml(value) {
  if (value === undefined || value === null) return ''
  return DOMPurify.sanitize(String(value), SANITIZE_OPTIONS)
}
