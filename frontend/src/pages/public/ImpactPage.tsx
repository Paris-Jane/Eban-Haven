import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  GraduationCap,
  HandHeart,
  Heart,
  Home,
  Quote,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '../../components/ui/button'
import { getImpactSnapshots, getImpactSummary, type PublicImpactSnapshot, type PublicImpactSummary } from '../../api/impact'
import { SITE_DISPLAY_NAME } from '../../site'

/**
 * Impact page — layout matches https://haven-hope-flow.base44.app/impact (Haven of Hope reference).
 * Hero copy preserved per product request. KPIs, growth line, and optional snapshot metrics come from
 * /api/impact/summary and published public_impact_snapshots (who_*, outcome_* keys).
 */

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: 'easeOut' as const } },
}

const stagger = { visible: { transition: { staggerChildren: 0.1 } } }

const HERO_IMG = 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1600&q=80'
const QUOTE_BREAK_IMG = 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=1600&q=80'
const LIFE_IMG_A = 'https://images.unsplash.com/photo-1526976668912-1a811878dd37?w=600&q=80'
const LIFE_IMG_B = 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&q=80'
const FINAL_CTA_IMG = 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1400&q=80'

const problemStats = [
  { value: '1 in 3', label: 'girls in Ghana experiences violence before age 18' },
  { value: '40%', label: 'of trafficking victims in West Africa are children' },
  { value: '600K+', label: 'children in estimated forced labor in Ghana' },
  { value: '72%', label: 'of survivors have no access to rehabilitation' },
] as const

const allocationData = [
  { area: 'Wellbeing & Counseling', pct: 45, desc: 'Trauma therapy, health care, nutrition' },
  { area: 'Education', pct: 30, desc: 'School enrollment, tutoring, vocational training' },
  { area: 'Operations', pct: 25, desc: 'Safehouse maintenance, staff, transport' },
] as const

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-5))',
]

/** Reference-style category mix when snapshot `who_*` metrics are not published yet. */
const caseCategoriesFallback = [
  { name: 'Abandoned / Neglected', value: 38 },
  { name: 'Trafficking', value: 27 },
  { name: 'Physical Abuse', value: 21 },
  { name: 'Sexual Abuse', value: 14 },
]

const outcomeFallback = [
  { category: 'Family Reintegration', pct: 72 },
  { category: 'Independent Living', pct: 14 },
  { category: 'Foster / Adoption', pct: 9 },
  { category: 'Ongoing Care', pct: 5 },
]

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 10,
  fontSize: 13,
} as const

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
      const label = date.getFullYear().toString()
      return { month, label, value }
    })
    .filter((point): point is GrowthPoint => point != null)
    .sort((a, b) => a.month.localeCompare(b.month))
}

