import { ref } from 'vue'
import type { BuyOrder, Order } from '@/contracts/commerce'
import type { ApiResult } from '@/utils/api'

export type OrderListItem = (Order | BuyOrder) & Record<string, unknown>

export interface OrderListQuery extends Record<string, unknown> {
  page?: number
  pageSize?: number
  signal?: AbortSignal
}

interface OrderListPage {
  orders: OrderListItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

interface OrderListControllerOptions {
  pageSize?: number
  buildQuery: (page: number, signal: AbortSignal) => OrderListQuery
  fetchPage: (query: OrderListQuery) => Promise<ApiResult<OrderListPage>>
  onError?: (message: string) => void
}

export function useOrderListController(options: OrderListControllerOptions) {
  const pageSize = options.pageSize ?? 20
  const loading = ref(true)
  const loadingMore = ref(false)
  const orders = ref<OrderListItem[]>([])
  const page = ref(1)
  const hasMore = ref(false)
  const error = ref('')
  const pagination = ref({ page: 1, pageSize, total: 0, totalPages: 1 })
  let requestId = 0
  let controller: AbortController | null = null

  async function load(append = false): Promise<ApiResult<OrderListPage> | null> {
    const requestPage = append ? page.value + 1 : page.value
    const currentRequestId = ++requestId
    controller?.abort('caller')
    controller = new AbortController()
    if (append) loadingMore.value = true
    else loading.value = true
    error.value = ''

    try {
      const query = options.buildQuery(requestPage, controller.signal)
      const result = await options.fetchPage(query)
      if (currentRequestId !== requestId || controller.signal.aborted) return null
      if (!result.success) {
        error.value = result.error || '加载订单失败'
        options.onError?.(error.value)
        return result
      }

      const list = Array.isArray(result.data.orders) ? result.data.orders : []
      const responsePagination = result.data.pagination
      const totalPages = Math.max(1, Number(responsePagination?.totalPages || 1))
      pagination.value = {
        page: Number(responsePagination?.page || page.value || 1),
        pageSize: Number(responsePagination?.pageSize || pageSize),
        total: Number(responsePagination?.total || list.length),
        totalPages
      }
      page.value = Number(responsePagination?.page || requestPage)
      hasMore.value = page.value < totalPages
      orders.value = append ? [...orders.value, ...list] : list
      return result
    } catch (cause) {
      if (currentRequestId !== requestId || controller.signal.aborted) return null
      error.value = cause instanceof Error ? cause.message : '加载订单失败'
      options.onError?.(error.value)
      return null
    } finally {
      if (currentRequestId === requestId) {
        loading.value = false
        loadingMore.value = false
      }
    }
  }

  async function loadMore() {
    if (loading.value || loadingMore.value || !hasMore.value) return null
    return load(true)
  }

  function reset(nextPage = 1) {
    page.value = Math.max(1, Math.trunc(nextPage) || 1)
    hasMore.value = false
    error.value = ''
  }

  function stop() {
    requestId += 1
    controller?.abort('caller')
    controller = null
    loading.value = false
    loadingMore.value = false
  }

  return { loading, loadingMore, orders, page, hasMore, error, pagination, load, loadMore, reset, stop }
}
