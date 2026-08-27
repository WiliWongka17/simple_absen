import { createContext, useContext } from 'react'

interface FilterBarContextValue {
  date: string
  classId: string
  classes: Array<{ id: string; name: string; grade: string | null }>
}

const FilterBarContext = createContext<FilterBarContextValue | null>(null)

function useFilterBarContext() {
  const ctx = useContext(FilterBarContext)
  if (!ctx) throw new Error('FilterBar compound components must be used within FilterBar')
  return ctx
}

interface FilterBarRootProps extends FilterBarContextValue {
  children: React.ReactNode
  onFilter?: () => void
}

function FilterBarRoot({ children, ...value }: FilterBarRootProps) {
  return (
    <FilterBarContext value={value}>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          {children}
        </div>
      </div>
    </FilterBarContext>
  )
}

function FilterBarDate({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex-1">
      <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
      />
    </div>
  )
}

function FilterBarClass({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { classes } = useFilterBarContext()
  return (
    <div className="flex-1">
      <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
      >
        <option value="">Semua Kelas</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.grade ? c.grade + ' ' : ''}{c.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function FilterBarApply({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
    >
      Filter
    </button>
  )
}

export const FilterBar = {
  Root: FilterBarRoot,
  Date: FilterBarDate,
  Class: FilterBarClass,
  Apply: FilterBarApply,
}
