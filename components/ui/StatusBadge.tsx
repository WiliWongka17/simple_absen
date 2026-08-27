'use client'

type StatusBadgeProps =
  | { active: boolean }
  | { status: 'HADIR' | 'TERLAMBAT' | 'DITOLAK' | string }

const activeMap: Record<string, { text: string; className: string }> = {
  true: { text: 'Aktif', className: 'bg-green-100 text-green-800' },
  false: { text: 'Nonaktif', className: 'bg-red-100 text-red-800' },
}

const statusMap: Record<string, { className: string }> = {
  HADIR: { className: 'bg-green-100 text-green-800' },
  TERLAMBAT: { className: 'bg-yellow-100 text-yellow-800' },
  DITOLAK: { className: 'bg-red-100 text-red-800' },
}

export function StatusBadge(props: StatusBadgeProps) {
  if ('active' in props) {
    const config = activeMap[String(props.active)]
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
        {config.text}
      </span>
    )
  }

  const config = statusMap[props.status] ?? { className: 'bg-gray-100 text-gray-800' }
  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
      {props.status}
    </span>
  )
}
