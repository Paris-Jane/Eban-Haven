import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FileText,
  GitBranch,
  Heart,
  Home,
  Users,
  Video,
  Waypoints,
} from 'lucide-react'
import { getDashboard, type DashboardSummary } from '../../../api/admin'
import { btnPrimary, card, linkTile, pageDesc, pageTitle, statCardInner, statCardSub, statCardValue } from '../shared/adminStyles'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={card}>
      <p className={statCardInner}>{label}</p>
      <p className={statCardValue}>{value}</p>
      {sub && <p className={statCardSub}>{sub}</p>}
    </div>
  )
}

const moneyPhp = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' })

export function AdminDashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await getDashboard()
        if (!cancelled) {
          setData(d)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <p className="text-muted-foreground">Loading dashboard…</p>
  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        {error ?? 'No data'}
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className={pageTitle}>Command center</h2>
        <p className={pageDesc}>
          High-level view of active residents across safehouses, recent supporter activity, upcoming case
          conferences, and reintegration progress (Lighthouse CSV dataset + in-session updates).
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/admin/donor-pipeline"
            className={`${btnPrimary} inline-flex items-center gap-2`}
          >
            <GitBranch className="h-4 w-4" />
            Donor tools
          </Link>
          <Link
            to="/admin/resident-pipeline"
            className={`${btnPrimary} inline-flex items-center gap-2`}
          >
            <Waypoints className="h-4 w-4" />
            Resident tools
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active residents (all safehouses)" value={String(data.activeResidentsTotal)} />
        <StatCard
          label="Monetary gifts (30 days)"
          value={moneyPhp.format(data.monetaryDonationsLast30DaysPhp)}
        />
        <StatCard
          label="Counseling sessions (all time)"
          value={String(data.processRecordingsCount)}
          sub="Session documentation"
        />
        <StatCard
          label="Home & field visits (90 days)"
          value={String(data.homeVisitationsLast90Days)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Home className="h-4 w-4 text-primary" />
            Safehouse occupancy
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            {data.safehouses.map((s) => (
              <li key={s.id} className="flex justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
                <span className="text-muted-foreground">
                  {s.name}{' '}
                  <span className="text-xs">({s.region})</span>
                </span>
                <span className="font-medium tabular-nums text-foreground">
                  {s.occupancy}/{s.capacity}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className={card}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            Upcoming case conferences
          </h3>
          {data.upcomingCaseConferences.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No scheduled conferences in the dataset window.</p>
          ) : (
            <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto text-sm">
              {data.upcomingCaseConferences.map((c) => (
                <li key={c.planId} className="border-b border-border/60 pb-2 last:border-0">
                  <p className="font-medium text-foreground">
                    {c.residentInternalCode} · {c.planCategory}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.caseConferenceDate
                      ? new Date(c.caseConferenceDate).toLocaleString()
                      : 'Date TBD'}{' '}
                    · {c.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Recent contributions</h3>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Supporter</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Amount / value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.recentDonations.map((d) => (
                <tr key={d.donationId} className="hover:bg-muted/30">
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(d.donationDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 font-medium">{d.supporterDisplayName}</td>
                  <td className="px-4 py-2">{d.donationType}</td>
                  <td className="px-4 py-2">
                    {d.amount != null && d.currencyCode
                      ? moneyPhp.format(d.amount)
                      : d.amount != null
                        ? String(d.amount)
                        : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold text-foreground">Reintegration snapshot</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Completed: <span className="font-medium text-foreground">{data.reintegration.completedCount}</span>
          {' · '}
          In progress:{' '}
          <span className="font-medium text-foreground">{data.reintegration.inProgressCount}</span>
          {' · '}
          Success rate (completed / with status):{' '}
          <span className="font-medium text-primary">{data.reintegration.successRatePercent}%</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link to="/admin/donors" className={linkTile}>
          <span className="flex items-center gap-2">
            <Heart className="h-4 w-4" /> Supporters & gifts
          </span>
          <ArrowRight className="h-4 w-4 opacity-70" />
        </Link>
        <Link to="/admin/donor-pipeline" className={linkTile}>
          <span className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" /> Donor tools
          </span>
          <ArrowRight className="h-4 w-4 opacity-70" />
        </Link>
        <Link to="/admin/residents" className={linkTile}>
          <span className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Residents
          </span>
          <ArrowRight className="h-4 w-4 opacity-70" />
        </Link>
        <Link to="/admin/resident-pipeline" className={linkTile}>
          <span className="flex items-center gap-2">
            <Waypoints className="h-4 w-4" /> Resident tools
          </span>
          <ArrowRight className="h-4 w-4 opacity-70" />
        </Link>
        <Link to="/admin/home-visitations" className={linkTile}>
          <span className="flex items-center gap-2">
            <Video className="h-4 w-4" /> Home visitation
          </span>
          <ArrowRight className="h-4 w-4 opacity-70" />
        </Link>
        <Link to="/admin/process-recordings" className={linkTile}>
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Counseling sessions
          </span>
          <ArrowRight className="h-4 w-4 opacity-70" />
        </Link>
        <Link to="/admin/reports" className={linkTile}>
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Reports
          </span>
          <ArrowRight className="h-4 w-4 opacity-70" />
        </Link>
      </div>
    </div>
  )
}
