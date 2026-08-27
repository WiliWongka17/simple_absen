'use client'

import { useState, useEffect, useCallback } from 'react'

interface UseCrudEntityOptions<T> {
  baseUrl: string
  initialData?: T[]
  mapItem?: (raw: any) => T
}

interface UseCrudEntityReturn<T> {
  items: T[]
  loading: boolean
  error: string
  create: (data: Record<string, any>) => Promise<boolean>
  update: (id: string, data: Record<string, any>) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  refresh: () => Promise<void>
}

export function useCrudEntity<T extends { id: string }>(
  options: UseCrudEntityOptions<T>
): UseCrudEntityReturn<T> {
  const { baseUrl, initialData = [], mapItem } = options
  const [items, setItems] = useState<T[]>(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(baseUrl)
      const data = await res.json()
      if (data.success) {
        setItems(mapItem ? data.data.map(mapItem) : data.data)
      }
    } catch {
      setError('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [baseUrl, mapItem])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = async (body: Record<string, any>): Promise<boolean> => {
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      await refresh()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan')
      return false
    }
  }

  const update = async (id: string, body: Record<string, any>): Promise<boolean> => {
    try {
      const res = await fetch(`${baseUrl}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      await refresh()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengupdate')
      return false
    }
  }

  const remove = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${baseUrl}/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      await refresh()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus')
      return false
    }
  }

  return { items, loading, error, create, update, remove, refresh }
}
