import { Link } from 'react-router-dom'
import type {
  ReportsSummary,
  ResidentSummary,
  IncidentReport,
  HomeVisitation,
  InterventionPlan,
  EducationRecord,
  HealthRecord,
} from '../../../../../api/adminTypes'
import type { ReintegrationResult } from '../../../../../components/ml/reintegrationReadinessShared'
import { ChartCard, SimpleHorizontalBarChart, SimpleLineChart } from '../ChartCard'
import { MLInsightCard } from '../MLInsightCard'
import { ReportEmptyState } from '../ReportEmptyState'
import { card } from '../../../shared/adminStyles'

function monthKey(iso: string) {
  return iso.slice(0, 7)
}

function avgByMonth<T extends { recordDate: string }>(rows: T[], getVal: (r: T) => number | null) {
  const buckets = new Map<string, { sum: number; n: number }>()
  for (const r of rows) {
    const v = getVal(r)
    if (v == null || Number.isNaN(v)) continue
    const m = monthKey(r.recordDate)
    const b = buckets.get(m) ?? { sum: 0, n: 0 }
    b.sum += v
    b.n += 1
    buckets.set(m, b)
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, { sum, n }]) => ({ label: m, value: n ? sum / n : 0 }))
}

type Props = {
  reports: ReportsSummary
  residentsFiltered: ResidentSummary[]
  incidentsFiltered: IncidentReport[]
  homeVisitsFiltered: HomeVisitation[]
  interventionsFiltered: InterventionPlan[]
  educationFiltered: EducationRecord[]
  healthFiltered: HealthRecord[]
  readiness: { residents: Array<ResidentSummary & { readiness: ReintegrationResult }>; failed_count: number } | null
}

