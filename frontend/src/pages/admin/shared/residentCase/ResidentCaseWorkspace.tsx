import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  getResident,
  patchResident,
  getSafehouses,
  getProcessRecordings,
  getHomeVisitations,
  getInterventionPlans,
  listEducationRecords,
  listHealthRecords,
  listIncidentReports,
  createIncidentReport,
  deleteProcessRecording,
  deleteHomeVisitation,
  type ResidentDetail,
  type ProcessRecording,
  type HomeVisitation,
  type InterventionPlan,
  type EducationRecord,
  type HealthRecord,
  type JsonTableRow,
  type SafehouseOption,
} from '../../../../api/admin'
import { alertError, btnPrimary, card, input, label, pageDesc, pageTitle } from '../adminStyles'
import { ReintegrationBadge, RiskBadge, StatusBadge } from '../adminDataTable/AdminBadges'
import { BooleanBadge, CategoryBadge } from '../adminDataTable/AdminBadges'
import { formatAdminDate } from '../adminDataTable/adminFormatters'
import { CASE_STATUSES, RISK_LEVELS, SEX_OPTIONS } from './caseConstants'
import { CaseDrawer, EmptyState, QuickActionButton, SectionHeader, StatTile, ToggleField } from './caseUi'
import {
  CounselingSection,
  EducationSection,
  HealthSection,
  HomeVisitDrawer,
  ProcessRecordingDrawer,
  VisitsSection,
} from './CareProgressContent'
import { PlansTabContent } from './PlansTabContent'
import {
  buildNextActions,
  buildTimelineItems,
  buildWorkspaceAlerts,
  filterTimeline,
  planIsOverdue,
  type MainWorkspaceTab,
  type TimelineItem,
  type TimelineKind,
} from './caseWorkspaceModel'

function gf(fields: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (fields[k] != null && fields[k] !== '') return fields[k]
    const snake = k.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
    if (fields[snake] != null && fields[snake] !== '') return fields[snake]
  }
  return ''
}

const TAB_LABELS: { k: MainWorkspaceTab; label: string }[] = [
  { k: 'overview', label: 'Overview' },
  { k: 'timeline', label: 'Case timeline' },
  { k: 'plans', label: 'Plans & goals' },
  { k: 'safety', label: 'Safety & incidents' },
  { k: 'info', label: 'Resident info' },
  { k: 'insights', label: 'Insights' },
]

const ACTIVITY_TYPES = [
  { id: 'counseling' as const, label: 'Counseling session' },
  { id: 'visit' as const, label: 'Home visit' },
  { id: 'education' as const, label: 'Education record' },
  { id: 'health' as const, label: 'Health record' },
  { id: 'incident' as const, label: 'Incident report' },
  { id: 'plan' as const, label: 'Intervention plan' },
]

