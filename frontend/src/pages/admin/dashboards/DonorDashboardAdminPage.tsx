import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Gift,
  Heart,
  Layers,
  Mail,
  RefreshCcw,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  getDashboard,
  getAtRiskDonors,
  getSupporters,
  type DashboardSummary,
  type AtRiskDonorInfo,
  type Supporter,
} from '../../../api/admin'
import {
  alertError,
  btnPrimary,
  card,
  linkTile,
  pageDesc,
  pageTitle,
  statCardInner,
  statCardSub,
  statCardValue,
} from '../shared/adminStyles'

// ── Helpers ───────────────────────────────────────────────────────────────────

const moneyPhp = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' })

function relativeDate(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function typeColor(type: string): string {
  const t = type.toLowerCase()
  if (t.includes('monetary')) return 'bg-emerald-500'
  if (t.includes('inkind') || t.includes('in-kind')) return 'bg-sky-500'
  if (t.includes('time') || t.includes('volunteer')) return 'bg-violet-500'
  if (t.includes('skills')) return 'bg-amber-500'
  if (t.includes('social')) return 'bg-pink-500'
  return 'bg-muted-foreground'
}

function typeBadge(type: string) {
  const color = typeColor(type)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${color}`}>
      {type}
    </span>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent, icon: Icon,
}: {
  label: string; value: string; sub?: string; accent: string; icon: React.ElementType
}) {
  return (
    <div className={`${card} relative overflow-hidden`}>
      <div className={`absolute left-0 top-0 h-full w-1 ${accent}`} />
      <div className="flex items-start justify-between gap-2 pl-3">
        <div className="min-w-0">
          <p className={statCardInner}>{label}</p>
          <p className={`${statCardValue} truncate`}>{value}</p>
          {sub && <p className={statCardSub}>{sub}</p>}
        </div>
        <div className="shrink-0 rounded-lg bg-muted/60 p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  )
}

function TypeBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{count} · {pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DonorDashboardAdminPage() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [atRisk, setAtRisk] = useState<AtRiskDonorInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getDashboard()
      .then((d) => { if (!cancelled) { setData(d); setError(null) } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    getSupporters()
      .then((s) => { if (!cancelled) setSupporters(s) })
      .catch(() => {})
    getAtRiskDonors(0.55, 20)
      .then((r) => { if (!cancelled) setAtRisk(r) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (loading) return <p className="text-muted-foreground">Loading donor dashboard…</p>
  if (error || !data) {
    return <div className={alertError}>{error ?? 'No data'}</div>
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

  const activeSupporters = supporters.filter((s) => s.status?.toLowerCase() === 'active')
  const monetaryDonors = supporters.filter((s) => s.supporterType === 'MonetaryDonor')

  // Type breakdown from recent donations
  const typeCounts = data.recentDonations.reduce<Record<string, number>>((acc, d) => {
    acc[d.donationType] = (acc[d.donationType] ?? 0) + 1
    return acc
  }, {})

  // Campaign breakdown
  const campaignTotals = data.recentDonations
    .filter((d) => d.campaignName && d.amount != null)
    .reduce<Record<string, { total: number; count: number }>>((acc, d) => {
      const key = d.campaignName!
      if (!acc[key]) acc[key] = { total: 0, count: 0 }
      acc[key].total += d.amount!
      acc[key].count += 1
      return acc
    }, {})
  const topCampaigns = Object.entries(campaignTotals)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 4)

  // Top donors from recent gifts
  const topDonors = [...data.recentDonations]
    .filter((d) => d.amount != null)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    .slice(0, 5)

  // At-risk breakdown
  const highRisk = atRisk.filter((d) => d.risk_tier === 'High Risk').length
  const modRisk = atRisk.filter((d) => d.risk_tier === 'Moderate Risk').length

  const avgGift = data.recentDonations.filter((d) => d.amount != null).length > 0
    ? data.recentDonations.filter((d) => d.amount != null).reduce((s, d) => s + (d.amount ?? 0), 0) /
      data.recentDonations.filter((d) => d.amount != null).length
    : null

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className={pageTitle}>Donor Dashboard</h2>
          <p className={pageDesc}>Funding activity, supporter health, and giving trends at a glance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/donor-all"
            className={`${btnPrimary} inline-flex items-center gap-2`}
          >
            <UserPlus className="h-4 w-4" />
            Add donor
          </Link>
          <Link
            to="/admin/email-hub"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            <Mail className="h-4 w-4" />
            Email donors
          </Link>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Monetary Gifts (30 Days)"
          value={moneyPhp.format(data.monetaryDonationsLast30DaysPhp)}
          sub="Total monetary donations this month"
          accent="bg-emerald-500"
          icon={TrendingUp}
        />
        <KpiCard
          label="Active Supporters"
          value={activeSupporters.length > 0 ? String(activeSupporters.length) : String(supporters.length)}
          sub={monetaryDonors.length > 0 ? `${monetaryDonors.length} monetary donors` : 'Across all types'}
          accent="bg-primary"
          icon={Users}
        />
        <KpiCard
          label="Avg Gift (Recent)"
          value={avgGift != null ? moneyPhp.format(avgGift) : '—'}
          sub={`Across ${data.recentDonations.filter((d) => d.amount != null).length} recorded gifts`}
          accent="bg-sky-500"
          icon={Gift}
        />
        <KpiCard
          label="Donors at Churn Risk"
          value={atRisk.length > 0 ? String(atRisk.length) : '—'}
          sub={atRisk.length > 0 ? `${highRisk} high · ${modRisk} moderate` : 'ML service loading…'}
          accent={highRisk > 0 ? 'bg-destructive' : 'bg-amber-500'}
          icon={AlertTriangle}
        />
      </div>

      {/* ── Main content grid ── */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Recent activity */}
          <div className={card}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Gift className="h-4 w-4 text-primary" />
                Recent Contributions
              </h3>
              <Link
                to="/admin/donor-all"
                className="text-xs font-medium text-primary hover:underline"
              >
                View all →
              </Link>
            </div>

            {data.recentDonations.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No recent donations recorded.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border/40">
                {data.recentDonations.slice(0, 8).map((d) => (
                  <li key={d.donationId} className="flex items-center gap-3 py-2.5 text-sm">
                    <div className={`h-2 w-2 shrink-0 rounded-full ${typeColor(d.donationType)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{d.supporterDisplayName}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {typeBadge(d.donationType)}
                        {d.campaignName && (
                          <span className="text-[10px] text-muted-foreground">📢 {d.campaignName}</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold tabular-nums text-foreground">
                        {d.amount != null ? moneyPhp.format(d.amount) : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">{relativeDate(d.donationDate)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Top gifts */}
          {topDonors.length > 0 && (
            <div className={card}>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Heart className="h-4 w-4 text-primary" />
                Top Gifts (Recent)
              </h3>
              <ul className="mt-4 space-y-3">
                {topDonors.map((d, i) => {
                  const maxAmt = topDonors[0]?.amount ?? 1
                  const pct = maxAmt > 0 ? ((d.amount ?? 0) / maxAmt) * 100 : 0
                  return (
                    <li key={d.donationId} className="flex items-center gap-3">
                      <span className="w-4 shrink-0 text-center text-xs font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">{d.supporterDisplayName}</span>
                          <span className="font-semibold tabular-nums text-foreground">
                            {moneyPhp.format(d.amount!)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/60 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* At-risk donors */}
          <div className={card}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Churn Risk
              </h3>
              <Link
                to="/admin/email-hub"
                className="text-xs font-medium text-primary hover:underline"
              >
                Reach out →
              </Link>
            </div>

            {atRisk.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No at-risk donors detected or ML service unavailable.
              </p>
            ) : (
              <>
                <div className="mt-3 flex gap-3">
                  <div className="flex-1 rounded-lg bg-destructive/10 p-3 text-center">
                    <p className="text-2xl font-bold text-destructive">{highRisk}</p>
                    <p className="mt-0.5 text-xs text-destructive/80">High risk</p>
                  </div>
                  <div className="flex-1 rounded-lg bg-amber-500/10 p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">{modRisk}</p>
                    <p className="mt-0.5 text-xs text-amber-600/80">Moderate</p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {atRisk.slice(0, 4).map((d) => (
                    <li key={d.supporter_id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                      <span className="text-foreground">Donor #{d.supporter_id}</span>
                      <span className={`font-semibold ${d.risk_tier === 'High Risk' ? 'text-destructive' : 'text-amber-600'}`}>
                        {Math.round(d.churn_probability * 100)}% churn
                      </span>
                    </li>
                  ))}
                </ul>
                {atRisk.length > 4 && (
                  <p className="mt-2 text-xs text-muted-foreground">+ {atRisk.length - 4} more</p>
                )}
              </>
            )}
          </div>

          {/* Donation type breakdown */}
          {Object.keys(typeCounts).length > 0 && (
            <div className={card}>
              <h3 className="text-sm font-semibold text-foreground">Gift Type Breakdown</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Recent donations by type</p>
              <div className="mt-4 space-y-3">
                {Object.entries(typeCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <TypeBar
                      key={type}
                      label={type}
                      count={count}
                      total={data.recentDonations.length}
                      color={typeColor(type)}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Campaign breakdown */}
          {topCampaigns.length > 0 && (
            <div className={card}>
              <h3 className="text-sm font-semibold text-foreground">Top Campaigns</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">By total amount raised</p>
              <ul className="mt-4 space-y-3">
                {topCampaigns.map(([name, stats]) => (
                  <li key={name} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{name}</p>
                      <p className="text-xs text-muted-foreground">{stats.count} gift{stats.count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">
                      {moneyPhp.format(stats.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick links ── */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Funding Tools</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/admin/donor-all" className={linkTile}>
            <span className="flex items-center gap-2"><Layers className="h-4 w-4" /> Donor Information</span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
          <Link to="/admin/email-hub" className={linkTile}>
            <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> Donor Outreach</span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
          <Link to="/admin/donor-all" className={linkTile}>
            <span className="flex items-center gap-2"><Gift className="h-4 w-4" /> Donations & Allocations</span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
          <Link to="/admin/reports" className={linkTile}>
            <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Reports</span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
        </div>
      </div>
    </div>
  )
}
