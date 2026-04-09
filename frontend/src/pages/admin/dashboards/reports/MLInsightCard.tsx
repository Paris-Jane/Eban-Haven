import { Link } from 'react-router-dom'
import { AlertTriangle, BrainCircuit } from 'lucide-react'
import { btnPrimary, card } from '../../shared/adminStyles'

export type MLTopCase = {
  id: string
  title: string
  detail: string
  href?: string
  actionLabel?: string
}

type Props = {
  title: string
  subtitle: string
  /** e.g. "Model-assisted · not a guarantee" */
  statusLabel: string
  summaryMetric: string
  summaryCaption: string
  /** Optional simple distribution bars */
  distribution?: { label: string; count: number; colorClass: string }[]
  topCases: MLTopCase[]
  disclaimer?: string
}

export function MLInsightCard({
  title,
  subtitle,
  statusLabel,
  summaryMetric,
  summaryCaption,
  distribution,
  topCases,
  disclaimer = 'Predictions support prioritization only. Always apply clinical and relationship judgment.',
}: Props) {
  const maxD = Math.max(...(distribution?.map((d) => d.count) ?? [0]), 1)

  return (
    <section className={`${card} border-primary/15 bg-gradient-to-br from-card to-primary/[0.04]`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-background/80 px-4 py-3">
        <p className="font-heading text-3xl font-bold tabular-nums text-foreground">{summaryMetric}</p>
        <p className="mt-1 text-xs text-muted-foreground">{summaryCaption}</p>
      </div>

      {distribution && distribution.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Distribution</p>
          {distribution.map((d) => (
            <div key={d.label}>
              <div className="mb-0.5 flex justify-between text-[11px]">
                <span className="text-foreground">{d.label}</span>
                <span className="tabular-nums text-muted-foreground">{d.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${d.colorClass}`} style={{ width: `${(d.count / maxD) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {topCases.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Needs attention</p>
          <ul className="mt-2 space-y-2">
            {topCases.slice(0, 5).map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">{c.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>
                {c.href ? (
                  <Link to={c.href} className={`${btnPrimary} mt-2 inline-block px-3 py-1.5 text-xs`}>
                    {c.actionLabel ?? 'Review'}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">{disclaimer}</p>
    </section>
  )
}
