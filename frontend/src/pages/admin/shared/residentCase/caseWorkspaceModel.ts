import type { EducationRecord, HealthRecord, HomeVisitation, InterventionPlan, JsonTableRow, ProcessRecording } from '../../../../api/admin'
import { formatAdminDate } from '../adminDataTable/adminFormatters'

export type MainWorkspaceTab = 'overview' | 'activity' | 'plans' | 'profile'

export type TimelineKind = 'process' | 'visit' | 'education' | 'health' | 'plan' | 'incident'

export type TimelineItem = {
  key: string
  kind: TimelineKind
  sort: number
  dateIso: string
  title: string
  summary: string
  worker?: string
  flags: { label: string; tone: 'default' | 'danger' | 'warning' | 'success' }[]
  /** Original row for drawer open */
  ref:
    | { kind: 'process'; row: ProcessRecording }
    | { kind: 'visit'; row: HomeVisitation }
    | { kind: 'education'; row: EducationRecord }
    | { kind: 'health'; row: HealthRecord }
    | { kind: 'plan'; row: InterventionPlan }
    | { kind: 'incident'; row: JsonTableRow }
}

export function planIsOverdue(p: InterventionPlan): boolean {
  if (!p.targetDate) return false
  const st = p.status.toLowerCase()
  if (st.includes('achieved') || st.includes('closed') || st.includes('completed')) return false
  return new Date(p.targetDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)
}

export function buildTimelineItems(
  proc: ProcessRecording[],
  vis: HomeVisitation[],
  edu: EducationRecord[],
  hl: HealthRecord[],
  plans: InterventionPlan[],
  incidents: JsonTableRow[],
): TimelineItem[] {
  const items: TimelineItem[] = []
  for (const r of proc) {
    const t = new Date(r.sessionDate).getTime()
    const flags: TimelineItem['flags'] = []
    if (r.concernsFlagged) flags.push({ label: 'Concerns', tone: 'danger' })
    if (r.progressNoted) flags.push({ label: 'Progress', tone: 'success' })
    if (r.followUpActions?.trim()) flags.push({ label: 'Follow-up', tone: 'warning' })
    items.push({
      key: `p-${r.id}`,
      kind: 'process',
      sort: t,
      dateIso: r.sessionDate,
      title: 'Counseling session',
      summary: `${r.sessionType} · ${r.sessionNarrative.slice(0, 120)}${r.sessionNarrative.length > 120 ? '…' : ''}`,
      worker: r.socialWorker,
      flags,
      ref: { kind: 'process', row: r },
    })
  }
  for (const v of vis) {
    const t = new Date(v.visitDate).getTime()
    const flags: TimelineItem['flags'] = []
    if (v.safetyConcernsNoted) flags.push({ label: 'Safety', tone: 'danger' })
    if (v.followUpNeeded) flags.push({ label: 'Follow-up needed', tone: 'warning' })
    if (v.visitOutcome) flags.push({ label: v.visitOutcome, tone: 'default' })
    items.push({
      key: `v-${v.id}`,
      kind: 'visit',
      sort: t,
      dateIso: v.visitDate,
      title: 'Home visit',
      summary: `${v.visitType}${v.locationVisited ? ` · ${v.locationVisited}` : ''}`,
      worker: v.socialWorker,
      flags,
      ref: { kind: 'visit', row: v },
    })
  }
  for (const e of edu) {
    const t = new Date(e.recordDate).getTime()
    items.push({
      key: `e-${e.id}`,
      kind: 'education',
      sort: t,
      dateIso: e.recordDate,
      title: 'Education',
      summary: e.progressPercent != null ? `Progress ${e.progressPercent}%` : 'Record on file',
      flags: [],
      ref: { kind: 'education', row: e },
    })
  }
  for (const h of hl) {
    const t = new Date(h.recordDate).getTime()
    items.push({
      key: `h-${h.id}`,
      kind: 'health',
      sort: t,
      dateIso: h.recordDate,
      title: 'Health & wellbeing',
      summary: h.healthScore != null ? `Wellbeing score ${h.healthScore}` : 'Record on file',
      flags: [],
      ref: { kind: 'health', row: h },
    })
  }
  for (const p of plans) {
    const d = p.updatedAt || p.createdAt
    const t = new Date(d).getTime()
    const flags: TimelineItem['flags'] = [{ label: p.status, tone: 'default' }]
    if (planIsOverdue(p)) flags.push({ label: 'Overdue', tone: 'warning' })
    items.push({
      key: `pl-${p.id}`,
      kind: 'plan',
      sort: t,
      dateIso: d,
      title: 'Intervention plan',
      summary: `${p.planCategory} · ${p.planDescription.slice(0, 100)}${p.planDescription.length > 100 ? '…' : ''}`,
      flags,
      ref: { kind: 'plan', row: p },
    })
  }
  for (const incident of incidents) {
    const f = incident.fields
    const t = new Date(f.incident_date ?? '').getTime()
    const flags: TimelineItem['flags'] = []
    if ((f.follow_up_required ?? '').toLowerCase() === 'true') flags.push({ label: 'Follow-up', tone: 'warning' })
    if ((f.resolved ?? '').toLowerCase() !== 'true') flags.push({ label: 'Open', tone: 'danger' })
    if (f.severity) {
      flags.push({
        label: f.severity,
        tone: f.severity.toLowerCase() === 'high' ? 'danger' : f.severity.toLowerCase() === 'medium' ? 'warning' : 'default',
      })
    }
    items.push({
      key: `i-${incident.id}`,
      kind: 'incident',
      sort: Number.isFinite(t) ? t : 0,
      dateIso: f.incident_date ?? '',
      title: 'Incident',
      summary: `${f.incident_type || 'Incident'}${f.description ? ` · ${f.description.slice(0, 100)}${f.description.length > 100 ? '…' : ''}` : ''}`,
      worker: f.reported_by ?? undefined,
      flags,
      ref: { kind: 'incident', row: incident },
    })
  }
  return items.sort((a, b) => b.sort - a.sort)
}

