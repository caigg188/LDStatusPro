import { api } from '@/utils/api'
import { validateApiResult } from '@/contracts/apiContract'
import { MerchantProfileResponseSchema } from '@/contracts/catalog'
import { serviceFailure, withServiceFailure } from '@/services/serviceContract'
import { merchantIdentityQuery, type MerchantIdentity } from '@/utils/merchantIdentity'

export function fetchMerchantProfileRequest(username: string, options: MerchantIdentity & { page?: number; signal?: AbortSignal } = {}) {
  const safeUsername = String(username || '').trim()
  if (!safeUsername) return Promise.resolve(serviceFailure(undefined, '商家用户名无效'))
  const query = new URLSearchParams(merchantIdentityQuery(options))
  if (options.page) query.set('page', String(options.page))
  return withServiceFailure(async () => validateApiResult(
    await api.get(`/api/shop/merchants/${encodeURIComponent(safeUsername)}${query.size ? `?${query}` : ''}`, { auth: 'optional', signal: options.signal }),
    MerchantProfileResponseSchema,
    { endpoint: '/api/shop/merchants/:username', schemaName: 'MerchantProfileResponse' }
  ), '加载商家主页失败，请稍后重试')
}
