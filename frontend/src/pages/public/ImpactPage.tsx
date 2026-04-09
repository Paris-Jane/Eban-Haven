import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Heart, Quote } from 'lucide-react'
import { getImpactSnapshots, getImpactSummary, type PublicImpactSnapshot, type PublicImpactSummary } from '../../api/impact'
import { IMAGES, SITE_DISPLAY_NAME } from '../../site'

/**
 * Public impact page — layout and narrative aligned with the reference flow at
 * https://haven-hope-flow.base44.app/impact while using live Eban Haven API data.
 *
 * Optional snapshot metrics (published `public_impact_snapshots.metrics`):
 * - Keys prefixed `who_` with numeric values → “Who we serve” bars (e.g. who_abandoned → 38).
 * - Keys prefixed `outcome_` with numeric values → “Post-rehab outcomes” bars.
 */

const fade = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
}

const crisisStats = [
  { value: '1 in 3', label: 'girls in Ghana experiences physical or sexual violence before age 18' },
  { value: '40%', label: 'of trafficking victims in West Africa are children under 18' },
  { value: '600K+', label: 'children estimated in situations of child labor in Ghana (regional context)' },
  { value: '72%', label: 'of survivors lack consistent access to formal rehabilitation services' },
] as const

const allocation = [
  {
    pct: '45%',
    area: 'Wellbeing & counseling',
    desc: 'Trauma-informed therapy, health services, and nutritional support for every resident.',
  },
  {
    pct: '30%',
    area: 'Education',
    desc: 'School enrollment, bridge programs, vocational training, and tutoring.',
  },
  {
    pct: '25%',
    area: 'Operations',
    desc: 'Safehouse maintenance, dedicated staff, transport, and administration.',
  },
] as const

const lifeBullets = [
  'Individual and group counseling sessions',
  'Bridge and secondary education programs',
  'Vocational and livelihood training',
  'Monthly health and nutrition monitoring',
] as const

const btnPrimary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-92'
const btnSecondary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full border-2 border-primary bg-transparent px-7 text-sm font-semibold text-primary transition-colors hover:bg-primary/8'

