'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface DashboardData {
  total_siswa: number
  hadir: number
  terlambat: number
  belum_absen: number
  persentase_kehadiran: number
  date: string
}

interface Class {
  id: string
  name: string
  grade: string | null
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    total_siswa: 0,
    hadir: 0,
    terlambat: 0,
    belum_absen: 0,
    persentase_kehadiran: 0,
    date: new Date().toISOString().split('T')[0],
  })
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const params = new URLSearchParams()
      params.set('date', selectedDate)
      if (selectedClass) params.set('class_id', selectedClass)

      const res = await fetch(`/api/admin/dashboard?${params.toString()}`)
      const result = await res.json()
      if (result.success) {
        setData(result.data)
      }
    } catch (err) {
      console.error('Fetch dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/admin/classes')
      const result = await res.json()
      if (result.success) {
        setClasses(result.data)
      }
    } catch (err) {
      console.error('Fetch classes error:', err)
    }
  }

  useEffect(() => {
    fetchData()
    fetchClasses()
  }, [selectedDate, selectedClass])

  const handleFilterChange = () => {
    fetchData()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Ringkasan absensi siswa</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
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
          <button
            onClick={handleFilterChange}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Siswa" value={data.total_siswa} icon="👥" />
        <StatCard label="Hadir" value={data.hadir} icon="✅" color="green" />
        <StatCard label="Terlambat" value={data.terlambat} icon="⏰" color="yellow" />
        <StatCard label="Belum Absen" value={data.belum_absen} icon="❌" color="red" />
      </div>

      {/* Persentase */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Persentase Kehadiran</p>
            <p className="text-4xl font-bold text-gray-900">{data.persentase_kehadiran}%</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Tanggal: {new Date(data.date).toLocaleDateString('id-ID')}</p>
            <p className="text-sm text-gray-500">Total tercatat: {data.hadir + data.terlambat} dari {data.total_siswa} siswa</p>
          </div>
        </div>
      </div>

      {/* Recent Attendance Table */}
      <RecentAttendanceTable date={selectedDate} classId={selectedClass} />
    </div>
  )
}

function StatCard({ label, value, icon, color = 'blue' }: { label: string; value: number; icon: string; color?: string }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <div className={`bg-white rounded-lg shadow p-6 border ${colors[color as keyof typeof colors]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <span className="text-4xl" aria-hidden="true">{icon}</span>
      </div>
    </div>
  )
}

function RecentAttendanceTable({ date, classId }: { date: string; classId: string }) {
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAttendance = async () => {
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
        console.error('Fetch attendance error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAttendance()
  }, [date, classId])

  if (loading) return <div className="flex justify-center py-12">Memuat...</div>

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <h2 className="px-6 py-4 border-b text-lg font-semibold text-gray-900">Absensi Terbaru</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NIS</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kelas</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jam</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jarak (m)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akurasi (m)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {attendance.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  Belum ada data absensi untuk tanggal ini
                </td>
              </tr>
            ) : (
              attendance.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">{record.students?.nis || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{record.students?.name || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {record.students?.classes ? `${record.students.classes.grade || ''} ${record.students.classes.name}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {record.attendance_time ? new Date(record.attendance_time).toLocaleTimeString('id-ID') : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      record.status === 'HADIR' ? 'bg-green-100 text-green-800' :
                      record.status === 'TERLAMBAT' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{record.distance_from_school || 0}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{record.accuracy || 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}