export function filterTimeline(
  items: TimelineItem[],
  opts: {
    kinds: Set<TimelineKind>
    dateFrom: string
    dateTo: string
    workerQ: string
    concernsOnly: boolean
    followUpOnly: boolean
    progressOnly: boolean
    search: string
  },
): TimelineItem[] {
  return items.filter((it) => {
    if (!opts.kinds.has(it.kind)) return false
    if (opts.dateFrom || opts.dateTo) {
      const d = it.dateIso.slice(0, 10)
      if (opts.dateFrom && d < opts.dateFrom) return false
      if (opts.dateTo && d > opts.dateTo) return false
    }
    if (opts.workerQ.trim()) {
      const w = (it.worker ?? '').toLowerCase()
      if (!w.includes(opts.workerQ.trim().toLowerCase())) return false
    }
    if (opts.concernsOnly && it.kind === 'process') {
      const r = it.ref as { kind: 'process'; row: ProcessRecording }
      if (!r.row.concernsFlagged) return false
    } else if (opts.concernsOnly) return false
    if (opts.followUpOnly) {
      if (it.kind === 'visit') {
        const r = it.ref as { kind: 'visit'; row: HomeVisitation }
        if (!r.row.followUpNeeded) return false
      } else if (it.kind === 'process') {
        const r = it.ref as { kind: 'process'; row: ProcessRecording }
        if (!r.row.followUpActions?.trim()) return false
      } else if (it.kind === 'incident') {
        const r = it.ref as { kind: 'incident'; row: JsonTableRow }
        if ((r.row.fields.follow_up_required ?? '').toLowerCase() !== 'true') return false
      } else return false
    }
    if (opts.progressOnly) {
      if (it.kind === 'process') {
        const r = it.ref as { kind: 'process'; row: ProcessRecording }
        if (!r.row.progressNoted) return false
      } else return false
    }
    if (opts.search.trim()) {
      const s = opts.search.trim().toLowerCase()
      if (!`${it.title} ${it.summary} ${it.worker ?? ''}`.toLowerCase().includes(s)) return false
    }
    return true
  })
}

