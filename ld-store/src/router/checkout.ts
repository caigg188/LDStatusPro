import type { RouteLocationNormalized } from 'vue-router'
import { fetchProductRequest } from '@/services/shop/catalogService'

export async function resolveCheckoutRoute(to: RouteLocationNormalized) {
  // A historical UUID alias must resolve to its original numeric pending key.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(to.params.productId))) return
  const result = await fetchProductRequest(String(to.params.productId))
  const id = result.success ? result.data.product.id : null
  if (!id) return { name: 'ProductDetail', params: { id: to.params.productId }, query: to.query, replace: true }
  if (String(id) !== String(to.params.productId)) return { name: 'OrderConfirm', params: { productId: id }, query: to.query, hash: to.hash, replace: true }
}
