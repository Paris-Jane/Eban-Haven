import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { GraduationCap, Heart, Home, UserCheck, Users } from 'lucide-react'
import { getImpactSnapshots, getImpactSummary, type PublicImpactSnapshot, type PublicImpactSummary } from '../api/impact'
import { SITE_DISPLAY_NAME } from '../site'

const fade = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const crisisStats = [
  { value: '1 in 3', label: 'girls in Ghana experiences physical or sexual violence before age 18' },
  { value: '40%', label: 'of trafficking victims in West Africa are children under 18' },
  { value: '600,000+', label: 'children estimated in situations of child labor in Ghana (global estimates context)' },
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

const moneyPhp = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' })

const btnPrimary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90'
const btnOutline =
  'inline-flex h-11 items-center justify-center rounded-lg border border-primary bg-transparent px-8 text-sm font-medium text-primary transition-colors hover:bg-primary/10'

function buildStats(summary: PublicImpactSummary | null) {
  const base = [
    { icon: Users, color: 'text-primary' as const },
    { icon: Home, color: 'text-accent' as const },
    { icon: GraduationCap, color: 'text-primary' as const },
    { icon: Heart, color: 'text-accent' as const },
    { icon: UserCheck, color: 'text-primary' as const },
    { icon: Users, color: 'text-accent' as const },
  ]
  const labels = [
    'Girls currently in our care (active aggregate)',
    'Active safehouses',
    'School enrollment / progress (avg. %)',
    'Health improvement (avg. score)',
    'Successful family reintegration (rate)',
    'Supporters worldwide',
  ]
  if (!summary) {
    return base.map((b, i) => ({ ...b, value: '—', label: labels[i] ?? '' }))
  }
  return [
    { ...base[0], value: String(summary.activeResidents), label: labels[0] },
    { ...base[1], value: String(summary.safehouseCount), label: labels[1] },
    { ...base[2], value: `${summary.avgEducationProgressPercent.toFixed(0)}%`, label: labels[2] },
    { ...base[3], value: summary.avgHealthScore.toFixed(2), label: labels[3] },
    { ...base[4], value: `${summary.reintegrationSuccessRatePercent.toFixed(0)}%`, label: labels[4] },
    { ...base[5], value: String(summary.supporterCount), label: labels[5] },
  ]
}

export function ImpactPage() {
  const [summary, setSummary] = useState<PublicImpactSummary | null>(null)
  const [snapshots, setSnapshots] = useState<PublicImpactSnapshot[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([getImpactSummary(), getImpactSnapshots()])
      .then(([s, sn]) => {
        if (!cancelled) {
          setSummary(s)
          setSnapshots(sn.slice(0, 14))
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

  const stats = buildStats(summary)

  return (
    <div>
      <section className="relative overflow-hidden py-20 lg:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
            <motion.p variants={fade} className="text-xs font-semibold uppercase tracking-widest text-accent">
              Our impact
            </motion.p>
            <motion.h1 variants={fade} className="mt-3 font-heading text-4xl font-bold text-foreground lg:text-5xl">
              Restoring hope, one life at a time.
            </motion.h1>
            <motion.p variants={fade} className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Every number on this page represents a girl who deserved safety, love, and a future — and found it
              through {SITE_DISPLAY_NAME}. Your generosity makes this possible.
            </motion.p>
            <motion.div variants={fade} className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/login" className={btnPrimary}>
                Donate today
              </Link>
            </motion.div>
            {loadError && (
              <motion.p variants={fade} className="mt-4 text-sm text-destructive">
                {loadError}
              </motion.p>
            )}
          </motion.div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Why this matters</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">
              The crisis facing girls in Ghana
            </h2>
            <p className="mt-4 text-muted-foreground">
              Ghana faces serious risks of child abuse, exploitation, and trafficking. Behind every statistic is a
              child who needed someone to step in. We are that someone — and so are you.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {crisisStats.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-border bg-card p-6 text-center"
              >
                <p className="font-heading text-3xl font-bold text-primary">{c.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{c.label}</p>
              </motion.div>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-3xl text-center text-sm text-muted-foreground">
            The cycle of poverty and abuse is not inevitable. Girls who receive holistic rehabilitation — safe
            housing, counseling, education, and family support — are far more likely to heal and thrive.{' '}
            {SITE_DISPLAY_NAME} exists to make that real.
          </p>
          <div className="mt-10 text-center">
            <Link to="/login" className={btnOutline}>
              Be part of the solution
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Our growth</p>
          <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">
            Girls helped over the years
          </h2>
          <p className="mt-4 text-muted-foreground">
            From a small first cohort to growing safehouse capacity today — every year, more lives change because of
            donors and partners who show up. Live figures below reflect our current operational dataset.
          </p>
        </div>
        <div className="mx-auto mt-14 max-w-6xl px-6 lg:px-8">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-accent">
            By the numbers
          </p>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
            {stats.map((s, t) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: t * 0.06 }}
                className="rounded-2xl border border-border bg-card p-6 text-center lg:p-8"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <s.icon className={`h-6 w-6 ${s.color}`} />
                </div>
                <p className="font-heading text-3xl font-bold text-foreground lg:text-4xl">{s.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </div>
          {summary && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Public monetary support (prior calendar month):{' '}
              <span className="font-medium text-foreground">{moneyPhp.format(summary.donationsLastMonthPhp)}</span>
            </p>
          )}
        </div>
      </section>

      <section className="bg-muted/50 py-20 lg:py-28">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Monthly updates</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">Impact snapshots</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Real stories of progress and milestones your generosity makes possible.
            </p>
          </div>
          <div className="space-y-6">
            {snapshots.length === 0 && !loadError ? (
              <p className="text-center text-sm text-muted-foreground">Loading snapshots…</p>
            ) : (
              snapshots.map((u, t) => (
                <motion.article
                  key={u.id}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: t * 0.04 }}
                  className="rounded-2xl border border-border bg-card p-6 lg:p-8"
                >
                  <span className="text-xs font-medium text-accent">
                    {u.snapshotDate} {u.metrics.month ? `· ${u.metrics.month}` : ''}
                  </span>
                  <h3 className="mt-2 font-heading text-xl font-semibold text-foreground">{u.headline}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{u.summaryText}</p>
                  {Object.keys(u.metrics).length > 0 && (
                    <dl className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      {Object.entries(u.metrics).map(([k, v]) =>
                        v ? (
                          <div key={k}>
                            <dt className="font-medium capitalize text-foreground">{k.replace(/_/g, ' ')}</dt>
                            <dd>{v}</dd>
                          </div>
                        ) : null,
                      )}
                    </dl>
                  )}
                </motion.article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Life inside our homes</p>
          <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">
            A safe place to heal, learn, and grow
          </h2>
          <p className="mt-4 text-muted-foreground">
            Each safehouse is more than shelter — it is a community of healing. Girls receive trauma-informed support,
            attend school, build skills, and are surrounded by caregivers who believe in their futures. Many arrive
            frightened; with consistent care, they begin to laugh, dream, and plan again.
          </p>
          <div className="mt-8">
            <Link to="/login" className={btnPrimary}>
              Help a girl today
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Transparency</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">Every peso counts</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
              We are committed to responsible stewardship. Here is how donations typically support our program areas.
            </p>
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
            {allocation.map((a, t) => (
              <motion.div
                key={a.area}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: t * 0.08 }}
                className="rounded-2xl border border-border bg-card p-8 text-center"
              >
                <p className="font-heading text-4xl font-bold text-primary">{a.pct}</p>
                <p className="mt-2 font-heading text-lg font-semibold text-foreground">{a.area}</p>
                <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary py-20 lg:py-28">
        <div className="mx-auto max-w-3xl px-6 text-center text-primary-foreground lg:px-8">
          <h2 className="font-heading text-3xl font-bold lg:text-4xl">A girl is waiting. Will you answer?</h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/85">
            Your gift — no matter the size — provides safety, healing, and a future for a girl who has nowhere else to
            turn.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/login" className={btnPrimary}>
              Donate now
            </Link>
            <Link
              to="/login"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-primary-foreground/40 bg-transparent px-8 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10"
            >
              Become a monthly supporter
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