/** Navigation / quick actions wired from the overview UI */
export type WorkspaceQuickAction =
  | { kind: 'tab'; tab: MainWorkspaceTab }
  | { kind: 'timeline'; followUpOnly?: boolean; concernsOnly?: boolean }
  | { kind: 'open_visit'; visitId: number }
  | { kind: 'open_plan'; planId: number }
  | { kind: 'add_activity'; activity: 'counseling' | 'visit' | 'education' | 'health' | 'plan' }

export type AlertItem = {
  id: string
  level: 'risk' | 'warn' | 'info'
  text: string
  action?: WorkspaceQuickAction
}

export function buildWorkspaceAlerts(params: {
  riskLevel: string
  plans: InterventionPlan[]
  vis: HomeVisitation[]
  proc: ProcessRecording[]
  edu: EducationRecord[]
  hl: HealthRecord[]
  assignedWorker: string
  admission: string
}): AlertItem[] {
  const list: AlertItem[] = []
  const risk = params.riskLevel.toLowerCase()
  if (risk.includes('high') || risk.includes('critical')) {
    list.push({
      id: 'risk-level',
      level: 'risk',
      text: `Elevated risk level: ${params.riskLevel}`,
      action: { kind: 'tab', tab: 'profile' },
    })
  }
  const overdue = params.plans.filter(planIsOverdue)
  if (overdue.length) {
    list.push({
      id: 'plans-overdue',
      level: 'warn',
      text: `${overdue.length} intervention plan(s) past target date`,
      action: { kind: 'tab', tab: 'plans' },
    })
  }

  const followUps = params.vis
    .filter((v) => v.followUpNeeded)
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
  if (followUps.length > 0) {
    const newest = followUps[0].visitDate
    const oldest = followUps[followUps.length - 1].visitDate
    const text =
      followUps.length === 1
        ? `Home visit follow-up · ${formatAdminDate(newest)}`
        : `${followUps.length} home visits need follow-up · newest ${formatAdminDate(newest)} · oldest ${formatAdminDate(oldest)}`
    list.push({
      id: 'visit-followups',
      level: 'warn',
      text,
      action: { kind: 'timeline', followUpOnly: true },
    })
  }

  const concernSessions = params.proc.filter((r) => r.concernsFlagged).length
  if (concernSessions >= 3) {
    list.push({
      id: 'sessions-concerns',
      level: 'warn',
      text: `${concernSessions} counseling sessions have concerns flagged — review patterns`,
      action: { kind: 'timeline', concernsOnly: true },
    })
  }
  const eduSorted = [...params.edu].sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())
  if (eduSorted.length >= 2) {
    const [a, b] = eduSorted
    const pa = a.progressPercent
    const pb = b.progressPercent
    if (pa != null && pb != null && pa < pb - 15) {
      list.push({
        id: 'edu-decline',
        level: 'warn',
        text: 'Education progress may be declining vs prior record',
        action: { kind: 'add_activity', activity: 'education' },
      })
    }
  }
  const hlSorted = [...params.hl].sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())
  if (hlSorted.length >= 2) {
    const [a, b] = hlSorted
    const sa = a.healthScore
    const sb = b.healthScore
    if (sa != null && sb != null && sa < sb - 0.75) {
      list.push({
        id: 'health-decline',
        level: 'warn',
        text: 'General wellbeing score trending down',
        action: { kind: 'add_activity', activity: 'health' },
      })
    }
  }
  if (!params.assignedWorker.trim()) {
    list.push({
      id: 'no-worker',
      level: 'warn',
      text: 'No assigned social worker on file',
      action: { kind: 'tab', tab: 'profile' },
    })
  }
  if (!params.admission.trim()) {
    list.push({
      id: 'no-admission',
      level: 'warn',
      text: 'Admission date missing',
      action: { kind: 'tab', tab: 'profile' },
    })
  }
  return list
}

