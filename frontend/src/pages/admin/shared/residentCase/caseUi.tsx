import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { btnPrimary, card, input, label, pageDesc } from '../adminStyles'

export function CaseDrawer({
  title,
  children,
  footer,
  onClose,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-foreground/40 backdrop-blur-[1px]" role="dialog" aria-modal="true">
      <button type="button" className="h-full min-w-0 flex-1 cursor-default" aria-label="Close panel" onClick={onClose} />
      <div
        className={`${card} flex h-full w-full max-w-lg flex-col overflow-hidden rounded-none border-l shadow-xl sm:max-w-xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-border px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  )
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? <p className={`${pageDesc} mt-1 max-w-xl`}>{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function RecordCardRow({
  children,
  onClick,
  highlight,
}: {
  children: ReactNode
  onClick: () => void
  highlight?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 ${
        highlight ? 'border-amber-400/60 bg-amber-500/5' : 'border-border bg-card'
      }`}
    >
      {children}
    </button>
  )
}

export function ToggleField({
  labelText,
  value,
  onChange,
}: {
  labelText: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
      <span className="text-sm font-medium text-foreground">{labelText}</span>
      <div className="inline-flex rounded-md border border-border bg-background p-0.5">
        <button
          type="button"
          className={`rounded px-2.5 py-1 text-xs font-medium ${value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          onClick={() => onChange(true)}
        >
          Yes
        </button>
        <button
          type="button"
          className={`rounded px-2.5 py-1 text-xs font-medium ${!value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          onClick={() => onChange(false)}
        >
          No
        </button>
      </div>
    </div>
  )
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className={label}>
      Search
      <input type="search" className={input} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? 'Filter…'} />
    </label>
  )
}

export function QuickActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={`${btnPrimary} whitespace-nowrap text-sm`} onClick={onClick}>
      {children}
    </button>
  )
}

export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
