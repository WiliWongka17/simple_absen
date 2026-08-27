'use client'

import { useState, useEffect } from 'react'

interface Class {
  id: string
  name: string
  grade: string | null
}

interface UseFilterBarOptions {
  initialDate?: string
}

export function UseFilterBar(options?: UseFilterBarOptions) {
  const [date, setDate] = useState(() => options?.initialDate ?? new Date().toISOString().split('T')[0])
  const [classId, setClassId] = useState('')
  const [classes, setClasses] = useState<Class[]>([])

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await fetch('/api/admin/classes')
        const result = await res.json()
        if (result.success) setClasses(result.data)
      } catch {
        console.error('Gagal memuat kelas')
      }
    }
    fetchClasses()
  }, [])

  return { date, setDate, classId, setClassId, classes }
}
