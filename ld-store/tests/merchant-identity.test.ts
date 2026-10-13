import { afterEach, expect, it, vi } from 'vitest'
import { merchantProfilePath } from '../src/utils/merchantIdentity'
import { fetchMerchantProfileRequest } from '../src/services/shop/catalogService'
import { getCouponUsePath } from '../src/services/shop/couponService'
import { api } from '../src/utils/api'

vi.mock('../src/utils/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
afterEach(() => { vi.clearAllMocks() })

it('keeps same-name merchants distinct by site and forum user id', () => {
  expect(merchantProfilePath({ username: 'name with space', userId: 123, site: 'LINUX.DO' }))
    .toBe('/merchant/name%20with%20space?site=linux.do&userId=123')
  expect(merchantProfilePath({ username: 'same', userId: 123, site: 'idcflare.com' }))
    .toBe('/merchant/same?site=idcflare.com&userId=123')
  expect(merchantProfilePath({ username: 'legacy' })).toBe('/merchant/legacy')
  expect(merchantProfilePath({ username: '' })).toBe('')
  expect(getCouponUsePath({ sellerUsername: 'renamed', sellerSite: 'linux.do', sellerUserId: 123 }))
    .toBe('/merchant/renamed?site=linux.do&userId=123')
  expect(getCouponUsePath({ scopeType: 'product', productId: 456 })).toBe('/product/456')
})

it('sends the requested identity to the profile API while retaining old username URLs', async () => {
  vi.mocked(api.get).mockResolvedValue({ success: false, status: 404, error: 'unavailable', kind: 'http' })
  await fetchMerchantProfileRequest('old-name', { userId: 123, site: 'idcflare.com' })
  expect(api.get).toHaveBeenLastCalledWith('/api/shop/merchants/old-name?site=idcflare.com&userId=123', { auth: 'optional' })
  await fetchMerchantProfileRequest('old-name')
  expect(api.get).toHaveBeenLastCalledWith('/api/shop/merchants/old-name', { auth: 'optional' })
})
