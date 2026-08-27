'use client'

import { useState } from 'react'
import { useCrudEntity } from '@/hooks/useCrudEntity'
import { useCrudModal } from '@/hooks/useCrudModal'
import { PageLayout } from '@/components/ui/PageLayout'
import { DataTable, Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ModalForm } from '@/components/ui/ModalForm'
import { LoadingGuard } from '@/components/ui/LoadingGuard'

interface Class {
  id: string
  name: string
  grade: string | null
  is_active: boolean
}

const columns: Column<Class>[] = [
  { key: 'name', label: 'Nama Kelas', className: 'font-medium text-gray-900' },
  { key: 'grade', label: 'Tingkat', className: 'text-gray-500', render: (c) => c.grade || '—' },
  {
    key: 'is_active',
    label: 'Status',
    render: (c) => <StatusBadge active={c.is_active} />,
  },
]

export default function KelasPage() {
  const { items: classes, loading, error, create, update, remove } = useCrudEntity<Class>({
    baseUrl: '/api/admin/classes',
  })
  const [formData, setFormData] = useState({ name: '', grade: '', is_active: true })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const modal = useCrudModal<Class>()

  const openCreate = () => {
    setFormData({ name: '', grade: '', is_active: true })
    setFormError('')
    modal.openCreate()
  }

  const openEdit = (cls: Class) => {
    setFormData({ name: cls.name, grade: cls.grade || '', is_active: cls.is_active })
    setFormError('')
    modal.openEdit(cls)
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
    if (!confirm('Hapus kelas ini? Siswa di kelas ini akan kehilangan kelas.')) return
    await remove(id)
  }

  if (loading) return <LoadingGuard />

  return (
    <PageLayout
      title="Manajemen Kelas"
      description="Kelola data kelas dan tingkat"
      action={
        <button
          onClick={openCreate}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Tambah Kelas
        </button>
      }
    >
      <DataTable
        columns={columns}
        rows={classes}
        emptyMessage="Tidak ada data kelas"
        renderRowActions={(cls) => (
          <>
            <button onClick={() => openEdit(cls)} className="text-primary-600 hover:text-primary-900 text-sm font-medium">
              Edit
            </button>
            <button onClick={() => handleDelete(cls.id)} className="text-red-600 hover:text-red-900 text-sm font-medium">
              Hapus
            </button>
          </>
        )}
      />

      <ModalForm
        title={modal.isEdit ? 'Edit Kelas' : 'Tambah Kelas'}
        isOpen={modal.mode !== null}
        onClose={modal.close}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={modal.isEdit ? 'Update' : 'Simpan'}
        error={formError}
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kelas *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Contoh: IPA 1"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tingkat</label>
          <select
            value={formData.grade}
            onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">— Pilih Tingkat —</option>
            <option value="X">X</option>
            <option value="XI">XI</option>
            <option value="XII">XII</option>
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
