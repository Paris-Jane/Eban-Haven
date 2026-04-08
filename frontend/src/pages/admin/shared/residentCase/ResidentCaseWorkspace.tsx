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
import { CaseDrawer, EmptyState, QuickActionButton, SectionHeader, StatTile } from './caseUi'
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
      setInc(i)
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
        line: `Counseling · ${r.sessionType} · ${formatAdminDate(r.sessionDate)}`,
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
    { k: 'counseling', label: 'Counseling sessions' },
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
            <QuickActionButton onClick={() => bumpCreate('care', 'counseling', 'counseling')}>Add session</QuickActionButton>
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
            description="Serious events and responses. The API is not yet connected for this resident view."
          />
          {inc.length === 0 ? (
            <EmptyState
              title="No incident reports"
              hint="Incident capture will appear here when the backend endpoint is enabled."
              action={<QuickActionButton onClick={() => setIncidentInfoOpen(true)}>Learn more</QuickActionButton>}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Legacy rows: {inc.length}</p>
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
        <CaseDrawer title="Incident reports" onClose={() => setIncidentInfoOpen(false)}>
          <p className="text-sm text-muted-foreground">
            Incident reporting is not yet wired to the admin API for this app. Use your case notes or external reporting workflow until
            the endpoint is available.
          </p>
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
          <StatTile label="Sessions (30d)" value={stats.sessions30} />
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
