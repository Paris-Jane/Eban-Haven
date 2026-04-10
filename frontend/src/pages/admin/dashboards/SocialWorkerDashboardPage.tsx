import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FileText,
  HeartHandshake,
  Home,
  Sparkles,
  TriangleAlert,
  Video,
  Waypoints,
} from 'lucide-react'
import {
  getDashboard,
  getHomeVisitations,
  getInterventionPlans,
  getProcessRecordings,
  getResidents,
  type DashboardSummary,
  type HomeVisitation,
  type InterventionPlan,
  type ProcessRecording,
  type ResidentSummary,
} from '../../../api/admin'
import { alertError, card, pageDesc, pageTitle, statCardInner, statCardSub, statCardValue } from '../shared/adminStyles'

const shortcuts = [
  {
    to: '/admin/residents',
    label: 'Residents',
    hint: 'Case files, status, and resident records',
    icon: ClipboardList,
  },
  {
    to: '/admin/process-recordings',
    label: 'Counseling sessions',
    hint: 'Worker-resident sessions, observations, interventions, and follow-up',
    icon: FileText,
  },
  {
    to: '/admin/home-visitations',
    label: 'Home visitations',
    hint: 'Family contact, field checks, and reintegration visits',
    icon: Video,
  },
  {
    to: '/admin/case-conferences',
    label: 'Case conferences',
    hint: 'Plans, conference dates, and service coordination',
    icon: CalendarDays,
  },
] as const

