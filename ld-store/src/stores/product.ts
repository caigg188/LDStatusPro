import { useSessionScope } from '@/composables/useSessionScope'
import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Product } from '@/contracts/catalog'
import {
  addFavoriteRequest,
  blockProductRequest,
  createProductCommentReplyRequest,
  createProductCommentRequest,
  deleteProductCommentRequest,
  fetchBlockedProductsRequest,
  fetchFavoritesRequest,
  fetchMyReportDetailRequest,
  fetchMyReportsRequest,
  fetchProductCommentRepliesRequest,
  fetchProductCommentsRequest,
  fetchProductRequest,
  getProductRestockSubscriptionStatusRequest,
  normalizeFavoritesOptions,
  removeFavoriteRequest,
  reportProductCommentRequest,
  reportProductRequest,
  subscribeProductRestockRequest,
  unblockProductRequest,
  voteProductCommentRequest
} from '@/services/shop/catalogService'
import { serviceFailure } from '@/services/serviceContract'
import { useCatalogStore } from '@/stores/catalog'

const DETAIL_CACHE_TTL = 60_000
type MutableProduct = Product & Record<string, unknown>

export const useProductStore = defineStore('product', () => {
  const favorites = ref<MutableProduct[]>([])
  const blockedProducts = ref<MutableProduct[]>([])
  const blockedProductIds = ref(new Set<string>())
  const favoritesLoading = ref(false)
  const blocksLoading = ref(false)
  const favoritesError = ref('')
  const blocksError = ref('')
  const detailError = ref('')
  const detailCache = new Map<string, { data: MutableProduct; time: number }>()
  let favoritesRequestId = 0
  let blocksRequestId = 0

  const session = useSessionScope(() => {
    favoritesRequestId++; blocksRequestId++
    favorites.value = []; blockedProducts.value = []; blockedProductIds.value = new Set()
    detailCache.clear()
    favoritesLoading.value = false; blocksLoading.value = false
    favoritesError.value = ''; blocksError.value = ''; detailError.value = ''
  })

  async function fetchProduct(id: string | number, force = false) {
    const key = String(id)
    const cached = detailCache.get(key)
    if (!force && cached && Date.now() - cached.time < DETAIL_CACHE_TTL) {
      detailError.value = ''
      return { success: true as const, status: 200, data: { product: cached.data } }
    }

    try {
      const result = await session.run(() => fetchProductRequest(id))
      if (session.isStale(result)) return result
      if (result.success) {
        detailCache.set(key, { data: result.data.product as MutableProduct, time: Date.now() })
        detailError.value = ''
      } else {
        detailError.value = result.error || '加载物品详情失败，请稍后重试'
      }
      return result
    } catch (error) {
      const failure = serviceFailure(error, '加载物品详情失败，请稍后重试')
      detailError.value = failure.error
      return failure
    }
  }

  function invalidateProduct(id: string | number) {
    detailCache.delete(String(id))
  }

  function clearDetailCache() {
    detailCache.clear()
  }

  function setProductFavoriteState(productId: string | number, favorited: boolean) {
    const id = String(productId)
    const cached = detailCache.get(id)
    if (cached) cached.data.isFavorited = Boolean(favorited)
    favorites.value = favorites.value.map(product => String(product.id) === id ? { ...product, isFavorited: Boolean(favorited) } : product)
    useCatalogStore().setProductFlag(productId, 'isFavorited', Boolean(favorited))
  }

  function setProductBlockedState(productId: string | number, blocked: boolean) {
    const id = String(productId)
    const nextIds = new Set(blockedProductIds.value)
    if (blocked) {
      nextIds.add(id)
      favorites.value = favorites.value.filter(item => String(item.id) !== id)
      useCatalogStore().removeProductFromVisibleLists(productId)
    } else {
      nextIds.delete(id)
      blockedProducts.value = blockedProducts.value.filter(item => String(item.id) !== id)
    }
    blockedProductIds.value = nextIds
    invalidateProduct(productId)
  }

  function isProductBlocked(productId: string | number) {
    return blockedProductIds.value.has(String(productId))
  }

  async function addFavorite(productId: string | number) {
    const result = await session.run(() => addFavoriteRequest(productId))
    if (session.isStale(result)) return result
    if (result.success) setProductFavoriteState(productId, true)
    return result
  }

  async function removeFavorite(productId: string | number) {
    const result = await session.run(() => removeFavoriteRequest(productId))
    if (session.isStale(result)) return result
    if (result.success) {
      setProductFavoriteState(productId, false)
      favorites.value = favorites.value.filter(item => String(item.id) !== String(productId))
    }
    return result
  }

  async function blockProduct(productId: string | number) {
    const result = await session.run(() => blockProductRequest(productId))
    if (session.isStale(result)) return result
    if (result.success) {
      setProductFavoriteState(productId, false)
      setProductBlockedState(productId, true)
    }
    return result
  }

  async function unblockProduct(productId: string | number) {
    const result = await session.run(() => unblockProductRequest(productId))
    if (session.isStale(result)) return result
    if (result.success) setProductBlockedState(productId, false)
    return result
  }

  async function fetchFavorites(options: Parameters<typeof normalizeFavoritesOptions>[0] = {}) {
    const requestId = ++favoritesRequestId
    favoritesLoading.value = true
    try {
      const result = await session.run(() => fetchFavoritesRequest(normalizeFavoritesOptions(options)))
      if (session.isStale(result)) return result
      if (requestId === favoritesRequestId) {
        if (result.success) {
          favorites.value = result.data.products as MutableProduct[]
          favoritesError.value = ''
        } else {
          favoritesError.value = result.error || '加载收藏失败，请稍后重试'
        }
      }
      return result
    } catch (error) {
      const failure = serviceFailure(error, '加载收藏失败，请稍后重试')
      if (requestId === favoritesRequestId) favoritesError.value = failure.error
      return failure
    } finally {
      if (requestId === favoritesRequestId) favoritesLoading.value = false
    }
  }

  async function fetchBlocked(options: Parameters<typeof normalizeFavoritesOptions>[0] = {}) {
    const requestId = ++blocksRequestId
    blocksLoading.value = true
    try {
      const result = await session.run(() => fetchBlockedProductsRequest(normalizeFavoritesOptions(options)))
      if (session.isStale(result)) return result
      if (requestId === blocksRequestId) {
        if (result.success) {
          blockedProducts.value = result.data.products as MutableProduct[]
          blockedProductIds.value = new Set([
            ...(Number(normalizeFavoritesOptions(options).page || 1) > 1 ? blockedProductIds.value : []),
            ...result.data.products.map(item => String(item.id))
          ])
          blocksError.value = ''
        } else {
          blocksError.value = result.error || '加载屏蔽物品失败，请稍后重试'
        }
      }
      return result
    } catch (error) {
      const failure = serviceFailure(error, '加载屏蔽物品失败，请稍后重试')
      if (requestId === blocksRequestId) blocksError.value = failure.error
      return failure
    } finally {
      if (requestId === blocksRequestId) blocksLoading.value = false
    }
  }

  return {
    favorites,
    blockedProducts,
    blockedProductIds,
    favoritesLoading,
    blocksLoading,
    favoritesError,
    blocksError,
    detailError,
    fetchProduct,
    invalidateProduct,
    clearDetailCache,
    reportProduct: reportProductRequest,
    fetchMyReports: fetchMyReportsRequest,
    fetchMyReportDetail: fetchMyReportDetailRequest,
    fetchProductComments: fetchProductCommentsRequest,
    createProductComment: createProductCommentRequest,
    deleteProductComment: deleteProductCommentRequest,
    reportProductComment: reportProductCommentRequest,
    voteProductComment: voteProductCommentRequest,
    fetchProductCommentReplies: fetchProductCommentRepliesRequest,
    createProductCommentReply: createProductCommentReplyRequest,
    addFavorite,
    removeFavorite,
    blockProduct,
    unblockProduct,
    isProductBlocked,
    getProductRestockSubscriptionStatus: getProductRestockSubscriptionStatusRequest,
    subscribeProductRestock: subscribeProductRestockRequest,
    fetchFavorites,
    fetchBlocked
  }
})
