'use client'

import { useState, useEffect } from 'react'
import { PageLayout } from '@/components/ui/PageLayout'
import { Alert } from '@/components/ui/Alert'
import { LoadingGuard } from '@/components/ui/LoadingGuard'

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

const TIMEZONES = [
  'Asia/Makassar', 'Asia/Jakarta', 'Asia/Jayapura', 'Asia/Bangkok',
  'Asia/Singapore', 'Asia/Kuala_Lumpur', 'UTC',
]

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b pb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default function PengaturanPage() {
  const [settings, setSettings] = useState<SchoolSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/admin/settings')
        const result = await res.json()
        if (result.success) setSettings(result.data)
      } catch {
        console.error('Fetch settings error')
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings) return
    setSaving(true)
    setMessage(null)

    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement)
      const updates = {
        school_name: formData.get('school_name') as string,
        latitude: parseFloat(formData.get('latitude') as string),
        longitude: parseFloat(formData.get('longitude') as string),
        radius_meters: parseInt(formData.get('radius_meters') as string),
        max_accuracy_meters: parseInt(formData.get('max_accuracy_meters') as string),
        attendance_start_time: formData.get('attendance_start_time') as string,
        late_after_time: formData.get('late_after_time') as string,
        attendance_end_time: formData.get('attendance_end_time') as string,
        timezone: formData.get('timezone') as string,
      }
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || 'Gagal menyimpan')
      setSettings(prev => prev ? { ...prev, ...result.data } : null)
      setMessage({ type: 'success', text: 'Pengaturan berhasil disimpan' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Terjadi kesalahan' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingGuard />
  if (!settings) return <div className="text-center text-red-500">Gagal memuat pengaturan</div>

  return (
    <PageLayout title="Pengaturan Sekolah" description="Konfigurasi lokasi, radius, dan jam absensi">
      {message && <Alert type={message.type}>{message.text}</Alert>}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <SettingsSection title="Informasi Sekolah">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Sekolah</label>
              <input name="school_name" type="text" defaultValue={settings.school_name}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-none" required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input name="latitude" type="number" step="any" defaultValue={settings.latitude}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input name="longitude" type="number" step="any" defaultValue={settings.longitude}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-none" required />
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Radius & Akurasi">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Radius Absensi (meter)</label>
              <input name="radius_meters" type="number" min="10" max="1000" defaultValue={settings.radius_meters}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-none" required />
              <p className="text-xs text-gray-500 mt-1">Jarak maksimum dari sekolah untuk absen valid</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Akurasi Maksimum GPS (meter)</label>
              <input name="max_accuracy_meters" type="number" min="10" max="500" defaultValue={settings.max_accuracy_meters}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-none" required />
              <p className="text-xs text-gray-500 mt-1">Jika akurasi GPS lebih besar, absen ditolak</p>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Jam Absensi">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mulai Absen</label>
              <input name="attendance_start_time" type="time" defaultValue={settings.attendance_start_time.slice(0, 5)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batas Terlambat</label>
              <input name="late_after_time" type="time" defaultValue={settings.late_after_time.slice(0, 5)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Selesai Absen</label>
              <input name="attendance_end_time" type="time" defaultValue={settings.attendance_end_time.slice(0, 5)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-none" required />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Waktu menggunakan timezone sekolah: {settings.timezone}</p>
        </SettingsSection>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Zona Waktu</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zona Waktu Sekolah</label>
            <select name="timezone" defaultValue={settings.timezone}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-none">
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Digunakan untuk validasi jam absensi di server</p>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button type="submit" disabled={saving}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </PageLayout>
  )
}
