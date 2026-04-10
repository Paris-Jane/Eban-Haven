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

/** Multiple series sharing the same x-axis labels (e.g. wellbeing scores over time). Skips null gaps per series. */
export function SimpleMultiLineChart({
  labels,
  series,
  formatY,
  height = 220,
  ariaLabel,
  yMin,
  yMax,
}: {
  labels: string[]
  series: {
    key: string
    name: string
    strokeClass: string
    fillClass: string
    legendClass: string
    values: (number | null)[]
  }[]
  formatY: (n: number) => string
  height?: number
  ariaLabel: string
  yMin?: number
  yMax?: number
}) {
  if (labels.length === 0) return null
  const flat = series.flatMap((s) => s.values.filter((v): v is number => v != null && Number.isFinite(v)))
  const minV = yMin ?? (flat.length ? Math.min(...flat, 1) : 1)
  const maxV = yMax ?? (flat.length ? Math.max(...flat, 5) : 5)
  const span = Math.max(maxV - minV, 0.01)
  const w = 400
  const pad = 28
  const innerW = w - pad * 2
  const innerH = height - pad * 2
  const n = labels.length

  function xAt(i: number) {
    return pad + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  }
  function yAt(val: number) {
    return pad + innerH - ((val - minV) / span) * innerH
  }

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
        <title>{ariaLabel}</title>
        <text x={pad} y={16} className="fill-muted-foreground text-[10px]">
          {formatY(maxV)} – {formatY(minV)}
        </text>
        {series.map((s) => {
          const segments: string[] = []
          let d = ''
          for (let i = 0; i < n; i++) {
            const v = s.values[i]
            if (v == null || !Number.isFinite(v)) {
              if (d) {
                segments.push(d)
                d = ''
              }
              continue
            }
            const x = xAt(i)
            const y = yAt(v)
            d += d === '' ? `M ${x} ${y}` : ` L ${x} ${y}`
          }
          if (d) segments.push(d)
          return segments.map((pathD, segIdx) => (
            <path
              key={`${s.key}-${segIdx}`}
              d={pathD}
              fill="none"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={s.strokeClass}
            />
          ))
        })}
        {series.map((s) =>
          s.values.map((v, i) => {
            if (v == null || !Number.isFinite(v)) return null
            return <circle key={`${s.key}-pt-${i}`} cx={xAt(i)} cy={yAt(v)} r="3.5" className={s.fillClass} />
          }),
        )}
        {labels.map((lab, i) => (
          <text key={`${lab}-${i}`} x={xAt(i)} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[8px]">
            {lab}
          </text>
        ))}
      </svg>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" aria-label="Legend">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className={`h-2 w-4 shrink-0 rounded-sm ${s.legendClass}`} />
            <span className="text-muted-foreground">{s.name}</span>
          </li>
        ))}
      </ul>
    </div>
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
