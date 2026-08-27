'use client'

import { useState, useCallback } from 'react'

type ModalMode<T> = null | { mode: 'create' } | { mode: 'edit'; item: T }

interface UseCrudModalReturn<T> {
  mode: ModalMode<T>
  openCreate: () => void
  openEdit: (item: T) => void
  close: () => void
  isCreate: boolean
  isEdit: boolean
  editItem: T | null
}

export function useCrudModal<T>(): UseCrudModalReturn<T> {
  const [mode, setMode] = useState<ModalMode<T>>(null)

  const openCreate = useCallback(() => setMode({ mode: 'create' }), [])
  const openEdit = useCallback((item: T) => setMode({ mode: 'edit', item }), [])
  const close = useCallback(() => setMode(null), [])

  return {
    mode,
    openCreate,
    openEdit,
    close,
    isCreate: mode?.mode === 'create',
    isEdit: mode?.mode === 'edit',
    editItem: mode?.mode === 'edit' ? mode.item : null,
  }
}
