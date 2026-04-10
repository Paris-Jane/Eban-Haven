import { useEffect, useMemo, useState } from 'react'
import { BarChart3, HeartPulse, Home, Sparkles, TrendingUp, Users, Waypoints } from 'lucide-react'
import { getDashboard, getReportsSummary, type DashboardSummary, type ReportsSummary } from '../../../api/admin'
import { alertError, card, statCardInner, statCardSub, statCardValue } from '../shared/adminStyles'
import { formatUsd, formatUsdCompact } from '../../../utils/currency'

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value))
}

function formatMonthLabel(month: string) {
  const date = new Date(`${month}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return month
  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

export function ReportsPage() {
  const [reports, setReports] = useState<ReportsSummary | null>(null)
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const [reportsSummary, dashboardSummary] = await Promise.all([getReportsSummary(), getDashboard()])
        if (!cancelled) {
          setReports(reportsSummary)
          setDashboard(dashboardSummary)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load reports')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const donationTrends = useMemo(() => reports?.donationTrends.slice(-12) ?? [], [reports])
  const latestTrend = donationTrends[donationTrends.length - 1]
  const previousTrend = donationTrends[donationTrends.length - 2]
  const changePercent =
    latestTrend && previousTrend && previousTrend.monetaryTotalPhp > 0
      ? ((latestTrend.monetaryTotalPhp - previousTrend.monetaryTotalPhp) / previousTrend.monetaryTotalPhp) * 100
      : null

  if (loading) return <p className="text-muted-foreground">Loading reports…</p>

  if (error || !reports || !dashboard) {
    return <div className={alertError}>{error ?? 'No report data available.'}</div>
  }

  const maxTrend = Math.max(...donationTrends.map((t) => t.monetaryTotalPhp), 1)
  const strongestSafehouse = [...reports.safehousePerformance].sort(
    (a, b) =>
      (b.avgEducationProgress ?? 0) + (b.avgHealthScore ?? 0) - ((a.avgEducationProgress ?? 0) + (a.avgHealthScore ?? 0)),
  )[0]
  const highestOccupancy = [...reports.safehousePerformance].sort((a, b) => b.occupancyRatePercent - a.occupancyRatePercent)[0]
  const totalServicePillars =
    reports.annualAccomplishmentStyle.servicesProvided.caringSessions +
    reports.annualAccomplishmentStyle.servicesProvided.healingSessions +
    reports.annualAccomplishmentStyle.servicesProvided.teachingSessions

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-[radial-gradient(circle_at_top_left,_rgba(21,128,61,0.12),_transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,94,89,0.94))] px-6 py-7 text-white lg:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
                <BarChart3 className="h-3.5 w-3.5" />
                Reports & analytics
              </div>
              <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                Program performance, donor momentum, and outcome reporting in one place
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
                Review donation movement over time, resident outcome signals, safehouse comparisons, reintegration
                progress, and an Annual Accomplishment Report style summary aligned to caring, healing, and teaching services.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[34rem]">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Residents served</p>
                <p className="mt-2 text-3xl font-bold">{reports.annualAccomplishmentStyle.beneficiaryResidentsServed}</p>
                <p className="mt-1 text-xs text-white/65">Active {reports.activeResidents} · Closed {reports.closedResidents}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Monetary giving</p>
                <p className="mt-2 text-3xl font-bold">{formatUsdCompact(reports.totalMonetaryDonationsPhp)}</p>
                <p className="mt-1 text-xs text-white/65">
                  {changePercent != null
                    ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}% vs prior month`
                    : 'Trend comparison available as data grows'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Reintegration success</p>
                <p className="mt-2 text-3xl font-bold">{dashboard.reintegration.successRatePercent.toFixed(0)}%</p>
                <p className="mt-1 text-xs text-white/65">
                  Completed {dashboard.reintegration.completedCount} · In progress {dashboard.reintegration.inProgressCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 bg-card px-6 py-6 md:grid-cols-2 xl:grid-cols-4 xl:px-8">
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className={statCardInner}>Education progress</p>
            <p className={statCardValue}>{reports.outcomeMetrics.avgEducationProgressPercent.toFixed(1)}%</p>
            <p className={statCardSub}>{reports.outcomeMetrics.educationRecordsCount} progress records logged</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className={statCardInner}>Health improvement</p>
            <p className={statCardValue}>{reports.outcomeMetrics.avgHealthScore.toFixed(2)}</p>
            <p className={statCardSub}>{reports.outcomeMetrics.healthRecordsCount} wellbeing records logged</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className={statCardInner}>Service touchpoints</p>
            <p className={statCardValue}>{totalServicePillars}</p>
            <p className={statCardSub}>Caring, healing, and teaching sessions combined</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className={statCardInner}>Case documentation</p>
            <p className={statCardValue}>{reports.processRecordingsCount}</p>
            <p className={statCardSub}>Process recording entries across the program</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(21rem,0.95fr)]">
        <div className={`${card} space-y-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Donation trends over time</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Monthly monetary contributions and gift count trends to support campaign timing, stewardship, and budget planning.
              </p>
            </div>
            {latestTrend ? (
              <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest month</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{formatUsd(latestTrend.monetaryTotalPhp)}</p>
                <p className="text-xs text-muted-foreground">{latestTrend.donationCount} gifts recorded</p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_14rem]">
            <div className="rounded-2xl border border-border bg-background/70 p-4">
              <div className="flex h-64 items-end gap-3">
                {donationTrends.map((trend) => {
                  const height = `${Math.max((trend.monetaryTotalPhp / maxTrend) * 100, 8)}%`
                  return (
                    <div key={trend.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <div className="relative flex h-full w-full items-end">
                        <div
                          className="w-full rounded-t-2xl bg-gradient-to-t from-primary to-primary/50 shadow-sm"
                          style={{ height }}
                          title={`${trend.month}: ${formatUsd(trend.monetaryTotalPhp)}`}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground">{formatMonthLabel(trend.month)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-muted/25 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Momentum signal
                </div>
                <p className="mt-3 text-2xl font-bold text-foreground">
                  {changePercent != null ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%` : '—'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Month-over-month monetary donation change</p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/25 p-4">
                <p className="text-sm font-medium text-foreground">Planning note</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Use rising months to time stewardship asks and slower months to plan re-engagement sequences or campaign refreshes.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={`${card} space-y-4`}>
            <div className="flex items-center gap-2">
              <Waypoints className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Reintegration snapshot</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-border bg-muted/25 p-4">
                <p className={statCardInner}>Success rate</p>
                <p className={statCardValue}>{dashboard.reintegration.successRatePercent.toFixed(1)}%</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    style={{ width: `${clampPercent(dashboard.reintegration.successRatePercent)}%` }}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-muted/25 p-4">
                <p className={statCardInner}>Completed</p>
                <p className={statCardValue}>{dashboard.reintegration.completedCount}</p>
                <p className={statCardSub}>Residents marked completed in reintegration tracking</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/25 p-4">
                <p className={statCardInner}>In progress</p>
                <p className={statCardValue}>{dashboard.reintegration.inProgressCount}</p>
                <p className={statCardSub}>Cases currently moving through reintegration work</p>
              </div>
            </div>
          </div>

          <div className={`${card} space-y-4`}>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Executive highlights</h3>
            </div>
            <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
              <li className="rounded-2xl border border-border bg-muted/20 p-4">
                Strongest overall safehouse signal:{' '}
                <span className="font-medium text-foreground">{strongestSafehouse?.name ?? 'No comparison yet'}</span>
              </li>
              <li className="rounded-2xl border border-border bg-muted/20 p-4">
                Highest occupancy:{' '}
                <span className="font-medium text-foreground">
                  {highestOccupancy ? `${highestOccupancy.name} (${highestOccupancy.occupancyRatePercent}%)` : 'No occupancy data'}
                </span>
              </li>
              <li className="rounded-2xl border border-border bg-muted/20 p-4">
                Annual accomplishment framing remains ready for agency reporting with beneficiary counts, service pillars,
                and outcome highlights below.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <div className={`${card} space-y-5`}>
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Resident outcome metrics</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Education progress and health improvement indicators derived from resident records to support service planning and reporting.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/70 p-5">
              <p className={statCardInner}>Average education progress</p>
              <p className={statCardValue}>{reports.outcomeMetrics.avgEducationProgressPercent.toFixed(1)}%</p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-500"
                  style={{ width: `${clampPercent(reports.outcomeMetrics.avgEducationProgressPercent)}%` }}
                />
              </div>
              <p className={statCardSub}>Based on {reports.outcomeMetrics.educationRecordsCount} education entries</p>
            </div>

            <div className="rounded-2xl border border-border bg-background/70 p-5">
              <p className={statCardInner}>Average health score</p>
              <p className={statCardValue}>{reports.outcomeMetrics.avgHealthScore.toFixed(2)}</p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-500"
                  style={{ width: `${clampPercent(reports.outcomeMetrics.avgHealthScore * 10)}%` }}
                />
              </div>
              <p className={statCardSub}>Based on {reports.outcomeMetrics.healthRecordsCount} wellbeing entries</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-5">
            <p className="text-sm font-medium text-foreground">Decision support note</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Use outcome deltas alongside safehouse performance to identify where coaching, health interventions, or academic support may need to be intensified.
            </p>
          </div>
        </div>

        <div className={`${card} space-y-5`}>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Annual Accomplishment Report lens</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Structured to mirror accomplishment-report style summaries used for agency and board reporting.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-rose-50/50 p-4 text-center">
              <p className="text-3xl font-bold text-rose-600">{reports.annualAccomplishmentStyle.servicesProvided.caringSessions}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-rose-700/75">Caring</p>
            </div>
            <div className="rounded-2xl border border-border bg-amber-50/60 p-4 text-center">
              <p className="text-3xl font-bold text-amber-600">{reports.annualAccomplishmentStyle.servicesProvided.healingSessions}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-700/75">Healing</p>
            </div>
            <div className="rounded-2xl border border-border bg-emerald-50/60 p-4 text-center">
              <p className="text-3xl font-bold text-emerald-600">{reports.annualAccomplishmentStyle.servicesProvided.teachingSessions}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-700/75">Teaching</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className={statCardInner}>Beneficiaries served</p>
            <p className={statCardValue}>{reports.annualAccomplishmentStyle.beneficiaryResidentsServed}</p>
            <p className={statCardSub}>Resident beneficiaries included in the current reporting set</p>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">Program outcomes</p>
            <ul className="mt-3 space-y-3">
              {reports.annualAccomplishmentStyle.programOutcomeHighlights.map((highlight) => (
                <li key={highlight} className="rounded-2xl border border-border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                  {highlight}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={`${card} space-y-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Safehouse performance comparisons</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare occupancy, education support, and health indicators across safehouses to inform staffing and resource allocation.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {reports.safehousePerformance.map((safehouse) => (
            <article key={safehouse.safehouseId} className="rounded-2xl border border-border bg-background/70 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-foreground">{safehouse.name}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {safehouse.activeResidents} active residents · capacity {safehouse.capacity}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {safehouse.occupancyRatePercent}%
                </span>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Occupancy</span>
                    <span>{safehouse.occupancyRatePercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-slate-500 to-slate-700"
                      style={{ width: `${clampPercent(safehouse.occupancyRatePercent)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Education progress</span>
                    <span>{safehouse.avgEducationProgress != null ? `${safehouse.avgEducationProgress.toFixed(1)}%` : '—'}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-500"
                      style={{ width: `${clampPercent(safehouse.avgEducationProgress ?? 0)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Health score</span>
                    <span>{safehouse.avgHealthScore != null ? safehouse.avgHealthScore.toFixed(2) : '—'}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-500"
                      style={{ width: `${clampPercent((safehouse.avgHealthScore ?? 0) * 10)}%` }}
                    />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