function toDateValue(value: string | null | undefined) {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

function daysUntil(value: string | null | undefined) {
  const time = toDateValue(value)
  if (time == null) return null
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((time - startOfToday) / (1000 * 60 * 60 * 24))
}

function residentLabel(resident: ResidentSummary) {
  return resident.internalCode || resident.caseControlNo
}

function residentPath(residentId: number) {
  return `/admin/residents/${residentId}`
}

function KpiCard({
  label,
  value,
  sub,
  accentClass,
  icon: Icon,
  onClick,
  actionLabel,
}: {
  label: string
  value: string
  sub: string
  accentClass: string
  icon: React.ElementType
  onClick: () => void
  actionLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${card} relative w-full overflow-hidden text-left transition-colors hover:border-primary/30 hover:bg-muted/20`}
    >
      <div className={`absolute left-0 top-0 h-full w-1 ${accentClass}`} />
      <div className="flex items-start justify-between gap-2 pl-3">
        <div className="min-w-0">
          <p className={statCardInner}>{label}</p>
          <p className={statCardValue}>{value}</p>
          <p className={statCardSub}>{sub}</p>
          <p className="mt-3 text-xs font-medium text-primary">{actionLabel}</p>
        </div>
        <div className="shrink-0 rounded-lg bg-muted/60 p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </button>
  )
}

export function SocialWorkerDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [recordings, setRecordings] = useState<ProcessRecording[]>([])
  const [visitations, setVisitations] = useState<HomeVisitation[]>([])
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [highlightSection, setHighlightSection] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const [dashboardData, residentRows, recordingRows, visitationRows, planRows] = await Promise.all([
          getDashboard(),
          getResidents({}),
          getProcessRecordings(),
          getHomeVisitations(),
          getInterventionPlans(),
        ])

        if (!cancelled) {
          setDashboard(dashboardData)
          setResidents(residentRows)
          setRecordings(recordingRows)
          setVisitations(visitationRows)
          setPlans(planRows)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load social worker dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const residentLookup = useMemo(() => new Map(residents.map((resident) => [resident.id, resident])), [residents])

  const openCases = residents.filter((resident) => resident.caseStatus.toLowerCase() !== 'closed')
  const reintegrationInProgress = residents.filter((resident) =>
    (resident.reintegrationStatus ?? '').toLowerCase().includes('in progress'),
  )
  const highRiskResidents = residents.filter((resident) => {
    const risk = (resident.currentRiskLevel ?? '').toLowerCase()
    return risk.includes('high') || risk.includes('critical')
  })

  const recentRecordings = [...recordings]
    .sort((a, b) => (toDateValue(b.sessionDate) ?? 0) - (toDateValue(a.sessionDate) ?? 0))
    .slice(0, 5)

  const recentVisits = [...visitations]
    .sort((a, b) => (toDateValue(b.visitDate) ?? 0) - (toDateValue(a.visitDate) ?? 0))
    .slice(0, 5)

  const upcomingPlans = [...plans]
    .filter((plan) => {
      const days = daysUntil(plan.caseConferenceDate)
      return days != null && days >= 0
    })
    .sort((a, b) => (toDateValue(a.caseConferenceDate) ?? 0) - (toDateValue(b.caseConferenceDate) ?? 0))
    .slice(0, 5)

  const overdueFollowUps = [
    ...plans
      .filter((plan) => {
        const days = daysUntil(plan.targetDate)
        return days != null && days < 0 && plan.status.toLowerCase() !== 'completed'
      })
      .map((plan) => ({
        id: `plan-${plan.id}`,
        residentId: plan.residentId,
        title: `${plan.planCategory} target overdue`,
        detail: plan.planDescription,
        date: plan.targetDate,
        kind: 'Plan target',
      })),
    ...visitations
      .filter((visit) => visit.followUpNeeded)
      .sort((a, b) => (toDateValue(b.visitDate) ?? 0) - (toDateValue(a.visitDate) ?? 0))
      .slice(0, 5)
      .map((visit) => ({
        id: `visit-${visit.id}`,
        residentId: visit.residentId,
        title: 'Visit follow-up needed',
        detail: visit.followUpNotes || visit.visitOutcome || visit.purpose || 'Review next field action.',
        date: visit.visitDate,
        kind: 'Home visit',
      })),
  ]
    .sort((a, b) => (toDateValue(a.date) ?? 0) - (toDateValue(b.date) ?? 0))
    .slice(0, 6)

  const activeCaseload = [...openCases]
    .sort((a, b) => {
      const riskA = (a.currentRiskLevel ?? '').toLowerCase()
      const riskB = (b.currentRiskLevel ?? '').toLowerCase()
      const rank = (risk: string) => (risk.includes('critical') ? 3 : risk.includes('high') ? 2 : risk.includes('moderate') ? 1 : 0)
      return rank(riskB) - rank(riskA)
    })
    .slice(0, 6)

  function focusSection(sectionId: string) {
    setHighlightSection(sectionId)
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => {
      setHighlightSection((current) => (current === sectionId ? null : current))
    }, 1800)
  }

  if (loading) return <p className="text-muted-foreground">Loading social worker dashboard…</p>

  if (error || !dashboard) {
    return <div className={alertError}>{error ?? 'No dashboard data available.'}</div>
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Social Worker Dashboard</h2>
        <p className={pageDesc}>
          Caseload priorities, follow-up work, and documentation cues for daily practice.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Open cases"
          value={String(openCases.length)}
          sub="Residents currently active in program records"
          accentClass="bg-primary"
          icon={HeartHandshake}
          actionLabel="View active caseload"
          onClick={() => focusSection('active-caseload')}
        />
        <KpiCard
          label="High-risk residents"
          value={String(highRiskResidents.length)}
          sub="Current risk marked high or critical"
          accentClass="bg-destructive"
          icon={TriangleAlert}
          actionLabel="Review high-risk residents"
          onClick={() => focusSection('high-risk-residents')}
        />
        <KpiCard
          label="Reintegration"
          value={String(reintegrationInProgress.length)}
          sub={`Success rate ${dashboard.reintegration.successRatePercent.toFixed(0)}%`}
          accentClass="bg-sky-500"
          icon={Waypoints}
          actionLabel="Open reintegration watch"
          onClick={() => focusSection('reintegration-watch')}
        />
        <KpiCard
          label="Upcoming conferences"
          value={String(dashboard.upcomingCaseConferences.length)}
          sub="Conference-linked plans already scheduled"
          accentClass="bg-amber-500"
          icon={CalendarDays}
          actionLabel="Jump to upcoming plans"
          onClick={() => focusSection('upcoming-plans')}
        />
        <KpiCard
          label="Home visits (90 d)"
          value={String(dashboard.homeVisitationsLast90Days)}
          sub="Recent field and family contact volume"
          accentClass="bg-emerald-500"
          icon={Home}
          actionLabel="See recent visit activity"
          onClick={() => focusSection('recent-documentation')}
        />
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
        <div id="active-caseload" className={`${card} space-y-5 ${highlightSection === 'active-caseload' ? 'ring-2 ring-primary/30' : ''}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Active caseload</h3>
            </div>
            <Link to="/admin/residents" className="text-sm font-medium text-primary hover:underline">
              Open residents
            </Link>
          </div>
          <div className="space-y-3">
            {activeCaseload.length === 0 ? (
              <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                No active cases are currently available.
              </div>
            ) : (
              activeCaseload.map((resident) => (
                <div key={resident.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={residentPath(resident.id)} className="text-sm font-semibold text-primary hover:underline">
                        {residentLabel(resident)}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {resident.safehouseName ?? 'No safehouse listed'} · {resident.caseCategory}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Assigned {resident.assignedSocialWorker ?? '—'} · Risk {resident.currentRiskLevel ?? '—'}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {resident.caseStatus}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to={residentPath(resident.id)}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                    >
                      Open profile
                    </Link>
                    <Link
                      to="/admin/process-recordings"
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                    >
                      Log session
                    </Link>
                    <Link
                      to="/admin/home-visitations"
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                    >
                      Log visit
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div id="follow-up-queue" className={`${card} space-y-5 ${highlightSection === 'follow-up-queue' ? 'ring-2 ring-primary/30' : ''}`}>
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Immediate follow-up queue</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Overdue plan targets and visit follow-up prompts that may need outreach, supervision, or documentation updates.
          </p>

          <div className="space-y-3">
            {overdueFollowUps.length === 0 ? (
              <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                No overdue follow-up items were detected from current plans and home visitation records.
              </div>
            ) : (
              overdueFollowUps.map((item) => {
                const resident = residentLookup.get(item.residentId)
                return (
                  <div key={item.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-primary">{item.kind}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
                      </div>
                      <div className="text-right">
                        {resident ? (
                          <Link to={residentPath(resident.id)} className="text-sm font-medium text-primary hover:underline">
                            {residentLabel(resident)}
                          </Link>
                        ) : (
                          <p className="text-sm font-medium text-foreground">{`Resident #${item.residentId}`}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.date)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {resident ? (
                        <Link
                          to={residentPath(resident.id)}
                          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                        >
                          Open profile
                        </Link>
                      ) : null}
                      <Link
                        to={item.kind === 'Home visit' ? '/admin/home-visitations' : '/admin/case-conferences'}
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                      >
                        {item.kind === 'Home visit' ? 'Open visits' : 'Open plans'}
                      </Link>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div id="high-risk-residents" className={`${card} space-y-5 ${highlightSection === 'high-risk-residents' ? 'ring-2 ring-primary/30' : ''}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">High-risk residents</h3>
              </div>
              <Link to="/admin/residents" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {highRiskResidents.length === 0 ? (
                <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  No residents are currently marked high or critical risk.
                </div>
              ) : (
                highRiskResidents.slice(0, 6).map((resident) => (
                  <div key={resident.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={residentPath(resident.id)} className="text-sm font-semibold text-primary hover:underline">
                          {residentLabel(resident)}
                        </Link>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {resident.safehouseName ?? 'No safehouse listed'} · {resident.caseCategory}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Assigned {resident.assignedSocialWorker ?? '—'} · Reintegration {resident.reintegrationStatus ?? '—'}
                        </p>
                      </div>
                      <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                        {resident.currentRiskLevel ?? 'High risk'}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        to={residentPath(resident.id)}
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                      >
                        Open profile
                      </Link>
                      <Link
                        to="/admin/process-recordings"
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                      >
                        Log session
                      </Link>
                      <Link
                        to="/admin/home-visitations"
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                      >
                        Plan visit
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div id="reintegration-watch" className={`${card} space-y-5 ${highlightSection === 'reintegration-watch' ? 'ring-2 ring-primary/30' : ''}`}>
            <div className="flex items-center gap-2">
              <Waypoints className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Reintegration watch</h3>
            </div>
            <div className="space-y-3">
              {reintegrationInProgress.slice(0, 6).map((resident) => (
                <div key={resident.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link to={residentPath(resident.id)} className="text-sm font-semibold text-primary hover:underline">
                        {residentLabel(resident)}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {resident.safehouseName ?? 'No safehouse listed'} · {resident.caseCategory}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {resident.reintegrationStatus ?? '—'}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {resident.reintegrationType ?? 'No reintegration type recorded'} · Current risk {resident.currentRiskLevel ?? '—'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to={residentPath(resident.id)}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                    >
                      Open profile
                    </Link>
                    <Link
                      to="/admin/case-conferences"
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                    >
                      Review plan
                    </Link>
                  </div>
                </div>
              ))}
              {reintegrationInProgress.length === 0 ? (
                <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  No residents are currently marked as reintegration in progress.
                </div>
              ) : null}
            </div>
          </div>

          <div className={`${card} space-y-4`}>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Safehouse occupancy context</h3>
            </div>
            <div className="space-y-3">
              {dashboard.safehouses.map((safehouse) => {
                const occupancyPercent = safehouse.capacity > 0 ? (safehouse.occupancy / safehouse.capacity) * 100 : 0
                return (
                  <div key={safehouse.id} className="rounded-2xl border border-border bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{safehouse.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{safehouse.region}</p>
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {safehouse.occupancy}/{safehouse.capacity}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${Math.min(occupancyPercent, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div id="upcoming-plans" className={`${card} space-y-5 ${highlightSection === 'upcoming-plans' ? 'ring-2 ring-primary/30' : ''}`}>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Upcoming conferences & plan milestones</h3>
          </div>
          <div className="space-y-3">
            {upcomingPlans.length === 0 ? (
              <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                No upcoming case conferences or target milestones are currently scheduled.
              </div>
            ) : (
              upcomingPlans.map((plan) => {
                const resident = residentLookup.get(plan.residentId)
                const nextDate = plan.caseConferenceDate ?? plan.targetDate
                return (
                  <div key={plan.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{plan.planCategory}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{plan.planDescription}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {resident ? residentLabel(resident) : `Resident #${plan.residentId}`} · Status {plan.status}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">{formatDate(nextDate)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {plan.caseConferenceDate ? 'Case conference' : 'Target date'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {resident ? (
                        <Link
                          to={residentPath(resident.id)}
                          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                        >
                          Open profile
                        </Link>
                      ) : null}
                      <Link
                        to="/admin/case-conferences"
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                      >
                        Open plans
                      </Link>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div id="recent-documentation" className={`${card} space-y-5 ${highlightSection === 'recent-documentation' ? 'ring-2 ring-primary/30' : ''}`}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Recent documentation activity</h3>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Counseling sessions</p>
              <div className="mt-3 space-y-3">
                {recentRecordings.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    No counseling sessions yet.
                  </div>
                ) : (
                  recentRecordings.map((recording) => (
                    <div key={recording.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{recording.residentInternalCode}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {recording.sessionType} · {recording.socialWorker}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(recording.sessionDate)}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          to={`/admin/residents/${recording.residentId}`}
                          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                        >
                          Open profile
                        </Link>
                        <Link
                          to="/admin/process-recordings"
                          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                        >
                          View sessions
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Home visitations</p>
              <div className="mt-3 space-y-3">
                {recentVisits.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    No home visit records yet.
                  </div>
                ) : (
                  recentVisits.map((visit) => (
                    <div key={visit.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{visit.residentInternalCode}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {visit.visitType} · {visit.socialWorker}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(visit.visitDate)}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          to={`/admin/residents/${visit.residentId}`}
                          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                        >
                          Open profile
                        </Link>
                        <Link
                          to="/admin/home-visitations"
                          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
                        >
                          View visits
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map(({ to, label, hint, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/20"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">{label}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p>
          </Link>
        ))}
      </section>
    </div>
  )
}
