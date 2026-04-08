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
import { formatAdminDate } from '../adminDataTable/adminFormatters'
import { CASE_STATUSES, RISK_LEVELS, SEX_OPTIONS } from './caseConstants'
import { CaseDrawer, EmptyState, QuickActionButton, SectionHeader, StatTile, ToggleField } from './caseUi'
import { CareProgressContent } from './CareProgressContent'
import { PlansTabContent } from './PlansTabContent'

type MainTab = 'overview' | 'care' | 'safety' | 'plans'
type CareSub = 'counseling' | 'visits' | 'education' | 'health'

function gf(fields: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (fields[k] != null && fields[k] !== '') return fields[k]
    const snake = k.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
    if (fields[snake] != null && fields[snake] !== '') return fields[snake]
  }
  return ''
}

function planOverdue(p: InterventionPlan): boolean {
  if (!p.targetDate) return false
  const st = p.status.toLowerCase()
  if (st.includes('achieved') || st.includes('closed') || st.includes('completed')) return false
  return new Date(p.targetDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)
}

export function ResidentCaseWorkspace({ residentId }: { residentId: number }) {
  const [mainTab, setMainTab] = useState<MainTab>('overview')
  const [careSub, setCareSub] = useState<CareSub>('counseling')
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
  const [sig, setSig] = useState({ counseling: 0, visit: 0, education: 0, health: 0, plan: 0 })

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
    const visits60 = vis.filter((v) => new Date(v.visitDate).getTime() >= now - 60 * 86400000).length
    const activePlans = plans.filter((p) => !p.status.toLowerCase().includes('closed') && !p.status.toLowerCase().includes('achieved')).length
    const overduePlans = plans.filter(planOverdue).length
    const latestEdu = [...edu].sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())[0]
    return {
      incidents: inc.length,
      sessions30,
      visits30,
      visits60,
      activePlans,
      overduePlans,
      latestProgress: latestEdu?.progressPercent ?? null,
    }
  }, [proc, vis, plans, edu, inc])

  const alerts = useMemo(() => {
    const list: { level: 'warn' | 'risk'; text: string }[] = []
    const risk = gf(fields, 'current_risk_level', 'currentRiskLevel').toLowerCase()
    if (risk.includes('high') || risk.includes('critical')) {
      list.push({ level: 'risk', text: `Elevated risk: ${gf(fields, 'current_risk_level', 'currentRiskLevel')}` })
    }
    const overdue = plans.filter(planOverdue)
    if (overdue.length) list.push({ level: 'warn', text: `${overdue.length} intervention plan(s) past target date` })
    vis.filter((v) => v.followUpNeeded).forEach((v) => {
      list.push({ level: 'warn', text: `Follow-up needed · home visit ${formatAdminDate(v.visitDate)}` })
    })
    if (!gf(fields, 'assigned_social_worker', 'assignedSocialWorker').trim()) {
      list.push({ level: 'warn', text: 'No assigned social worker on file' })
    }
    if (!gf(fields, 'date_of_admission', 'dateOfAdmission').trim()) {
      list.push({ level: 'warn', text: 'Admission date missing' })
    }
    return list
  }, [fields, plans, vis])

  const activity = useMemo(() => {
    type Row = { sort: number; line: string; tab: MainTab; care?: CareSub }
    const rows: Row[] = []
    for (const r of proc) {
      rows.push({
        sort: new Date(r.sessionDate).getTime(),
        line: `Process recording · ${r.sessionType} · ${formatAdminDate(r.sessionDate)}`,
        tab: 'care',
        care: 'counseling',
      })
    }
    for (const v of vis) {
      rows.push({
        sort: new Date(v.visitDate).getTime(),
        line: `Home visit · ${v.visitType} · ${formatAdminDate(v.visitDate)}`,
        tab: 'care',
        care: 'visits',
      })
    }
    for (const p of plans) {
      const d = p.updatedAt || p.createdAt
      rows.push({
        sort: new Date(d).getTime(),
        line: `Intervention plan · ${p.planCategory} · ${p.status}`,
        tab: 'plans',
      })
    }
    for (const e of edu) {
      rows.push({
        sort: new Date(e.recordDate).getTime(),
        line: `Education · ${e.progressPercent != null ? `${e.progressPercent}%` : 'record'} · ${formatAdminDate(e.recordDate)}`,
        tab: 'care',
        care: 'education',
      })
    }
    for (const h of hl) {
      rows.push({
        sort: new Date(h.recordDate).getTime(),
        line: `Health · score ${h.healthScore ?? '—'} · ${formatAdminDate(h.recordDate)}`,
        tab: 'care',
        care: 'health',
      })
    }
    return rows.sort((a, b) => b.sort - a.sort).slice(0, 18)
  }, [proc, vis, plans, edu, hl])

  const attention = useMemo(() => {
    const lines: string[] = []
    plans
      .filter((p) => p.targetDate && !planOverdue(p))
      .sort((a, b) => new Date(a.targetDate!).getTime() - new Date(b.targetDate!).getTime())
      .slice(0, 3)
      .forEach((p) => lines.push(`Upcoming target · ${p.planCategory} · ${formatAdminDate(p.targetDate)}`))
    plans.filter(planOverdue).forEach((p) => lines.push(`Overdue plan · ${p.planCategory} · ${formatAdminDate(p.targetDate)}`))
    vis.filter((v) => v.followUpNeeded).forEach((v) => lines.push(`Visit follow-up · ${formatAdminDate(v.visitDate)}`))
    const lowEdu = edu.filter((e) => e.progressPercent != null && e.progressPercent < 40).slice(0, 2)
    lowEdu.forEach((e) => lines.push(`Low education progress (${e.progressPercent}%) · ${formatAdminDate(e.recordDate)}`))
    return lines.slice(0, 8)
  }, [plans, vis, edu])

  function bumpCreate(tab: MainTab, care: CareSub | null, kind: 'counseling' | 'visit' | 'education' | 'health' | 'plan') {
    setMainTab(tab)
    if (care) setCareSub(care)
    setSig((s) => {
      switch (kind) {
        case 'counseling':
          return { ...s, counseling: s.counseling + 1 }
        case 'visit':
          return { ...s, visit: s.visit + 1 }
        case 'education':
          return { ...s, education: s.education + 1 }
        case 'health':
          return { ...s, health: s.health + 1 }
        case 'plan':
          return { ...s, plan: s.plan + 1 }
      }
    })
  }

  if (!Number.isFinite(residentId) || residentId <= 0) {
    return <p className="text-destructive">Invalid resident.</p>
  }

  if (loading) return <p className="text-muted-foreground">Loading case…</p>
  if (!detail) return <p className="text-destructive">Resident not found.</p>

  const mainTabs: { k: MainTab; label: string }[] = [
    { k: 'overview', label: 'Overview' },
    { k: 'care', label: 'Care & progress' },
    { k: 'safety', label: 'Safety' },
    { k: 'plans', label: 'Plans' },
  ]

  const careTabs: { k: CareSub; label: string }[] = [
    { k: 'counseling', label: 'Process recordings' },
    { k: 'visits', label: 'Home visitations' },
    { k: 'education', label: 'Education' },
    { k: 'health', label: 'Health & wellbeing' },
  ]

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
              {gf(fields, 'reintegration_status', 'reintegrationStatus') ? (
                <ReintegrationBadge value={gf(fields, 'reintegration_status', 'reintegrationStatus')} />
              ) : null}
            </div>
            <p className={`${pageDesc} mt-3 max-w-2xl`}>
              {safehouseName} · {gf(fields, 'assigned_social_worker', 'assignedSocialWorker') || 'No worker assigned'}
              {gf(fields, 'date_of_admission', 'dateOfAdmission') ? ` · Admitted ${formatAdminDate(gf(fields, 'date_of_admission', 'dateOfAdmission'))}` : ''}
              {gf(fields, 'length_of_stay', 'lengthOfStay') ? ` · LOS ${gf(fields, 'length_of_stay', 'lengthOfStay')}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <QuickActionButton onClick={() => setIncidentInfoOpen(true)}>Add incident</QuickActionButton>
            <QuickActionButton onClick={() => bumpCreate('care', 'counseling', 'counseling')}>Add recording</QuickActionButton>
            <QuickActionButton onClick={() => bumpCreate('care', 'visits', 'visit')}>Add visit</QuickActionButton>
            <QuickActionButton onClick={() => bumpCreate('plans', null, 'plan')}>Add plan</QuickActionButton>
            <QuickActionButton onClick={() => bumpCreate('care', 'education', 'education')}>Add education</QuickActionButton>
          </div>
        </div>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {mainTabs.map((t) => (
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
        <OverviewPanel
          fields={fields}
          safehouseName={safehouseName}
          alerts={alerts}
          activity={activity}
          attention={attention}
          stats={stats}
          onEditProfile={() => setProfileOpen(true)}
          onActivityNavigate={(tab, care) => {
            setMainTab(tab)
            if (care) setCareSub(care)
          }}
        />
      )}

      {mainTab === 'care' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 border-b border-border/80 pb-2">
            {careTabs.map((t) => (
              <button
                key={t.k}
                type="button"
                onClick={() => setCareSub(t.k)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  careSub === t.k ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <CareProgressContent
            residentId={residentId}
            sub={careSub}
            recordings={proc}
            visitations={vis}
            education={edu}
            health={hl}
            onReload={load}
            createSignals={sig}
          />
        </div>
      )}

      {mainTab === 'safety' && (
        <div className="space-y-4">
          <SectionHeader
            title="Incident reports"
            description="Logged incidents, responses, and follow-up actions for this resident."
            actions={<QuickActionButton onClick={() => { setIncidentInfoOpen(true); setIncidentFormError(null) }}>Add incident</QuickActionButton>}
          />
          {inc.length === 0 ? (
            <EmptyState
              title="No incident reports"
              hint="Log safety incidents, conflicts, medical events, and responses here."
              action={<QuickActionButton onClick={() => { setIncidentInfoOpen(true); setIncidentFormError(null) }}>Add first incident</QuickActionButton>}
            />
          ) : (
            <div className="space-y-2">
              {inc.map((row) => {
                const f = row.fields
                const severity = f.severity ?? ''
                const severityColor =
                  severity === 'High' ? 'text-red-600 bg-red-50 border-red-200' :
                  severity === 'Medium' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                  'text-green-700 bg-green-50 border-green-200'
                const resolved = f.resolved === 'True' || f.resolved === 'true'
                return (
                  <div key={row.id} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{f.incident_type}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${severityColor}`}>{severity}</span>
                      {resolved ? (
                        <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Resolved</span>
                      ) : (
                        <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">Open</span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">{f.incident_date}</span>
                    </div>
                    {f.description && <p className="mt-1.5 text-muted-foreground">{f.description}</p>}
                    {f.response_taken && <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium">Response:</span> {f.response_taken}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {f.reported_by && <span>Reported by: {f.reported_by}</span>}
                      {f.resolution_date && <span>Resolved: {f.resolution_date}</span>}
                      {(f.follow_up_required === 'True' || f.follow_up_required === 'true') && (
                        <span className="font-medium text-amber-600">Follow-up required</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {mainTab === 'plans' && (
        <PlansTabContent residentId={residentId} plans={plans} onReload={load} openCreateSignal={sig.plan} />
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
                  incident_date: incidentDate,
                  incident_type: incidentType,
                  severity: incidentSeverity,
                  description: incidentDescription,
                  response_taken: incidentResponse,
                  reported_by: incidentReportedBy,
                  resolved: String(incidentResolved),
                  follow_up_required: String(incidentFollowUp),
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
            {incidentFormError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {incidentFormError}
              </p>
            )}
            <label className={label}>
              <span className="text-xs text-muted-foreground">Date *</span>
              <input type="date" className={input} value={incidentDate} onChange={e => setIncidentDate(e.target.value)} required />
            </label>
            <label className={label}>
              <span className="text-xs text-muted-foreground">Incident type *</span>
              <select className={input} value={incidentType} onChange={e => setIncidentType(e.target.value)}>
                {['Medical','Security','Behavioral','SelfHarm','RunawayAttempt','ConflictWithPeer','PropertyDamage','Other'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              <span className="text-xs text-muted-foreground">Severity *</span>
              <select className={input} value={incidentSeverity} onChange={e => setIncidentSeverity(e.target.value)}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </label>
            <label className={label}>
              <span className="text-xs text-muted-foreground">Description</span>
              <textarea className={input} rows={3} value={incidentDescription} onChange={e => setIncidentDescription(e.target.value)} />
            </label>
            <label className={label}>
              <span className="text-xs text-muted-foreground">Response taken</span>
              <textarea className={input} rows={2} value={incidentResponse} onChange={e => setIncidentResponse(e.target.value)} />
            </label>
            <label className={label}>
              <span className="text-xs text-muted-foreground">Reported by</span>
              <input className={input} value={incidentReportedBy} onChange={e => setIncidentReportedBy(e.target.value)} placeholder="e.g. SW-01" />
            </label>
            <ToggleField labelText="Resolved" value={incidentResolved} onChange={setIncidentResolved} />
            <ToggleField labelText="Follow-up required" value={incidentFollowUp} onChange={setIncidentFollowUp} />
            <button type="submit" disabled={incidentFormSaving} className={btnPrimary}>
              {incidentFormSaving ? 'Saving…' : 'Save incident'}
            </button>
          </form>
        </CaseDrawer>
      )}
    </div>
  )
}

function OverviewPanel({
  fields,
  safehouseName,
  alerts,
  activity,
  attention,
  stats,
  onEditProfile,
  onActivityNavigate,
}: {
  fields: Record<string, string>
  safehouseName: string
  alerts: { level: 'warn' | 'risk'; text: string }[]
  activity: { sort: number; line: string; tab: MainTab; care?: CareSub }[]
  attention: string[]
  stats: {
    incidents: number
    sessions30: number
    visits30: number
    visits60: number
    activePlans: number
    overduePlans: number
    latestProgress: number | null
  }
  onEditProfile: () => void
  onActivityNavigate: (tab: MainTab, care?: CareSub) => void
}) {
  return (
    <div className="space-y-8">
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`rounded-lg border px-4 py-3 text-sm ${
                a.level === 'risk'
                  ? 'border-rose-400/60 bg-rose-500/10 text-black dark:text-black'
                  : 'border-amber-400/50 bg-amber-500/10 text-black dark:text-black'
              }`}
            >
              {a.text}
            </div>
          ))}
        </div>
      )}

      <div className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Resident summary</h3>
            <p className="mt-1 text-sm text-muted-foreground">Core case file fields for quick scanning.</p>
          </div>
          <button type="button" className={btnPrimary} onClick={onEditProfile}>
            Edit profile
          </button>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Internal code', gf(fields, 'internal_code', 'internalCode')],
            ['Case status', gf(fields, 'case_status', 'caseStatus')],
            ['Risk level', gf(fields, 'current_risk_level', 'currentRiskLevel')],
            ['Safehouse', safehouseName],
            ['Social worker', gf(fields, 'assigned_social_worker', 'assignedSocialWorker') || '—'],
            ['Admission', formatAdminDate(gf(fields, 'date_of_admission', 'dateOfAdmission'))],
            ['Length of stay', gf(fields, 'length_of_stay', 'lengthOfStay') || '—'],
            ['Reintegration', gf(fields, 'reintegration_status', 'reintegrationStatus') || '—'],
            ['Category', gf(fields, 'case_category', 'caseCategory') || '—'],
            ['Sex', gf(fields, 'sex') || '—'],
            ['Present age', gf(fields, 'present_age', 'presentAge') || '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm text-foreground">{v || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-foreground">Quick stats</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Incidents (list)" value={stats.incidents} />
          <StatTile label="Process recordings (30d)" value={stats.sessions30} />
          <StatTile label="Visits (30d / 60d)" value={`${stats.visits30} / ${stats.visits60}`} />
          <StatTile label="Active plans" value={stats.activePlans} />
          <StatTile label="Overdue plans" value={stats.overduePlans} />
          <StatTile label="Latest edu %" value={stats.latestProgress != null ? `${stats.latestProgress}%` : '—'} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${card} space-y-3`}>
          <h3 className="text-base font-semibold text-foreground">Recent activity</h3>
          <ul className="space-y-2 text-sm">
            {activity.length === 0 ? (
              <li className="text-muted-foreground">No recent items.</li>
            ) : (
              activity.map((a, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-transparent px-2 py-1.5 text-left hover:border-border hover:bg-muted/40"
                    onClick={() => onActivityNavigate(a.tab, a.care)}
                  >
                    {a.line}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className={`${card} space-y-3`}>
          <h3 className="text-base font-semibold text-foreground">Upcoming / needs attention</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {attention.length === 0 ? <li>Nothing flagged right now.</li> : attention.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
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
