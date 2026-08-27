'use client'

import { useState } from 'react'
import { useCrudEntity } from '@/hooks/useCrudEntity'
import { useCrudModal } from '@/hooks/useCrudModal'
import { PageLayout } from '@/components/ui/PageLayout'
import { DataTable, Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ModalForm } from '@/components/ui/ModalForm'
import { LoadingGuard } from '@/components/ui/LoadingGuard'

interface Student {
  id: string
  nis: string
  name: string
  is_active: boolean
  class_id: string | null
  classes: { id: string; name: string; grade: string | null } | null
}

interface Class {
  id: string
  name: string
  grade: string | null
}

const columns: Column<Student>[] = [
  { key: 'nis', label: 'NIS', className: 'font-mono text-gray-900' },
  { key: 'name', label: 'Nama', className: 'text-gray-900' },
  {
    key: 'classes',
    label: 'Kelas',
    className: 'text-gray-500',
    render: (s) => s.classes ? `${s.classes.grade ? s.classes.grade + ' ' : ''}${s.classes.name}` : '—',
  },
  {
    key: 'is_active',
    label: 'Status',
    render: (s) => <StatusBadge active={s.is_active} />,
  },
]

export default function SiswaPage() {
  const { items: students, loading, error, create, update, remove } = useCrudEntity<Student>({
    baseUrl: '/api/admin/students',
  })
  const [classes, setClasses] = useState<Class[]>([])
  const [search, setSearch] = useState('')
  const [formData, setFormData] = useState({ nis: '', name: '', class_id: '', is_active: true })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const modal = useCrudModal<Student>()

  const filteredStudents = students.filter(
    (s) =>
      s.nis.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase())
  )

  const loadClasses = async () => {
    if (classes.length > 0) return
    const res = await fetch('/api/admin/classes')
    const data = await res.json()
    if (data.success) setClasses(data.data)
  }

  const openCreate = async () => {
    await loadClasses()
    setFormData({ nis: '', name: '', class_id: '', is_active: true })
    setFormError('')
    modal.openCreate()
  }

  const openEdit = async (student: Student) => {
    await loadClasses()
    setFormData({
      nis: student.nis,
      name: student.name,
      class_id: student.class_id || '',
      is_active: student.is_active,
    })
    setFormError('')
    modal.openEdit(student)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError('')

    const ok = modal.isEdit && modal.editItem
      ? await update(modal.editItem.id, formData)
      : await create(formData)

    if (ok) {
      modal.close()
    } else {
      setFormError(error || 'Terjadi kesalahan')
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus siswa ini?')) return
    await remove(id)
  }

  if (loading) return <LoadingGuard />

  return (
    <PageLayout
      title="Manajemen Siswa"
      description="Kelola data siswa dan kelas"
      action={
        <button
          onClick={openCreate}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Tambah Siswa
        </button>
      }
    >
      <div className="bg-white rounded-lg shadow p-4">
        <input
          type="search"
          placeholder="Cari NIS atau nama..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          aria-label="Cari siswa"
        />
      </div>

      <DataTable
        columns={columns}
        rows={filteredStudents}
        emptyMessage="Tidak ada data siswa"
        renderRowActions={(student) => (
          <>
            <button onClick={() => openEdit(student)} className="text-primary-600 hover:text-primary-900 text-sm font-medium">
              Edit
            </button>
            <button onClick={() => handleDelete(student.id)} className="text-red-600 hover:text-red-900 text-sm font-medium">
              Hapus
            </button>
          </>
        )}
      />

      <ModalForm
        title={modal.isEdit ? 'Edit Siswa' : 'Tambah Siswa'}
        isOpen={modal.mode !== null}
        onClose={modal.close}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={modal.isEdit ? 'Update' : 'Simpan'}
        error={formError}
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">NIS *</label>
          <input
            type="text"
            value={formData.nis}
            onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
            required
            disabled={modal.isEdit}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nama *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
          <select
            value={formData.class_id}
            onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">— Pilih Kelas —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.grade ? c.grade + ' ' : ''}{c.name}
              </option>
            ))}
          </select>
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
      </ModalForm>
    </PageLayout>
  )
}
