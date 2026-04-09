import { Link } from 'react-router-dom'
import { Lightbulb } from 'lucide-react'
import { btnPrimary, card } from '../../shared/adminStyles'

export type InsightCallout = {
  id: string
  text: string
  variant?: 'default' | 'warning' | 'success'
}

export type InsightAction = { id: string; label: string; to?: string; onClick?: () => void }

type Props = {
  callouts: InsightCallout[]
  actions: InsightAction[]
}

export function InsightsSummaryPanel({ callouts, actions }: Props) {
  return (
    <aside className={`${card} border-primary/20 bg-gradient-to-br from-card to-primary/[0.03]`}>
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">Insight summary</h2>
      </div>
      <ul className="mt-4 space-y-2 text-sm leading-relaxed">
        {callouts.map((c) => (
          <li
            key={c.id}
            className={`rounded-lg border px-3 py-2.5 ${
              c.variant === 'warning'
                ? 'border-amber-200/80 bg-amber-50/50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100'
                : c.variant === 'success'
                  ? 'border-emerald-200/80 bg-emerald-50/40 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100'
                  : 'border-border bg-muted/30 text-foreground'
            }`}
          >
            {c.text}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap gap-2">
        {actions.map((a) =>
          a.onClick ? (
            <button key={a.id} type="button" className={`${btnPrimary} px-3 py-2 text-xs`} onClick={a.onClick}>
              {a.label}
            </button>
          ) : a.to ? (
            <Link key={a.id} to={a.to} className={`${btnPrimary} px-3 py-2 text-xs`}>
              {a.label}
            </Link>
          ) : null,
        )}
      </div>
    </aside>
  )
}
