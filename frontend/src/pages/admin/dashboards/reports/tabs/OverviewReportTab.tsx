import type { ReportsSummary, DashboardSummary, MarketingAnalyticsSummary, SafehousePerformance } from '../../../../../api/adminTypes'
import { ChartCard, SimpleHorizontalBarChart, SimpleLineChart } from '../ChartCard'
import { InsightsSummaryPanel, type InsightCallout } from '../InsightsSummaryPanel'
import { MLInsightCard } from '../MLInsightCard'
import { ReportEmptyState } from '../ReportEmptyState'
import type { ReportTabId } from '../reportTypes'

function formatMonthLabel(month: string) {
  const d = new Date(`${month}-01T12:00:00`)
  if (Number.isNaN(d.getTime())) return month
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

type Props = {
  filteredTrends: ReportsSummary['donationTrends']
  reports: ReportsSummary
  dashboard: DashboardSummary
  marketing: MarketingAnalyticsSummary | null
  safehousesFiltered: SafehousePerformance[]
  atRiskCount: number
  supporterCount: number
  atRiskPctOfSupporters: number | null
  incidentTrendUp: boolean | null
  bestSafehouseName: string | null
  weakSafehouseName: string | null
  bestSocialPlatform: string | null
  topAtRiskIds: { supporterId: number; label: string }[]
  topUpgradeIds: { supporterId: number; label: string }[]
  upgradeBatchCount: number
  onSetTab: (t: ReportTabId) => void
  onPickSafehouse: (id: number) => void
}

export function OverviewReportTab({
  filteredTrends,
  reports,
  dashboard,
  marketing,
  safehousesFiltered,
  atRiskCount,
  supporterCount,
  atRiskPctOfSupporters,
  incidentTrendUp,
  bestSafehouseName,
  weakSafehouseName,
  bestSocialPlatform,
  topAtRiskIds,
  topUpgradeIds,
  upgradeBatchCount,
  onSetTab,
  onPickSafehouse,
}: Props) {
  const callouts: InsightCallout[] = []
  if (atRiskPctOfSupporters != null && supporterCount > 0) {
    callouts.push({
      id: 'at-risk',
      text: `${atRiskPctOfSupporters.toFixed(1)}% of supporters in this workspace overlap the at-risk model list (${atRiskCount} rows).`,
      variant: atRiskPctOfSupporters > 20 ? 'warning' : 'default',
    })
  }
  if (incidentTrendUp != null) {
    callouts.push({
      id: 'incidents',
      text: incidentTrendUp
        ? 'Incidents are trending up versus the prior window — prioritize supervision and documentation reviews.'
        : 'Incidents are flat or down versus the prior window.',
      variant: incidentTrendUp ? 'warning' : 'success',
    })
  }
  if (bestSafehouseName && weakSafehouseName && bestSafehouseName !== weakSafehouseName) {
    callouts.push({
      id: 'sh',
      text: `Safehouse comparison: strongest composite signals at ${bestSafehouseName}; watch ${weakSafehouseName} for targeted support.`,
    })
  }
  if (bestSocialPlatform) {
    callouts.push({
      id: 'social',
      text: `Donation-attributed social performance is strongest on ${bestSocialPlatform} in marketing analytics.`,
      variant: 'success',
    })
  }
  if (callouts.length === 0) {
    callouts.push({
      id: 'none',
      text: 'Widen the date range or resolve ML service availability to unlock more comparative callouts.',
    })
  }

  const linePts = filteredTrends.map((t) => ({
    label: formatMonthLabel(t.month),
    value: t.monetaryTotalPhp,
  }))

  const shBars = [...safehousesFiltered]
    .sort((a, b) => (b.avgEducationProgress ?? 0) - (a.avgEducationProgress ?? 0))
    .slice(0, 5)
    .map((s) => ({
      key: String(s.safehouseId),
      label: s.name,
      value: s.avgEducationProgress ?? 0,
      sublabel: `${s.activeResidents} residents · occ. ${s.occupancyRatePercent}%`,
    }))

  const channelRows =
    marketing?.channels?.slice(0, 5).map((ch) => ({
      key: ch.channelSource,
      label: ch.channelSource,
      value: ch.totalPhp,
      sublabel: `${ch.uniqueDonors} donors · ${ch.totalDonations} gifts`,
    })) ?? []

  const causal = marketing?.causalEstimates?.social_media_spotlight
  const causalKeys = causal ? Object.keys(causal).filter((k) => (causal[k] ?? 0) > 0) : []

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <InsightsSummaryPanel
          callouts={callouts}
          actions={[
            { id: 'outreach', label: 'Donor outreach', to: '/admin/email-hub' },
            { id: 'residents', label: 'High-risk residents', to: '/admin/residents' },
            { id: 'sh', label: 'Safehouse comparison', onClick: () => onSetTab('safehouses') },
            { id: 'social', label: 'Post performance', onClick: () => onSetTab('social') },
          ]}
        />

        <MLInsightCard
          title="Donor ML — at a glance"
          subtitle="Churn / lapse model outputs for prioritization"
          statusLabel="Model-assisted"
          summaryMetric={String(atRiskCount)}
          summaryCaption="Supporters flagged in current at-risk batch (threshold set by API)"
          distribution={[
            { label: 'In at-risk list', count: atRiskCount, colorClass: 'bg-amber-500' },
            { label: 'Upgrade batch size', count: upgradeBatchCount, colorClass: 'bg-emerald-500' },
          ]}
          topCases={topAtRiskIds.slice(0, 3).map((x) => ({
            id: String(x.supporterId),
            title: x.label,
            detail: 'Elevated lapse risk in ML cohort — confirm before outreach.',
            href: `/admin/donors/${x.supporterId}`,
            actionLabel: 'View donor',
          }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Donation trend (monetary)"
          description="Monthly PHP from monetary gifts in the filtered window."
          helperText="Backend aggregates monetary donations by calendar month. Filters apply to which months are shown."
        >
          {linePts.length === 0 ? (
            <ReportEmptyState title="No months in range" />
          ) : (
            <SimpleLineChart
              points={linePts}
              formatY={(n) => `₱${Math.round(n).toLocaleString()}`}
              ariaLabel="Donation monetary trend line chart"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Education proxy by safehouse"
          description="Average education progress from latest monthly metrics (top five sites)."
          actions={
            shBars[0] ? (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => onPickSafehouse(Number(shBars[0].key))}
              >
                Focus top site
              </button>
            ) : null
          }
        >
          {shBars.length === 0 ? (
            <ReportEmptyState />
          ) : (
            <SimpleHorizontalBarChart
              rows={shBars}
              formatValue={(n) => `${n.toFixed(1)}%`}
              onBarClick={(key) => onPickSafehouse(Number(key))}
              ariaLabel="Education progress by safehouse"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Channel contribution (PHP)"
          description="Top acquisition channels from marketing analytics summary."
          helperText={marketing ? undefined : 'Marketing analytics unavailable — check API /marketing/summary.'}
        >
          {channelRows.length === 0 ? (
            <ReportEmptyState title="No channel data" description="Load marketing analytics to compare channels." />
          ) : (
            <SimpleHorizontalBarChart
              rows={channelRows}
              formatValue={(n) => `₱${Math.round(n).toLocaleString()}`}
              ariaLabel="Donations by channel"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Reintegration success"
          description="Program-level completion rate from dashboard summary."
        >
          <div className="space-y-3">
            <p className="font-heading text-4xl font-bold text-foreground">
              {dashboard.reintegration.successRatePercent.toFixed(1)}%
            </p>
            <p className="text-sm text-muted-foreground">
              Completed {dashboard.reintegration.completedCount} · In progress {dashboard.reintegration.inProgressCount}
            </p>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                style={{ width: `${Math.min(100, dashboard.reintegration.successRatePercent)}%` }}
              />
            </div>
          </div>
        </ChartCard>
      </div>

      {causalKeys.length > 0 ? (
        <ChartCard
          title="Social → donation lift (experimental)"
          description="Causal model coefficients from marketing analytics when available."
          helperText="Interpret with care; sample sizes and confounding vary."
        >
          <ul className="text-sm text-muted-foreground">
            {causalKeys.slice(0, 6).map((k) => (
              <li key={k} className="border-b border-border py-2 last:border-0">
                <span className="font-medium text-foreground">{k}</span>: {String(causal![k])}
              </li>
            ))}
          </ul>
        </ChartCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Outcome snapshot" description="Resident record aggregates (org-wide).">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Education</p>
              <p className="mt-2 text-2xl font-bold">{reports.outcomeMetrics.avgEducationProgressPercent.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">{reports.outcomeMetrics.educationRecordsCount} records</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Wellbeing</p>
              <p className="mt-2 text-2xl font-bold">{reports.outcomeMetrics.avgHealthScore.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{reports.outcomeMetrics.healthRecordsCount} records</p>
            </div>
          </div>
        </ChartCard>

        <MLInsightCard
          title="Upgrade propensity (batch)"
          subtitle="Donors scored likely to increase giving"
          statusLabel="Batch scoring"
          summaryMetric={String(topUpgradeIds.length)}
          summaryCaption="Candidates in the current upgrade API response"
          topCases={topUpgradeIds.slice(0, 3).map((x) => ({
            id: String(x.supporterId),
            title: x.label,
            detail: 'Model suggests stronger upgrade propensity — pair with relationship context.',
            href: `/admin/donors/${x.supporterId}`,
            actionLabel: 'Contact',
          }))}
        />
      </div>
    </div>
  )
}
