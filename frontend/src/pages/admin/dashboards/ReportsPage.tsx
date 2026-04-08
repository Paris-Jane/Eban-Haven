import { useEffect, useState } from 'react'
import { getReportsSummary, type ReportsSummary } from '../../../api/admin'
import { card, pageDesc, pageTitle, statCardInner } from '../shared/adminStyles'

const moneyPhp = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' })

export function ReportsPage() {
  const [data, setData] = useState<ReportsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await getReportsSummary()
        if (!cancelled) {
          setData(d)
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

  if (loading) return <p className="text-muted-foreground">Loading reports…</p>
  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        {error ?? 'No data'}
      </div>
    )
  }

  const maxTrend = Math.max(...data.donationTrends.map((t) => t.monetaryTotalPhp), 1)

  return (
    <div className="space-y-10">
      <div>
        <h2 className={pageTitle}>Reports & analytics</h2>
        <p className={pageDesc}>
          Aggregated insights for decision-making: monetary trends, resident outcome metrics (education and health
          records), safehouse performance, reintegration context, and an Annual Accomplishment Report–style view of
          service pillars (caring, healing, teaching) and beneficiary counts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <p className={statCardInner}>Residents (dataset)</p>
          <p className="mt-2 font-heading text-3xl font-bold text-foreground">{data.totalResidents}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Active {data.activeResidents} · Closed {data.closedResidents}
          </p>
        </div>
        <div className={card}>
          <p className={statCardInner}>Monetary contributions (PHP)</p>
          <p className="mt-2 font-heading text-2xl font-bold text-primary">
            {moneyPhp.format(data.totalMonetaryDonationsPhp)}
          </p>
        </div>
        <div className={card}>
          <p className={statCardInner}>Avg education progress</p>
          <p className="mt-2 font-heading text-3xl font-bold text-foreground">
            {data.outcomeMetrics.avgEducationProgressPercent.toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.outcomeMetrics.educationRecordsCount} education records
          </p>
        </div>
        <div className={card}>
          <p className={statCardInner}>Avg health score</p>
          <p className="mt-2 font-heading text-3xl font-bold text-foreground">
            {data.outcomeMetrics.avgHealthScore.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.outcomeMetrics.healthRecordsCount} wellbeing records
          </p>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold text-foreground">Monetary donation trend (by month)</h3>
        <div className="mt-6 space-y-3">
          {data.donationTrends.slice(-18).map((t) => (
            <div key={t.month}>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>{t.month}</span>
                <span>
                  {moneyPhp.format(t.monetaryTotalPhp)} · {t.donationCount} gifts
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(t.monetaryTotalPhp / maxTrend) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold text-foreground">Safehouse performance comparison</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Safehouse</th>
                <th className="py-2 pr-4">Active</th>
                <th className="py-2 pr-4">Capacity</th>
                <th className="py-2 pr-4">Occupancy %</th>
                <th className="py-2 pr-4">Avg education</th>
                <th className="py-2 pr-4">Avg health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.safehousePerformance.map((s) => (
                <tr key={s.safehouseId}>
                  <td className="py-2 pr-4 font-medium">{s.name}</td>
                  <td className="py-2 pr-4">{s.activeResidents}</td>
                  <td className="py-2 pr-4">{s.capacity}</td>
                  <td className="py-2 pr-4">{s.occupancyRatePercent}%</td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {s.avgEducationProgress != null ? `${s.avgEducationProgress.toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {s.avgHealthScore != null ? s.avgHealthScore.toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold text-foreground">Annual accomplishment style — service pillars</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Session interventions tagged in counseling sessions (caring, healing, teaching).
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {data.annualAccomplishmentStyle.servicesProvided.caringSessions}
            </p>
            <p className="text-xs font-medium uppercase text-muted-foreground">Caring</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {data.annualAccomplishmentStyle.servicesProvided.healingSessions}
            </p>
            <p className="text-xs font-medium uppercase text-muted-foreground">Healing</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {data.annualAccomplishmentStyle.servicesProvided.teachingSessions}
            </p>
            <p className="text-xs font-medium uppercase text-muted-foreground">Teaching</p>
          </div>
        </div>
        <p className="mt-6 text-sm text-foreground">
          Beneficiaries (residents in dataset):{' '}
          <strong>{data.annualAccomplishmentStyle.beneficiaryResidentsServed}</strong>
        </p>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-muted-foreground">
          {data.annualAccomplishmentStyle.programOutcomeHighlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold text-foreground">Counseling session volume</h3>
        <p className="mt-2 text-2xl font-heading font-bold text-foreground">{data.processRecordingsCount}</p>
        <p className="mt-1 text-xs text-muted-foreground">Total counseling session entries in the dataset.</p>
      </div>
    </div>
  )
}
