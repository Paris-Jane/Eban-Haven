import type { ReactNode } from 'react'
import type { ReportTabId } from './reportTypes'

const TAB_DEF: { id: ReportTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'donors', label: 'Donors & Donations' },
  { id: 'residents', label: 'Residents & Outcomes' },
  { id: 'safehouses', label: 'Safehouses' },
  { id: 'social', label: 'Social Media' },
  { id: 'impact', label: 'Impact Reporting' },
]

type Props = {
  active: ReportTabId
  onChange: (id: ReportTabId) => void
  children: ReactNode
}

export function ReportsTabs({ active, onChange, children }: Props) {
  return (
    <div>
      <div
        role="tablist"
        aria-label="Report sections"
        className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/30 p-1"
      >
        {TAB_DEF.map((t) => {
          const selected = active === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`report-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`report-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/80 hover:text-foreground'
              }`}
              onClick={() => onChange(t.id)}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  )
}

export function ReportTabPanel({ id, active, children }: { id: ReportTabId; active: ReportTabId; children: ReactNode }) {
  if (id !== active) return null
  return (
    <div
      role="tabpanel"
      id={`report-panel-${id}`}
      aria-labelledby={`report-tab-${id}`}
      className="space-y-6"
    >
      {children}
    </div>
  )
}
