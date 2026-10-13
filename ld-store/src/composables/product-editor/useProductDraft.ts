import { computed, ref, type Ref } from 'vue'
import type { ProductEditorFormState } from '@/contracts/commerce'
import {
  clearProductPublishDraft,
  readProductPublishDraft,
  writeProductPublishDraft
} from '@/utils/productPublishDraft'

export interface DraftUser {
  id?: string | number | null
  site?: string | null
}

export interface ProductDraftOptions {
  getUser: () => DraftUser | null | undefined
  form: Ref<ProductEditorFormState>
  isActive: () => boolean
  debounceMs?: number
}

export function useProductDraft(options: ProductDraftOptions) {
  // 页面卸载时仍可能自动保存；草稿始终属于打开编辑器的账号。
  const owner = { ...options.getUser() }
  const draftReady = ref(false)
  const draftDirty = ref(false)
  const draftState = ref<'idle' | 'saved' | 'error'>('idle')
  const draftSavedAt = ref(0)
  const draftError = ref('')
  const hasRestoredDraft = ref(false)
  const restoredDraftAt = ref(0)
  const restoredSensitiveFields = ref<string[]>([])
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const draftStatusText = computed(() => {
    if (draftState.value === 'error') return draftError.value || '自动保存失败，离开页面可能丢失内容'
    if (draftSavedAt.value) return `已自动保存 ${formatDraftTime(draftSavedAt.value)}`
    return '自动保存已开启'
  })

  function formatDraftTime(value: number): string {
    const date = new Date(Number(value || 0))
    if (Number.isNaN(date.getTime())) return ''
    const now = new Date()
    const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    return date.toDateString() === now.toDateString()
      ? time
      : `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
  }

  function clearDraftSaveTimer() {
    if (saveTimer === null) return
    clearTimeout(saveTimer)
    saveTimer = null
  }

  function persistProductDraft(): boolean {
    clearDraftSaveTimer()
    if (!draftReady.value || !draftDirty.value || !options.isActive()) return true
    const result = writeProductPublishDraft(owner, options.form.value)
    if (!result.success || !result.draft) {
      draftState.value = 'error'
      draftError.value = '自动保存失败，离开页面可能丢失内容'
      return false
    }
    draftDirty.value = false
    draftState.value = 'saved'
    draftSavedAt.value = result.draft.updatedAt
    draftError.value = ''
    return true
  }

  function scheduleProductDraftSave() {
    clearDraftSaveTimer()
    saveTimer = setTimeout(persistProductDraft, options.debounceMs ?? 600)
  }

  function flushProductDraft(): boolean {
    return draftReady.value ? persistProductDraft() : true
  }

  function retryDraftSave() {
    draftDirty.value = true
    persistProductDraft()
  }

  function restoreProductDraft(defaults: () => ProductEditorFormState) {
    const result = readProductPublishDraft(owner)
    if (result.error) {
      draftState.value = 'error'
      draftError.value = '草稿读取失败，本次填写仍会继续尝试自动保存'
      return null
    }
    if (!result.draft) return null
    options.form.value = {
      ...defaults(),
      ...(result.draft.form as Partial<ProductEditorFormState>),
      cdkCodes: '',
      sharedCdkCode: ''
    }
    hasRestoredDraft.value = true
    restoredDraftAt.value = result.draft.updatedAt
    restoredSensitiveFields.value = result.draft.sensitiveFieldsOmitted
    draftSavedAt.value = result.draft.updatedAt
    draftState.value = 'saved'
    return result.draft
  }

  function clearPersistedProductDraft(): boolean {
    clearDraftSaveTimer()
    draftReady.value = false
    draftDirty.value = false
    const cleared = clearProductPublishDraft(owner)
    if (!cleared) {
      draftReady.value = true
      return false
    }
    hasRestoredDraft.value = false
    restoredDraftAt.value = 0
    restoredSensitiveFields.value = []
    draftSavedAt.value = 0
    draftState.value = 'idle'
    draftError.value = ''
    return cleared
  }

  function markDirty() {
    if (!draftReady.value || !options.isActive()) return
    draftDirty.value = true
    scheduleProductDraftSave()
  }

  return {
    draftReady,
    draftDirty,
    draftState,
    draftSavedAt,
    draftError,
    hasRestoredDraft,
    restoredDraftAt,
    restoredSensitiveFields,
    draftStatusText,
    formatDraftTime,
    clearDraftSaveTimer,
    persistProductDraft,
    scheduleProductDraftSave,
    flushProductDraft,
    retryDraftSave,
    restoreProductDraft,
    clearPersistedProductDraft,
    markDirty
  }
}
