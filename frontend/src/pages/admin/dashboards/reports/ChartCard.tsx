import type { ReactNode } from 'react'
import { card, sectionFormTitle } from '../../shared/adminStyles'

type ChartCardProps = {
  title: string
  description?: string
  helperText?: string
  children: ReactNode
  className?: string
  /** Optional actions (e.g. drill-down) */
  actions?: ReactNode
}

export function ChartCard({ title, description, helperText, children, className = '', actions }: ChartCardProps) {
  return (
    <section className={`${card} flex flex-col gap-3 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className={sectionFormTitle}>{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          {helperText ? (
            <p className="mt-1 text-xs text-muted-foreground" title={helperText}>
              {helperText}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

type LinePt = { x: number; y: number; label: string }

/** Lightweight SVG line chart — no external chart library. */
export function SimpleLineChart({
  points,
  formatY,
  height = 200,
  ariaLabel,
}: {
  points: { label: string; value: number }[]
  formatY: (n: number) => string
  height?: number
  ariaLabel: string
}) {
  if (points.length === 0) return null
  const vals = points.map((p) => p.value)
  const max = Math.max(...vals, 1)
  const min = Math.min(...vals, 0)
  const span = Math.max(max - min, 1)
  const w = 400
  const pad = 24
  const innerW = w - pad * 2
  const innerH = height - pad * 2
  const pts: LinePt[] = points.map((p, i) => {
    const x = pad + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
    const y = pad + innerH - ((p.value - min) / span) * innerH
    return { x, y, label: p.label }
  })
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className="h-auto w-full text-primary"
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
      />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" className="fill-primary" />
          <text x={p.x} y={height - 4} textAnchor="middle" className="fill-muted-foreground text-[9px]">
            {p.label}
          </text>
        </g>
      ))}
      <text x={pad} y={14} className="fill-muted-foreground text-[10px]">
        {formatY(max)} – {formatY(min)}
      </text>
    </svg>
  )
}

type BarRow = { key: string; label: string; value: number; sublabel?: string }

export function SimpleHorizontalBarChart({
  rows,
  formatValue,
  onBarClick,
  ariaLabel,
}: {
  rows: BarRow[]
  formatValue: (n: number) => string
  onBarClick?: (key: string) => void
  ariaLabel: string
}) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="space-y-3" role="list" aria-label={ariaLabel}>
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex justify-between gap-2 text-xs">
            <span className="min-w-0 truncate font-medium text-foreground">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatValue(r.value)}</span>
          </div>
          {r.sublabel ? <p className="mb-1 text-[11px] text-muted-foreground">{r.sublabel}</p> : null}
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <button
              type="button"
              className="h-full min-w-[4px] rounded-full bg-gradient-to-r from-primary/90 to-primary transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-100"
              style={{ width: `${Math.max(8, (r.value / max) * 100)}%` }}
              onClick={() => onBarClick?.(r.key)}
              disabled={!onBarClick}
              aria-label={`${r.label}: ${formatValue(r.value)}`}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Stacked segments as horizontal bar (percent-based). */
export function SimpleStackedBar({
  segments,
  ariaLabel,
}: {
  segments: { key: string; label: string; pct: number; className: string }[]
  ariaLabel: string
}) {
  const total = segments.reduce((s, x) => s + x.pct, 0) || 1
  return (
    <div
      className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={ariaLabel}
    >
      {segments.map((s) => (
        <div
          key={s.key}
          className={s.className}
          style={{ width: `${(s.pct / total) * 100}%` }}
          title={`${s.label}: ${((s.pct / total) * 100).toFixed(0)}%`}
        />
      ))}
    </div>
  )
}
