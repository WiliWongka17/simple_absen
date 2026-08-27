'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SchoolSettings {
  id: number
  school_name: string
  latitude: number
  longitude: number
  radius_meters: number
  max_accuracy_meters: number
  attendance_start_time: string
  late_after_time: string
  attendance_end_time: string
  timezone: string
  updated_at: string
}

export function useSchoolSettings() {
  const [settings, setSettings] = useState<SchoolSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('school_settings').select('*').eq('id', 1).single()
        if (error) {
          console.error('School settings error:', error)
          return
        }
        if (data) setSettings(data)
      } catch (err) {
        console.error('Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  return { settings, loading }
}
