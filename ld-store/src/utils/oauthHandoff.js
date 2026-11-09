const KEY = 'ldstore.oauth.pkce'
export async function prepareOAuthHandoff() {
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return { verifier, challenge }
}
export function rememberOAuthState(verifier, state) {
  if (!state) throw new Error('登录校验信息缺失')
  sessionStorage.setItem(KEY, JSON.stringify({ verifier, state }))
}
export function consumeOAuthState(state) {
  try {
    const pending = JSON.parse(sessionStorage.getItem(KEY))
    if (!pending || pending.state !== state) return null
    sessionStorage.removeItem(KEY)
    return pending.verifier
  } catch { return null }
}
