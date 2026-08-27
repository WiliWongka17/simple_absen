'use client'

import { useState, useEffect } from 'react'
import { UseFilterBar } from '@/hooks/useFilterBar'
import { PageLayout } from '@/components/ui/PageLayout'
import { DataTable, Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { FilterBar } from '@/components/admin/FilterBar'
import { LoadingGuard } from '@/components/ui/LoadingGuard'

interface DashboardData {
  total_siswa: number
  hadir: number
  terlambat: number
  belum_absen: number
  persentase_kehadiran: number
  date: string
}

interface AttendanceRecord {
  id: string
  attendance_time: string
  status: string
  distance_from_school: number
  accuracy: number
  students: {
    nis: string
    name: string
    classes: { name: string; grade: string | null } | null
  }
}

const attendanceColumns: Column<AttendanceRecord>[] = [
  { key: 'nis', label: 'NIS', className: 'font-mono text-gray-900', render: (r) => r.students?.nis || '—' },
  { key: 'name', label: 'Nama', className: 'text-gray-900', render: (r) => r.students?.name || '—' },
  {
    key: 'class',
    label: 'Kelas',
    className: 'text-gray-500',
    render: (r) => r.students?.classes ? `${r.students.classes.grade || ''} ${r.students.classes.name}` : '—',
  },
  {
    key: 'time',
    label: 'Jam',
    className: 'text-gray-500',
    render: (r) => r.attendance_time ? new Date(r.attendance_time).toLocaleTimeString('id-ID') : '—',
  },
  { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'distance', label: 'Jarak (m)', className: 'text-gray-500', render: (r) => r.distance_from_school || 0 },
  { key: 'accuracy', label: 'Akurasi (m)', className: 'text-gray-500', render: (r) => r.accuracy || 0 },
]

const statIcons: Record<string, React.ReactNode> = {
  blue: <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  green: <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  yellow: <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  red: <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>,
}

function StatCard({ label, value, color = 'blue' }: { label: string; value: number; color?: string }) {
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
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <span className="opacity-60" aria-hidden="true">{statIcons[color || 'blue']}</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { date, setDate, classId, setClassId, classes } = UseFilterBar()
  const [data, setData] = useState<DashboardData>({
    total_siswa: 0, hadir: 0, terlambat: 0, belum_absen: 0, persentase_kehadiran: 0, date: new Date().toISOString().split('T')[0],
  })
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDashboard = async () => {
    try {
      const params = new URLSearchParams()
      params.set('date', date)
      if (classId) params.set('class_id', classId)
      const [dashRes, attRes] = await Promise.all([
        fetch(`/api/admin/dashboard?${params.toString()}`),
        fetch(`/api/admin/attendance?${params.toString()}`),
      ])
      const dashResult = await dashRes.json()
      const attResult = await attRes.json()
      if (dashResult.success) setData(dashResult.data)
      if (attResult.success) setAttendance(attResult.data)
    } catch {
      console.error('Fetch dashboard error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDashboard() }, [date, classId])

  if (loading) return <LoadingGuard />

  return (
    <PageLayout title="Dashboard" description="Ringkasan absensi siswa">
      <FilterBar.Root date={date} classId={classId} classes={classes}>
        <FilterBar.Date value={date} onChange={setDate} />
        <FilterBar.Class value={classId} onChange={setClassId} />
        <FilterBar.Apply onClick={fetchDashboard} />
      </FilterBar.Root>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Siswa" value={data.total_siswa} />
        <StatCard label="Hadir" value={data.hadir} color="green" />
        <StatCard label="Terlambat" value={data.terlambat} color="yellow" />
        <StatCard label="Belum Absen" value={data.belum_absen} color="red" />
      </div>

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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h2 className="px-6 py-4 border-b text-lg font-semibold text-gray-900">Absensi Terbaru</h2>
        <DataTable columns={attendanceColumns} rows={attendance} emptyMessage="Belum ada data absensi untuk tanggal ini" />
      </div>
    </PageLayout>
  )
}
