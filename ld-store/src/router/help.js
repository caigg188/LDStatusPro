import { getHelpArticle, resolveLegacyHelpLocation } from '@/config/helpCenter'

export function resolveHelpRoute(to) {
  const section = String(to.params.section || '')
  const legacyTarget = resolveLegacyHelpLocation(section, to.query)
  if (legacyTarget) return legacyTarget
  if (!getHelpArticle(section)) {
    return { name: 'Docs', query: to.query, replace: true }
  }
  return true
}
