export interface Column<T> {
  key: string
  label: string
  className?: string
  render?: (row: T, index: number) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  emptyMessage?: string
  renderRowActions?: (row: T) => React.ReactNode
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  emptyMessage = 'Tidak ada data',
  renderRowActions,
}: DataTableProps<T>) {
  const colCount = columns.length + (renderRowActions ? 1 : 0)

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.className ?? ''}`}
                >
                  {col.label}
                </th>
              ))}
              {renderRowActions && (
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-sm ${col.className ?? 'text-gray-900'}`}>
                      {col.render
                        ? col.render(row, index)
                        : (row as any)[col.key]}
                    </td>
                  ))}
                  {renderRowActions && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {renderRowActions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