export type NextStepItem = {
  id: string
  text: string
  action: WorkspaceQuickAction
}

const NEXT_STEPS_CAP = 8
const OVERDUE_PLAN_PREVIEW = 5

/** Profile-derived actions only (no generic reminders). Each item is clickable in the UI. */
export function buildProfileNextSteps(params: {
  plans: InterventionPlan[]
  vis: HomeVisitation[]
  proc: ProcessRecording[]
  edu: EducationRecord[]
  hl: HealthRecord[]
}): NextStepItem[] {
  const out: NextStepItem[] = []

  const followUps = params.vis
    .filter((v) => v.followUpNeeded)
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
  if (followUps.length > 0) {
    const latest = followUps[0]
    out.push({
      id: 'resolve-visit-followups',
      text:
        followUps.length === 1
          ? `Document follow-up for home visit (${formatAdminDate(latest.visitDate)})`
          : `Document follow-up for ${followUps.length} home visits (latest ${formatAdminDate(latest.visitDate)})`,
      action: { kind: 'open_visit', visitId: latest.id },
    })
  }

  const overduePlans = params.plans.filter(planIsOverdue)
  overduePlans.slice(0, OVERDUE_PLAN_PREVIEW).forEach((p) => {
    out.push({
      id: `overdue-plan-${p.id}`,
      text: `Update or close overdue plan: ${p.planCategory}`,
      action: { kind: 'open_plan', planId: p.id },
    })
  })
  if (overduePlans.length > OVERDUE_PLAN_PREVIEW) {
    out.push({
      id: 'more-overdue-plans',
      text: `View ${overduePlans.length - OVERDUE_PLAN_PREVIEW} more overdue plan(s) on Goals`,
      action: { kind: 'tab', tab: 'plans' },
    })
  }

  const concernCount = params.proc.filter((r) => r.concernsFlagged).length
  if (concernCount >= 3) {
    out.push({
      id: 'review-flagged-sessions',
      text: `Review ${concernCount} counseling session(s) with concerns flagged`,
      action: { kind: 'timeline', concernsOnly: true },
    })
  }

  if (params.proc.length === 0) {
    out.push({
      id: 'add-first-counseling',
      text: 'Add a counseling session record for this resident',
      action: { kind: 'add_activity', activity: 'counseling' },
    })
  }

  const eduSorted = [...params.edu].sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())
  if (eduSorted.length >= 2) {
    const [latest, prior] = eduSorted
    const pa = latest.progressPercent
    const pb = prior.progressPercent
    if (pa != null && pb != null && pa < pb - 15) {
      out.push({
        id: 'edu-checkin',
        text: `Education progress dropped (${pb}% → ${pa}%) — add an updated education record`,
        action: { kind: 'add_activity', activity: 'education' },
      })
    }
  } else {
    const latestEdu = eduSorted[0]
    if (latestEdu?.progressPercent != null && latestEdu.progressPercent < 50) {
      out.push({
        id: 'edu-low',
        text: `Latest education progress is ${latestEdu.progressPercent}% — review supports and record an update`,
        action: { kind: 'add_activity', activity: 'education' },
      })
    }
  }

  const hlSorted = [...params.hl].sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())
  if (hlSorted.length >= 2) {
    const [latest, prior] = hlSorted
    const sa = latest.healthScore
    const sb = prior.healthScore
    if (sa != null && sb != null && sa < sb - 0.75) {
      out.push({
        id: 'health-checkin',
        text: `Wellbeing score declined (${sb} → ${sa}) — add a health & wellbeing record`,
        action: { kind: 'add_activity', activity: 'health' },
      })
    }
  }

  return out.slice(0, NEXT_STEPS_CAP)
}
