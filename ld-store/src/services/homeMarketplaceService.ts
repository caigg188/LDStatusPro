import { api } from '@/utils/api'
import { validateApiResult } from '@/contracts/apiContract'
import {
  MarketplaceBuyRequestsResponseSchema,
  MarketplaceHotboardResponseSchema,
  MarketplaceShopsResponseSchema
} from '@/contracts/catalog'

interface MarketplaceListOptions {
  page?: number
  pageSize?: number
  tags?: string[]
  sortSeed?: string
  status?: string
  search?: string
  signal?: AbortSignal
}

interface MarketplaceSignalOptions {
  signal?: AbortSignal
}

export async function fetchMarketplaceShops({ page, pageSize, tags = [], search = '', signal }: MarketplaceListOptions = {}) {
  const params = new URLSearchParams({
    page: String(page || 1),
    pageSize: String(pageSize || 20)
  })
  for (const tag of tags) params.append('tag', tag)
  if (search.trim()) params.set('search', search.trim())
  return validateApiResult(
    await api.get(`/api/shops?${params.toString()}`, { auth: 'none', signal }),
    MarketplaceShopsResponseSchema,
    { endpoint: '/api/shops', schemaName: 'MarketplaceShopsResponse' }
  )
}

export async function fetchMarketplaceBuyRequests({ page, pageSize, status = '', search = '', sortSeed = '', signal }: MarketplaceListOptions = {}) {
  const params = new URLSearchParams({
    page: String(page || 1),
    pageSize: String(pageSize || 20),
    sort: 'random'
  })
  if (sortSeed) params.set('sortSeed', sortSeed)
  if (status) params.set('status', status)
  if (search.trim()) params.set('search', search.trim())
  return validateApiResult(
    await api.get(`/api/shop/buy-requests?${params.toString()}`, { auth: 'none', signal }),
    MarketplaceBuyRequestsResponseSchema,
    { endpoint: '/api/shop/buy-requests', schemaName: 'MarketplaceBuyRequestsResponse' }
  )
}

export async function fetchMarketplaceHotboard({ signal }: MarketplaceSignalOptions = {}) {
  return validateApiResult(
    await api.get('/api/shop/hotboard', { auth: 'required', signal }),
    MarketplaceHotboardResponseSchema,
    { endpoint: '/api/shop/hotboard', schemaName: 'MarketplaceHotboardResponse' }
  )
}
