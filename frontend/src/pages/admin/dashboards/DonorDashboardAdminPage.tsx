import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Gift, Heart, Mail, PieChart, TrendingUp } from 'lucide-react'
import { getDashboard, type DashboardSummary } from '../../../api/admin'
import {
  card,
  linkTile,
  pageDesc,
  pageTitle,
  statCardInner,
  statCardSub,
  statCardValue,
} from '../shared/adminStyles'

const moneyPhp = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' })

export function DonorDashboardAdminPage() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getDashboard()
      .then((d) => { if (!cancelled) { setData(d); setError(null) } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <p className="text-muted-foreground">Loading donor dashboard…</p>
  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        {error ?? 'No data'}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Donor Dashboard</h2>
        <p className={pageDesc}>
          Overview of funding activity, supporter engagement, and gift allocation.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className={`${card} relative overflow-hidden`}>
          <div className="absolute left-0 top-0 h-full w-1 bg-emerald-500" />
          <div className="flex items-start justify-between gap-2 pl-3">
            <div>
              <p className={statCardInner}>Monetary Gifts (30 Days)</p>
              <p className={statCardValue}>{moneyPhp.format(data.monetaryDonationsLast30DaysPhp)}</p>
              <p className={statCardSub}>Total monetary donations this month</p>
            </div>
            <div className="shrink-0 rounded-lg bg-muted/60 p-2">
              <Heart className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className={`${card} relative overflow-hidden`}>
          <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
          <div className="flex items-start justify-between gap-2 pl-3">
            <div>
              <p className={statCardInner}>Recent Contributions</p>
              <p className={statCardValue}>{data.recentDonations.length}</p>
              <p className={statCardSub}>Donations in current dataset window</p>
            </div>
            <div className="shrink-0 rounded-lg bg-muted/60 p-2">
              <Gift className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className={`${card} relative overflow-hidden`}>
          <div className="absolute left-0 top-0 h-full w-1 bg-sky-500" />
          <div className="flex items-start justify-between gap-2 pl-3">
            <div>
              <p className={statCardInner}>Safehouse Coverage</p>
              <p className={statCardValue}>{data.safehouses.length}</p>
              <p className={statCardSub}>Safehouses receiving funding support</p>
            </div>
            <div className="shrink-0 rounded-lg bg-muted/60 p-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent donations */}
      <div className={card}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Gift className="h-4 w-4 text-primary" />
          Recent Contributions
        </h3>
        {data.recentDonations.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No recent donations recorded.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {data.recentDonations.slice(0, 8).map((d) => (
              <li
                key={d.donationId}
                className="flex items-center justify-between border-b border-border/40 pb-2 text-sm last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{d.supporterDisplayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.donationDate).toLocaleDateString()} · {d.donationType}
                    {d.campaignName ? ` · ${d.campaignName}` : ''}
                  </p>
                </div>
                <span className="ml-3 shrink-0 font-medium tabular-nums text-foreground">
                  {d.amount != null ? moneyPhp.format(d.amount) : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick links */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Funding Tools</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/admin/donors" className={linkTile}>
            <span className="flex items-center gap-2"><Heart className="h-4 w-4" /> Donors</span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
          <Link to="/admin/contributions" className={linkTile}>
            <span className="flex items-center gap-2"><Gift className="h-4 w-4" /> Donations</span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
          <Link to="/admin/allocations" className={linkTile}>
            <span className="flex items-center gap-2"><PieChart className="h-4 w-4" /> Allocations</span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
          <Link to="/admin/email-hub" className={linkTile}>
            <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email Hub</span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
        </div>
      </div>
    </div>
  )
}
