'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode'

interface Session {
  id: string
  token: string
  start_time: string
  end_time: string
  is_active: boolean
  created_at: string
  qr_url?: string
}

export default function QRPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    start_time: '',
    end_time: '',
    is_active: true,
  })
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [error, setError] = useState('')

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/admin/sessions')
      const data = await res.json()
      if (data.success) {
        setSessions(data.data)
      }
    } catch (err) {
      setError('Gagal memuat sesi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')

    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || data.error)

      setQrCodeDataUrl(null)
      setSelectedSession(data.data)
      await generateQR(data.data.qr_url)
      setFormData({ start_time: '', end_time: '', is_active: true })
      fetchSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat sesi')
    } finally {
      setCreating(false)
    }
  }

  const generateQR = async (url: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
      setQrCodeDataUrl(dataUrl)
    } catch (err) {
      console.error('QR generation error:', err)
    }
  }

  const handleActivate = async (session: Session) => {
    try {
      // Toggle active status - for MVP we just show the QR
      setSelectedSession(session)
      await generateQR(session.qr_url || `${window.location.origin}/absen?token=${session.token}`)
    } catch (err) {
      console.error('Activate error:', err)
    }
  }

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) return <div className="flex justify-center py-12">Memuat...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">QR Code Absensi</h1>
        <p className="text-gray-500">Buat sesi absensi dan tampilkan QR Code untuk siswa scan</p>
      </div>

      {/* Create Session Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Buat Sesi Baru</h2>
        <form onSubmit={handleCreateSession} className="grid gap-4 sm:grid-cols-3">
          {error && (
            <div className="sm:col-span-3 bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Waktu Mulai *</label>
            <input
              type="datetime-local"
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Waktu Selesai *</label>
            <input
              type="datetime-local"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Aktif</label>
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {creating ? 'Membuat...' : 'Buat Sesi & Tampilkan QR'}
            </button>
          </div>
        </form>
      </div>

      {/* QR Display */}
      {selectedSession && qrCodeDataUrl && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900">QR Code Aktif</h2>
            <span
              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                selectedSession.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {selectedSession.is_active ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 items-center">
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-500 mb-2">Scan QR untuk absen</p>
              <img src={qrCodeDataUrl} alt="QR Code absensi" className="bg-white p-4 rounded-lg border" />
              <p className="mt-2 text-xs text-gray-500 font-mono break-all">
                {selectedSession.qr_url || `${window.location.origin}/absen?token=${selectedSession.token}`}
              </p>
            </div>

            <div className="flex-1 space-y-3 text-sm">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-900">Token</p>
                <p className="font-mono text-xs text-gray-600 break-all">{selectedSession.token}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium text-gray-900">Mulai</p>
                  <p className="text-gray-600">{formatDateTime(selectedSession.start_time)}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium text-gray-900">Selesai</p>
                  <p className="text-gray-600">{formatDateTime(selectedSession.end_time)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h2 className="px-6 py-4 border-b text-lg font-semibold text-gray-900">Riwayat Sesi</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mulai</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Selesai</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dibuat</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Belum ada sesi absensi
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">
                      {session.token.substring(0, 12)}...
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDateTime(session.start_time)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDateTime(session.end_time)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          session.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {session.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDateTime(session.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleActivate(session)}
                        disabled={!session.is_active}
                        className="text-primary-600 hover:text-primary-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Tampilkan QR
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}