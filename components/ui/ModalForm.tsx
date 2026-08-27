interface ModalFormProps {
  title: string
  isOpen: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  submitting?: boolean
  submitLabel?: string
  children: React.ReactNode
  error?: string
}

export function ModalForm({
  title,
  isOpen,
  onClose,
  onSubmit,
  submitting = false,
  submitLabel = 'Simpan',
  children,
  error,
}: ModalFormProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            aria-label="Tutup"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
          {children}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
