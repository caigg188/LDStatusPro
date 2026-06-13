// Helpers to open payment in a popup window on desktop, falling back to new tab on mobile.

function isMobile() {
  return window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

const POPUP_WIDTH = 480
const POPUP_HEIGHT = 720

function getPopupFeatures() {
  const left = Math.max(0, Math.round((screen.width - POPUP_WIDTH) / 2))
  const top = Math.max(0, Math.round((screen.height - POPUP_HEIGHT) / 2))
  return `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},scrollbars=yes,resizable=yes`
}

// --- Legacy new-tab flow ---

export function prepareNewTab() {
  try {
    const win = window.open('', '_blank')
    if (win) win.opener = null
    return win
  } catch (e) {
    return null
  }
}

export function openInNewTab(url, preOpenedWindow = null) {
  if (!url) return false
  if (preOpenedWindow && !preOpenedWindow.closed) {
    preOpenedWindow.location.href = url
    return true
  }
  const win = window.open(url, '_blank')
  if (win) {
    win.opener = null
    return true
  }
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
    // ignore
  }
  window.location.href = url
  return false
}

export function cleanupPreparedTab(win) {
  if (win && !win.closed) {
    try { win.close() } catch (e) { /* ignore */ }
  }
}

// --- Popup payment flow ---

export function preparePaymentPopup() {
  if (isMobile()) return null
  try {
    const win = window.open('', 'ldc_payment', getPopupFeatures())
    if (win) win.opener = null
    return win
  } catch (e) {
    return null
  }
}

export function openPaymentPopup(url, preOpenedPopup = null) {
  if (!url) return { popup: null, isPopup: false }

  if (isMobile()) {
    openInNewTab(url)
    return { popup: null, isPopup: false }
  }

  if (preOpenedPopup && !preOpenedPopup.closed) {
    preOpenedPopup.location.href = url
    return { popup: preOpenedPopup, isPopup: true }
  }

  try {
    const win = window.open(url, 'ldc_payment', getPopupFeatures())
    if (win) {
      win.opener = null
      return { popup: win, isPopup: true }
    }
  } catch (e) {
    // Popup blocked, fall through
  }

  openInNewTab(url)
  return { popup: null, isPopup: false }
}

export function watchPaymentPopup(popup, onClosed) {
  if (!popup || popup.closed) {
    onClosed()
    return () => {}
  }

  const intervalId = setInterval(() => {
    if (popup.closed) {
      clearInterval(intervalId)
      clearTimeout(timeoutId)
      onClosed()
    }
  }, 500)

  const timeoutId = setTimeout(() => {
    clearInterval(intervalId)
  }, 10 * 60 * 1000)

  return () => {
    clearInterval(intervalId)
    clearTimeout(timeoutId)
  }
}
