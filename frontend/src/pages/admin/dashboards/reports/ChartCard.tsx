import type { ReactNode } from 'react'
import { useState } from 'react'
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
  chartCaption,
}: {
  points: { label: string; value: number }[]
  formatY: (n: number) => string
  height?: number
  ariaLabel: string
  /** Shown above the chart (e.g. axis / metric title). */
  chartCaption?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
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
    <div className="space-y-2">
      {chartCaption ? <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{chartCaption}</p> : null}
      <div className="relative rounded-lg border border-border/50 bg-muted/15 p-2" onMouseLeave={() => setHover(null)}>
        {hover != null && points[hover] ? (
          <div
            className="pointer-events-none absolute left-3 top-10 z-10 max-w-[14rem] rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md"
            role="status"
          >
            <p className="font-semibold text-foreground">{points[hover].label}</p>
            <p className="mt-0.5 tabular-nums text-muted-foreground">{formatY(points[hover].value)}</p>
          </div>
        ) : null}
        <svg
          viewBox={`0 0 ${w} ${height}`}
          className="h-auto w-full text-primary"
          role="img"
          aria-label={ariaLabel}
        >
          <title>{ariaLabel}</title>
          <text x={pad} y={14} className="fill-muted-foreground text-[10px]">
            {formatY(max)} – {formatY(min)}
          </text>
          <path
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          />
          {pts.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r="14"
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHover(i)}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={hover === i ? 6 : 4}
                className="fill-primary transition-[r] duration-150"
              />
              <text x={p.x} y={height - 4} textAnchor="middle" className="fill-muted-foreground text-[9px] pointer-events-none">
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
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
  variant = 'default',
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
  /** `minimal`: flat white-friendly panel, lighter grid — for embedded resident health cards. */
  variant?: 'default' | 'minimal'
}) {
  const [hoverI, setHoverI] = useState<number | null>(null)
  if (labels.length === 0) return null
  const flat = series.flatMap((s) => s.values.filter((v): v is number => v != null && Number.isFinite(v)))
  const minV = yMin ?? (flat.length ? Math.min(...flat, 1) : 1)
  const maxV = yMax ?? (flat.length ? Math.max(...flat, 5) : 5)
  const span = Math.max(maxV - minV, 0.01)
  const w = 400
  const pad = variant === 'minimal' ? 32 : 28
  const bottomPad = variant === 'minimal' ? 26 : 22
  const innerW = w - pad * 2
  const innerH = height - pad - bottomPad
  const n = labels.length

  function xAt(i: number) {
    return pad + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  }
  function yAt(val: number) {
    return pad + innerH - ((val - minV) / span) * innerH
  }

  const bandW = n <= 1 ? innerW : innerW / (n - 1)

  const surfaceClass =
    variant === 'minimal'
      ? 'relative rounded-md p-1'
      : 'relative rounded-xl border border-border/60 bg-gradient-to-b from-muted/25 to-muted/5 p-3 shadow-sm'

  const gridStroke = variant === 'minimal' ? 'stroke-border/30' : 'stroke-border/40'
  const scaleTextClass = variant === 'minimal' ? 'fill-muted-foreground/80 text-[9px]' : 'fill-muted-foreground text-[10px]'
  const xLabelClass =
    variant === 'minimal'
      ? 'fill-muted-foreground text-[9px] pointer-events-none'
      : 'fill-muted-foreground text-[8px] pointer-events-none'

  return (
    <div className={variant === 'minimal' ? 'space-y-2' : 'space-y-3'}>
      <div className={surfaceClass} onMouseLeave={() => setHoverI(null)}>
        {hoverI != null && labels[hoverI] ? (
          <div
            className="pointer-events-none absolute right-3 top-3 z-10 max-w-[16rem] rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-md backdrop-blur-sm"
            role="status"
          >
            <p className="font-semibold text-foreground">{labels[hoverI]}</p>
            <ul className="mt-1.5 space-y-0.5">
              {series.map((s) => {
                const v = s.values[hoverI]
                if (v == null || !Number.isFinite(v)) return null
                return (
                  <li key={s.key} className="flex justify-between gap-3 tabular-nums">
                    <span className="text-muted-foreground">{s.name}</span>
                    <span className="font-medium text-foreground">{formatY(v)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
        <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
          <title>{ariaLabel}</title>
          {variant === 'minimal' ? (
            <line x1={pad} y1={pad} x2={pad} y2={pad + innerH} className="stroke-border/40" strokeWidth="1" />
          ) : null}
          <text x={variant === 'minimal' ? pad + 4 : pad} y={variant === 'minimal' ? 14 : 16} className={scaleTextClass}>
            {variant === 'minimal' ? `${formatY(maxV)} → ${formatY(minV)}` : `Scale ${formatY(maxV)} – ${formatY(minV)}`}
          </text>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = pad + innerH * (1 - t)
            return (
              <line
                key={t}
                x1={pad}
                y1={y}
                x2={w - pad}
                y2={y}
                className={gridStroke}
                strokeWidth="1"
                strokeDasharray={variant === 'minimal' ? '2 5' : '4 6'}
              />
            )
          })}
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
                strokeWidth={variant === 'minimal' ? 2.25 : 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={s.strokeClass}
                opacity={variant === 'minimal' ? 0.92 : 1}
              />
            ))
          })}
          {series.map((s) =>
            s.values.map((v, i) => {
              if (v == null || !Number.isFinite(v)) return null
              const r = hoverI === i ? 5 : 3.5
              return <circle key={`${s.key}-pt-${i}`} cx={xAt(i)} cy={yAt(v)} r={r} className={s.fillClass} />
            }),
          )}
          {labels.map((lab, i) => (
            <text key={`${lab}-${i}`} x={xAt(i)} y={height - 6} textAnchor="middle" className={xLabelClass}>
              {lab}
            </text>
          ))}
          {labels.map((_, i) => (
            <rect
              key={`band-${i}`}
              x={xAt(i) - bandW / 2}
              y={pad}
              width={bandW}
              height={innerH}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => setHoverI(i)}
            />
          ))}
        </svg>
      </div>
      <ul
        className={`flex flex-wrap gap-x-3 gap-y-1 ${variant === 'minimal' ? 'text-[10px]' : 'text-[11px]'}`}
        aria-label="Legend"
      >
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-3.5 shrink-0 rounded-full ${s.legendClass}`} />
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