export function ResidentsReportTab({
  reports,
  residentsFiltered,
  incidentsFiltered,
  homeVisitsFiltered,
  interventionsFiltered,
  educationFiltered,
  healthFiltered,
  readiness,
}: Props) {
  const riskBuckets = new Map<string, number>()
  for (const r of residentsFiltered) {
    const k = (r.currentRiskLevel ?? 'Unknown').trim() || 'Unknown'
    riskBuckets.set(k, (riskBuckets.get(k) ?? 0) + 1)
  }
  const riskRows = [...riskBuckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ key: label, label, value }))

  const reBuckets = new Map<string, number>()
  for (const r of residentsFiltered) {
    const k = (r.reintegrationStatus ?? 'Not set').trim() || 'Not set'
    reBuckets.set(k, (reBuckets.get(k) ?? 0) + 1)
  }
  const reRows = [...reBuckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ key: label, label, value, sublabel: 'Residents' }))

  const planBuckets = new Map<string, number>()
  for (const p of interventionsFiltered) {
    const k = p.status || 'Unknown'
    planBuckets.set(k, (planBuckets.get(k) ?? 0) + 1)
  }
  const planRows = [...planBuckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ key: label, label, value }))

  const incByMonth = new Map<string, number>()
  for (const i of incidentsFiltered) {
    const m = monthKey(i.incidentDate)
    incByMonth.set(m, (incByMonth.get(m) ?? 0) + 1)
  }
  const incLine = [...incByMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, v]) => ({ label: m, value: v }))

  const visitByMonth = new Map<string, number>()
  for (const v of homeVisitsFiltered) {
    const m = monthKey(v.visitDate)
    visitByMonth.set(m, (visitByMonth.get(m) ?? 0) + 1)
  }
  const visitLine = [...visitByMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, v]) => ({ label: m, value: v }))

  const eduLine = avgByMonth(educationFiltered, (r) => r.progressPercent)
  const healthLine = avgByMonth(healthFiltered, (r) => r.healthScore)

  const highRisk = residentsFiltered.filter((r) => /high|elevated|critical/i.test(r.currentRiskLevel ?? ''))
  const followUpVisits = homeVisitsFiltered.filter((v) => v.followUpNeeded)
  const openIncidents = incidentsFiltered.filter((i) => !i.resolved)

  const readinessTop =
    readiness?.residents
      .filter(
        (r) => r.readiness?.prediction === 'Ready' && (r.readiness?.reintegration_probability ?? 0) >= 0.65,
      )
      .slice(0, 5) ?? []

  return (
    <div className="space-y-6">
      <div className={`${card} border-rose-200/60 bg-rose-50/25 dark:border-rose-900/40 dark:bg-rose-950/20`}>
        <h2 className="text-sm font-semibold text-foreground">Attention needed</h2>
        <ul className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li>
            <span className="font-medium text-foreground">{highRisk.length}</span> residents with elevated risk labels
            in view.
          </li>
          <li>
            <span className="font-medium text-foreground">{followUpVisits.length}</span> home visits flagged for
            follow-up.
          </li>
          <li>
            <span className="font-medium text-foreground">{openIncidents.length}</span> incidents not marked resolved.
          </li>
          <li>
            Reintegration readiness model:{' '}
            <span className="font-medium text-foreground">{readiness?.failed_count ?? '—'}</span> scoring failures
            (check ML service).
          </li>
        </ul>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Residents by risk label" description="Current risk level field on resident summaries.">
          {riskRows.length === 0 ? (
            <ReportEmptyState />
          ) : (
            <SimpleHorizontalBarChart rows={riskRows} formatValue={(n) => String(Math.round(n))} ariaLabel="Risk levels" />
          )}
        </ChartCard>

        <ChartCard title="Reintegration status" description="Counts from resident.case summaries in filter.">
          {reRows.length === 0 ? (
            <ReportEmptyState />
          ) : (
            <SimpleHorizontalBarChart rows={reRows} formatValue={(n) => String(Math.round(n))} ariaLabel="Reintegration" />
          )}
        </ChartCard>

        <ChartCard
          title="Average education progress over time"
          description="Mean progress % by record month (filtered records)."
        >
          {eduLine.length === 0 ? (
            <ReportEmptyState title="No education records in window" />
          ) : (
            <SimpleLineChart points={eduLine} formatY={(n) => `${n.toFixed(1)}%`} ariaLabel="Education trend" />
          )}
        </ChartCard>

        <ChartCard title="Average health score over time" description="Mean score by record month.">
          {healthLine.length === 0 ? (
            <ReportEmptyState title="No health records in window" />
          ) : (
            <SimpleLineChart points={healthLine} formatY={(n) => n.toFixed(2)} ariaLabel="Health trend" />
          )}
        </ChartCard>

        <ChartCard title="Intervention plan statuses" description="Filtered intervention plans.">
          {planRows.length === 0 ? (
            <ReportEmptyState />
          ) : (
            <SimpleHorizontalBarChart rows={planRows} formatValue={(n) => String(Math.round(n))} ariaLabel="Plans" />
          )}
        </ChartCard>

        <ChartCard
          title="Incidents & visits (monthly counts)"
          description="Parallel activity indicators — not causal."
        >
          {incLine.length === 0 && visitLine.length === 0 ? (
            <ReportEmptyState />
          ) : (
            <div className="space-y-6">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Incidents</p>
                <SimpleLineChart points={incLine} formatY={(n) => String(Math.round(n))} ariaLabel="Incidents by month" />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Home visitations</p>
                <SimpleLineChart points={visitLine} formatY={(n) => String(Math.round(n))} ariaLabel="Visits by month" />
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Org outcome averages (reports API)"
          description="Falls back to global aggregates when per-window series are thin."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Education</p>
              <p className="text-2xl font-bold">{reports.outcomeMetrics.avgEducationProgressPercent.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Health</p>
              <p className="text-2xl font-bold">{reports.outcomeMetrics.avgHealthScore.toFixed(2)}</p>
            </div>
          </div>
        </ChartCard>

        <MLInsightCard
          title="Reintegration readiness (cohort)"
          subtitle="ML-assisted prioritization for discharge planning"
          statusLabel={readiness ? 'Cohort loaded' : 'Unavailable'}
          summaryMetric={readiness ? String(readiness.residents.length) : '—'}
          summaryCaption="Residents scored in readiness batch"
          topCases={readinessTop.map((r) => ({
            id: String(r.id),
            title: `${r.internalCode} · ${r.safehouseName ?? 'Safehouse'}`,
            detail: `${r.readiness?.prediction ?? '—'} · ${(r.readiness?.reintegration_probability ?? 0).toFixed(2)} prob · ${r.readiness?.risk_tier ?? ''}`,
            href: `/admin/residents/${r.id}`,
            actionLabel: 'View case',
          }))}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        <Link to="/admin/resident-pipeline" className="text-primary hover:underline">
          Open resident pipeline
        </Link>{' '}
        ·{' '}
        <Link to="/admin/process-recordings" className="text-primary hover:underline">
          Counseling sessions
        </Link>
      </p>
    </div>
  )
}
