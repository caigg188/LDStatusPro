import { api } from './api'
import { applyAccountSanction, clearAccountSanction } from './accountSanction'

/**
 * 主动拉取账号状态：登录后与页面重新可见时调用。
 * 403 `ACCOUNT_SUSPENDED` 由 api.ts 统一解析，这里只处理“未受限”的回落。
 */
export async function refreshAccountStatus() {
  const result = await api.get('/api/shop/account/status', { auth: 'required' })
  if (!result.success) return result
  const status = result.data && typeof result.data === 'object' ? result.data.accountStatus : null
  if (status && status.suspended) {
    applyAccountSanction(status, 'status')
  } else {
    clearAccountSanction()
  }
  return result
}