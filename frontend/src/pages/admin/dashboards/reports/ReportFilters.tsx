import type { ReportFiltersState } from './reportTypes'
import type { CampaignPerformance, SafehousePerformance } from '../../../../api/adminTypes'
import { input, label } from '../../shared/adminStyles'
import type { PlannedSocialPost } from '../../../../api/adminTypes'

type Props = {
  filters: ReportFiltersState
  onChange: (next: ReportFiltersState) => void
  safehouses: SafehousePerformance[]
  campaigns: CampaignPerformance[]
  plannedPosts: PlannedSocialPost[]
  donationTypeOptions: string[]
}

function uniqPlatforms(posts: PlannedSocialPost[]) {
  const s = new Set<string>()
  for (const p of posts) {
    const t = p.platform?.trim()
    if (t) s.add(t)
  }
  return [...s].sort((a, b) => a.localeCompare(b))
}

export function ReportFilters({
  filters,
  onChange,
  safehouses,
  campaigns,
  plannedPosts,
  donationTypeOptions,
}: Props) {
  const platforms = uniqPlatforms(plannedPosts)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <label className={label}>
        Date range
        <select
          className={input}
          value={filters.preset}
          onChange={(e) =>
            onChange({ ...filters, preset: e.target.value as ReportFiltersState['preset'] })
          }
        >
          <option value="30d">Last 30 days (≈ months)</option>
          <option value="90d">Last 90 days</option>
          <option value="12m">Last 12 months</option>
          <option value="custom">Custom</option>
        </select>
      </label>

      {filters.preset === 'custom' ? (
        <>
          <label className={label}>
            Start
            <input
              type="date"
              className={input}
              value={filters.customStart}
              onChange={(e) => onChange({ ...filters, customStart: e.target.value })}
            />
          </label>
          <label className={label}>
            End
            <input
              type="date"
              className={input}
              value={filters.customEnd}
              onChange={(e) => onChange({ ...filters, customEnd: e.target.value })}
            />
          </label>
        </>
      ) : null}

      <label className={label}>
        Safehouse
        <select
          className={input}
          value={filters.safehouseId === 'all' ? 'all' : String(filters.safehouseId)}
          onChange={(e) => {
            const v = e.target.value
            onChange({ ...filters, safehouseId: v === 'all' ? 'all' : Number(v) })
          }}
        >
          <option value="all">All safehouses</option>
          {safehouses.map((s) => (
            <option key={s.safehouseId} value={s.safehouseId}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className={label}>
        Donation type
        <select
          className={input}
          value={filters.donationType}
          onChange={(e) => onChange({ ...filters, donationType: e.target.value })}
          title="TODO(backend): wire donation_type filter when reports API accepts it"
        >
          {donationTypeOptions.map((t) => (
            <option key={t} value={t}>
              {t === 'all' ? 'All types' : t}
            </option>
          ))}
        </select>
      </label>

      <label className={label}>
        Campaign
        <select
          className={input}
          value={filters.campaign}
          onChange={(e) => onChange({ ...filters, campaign: e.target.value })}
        >
          <option value="all">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.campaignName} value={c.campaignName}>
              {c.campaignName}
            </option>
          ))}
        </select>
      </label>

      <label className={label}>
        Social platform
        <select
          className={input}
          value={filters.socialPlatform}
          onChange={(e) => onChange({ ...filters, socialPlatform: e.target.value })}
        >
          <option value="all">All platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
