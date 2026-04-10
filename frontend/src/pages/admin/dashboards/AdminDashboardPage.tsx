import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  GitBranch,
  Heart,
  Home,
  Mail,
  Star,
  TrendingUp,
  Users,
  Video,
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
  alertError,
  card,
  pageDesc,
  pageTitle,
  statCardInner,
  statCardSub,
  statCardValue,
} from '../shared/adminStyles'
import { formatUsd } from '../../../utils/currency'

function listRowShell(extra = '') {
  return `rounded-lg border border-border bg-muted/15 px-3 py-2 text-sm ${extra}`.trim()
}

function KpiCard({
  label,
  value,
  sub,
  accentClass,
  icon: Icon,
  to,
}: {
  label: string
  value: string
  sub?: string
  accentClass: string
  icon: React.ElementType
  /** When set, the whole card navigates here (keyboard- and screen-reader friendly). */
  to?: string
}) {
  const body = (
    <>
      <div className={`absolute left-0 top-0 h-full w-1 ${accentClass}`} />
      <div className="flex items-start justify-between gap-2 pl-3">
        <div className="min-w-0">
          <p className={statCardInner}>{label}</p>
          <p className={`${statCardValue} truncate`}>{value}</p>
          {sub ? <p className={statCardSub}>{sub}</p> : null}
        </div>
        <div className="shrink-0 rounded-lg bg-muted/50 p-2">
          <Icon className="h-4 w-4 text-primary" aria-hidden />
        </div>
      </div>
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className={`${card} relative block overflow-hidden transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
      >
        {body}
      </Link>
    )
  }

  return <div className={`${card} relative overflow-hidden`}>{body}</div>
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
  const barClass = pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-accent' : 'bg-primary'
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

const logResidentCareOptions: { id: string; label: string; to: string }[] = [
  { id: 'counseling', label: 'Counseling session', to: '/admin/process-recordings?new=1' },
  { id: 'home-visit', label: 'Home visit', to: '/admin/home-visitations?new=1' },
  { id: 'education', label: 'Education', to: '/admin/residents?pickFor=education' },
  { id: 'health', label: 'Health', to: '/admin/residents?pickFor=health' },
  { id: 'intervention', label: 'Intervention', to: '/admin/residents?pickFor=plan' },
  { id: 'incident', label: 'Incident', to: '/admin/residents?pickFor=incident' },
]

const otherQuickActions: { id: string; label: string; icon: React.ElementType; to: string }[] = [
  { id: 'add-resident', label: 'Add resident', icon: Users, to: '/admin/residents?new=1' },
  { id: 'add-donor', label: 'Add donor', icon: Heart, to: '/admin/donors?new=1' },
  { id: 'email-donors', label: 'Email donors', icon: Mail, to: '/admin/email-hub' },
]

function LogResidentCareMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-muted/50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Log Resident Care
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open ? (
        <div
          className="absolute left-0 z-50 mt-2 min-w-[15rem] rounded-xl border border-border bg-card py-1 shadow-lg"
          role="menu"
        >
          {logResidentCareOptions.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-foreground hover:bg-muted/60"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

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
    getResidents({})
      .then((r) => {
        if (!cancelled) {
          setResidents(r)
          setResidentsLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setResidentsLoading(false)
      })
    getAtRiskDonors(0.55, 10)
      .then((r) => {
        if (!cancelled) setAtRiskDonors(r)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <p className="text-sm text-muted-foreground">Loading dashboard…</p>
  if (error || !data) {
    return <div className={alertError}>{error ?? 'No data'}</div>
  }

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

  const badgeMuted = 'ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground'

  return (
    <div className="space-y-6">
      <div>
        <h2 className={pageTitle}>Admin Dashboard</h2>
        <p className={pageDesc}>Live overview of operations — residents, donors, conferences, and outcomes.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <LogResidentCareMenu />
          {otherQuickActions.map(({ id, label, icon: Icon, to }) => (
            <Link
              key={id}
              to={to}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-muted/50"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Active residents"
          value={String(data.activeResidentsTotal)}
          sub={`across ${data.safehouses.length} safehouse${data.safehouses.length === 1 ? '' : 's'}`}
          accentClass="bg-primary"
          icon={Users}
          to="/admin/residents"
        />
        <KpiCard
          label="Monetary gifts (30 d)"
          value={formatUsd(data.monetaryDonationsLast30DaysPhp)}
          accentClass="bg-accent"
          icon={Heart}
          to="/admin/contributions"
        />
        <KpiCard
          label="Reintegration success"
          value={`${data.reintegration.successRatePercent}%`}
          sub={`${data.reintegration.completedCount} completed · ${data.reintegration.inProgressCount} in progress`}
          accentClass="bg-foreground/55"
          icon={TrendingUp}
          to="/admin/reintigration-readiness"
        />
        <KpiCard
          label="Counseling sessions"
          value={String(data.processRecordingsCount)}
          sub="all-time sessions"
          accentClass="bg-primary/45"
          icon={ClipboardList}
          to="/admin/process-recordings"
        />
        <KpiCard
          label="Home & field visits"
          value={String(data.homeVisitationsLast90Days)}
          sub="last 90 days"
          accentClass="bg-accent/70"
          icon={Video}
          to="/admin/home-visitations"
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">More shortcuts</p>
        <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Residents on file"
            value={residentsLoading ? '—' : String(residents.length)}
            sub="All statuses in directory"
            accentClass="bg-primary"
            icon={Users}
            to="/admin/residents"
          />
          <KpiCard
            label="Upcoming conferences"
            value={String(conferencesSorted.length)}
            sub="Scheduled case conferences"
            accentClass="bg-accent"
            icon={CalendarDays}
            to="/admin/case-conferences"
          />
          <KpiCard
            label="Reintegration in progress"
            value={String(data.reintegration.inProgressCount)}
            sub={`${data.reintegration.completedCount} completed to date`}
            accentClass="bg-foreground/55"
            icon={Star}
            to="/admin/reintigration-readiness"
          />
          <KpiCard
            label="At-risk donors"
            value={String(atRiskDonors.length)}
            sub="Flagged for outreach"
            accentClass="bg-primary/45"
            icon={Mail}
            to="/admin/email-hub"
          />
          <KpiCard
            label="Program analytics"
            value="Reports"
            sub="Donations, safehouses, outcomes"
            accentClass="bg-accent/70"
            icon={BarChart3}
            to="/admin/reports"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Home className="h-4 w-4 shrink-0 text-primary" aria-hidden />
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
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            Upcoming case conferences
            {conferencesSorted.length > 0 && <span className={badgeMuted}>{conferencesSorted.length}</span>}
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
                    className={`border-l-2 pl-3 py-2 text-sm ${
                      isUrgent
                        ? 'border-l-destructive/60 bg-destructive/5'
                        : isSoon
                          ? 'border-l-accent bg-accent/10'
                          : 'border-l-border bg-muted/15'
                    } rounded-r-lg rounded-tl-sm`}
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
                                ? 'bg-accent/20 text-foreground'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {days <= 0 ? 'Today' : `${days}d`}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.caseConferenceDate ? new Date(c.caseConferenceDate).toLocaleDateString() : 'Date TBD'} · {c.status}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
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
                  className={`${listRowShell('border-l-2 border-l-destructive/50')}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{r.internalCode}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.safehouseName ?? '—'} · {r.assignedSocialWorker ?? 'Unassigned'}
                      </p>
                    </div>
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                      {r.currentRiskLevel}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/residents" className="mt-4 flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View all residents <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>

        <div className={card}>
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <CheckCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            Reintegration pipeline
            {reintegrationReady.length > 0 && (
              <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
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
                <li key={r.id} className={listRowShell()}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{r.internalCode}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.safehouseName ?? '—'}
                        {r.lengthOfStay ? ` · ${r.lengthOfStay}` : ''}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary">
                      {r.reintegrationStatus}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{data.reintegration.completedCount}</span> completed
            </span>
            <span>
              <span className="font-semibold text-foreground">{data.reintegration.inProgressCount}</span> in progress
            </span>
            <span className="font-semibold text-foreground">{data.reintegration.successRatePercent}% success</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <GitBranch className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            Donors at churn risk
            {atRiskDonors.length > 0 && (
              <span className="ml-auto rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-foreground">
                {atRiskDonors.length}
              </span>
            )}
          </h3>
          {atRiskDonors.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No at-risk donors detected or ML service unavailable.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {atRiskDonors.slice(0, 5).map((d) => (
                <li key={d.supporter_id} className={listRowShell()}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">Donor #{d.supporter_id}</p>
                      <p className="text-xs text-muted-foreground">{d.risk_tier}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        d.risk_tier === 'High Risk'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-accent/15 text-foreground'
                      }`}
                    >
                      {Math.round(d.churn_probability * 100)}% churn
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/email-hub" className="mt-4 flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            Open Donor Outreach → reach at-risk donors <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>

        <div className={card}>
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Heart className="h-4 w-4 shrink-0 text-primary" aria-hidden />
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
                    {d.amount != null ? formatUsd(d.amount) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/donors" className="mt-4 flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View all supporters <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  )
}
