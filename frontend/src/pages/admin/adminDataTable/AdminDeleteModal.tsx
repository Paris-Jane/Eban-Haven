import { btnPrimary, card } from '../adminStyles'

type AdminDeleteModalProps = {
  open: boolean
  title: string
  /** Main explanation (already includes count if needed). */
  body: string
  /** Optional bullet list preview (names, codes, etc.). */
  previewLines?: string[]
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function AdminDeleteModal({
  open,
  title,
  body,
  previewLines,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  loading,
  onCancel,
  onConfirm,
}: AdminDeleteModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-[2px]">
      <div
        className={`${card} w-full max-w-md shadow-lg`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-delete-title"
      >
        <p id="admin-delete-title" className="text-base font-semibold text-foreground">
          {title}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        {previewLines && previewLines.length > 0 && (
          <ul className="mt-3 max-h-40 list-inside list-disc overflow-y-auto rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
            {previewLines.map((line, i) => (
              <li key={i} className="truncate">
                {line}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-destructive">This cannot be undone.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            className={`${btnPrimary} bg-destructive text-destructive-foreground hover:opacity-90`}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? 'Deleting…' : confirmLabel}
          </button>
          <button
            type="button"
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
