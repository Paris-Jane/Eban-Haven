import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  FileText,
  GitBranch,
  Heart,
  Home,
  Mail,
  TrendingUp,
  Users,
  Video,
  Waypoints,
} from 'lucide-react'
import {
  getDashboard,
  getAtRiskDonors,
  getResidents,
  type DashboardSummary,
  type AtRiskDonorInfo,
  type ResidentSummary,
} from '../../../api/admin'
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

function KpiCard({
  label,
  value,
  sub,
  accentClass,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  accentClass: string
  icon: React.ElementType
}) {
  return (
    <div className={`${card} relative overflow-hidden`}>
      <div className={`absolute left-0 top-0 h-full w-1 ${accentClass}`} />
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

function SafehouseBar({
  name,
  region,
  occupancy,
  capacity,
}: {
  name: string
  region: string
  occupancy: number
  capacity: number
}) {
  const pct = capacity > 0 ? Math.round((occupancy / capacity) * 100) : 0
  const barClass = pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-amber-500' : 'bg-primary'
  return (
    <li className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{name}</span>
        <span className="tabular-nums text-muted-foreground">
          {occupancy}/{capacity} · {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{region}</p>
    </li>
  )
}

const quickActions = [
  { label: 'Add resident', icon: Users, to: '/admin/residents' },
  { label: 'Add donor', icon: Heart, to: '/admin/donors' },
  { label: 'Log session', icon: FileText, to: '/admin/process-recordings' },
  { label: 'Home visit', icon: Home, to: '/admin/home-visitations' },
  { label: 'Email donors', icon: Mail, to: '/admin/email-hub' },
  { label: 'Reports', icon: BarChart3, to: '/admin/reports' },
]

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

export function AdminDashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [atRiskDonors, setAtRiskDonors] = useState<AtRiskDonorInfo[]>([])
  const [residentsLoading, setResidentsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await getDashboard()
        if (!cancelled) { setData(d); setError(null) }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    // Non-critical supplementary data — load silently
    getResidents()
      .then((r) => { if (!cancelled) { setResidents(r); setResidentsLoading(false) } })
      .catch(() => { if (!cancelled) setResidentsLoading(false) })
    getAtRiskDonors(0.55, 10)
      .then((r) => { if (!cancelled) setAtRiskDonors(r) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (loading) return <p className="text-muted-foreground">Loading dashboard…</p>
  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        {error ?? 'No data'}
      </div>
    )
  }

  // Derived resident slices
  const atRiskResidents = residents
    .filter(
      (r) =>
        r.caseStatus === 'Active' &&
        (r.currentRiskLevel?.toLowerCase().includes('high') ||
          r.currentRiskLevel?.toLowerCase().includes('critical')),
    )
    .slice(0, 6)

  const reintegrationReady = residents
    .filter(
      (r) =>
        r.caseStatus === 'Active' &&
        r.reintegrationStatus != null &&
        !r.reintegrationStatus.toLowerCase().includes('none'),
    )
    .slice(0, 6)

  const conferencesSorted = [...data.upcomingCaseConferences].sort((a, b) => {
    if (!a.caseConferenceDate) return 1
    if (!b.caseConferenceDate) return -1
    return new Date(a.caseConferenceDate).getTime() - new Date(b.caseConferenceDate).getTime()
  })

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <h2 className={pageTitle}>Command center</h2>
        <p className={pageDesc}>
          Live overview of operations — residents, donors, conferences, and outcomes.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {quickActions.map(({ label, icon: Icon, to }) => (
            <Link
              key={to}
              to={to}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <Icon className="h-3.5 w-3.5 text-primary" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Active residents"
          value={String(data.activeResidentsTotal)}
          sub={`across ${data.safehouses.length} safehouse${data.safehouses.length === 1 ? '' : 's'}`}
          accentClass="bg-primary"
          icon={Users}
        />
        <KpiCard
          label="Monetary gifts (30 d)"
          value={moneyPhp.format(data.monetaryDonationsLast30DaysPhp)}
          accentClass="bg-emerald-500"
          icon={Heart}
        />
        <KpiCard
          label="Reintegration success"
          value={`${data.reintegration.successRatePercent}%`}
          sub={`${data.reintegration.completedCount} completed · ${data.reintegration.inProgressCount} in progress`}
          accentClass="bg-sky-500"
          icon={TrendingUp}
        />
        <KpiCard
          label="Process recordings"
          value={String(data.processRecordingsCount)}
          sub="all-time sessions"
          accentClass="bg-violet-500"
          icon={ClipboardList}
        />
        <KpiCard
          label="Home & field visits"
          value={String(data.homeVisitationsLast90Days)}
          sub="last 90 days"
          accentClass="bg-amber-500"
          icon={Video}
        />
      </div>

      {/* ── Safehouses + Conferences ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Home className="h-4 w-4 text-primary" />
            Safehouse occupancy
          </h3>
          {data.safehouses.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No safehouse data available.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {data.safehouses.map((s) => (
                <SafehouseBar key={s.id} {...s} />
              ))}
            </ul>
          )}
        </div>

        <div className={card}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            Upcoming case conferences
            {conferencesSorted.length > 0 && (
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {conferencesSorted.length}
              </span>
            )}
          </h3>
          {conferencesSorted.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No upcoming conferences in the dataset window.</p>
          ) : (
            <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {conferencesSorted.map((c) => {
                const days = daysUntil(c.caseConferenceDate)
                const isUrgent = days !== null && days <= 3
                const isSoon = days !== null && days <= 7 && !isUrgent
                return (
                  <li
                    key={c.planId}
                    className={`rounded-lg border-l-2 pl-3 py-2 text-sm ${
                      isUrgent
                        ? 'border-l-destructive/70 bg-destructive/5'
                        : isSoon
                          ? 'border-l-amber-400 bg-amber-500/5'
                          : 'border-l-border/50 bg-muted/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground">
                        {c.residentInternalCode} · {c.planCategory}
                      </p>
                      {days !== null && (
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                            isUrgent
                              ? 'bg-destructive/10 text-destructive'
                              : isSoon
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {days <= 0 ? 'Today' : `${days}d`}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.caseConferenceDate
                        ? new Date(c.caseConferenceDate).toLocaleDateString()
                        : 'Date TBD'}{' '}
                      · {c.status}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── At-Risk Residents + Reintegration Ready ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Girls at high risk
            {atRiskResidents.length > 0 && (
              <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                {atRiskResidents.length}
              </span>
            )}
          </h3>
          {residentsLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading resident data…</p>
          ) : atRiskResidents.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No high-risk residents currently flagged.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {atRiskResidents.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-lg bg-destructive/5 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">{r.internalCode}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.safehouseName ?? '—'} · {r.assignedSocialWorker ?? 'Unassigned'}
                    </p>
                  </div>
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                    {r.currentRiskLevel}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/admin/residents"
            className="mt-4 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all residents <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className={card}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            Reintegration pipeline
            {reintegrationReady.length > 0 && (
              <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                {reintegrationReady.length}
              </span>
            )}
          </h3>
          {residentsLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading resident data…</p>
          ) : reintegrationReady.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No residents currently in reintegration pipeline.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {reintegrationReady.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-lg bg-emerald-500/5 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">{r.internalCode}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.safehouseName ?? '—'}
                      {r.lengthOfStay ? ` · ${r.lengthOfStay}` : ''}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                    {r.reintegrationStatus}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{data.reintegration.completedCount}</span>{' '}
              completed
            </span>
            <span>
              <span className="font-semibold text-foreground">{data.reintegration.inProgressCount}</span>{' '}
              in progress
            </span>
            <span className="font-semibold text-primary">{data.reintegration.successRatePercent}% success</span>
          </div>
        </div>
      </div>

      {/* ── At-Risk Donors + Recent Contributions ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <GitBranch className="h-4 w-4 text-amber-500" />
            Donors at churn risk
            {atRiskDonors.length > 0 && (
              <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
                {atRiskDonors.length}
              </span>
            )}
          </h3>
          {atRiskDonors.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No at-risk donors detected or ML service unavailable.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {atRiskDonors.slice(0, 5).map((d) => (
                <li
                  key={d.supporter_id}
                  className="flex items-center justify-between rounded-lg bg-amber-500/5 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">Donor #{d.supporter_id}</p>
                    <p className="text-xs text-muted-foreground">{d.risk_tier}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      d.risk_tier === 'High Risk'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-amber-500/10 text-amber-600'
                    }`}
                  >
                    {Math.round(d.churn_probability * 100)}% churn
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/admin/email-hub"
            className="mt-4 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open Email Hub → reach at-risk donors <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className={card}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Heart className="h-4 w-4 text-primary" />
            Recent contributions
          </h3>
          {data.recentDonations.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No recent donations recorded.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.recentDonations.slice(0, 6).map((d) => (
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
          <Link
            to="/admin/donors"
            className="mt-4 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all supporters <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* ── Navigation tiles ── */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">All tools</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Link to="/admin/donors" className={linkTile}>
            <span className="flex items-center gap-2">
              <Heart className="h-4 w-4" /> Supporters &amp; gifts
            </span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
          <Link to="/admin/donor-pipeline" className={linkTile}>
            <span className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" /> Donor tools
            </span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
          <Link to="/admin/email-hub" className={linkTile}>
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email Hub
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
              <Video className="h-4 w-4" /> Home visitations
            </span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
          <Link to="/admin/process-recordings" className={linkTile}>
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Process recordings
            </span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
          <Link to="/admin/reports" className={linkTile}>
            <span className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Reports
            </span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
        </div>
      </div>
    </div>
  )
}
