import { Link } from 'react-router-dom'
import { formatUsd } from '../../../../../utils/currency'
import type {
  ReportsSummary,
  MarketingAnalyticsSummary,
  DonationAllocation,
  AtRiskDonorInfo,
  DonorUpgradeInfo,
} from '../../../../../api/adminTypes'
import { ChartCard, SimpleHorizontalBarChart, SimpleLineChart, SimpleStackedBar } from '../ChartCard'
import { ReportEmptyState } from '../ReportEmptyState'
import { card } from '../../../shared/adminStyles'

function formatMonthLabel(month: string) {
  const d = new Date(`${month}-01T12:00:00`)
  if (Number.isNaN(d.getTime())) return month
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

type Props = {
  filteredTrends: ReportsSummary['donationTrends']
  marketing: MarketingAnalyticsSummary | null
  campaignsFiltered: MarketingAnalyticsSummary['campaigns']
  allocationsFiltered: DonationAllocation[]
  atRisk: AtRiskDonorInfo[]
  upgrades: DonorUpgradeInfo[]
  supporterLabel: (id: number) => string
}

export function DonorsReportTab({
  filteredTrends,
  marketing,
  campaignsFiltered,
  allocationsFiltered,
  atRisk,
  upgrades,
  supporterLabel,
}: Props) {
  const linePts = filteredTrends.map((t) => ({
    label: formatMonthLabel(t.month),
    value: t.monetaryTotalPhp,
  }))

  const channels = marketing?.channels ?? []
  const channelRows = [...channels]
    .sort((a, b) => b.totalPhp - a.totalPhp)
    .slice(0, 12)
    .map((ch) => ({
      key: ch.channelSource,
      label: ch.channelSource,
      value: ch.totalPhp,
      sublabel: `${ch.uniqueDonors} donors`,
    }))

  const campaignRows = [...campaignsFiltered]
    .sort((a, b) => b.totalPhp - a.totalPhp)
    .slice(0, 12)
    .map((c) => ({
      key: c.campaignName,
      label: c.campaignName,
      value: c.totalPhp,
      sublabel: `${c.donationCount} gifts · ${c.recurringPct.toFixed(0)}% recurring`,
    }))

  const recurringWeighted =
    campaignsFiltered.length > 0
      ? campaignsFiltered.reduce((s, c) => s + c.recurringPct * c.donationCount, 0) /
        Math.max(1, campaignsFiltered.reduce((s, c) => s + c.donationCount, 0))
      : 0

  const byProgram = new Map<string, number>()
  for (const a of allocationsFiltered) {
    const k = a.programArea || 'General'
    byProgram.set(k, (byProgram.get(k) ?? 0) + a.amountAllocated)
  }
  const programRows = [...byProgram.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({
      key: label,
      label,
      value,
      sublabel: 'Allocated',
    }))

  return (
    <div className="space-y-6">
      <div className={`${card} border-amber-200/60 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20`}>
        <h2 className="text-sm font-semibold text-foreground">Actionable donor insights</h2>
        <ul className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          <li className="rounded-lg border border-border bg-card/80 px-3 py-2">
            <span className="font-medium text-foreground">{atRisk.length}</span> donors in at-risk ML batch —{' '}
            <Link className="text-primary hover:underline" to="/admin/email-hub">
              open outreach workspace
            </Link>
            .
          </li>
          <li className="rounded-lg border border-border bg-card/80 px-3 py-2">
            <span className="font-medium text-foreground">{upgrades.length}</span> upgrade-propensity profiles returned
            by API — prioritize stewardship for top scores.
          </li>
          <li className="rounded-lg border border-border bg-card/80 px-3 py-2">
            TODO(backend): add explicit &quot;lapsed donor&quot; cohort from last gift date for re-engagement campaigns.
          </li>
          <li className="rounded-lg border border-border bg-card/80 px-3 py-2">
            Strongest channels and campaigns are charted below; align appeals with top-performing acquisition sources.
          </li>
        </ul>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Donation trend over time" description="Monetary USD by month (filtered window).">
          {linePts.length === 0 ? (
            <ReportEmptyState />
          ) : (
            <SimpleLineChart
              points={linePts}
              formatY={(n) => formatUsd(n)}
              ariaLabel="Donation trend"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Recurring vs one-time (weighted)"
          description="Weighted average recurring % across campaigns in view."
          helperText="Derived from marketing campaign rows; not a ledger substitute."
        >
          <div className="space-y-3">
            <p className="text-3xl font-bold">{recurringWeighted.toFixed(1)}%</p>
            <SimpleStackedBar
              ariaLabel="Recurring versus one-time split"
              segments={[
                { key: 'r', label: 'Recurring', pct: recurringWeighted, className: 'bg-primary' },
                { key: 'o', label: 'One-time', pct: Math.max(0, 100 - recurringWeighted), className: 'bg-muted-foreground/30' },
              ]}
            />
          </div>
        </ChartCard>

        <ChartCard title="Donations by channel" description="Channel source attribution (marketing analytics).">
          {channelRows.length === 0 ? (
            <ReportEmptyState title="No channels" />
          ) : (
            <SimpleHorizontalBarChart
              rows={channelRows}
              formatValue={(n) => formatUsd(n)}
              ariaLabel="Channels"
            />
          )}
        </ChartCard>

        <ChartCard title="Campaign performance" description="Filtered campaigns by USD raised.">
          {campaignRows.length === 0 ? (
            <ReportEmptyState title="No campaigns in filter" />
          ) : (
            <SimpleHorizontalBarChart
              rows={campaignRows}
              formatValue={(n) => formatUsd(n)}
              ariaLabel="Campaigns"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Allocations by program area"
          description="Donation allocations summed for filtered safehouse (or all)."
          helperText="Uses donation_allocations.program_area and amount_allocated."
        >
          {programRows.length === 0 ? (
            <ReportEmptyState title="No allocations" description="No allocation rows match filters." />
          ) : (
            <SimpleHorizontalBarChart
              rows={programRows}
              formatValue={(n) => formatUsd(n)}
              ariaLabel="Program areas"
            />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${card}`}>
          <h3 className="text-sm font-semibold text-foreground">At-risk donors (sample)</h3>
          <ul className="mt-3 divide-y divide-border text-sm">
            {atRisk.slice(0, 8).map((d) => {
              const sid = d.supporter_id ?? 0
              return (
                <li key={`${sid}-${d.churn_probability}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-foreground">{sid ? supporterLabel(sid) : 'Unknown supporter'}</span>
                  <span className="text-xs text-muted-foreground">
                    {(d.churn_probability * 100).toFixed(0)}% · {d.risk_tier}
                  </span>
                  {sid ? (
                    <Link to={`/admin/donors/${sid}`} className="text-xs font-medium text-primary hover:underline">
                      View
                    </Link>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
        <div className={`${card}`}>
          <h3 className="text-sm font-semibold text-foreground">Upgrade candidates (sample)</h3>
          <ul className="mt-3 divide-y divide-border text-sm">
            {upgrades.slice(0, 8).map((u) => {
              const sid = u.supporter_id ?? 0
              return (
                <li key={`${sid}-${u.upgrade_probability}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{sid ? supporterLabel(sid) : 'Unknown'}</span>
                  <span className="text-xs text-muted-foreground">
                    {(u.upgrade_probability * 100).toFixed(0)}% · {u.propensity_tier}
                  </span>
                  {sid ? (
                    <Link to={`/admin/donors/${sid}`} className="text-xs font-medium text-primary hover:underline">
                      View
                    </Link>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
