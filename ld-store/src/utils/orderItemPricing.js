function toMoneyNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export function resolveOrderItemPricing(order) {
  const quantityRaw = Number(order?.quantity ?? order?.productQuantity ?? 1)
  const quantity = Number.isInteger(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1

  const snapshotPrice = toMoneyNumber(order?.product?.price)
  const originalPrice = toMoneyNumber(order?.originalPrice)
  const originalUnitPrice = snapshotPrice > 0
    ? snapshotPrice
    : (originalPrice > 0 ? originalPrice / quantity : 0)

  const rawDiscount = Number(order?.product?.discount)
  const productDiscount = Number.isFinite(rawDiscount) && rawDiscount > 0 ? rawDiscount : 1
  const productSubtotal = toMoneyNumber(order?.productSubtotal ?? order?.amount ?? 0)

  const hasListedDiscount = productDiscount < 1
  const hasSubtotalDiscount = originalPrice > 0
    && productSubtotal > 0
    && Math.abs(originalPrice - productSubtotal) > 0.009
  const hasProductDiscount = hasListedDiscount || hasSubtotalDiscount

  const discountedUnitPrice = hasListedDiscount
    ? originalUnitPrice * productDiscount
    : (hasSubtotalDiscount ? productSubtotal / quantity : originalUnitPrice)

  return {
    quantity,
    originalUnitPrice,
    discountedUnitPrice,
    hasProductDiscount,
    productSubtotal
  }
}