/** One point per calendar year (latest snapshot value per year) for a YoY-style line like the reference. */
function growthPointsByYear(snapshots: PublicImpactSnapshot[]) {
  const points = parseGrowthPoints(snapshots)
  const byYear = new Map<string, GrowthPoint>()
  for (const p of points) {
    const y = p.month.slice(0, 4)
    const prev = byYear.get(y)
    if (!prev || p.month > prev.month) byYear.set(y, { ...p, label: y })
  }
  return [...byYear.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export function ImpactPage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<PublicImpactSummary | null>(null)
  const [snapshots, setSnapshots] = useState<PublicImpactSnapshot[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

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

  const caseCategories = useMemo(() => {
    if (whoRows.length >= 2) return whoRows.map((r) => ({ name: r.label, value: r.value }))
    return caseCategoriesFallback
  }, [whoRows])

  const usingWhoFallback = whoRows.length < 2

  const yearlyGrowth = useMemo(() => growthPointsByYear(snapshots), [snapshots])

  const girlsHelpedData = useMemo(() => {
    if (yearlyGrowth.length > 0) return yearlyGrowth.map((p) => ({ year: p.label, girls: p.value }))
    return [
      { year: '2019', girls: 18 },
      { year: '2020', girls: 31 },
      { year: '2021', girls: 47 },
      { year: '2022', girls: 68 },
      { year: '2023', girls: 102 },
      { year: '2024', girls: 138 },
      { year: '2025', girls: 156 },
    ]
  }, [yearlyGrowth])

  const usingGrowthFallback = yearlyGrowth.length === 0

  const growthNarrative = useMemo(() => {
    const pts = yearlyGrowth
    if (pts.length < 2) return null
    const first = pts[0].value
    const last = pts[pts.length - 1].value
    if (first <= 0) return null
    const pct = Math.round(((last - first) / first) * 100)
    return { first, last, pct, fromY: pts[0].label, toY: pts[pts.length - 1].label }
  }, [yearlyGrowth])

  const outcomeData = useMemo(() => {
    if (outcomeRows.length > 0) return outcomeRows.map((r) => ({ category: r.label, pct: r.value }))
    if (summary) {
      const r = Math.min(100, Math.max(0, summary.reintegrationSuccessRatePercent))
      return [
        { category: 'Successful reintegration (program)', pct: r },
        { category: 'Ongoing / other pathways', pct: Math.max(0, 100 - r) },
      ]
    }
    return outcomeFallback.map((x) => ({ ...x }))
  }, [outcomeRows, summary])

  const usingOutcomeFallback = outcomeRows.length === 0

  const healthPct = summary
    ? Math.min(100, Math.round((summary.avgHealthScore / 5) * 100))
    : null

  const keyMetrics = useMemo(() => {
    if (!summary) {
      return [
        { icon: Users, value: '—', label: 'Girls Currently in Our Care' },
        { icon: Home, value: '—', label: 'Active Safehouses' },
        { icon: GraduationCap, value: '—', label: 'School Enrollment Rate' },
        { icon: Heart, value: '—', label: 'Health Improvement Rate' },
        { icon: TrendingUp, value: '—', label: 'Successful Reintegration' },
        { icon: ShieldCheck, value: '—', label: 'Supporters Worldwide' },
      ]
    }
    return [
      { icon: Users, value: String(summary.activeResidents), label: 'Girls Currently in Our Care' },
      { icon: Home, value: String(summary.safehouseCount), label: 'Active Safehouses' },
      {
        icon: GraduationCap,
        value: `${summary.avgEducationProgressPercent.toFixed(0)}%`,
        label: 'School Enrollment Rate',
      },
      {
        icon: Heart,
        value: healthPct != null ? `${healthPct}%` : '—',
        label: 'Health Improvement Rate',
      },
      {
        icon: TrendingUp,
        value: `${summary.reintegrationSuccessRatePercent.toFixed(0)}%`,
        label: 'Successful Reintegration',
      },
      { icon: ShieldCheck, value: `${summary.supporterCount}+`, label: 'Supporters Worldwide' },
    ]
  }, [summary, healthPct])

  const handleDonate = () => navigate('/login')

  return (
    <div className="bg-background">
      {/* ── HERO (wording: current product hero; layout: reference) ── */}
      <section className="relative overflow-hidden py-28 lg:py-40">
        <div className="absolute inset-0">
          <img src={HERO_IMG} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/90 via-foreground/65 to-foreground/20" />
        </div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-2xl">
            <motion.span
              variants={fadeUp}
              className="mb-4 inline-block text-xs font-semibold uppercase tracking-widest text-accent"
            >
              Our Impact
            </motion.span>
            <motion.h1
              variants={fadeUp}
              className="font-heading text-5xl font-bold leading-tight text-white lg:text-6xl"
            >
              Restoring hope,
              <br />
              one life at a time.
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
              Every number on this page represents a girl who deserved safety, love, and a future — and found it through{' '}
              {SITE_DISPLAY_NAME}. Your generosity makes this possible.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-9 flex flex-wrap gap-4">
              <Button
                size="lg"
                type="button"
                onClick={handleDonate}
                className="gap-2 bg-accent px-8 text-base text-accent-foreground hover:bg-accent/90"
              >
                <HandHeart className="h-5 w-5" /> Donate Today
              </Button>
              <a
                href="#data"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/30 bg-transparent px-8 text-base font-medium text-white transition-colors hover:bg-white/10"
              >
                Explore the Data <ArrowRight className="h-4 w-4" />
              </a>
            </motion.div>
            {loadError ? (
              <motion.p variants={fadeUp} className="mt-4 text-sm text-destructive">
                {loadError}
              </motion.p>
            ) : null}
          </motion.div>
        </div>
      </section>

      {/* ── KEY METRICS STRIP ── */}
      <section id="data" className="scroll-mt-20 bg-primary py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 text-center sm:grid-cols-3 lg:grid-cols-6">
            {keyMetrics.map((m, i) => (
              <motion.div
                key={m.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } },
                }}
              >
                <p className="font-heading text-3xl font-bold text-white lg:text-4xl">{m.value}</p>
                <p className="mt-1 text-xs leading-snug text-white/70">{m.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THE PROBLEM ── */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
              <div className="mb-4 inline-flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-widest">The Problem We&apos;re Solving</span>
              </div>
              <h2 className="font-heading text-3xl font-bold leading-tight text-foreground lg:text-4xl">
                A silent crisis facing girls in Ghana
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Behind every statistic is a child who needed someone to step in. Poverty, abuse, and neglect trap girls
                in cycles that are hard to break alone — but intervention works. {SITE_DISPLAY_NAME} exists to make that
                intervention a reality.
              </p>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Research shows girls who receive holistic rehabilitation are{' '}
                <strong className="text-foreground">3× more likely</strong> to break the cycle of abuse and lead
                healthy, independent lives.
              </p>
              <div className="mt-7">
                <Button type="button" onClick={handleDonate} className="gap-2 bg-destructive text-white hover:bg-destructive/90">
                  <HandHeart className="h-4 w-4" /> Make a Difference
                </Button>
              </div>
            </motion.div>
            <div className="grid grid-cols-2 gap-4">
              {problemStats.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={{
                    hidden: { opacity: 0, scale: 0.95 },
                    visible: { opacity: 1, scale: 1, transition: { duration: 0.45, delay: i * 0.1 } },
                  }}
                  className="rounded-2xl border border-destructive/20 bg-destructive/8 p-6 text-center"
                >
                  <p className="font-heading text-3xl font-bold text-destructive">{s.value}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FULL-BLEED PHOTO BREAK ── */}
      <div className="relative h-72 overflow-hidden lg:h-96">
        <img src={QUOTE_BREAK_IMG} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-7xl p-8 lg:p-12">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="flex items-start gap-4"
          >
            <Quote className="mt-1 h-8 w-8 shrink-0 fill-current text-accent" aria-hidden />
            <p className="max-w-2xl font-heading text-xl font-medium leading-snug text-white lg:text-2xl">
              &ldquo;Every girl who walks through our doors deserves to know she is worth saving.&rdquo;
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── GROWTH CHART ── */}
      <section className="bg-muted/40 py-20 lg:py-28">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-10 text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Year-over-Year Growth</span>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">Girls reached since 2019</h2>
            {growthNarrative ? (
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                From <strong className="text-foreground">{growthNarrative.first}</strong> in {growthNarrative.fromY} to{' '}
                <strong className="text-foreground">{growthNarrative.last}</strong> in {growthNarrative.toY}
                {growthNarrative.pct > 0 ? (
                  <>
                    {' '}
                    — a <strong>{growthNarrative.pct}%</strong> increase in lives touched (published data).
                  </>
                ) : (
                  '.'
                )}
              </p>
            ) : (
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                {usingGrowthFallback
                  ? 'Illustrative trend shown — connect published snapshots with total_residents in metrics for your live curve.'
                  : 'Add more yearly snapshot points to show growth narrative.'}
              </p>
            )}
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="rounded-2xl border border-border bg-card p-6 lg:p-10"
          >
            <div className="h-80 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={girlsHelpedData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="year" tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number | string) => [`${v} girls`, 'Girls helped']}
                  />
                  <Line
                    type="monotone"
                    dataKey="girls"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ r: 5, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── OUTCOMES ── */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-12 text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Anonymized Outcomes</span>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">
              What happens after rehabilitation?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Outcome data from all closed cases — aggregated and anonymized to protect privacy.
              {usingOutcomeFallback && outcomeRows.length === 0 && summary ? (
                <span className="block pt-2 text-xs">
                  Showing program reintegration rate vs. remainder; add <code className="rounded bg-muted px-1">outcome_*</code>{' '}
                  snapshot fields for a full breakdown.
                </span>
              ) : null}
              {usingOutcomeFallback && !summary ? (
                <span className="block pt-2 text-xs">Illustrative distribution until live data loads.</span>
              ) : null}
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="rounded-2xl border border-border bg-card p-6 lg:p-8"
          >
            <h3 className="mb-1 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
              <BarChart2 className="h-4 w-4 text-primary" aria-hidden />
              Post-Rehabilitation Outcomes
            </h3>
            <p className="mb-6 text-xs text-muted-foreground">% of girls by outcome upon case closure</p>
            <div className="h-60 w-full min-w-0 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={outcomeData} layout="vertical" margin={{ left: 10, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    unit="%"
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={155}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    formatter={(v: number | string) => [`${v}%`, 'Share']}
                    contentStyle={{ ...tooltipStyle, fontSize: 12 }}
                  />
                  <Bar dataKey="pct" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── WHO WE SERVE ── */}
      <section className="bg-muted/30 py-20 lg:py-28">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-10 text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Who We Serve</span>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">The girls who come to us</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Girls arrive from a range of difficult circumstances. Understanding the types of harm they&apos;ve faced
              helps us provide the right care.
            </p>
            {usingWhoFallback ? (
              <p className="mx-auto mt-3 max-w-lg text-xs text-muted-foreground">
                Chart shows reference-style categories until published snapshots include <code className="rounded bg-muted px-1">who_*</code>{' '}
                percentage fields.
              </p>
            ) : null}
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="rounded-2xl border border-border bg-card p-6 lg:p-8"
          >
            <div className="flex flex-col items-center gap-8 sm:flex-row">
              <div className="h-56 w-56 shrink-0 sm:h-[220px] sm:w-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={caseCategories}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={98}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {caseCategories.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number | string) => [`${v}%`, 'Share']}
                      contentStyle={{ ...tooltipStyle, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full flex-1 space-y-3">
                {caseCategories.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="flex-1 text-sm text-muted-foreground">{c.name}</span>
                    <div className="h-2 max-w-32 flex-1 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${c.value}%`, background: COLORS[i % COLORS.length] }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-semibold text-foreground">{c.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── PHOTO STORY BREAK ── */}
      <section className="bg-secondary/50 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div className="order-2 grid grid-cols-2 gap-4 lg:order-1">
              <motion.img
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                src={LIFE_IMG_A}
                alt=""
                className="h-52 w-full rounded-2xl object-cover lg:h-64"
              />
              <motion.img
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.15 }}
                src={LIFE_IMG_B}
                alt=""
                className="mt-6 h-52 w-full rounded-2xl object-cover lg:h-64"
              />
            </div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="order-1 lg:order-2"
            >
              <span className="text-xs font-semibold uppercase tracking-widest text-accent">Life Inside Our Homes</span>
              <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">
                A safe place to heal, learn, and grow
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Each of our safehouses is more than shelter — it&apos;s a community of healing. Girls receive
                trauma-informed therapy, attend school, learn vocational skills, and are surrounded by caregivers who
                believe in their futures.
              </p>
              <ul className="mt-5 space-y-3">
                {[
                  'Individual and group counseling sessions',
                  'Bridge and secondary education programs',
                  'Vocational and livelihood training',
                  'Monthly health and nutrition monitoring',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <Button type="button" onClick={handleDonate} className="gap-2">
                  <HandHeart className="h-4 w-4" /> Help a Girl Today <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FUND ALLOCATION ── */}
      <section className="bg-primary py-20 text-white lg:py-28">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-14 text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Financial Transparency</span>
            <h2 className="mt-3 font-heading text-3xl font-bold text-white lg:text-4xl">Where your donation goes</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/70">
              We are committed to responsible stewardship. Every peso is accounted for.
            </p>
            {summary != null && summary.donationsLastMonthPhp > 0 ? (
              <p className="mx-auto mt-4 max-w-xl text-sm text-white/60">
                Last month: approximately ₱{summary.donationsLastMonthPhp.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
                in recorded monetary gifts ({SITE_DISPLAY_NAME} impact API).
              </p>
            ) : null}
          </motion.div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {allocationData.map((item, i) => (
              <motion.div
                key={item.area}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } },
                }}
                className="rounded-2xl border border-white/20 bg-white/10 p-8 text-center backdrop-blur-sm"
              >
                <div className="relative mx-auto mb-5 h-28 w-28">
                  <svg viewBox="0 0 36 36" className="h-28 w-28 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9"
                      fill="none"
                      stroke="hsl(var(--accent))"
                      strokeWidth="3"
                      strokeDasharray={`${item.pct} ${100 - item.pct}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-heading text-2xl font-bold text-white">
                    {item.pct}%
                  </span>
                </div>
                <p className="font-heading text-lg font-semibold text-white">{item.area}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/60">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative overflow-hidden py-24 lg:py-36">
        <div className="absolute inset-0">
          <img src={FINAL_CTA_IMG} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-foreground/80" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <Heart className="mx-auto mb-6 h-10 w-10 fill-current text-accent" aria-hidden />
            <h2 className="font-heading text-3xl font-bold leading-tight text-white lg:text-5xl">
              The data is clear.
              <br />
              Your gift changes lives.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/75">
              Behind every percentage on this page is a girl who found safety, healing, and a future. Join hundreds of
              supporters making it possible.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Button
                size="lg"
                type="button"
                onClick={handleDonate}
                className="gap-2 bg-accent px-8 text-base text-accent-foreground hover:bg-accent/90"
              >
                <HandHeart className="h-5 w-5" /> Donate Now
              </Button>
              <Button
                size="lg"
                type="button"
                variant="outline"
                onClick={handleDonate}
                className="border-white/30 bg-transparent px-8 text-base text-white hover:bg-white/10"
              >
                Become a Monthly Supporter <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