export function ResidentCaseWorkspace({ residentId }: { residentId: number }) {
  const [mainTab, setMainTab] = useState<MainWorkspaceTab>('overview')
  const [detail, setDetail] = useState<ResidentDetail | null>(null)
  const [safehouses, setSafehouses] = useState<SafehouseOption[]>([])
  const [proc, setProc] = useState<ProcessRecording[]>([])
  const [vis, setVis] = useState<HomeVisitation[]>([])
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [edu, setEdu] = useState<EducationRecord[]>([])
  const [hl, setHl] = useState<HealthRecord[]>([])
  const [inc, setInc] = useState<JsonTableRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [incidentInfoOpen, setIncidentInfoOpen] = useState(false)
  const [incidentFormSaving, setIncidentFormSaving] = useState(false)
  const [incidentFormError, setIncidentFormError] = useState<string | null>(null)
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [incidentType, setIncidentType] = useState('Medical')
  const [incidentSeverity, setIncidentSeverity] = useState('Medium')
  const [incidentDescription, setIncidentDescription] = useState('')
  const [incidentResponse, setIncidentResponse] = useState('')
  const [incidentReportedBy, setIncidentReportedBy] = useState('')
  const [incidentResolved, setIncidentResolved] = useState(false)
  const [incidentFollowUp, setIncidentFollowUp] = useState(false)

  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [createSig, setCreateSig] = useState({ counseling: 0, visit: 0, education: 0, health: 0, plan: 0 })

  const [focusPlanId, setFocusPlanId] = useState<number | null>(null)

  /** Timeline → full editor (hideChrome sections) */
  const [tlEduId, setTlEduId] = useState<number | null>(null)
  const [tlHealthId, setTlHealthId] = useState<number | null>(null)

  const [procDrawer, setProcDrawer] = useState<
    null | { mode: 'view' | 'edit' | 'create'; row?: ProcessRecording | null }
  >(null)
  const [visitDrawer, setVisitDrawer] = useState<
    null | { mode: 'view' | 'edit' | 'create'; row?: HomeVisitation | null }
  >(null)
  const [deleteProcessId, setDeleteProcessId] = useState<number | null>(null)
  const [deleteVisitId, setDeleteVisitId] = useState<number | null>(null)
  const [drawerErr, setDrawerErr] = useState<string | null>(null)
  const [drawerSaving, setDrawerSaving] = useState(false)

  const [timelineKinds, setTimelineKinds] = useState<Set<TimelineKind>>(
    () => new Set<TimelineKind>(['process', 'visit', 'education', 'health', 'plan']),
  )
  const [timelineFrom, setTimelineFrom] = useState('')
  const [timelineTo, setTimelineTo] = useState('')
  const [timelineWorker, setTimelineWorker] = useState('')
  const [timelineSearch, setTimelineSearch] = useState('')
  const [tlConcerns, setTlConcerns] = useState(false)
  const [tlFollow, setTlFollow] = useState(false)
  const [tlProgress, setTlProgress] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isFinite(residentId) || residentId <= 0) return
    setLoading(true)
    setError(null)
    try {
      const [d, sh, p, v, pl, e, h, i] = await Promise.all([
        getResident(residentId),
        getSafehouses(),
        getProcessRecordings(residentId),
        getHomeVisitations(residentId),
        getInterventionPlans(residentId),
        listEducationRecords(residentId),
        listHealthRecords(residentId),
        listIncidentReports(residentId),
      ])
      setDetail(d)
      setSafehouses(sh)
      setProc(p)
      setVis(v)
      setPlans(pl)
      setEdu(e)
      setHl(h)
      setInc(i.map(r => ({
        id: r.id,
        fields: {
          resident_id: String(r.residentId),
          safehouse_id: r.safehouseId != null ? String(r.safehouseId) : '',
          incident_date: r.incidentDate,
          incident_type: r.incidentType,
          severity: r.severity,
          description: r.description ?? '',
          response_taken: r.responseTaken ?? '',
          resolved: String(r.resolved),
          resolution_date: r.resolutionDate ?? '',
          reported_by: r.reportedBy ?? '',
          follow_up_required: String(r.followUpRequired),
        },
      })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [residentId])

  useEffect(() => {
    void load()
  }, [load])

  const fields = detail?.fields ?? {}
  const internalCode = gf(fields, 'internal_code', 'internalCode') || `Resident #${residentId}`
  const safehouseId = Number(gf(fields, 'safehouse_id', 'safehouseId')) || 0
  const safehouseName =
    safehouses.find((s) => s.id === safehouseId)?.name ?? (safehouseId ? `Safehouse #${safehouseId}` : '—')

  const stats = useMemo(() => {
    const now = Date.now()
    const d30 = now - 30 * 86400000
    const sessions30 = proc.filter((r) => new Date(r.sessionDate).getTime() >= d30).length
    const visits30 = vis.filter((v) => new Date(v.visitDate).getTime() >= d30).length
    const activePlans = plans.filter(
      (p) => !p.status.toLowerCase().includes('closed') && !p.status.toLowerCase().includes('achieved'),
    ).length
    const overduePlans = plans.filter(planIsOverdue).length
    const latestEdu = [...edu].sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())[0]
    const latestHl = [...hl].sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())[0]
    const concernSessions = proc.filter((r) => r.concernsFlagged).length
    return {
      sessions30,
      visits30,
      activePlans,
      overduePlans,
      latestProgress: latestEdu?.progressPercent ?? null,
      latestHealth: latestHl?.healthScore ?? null,
      incidents: inc.length,
      concernSessions,
    }
  }, [proc, vis, plans, edu, hl, inc])

  const alerts = useMemo(
    () =>
      buildWorkspaceAlerts({
        riskLevel: gf(fields, 'current_risk_level', 'currentRiskLevel'),
        plans,
        vis,
        proc,
        edu,
        hl,
        assignedWorker: gf(fields, 'assigned_social_worker', 'assignedSocialWorker'),
        admission: gf(fields, 'date_of_admission', 'dateOfAdmission'),
      }),
    [fields, plans, vis, proc, edu, hl],
  )

  const timelineAll = useMemo(() => buildTimelineItems(proc, vis, edu, hl, plans), [proc, vis, edu, hl, plans])
  const timelineFiltered = useMemo(
    () =>
      filterTimeline(timelineAll, {
        kinds: timelineKinds,
        dateFrom: timelineFrom,
        dateTo: timelineTo,
        workerQ: timelineWorker,
        concernsOnly: tlConcerns,
        followUpOnly: tlFollow,
        progressOnly: tlProgress,
        search: timelineSearch,
      }),
    [timelineAll, timelineKinds, timelineFrom, timelineTo, timelineWorker, tlConcerns, tlFollow, tlProgress, timelineSearch],
  )

  const nextActions = useMemo(() => buildNextActions({ plans, vis, proc, edu }), [plans, vis, proc, edu])

  const emotionalCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of proc) {
      const e = r.emotionalStateObserved?.trim()
      if (e) m.set(e, (m.get(e) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [proc])

  function bumpCreate(kind: (typeof ACTIVITY_TYPES)[number]['id']) {
    setAddMenuOpen(false)
    setMainTab(kind === 'plan' ? 'plans' : kind === 'incident' ? 'safety' : 'timeline')
    setCreateSig((s) => ({
      ...s,
      counseling: kind === 'counseling' ? s.counseling + 1 : s.counseling,
      visit: kind === 'visit' ? s.visit + 1 : s.visit,
      education: kind === 'education' ? s.education + 1 : s.education,
      health: kind === 'health' ? s.health + 1 : s.health,
      plan: kind === 'plan' ? s.plan + 1 : s.plan,
    }))
    if (kind === 'incident') {
      setIncidentFormError(null)
      setIncidentInfoOpen(true)
    }
  }

  function onTimelineSelect(it: TimelineItem) {
    switch (it.ref.kind) {
      case 'process':
        setProcDrawer({ mode: 'view', row: it.ref.row })
        break
      case 'visit':
        setVisitDrawer({ mode: 'view', row: it.ref.row })
        break
      case 'education':
        setTlEduId(it.ref.row.id)
        break
      case 'health':
        setTlHealthId(it.ref.row.id)
        break
      case 'plan':
        setFocusPlanId(it.ref.row.id)
        setMainTab('plans')
        break
    }
  }

  if (!Number.isFinite(residentId) || residentId <= 0) {
    return <p className="text-destructive">Invalid resident.</p>
  }

  if (loading) return <p className="text-muted-foreground">Loading case…</p>
  if (error && !detail) return (
    <div className="space-y-3">
      <p className="text-destructive">{error}</p>
      <Link to="/admin/residents" className="text-sm text-primary hover:underline">← Back to residents</Link>
    </div>
  )
  if (!detail) return (
    <div className="space-y-3">
      <p className="text-destructive">Resident not found.</p>
      <Link to="/admin/residents" className="text-sm text-primary hover:underline">← Back to residents</Link>
    </div>
  )

  return (
    <div className="space-y-8">
      <div>
        <Link to="/admin/residents" className="text-sm text-primary hover:underline">
          ← Residents
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className={pageTitle}>{internalCode}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {gf(fields, 'case_status', 'caseStatus') ? <StatusBadge status={gf(fields, 'case_status', 'caseStatus')} /> : null}
              {gf(fields, 'current_risk_level', 'currentRiskLevel') ? (
                <RiskBadge level={gf(fields, 'current_risk_level', 'currentRiskLevel')} />
              ) : null}
              {gf(fields, 'reintegration_type', 'reintegrationType') ? (
                <CategoryBadge>{gf(fields, 'reintegration_type', 'reintegrationType')}</CategoryBadge>
              ) : null}
              {gf(fields, 'reintegration_status', 'reintegrationStatus') ? (
                <ReintegrationBadge value={gf(fields, 'reintegration_status', 'reintegrationStatus')} />
              ) : null}
            </div>
            <p className={`${pageDesc} mt-3 max-w-3xl`}>
              <span className="font-medium text-foreground">{safehouseName}</span>
              {' · '}
              {gf(fields, 'assigned_social_worker', 'assignedSocialWorker') || 'No worker assigned'}
              {gf(fields, 'date_of_admission', 'dateOfAdmission')
                ? ` · Admitted ${formatAdminDate(gf(fields, 'date_of_admission', 'dateOfAdmission'))}`
                : ''}
            </p>
          </div>
          <div className="relative flex flex-col items-stretch gap-2 sm:items-end">
            <button type="button" className={btnPrimary} onClick={() => setAddMenuOpen((o) => !o)}>
              Add activity
            </button>
            {addMenuOpen ? (
              <div
                className={`${card} absolute right-0 top-full z-40 mt-2 min-w-[14rem] space-y-1 py-2 shadow-lg`}
                role="menu"
              >
                {ACTIVITY_TYPES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="menuitem"
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => bumpCreate(a.id)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TAB_LABELS.map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setMainTab(t.k)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              mainTab === t.k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mainTab === 'overview' && (
        <div className="space-y-8">
          {alerts.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Needs attention</h3>
              {alerts.map((a, i) => (
                <div
                  key={i}
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    a.level === 'risk'
                      ? 'border-rose-400/60 bg-rose-500/10 text-black dark:text-black'
                      : a.level === 'warn'
                        ? 'border-amber-400/50 bg-amber-500/10 text-black dark:text-black'
                        : 'border-border bg-muted/40'
                  }`}
                >
                  {a.text}
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Quick snapshot</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile label="Counseling sessions (30d)" value={stats.sessions30} />
              <StatTile label="Home visits (30d)" value={stats.visits30} />
              <StatTile label="Active plans" value={stats.activePlans} />
              <StatTile label="Overdue plans" value={stats.overduePlans} />
              <StatTile label="Session flags (concerns)" value={stats.concernSessions} />
              <StatTile label="Latest education %" value={stats.latestProgress != null ? `${stats.latestProgress}%` : '—'} />
              <StatTile label="Latest wellbeing score" value={stats.latestHealth != null ? String(stats.latestHealth) : '—'} />
            </div>
          </div>

          <div className={`${card} space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground">Recent activity</h3>
              <button type="button" className="text-sm text-primary hover:underline" onClick={() => setMainTab('timeline')}>
                View full timeline
              </button>
            </div>
            <ul className="space-y-2">
              {timelineAll.slice(0, 12).length === 0 ? (
                <li className="text-sm text-muted-foreground">No activity yet.</li>
              ) : (
                timelineAll.slice(0, 12).map((it) => (
                  <li key={it.key}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-transparent px-2 py-2 text-left text-sm hover:border-border hover:bg-muted/40"
                      onClick={() => onTimelineSelect(it)}
                    >
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{it.title}</span>
                      <span className="ml-2 tabular-nums text-muted-foreground">{formatAdminDate(it.dateIso)}</span>
                      <p className="mt-0.5 text-foreground">{it.summary}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {it.flags.map((f) => (
                          <span
                            key={f.label}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              f.tone === 'danger'
                                ? 'bg-destructive/15 text-destructive'
                                : f.tone === 'warning'
                                  ? 'bg-amber-500/15 text-amber-900 dark:text-amber-100'
                                  : f.tone === 'success'
                                    ? 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-100'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {f.label}
                          </span>
                        ))}
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className={`${card} space-y-3`}>
            <h3 className="text-base font-semibold text-foreground">Suggested next steps</h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {nextActions.length === 0 ? <li>Nothing specific flagged — keep documentation current.</li> : null}
              {nextActions.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`${card} space-y-2`}>
              <h3 className="text-sm font-semibold text-foreground">Education trend</h3>
              <p className="text-xs text-muted-foreground">Last few records by date</p>
              <ul className="text-sm">
                {[...edu]
                  .sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())
                  .slice(0, 5)
                  .map((e) => (
                    <li key={e.id} className="flex justify-between border-b border-border/60 py-1">
                      <span>{formatAdminDate(e.recordDate)}</span>
                      <span className="tabular-nums">{e.progressPercent ?? '—'}%</span>
                    </li>
                  ))}
                {edu.length === 0 ? <li className="text-muted-foreground">No education records.</li> : null}
              </ul>
            </div>
            <div className={`${card} space-y-2`}>
              <h3 className="text-sm font-semibold text-foreground">Wellbeing trend</h3>
              <p className="text-xs text-muted-foreground">Recent scores (1–5)</p>
              <ul className="text-sm">
                {[...hl]
                  .sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())
                  .slice(0, 5)
                  .map((h) => (
                    <li key={h.id} className="flex justify-between border-b border-border/60 py-1">
                      <span>{formatAdminDate(h.recordDate)}</span>
                      <span className="tabular-nums">{h.healthScore ?? '—'}</span>
                    </li>
                  ))}
                {hl.length === 0 ? <li className="text-muted-foreground">No health records.</li> : null}
              </ul>
            </div>
          </div>
        </div>
      )}

      {mainTab === 'timeline' && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Unified chronological view of counseling sessions, visits, education, health, and plans. Select a row to open the full record.
          </p>
          <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-muted/20 p-4">
            <label className={label}>
              From
              <input type="date" className={input} value={timelineFrom} onChange={(e) => setTimelineFrom(e.target.value)} />
            </label>
            <label className={label}>
              To
              <input type="date" className={input} value={timelineTo} onChange={(e) => setTimelineTo(e.target.value)} />
            </label>
            <label className={label}>
              Worker contains
              <input className={input} value={timelineWorker} onChange={(e) => setTimelineWorker(e.target.value)} placeholder="Name" />
            </label>
            <label className={label}>
              Search
              <input className={input} value={timelineSearch} onChange={(e) => setTimelineSearch(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-3 text-sm">
              {(['process', 'visit', 'education', 'health', 'plan'] as TimelineKind[]).map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timelineKinds.has(k)}
                    onChange={() => {
                      setTimelineKinds((prev) => {
                        const n = new Set(prev)
                        if (n.has(k)) n.delete(k)
                        else n.add(k)
                        return n
                      })
                    }}
                  />
                  {k}
                </label>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={tlConcerns} onChange={(e) => setTlConcerns(e.target.checked)} />
              Concerns only (sessions)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={tlFollow} onChange={(e) => setTlFollow(e.target.checked)} />
              Follow-up only
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={tlProgress} onChange={(e) => setTlProgress(e.target.checked)} />
              Progress noted (sessions)
            </label>
          </div>

          <CounselingSection
            residentId={residentId}
            rows={proc}
            onReload={load}
            openCreateSignal={createSig.counseling}
            hideChrome
          />
          <VisitsSection
            residentId={residentId}
            rows={vis}
            onReload={load}
            openCreateSignal={createSig.visit}
            hideChrome
          />
          <EducationSection
            residentId={residentId}
            rows={edu}
            onReload={load}
            openCreateSignal={createSig.education}
            hideChrome
            initialOpenRecordId={tlEduId}
            onInitialOpenConsumed={() => setTlEduId(null)}
          />
          <HealthSection
            residentId={residentId}
            rows={hl}
            onReload={load}
            openCreateSignal={createSig.health}
            hideChrome
            initialOpenRecordId={tlHealthId}
            onInitialOpenConsumed={() => setTlHealthId(null)}
          />

          <div className="space-y-2">
            {timelineFiltered.length === 0 ? (
              <EmptyState title="No items match filters" />
            ) : (
              timelineFiltered.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => onTimelineSelect(it)}
                  className="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">{it.title}</span>
                    <span className="text-sm text-muted-foreground">{formatAdminDate(it.dateIso)}</span>
                    {it.worker ? <span className="text-sm text-muted-foreground">· {it.worker}</span> : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-foreground">{it.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {it.flags.map((f) => (
                      <span
                        key={f.label}
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          f.tone === 'danger'
                            ? 'bg-destructive/15 text-destructive'
                            : f.tone === 'warning'
                              ? 'bg-amber-500/15 text-amber-900 dark:text-amber-100'
                              : f.tone === 'success'
                                ? 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-100'
                                : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {f.label}
                      </span>
                    ))}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {mainTab === 'plans' && (
        <PlansTabContent
          residentId={residentId}
          plans={plans}
          onReload={load}
          openCreateSignal={createSig.plan}
          layout="workspace"
          focusPlanId={focusPlanId}
          onFocusPlanConsumed={() => setFocusPlanId(null)}
        />
      )}

      {mainTab === 'safety' && (
        <div className="space-y-6">
          <SectionHeader
            title="Incident reports"
            description="Logged incidents, responses, and follow-up for this resident."
            actions={
              <QuickActionButton
                onClick={() => {
                  setIncidentInfoOpen(true)
                  setIncidentFormError(null)
                }}
              >
                Log incident
              </QuickActionButton>
            }
          />
          {inc.length === 0 ? (
            <EmptyState
              title="No incident reports"
              hint="Log safety incidents, conflicts, medical events, and responses here."
              action={
                <QuickActionButton
                  onClick={() => {
                    setIncidentInfoOpen(true)
                    setIncidentFormError(null)
                  }}
                >
                  Log first incident
                </QuickActionButton>
              }
            />
          ) : (
            <div className="space-y-2">
              {inc.map((row) => {
                const f = row.fields
                const severity = f.severity ?? ''
                const severityColor =
                  severity === 'High'
                    ? 'text-red-600 bg-red-50 border-red-200'
                    : severity === 'Medium'
                      ? 'text-amber-600 bg-amber-50 border-amber-200'
                      : 'text-green-700 bg-green-50 border-green-200'
                const resolved = f.resolved === 'True' || f.resolved === 'true'
                return (
                  <div key={row.id} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{f.incident_type}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${severityColor}`}>{severity}</span>
                      {resolved ? (
                        <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          Resolved
                        </span>
                      ) : (
                        <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                          Open
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">{f.incident_date}</span>
                    </div>
                    {f.description ? <p className="mt-1.5 text-muted-foreground">{f.description}</p> : null}
                    {f.response_taken ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium">Response:</span> {f.response_taken}
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {f.reported_by ? <span>Reported by: {f.reported_by}</span> : null}
                      {f.resolution_date ? <span>Resolved: {f.resolution_date}</span> : null}
                      {f.follow_up_required === 'True' || f.follow_up_required === 'true' ? (
                        <span className="font-medium text-amber-600">Follow-up required</span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Review safety signals from counseling sessions and home visits alongside formal incidents above.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`${card} space-y-3`}>
              <h3 className="text-base font-semibold text-foreground">Counseling — concerns flagged</h3>
              <ul className="space-y-2 text-sm">
                {proc
                  .filter((r) => r.concernsFlagged)
                  .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
                  .map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="w-full rounded-lg border border-border/80 px-3 py-2 text-left hover:bg-muted/50"
                        onClick={() => {
                          setProcDrawer({ mode: 'view', row: r })
                          setMainTab('timeline')
                        }}
                      >
                        <span className="font-medium">{formatAdminDate(r.sessionDate)}</span>
                        <p className="line-clamp-2 text-muted-foreground">{r.sessionNarrative}</p>
                      </button>
                    </li>
                  ))}
                {proc.every((r) => !r.concernsFlagged) ? (
                  <li className="text-muted-foreground">No sessions with concerns flagged.</li>
                ) : null}
              </ul>
            </div>
            <div className={`${card} space-y-3`}>
              <h3 className="text-base font-semibold text-foreground">Visits — safety & follow-up</h3>
              <ul className="space-y-2 text-sm">
                {vis
                  .filter((v) => v.safetyConcernsNoted || v.followUpNeeded)
                  .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
                  .map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        className="w-full rounded-lg border border-border/80 px-3 py-2 text-left hover:bg-muted/50"
                        onClick={() => {
                          setVisitDrawer({ mode: 'view', row: v })
                          setMainTab('timeline')
                        }}
                      >
                        <span className="font-medium">{formatAdminDate(v.visitDate)}</span>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {v.safetyConcernsNoted ? <BooleanBadge value={true} trueLabel="Safety" trueVariant="danger" /> : null}
                          {v.followUpNeeded ? <BooleanBadge value={true} trueLabel="Follow-up" trueVariant="warning" /> : null}
                        </div>
                      </button>
                    </li>
                  ))}
                {vis.every((v) => !v.safetyConcernsNoted && !v.followUpNeeded) ? (
                  <li className="text-muted-foreground">No visit safety or follow-up flags.</li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
      )}

      {mainTab === 'info' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Resident information</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Administrative and case file fields. Use Edit for structured updates to core case data.
              </p>
            </div>
            <button type="button" className={btnPrimary} onClick={() => setProfileOpen(true)}>
              Edit resident info
            </button>
          </div>
          <div className="grid gap-8">
            <InfoSection title="Identity & case basics" fields={fields} keys={['internal_code', 'internalCode', 'case_control_no', 'caseControlNo', 'case_status', 'caseStatus', 'case_category', 'caseCategory', 'sex']} readField={gf} />
            <InfoSection
              title="Admission & placement"
              fields={fields}
              keys={['date_of_admission', 'dateOfAdmission', 'length_of_stay', 'lengthOfStay', 'safehouse_id', 'safehouseId']}
              readField={gf}
              extra={[
                ['Safehouse (resolved)', safehouseName],
              ]}
            />
            <InfoSection
              title="Classification & risk"
              fields={fields}
              keys={['current_risk_level', 'currentRiskLevel', 'reintegration_status', 'reintegrationStatus', 'reintegration_type', 'reintegrationType', 'present_age', 'presentAge']}
              readField={gf}
            />
            <InfoSection title="Worker assignment" fields={fields} keys={['assigned_social_worker', 'assignedSocialWorker']} readField={gf} />
            <div className={`${card} space-y-2`}>
              <h4 className="text-sm font-semibold text-foreground">All raw fields</h4>
              <p className="text-xs text-muted-foreground">Additional columns from the resident record (for migration / custom data).</p>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                {Object.keys(fields)
                  .sort()
                  .map((k) => (
                    <div key={k} className="border-b border-border/40 pb-1">
                      <dt className="text-xs uppercase text-muted-foreground">{k}</dt>
                      <dd className="text-foreground">{fields[k] || '—'}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </div>
        </div>
      )}

      {mainTab === 'insights' && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">Derived signals from this resident&apos;s records to support supervision and case review.</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`${card} space-y-2`}>
              <h3 className="text-sm font-semibold">Concerns in last windows</h3>
              <p className="text-2xl font-bold text-foreground">
                {proc.filter((r) => r.concernsFlagged && new Date(r.sessionDate).getTime() > Date.now() - 30 * 86400000).length}
                <span className="ml-2 text-sm font-normal text-muted-foreground">/ 30d</span>
              </p>
              <p className="text-sm text-muted-foreground">
                60d: {proc.filter((r) => r.concernsFlagged && new Date(r.sessionDate).getTime() > Date.now() - 60 * 86400000).length} · 90d:{' '}
                {proc.filter((r) => r.concernsFlagged && new Date(r.sessionDate).getTime() > Date.now() - 90 * 86400000).length}
              </p>
            </div>
            <div className={`${card} space-y-2`}>
              <h3 className="text-sm font-semibold">Plans overdue or stalled</h3>
              <p className="text-2xl font-bold text-foreground">{plans.filter(planIsOverdue).length}</p>
              <p className="text-sm text-muted-foreground">Open plans: {stats.activePlans}</p>
            </div>
            <div className={`${card} space-y-2`}>
              <h3 className="text-sm font-semibold">Repeated emotional states (sessions)</h3>
              <ul className="text-sm">
                {emotionalCounts.length === 0 ? <li className="text-muted-foreground">No emotional state labels captured.</li> : null}
                {emotionalCounts.map(([state, n]) => (
                  <li key={state} className="flex justify-between border-b border-border/50 py-1">
                    <span>{state}</span>
                    <span className="tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`${card} space-y-2`}>
              <h3 className="text-sm font-semibold">Visit follow-ups outstanding</h3>
              <p className="text-2xl font-bold text-foreground">{vis.filter((v) => v.followUpNeeded).length}</p>
              <p className="text-sm text-muted-foreground">Visits with safety concerns noted: {vis.filter((v) => v.safetyConcernsNoted).length}</p>
            </div>
          </div>
        </div>
      )}

      {profileOpen && (
        <ProfileEditDrawer
          residentId={residentId}
          fields={fields}
          safehouses={safehouses}
          onClose={() => setProfileOpen(false)}
          onSaved={async () => {
            setProfileOpen(false)
            await load()
          }}
          saving={profileSaving}
          setSaving={setProfileSaving}
          onError={setError}
        />
      )}

      {incidentInfoOpen && (
        <CaseDrawer title="Log incident" onClose={() => setIncidentInfoOpen(false)}>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setIncidentFormSaving(true)
              setIncidentFormError(null)
              try {
                await createIncidentReport(residentId, {
                  safehouse_id: safehouseId > 0 ? String(safehouseId) : '',
                  incident_date: incidentDate,
                  incident_type: incidentType,
                  severity: incidentSeverity,
                  description: incidentDescription,
                  response_taken: incidentResponse,
                  reported_by: incidentReportedBy,
                  resolved: incidentResolved ? 'true' : 'false',
                  follow_up_required: incidentFollowUp ? 'true' : 'false',
                })
                setIncidentInfoOpen(false)
                setIncidentDate(new Date().toISOString().slice(0, 10))
                setIncidentType('Medical')
                setIncidentSeverity('Medium')
                setIncidentDescription('')
                setIncidentResponse('')
                setIncidentReportedBy('')
                setIncidentResolved(false)
                setIncidentFollowUp(false)
                await load()
              } catch (err) {
                setIncidentFormError(err instanceof Error ? err.message : 'Failed to save')
              } finally {
                setIncidentFormSaving(false)
              }
            }}
          >
            {incidentFormError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {incidentFormError}
              </p>
            ) : null}
            <label className={label}>
              <span className="text-xs text-muted-foreground">Date *</span>
              <input type="date" className={input} value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} required />
            </label>
            <label className={label}>
              <span className="text-xs text-muted-foreground">Incident type *</span>
              <select className={input} value={incidentType} onChange={(e) => setIncidentType(e.target.value)}>
                {[
                  'Medical',
                  'Security',
                  'Behavioral',
                  'SelfHarm',
                  'RunawayAttempt',
                  'ConflictWithPeer',
                  'PropertyDamage',
                  'Other',
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              <span className="text-xs text-muted-foreground">Severity *</span>
              <select className={input} value={incidentSeverity} onChange={(e) => setIncidentSeverity(e.target.value)}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </label>
            <label className={label}>
              <span className="text-xs text-muted-foreground">Description</span>
              <textarea className={input} rows={3} value={incidentDescription} onChange={(e) => setIncidentDescription(e.target.value)} />
            </label>
            <label className={label}>
              <span className="text-xs text-muted-foreground">Response taken</span>
              <textarea className={input} rows={2} value={incidentResponse} onChange={(e) => setIncidentResponse(e.target.value)} />
            </label>
            <label className={label}>
              <span className="text-xs text-muted-foreground">Reported by</span>
              <input
                className={input}
                value={incidentReportedBy}
                onChange={(e) => setIncidentReportedBy(e.target.value)}
                placeholder="e.g. SW-01"
              />
            </label>
            <ToggleField labelText="Resolved" value={incidentResolved} onChange={setIncidentResolved} />
            <ToggleField labelText="Follow-up required" value={incidentFollowUp} onChange={setIncidentFollowUp} />
            <button type="submit" disabled={incidentFormSaving} className={btnPrimary}>
              {incidentFormSaving ? 'Saving…' : 'Save incident'}
            </button>
          </form>
        </CaseDrawer>
      )}

      {procDrawer && (
        <ProcessRecordingDrawer
          key={procDrawer.mode === 'create' ? 'new' : String(procDrawer.row?.id ?? 'x')}
          mode={procDrawer.mode}
          residentId={residentId}
          initial={procDrawer.row ?? null}
          error={drawerErr}
          onError={setDrawerErr}
          onClose={() => {
            setProcDrawer(null)
            setDrawerErr(null)
            void load()
          }}
          onEdit={() => setProcDrawer((d) => (d && d.row ? { mode: 'edit', row: d.row } : d))}
          onSaved={async () => {
            setProcDrawer(null)
            setDrawerErr(null)
            await load()
          }}
          onDeleteRequest={(id) => setDeleteProcessId(id)}
        />
      )}

      {visitDrawer && (
        <HomeVisitDrawer
          key={visitDrawer.mode === 'create' ? 'newv' : String(visitDrawer.row?.id ?? 'y')}
          mode={visitDrawer.mode}
          residentId={residentId}
          initial={visitDrawer.row ?? null}
          error={drawerErr}
          onError={setDrawerErr}
          onClose={() => {
            setVisitDrawer(null)
            setDrawerErr(null)
            void load()
          }}
          onEdit={() => setVisitDrawer((d) => (d && d.row ? { mode: 'edit', row: d.row } : d))}
          onSaved={async () => {
            setVisitDrawer(null)
            setDrawerErr(null)
            await load()
          }}
          onDeleteRequest={(id) => setDeleteVisitId(id)}
        />
      )}

      {deleteProcessId != null && (
        <ConfirmDeleteModal
          title="Delete process recording?"
          loading={drawerSaving}
          onCancel={() => setDeleteProcessId(null)}
          onConfirm={async () => {
            setDrawerSaving(true)
            try {
              await deleteProcessRecording(deleteProcessId)
              setDeleteProcessId(null)
              setProcDrawer(null)
              await load()
            } catch (e) {
              setDrawerErr(e instanceof Error ? e.message : 'Delete failed')
            } finally {
              setDrawerSaving(false)
            }
          }}
        />
      )}

      {deleteVisitId != null && (
        <ConfirmDeleteModal
          title="Delete home visit?"
          loading={drawerSaving}
          onCancel={() => setDeleteVisitId(null)}
          onConfirm={async () => {
            setDrawerSaving(true)
            try {
              await deleteHomeVisitation(deleteVisitId)
              setDeleteVisitId(null)
              setVisitDrawer(null)
              await load()
            } catch (e) {
              setDrawerErr(e instanceof Error ? e.message : 'Delete failed')
            } finally {
              setDrawerSaving(false)
            }
          }}
        />
      )}
    </div>
  )
}

function InfoSection({
  title,
  fields,
  keys,
  readField,
  extra,
}: {
  title: string
  fields: Record<string, string>
  keys: string[]
  readField: typeof gf
  extra?: [string, string][]
}) {
  const seen = new Set<string>()
  const rows: [string, string][] = []
  for (let i = 0; i < keys.length; i += 2) {
    const labelKey = keys[i]
    const valKey = keys[i + 1] ?? keys[i]
    const v = readField(fields, labelKey, valKey)
    const label = labelKey.replace(/_/g, ' ')
    if (seen.has(label)) continue
    seen.add(label)
    rows.push([label, v])
  }
  if (extra) rows.push(...extra)
  return (
    <div className={`${card} space-y-3`}>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
            <dd className="text-sm text-foreground">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function ConfirmDeleteModal({
  title,
  loading,
  onCancel,
  onConfirm,
}: {
  title: string
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-4">
      <div className={`${card} max-w-sm space-y-4`}>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">This cannot be undone.</p>
        <div className="flex gap-2">
          <button type="button" className={btnPrimary} disabled={loading} onClick={() => void onConfirm()}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileEditDrawer({
  residentId,
  fields,
  safehouses,
  onClose,
  onSaved,
  saving,
  setSaving,
  onError,
}: {
  residentId: number
  fields: Record<string, string>
  safehouses: SafehouseOption[]
  onClose: () => void
  onSaved: () => Promise<void>
  saving: boolean
  setSaving: (v: boolean) => void
  onError: (e: string | null) => void
}) {
  const [caseStatus, setCaseStatus] = useState(gf(fields, 'case_status', 'caseStatus'))
  const [risk, setRisk] = useState(gf(fields, 'current_risk_level', 'currentRiskLevel'))
  const [sex, setSex] = useState(gf(fields, 'sex'))
  const [category, setCategory] = useState(gf(fields, 'case_category', 'caseCategory'))
  const [reintStat, setReintStat] = useState(gf(fields, 'reintegration_status', 'reintegrationStatus'))
  const [reintType, setReintType] = useState(gf(fields, 'reintegration_type', 'reintegrationType'))
  const [admission, setAdmission] = useState(gf(fields, 'date_of_admission', 'dateOfAdmission').slice(0, 10))
  const [worker, setWorker] = useState(gf(fields, 'assigned_social_worker', 'assignedSocialWorker'))
  const [safeId, setSafeId] = useState(gf(fields, 'safehouse_id', 'safehouseId'))
  const [presentAge, setPresentAge] = useState(gf(fields, 'present_age', 'presentAge'))
  const [los, setLos] = useState(gf(fields, 'length_of_stay', 'lengthOfStay'))

  async function submit(e: FormEvent) {
    e.preventDefault()
    onError(null)
    setSaving(true)
    try {
      await patchResident(residentId, {
        case_status: caseStatus,
        current_risk_level: risk || null,
        sex: sex || null,
        case_category: category || null,
        reintegration_status: reintStat || null,
        reintegration_type: reintType || null,
        date_of_admission: admission || null,
        assigned_social_worker: worker || null,
        safehouse_id: safeId || null,
        present_age: presentAge || null,
        length_of_stay: los || null,
      })
      await onSaved()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CaseDrawer title="Edit resident profile" onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <label className={label}>
          Case status
          <select className={input} value={caseStatus} onChange={(e) => setCaseStatus(e.target.value)}>
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Current risk level
          <select className={input} value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option value="">—</option>
            {RISK_LEVELS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Sex
          <select className={input} value={sex} onChange={(e) => setSex(e.target.value)}>
            {SEX_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Case category
          <input className={input} value={category} onChange={(e) => setCategory(e.target.value)} />
        </label>
        <label className={label}>
          Reintegration status
          <input className={input} value={reintStat} onChange={(e) => setReintStat(e.target.value)} />
        </label>
        <label className={label}>
          Reintegration type
          <input className={input} value={reintType} onChange={(e) => setReintType(e.target.value)} />
        </label>
        <label className={label}>
          Date of admission
          <input type="date" className={input} value={admission} onChange={(e) => setAdmission(e.target.value)} />
        </label>
        <label className={label}>
          Assigned social worker
          <input className={input} value={worker} onChange={(e) => setWorker(e.target.value)} />
        </label>
        <label className={label}>
          Safehouse
          <select className={input} value={safeId} onChange={(e) => setSafeId(e.target.value)}>
            <option value="">—</option>
            {safehouses.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Present age
          <input className={input} value={presentAge} onChange={(e) => setPresentAge(e.target.value)} />
        </label>
        <label className={label}>
          Length of stay
          <input className={input} value={los} onChange={(e) => setLos(e.target.value)} />
        </label>
        <div className="flex gap-2 border-t border-border pt-4">
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </CaseDrawer>
  )
}
