interface PageLayoutProps {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}

export function PageLayout({ title, description, action, children }: PageLayoutProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description ? <p className="text-gray-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
