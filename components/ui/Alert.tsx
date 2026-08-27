const typeStyles = {
  success: 'bg-green-50 text-green-800 border border-green-200',
  error: 'bg-red-50 text-red-800 border border-red-200',
  info: 'bg-blue-50 text-blue-800 border border-blue-200',
}

interface AlertProps {
  type: keyof typeof typeStyles
  children: React.ReactNode
}

export function Alert({ type, children }: AlertProps) {
  return (
    <div className={`p-4 rounded-lg text-sm ${typeStyles[type]}`}>
      {children}
    </div>
  )
}
