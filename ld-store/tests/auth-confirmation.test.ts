// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from '../src/stores/ui'
import { clearAuthSession, setAuthSession } from '../src/utils/auth'
import { authToken } from './helpers/auth'
beforeEach(() => { localStorage.clear(); clearAuthSession(); setActivePinia(createPinia()); setAuthSession(authToken()) })
it('cancels an outstanding confirmation when the account changes', async () => {
  const store = useUiStore()
  const confirmation = store.confirm('Delete this private setting?')
  setAuthSession(authToken('22'))
  expect(store.dialog.visible).toBe(false)
  expect(await confirmation).toBe(false)
})
it('rejects an already confirmed action if storage changes before its continuation runs', async () => {
  const store = useUiStore()
  const confirmation = store.confirm('Delete this private setting?')
  store.dialog.onConfirm()
  setAuthSession(authToken('22'))
  expect(await confirmation).toBe(false)
})
it('still accepts same-session confirmation and resolves replaced or hidden dialogs as cancelled', async () => {
  const store = useUiStore()
  const previous = store.confirm('old')
  const current = store.confirm('new')
  expect(await previous).toBe(false)
  store.dialog.onConfirm()
  expect(await current).toBe(true)
  const hidden = store.confirm('hidden')
  store.hideDialog()
  expect(await hidden).toBe(false)
})
it('rejects a confirmation started before a missed cross-tab event is reconciled', async () => {
  const { storage } = await import('../src/utils/storage')
  storage.set('token', authToken('22'))
  const store = useUiStore()
  expect(await store.confirm('old account action')).toBe(false)
  expect(store.dialog.visible).toBe(false)
})
