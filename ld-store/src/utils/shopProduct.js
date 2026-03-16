export const SHOP_PRODUCT_TYPES = Object.freeze({
  NORMAL: 'normal',
  CDK: 'cdk',
  LINK: 'link',
  STORE: 'store'
})

function toSafeInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getRawSoldCountValue(source) {
  const raw = source?.sold_count
    ?? source?.soldCount
    ?? source?.product?.sold_count
    ?? source?.product?.soldCount
  if (raw === null || raw === undefined || raw === '') return 0
  return Math.max(0, toSafeInt(raw, 0))
}

export function normalizeProductType(type, fallback = SHOP_PRODUCT_TYPES.NORMAL) {
  const normalized = String(type || '').trim().toLowerCase()
  if (Object.values(SHOP_PRODUCT_TYPES).includes(normalized)) {
    return normalized
  }
  return fallback
}

export function getProductType(source, fallback = SHOP_PRODUCT_TYPES.NORMAL) {
  return normalizeProductType(
    source?.product_type
      ?? source?.type
      ?? source?.productType
      ?? source?.product?.product_type
      ?? source?.product?.type
      ?? source?.product?.productType,
    fallback
  )
}

export function isCdkProduct(source) {
  return getProductType(source) === SHOP_PRODUCT_TYPES.CDK
}

export function isNormalProduct(source) {
  return getProductType(source) === SHOP_PRODUCT_TYPES.NORMAL
}

export function isLegacyLinkProduct(source) {
  return getProductType(source) === SHOP_PRODUCT_TYPES.LINK
}

export function isStoreProduct(source) {
  return getProductType(source) === SHOP_PRODUCT_TYPES.STORE
}

export function isPlatformOrderProduct(source) {
  const type = getProductType(source)
  return type === SHOP_PRODUCT_TYPES.NORMAL || type === SHOP_PRODUCT_TYPES.CDK
}

export function getRawStockValue(source) {
  const raw = source?.stock ?? source?.product?.stock
  if (raw === null || raw === undefined || raw === '') return 0
  return toSafeInt(raw, 0)
}

export function getAvailableStock(source) {
  const directValue = source?.availableStock
    ?? source?.available_stock
    ?? source?.product?.availableStock
    ?? source?.product?.available_stock

  if (directValue !== null && directValue !== undefined && directValue !== '') {
    return Math.max(0, toSafeInt(directValue, 0))
  }

  const cdkAvailable = source?.cdkStats?.available ?? source?.product?.cdkStats?.available
  if (cdkAvailable !== null && cdkAvailable !== undefined && cdkAvailable !== '') {
    return Math.max(0, toSafeInt(cdkAvailable, 0))
  }

  const stock = getRawStockValue(source)
  if (stock === -1) return -1
  return Math.max(0, stock)
}

export function getTotalStock(source) {
  const cdkTotal = source?.cdkStats?.total ?? source?.product?.cdkStats?.total
  if (cdkTotal !== null && cdkTotal !== undefined && cdkTotal !== '') {
    return Math.max(0, toSafeInt(cdkTotal, 0))
  }

  if (isNormalProduct(source)) {
    const available = getAvailableStock(source)
    if (available === -1) return -1
    return Math.max(0, available + getRawSoldCountValue(source))
  }

  const stock = getRawStockValue(source)
  if (stock === -1) return -1
  return Math.max(0, stock)
}

export function isUnlimitedStock(source) {
  if (isCdkProduct(source)) {
    const cdkAvailable = source?.cdkStats?.available ?? source?.product?.cdkStats?.available
    const cdkTotal = source?.cdkStats?.total ?? source?.product?.cdkStats?.total
    if (cdkAvailable !== null && cdkAvailable !== undefined) return false
    if (cdkTotal !== null && cdkTotal !== undefined) return false
  }

  return getRawStockValue(source) === -1
}

export function isOutOfStock(source) {
  if (!isPlatformOrderProduct(source)) return false
  if (isUnlimitedStock(source)) return false
  return getAvailableStock(source) <= 0
}

export function isLowStock(source, threshold = 5) {
  if (!isPlatformOrderProduct(source) || isUnlimitedStock(source)) return false
  const stock = getAvailableStock(source)
  return stock > 0 && stock <= threshold
}

export function getStockDisplay(source) {
  if (!isPlatformOrderProduct(source)) return ''
  if (isUnlimitedStock(source)) return '∞'

  const available = Math.max(0, Number(getAvailableStock(source)) || 0)
  const total = Math.max(0, Number(getTotalStock(source)) || 0)
  if (total > 0) {
    return `${available}/${total}`
  }

  return `${available}`
}

export function requiresBuyerContact(source) {
  if (typeof source?.requires_buyer_contact === 'boolean') {
    return source.requires_buyer_contact
  }
  if (typeof source?.requiresBuyerContact === 'boolean') {
    return source.requiresBuyerContact
  }
  return isNormalProduct(source)
}

export function getProductTypeText(type) {
  const normalized = normalizeProductType(type)
  const map = {
    [SHOP_PRODUCT_TYPES.NORMAL]: '普通物品',
    [SHOP_PRODUCT_TYPES.CDK]: '自动发卡',
    [SHOP_PRODUCT_TYPES.LINK]: '外链物品',
    [SHOP_PRODUCT_TYPES.STORE]: '小店'
  }
  return map[normalized] || '未知'
}

export function getProductTypeIcon(type) {
  const normalized = normalizeProductType(type)
  const map = {
    [SHOP_PRODUCT_TYPES.NORMAL]: '📦',
    [SHOP_PRODUCT_TYPES.CDK]: '🔑',
    [SHOP_PRODUCT_TYPES.LINK]: '🔗',
    [SHOP_PRODUCT_TYPES.STORE]: '🏪'
  }
  return map[normalized] || '📦'
}
