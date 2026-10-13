// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { ref } from 'vue'
import { useProductDraft } from '../src/composables/product-editor/useProductDraft'
import { readProductPublishDraft, writeProductPublishDraft } from '../src/utils/productPublishDraft'
import { isUncertainMutationResult } from '../src/composables/product-editor/useSubmissionReconciliation'
import type { ProductEditorFormState } from '../src/contracts/commerce'
const form = (): ProductEditorFormState => ({ name: '账号 A 草稿', description: '', price: '10', discount: 1, categoryId: 1, imageUrl: '', productType: 'normal', stock: 2, purchaseTrustLevel: 0, purchaseLimitType: 'none', maxPurchaseQuantity: '', purchaseLimitPeriodDays: '', cdkCodes: '', sharedCdkEnabled: false, sharedCdkCode: '', isTestMode: false })
beforeEach(() => { localStorage.clear() })
it('flushes and clears the original owner draft during account-switch unmount without overwriting another account', () => {
  const userA = { id: '11', site: 'linux.do' }
  const userB = { id: '11', site: 'idcflare.com' }
  let current = userA
  const editor = useProductDraft({ getUser: () => current, form: ref(form()), isActive: () => true })
  editor.draftReady.value = true
  editor.draftDirty.value = true
  writeProductPublishDraft(userB, { ...form(), name: '账号 B 的草稿' })
  current = userB
  expect(editor.flushProductDraft()).toBe(true)
  expect(readProductPublishDraft(userA).draft?.form.name).toBe('账号 A 草稿')
  expect(readProductPublishDraft(userB).draft?.form.name).toBe('账号 B 的草稿')
  editor.clearPersistedProductDraft()
  expect(readProductPublishDraft(userA).draft).toBeNull()
  expect(readProductPublishDraft(userB).draft?.form.name).toBe('账号 B 的草稿')
})
it('does not start mutation recovery using the next account after a session cancellation', () => {
  expect(isUncertainMutationResult({ success: false, status: 0, kind: 'abort', aborted: true, error: '', errorCode: 'SESSION_CHANGED' })).toBe(false)
  expect(isUncertainMutationResult({ success: false, status: 0, kind: 'abort', aborted: true, error: '', abortReason: 'timeout' })).toBe(true)
})
