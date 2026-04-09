import { BarChart3 } from 'lucide-react'

type Props = {
  title?: string
  description?: string
  className?: string
}

export function ReportEmptyState({
  title = 'No data for this view',
  description = 'Try widening the date range or clearing filters. If the program is new, metrics will appear as you add records.',
  className = '',
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center ${className}`}
      role="status"
    >
      <BarChart3 className="h-10 w-10 text-muted-foreground/50" aria-hidden />
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
