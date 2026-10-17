import { duoApi } from './duoPlusService'
import { captureAuthSession, isAuthSessionCurrent } from '@/utils/auth'
// A retry uses the identical signed ticket; server constraints deduplicate it.
export async function reportDuo(token, type, session = captureAuthSession()) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!isAuthSessionCurrent(session) || !session.token) return
    const r = await duoApi.event(token, type)
    if (r.success || (r.status > 0 && r.status < 500 && r.status !== 429)) return
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)))
  }
}
