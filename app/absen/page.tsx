'use client'

import { useState } from 'react'
import { useSchoolSettings } from '@/hooks/useSchoolSettings'
import { useGeolocation } from '@/hooks/useGeolocation'
import { getOrCreateDeviceId } from '@/lib/device'
import { Alert } from '@/components/ui/Alert'

export default function AbsenPage() {
  const [nis, setNis] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { settings } = useSchoolSettings()
  const { supported: gpsSupported, getLocation } = useGeolocation()

  const schoolName = settings?.school_name ?? 'Nama Sekolah'

  const handleAbsen = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const searchParams = new URLSearchParams(window.location.search)
    const token = searchParams.get('token')

    if (!token) {
      setMessage({ type: 'error', text: 'Token tidak ditemukan. Silakan scan QR Code absensi.' })
      setLoading(false)
      return
    }

    if (!nis.trim()) {
      setMessage({ type: 'error', text: 'NIS wajib diisi' })
      setLoading(false)
      return
    }

    try {
      const location = await getLocation()

      const res = await fetch('/api/absen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          nis: nis.trim(),
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          device_id: getOrCreateDeviceId(),
        }),
      })

      const data = await res.json()

      if (!data.success) {
        setMessage({ type: 'error', text: data.message })
        return
      }

      setMessage({
        type: 'success',
        text: `Absensi berhasil!\nNama: ${data.data.name}\nNIS: ${data.data.nis}\nKelas: ${data.data.class}\nWaktu: ${new Date().toLocaleTimeString('id-ID')}\nStatus: ${data.data.status}`,
      })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Terjadi kesalahan' })
    } finally {
      setLoading(false)
    }
  }

  if (!gpsSupported) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="flex justify-center mb-4 text-red-500">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Browser tidak mendukung GPS</h1>
          <p className="text-gray-600">Silakan gunakan browser modern (Chrome, Safari, Firefox) di smartphone untuk melakukan absensi.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-center text-xl font-bold text-gray-900">{schoolName}</h1>
          <p className="text-center text-gray-700 mt-1">ABSENSI SISWA</p>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-8 flex items-center justify-center">
        <div className="w-full bg-white rounded-lg shadow-sm p-6">
          {message && (
            <div className="mb-6">
              <Alert type={message.type}>{message.text}</Alert>
            </div>
          )}

          <form onSubmit={handleAbsen} className="space-y-6">
            <div>
              <label htmlFor="nis" className="block text-sm font-medium text-gray-700 mb-2">
                NIS
              </label>
              <input
                id="nis"
                type="text"
                value={nis}
                onChange={(e) => setNis(e.target.value)}
                placeholder="Masukkan NIS"
                required
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50"
                autoFocus
                inputMode="numeric"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !nis.trim()}
              className="w-full py-3 px-4 bg-primary-600 text-white text-lg font-medium rounded-lg hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memeriksa lokasi...' : 'ABSEN'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500">
            Scan QR Code absensi untuk membuka halaman ini
          </p>
        </div>
      </main>
    </div>
  )
}
