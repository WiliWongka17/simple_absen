'use client'

import { useState, useEffect } from 'react'
import { UseFilterBar } from '@/hooks/useFilterBar'
import { PageLayout } from '@/components/ui/PageLayout'
import { DataTable, Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { FilterBar } from '@/components/admin/FilterBar'
import { LoadingGuard } from '@/components/ui/LoadingGuard'

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

const columns: Column<AttendanceRecord>[] = [
  { key: 'index', label: 'No', className: 'text-gray-500', render: (_r, i) => i + 1 },
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
    render: (r) => new Date(r.attendance_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  },
  { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'distance', label: 'Jarak (m)', className: 'text-gray-500', render: (r) => r.distance_from_school || 0 },
  { key: 'accuracy', label: 'Akurasi (m)', className: 'text-gray-500', render: (r) => r.accuracy || 0 },
]

export default function AbsensiPage() {
  const { date, setDate, classId, setClassId, classes } = UseFilterBar()
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const params = new URLSearchParams()
      params.set('date', date)
      if (classId) params.set('class_id', classId)
      const res = await fetch(`/api/admin/attendance?${params.toString()}`)
      const result = await res.json()
      if (result.success) setAttendance(result.data)
    } catch {
      console.error('Fetch error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [date, classId])

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

  if (loading) return <LoadingGuard />

  return (
    <PageLayout
      title="Data Absensi"
      description="Kelola dan filter data absensi siswa"
      action={
        <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          Export CSV
        </button>
      }
    >
      <FilterBar.Root date={date} classId={classId} classes={classes}>
        <FilterBar.Date value={date} onChange={setDate} />
        <FilterBar.Class value={classId} onChange={setClassId} />
        <FilterBar.Apply onClick={fetchData} />
      </FilterBar.Root>

      <DataTable columns={columns} rows={attendance} emptyMessage="Tidak ada data absensi untuk filter ini" />
    </PageLayout>
  )
}
