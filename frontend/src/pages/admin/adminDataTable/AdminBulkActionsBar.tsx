import { Trash2 } from 'lucide-react'
import { btnPrimary } from '../adminStyles'

export function AdminBulkActionsBar({
  count,
  recordLabel,
  onDeleteClick,
  onClearSelection,
  disabled,
}: {
  count: number
  /** e.g. "supporter", "donation" */
  recordLabel: string
  onDeleteClick: () => void
  onClearSelection: () => void
  disabled?: boolean
}) {
  if (count < 1) return null
  const plural = count === 1 ? recordLabel : `${recordLabel}s`
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm shadow-sm">
      <span className="font-medium text-foreground">
        {count} {plural} selected
      </span>
      <button
        type="button"
        className={`${btnPrimary} inline-flex items-center gap-2 bg-destructive text-destructive-foreground hover:opacity-90`}
        disabled={disabled}
        onClick={onDeleteClick}
      >
        <Trash2 className="h-4 w-4" />
        Delete selected…
      </button>
      <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={onClearSelection}>
        Clear selection
      </button>
    </div>
  )
}
