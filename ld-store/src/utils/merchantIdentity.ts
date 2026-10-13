export interface MerchantIdentity {
  userId?: unknown
  site?: unknown
}

export function merchantIdentityQuery(identity: MerchantIdentity = {}): string {
  const query = new URLSearchParams()
  if (identity.site) query.set('site', String(identity.site).trim().toLowerCase())
  if (identity.userId !== undefined && identity.userId !== null && String(identity.userId).trim()) {
    query.set('userId', String(identity.userId).trim())
  }
  return query.size ? `?${query}` : ''
}

export function merchantProfilePath(profile: MerchantIdentity & { username?: unknown }): string {
  const username = String(profile.username || '').trim()
  return username ? `/merchant/${encodeURIComponent(username)}${merchantIdentityQuery(profile)}` : ''
}
