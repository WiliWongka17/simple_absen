'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { PageLayout } from '@/components/ui/PageLayout'
import { Alert } from '@/components/ui/Alert'

interface ImportSummary {
  total_rows: number
  berhasil: number
  dilewati_duplikat: number
  gagal: number
}

interface ImportError {
  row: number
  reason: string
}

interface ImportResult {
  success: boolean
  summary?: ImportSummary
  errors?: ImportError[]
  error?: string
}

export default function ImportSiswaPage() {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/admin/students/template')
      if (!res.ok) throw new Error('Gagal download template')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'template_import_siswa.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Gagal download template')
    }
  }

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/students/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ success: false, error: 'Gagal mengupload file' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <PageLayout
      title="Import Siswa"
      description="Upload file Excel (.xlsx) untuk menambah data siswa secara massal"
      action={
        <Link
          href="/admin/siswa"
          className="text-primary-600 hover:text-primary-900 text-sm font-medium"
        >
          Kembali ke Daftar Siswa
        </Link>
      }
    >
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Download Template</h2>
          <p className="text-sm text-gray-600 mb-4">
            Download template Excel, isi data siswa, lalu upload kembali.
            Format kolom: <strong>NIS</strong>, <strong>Nama</strong>, <strong>Kelas</strong>, <strong>Status Aktif</strong> (AKTIF / TIDAK AKTIF).
          </p>
          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
          >
            Download Template Excel
          </button>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Upload File</h2>
          <p className="text-sm text-gray-600 mb-4">
            Pilih file .xlsx yang sudah diisi. NIS yang sudah ada di sistem akan dilewati (tidak ditimpa).
          </p>
          <div className="flex items-center gap-4">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 focus:outline-none"
            />
            <button
              onClick={handleUpload}
              disabled={uploading || !fileRef.current?.files?.[0]}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50 whitespace-nowrap"
            >
              {uploading ? 'Mengupload...' : 'Import'}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-lg shadow p-6">
          {result.error && (
            <Alert type="error">{result.error}</Alert>
          )}

          {result.summary && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Hasil Import</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{result.summary.total_rows}</p>
                  <p className="text-sm text-gray-600">Total Baris</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{result.summary.berhasil}</p>
                  <p className="text-sm text-gray-600">Berhasil</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{result.summary.dilewati_duplikat}</p>
                  <p className="text-sm text-gray-600">Dilewati (Duplikat)</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-700">{result.summary.gagal}</p>
                  <p className="text-sm text-gray-600">Gagal</p>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Detail Error:</h3>
                  <div className="bg-red-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th className="pb-2 pr-4">Baris</th>
                          <th className="pb-2">Alasan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map((err, i) => (
                          <tr key={i} className="border-t border-red-100">
                            <td className="py-1 pr-4 font-mono text-gray-900">{err.row}</td>
                            <td className="py-1 text-red-700">{err.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.summary.berhasil > 0 && (
                <div className="pt-2">
                  <Link
                    href="/admin/siswa"
                    className="text-primary-600 hover:text-primary-900 text-sm font-medium"
                  >
                    Lihat Daftar Siswa
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </PageLayout>
  )
}
