import { api } from './api'
import { applyAccountSanction, clearAccountSanction } from './accountSanction'
import { captureAuthSession, isAuthSessionCurrent } from './auth'

let latestRequest = 0

export async function refreshAccountStatus() {
  const session = captureAuthSession()
  if (!session.token) return
  const request = ++latestRequest
  const result = await api.get('/api/shop/account/status', { auth: 'required' })
  if (!result.success || request !== latestRequest || !isAuthSessionCurrent(session)) return result
  const status = result.data && typeof result.data === 'object' ? result.data.accountStatus : null
  if (typeof status?.suspended !== 'boolean') return result
  if (status && status.suspended) {
    applyAccountSanction(status, 'status')
  } else {
    clearAccountSanction()
  }
  return result
}