function formatMetricKey(key: string) {
  return key
    .replace(/^who_/i, '')
    .replace(/^outcome_/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function parseMetricBars(metrics: Record<string, string | undefined>, prefix: 'who_' | 'outcome_') {
  const rows: { key: string; label: string; value: number }[] = []
  for (const [k, raw] of Object.entries(metrics)) {
    if (!k.toLowerCase().startsWith(prefix) || raw == null) continue
    const n = Number(String(raw).replace(/%/g, '').trim())
    if (!Number.isFinite(n) || n < 0) continue
    rows.push({ key: k, label: formatMetricKey(k), value: n > 1 && n <= 100 ? n : Math.min(100, n) })
  }
  return rows.sort((a, b) => b.value - a.value)
}

type GrowthPoint = { month: string; label: string; value: number }

function parseGrowthPoints(snapshots: PublicImpactSnapshot[]) {
  return snapshots
    .map((snapshot) => {
      const month = snapshot.metrics.month ?? snapshot.snapshotDate.slice(0, 7)
      const raw = snapshot.metrics.total_residents
      const value = raw ? Number(raw) : Number.NaN
      if (!Number.isFinite(value)) return null
      const date = new Date(`${month}-01`)
      const label = date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
      return { month, label, value }
    })
    .filter((point): point is GrowthPoint => point != null)
    .sort((a, b) => a.month.localeCompare(b.month))
}

function buildTrendChart(points: GrowthPoint[]) {
  const width = 720
  const height = 240
  const padX = 36
  const padTop = 20
  const padBot = 44
  if (points.length === 0) {
    return { path: '', areaPath: '', pts: [] as { x: number; y: number; label: string }[], width, height, padBot }
  }
  const vals = points.map((p) => p.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const lo = min === max ? Math.max(0, min - 1) : min
  const hi = min === max ? max + 1 : max
  const span = Math.max(hi - lo, 1)
  const innerH = height - padTop - padBot
  const innerW = width - padX * 2
  const pts = points.map((p, i) => {
    const x = padX + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
    const y = padTop + (1 - (p.value - lo) / span) * innerH
    return { x, y, label: p.label }
  })
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const last = pts[pts.length - 1]
  const first = pts[0]
  const areaPath = `${path} L ${last?.x ?? padX} ${height - padBot} L ${first?.x ?? padX} ${height - padBot} Z`
  return { path, areaPath, pts, width, height, padBot }
}

function HorizontalBars({
  rows,
  ariaLabel,
  unitSuffix = '%',
}: {
  rows: { label: string; value: number }[]
  ariaLabel: string
  unitSuffix?: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No breakdown available for this period.</p>
  }
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="space-y-4" role="list" aria-label={ariaLabel}>
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium text-foreground">{r.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {r.value.toFixed(0)}
              {unitSuffix}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              style={{ width: `${Math.max(6, (r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ImpactPage() {
  const [summary, setSummary] = useState<PublicImpactSummary | null>(null)
  const [snapshots, setSnapshots] = useState<PublicImpactSnapshot[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const exploreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([getImpactSummary(), getImpactSnapshots()])
      .then(([s, sn]) => {
        if (!cancelled) {
          setSummary(s)
          setSnapshots(sn)
          setLoadError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load impact data.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const latestSnapshot = useMemo(
    () =>
      [...snapshots].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate)).find((s) => s.isPublished) ??
      [...snapshots].sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))[0],
    [snapshots],
  )

  const whoRows = useMemo(
    () => (latestSnapshot ? parseMetricBars(latestSnapshot.metrics, 'who_') : []),
    [latestSnapshot],
  )
  const outcomeRows = useMemo(
    () => (latestSnapshot ? parseMetricBars(latestSnapshot.metrics, 'outcome_') : []),
    [latestSnapshot],
  )

  const growthPoints = useMemo(() => parseGrowthPoints(snapshots).slice(-14), [snapshots])
  const chart = useMemo(() => buildTrendChart(growthPoints), [growthPoints])

  const growthNarrative = useMemo(() => {
    if (growthPoints.length < 2) return null
    const first = growthPoints[0].value
    const last = growthPoints[growthPoints.length - 1].value
    if (first <= 0) return null
    const pct = Math.round(((last - first) / first) * 100)
    return {
      first,
      last,
      pct,
      fromLabel: growthPoints[0].label,
      toLabel: growthPoints[growthPoints.length - 1].label,
    }
  }, [growthPoints])

  const healthDisplay = summary
    ? `${Math.min(100, Math.round((summary.avgHealthScore / 5) * 100))}%`
    : '—'

  const kpi = summary
    ? [
        { value: String(summary.activeResidents), label: 'Girls currently in our care' },
        { value: String(summary.safehouseCount), label: 'Active safehouses' },
        { value: `${summary.avgEducationProgressPercent.toFixed(0)}%`, label: 'School progress average' },
        { value: healthDisplay, label: 'Wellbeing score (scaled to 100%)' },
        { value: `${summary.reintegrationSuccessRatePercent.toFixed(0)}%`, label: 'Successful reintegration' },
        { value: `${summary.supporterCount}+`, label: 'Supporters in our community' },
      ]
    : [
        { value: '—', label: 'Girls currently in our care' },
        { value: '—', label: 'Active safehouses' },
        { value: '—', label: 'School progress average' },
        { value: '—', label: 'Wellbeing score (scaled to 100%)' },
        { value: '—', label: 'Successful reintegration' },
        { value: '—', label: 'Supporters in our community' },
      ]

  const fallbackOutcomeRows = summary
    ? [{ label: 'Reintegration success (program)', value: summary.reintegrationSuccessRatePercent }]
    : []

  const outcomeBars = outcomeRows.length > 0 ? outcomeRows.map((r) => ({ label: r.label, value: r.value })) : fallbackOutcomeRows

  return (
    <div className="bg-background">
      {/* Hero — reference: "Every girl deserves to be counted." */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center lg:py-28 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
            <motion.p variants={fade} className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              Our impact
            </motion.p>
            <motion.h1
              variants={fade}
              className="mt-5 font-heading text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem]"
            >
              Every girl deserves
              <br />
              <span className="text-primary">to be counted.</span>
            </motion.h1>
            <motion.p variants={fade} className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Every chart on this page represents real outcomes from {SITE_DISPLAY_NAME} — transparent numbers from our own
              systems, not placeholders. When you give, you can see what your support helps sustain.
            </motion.p>
            <motion.div variants={fade} className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link to="/login" className={btnPrimary}>
                Donate today
              </Link>
              <button
                type="button"
                className={btnSecondary}
                onClick={() => exploreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                Explore the data
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </motion.div>
            {loadError ? (
              <motion.p variants={fade} className="mt-6 text-sm text-destructive">
                {loadError}
              </motion.p>
            ) : null}
          </motion.div>
        </div>
      </section>

      {/* KPI grid — reference six headline stats */}
      <section ref={exploreRef} id="impact-by-numbers" className="scroll-mt-20 border-b border-border bg-muted/30 py-14 lg:py-20">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kpi.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm"
              >
                <p className="font-heading text-4xl font-bold text-primary sm:text-5xl">{item.value}</p>
                <p className="mt-3 text-sm font-medium leading-snug text-foreground">{item.label}</p>
              </motion.div>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted-foreground">
            Live figures from <code className="rounded bg-muted px-1 py-0.5">/api/impact/summary</code>. Wellbeing uses average
            health score on a 1–5 scale, shown as an equivalent percentage for easier reading.
          </p>
        </div>
      </section>

      {/* Problem */}
      <section className="border-b border-border py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">The problem we&apos;re solving</p>
            <h2 className="mt-4 font-heading text-3xl font-bold text-foreground lg:text-4xl">
              A silent crisis facing girls in Ghana
            </h2>
            <p className="mt-4 text-muted-foreground">
              Behind every statistic is a child who needed someone to step in. Poverty, abuse, and neglect trap girls in
              cycles that are hard to break alone — but intervention works. {SITE_DISPLAY_NAME} exists to make that
              intervention real.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Research shows girls who receive holistic rehabilitation are far more likely to break the cycle of abuse and
              lead healthy, independent lives.
            </p>
            <Link to="/login" className={`${btnPrimary} mt-8`}>
              Make a difference
            </Link>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {crisisStats.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl border border-border bg-card p-6 text-center"
              >
                <p className="font-heading text-3xl font-bold text-primary">{c.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{c.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="border-b border-border bg-primary py-14 text-primary-foreground lg:py-20">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <Quote className="mx-auto h-10 w-10 opacity-80" aria-hidden />
          <blockquote className="mt-6 font-heading text-xl font-semibold leading-relaxed sm:text-2xl">
            &ldquo;Every girl who walks through our doors deserves to know she is worth saving.&rdquo;
          </blockquote>
          <p className="mt-4 text-sm text-primary-foreground/80">— {SITE_DISPLAY_NAME} care team</p>
        </div>
      </section>

      {/* YoY / growth */}
      <section className="border-b border-border py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Year-over-year growth</p>
            <h2 className="mt-4 font-heading text-3xl font-bold text-foreground lg:text-4xl">Girls reached over time</h2>
            {growthNarrative ? (
              <p className="mt-4 text-muted-foreground">
                From <span className="font-semibold text-foreground">{growthNarrative.first}</span> in{' '}
                {growthNarrative.fromLabel} to <span className="font-semibold text-foreground">{growthNarrative.last}</span>{' '}
                in {growthNarrative.toLabel}
                {growthNarrative.pct > 0 ? (
                  <>
                    {' '}
                    — a <span className="font-semibold text-primary">{growthNarrative.pct}%</span> increase in lives
                    touched (published snapshots).
                  </>
                ) : (
                  '.'
                )}
              </p>
            ) : (
              <p className="mt-4 text-muted-foreground">
                When published monthly snapshots include <code className="rounded bg-muted px-1">total_residents</code>, we
                chart growth here automatically.
              </p>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10"
          >
            {growthPoints.length > 0 ? (
              <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-72 w-full" aria-label="Girls reached over time">
                <title>Girls reached over time</title>
                <path d={chart.areaPath} fill="hsl(var(--primary) / 0.12)" />
                <path
                  d={chart.path}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {chart.pts.map((p) => (
                  <g key={p.label}>
                    <circle cx={p.x} cy={p.y} r="5" className="fill-accent" />
                    <text
                      x={p.x}
                      y={chart.height - 12}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[11px]"
                    >
                      {p.label}
                    </text>
                  </g>
                ))}
              </svg>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 py-16 text-center text-sm text-muted-foreground">
                No published growth snapshots yet. Add rows to <code className="rounded bg-muted px-1">public_impact_snapshots</code>{' '}
                with <code className="rounded bg-muted px-1">total_residents</code> in metrics to populate this chart.
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Anonymized outcomes */}
      <section className="border-b border-border bg-muted/25 py-16 lg:py-24">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-primary">Anonymized outcomes</p>
          <h2 className="mt-4 text-center font-heading text-3xl font-bold text-foreground lg:text-4xl">
            What happens after rehabilitation?
          </h2>
          <p className="mt-4 text-center text-muted-foreground">
            Outcome data from published snapshots — aggregated to protect privacy. Add{' '}
            <code className="rounded bg-muted px-1">outcome_*</code> keys to snapshot metrics for a full breakdown.
          </p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-10 rounded-3xl border border-border bg-card p-8 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-foreground">Post-rehabilitation outcomes</h3>
            <p className="mt-1 text-xs text-muted-foreground">% of girls by outcome (where data exists)</p>
            <div className="mt-8">
              <HorizontalBars rows={outcomeBars} ariaLabel="Outcome distribution" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Who we serve */}
      <section className="border-b border-border py-16 lg:py-24">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-primary">Who we serve</p>
          <h2 className="mt-4 text-center font-heading text-3xl font-bold text-foreground lg:text-4xl">
            The girls who come to us
          </h2>
          <p className="mt-4 text-center text-muted-foreground">
            Understanding the types of harm girls have faced helps us provide the right care. Publish{' '}
            <code className="rounded bg-muted px-1">who_*</code> percentage fields in snapshot metrics to replace static
            examples.
          </p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-10 rounded-3xl border border-border bg-card p-8 shadow-sm"
          >
            {whoRows.length > 0 ? (
              <HorizontalBars rows={whoRows.map((r) => ({ label: r.label, value: r.value }))} ariaLabel="Who we serve" />
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
                <p>
                  Publish percentage fields in snapshot <code className="rounded bg-muted px-1">metrics</code> using keys
                  like <code className="rounded bg-muted px-1">who_abandoned</code>,{' '}
                  <code className="rounded bg-muted px-1">who_trafficking</code>, etc., and they will appear here
                  automatically — no code change required.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Life inside */}
      <section className="border-b border-border py-16 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Life inside our homes</p>
            <h2 className="mt-4 font-heading text-3xl font-bold text-foreground lg:text-4xl">
              A safe place to heal, learn, and grow
            </h2>
            <p className="mt-4 text-muted-foreground">
              Each safehouse is more than shelter — it&apos;s a community of healing. Girls receive trauma-informed
              support, attend school, build skills, and are surrounded by caregivers who believe in their futures.
            </p>
            <ul className="mt-8 space-y-3">
              {lifeBullets.map((line) => (
                <li key={line} className="flex gap-3 text-sm text-foreground">
                  <Heart className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <Link to="/login" className={`${btnPrimary} mt-10`}>
              Help a girl today
            </Link>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="overflow-hidden rounded-3xl border border-border shadow-md"
          >
            <img
              src={IMAGES.mission}
              alt="Young people and caregivers in a supportive group setting"
              className="aspect-[4/3] h-full w-full object-cover"
            />
          </motion.div>
        </div>
      </section>

      {/* Transparency */}
      <section className="bg-muted/40 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Financial transparency</p>
            <h2 className="mt-4 font-heading text-3xl font-bold text-foreground lg:text-4xl">Where your donation goes</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              We are committed to responsible stewardship. Every cedi and peso is accounted for. Typical allocation:
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
            {allocation.map((a, t) => (
              <motion.div
                key={a.area}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: t * 0.06 }}
                className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm"
              >
                <p className="font-heading text-4xl font-bold text-primary">{a.pct}</p>
                <p className="mt-2 font-heading text-lg font-semibold text-foreground">{a.area}</p>
                <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
              </motion.div>
            ))}
          </div>
          {summary != null && summary.donationsLastMonthPhp > 0 ? (
            <p className="mt-10 text-center text-sm text-muted-foreground">
              Last month, supporters gave approximately{' '}
              <span className="font-semibold text-foreground">
                ₱{summary.donationsLastMonthPhp.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>{' '}
              in recorded monetary gifts (from impact summary).
            </p>
          ) : null}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <h2 className="font-heading text-3xl font-bold text-foreground lg:text-4xl">
            The data is clear.
            <br />
            <span className="text-primary">Your gift changes lives.</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Behind every percentage is a girl who found safety, healing, and a future. Join our supporters making it
            possible.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/login" className={btnPrimary}>
              Donate now
            </Link>
            <Link to="/login" className={btnSecondary}>
              Become a monthly supporter
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
