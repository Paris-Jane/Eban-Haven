import type { SafehousePerformance } from '../../../../../api/adminTypes'
import { ChartCard, SimpleHorizontalBarChart } from '../ChartCard'
import { MetricsTable } from '../MetricsTable'
import { ReportEmptyState } from '../ReportEmptyState'
import { card } from '../../../shared/adminStyles'

type Props = {
  safehousesFiltered: SafehousePerformance[]
  onPickSafehouse: (id: number) => void
}

export function SafehousesReportTab({ safehousesFiltered, onPickSafehouse }: Props) {
  const occRows = [...safehousesFiltered]
    .sort((a, b) => b.occupancyRatePercent - a.occupancyRatePercent)
    .map((s) => ({
      key: String(s.safehouseId),
      label: s.name,
      value: s.occupancyRatePercent,
      sublabel: `${s.activeResidents} / ${s.capacity} beds`,
    }))

  const eduRows = [...safehousesFiltered]
    .filter((s) => s.avgEducationProgress != null)
    .sort((a, b) => (b.avgEducationProgress ?? 0) - (a.avgEducationProgress ?? 0))
    .map((s) => ({
      key: String(s.safehouseId),
      label: s.name,
      value: s.avgEducationProgress ?? 0,
    }))

  const crowded = safehousesFiltered.filter((s) => s.occupancyRatePercent >= 90)
  const lowEdu = safehousesFiltered.filter((s) => (s.avgEducationProgress ?? 0) < 40 && s.activeResidents > 0)

  return (
    <div className="space-y-6">
      <div className={`${card} border-sky-200/60 bg-sky-50/25 dark:border-sky-900/40 dark:bg-sky-950/20`}>
        <h2 className="text-sm font-semibold text-foreground">Safehouse insights</h2>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">{crowded.length}</span> site(s) at or above ~90% occupancy —
            review staffing and intake.
          </li>
          <li>
            <span className="font-medium text-foreground">{lowEdu.length}</span> site(s) with education proxy under 40%
            while housing residents — consider academic support.
          </li>
          <li>TODO(backend): join safehouse_monthly_metrics trends for month-over-month outcome velocity.</li>
        </ul>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Occupancy rate"
          description="Active residents vs capacity from reports summary."
          helperText="Click a bar to focus that safehouse in filters (when wired from parent)."
        >
          {occRows.length === 0 ? (
            <ReportEmptyState />
          ) : (
            <SimpleHorizontalBarChart
              rows={occRows}
              formatValue={(n) => `${n.toFixed(0)}%`}
              onBarClick={(key) => onPickSafehouse(Number(key))}
              ariaLabel="Occupancy by safehouse"
            />
          )}
        </ChartCard>

        <ChartCard title="Education proxy by site" description="Latest monthly metric per safehouse when present.">
          {eduRows.length === 0 ? (
            <ReportEmptyState title="No education metrics" />
          ) : (
            <SimpleHorizontalBarChart
              rows={eduRows}
              formatValue={(n) => `${n.toFixed(1)}%`}
              onBarClick={(key) => onPickSafehouse(Number(key))}
              ariaLabel="Education by safehouse"
            />
          )}
        </ChartCard>
      </div>

      <MetricsTable
        caption="Safehouse performance comparison"
        rows={[...safehousesFiltered].sort((a, b) => a.name.localeCompare(b.name))}
        getRowKey={(r) => String(r.safehouseId)}
        emptyMessage="No safehouses in filter."
        columns={[
          { key: 'name', header: 'Safehouse', render: (r) => r.name },
          {
            key: 'occ',
            header: 'Occupancy',
            render: (r) => `${r.occupancyRatePercent}% (${r.activeResidents}/${r.capacity})`,
          },
          {
            key: 'edu',
            header: 'Edu %',
            render: (r) => (r.avgEducationProgress != null ? `${r.avgEducationProgress.toFixed(1)}%` : '—'),
          },
          {
            key: 'hl',
            header: 'Health',
            render: (r) => (r.avgHealthScore != null ? r.avgHealthScore.toFixed(2) : '—'),
          },
          {
            key: 'act',
            header: 'Focus',
            className: 'w-24',
            render: (r) => (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => onPickSafehouse(r.safehouseId)}
              >
                Filter
              </button>
            ),
          },
        ]}
      />
    </div>
  )
}
