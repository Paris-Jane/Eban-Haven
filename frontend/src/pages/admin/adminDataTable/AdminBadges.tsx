import type { ReactNode } from 'react'

/** Compact but at least 12px for legibility; border helps separate from row backgrounds */
const pill =
  'inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-xs font-medium leading-snug'

export function NeutralPill({ children }: { children: ReactNode }) {
  return (
    <span
      className={`${pill} border-zinc-200/90 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100`}
    >
      {children}
    </span>
  )
}

export function MutedTinyPill({ children }: { children: ReactNode }) {
  return (
    <span
      className={`${pill} border-border bg-background text-foreground/90 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-100`}
    >
      {children}
    </span>
  )
}

/** Status / plan-style values — WCAG-friendly contrast on light and dark */
export function StatusBadge({ status }: { status: string }) {
  const s = status.trim()
  const lower = s.toLowerCase()
  let cls = `${pill} border-slate-200 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50`
  if (lower === 'active' || lower === 'achieved' || lower === 'completed')
    cls = `${pill} border-emerald-300/80 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-50`
  else if (lower === 'in progress' || lower.includes('progress'))
    cls = `${pill} border-amber-300/80 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50`
  else if (lower === 'on hold' || lower === 'inactive' || lower === 'not started' || lower === 'not achieved')
    cls = `${pill} border-zinc-300/80 bg-zinc-200 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50`
  else if (lower === 'open')
    cls = `${pill} border-sky-300/80 bg-sky-100 text-sky-950 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-50`
  else if (lower === 'closed')
    cls = `${pill} border-zinc-400/70 bg-zinc-300 text-zinc-950 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-100`
  return <span className={cls}>{s}</span>
}

export function RiskBadge({ level }: { level: string }) {
  const s = level.trim()
  const lower = s.toLowerCase()
  let cls = `${pill} border-zinc-300/80 bg-zinc-200 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50`
  if (lower === 'low')
    cls = `${pill} border-emerald-300/80 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-50`
  else if (lower === 'medium')
    cls = `${pill} border-amber-300/80 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50`
  else if (lower === 'high' || lower === 'critical')
    cls = `${pill} border-rose-400/80 bg-rose-100 text-rose-950 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-50`
  return <span className={cls}>{s}</span>
}

export function BoolPill({ value }: { value: boolean }) {
  if (value) {
    return (
      <span
        className={`${pill} border-emerald-300/80 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-50`}
      >
        Yes
      </span>
    )
  }
  return (
    <span
      className={`${pill} border-zinc-300/80 bg-zinc-200 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100`}
    >
      No
    </span>
  )
}

/** Visit outcome — heuristic coloring for common phrases */
export function VisitOutcomeBadge({ outcome }: { outcome: string }) {
  const s = outcome.trim()
  if (!s) return <span className="text-muted-foreground">—</span>
  const lower = s.toLowerCase()
  if (lower.includes('success') || lower.includes('positive') || lower.includes('completed'))
    return (
      <span
        className={`${pill} border-emerald-300/80 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-50`}
      >
        {s}
      </span>
    )
  if (lower.includes('concern') || lower.includes('risk') || lower.includes('negative'))
    return (
      <span
        className={`${pill} border-rose-400/80 bg-rose-100 text-rose-950 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-50`}
      >
        {s}
      </span>
    )
  return <NeutralPill>{s}</NeutralPill>
}
