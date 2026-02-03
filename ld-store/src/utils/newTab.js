// Helpers to open links in a new tab with better compatibility on mobile browsers
// (especially Safari where window.open after async work can be blocked).

/**
 * Pre-open a blank tab/window during a user gesture.
 * If the browser blocks popups, this returns null.
 */
export function prepareNewTab() {
  try {
    const win = window.open('', '_blank')
    if (win) {
      // Avoid giving the new window access back to this one.
      win.opener = null
    }
    return win
  } catch (e) {
    return null
  }
}

/**
 * Navigate to the given URL, preferring to reuse a window opened by `prepareNewTab`
 * so the navigation stays tied to the original user gesture.
 * Falls back to best-effort methods and finally same-tab navigation.
 *
 * @param {string} url Target URL to open
 * @param {Window|null} preOpenedWindow Optional window from `prepareNewTab`
 * @returns {boolean} true if we likely opened in a new tab, false if we fell back to current tab
 */
export function openInNewTab(url, preOpenedWindow = null) {
  if (!url) return false

  // If we already have a window opened under user gesture, reuse it.
  if (preOpenedWindow && !preOpenedWindow.closed) {
    preOpenedWindow.location.href = url
    return true
  }

  // Try a direct window.open.
  const win = window.open(url, '_blank')
  if (win) {
    win.opener = null
    return true
  }

  // Fallback: create an anchor and click it programmatically.
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    anchor.style.position = 'absolute'
    anchor.style.left = '-9999px'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    return true
  } catch (e) {
    // ignore and continue to final fallback
  }

  // Final fallback: at least navigate in the current tab so the user is not stuck.
  window.location.href = url
  return false
}

/**
 * Close a pre-opened window if it ended up unused (e.g., when the flow aborted).
 */
export function cleanupPreparedTab(win) {
  if (win && !win.closed) {
    try {
      win.close()
    } catch (e) {
      // Ignore cleanup errors.
    }
  }
}
