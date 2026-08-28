'use client'

import { useState, useEffect } from 'react'
import { UseFilterBar } from '@/hooks/useFilterBar'
import { PageLayout } from '@/components/ui/PageLayout'
import { DataTable, Column } from '@/components/ui/DataTable'
import { FilterBar } from '@/components/admin/FilterBar'
import { LoadingGuard } from '@/components/ui/LoadingGuard'
import { Alert } from '@/components/ui/Alert'

interface DailyRow {
  id: string
  student_id: string
  nis: string
  name: string
  class_id: string | null
  classes: { id: string; name: string; grade: string | null } | null
  daily_status: string
  source: string | null
  attendance_time: string | null
  status_date: string
}

const STATUS_OPTIONS = [
  { value: 'HADIR', label: 'Hadir' },
  { value: 'BELUM_ABSEN', label: 'Belum Absen' },
  { value: 'TIDAK_HADIR', label: 'Tidak Hadir' },
] as const

export default function AbsensiPage() {
  const { date, setDate, classId, setClassId, classes } = UseFilterBar()
  const [rows, setRows] = useState<DailyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('date', date)
      if (classId) params.set('class_id', classId)
      const res = await fetch(`/api/admin/attendance/status?${params.toString()}`)
      const result = await res.json()
      if (result.success) setRows(result.data)
      else setMessage({ type: 'error', text: result.error || 'Gagal memuat data' })
    } catch {
      setMessage({ type: 'error', text: 'Gagal memuat data' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [date, classId])

  const handleStatusChange = async (studentId: string, newStatus: string) => {
    const prevRows = rows
    const target = rows.find(r => r.id === studentId)
    if (!target || target.daily_status === newStatus) return
    // optimistic
    setRows(prev => prev.map(r => r.id === studentId ? { ...r, daily_status: newStatus } : r))
    setSavingId(studentId)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/attendance/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, status_date: date, status: newStatus }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Gagal menyimpan')
      setMessage({ type: 'success', text: 'Status berhasil diperbarui' })
      setTimeout(() => setMessage(null), 2500)
    } catch (err) {
      setRows(prevRows)
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menyimpan' })
    } finally {
      setSavingId(null)
    }
  }

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

  const columns: Column<DailyRow>[] = [
    { key: 'index', label: 'No', className: 'text-gray-500', render: (_r, i) => i + 1 },
    { key: 'nis', label: 'NIS', className: 'font-mono text-gray-900', render: (r) => r.nis || '—' },
    { key: 'name', label: 'Nama', className: 'text-gray-900', render: (r) => r.name || '—' },
    {
      key: 'class',
      label: 'Kelas',
      className: 'text-gray-500',
      render: (r) => r.classes ? `${r.classes.grade || ''} ${r.classes.name}`.trim() : '—',
    },
    {
      key: 'daily_status',
      label: 'Status',
      render: (r) => (
        <select
          value={r.daily_status}
          onChange={(e) => handleStatusChange(r.id, e.target.value)}
          disabled={savingId === r.id}
          aria-label={`Status ${r.name}`}
          className="px-2 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none disabled:opacity-50 min-w-[140px]"
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ),
    },
    {
      key: 'attendance_time',
      label: 'Jam Absen',
      className: 'text-gray-500',
      render: (r) => r.attendance_time ? new Date(r.attendance_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—',
    },
  ]

  if (loading) return <LoadingGuard />

  return (
    <PageLayout
      title="Data Absensi"
      description="Kelola status kehadiran — ubah dropdown untuk menyimpan otomatis"
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

      {message ? <Alert type={message.type}>{message.text}</Alert> : null}

      <DataTable columns={columns} rows={rows} emptyMessage="Tidak ada data siswa untuk filter ini" />
    </PageLayout>
  )
}
