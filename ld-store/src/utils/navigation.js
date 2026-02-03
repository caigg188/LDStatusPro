// Navigation-related utilities
// Keeps redirect targets constrained to same-origin routes to avoid open-redirect issues.

/**
 * Sanitize a redirect target so it only points to an in-app path.
 * - Allows absolute or relative paths within the current origin.
 * - Rejects external origins and non-http(s) schemes.
 * - Returns a safe fallback (`/`) when invalid.
 *
 * @param {string|undefined|null} target Raw redirect value (e.g., from query params)
 * @param {string} fallback Safe default path
 * @returns {string} Sanitized path beginning with `/`
 */
export function sanitizeRedirect(target, fallback = '/') {
  if (!target || typeof target !== 'string') return fallback

  try {
    // Build URL relative to current origin so relative paths are supported.
    const url = new URL(target, window.location.origin)

    // Block external origins or unexpected protocols.
    if (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol)) {
      return fallback
    }

    // Normalize to path+search+hash so router can handle it without a full page reload.
    const path = url.pathname.startsWith('/') ? url.pathname : `/${url.pathname}`
    return `${path}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
