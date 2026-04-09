import { Link } from 'react-router-dom'
import type { MarketingAnalyticsSummary, PlannedSocialPost } from '../../../../../api/adminTypes'
import { ChartCard, SimpleHorizontalBarChart } from '../ChartCard'
import { MLInsightCard } from '../MLInsightCard'
import { MetricsTable } from '../MetricsTable'
import { ReportEmptyState } from '../ReportEmptyState'
import { card } from '../../../shared/adminStyles'

function dayOfWeek(d: Date) {
  return d.getDay()
}

function hourBucket(d: Date) {
  return d.getHours()
}

type Props = {
  marketing: MarketingAnalyticsSummary | null
  plannedPostsFiltered: PlannedSocialPost[]
}

export function SocialMediaInsightsTab({ marketing, plannedPostsFiltered }: Props) {
  const spotlight = marketing?.socialMediaSpotlight

  const byPlatform = new Map<string, { n: number; withCta: number }>()
  for (const p of plannedPostsFiltered) {
    const k = p.platform?.trim() || 'Unknown'
    const cur = byPlatform.get(k) ?? { n: 0, withCta: 0 }
    cur.n += 1
    if (p.cta?.trim()) cur.withCta += 1
    byPlatform.set(k, cur)
  }
  const platformRows = [...byPlatform.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([label, { n, withCta }]) => ({
      key: label,
      label,
      value: n,
      sublabel: `${withCta} with CTA`,
    }))

  const byType = new Map<string, number>()
  for (const p of plannedPostsFiltered) {
    const k = p.contentType?.trim() || 'Unknown'
    byType.set(k, (byType.get(k) ?? 0) + 1)
  }
  const typeRows = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ key: label, label, value }))

  const byMedia = new Map<string, number>()
  for (const p of plannedPostsFiltered) {
    const k = p.format?.trim() || 'Unknown'
    byMedia.set(k, (byMedia.get(k) ?? 0) + 1)
  }
  const mediaRows = [...byMedia.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ key: label, label, value }))

  // Heatmap buckets: day x hour (counts of scheduled/suggested posts)
  const heat: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 8 }, () => 0)) // 7 days × 8 three-hour buckets
  for (const p of plannedPostsFiltered) {
    const raw = p.scheduledForUtc || p.suggestedTime || p.createdAtUtc
    if (!raw) continue
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) continue
    const dow = dayOfWeek(d)
    const hr = hourBucket(d)
    const hb = Math.min(7, Math.floor(hr / 3))
    heat[dow][hb] += 1
  }
  const maxH = Math.max(1, ...heat.flat())

  const withCta = plannedPostsFiltered.filter((p) => p.cta?.trim()).length
  const ctaPct = plannedPostsFiltered.length ? (withCta / plannedPostsFiltered.length) * 100 : 0

  const bestPlatform = platformRows[0]?.label ?? '—'
  const bestType = typeRows[0]?.label ?? '—'
  let bestDow = 0
  let bestDowSum = -1
  for (let i = 0; i < 7; i++) {
    const s = heat[i].reduce((a, b) => a + b, 0)
    if (s > bestDowSum) {
      bestDowSum = s
      bestDow = i
    }
  }
  const dowLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][bestDow]

  return (
    <div className="space-y-6">
      <div className={`${card} border-violet-200/60 bg-violet-50/25 dark:border-violet-900/40 dark:bg-violet-950/20`}>
        <h2 className="text-sm font-semibold text-foreground">Recommended strategy (from available fields)</h2>
        <ul className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li>
            Best platform by volume in filter: <span className="font-medium text-foreground">{bestPlatform}</span>
          </li>
          <li>
            Best content type by volume: <span className="font-medium text-foreground">{bestType}</span>
          </li>
          <li>
            Busiest day for scheduled/suggested posts: <span className="font-medium text-foreground">{dowLabel}</span>
          </li>
          <li>
            Posts with CTA: <span className="font-medium text-foreground">{ctaPct.toFixed(0)}%</span> — compare to
            donation attribution in marketing analytics.
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          TODO(backend): join social_media_posts engagement + donation referral fields for conversion funnel charts.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Planned posts by platform"
          description="Filtered planner queue — volume proxy for channel focus."
        >
          {platformRows.length === 0 ? (
            <ReportEmptyState title="No posts in filter" />
          ) : (
            <SimpleHorizontalBarChart rows={platformRows} formatValue={(n) => String(Math.round(n))} ariaLabel="Platforms" />
          )}
        </ChartCard>

        <ChartCard
          title="Donation-linked social spotlight"
          description="Marketing analytics aggregate (not filtered by date in API today)."
          helperText="TODO: pass report date range into marketing API when supported."
        >
          {spotlight ? (
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Gifts attributed</span>
                <span className="font-semibold">{spotlight.donationCount}</span>
              </li>
              <li className="flex justify-between border-b border-border py-2">
                <span className="text-muted-foreground">PHP</span>
                <span className="font-semibold">₱{Math.round(spotlight.totalPhp).toLocaleString()}</span>
              </li>
              <li className="flex justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Unique donors</span>
                <span className="font-semibold">{spotlight.uniqueDonors}</span>
              </li>
              <li className="flex justify-between py-2">
                <span className="text-muted-foreground">Acquired donors</span>
                <span className="font-semibold">{spotlight.acquiredDonors}</span>
              </li>
            </ul>
          ) : (
            <ReportEmptyState title="Spotlight unavailable" />
          )}
        </ChartCard>

        <ChartCard title="Post type mix" description="Content type counts in filtered posts.">
          {typeRows.length === 0 ? (
            <ReportEmptyState />
          ) : (
            <SimpleHorizontalBarChart rows={typeRows} formatValue={(n) => String(Math.round(n))} ariaLabel="Types" />
          )}
        </ChartCard>

        <ChartCard title="Format / media type" description="Planner format field.">
          {mediaRows.length === 0 ? (
            <ReportEmptyState />
          ) : (
            <SimpleHorizontalBarChart rows={mediaRows} formatValue={(n) => String(Math.round(n))} ariaLabel="Formats" />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Posting heatmap (day × 3h bucket)"
        description="Based on scheduledForUtc, suggestedTime, or createdAtUtc."
        helperText="Darker = more posts. Not normalized for effectiveness."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-center text-[10px]">
            <thead>
              <tr>
                <th className="p-1 text-muted-foreground" />
                {['0–3h', '3–6h', '6–9h', '9–12h', '12–15h', '15–18h', '18–21h', '21–24h'].map((h) => (
                  <th key={h} className="p-1 font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                <tr key={d}>
                  <td className="p-1 font-medium text-muted-foreground">{d}</td>
                  {heat[i].map((v, j) => (
                    <td key={j} className="p-0.5">
                      <div
                        className="mx-auto h-8 w-full max-w-[3rem] rounded-sm bg-primary"
                        style={{ opacity: 0.15 + (v / maxH) * 0.85 }}
                        title={`${v} posts`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <MetricsTable
          caption="Top posts by status"
          rows={[...plannedPostsFiltered]
            .sort((a, b) => (b.updatedAtUtc ?? '').localeCompare(a.updatedAtUtc ?? ''))
            .slice(0, 12)}
          getRowKey={(r) => String(r.id)}
          columns={[
            { key: 't', header: 'Title', render: (r) => <span className="line-clamp-2">{r.title}</span> },
            { key: 'p', header: 'Platform', render: (r) => r.platform },
            { key: 's', header: 'Status', render: (r) => r.status },
            { key: 'c', header: 'CTA', render: (r) => (r.cta ? 'Yes' : 'No') },
          ]}
          emptyMessage="No posts in filter."
        />

        <MLInsightCard
          title="Social performance ML"
          subtitle="Placeholder for ranking / recommendation model"
          statusLabel="Not wired"
          summaryMetric="—"
          summaryCaption="TODO: connect social performance prediction endpoint"
          topCases={[
            {
              id: '1',
              title: 'Hook: top donation-driving posts',
              detail: 'When API returns scored posts, list top 5 with confidence bands here.',
            },
          ]}
        />
      </div>

      <p className="text-center text-sm">
        <Link to="/admin/social-planner" className="text-primary hover:underline">
          Social planner
        </Link>{' '}
        ·{' '}
        <Link to="/admin/marketing-analytics" className="text-primary hover:underline">
          Marketing analytics
        </Link>
      </p>
    </div>
  )
}
