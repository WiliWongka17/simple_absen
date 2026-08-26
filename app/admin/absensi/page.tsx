'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AttendanceRecord {
  id: string
  attendance_time: string
  latitude: number
  longitude: number
  accuracy: number
  distance_from_school: number
  status: string
  students: {
    id: string
    nis: string
    name: string
    class_id: string
    classes: { id: string; name: string; grade: string | null } | null
  }
}

interface Class {
  id: string
  name: string
  grade: string | null
}

export default function AbsensiPage() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [classId, setClassId] = useState('')

  const fetchData = async () => {
    try {
      const params = new URLSearchParams()
      params.set('date', date)
      if (classId) params.set('class_id', classId)

      const res = await fetch(`/api/admin/attendance?${params.toString()}`)
      const result = await res.json()
      if (result.success) {
        setAttendance(result.data)
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/admin/classes')
      const result = await res.json()
      if (result.success) setClasses(result.data)
    } catch (err) {
      console.error('Fetch classes error:', err)
    }
  }

  useEffect(() => {
    fetchData()
    fetchClasses()
  }, [date, classId])

  const handleExport = async () => {
    const params = new URLSearchParams()
    params.set('date', date)
    if (classId) params.set('class_id', classId)

    try {
      const res = await fetch(`/api/admin/export?${params.toString()}`)
      if (!res.ok) throw new Error('Export gagal')
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `absensi-${date}${classId ? `-${classId}` : ''}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert('Gagal export: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('id-ID')
  }

  if (loading) return <div className="flex justify-center py-12">Memuat...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Absensi</h1>
          <p className="text-gray-500">Kelola dan filter data absensi siswa</p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Semua Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.grade ? c.grade + ' ' : ''}{c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NIS</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kelas</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jam</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jarak (m)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akurasi (m)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {attendance.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Tidak ada data absensi untuk filter ini
                  </td>
                </tr>
              ) : (
                attendance.map((record, index) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{record.students?.nis || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{record.students?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {record.students?.classes ? `${record.students.classes.grade || ''} ${record.students.classes.name}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatTime(record.attendance_time)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        record.status === 'HADIR' ? 'bg-green-100 text-green-800' :
                        record.status === 'TERLAMBAT' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{record.distance_from_school || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{record.accuracy || 0}</td>
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