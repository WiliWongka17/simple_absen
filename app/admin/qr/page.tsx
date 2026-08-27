'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { PageLayout } from '@/components/ui/PageLayout'
import { DataTable, Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Alert } from '@/components/ui/Alert'
import { LoadingGuard } from '@/components/ui/LoadingGuard'

interface Session {
  id: string
  token: string
  start_time: string
  end_time: string
  is_active: boolean
  created_at: string
  qr_url?: string
}

const columns: Column<Session>[] = [
  { key: 'token', label: 'Token', className: 'font-mono text-gray-600', render: (s) => s.token.substring(0, 12) + '...' },
  { key: 'start_time', label: 'Mulai', className: 'text-gray-600', render: (s) => formatDateTime(s.start_time) },
  { key: 'end_time', label: 'Selesai', className: 'text-gray-600', render: (s) => formatDateTime(s.end_time) },
  { key: 'is_active', label: 'Status', render: (s) => <StatusBadge active={s.is_active} /> },
  { key: 'created_at', label: 'Dibuat', className: 'text-gray-500', render: (s) => formatDateTime(s.created_at) },
]

function formatDateTime(isoString: string) {
  return new Date(isoString).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function QRPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({ start_time: '', end_time: '', is_active: true })
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [error, setError] = useState('')

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/admin/sessions')
      const data = await res.json()
      if (data.success) setSessions(data.data)
    } catch {
      setError('Gagal memuat sesi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSessions() }, [])

  const generateQR = async (url: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 256, margin: 2, color: { dark: '#000000', light: '#ffffff' },
      })
      setQrCodeDataUrl(dataUrl)
    } catch (err) {
      console.error('QR generation error:', err)
    }
  }

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')

    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          start_time: new Date(formData.start_time).toISOString(),
          end_time: new Date(formData.end_time).toISOString(),
        }),
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

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus sesi ini?')) return
    try {
      const res = await fetch(`/api/admin/sessions/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Gagal menghapus sesi')
        return
      }
      if (selectedSession?.id === id) {
        setSelectedSession(null)
        setQrCodeDataUrl(null)
      }
      fetchSessions()
    } catch {
      setError('Gagal menghapus sesi')
    }
  }

  const handleShowQR = async (session: Session) => {
    setSelectedSession(session)
    await generateQR(session.qr_url || `${window.location.origin}/absen?token=${session.token}`)
  }

  if (loading) return <LoadingGuard />

  return (
    <PageLayout title="QR Code Absensi" description="Buat sesi absensi dan tampilkan QR Code untuk siswa scan">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Buat Sesi Baru</h2>
        <form onSubmit={handleCreateSession} className="grid gap-4 sm:grid-cols-3">
          {error && (
            <div className="sm:col-span-3">
              <Alert type="error">{error}</Alert>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Waktu Mulai *</label>
            <input
              type="datetime-local"
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Waktu Selesai *</label>
            <input
              type="datetime-local"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 focus:outline-none"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Aktif</label>
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
            >
              {creating ? 'Membuat...' : 'Buat Sesi & Tampilkan QR'}
            </button>
          </div>
        </form>
      </div>

      {selectedSession && qrCodeDataUrl && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900">QR Code Aktif</h2>
            <StatusBadge active={selectedSession.is_active} />
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

      <DataTable
        columns={columns}
        rows={sessions}
        emptyMessage="Belum ada sesi absensi"
        renderRowActions={(session) => (
          <>
            <button
              onClick={() => handleShowQR(session)}
              disabled={!session.is_active}
              className="text-primary-600 hover:text-primary-900 text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed rounded"
            >
              Tampilkan QR
            </button>
            <button
              onClick={() => handleDelete(session.id)}
              className="text-red-600 hover:text-red-900 text-sm font-medium focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none rounded"
            >
              Hapus
            </button>
          </>
        )}
      />
    </PageLayout>
  )
}
