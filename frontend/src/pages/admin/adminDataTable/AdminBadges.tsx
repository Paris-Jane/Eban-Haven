import type { ReactNode } from 'react'

const pill = 'inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight'

export function NeutralPill({ children }: { children: ReactNode }) {
  return <span className={`${pill} bg-muted/80 text-muted-foreground`}>{children}</span>
}

export function MutedTinyPill({ children }: { children: ReactNode }) {
  return <span className={`${pill} border border-border/80 bg-background text-muted-foreground`}>{children}</span>
}

/** Status / plan-style values — muted, accessible colors */
export function StatusBadge({ status }: { status: string }) {
  const s = status.trim()
  const lower = s.toLowerCase()
  let cls = `${pill} bg-slate-500/15 text-slate-700 dark:text-slate-200`
  if (lower === 'active' || lower === 'achieved' || lower === 'completed')
    cls = `${pill} bg-emerald-500/15 text-emerald-800 dark:text-emerald-200`
  else if (lower === 'in progress' || lower.includes('progress'))
    cls = `${pill} bg-amber-500/15 text-amber-900 dark:text-amber-200`
  else if (lower === 'on hold' || lower === 'inactive' || lower === 'not started' || lower === 'not achieved')
    cls = `${pill} bg-zinc-500/15 text-zinc-700 dark:text-zinc-200`
  else if (lower === 'open') cls = `${pill} bg-sky-500/15 text-sky-900 dark:text-sky-200`
  else if (lower === 'closed') cls = `${pill} bg-zinc-600/20 text-zinc-800 dark:text-zinc-100`
  return <span className={cls}>{s}</span>
}

export function RiskBadge({ level }: { level: string }) {
  const s = level.trim()
  const lower = s.toLowerCase()
  let cls = `${pill} bg-zinc-500/15 text-zinc-700 dark:text-zinc-200`
  if (lower === 'low') cls = `${pill} bg-emerald-500/15 text-emerald-800 dark:text-emerald-200`
  else if (lower === 'medium') cls = `${pill} bg-amber-500/15 text-amber-900 dark:text-amber-200`
  else if (lower === 'high' || lower === 'critical') cls = `${pill} bg-rose-500/15 text-rose-900 dark:text-rose-200`
  return <span className={cls}>{s}</span>
}

export function BoolPill({ value }: { value: boolean }) {
  if (value) {
    return (
      <span className={`${pill} bg-emerald-500/15 text-emerald-800 dark:text-emerald-200`}>Yes</span>
    )
  }
  return <span className={`${pill} bg-muted/90 text-muted-foreground`}>No</span>
}

/** Visit outcome — heuristic coloring for common phrases */
export function VisitOutcomeBadge({ outcome }: { outcome: string }) {
  const s = outcome.trim()
  if (!s) return <span className="text-muted-foreground">—</span>
  const lower = s.toLowerCase()
  if (lower.includes('success') || lower.includes('positive') || lower.includes('completed'))
    return <span className={`${pill} bg-emerald-500/15 text-emerald-800 dark:text-emerald-200`}>{s}</span>
  if (lower.includes('concern') || lower.includes('risk') || lower.includes('negative'))
    return <span className={`${pill} bg-rose-500/15 text-rose-900 dark:text-rose-200`}>{s}</span>
  return <NeutralPill>{s}</NeutralPill>
}
