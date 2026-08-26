'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AbsenPage() {
  const [nis, setNis] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [schoolName, setSchoolName] = useState('Nama Sekolah')
  const [gpsSupported, setGpsSupported] = useState(false)

  // Fetch school name on mount
  useEffect(() => {
    const fetchSchoolName = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from('school_settings').select('school_name').eq('id', 1).single()
        if (error) {
          console.error('School settings error:', error)
          return
        }
        if (data) setSchoolName(data.school_name)
      } catch (err) {
        console.error('Fetch error:', err)
      }
    }
    fetchSchoolName()
  }, [])

  // Check GPS support
  useEffect(() => {
    setGpsSupported('geolocation' in navigator)
  }, [])

  // Get GPS location
  const getLocation = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Browser tidak mendukung GPS'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          })
        },
        (error) => {
          let message = 'Gagal mendapatkan lokasi'
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Lokasi tidak diizinkan. Silakan aktifkan lokasi dan izinkan browser mengakses lokasi.'
              break
            case error.POSITION_UNAVAILABLE:
              message = 'Lokasi tidak tersedia. Silakan coba lagi di area terbuka.'
              break
            case error.TIMEOUT:
              message = 'Waktu permintaan lokasi habis. Silakan coba lagi.'
              break
          }
          reject(new Error(message))
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      )
    })
  }

  const handleAbsen = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // Get token from URL
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
      // Get GPS location
      const location = await getLocation()

      // Call API
      const res = await fetch('/api/absen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          nis: nis.trim(),
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        setMessage({ type: 'error', text: data.message })
        return
      }

      // Success - show result
      setMessage({
        type: 'success',
        text: `Absensi berhasil!\nNama: ${data.data.name}\nNIS: ${data.data.nis}\nKelas: ${data.data.class}\nWaktu: ${new Date().toLocaleTimeString('id-ID')}\nStatus: HADIR`,
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
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Browser tidak mendukung GPS</h1>
          <p className="text-gray-600">Silakan gunakan browser modern (Chrome, Safari, Firefox) di smartphone untuk melakukan absensi.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-center text-xl font-bold text-gray-900">{schoolName}</h1>
          <p className="text-center text-gray-500 mt-1">ABSENSI SISWA</p>
        </div>
      </header>

      {/* Main Form */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-8 flex items-center justify-center">
        <div className="w-full bg-white rounded-lg shadow-sm p-6">
          {message && (
            <div className={`mb-6 p-4 rounded-lg text-sm whitespace-pre-line ${
              message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
              message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              {message.text}
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50"
                autoFocus
                inputMode="numeric"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !nis.trim()}
              className="w-full py-3 px-4 bg-primary-600 text-white text-lg font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
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