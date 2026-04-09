import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { card } from '../../shared/adminStyles'

export type KPICardModel = {
  id: string
  label: string
  value: string
  sublabel?: string
  /** Percentage change vs prior period where applicable */
  deltaPct: number | null
  tone?: 'neutral' | 'positive' | 'negative' | 'alert'
  helper?: string
}

function DeltaBadge({ deltaPct, tone }: { deltaPct: number | null; tone: KPICardModel['tone'] }) {
  if (deltaPct == null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" aria-hidden />
        No comparison
      </span>
    )
  }
  const up = deltaPct > 0.5
  const down = deltaPct < -0.5
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
  const color =
    tone === 'alert'
      ? 'text-amber-700 dark:text-amber-400'
      : tone === 'positive'
        ? up
          ? 'text-emerald-600'
          : down
            ? 'text-rose-600'
            : 'text-muted-foreground'
        : tone === 'negative'
          ? down
            ? 'text-emerald-600'
            : up
              ? 'text-rose-600'
              : 'text-muted-foreground'
          : 'text-muted-foreground'

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${color}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {deltaPct >= 0 ? '+' : ''}
      {deltaPct.toFixed(1)}% vs prior
    </span>
  )
}

export function KPIOverviewCards({ cards }: { cards: KPICardModel[] }) {
  return (
    <section aria-label="Executive KPI overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <article key={c.id} className={`${card} relative flex flex-col gap-2 border-border/80`}>
          {c.tone === 'alert' ? (
            <span className="absolute right-3 top-3 text-amber-600" title="Needs attention">
              <AlertTriangle className="h-4 w-4" aria-hidden />
            </span>
          ) : null}
          <p className="pr-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
          <p className="font-heading text-2xl font-bold tabular-nums text-foreground sm:text-3xl">{c.value}</p>
          {c.sublabel ? <p className="text-xs text-muted-foreground">{c.sublabel}</p> : null}
          <div className="mt-auto pt-1">
            <DeltaBadge deltaPct={c.deltaPct} tone={c.tone} />
          </div>
          {c.helper ? (
            <p className="text-[11px] leading-snug text-muted-foreground" title={c.helper}>
              {c.helper}
            </p>
          ) : null}
        </article>
      ))}
    </section>
  )
}
