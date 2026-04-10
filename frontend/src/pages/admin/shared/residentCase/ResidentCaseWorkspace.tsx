import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createIncidentReport,
  deleteHomeVisitation,
  deleteIncidentReport,
  deleteProcessRecording,
  getHomeVisitations,
  getInterventionPlans,
  getProcessRecordings,
  getResidentReintegrationReadiness,
  getResident,
  getSafehouses,
  listEducationRecords,
  listHealthRecords,
  listIncidentReports,
  patchHealthRecord,
  deleteHealthRecord,
  patchIncidentReport,
  patchResident,
  type EducationRecord,
  type HealthRecord,
  type HomeVisitation,
  type InterventionPlan,
  type JsonTableRow,
  type ProcessRecording,
  type ReintegrationReadinessResult,
  type ResidentDetail,
  type SafehouseOption,
} from '../../../../api/admin'
import { alertError, btnPrimary, card, input, label, pageDesc, pageTitle } from '../adminStyles'
import { BooleanBadge, CategoryBadge, ReintegrationBadge, RiskBadge, StatusBadge } from '../adminDataTable/AdminBadges'
import { formatAdminDate } from '../adminDataTable/adminFormatters'
import { AdminDeleteModal } from '../adminDataTable/AdminDeleteModal'
import { CASE_STATUSES, RISK_LEVELS, SEX_OPTIONS } from './caseConstants'
import { SimpleLineChart, SimpleMultiLineChart } from '../../dashboards/reports/ChartCard'
import { EducationSection, HealthSection, HomeVisitDrawer, ProcessRecordingDrawer } from './CareProgressContent'
import { PlansTabContent } from './PlansTabContent'
import { SessionWorkflowDrawer } from './SessionWorkflowDrawer'
import {
  buildTimelineItems,
  filterTimeline,
  planIsOverdue,
  type MainWorkspaceTab,
  type TimelineItem,
  type TimelineKind,
  type WorkspaceQuickAction,
} from './caseWorkspaceModel'
import { CaseDrawer, EmptyState, ToggleField } from './caseUi'
import { deriveReadinessPrediction, deriveReadinessTier } from '../../../../components/ml/reintegrationReadinessShared'

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
  { k: 'activity', label: 'Activity' },
  { k: 'plans', label: 'Plans & goals' },
  { k: 'safety', label: 'Safety' },
  { k: 'profile', label: 'Profile' },
]

const ACTIVITY_TYPES = [
  { id: 'counseling' as const, label: 'Add session' },
  { id: 'visit' as const, label: 'Add home visit' },
  { id: 'incident' as const, label: 'Add incident' },
  { id: 'health' as const, label: 'Add health record' },
  { id: 'education' as const, label: 'Add education record' },
  { id: 'plan' as const, label: 'Add plan' },
]

type GoalKey = 'health' | 'education' | 'safety'

type CurrentStateCard = {
  key: GoalKey
  label: string
  currentLabel: string
  targetLabel?: string
  chip: string
  chipTone: 'success' | 'warning' | 'danger' | 'default'
  trend: 'up' | 'down' | 'flat'
  subtext: string
}

type GoalCardData = {
  key: GoalKey
  label: string
  target: number
  current: number | null
  currentLabel: string
  targetLabel: string
  detail: string
}

type AttentionItem = {
  id: string
  label: string
  count?: number
  tone: 'danger' | 'warning' | 'default'
  actionLabel: string
  action: WorkspaceQuickAction
}

type TaskItem = {
  id: string
  source: string
  date: string
  summary: string
  action: WorkspaceQuickAction
}

function byNewestDate<T>(rows: T[], pickDate: (row: T) => string | null | undefined): T[] {
  return [...rows].sort((a, b) => {
    const ta = pickDate(a) ? new Date(pickDate(a)!).getTime() : 0
    const tb = pickDate(b) ? new Date(pickDate(b)!).getTime() : 0
    return tb - ta
  })
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function percentage(value: number | null, target: number) {
  if (value == null || target <= 0) return 0
  return clamp((value / target) * 100, 0, 100)
}

function scoreLabel(value: number | null, digits = 1) {
  return value == null ? '—' : value.toFixed(digits)
}

function attendanceLabel(value: number | null) {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

function trendFromNumbers(current: number | null | undefined, previous: number | null | undefined): 'up' | 'down' | 'flat' {
  if (current == null || previous == null) return 'flat'
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'flat'
}

function severityPenalty(value: string): number {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'high') return 0.95
  if (normalized === 'medium') return 0.55
  if (normalized === 'low') return 0.25
  return 0.4
}

function deriveSafetyScore(visitations: HomeVisitation[], incidents: JsonTableRow[]): number | null {
  if (visitations.length === 0 && incidents.length === 0) return null
  let score = 5

  for (const incident of byNewestDate(incidents, (row) => row.fields.incident_date).slice(0, 5)) {
    const unresolved = (incident.fields.resolved ?? '').toLowerCase() !== 'true'
    if (!unresolved) continue
    score -= severityPenalty(incident.fields.severity ?? '')
  }

  for (const visit of byNewestDate(visitations, (row) => row.visitDate).slice(0, 3)) {
    if (visit.safetyConcernsNoted) score -= 0.55
    if (visit.followUpNeeded) score -= 0.25
    const outcome = (visit.visitOutcome ?? '').trim().toLowerCase()
    if (outcome === 'unfavorable') score -= 0.35
    if (outcome === 'needs improvement') score -= 0.15
  }

  return clamp(Number(score.toFixed(2)), 1, 5)
}

function findLatestPlan(plans: InterventionPlan[], categories: string[]): InterventionPlan | null {
  const wanted = new Set(categories.map((value) => value.toLowerCase()))
  return (
    byNewestDate(
      plans.filter((plan) => wanted.has(plan.planCategory.trim().toLowerCase())),
      (plan) => plan.updatedAt || plan.createdAt || plan.targetDate,
    )[0] ?? null
  )
}

type EducationExtendedLite = {
  programName: string
  courseName: string
  attendanceStatus: string
}

function parseEducationExtendedLite(json: string | null | undefined): EducationExtendedLite {
  if (!json?.trim()) {
    return { programName: '', courseName: '', attendanceStatus: '' }
  }
  try {
    const parsed = JSON.parse(json) as Partial<EducationExtendedLite>
    return {
      programName: parsed.programName ?? '',
      courseName: parsed.courseName ?? '',
      attendanceStatus: parsed.attendanceStatus ?? '',
    }
  } catch {
    return { programName: '', courseName: '', attendanceStatus: '' }
  }
}

function toneClass(tone: 'danger' | 'warning' | 'default' | 'success') {
  if (tone === 'danger') return 'bg-destructive/10 text-destructive'
  if (tone === 'warning') return 'bg-amber-500/15 text-amber-900 dark:text-amber-100'
  if (tone === 'success') return 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-100'
  return 'bg-muted text-muted-foreground'
}

export function ResidentCaseWorkspace({ residentId }: { residentId: number }) {
  const navigate = useNavigate()
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
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [sessionWorkflowOpen, setSessionWorkflowOpen] = useState(false)
  const [expandedGoal, setExpandedGoal] = useState<GoalKey | null>('health')
  const [profileSections, setProfileSections] = useState<Record<string, boolean>>({
    identity: true,
    admission: false,
    classification: false,
    family: false,
    worker: false,
    raw: false,
  })

  const [timelineKinds, setTimelineKinds] = useState<Set<TimelineKind>>(
    () => new Set<TimelineKind>(['process', 'visit', 'incident', 'education', 'health', 'plan']),
  )
  const [timelineFrom, setTimelineFrom] = useState('')
  const [timelineTo, setTimelineTo] = useState('')
  const [timelineWorker, setTimelineWorker] = useState('')
  const [timelineSearch, setTimelineSearch] = useState('')
  const [tlConcerns, setTlConcerns] = useState(false)
  const [tlFollow, setTlFollow] = useState(false)

  const [createSig, setCreateSig] = useState({ education: 0, health: 0, plan: 0 })
  const [focusPlanId, setFocusPlanId] = useState<number | null>(null)
  const [tlEduId, setTlEduId] = useState<number | null>(null)
  const [tlHealthId, setTlHealthId] = useState<number | null>(null)

  const [procDrawer, setProcDrawer] = useState<null | { mode: 'view' | 'edit'; row: ProcessRecording }>(null)
  const [visitDrawer, setVisitDrawer] = useState<null | { mode: 'view' | 'edit' | 'create'; row?: HomeVisitation | null }>(null)
  const [incidentDrawer, setIncidentDrawer] = useState<null | { mode: 'view' | 'edit' | 'create'; row?: JsonTableRow | null }>(null)
  const [deleteProcessId, setDeleteProcessId] = useState<number | null>(null)
  const [deleteVisitId, setDeleteVisitId] = useState<number | null>(null)
  const [deleteIncidentId, setDeleteIncidentId] = useState<number | null>(null)
  const [drawerErr, setDrawerErr] = useState<string | null>(null)
  const [drawerSaving, setDrawerSaving] = useState(false)
  const [readiness, setReadiness] = useState<ReintegrationReadinessResult | null>(null)

  const load = useCallback(async () => {
    if (!Number.isFinite(residentId) || residentId <= 0) return
    setLoading(true)
    setError(null)
    try {
      const [d, sh, p, v, pl, e, h, incidents] = await Promise.all([
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
      setInc(
        incidents.map((row) => ({
          id: row.id,
          fields: {
            resident_id: String(row.residentId),
            safehouse_id: row.safehouseId != null ? String(row.safehouseId) : '',
            incident_date: row.incidentDate,
            incident_type: row.incidentType,
            severity: row.severity,
            description: row.description ?? '',
            response_taken: row.responseTaken ?? '',
            resolved: String(row.resolved),
            resolution_date: row.resolutionDate ?? '',
            reported_by: row.reportedBy ?? '',
            follow_up_required: String(row.followUpRequired),
          },
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resident')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [residentId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    void getResidentReintegrationReadiness(residentId)
      .then((result) => {
        if (!cancelled) setReadiness(result)
      })
      .catch(() => {
        if (!cancelled) setReadiness(null)
      })
    return () => {
      cancelled = true
    }
  }, [residentId])

  const fields = detail?.fields ?? {}
  const internalCode = gf(fields, 'internal_code', 'internalCode') || `Resident #${residentId}`
  const safehouseId = Number(gf(fields, 'safehouse_id', 'safehouseId')) || 0
  const safehouseName = safehouses.find((item) => item.id === safehouseId)?.name ?? (safehouseId ? `Safehouse #${safehouseId}` : '—')
  const assignedWorker = gf(fields, 'assigned_social_worker', 'assignedSocialWorker')
  const admissionDate = gf(fields, 'date_of_admission', 'dateOfAdmission')

  const latestHealth = useMemo(() => byNewestDate(hl, (row) => row.recordDate)[0] ?? null, [hl])
  const previousHealth = useMemo(() => byNewestDate(hl, (row) => row.recordDate)[1] ?? null, [hl])
  const latestEducation = useMemo(() => byNewestDate(edu, (row) => row.recordDate)[0] ?? null, [edu])
  const previousEducation = useMemo(() => byNewestDate(edu, (row) => row.recordDate)[1] ?? null, [edu])
  const latestHealthPlan = useMemo(() => findLatestPlan(plans, ['health', 'physical health']), [plans])
  const latestEducationPlan = useMemo(() => findLatestPlan(plans, ['education']), [plans])
  const latestSafetyPlan = useMemo(() => findLatestPlan(plans, ['safety']), [plans])

  const safetyScore = useMemo(() => deriveSafetyScore(vis, inc), [vis, inc])
  const priorSafetyScore = useMemo(() => deriveSafetyScore(vis.slice(1), inc.slice(1)), [vis, inc])

  const currentStateCards = useMemo<Record<GoalKey, CurrentStateCard>>(
    () => ({
      health: {
        key: 'health',
        label: 'Health',
        currentLabel: scoreLabel(latestHealth?.healthScore ?? null),
        targetLabel: scoreLabel(latestHealthPlan?.targetValue ?? 4.2),
        chip:
          latestHealth?.healthScore != null && latestHealthPlan?.targetValue != null
            ? latestHealth.healthScore >= latestHealthPlan.targetValue
              ? 'On track'
              : 'Needs support'
            : 'Monitoring',
        chipTone:
          latestHealth?.healthScore != null && latestHealthPlan?.targetValue != null
            ? latestHealth.healthScore >= latestHealthPlan.targetValue
              ? 'success'
              : 'warning'
            : 'default',
        trend: trendFromNumbers(latestHealth?.healthScore ?? null, previousHealth?.healthScore ?? null),
        subtext: latestHealth ? `Latest score on ${formatAdminDate(latestHealth.recordDate)}` : 'No health record yet',
      },
      education: {
        key: 'education',
        label: 'Education',
        currentLabel: attendanceLabel(latestEducation?.attendanceRate ?? null),
        targetLabel: attendanceLabel(latestEducationPlan?.targetValue ?? 0.85),
        chip:
          latestEducation?.attendanceRate != null && latestEducationPlan?.targetValue != null
            ? latestEducation.attendanceRate >= latestEducationPlan.targetValue
              ? 'On track'
              : 'Watch'
            : 'Monitoring',
        chipTone:
          latestEducation?.attendanceRate != null && latestEducationPlan?.targetValue != null
            ? latestEducation.attendanceRate >= latestEducationPlan.targetValue
              ? 'success'
              : 'warning'
            : 'default',
        trend: trendFromNumbers(latestEducation?.attendanceRate ?? null, previousEducation?.attendanceRate ?? null),
        subtext: latestEducation ? `Latest attendance on ${formatAdminDate(latestEducation.recordDate)}` : 'No education record yet',
      },
      safety: {
        key: 'safety',
        label: 'Safety',
        currentLabel: scoreLabel(safetyScore),
        targetLabel: scoreLabel(latestSafetyPlan?.targetValue ?? 4.2),
        chip: inc.some((row) => (row.fields.resolved ?? '').toLowerCase() !== 'true') ? 'Open concern' : 'Stable',
        chipTone: inc.some((row) => (row.fields.resolved ?? '').toLowerCase() !== 'true') ? 'danger' : 'success',
        trend: trendFromNumbers(safetyScore, priorSafetyScore),
        subtext: safetyScore != null ? 'Derived from incidents and visit flags' : 'No recent safety activity',
      },
    }),
    [inc, latestEducation, latestEducationPlan, latestHealth, latestHealthPlan, latestSafetyPlan, previousEducation, previousHealth, priorSafetyScore, safetyScore],
  )

  const goalCards = useMemo<Record<GoalKey, GoalCardData>>(
    () => ({
      health: {
        key: 'health',
        label: 'Health goal',
        target: latestHealthPlan?.targetValue ?? 4.2,
        current: latestHealth?.healthScore ?? null,
        currentLabel: scoreLabel(latestHealth?.healthScore ?? null),
        targetLabel: scoreLabel(latestHealthPlan?.targetValue ?? 4.2),
        detail: latestHealthPlan?.planDescription || 'Wellbeing goal from the latest intervention plan.',
      },
      education: {
        key: 'education',
        label: 'Education goal',
        target: latestEducationPlan?.targetValue ?? 0.85,
        current: latestEducation?.attendanceRate ?? null,
        currentLabel: attendanceLabel(latestEducation?.attendanceRate ?? null),
        targetLabel: attendanceLabel(latestEducationPlan?.targetValue ?? 0.85),
        detail: latestEducationPlan?.planDescription || 'Attendance goal from the latest intervention plan.',
      },
      safety: {
        key: 'safety',
        label: 'Safety goal',
        target: latestSafetyPlan?.targetValue ?? 4.2,
        current: safetyScore,
        currentLabel: scoreLabel(safetyScore),
        targetLabel: scoreLabel(latestSafetyPlan?.targetValue ?? 4.2),
        detail: latestSafetyPlan?.planDescription || 'Safety goal informed by incidents and safety-related visits.',
      },
    }),
    [latestEducation, latestEducationPlan, latestHealth, latestHealthPlan, latestSafetyPlan, safetyScore],
  )

  const unresolvedIncidents = useMemo(
    () => inc.filter((row) => (row.fields.resolved ?? '').toLowerCase() !== 'true'),
    [inc],
  )

  const activePlans = useMemo(
    () =>
      plans.filter(
        (row) => !row.status.toLowerCase().includes('closed') && !row.status.toLowerCase().includes('achieved') && !row.status.toLowerCase().includes('completed'),
      ),
    [plans],
  )

  const timelineAll = useMemo(() => buildTimelineItems(proc, vis, edu, hl, plans, inc), [proc, vis, edu, hl, plans, inc])
  const timelineFiltered = useMemo(
    () =>
      filterTimeline(timelineAll, {
        kinds: timelineKinds,
        dateFrom: timelineFrom,
        dateTo: timelineTo,
        workerQ: timelineWorker,
        concernsOnly: tlConcerns,
        followUpOnly: tlFollow,
        progressOnly: false,
        search: timelineSearch,
      }),
    [timelineAll, timelineKinds, timelineFrom, timelineTo, timelineWorker, tlConcerns, tlFollow, timelineSearch],
  )

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = []
    const overduePlans = plans.filter(planIsOverdue)
    const followVisits = vis.filter((row) => row.followUpNeeded)
    const flaggedSessions = proc.filter((row) => row.concernsFlagged)

    if (overduePlans.length) {
      items.push({
        id: 'overdue-plans',
        label: 'Overdue plans',
        count: overduePlans.length,
        tone: 'warning',
        actionLabel: 'Review',
        action: { kind: 'tab', tab: 'plans' },
      })
    }
    if (followVisits.length) {
      items.push({
        id: 'visit-follow-ups',
        label: 'Visit follow-ups',
        count: followVisits.length,
        tone: 'warning',
        actionLabel: 'Update',
        action: { kind: 'timeline', followUpOnly: true },
      })
    }
    if (flaggedSessions.length) {
      items.push({
        id: 'flagged-sessions',
        label: 'Flagged sessions',
        count: flaggedSessions.length,
        tone: 'danger',
        actionLabel: 'Review',
        action: { kind: 'timeline', concernsOnly: true },
      })
    }
    if (unresolvedIncidents.length) {
      items.push({
        id: 'unresolved-incidents',
        label: 'Unresolved incidents',
        count: unresolvedIncidents.length,
        tone: 'danger',
        actionLabel: 'Resolve',
        action: { kind: 'tab', tab: 'safety' },
      })
    }
    if (latestEducation?.attendanceRate != null && previousEducation?.attendanceRate != null && latestEducation.attendanceRate < previousEducation.attendanceRate) {
      items.push({
        id: 'attendance-dip',
        label: 'Attendance dip',
        tone: 'warning',
        actionLabel: 'Open',
        action: { kind: 'add_activity', activity: 'education' },
      })
    }
    return items.slice(0, 5)
  }, [latestEducation, previousEducation, plans, proc, unresolvedIncidents.length, vis])

  const openTasks = useMemo<TaskItem[]>(() => {
    const tasks: TaskItem[] = []
    proc
      .filter((row) => row.followUpActions?.trim())
      .slice(0, 4)
      .forEach((row) => {
        tasks.push({
          id: `proc-${row.id}`,
          source: 'Session',
          date: row.sessionDate,
          summary: row.followUpActions!.trim(),
          action: { kind: 'timeline', concernsOnly: false, followUpOnly: true },
        })
      })
    vis
      .filter((row) => row.followUpNeeded)
      .slice(0, 4)
      .forEach((row) => {
        tasks.push({
          id: `visit-${row.id}`,
          source: 'Home visit',
          date: row.visitDate,
          summary: row.followUpNotes?.trim() || 'Follow-up needed',
          action: { kind: 'open_visit', visitId: row.id },
        })
      })
    unresolvedIncidents
      .filter((row) => (row.fields.follow_up_required ?? '').toLowerCase() === 'true')
      .slice(0, 4)
      .forEach((row) => {
        tasks.push({
          id: `incident-${row.id}`,
          source: 'Incident',
          date: row.fields.incident_date ?? '',
          summary: row.fields.description?.trim() || row.fields.incident_type || 'Incident follow-up required',
          action: { kind: 'tab', tab: 'safety' },
        })
      })
    plans
      .filter(planIsOverdue)
      .slice(0, 4)
      .forEach((row) => {
        tasks.push({
          id: `plan-${row.id}`,
          source: 'Plan',
          date: row.targetDate ?? row.updatedAt ?? row.createdAt,
          summary: row.planDescription,
          action: { kind: 'open_plan', planId: row.id },
        })
      })
    return byNewestDate(tasks, (row) => row.date).slice(0, 8)
  }, [plans, proc, unresolvedIncidents, vis])

  const currentFocus = useMemo(() => {
    const primaryPlan =
      byNewestDate(
        activePlans,
        (row) => row.updatedAt || row.targetDate || row.createdAt,
      )[0] ?? null
    const topTask = openTasks[0] ?? null
    const primaryFocusArea =
      primaryPlan?.planCategory ||
      (unresolvedIncidents.length > 0
        ? 'Safety'
        : latestEducation && latestEducation.attendanceRate != null && previousEducation?.attendanceRate != null && latestEducation.attendanceRate < previousEducation.attendanceRate
          ? 'Education'
          : latestHealth && latestHealth.healthScore != null && previousHealth?.healthScore != null && latestHealth.healthScore < previousHealth.healthScore
            ? 'Health'
            : 'Case support')

    return {
      area: primaryFocusArea,
      activePlan: primaryPlan?.planDescription || 'No active plan on file.',
      nextStep: topTask ? `${topTask.source} · ${topTask.summary}` : 'No urgent follow-up right now.',
      context:
        primaryPlan?.targetDate
          ? `Target ${formatAdminDate(primaryPlan.targetDate)}`
          : topTask?.date
            ? `Next dated item ${formatAdminDate(topTask.date)}`
            : '',
    }
  }, [activePlans, latestEducation, latestHealth, openTasks, previousEducation, previousHealth, unresolvedIncidents.length])

  const emotionalCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of proc) {
      const state = row.emotionalStateObserved?.trim()
      if (state) map.set(state, (map.get(state) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [proc])

  const signalGroups = useMemo(() => {
    const good: string[] = []
    const watch: string[] = []
    const risk: string[] = []
    const latestVisit = byNewestDate(vis, (row) => row.visitDate)[0] ?? null

    const incidentsIn60Days = inc.filter((row) => {
      const t = new Date(row.fields.incident_date ?? '').getTime()
      return Number.isFinite(t) && t >= Date.now() - 60 * 86400000
    }).length
    if (incidentsIn60Days === 0) good.push('No incidents in 60 days')

    const recentProgress = proc.filter((row) => row.progressNoted).slice(0, 3).length
    if (recentProgress > 0) good.push(`Progress noted in ${recentProgress} recent sessions`)

    if (latestEducation?.attendanceRate != null && latestEducationPlan?.targetValue != null && latestEducation.attendanceRate >= latestEducationPlan.targetValue) {
      good.push('Attendance is meeting target')
    }

    if (latestEducation?.attendanceRate != null && previousEducation?.attendanceRate != null && latestEducation.attendanceRate < previousEducation.attendanceRate) {
      watch.push('Attendance dropped on latest record')
    }
    if (latestHealth?.healthScore != null && previousHealth?.healthScore != null && latestHealth.healthScore < previousHealth.healthScore) {
      watch.push('Health score trending down')
    }
    if (emotionalCounts[0] && emotionalCounts[0][1] >= 2) {
      watch.push(`Repeated ${emotionalCounts[0][0].toLowerCase()} state`)
    }

    if (latestVisit?.safetyConcernsNoted) risk.push('Safety concern on last visit')
    if (proc.slice(0, 3).some((row) => row.concernsFlagged)) risk.push('Recent sessions flagged concerns')
    if (unresolvedIncidents.length > 0) risk.push(`${unresolvedIncidents.length} unresolved incident${unresolvedIncidents.length === 1 ? '' : 's'}`)

    return { good: good.slice(0, 3), watch: watch.slice(0, 3), risk: risk.slice(0, 3) }
  }, [emotionalCounts, inc, latestEducation, latestEducationPlan, latestHealth, previousEducation, previousHealth, proc, unresolvedIncidents.length, vis])

  const criticalBackground = useMemo(
    () =>
      [
        gf(fields, 'current_risk_level', 'currentRiskLevel') ? `Risk ${gf(fields, 'current_risk_level', 'currentRiskLevel')}` : '',
        gf(fields, 'reintegration_status', 'reintegrationStatus') ? `Reintegration ${gf(fields, 'reintegration_status', 'reintegrationStatus')}` : '',
        gf(fields, 'special_needs_diagnosis', 'specialNeedsDiagnosis') ? `Special needs: ${gf(fields, 'special_needs_diagnosis', 'specialNeedsDiagnosis')}` : '',
        gf(fields, 'notes_restricted', 'notesRestricted') ? 'Restricted case notes present' : '',
      ].filter(Boolean),
    [fields],
  )

  const recentConcerns = useMemo(
    () =>
      proc
        .filter((row) => row.concernsFlagged)
        .slice(0, 3)
        .map((row) => `${formatAdminDate(row.sessionDate)} · ${row.sessionNarrative.slice(0, 90)}${row.sessionNarrative.length > 90 ? '…' : ''}`),
    [proc],
  )

  const activeGoalContext = useMemo(
    () =>
      plans
        .filter((row) => !row.status.toLowerCase().includes('closed') && !row.status.toLowerCase().includes('achieved'))
        .slice(0, 4)
        .map((row) => `${row.planCategory} · ${row.planDescription}`),
    [plans],
  )

  const recentActivityContext = useMemo(
    () => timelineAll.slice(0, 4).map((row) => `${formatAdminDate(row.dateIso)} · ${row.title} · ${row.summary}`),
    [timelineAll],
  )

  const readinessSummary = useMemo(() => {
    if (!readiness) return null
    const percent = Math.round(readiness.reintegration_probability * 100)
    const tier = deriveReadinessTier(readiness.reintegration_probability)
    const label =
      tier === 'High Readiness'
        ? 'Approaching readiness'
        : tier === 'Moderate Readiness'
          ? 'Building readiness'
          : 'Needs more support'
    return {
      percent,
      label,
      prediction: deriveReadinessPrediction(readiness.reintegration_probability),
      topImprovement: readiness.top_improvements[0]?.label ?? 'Maintain current support plan',
    }
  }, [readiness])

  function closeAddMenu() {
    setAddMenuOpen(false)
  }

  function bumpCreate(kind: (typeof ACTIVITY_TYPES)[number]['id']) {
    closeAddMenu()
    if (kind === 'counseling') {
      setSessionWorkflowOpen(true)
      return
    }
    if (kind === 'visit') {
      setVisitDrawer({ mode: 'create', row: null })
      return
    }
    if (kind === 'incident') {
      setIncidentDrawer({ mode: 'create', row: null })
      return
    }
    if (kind === 'plan') {
      setMainTab('plans')
      setCreateSig((state) => ({ ...state, plan: state.plan + 1 }))
      return
    }
    if (kind === 'education') {
      setMainTab('activity')
      setCreateSig((state) => ({ ...state, education: state.education + 1 }))
      return
    }
    if (kind === 'health') {
      setMainTab('activity')
      setCreateSig((state) => ({ ...state, health: state.health + 1 }))
    }
  }

  function runWorkspaceAction(action: WorkspaceQuickAction) {
    switch (action.kind) {
      case 'tab':
        setMainTab(action.tab)
        break
      case 'timeline':
        setMainTab('activity')
        setTlFollow(Boolean(action.followUpOnly))
        setTlConcerns(Boolean(action.concernsOnly))
        break
      case 'open_visit': {
        const row = vis.find((item) => item.id === action.visitId)
        if (row) {
          setVisitDrawer({ mode: 'view', row })
          setMainTab('activity')
        }
        break
      }
      case 'open_plan':
        setFocusPlanId(action.planId)
        setMainTab('plans')
        break
      case 'add_activity':
        bumpCreate(action.activity)
        break
    }
  }

  function onTimelineSelect(item: TimelineItem) {
    switch (item.ref.kind) {
      case 'process':
        setProcDrawer({ mode: 'view', row: item.ref.row })
        break
      case 'visit':
        setVisitDrawer({ mode: 'view', row: item.ref.row })
        break
      case 'education':
        setTlEduId(item.ref.row.id)
        break
      case 'health':
        setTlHealthId(item.ref.row.id)
        break
      case 'plan':
        setFocusPlanId(item.ref.row.id)
        setMainTab('plans')
        break
      case 'incident':
        setIncidentDrawer({ mode: 'view', row: item.ref.row })
        break
    }
  }

  function openTimelineEdit(item: TimelineItem) {
    switch (item.ref.kind) {
      case 'process':
        setProcDrawer({ mode: 'edit', row: item.ref.row })
        break
      case 'visit':
        setVisitDrawer({ mode: 'edit', row: item.ref.row })
        break
      case 'incident':
        setIncidentDrawer({ mode: 'edit', row: item.ref.row })
        break
      case 'education':
        setTlEduId(item.ref.row.id)
        break
      case 'health':
        setTlHealthId(item.ref.row.id)
        break
      case 'plan':
        setFocusPlanId(item.ref.row.id)
        setMainTab('plans')
        break
    }
  }

  function requestDeleteFromTimeline(item: TimelineItem) {
    if (item.ref.kind === 'process') setDeleteProcessId(item.ref.row.id)
    if (item.ref.kind === 'visit') setDeleteVisitId(item.ref.row.id)
    if (item.ref.kind === 'incident') setDeleteIncidentId(item.ref.row.id)
  }

  if (!Number.isFinite(residentId) || residentId <= 0) {
    return <p className="text-destructive">Invalid resident.</p>
  }

  if (loading) return <p className="text-muted-foreground">Loading case…</p>
  if (error && !detail) {
    return (
      <div className="space-y-3">
        <p className="text-destructive">{error}</p>
        <Link to="/admin/residents" className="text-sm text-primary hover:underline">
          ← Back to residents
        </Link>
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="space-y-3">
        <p className="text-destructive">Resident not found.</p>
        <Link to="/admin/residents" className="text-sm text-primary hover:underline">
          ← Back to residents
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link to="/admin/residents" className="text-sm text-primary hover:underline">
          ← Residents
        </Link>

        <div className={`${card} flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className={pageTitle}>{internalCode}</h2>
              {gf(fields, 'case_status', 'caseStatus') ? <StatusBadge status={gf(fields, 'case_status', 'caseStatus')} /> : null}
              {gf(fields, 'current_risk_level', 'currentRiskLevel') ? <RiskBadge level={gf(fields, 'current_risk_level', 'currentRiskLevel')} /> : null}
              {gf(fields, 'reintegration_type', 'reintegrationType') ? <CategoryBadge>{gf(fields, 'reintegration_type', 'reintegrationType')}</CategoryBadge> : null}
              {gf(fields, 'reintegration_status', 'reintegrationStatus') ? <ReintegrationBadge value={gf(fields, 'reintegration_status', 'reintegrationStatus')} /> : null}
            </div>
            <p className={`${pageDesc} mt-2`}>
              {safehouseName}
              {' · '}
              {assignedWorker || 'No worker assigned'}
              {admissionDate ? ` · Admitted ${formatAdminDate(admissionDate)}` : ''}
            </p>
          </div>

          <div className="relative flex flex-wrap gap-2 lg:justify-end">
            <button type="button" className={btnPrimary} onClick={() => setAddMenuOpen((open) => !open)}>
              Add
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
              onClick={() => setSessionWorkflowOpen(true)}
            >
              Start session
            </button>
            {addMenuOpen ? (
              <div className={`${card} absolute right-0 top-full z-40 mt-2 min-w-[15rem] space-y-1 py-2 shadow-lg`}>
                {ACTIVITY_TYPES.map((activity) => (
                  <button
                    key={activity.id}
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => bumpCreate(activity.id)}
                  >
                    {activity.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <div className={alertError}>{error}</div> : null}

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.k}
            type="button"
            onClick={() => setMainTab(tab.k)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              mainTab === tab.k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mainTab === 'overview' ? (
        <div className="space-y-8">
          <OverviewSection title="Needs attention">
            {attentionItems.length === 0 ? (
              <EmptyState title="Nothing urgent right now" hint="This resident has no high-priority alerts at the moment." />
            ) : (
              <div className="space-y-2">
                {attentionItems.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${toneClass(item.tone)}`}>{item.label}</span>
                      {item.count != null ? <span className="text-sm font-semibold text-foreground">{item.count}</span> : null}
                    </div>
                    <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => runWorkspaceAction(item.action)}>
                      {item.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </OverviewSection>

          <OverviewSection title="Current focus">
            <div className="rounded-2xl border border-border bg-card px-5 py-5">
              <div className="grid gap-5 md:grid-cols-3">
                <FocusCell label="Primary focus area" value={currentFocus.area} />
                <FocusCell label="Active plan" value={currentFocus.activePlan} />
                <FocusCell label="Next step" value={currentFocus.nextStep} />
              </div>
              {currentFocus.context ? <p className="mt-4 text-sm text-muted-foreground">{currentFocus.context}</p> : null}
            </div>
          </OverviewSection>

          <OverviewSection title="Signals">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="grid gap-5 lg:grid-cols-3">
              <SignalGroupCard title="Good" tone="success" items={signalGroups.good} />
              <SignalGroupCard title="Watch" tone="warning" items={signalGroups.watch} />
              <SignalGroupCard title="Risk" tone="danger" items={signalGroups.risk} />
              </div>
            </div>
          </OverviewSection>

          <OverviewSection title="Overview">
            <div className="grid gap-4 lg:grid-cols-3">
              {(Object.values(currentStateCards) as CurrentStateCard[]).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    if (item.key === 'health') {
                      setMainTab('activity')
                      if (latestHealth) setTlHealthId(latestHealth.id)
                    } else if (item.key === 'education') {
                      setMainTab('activity')
                      if (latestEducation) setTlEduId(latestEducation.id)
                    } else {
                      setMainTab('safety')
                    }
                  }}
                  className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${toneClass(item.chipTone)}`}>{item.chip}</span>
                  </div>
                  <p className="mt-4 text-3xl font-semibold tabular-nums text-foreground">{item.currentLabel}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Target {item.targetLabel}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.subtext}</span>
                    <TrendBadge trend={item.trend} />
                  </div>
                </button>
              ))}
            </div>
          </OverviewSection>

          <OverviewSection title="Recent activity">
            <div className="space-y-2">
              {timelineAll.slice(0, 4).map((item) => (
                <CompactActivityRow key={item.key} item={item} onOpen={onTimelineSelect} onEdit={openTimelineEdit} />
              ))}
            </div>
            <div className="pt-2">
              <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setMainTab('activity')}>
                View all activity
              </button>
            </div>
          </OverviewSection>

          {readinessSummary ? (
            <OverviewSection title="Reintegration readiness">
              <button
                type="button"
                onClick={() => navigate(`/admin/reintigration-readiness/${residentId}`)}
                className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left transition-colors hover:bg-muted/40"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{readinessSummary.percent}% readiness</p>
                  <p className="mt-1 text-sm text-muted-foreground">{readinessSummary.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{readinessSummary.topImprovement}</p>
                </div>
                <div className="text-sm font-medium text-primary">Open readiness page</div>
              </button>
            </OverviewSection>
          ) : null}
        </div>
      ) : null}

      {mainTab === 'activity' ? (
        <div className="space-y-6">
          <div className={`${card} space-y-4`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className={label}>
                From
                <input type="date" className={input} value={timelineFrom} onChange={(e) => setTimelineFrom(e.target.value)} />
              </label>
              <label className={label}>
                To
                <input type="date" className={input} value={timelineTo} onChange={(e) => setTimelineTo(e.target.value)} />
              </label>
              <label className={label}>
                Worker
                <input className={input} value={timelineWorker} onChange={(e) => setTimelineWorker(e.target.value)} placeholder="Search worker" />
              </label>
              <label className={label}>
                Search
                <input className={input} value={timelineSearch} onChange={(e) => setTimelineSearch(e.target.value)} placeholder="Keyword" />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              {(['process', 'visit', 'incident', 'education', 'health', 'plan'] as TimelineKind[]).map((kind) => (
                <label key={kind} className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={timelineKinds.has(kind)}
                    onChange={() => {
                      setTimelineKinds((prev) => {
                        const next = new Set(prev)
                        if (next.has(kind)) next.delete(kind)
                        else next.add(kind)
                        return next
                      })
                    }}
                  />
                  {kind}
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-foreground">
                <input type="checkbox" checked={tlFollow} onChange={(e) => setTlFollow(e.target.checked)} />
                Follow-up only
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-foreground">
                <input type="checkbox" checked={tlConcerns} onChange={(e) => setTlConcerns(e.target.checked)} />
                Flagged only
              </label>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {ACTIVITY_TYPES.map((activity) => (
                <InlineActionButton key={activity.id} onClick={() => bumpCreate(activity.id)}>
                  {activity.label}
                </InlineActionButton>
              ))}
            </div>
          </div>

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
              <EmptyState title="No activity matches these filters" />
            ) : (
              timelineFiltered.map((item) => (
                <TimelineRow key={item.key} item={item} onOpen={onTimelineSelect} onEdit={openTimelineEdit} onDelete={requestDeleteFromTimeline} />
              ))
            )}
          </div>
        </div>
      ) : null}

      {mainTab === 'plans' ? (
        <PlansTabContent
          residentId={residentId}
          plans={plans}
          onReload={load}
          openCreateSignal={createSig.plan}
          layout="workspace"
          focusPlanId={focusPlanId}
          onFocusPlanConsumed={() => setFocusPlanId(null)}
          summaryContent={
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                {(Object.values(goalCards) as GoalCardData[]).map((goal) => (
                  <button
                    key={goal.key}
                    type="button"
                    onClick={() => setExpandedGoal((value) => (value === goal.key ? null : goal.key))}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      expandedGoal === goal.key ? 'border-primary bg-muted/20' : 'border-border bg-card hover:bg-muted/30'
                    }`}
                  >
                    <ProgressRing label={goal.label} progress={percentage(goal.current, goal.target)}>
                      <div className="text-xl font-semibold tabular-nums text-foreground">{goal.currentLabel}</div>
                    </ProgressRing>
                    <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">{goal.label.replace(' goal', '')}</p>
                  </button>
                ))}
              </div>

              {expandedGoal ? (
                <InlineDetailCard title={`${goalCards[expandedGoal].label} details`}>
                  <GoalDrillIn
                    goal={expandedGoal}
                    data={goalCards[expandedGoal]}
                    healthRows={hl}
                    educationRows={edu}
                    visitRows={vis}
                    incidentRows={inc}
                    relatedPlan={expandedGoal === 'health' ? latestHealthPlan : expandedGoal === 'education' ? latestEducationPlan : latestSafetyPlan}
                    onReload={load}
                    onAddHealth={() => bumpCreate('health')}
                    onAddEducation={() => bumpCreate('education')}
                    onLogIncident={() => bumpCreate('incident')}
                    onOpenHealth={(id) => {
                      setMainTab('activity')
                      setTlHealthId(id)
                    }}
                    onOpenEducation={(id) => {
                      setMainTab('activity')
                      setTlEduId(id)
                    }}
                    onOpenIncident={(row) => setIncidentDrawer({ mode: 'view', row })}
                    onOpenVisit={(row) => setVisitDrawer({ mode: 'view', row })}
                  />
                </InlineDetailCard>
              ) : null}
            </div>
          }
        />
      ) : null}

      {mainTab === 'safety' ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Safety summary</h3>
              <p className="mt-1 text-sm text-muted-foreground">Critical concerns, visits, and flagged sessions in one place.</p>
            </div>
            <button type="button" className={btnPrimary} onClick={() => bumpCreate('incident')}>
              Log incident
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <SummaryTile label="Unresolved incidents" value={unresolvedIncidents.length} />
            <SummaryTile label="Safety-related visits" value={vis.filter((row) => row.safetyConcernsNoted || row.followUpNeeded).length} />
            <SummaryTile label="Flagged sessions" value={proc.filter((row) => row.concernsFlagged).length} />
          </div>

          <SafetyBlock title="Incidents">
            {inc.length === 0 ? (
              <EmptyState title="No incidents logged" hint="Use Log incident to add the first one." />
            ) : (
              inc.map((row) => (
                <SafetyRow
                  key={row.id}
                  title={row.fields.incident_type || 'Incident'}
                  subtitle={row.fields.description || 'No description'}
                  meta={[
                    row.fields.incident_date ? formatAdminDate(row.fields.incident_date) : '',
                    row.fields.severity || '',
                    (row.fields.resolved ?? '').toLowerCase() === 'true' ? 'Resolved' : 'Open',
                  ]}
                  onView={() => setIncidentDrawer({ mode: 'view', row })}
                  onEdit={() => setIncidentDrawer({ mode: 'edit', row })}
                  onDelete={() => setDeleteIncidentId(row.id)}
                />
              ))
            )}
          </SafetyBlock>

          <SafetyBlock title="Visits with safety concerns or follow-up">
            {vis.filter((row) => row.safetyConcernsNoted || row.followUpNeeded).length === 0 ? (
              <EmptyState title="No safety-related visits" />
            ) : (
              vis
                .filter((row) => row.safetyConcernsNoted || row.followUpNeeded)
                .map((row) => (
                  <SafetyRow
                    key={row.id}
                    title={`Home visit · ${formatAdminDate(row.visitDate)}`}
                    subtitle={row.followUpNotes || row.observations || row.purpose || 'No notes'}
                    meta={[
                      row.socialWorker,
                      row.safetyConcernsNoted ? 'Safety concern' : '',
                      row.followUpNeeded ? 'Follow-up needed' : '',
                    ]}
                    onView={() => setVisitDrawer({ mode: 'view', row })}
                    onEdit={() => setVisitDrawer({ mode: 'edit', row })}
                    onDelete={() => setDeleteVisitId(row.id)}
                  />
                ))
            )}
          </SafetyBlock>

          <SafetyBlock title="Sessions with concerns flagged">
            {proc.filter((row) => row.concernsFlagged).length === 0 ? (
              <EmptyState title="No flagged sessions" />
            ) : (
              proc
                .filter((row) => row.concernsFlagged)
                .map((row) => (
                  <SafetyRow
                    key={row.id}
                    title={`Session · ${formatAdminDate(row.sessionDate)}`}
                    subtitle={row.sessionNarrative}
                    meta={[row.socialWorker, row.sessionType, row.followUpActions ? 'Follow-up noted' : '']}
                    onView={() => setProcDrawer({ mode: 'view', row })}
                    onEdit={() => setProcDrawer({ mode: 'edit', row })}
                    onDelete={() => setDeleteProcessId(row.id)}
                  />
                ))
            )}
          </SafetyBlock>
        </div>
      ) : null}

      {mainTab === 'profile' ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Profile</h3>
              <p className="mt-1 text-sm text-muted-foreground">Administrative details and background information.</p>
            </div>
            <button type="button" className={btnPrimary} onClick={() => setProfileOpen(true)}>
              Edit profile
            </button>
          </div>

          {criticalBackground.length > 0 ? (
            <div className="rounded-2xl border border-amber-400/40 bg-amber-500/5 px-5 py-4">
              <p className="text-sm font-semibold text-foreground">Critical background</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {criticalBackground.map((item) => (
                  <span key={item} className="rounded-full bg-background px-3 py-1.5 text-sm text-foreground">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <ProfileSection
            title="Identity & case basics"
            open={profileSections.identity}
            onToggle={() => setProfileSections((value) => ({ ...value, identity: !value.identity }))}
          >
            <ProfileGrid rows={[
              ['Internal code', gf(fields, 'internal_code', 'internalCode')],
              ['Case control no', gf(fields, 'case_control_no', 'caseControlNo')],
              ['Case status', gf(fields, 'case_status', 'caseStatus')],
              ['Case category', gf(fields, 'case_category', 'caseCategory')],
              ['Sex', gf(fields, 'sex')],
            ]} />
          </ProfileSection>

          <ProfileSection
            title="Admission & placement"
            open={profileSections.admission}
            onToggle={() => setProfileSections((value) => ({ ...value, admission: !value.admission }))}
          >
            <ProfileGrid rows={[
              ['Admission date', admissionDate ? formatAdminDate(admissionDate) : ''],
              ['Length of stay', gf(fields, 'length_of_stay', 'lengthOfStay')],
              ['Safehouse', safehouseName],
              ['Safehouse ID', gf(fields, 'safehouse_id', 'safehouseId')],
            ]} />
          </ProfileSection>

          <ProfileSection
            title="Classification & risk"
            open={profileSections.classification}
            onToggle={() => setProfileSections((value) => ({ ...value, classification: !value.classification }))}
          >
            <ProfileGrid rows={[
              ['Risk level', gf(fields, 'current_risk_level', 'currentRiskLevel')],
              ['Reintegration status', gf(fields, 'reintegration_status', 'reintegrationStatus')],
              ['Reintegration type', gf(fields, 'reintegration_type', 'reintegrationType')],
              ['Present age', gf(fields, 'present_age', 'presentAge')],
            ]} />
          </ProfileSection>

          <ProfileSection
            title="Family / vulnerability indicators"
            open={profileSections.family}
            onToggle={() => setProfileSections((value) => ({ ...value, family: !value.family }))}
          >
            <ProfileGrid rows={[
              ['Family background', gf(fields, 'family_background', 'familyBackground')],
              ['Vulnerability indicators', gf(fields, 'vulnerability_indicators', 'vulnerabilityIndicators')],
              ['Referral source', gf(fields, 'referral_source', 'referralSource')],
              ['Notes', gf(fields, 'notes')],
            ]} />
          </ProfileSection>

          <ProfileSection
            title="Worker assignment"
            open={profileSections.worker}
            onToggle={() => setProfileSections((value) => ({ ...value, worker: !value.worker }))}
          >
            <ProfileGrid rows={[
              ['Assigned social worker', assignedWorker],
              ['Safehouse', safehouseName],
            ]} />
          </ProfileSection>

          <ProfileSection
            title="Additional fields / raw fields"
            open={profileSections.raw}
            onToggle={() => setProfileSections((value) => ({ ...value, raw: !value.raw }))}
          >
            <dl className="grid gap-2 sm:grid-cols-2">
              {Object.keys(fields)
                .sort()
                .map((key) => (
                  <div key={key} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{key}</dt>
                    <dd className="mt-1 text-sm text-foreground">{fields[key] || '—'}</dd>
                  </div>
                ))}
            </dl>
          </ProfileSection>
        </div>
      ) : null}

      {sessionWorkflowOpen ? (
        <SessionWorkflowDrawer
          residentId={residentId}
          assignedWorker={assignedWorker}
          recentConcerns={recentConcerns}
          activeGoals={activeGoalContext}
          recentActivity={recentActivityContext}
          onClose={() => setSessionWorkflowOpen(false)}
          onSaved={async () => {
            setSessionWorkflowOpen(false)
            await load()
          }}
        />
      ) : null}

      {profileOpen ? (
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
      ) : null}

      {incidentDrawer ? (
        <IncidentDrawer
          mode={incidentDrawer.mode}
          residentId={residentId}
          safehouseId={safehouseId}
          initial={incidentDrawer.row ?? null}
          error={drawerErr}
          onError={setDrawerErr}
          onClose={() => {
            setIncidentDrawer(null)
            setDrawerErr(null)
          }}
          onSaved={async () => {
            setIncidentDrawer(null)
            setDrawerErr(null)
            await load()
          }}
          onEdit={() => {
            if (incidentDrawer.row) setIncidentDrawer({ mode: 'edit', row: incidentDrawer.row })
          }}
          onDeleteRequest={(id) => setDeleteIncidentId(id)}
        />
      ) : null}

      {procDrawer ? (
        <ProcessRecordingDrawer
          key={String(procDrawer.row.id)}
          mode={procDrawer.mode}
          residentId={residentId}
          initial={procDrawer.row}
          error={drawerErr}
          onError={setDrawerErr}
          onClose={() => {
            setProcDrawer(null)
            setDrawerErr(null)
          }}
          onEdit={() => setProcDrawer((value) => (value ? { ...value, mode: 'edit' } : value))}
          onSaved={async () => {
            setProcDrawer(null)
            setDrawerErr(null)
            await load()
          }}
          onDeleteRequest={(id) => setDeleteProcessId(id)}
        />
      ) : null}

      {visitDrawer ? (
        <HomeVisitDrawer
          key={visitDrawer.mode === 'create' ? 'new-visit' : String(visitDrawer.row?.id ?? 'visit')}
          mode={visitDrawer.mode}
          residentId={residentId}
          initial={visitDrawer.row ?? null}
          error={drawerErr}
          onError={setDrawerErr}
          onClose={() => {
            setVisitDrawer(null)
            setDrawerErr(null)
          }}
          onEdit={() => setVisitDrawer((value) => (value && value.row ? { mode: 'edit', row: value.row } : value))}
          onSaved={async () => {
            setVisitDrawer(null)
            setDrawerErr(null)
            await load()
          }}
          onDeleteRequest={(id) => setDeleteVisitId(id)}
        />
      ) : null}

      <AdminDeleteModal
        open={deleteProcessId != null}
        title="Delete record?"
        body="This action cannot be undone."
        loading={drawerSaving}
        onCancel={() => setDeleteProcessId(null)}
        onConfirm={async () => {
          if (deleteProcessId == null) return
          setDrawerSaving(true)
          try {
            await deleteProcessRecording(deleteProcessId)
            setDeleteProcessId(null)
            setProcDrawer(null)
            await load()
          } catch (err) {
            setDrawerErr(err instanceof Error ? err.message : 'Delete failed')
          } finally {
            setDrawerSaving(false)
          }
        }}
      />

      <AdminDeleteModal
        open={deleteVisitId != null}
        title="Delete record?"
        body="This action cannot be undone."
        loading={drawerSaving}
        onCancel={() => setDeleteVisitId(null)}
        onConfirm={async () => {
          if (deleteVisitId == null) return
          setDrawerSaving(true)
          try {
            await deleteHomeVisitation(deleteVisitId)
            setDeleteVisitId(null)
            setVisitDrawer(null)
            await load()
          } catch (err) {
            setDrawerErr(err instanceof Error ? err.message : 'Delete failed')
          } finally {
            setDrawerSaving(false)
          }
        }}
      />

      <AdminDeleteModal
        open={deleteIncidentId != null}
        title="Delete record?"
        body="This action cannot be undone."
        loading={drawerSaving}
        onCancel={() => setDeleteIncidentId(null)}
        onConfirm={async () => {
          if (deleteIncidentId == null) return
          setDrawerSaving(true)
          try {
            await deleteIncidentReport(deleteIncidentId)
            setDeleteIncidentId(null)
            setIncidentDrawer(null)
            await load()
          } catch (err) {
            setDrawerErr(err instanceof Error ? err.message : 'Delete failed')
          } finally {
            setDrawerSaving(false)
          }
        }}
      />
    </div>
  )
}

function OverviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function InlineDetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-5">
      <h4 className="text-base font-semibold text-foreground">{title}</h4>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function FocusCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-sm leading-6 text-foreground">{value}</p>
    </div>
  )
}

function SignalGroupCard({
  title,
  tone,
  items,
}: {
  title: string
  tone: 'success' | 'warning' | 'danger'
  items: string[]
}) {
  return (
    <div className="min-w-0">
      <p className={`text-sm font-semibold ${tone === 'success' ? 'text-emerald-700 dark:text-emerald-300' : tone === 'warning' ? 'text-amber-800 dark:text-amber-200' : 'text-destructive'}`}>
        {title}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length === 0 ? (
          <span className="rounded-full bg-muted/60 px-3 py-1.5 text-sm text-muted-foreground">No items</span>
        ) : (
          items.map((item) => (
            <span key={item} className={`rounded-full px-3 py-1.5 text-sm ${toneClass(tone)}`}>
              {item}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function ProgressRing({ label, progress, children }: { label: string; progress: number; children: ReactNode }) {
  const normalized = Math.max(0, Math.min(progress, 100))
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - normalized / 100)
  const vb = 88
  const c = vb / 2
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative h-[7.5rem] w-[7.5rem] shrink-0">
        <svg viewBox={`0 0 ${vb} ${vb}`} className="h-full w-full -rotate-90">
          <circle cx={c} cy={c} r={radius} fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="5" />
          <circle
            cx={c}
            cy={c}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="text-primary"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center px-1 text-center">{children}</div>
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{Math.round(normalized)}% of target</p>
    </div>
  )
}

function InlineActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50" onClick={onClick}>
      {children}
    </button>
  )
}

function TrendBadge({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <span className="text-emerald-700 dark:text-emerald-300">Up</span>
  if (trend === 'down') return <span className="text-destructive">Down</span>
  return <span>Flat</span>
}

function CompactActivityRow({
  item,
  onOpen,
  onEdit,
}: {
  item: TimelineItem
  onOpen: (item: TimelineItem) => void
  onEdit: (item: TimelineItem) => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-primary">{item.title}</span>
            <span className="text-xs text-muted-foreground">{formatAdminDate(item.dateIso)}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-foreground">{item.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <InlineActionButton onClick={() => onOpen(item)}>View</InlineActionButton>
          <InlineActionButton onClick={() => onEdit(item)}>Open</InlineActionButton>
        </div>
      </div>
    </div>
  )
}

function GoalDrillIn({
  goal,
  data,
  healthRows,
  educationRows,
  visitRows,
  incidentRows,
  relatedPlan,
  onReload,
  onAddHealth,
  onAddEducation,
  onLogIncident,
  onOpenHealth,
  onOpenEducation,
  onOpenIncident,
  onOpenVisit,
}: {
  goal: GoalKey
  data: GoalCardData
  healthRows: HealthRecord[]
  educationRows: EducationRecord[]
  visitRows: HomeVisitation[]
  incidentRows: JsonTableRow[]
  relatedPlan: InterventionPlan | null
  onReload: () => Promise<void>
  onAddHealth: () => void
  onAddEducation: () => void
  onLogIncident: () => void
  onOpenHealth: (id: number) => void
  onOpenEducation: (id: number) => void
  onOpenIncident: (row: JsonTableRow) => void
  onOpenVisit: (row: HomeVisitation) => void
}) {
  if (goal === 'health') {
    return (
      <HealthGoalDrillIn
        data={data}
        healthRows={healthRows}
        relatedPlan={relatedPlan}
        onReload={onReload}
        onAddHealth={onAddHealth}
        onOpenHealth={onOpenHealth}
      />
    )
  }

  if (goal === 'education') {
    return (
      <EducationGoalDrillIn
        educationRows={educationRows}
        relatedPlan={relatedPlan}
        onAddEducation={onAddEducation}
        onOpenEducation={onOpenEducation}
      />
    )
  }

  if (goal === 'safety') {
    return (
      <SafetyGoalDrillIn
        visitRows={visitRows}
        incidentRows={incidentRows}
        relatedPlan={relatedPlan}
        onLogIncident={onLogIncident}
        onOpenIncident={onOpenIncident}
        onOpenVisit={onOpenVisit}
      />
    )
  }

  const rows =
    [
            ...incidentRows.slice(0, 3).map((row) => ({
              key: `i-${row.id}`,
              title: row.fields.incident_type || 'Incident',
              body: row.fields.description || 'No description',
              meta: row.fields.incident_date ? formatAdminDate(row.fields.incident_date) : 'No date',
              onOpen: () => onOpenIncident(row),
            })),
            ...visitRows
              .filter((row) => row.safetyConcernsNoted || row.followUpNeeded)
              .slice(0, 2)
              .map((row) => ({
                key: `v-${row.id}`,
                title: `Visit · ${formatAdminDate(row.visitDate)}`,
                body: row.followUpNotes || row.observations || 'Safety-related visit',
                meta: row.followUpNeeded ? 'Follow-up needed' : 'Safety concern',
                onOpen: () => onOpenVisit(row),
              })),
          ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <FocusCell label="Target" value={data.targetLabel} />
        <FocusCell label="Current" value={data.currentLabel} />
        <FocusCell label="Progress" value={`${Math.round(percentage(data.current, data.target))}%`} />
      </div>
      <p className="text-sm text-muted-foreground">{data.detail}</p>
      {relatedPlan ? (
        <div className="rounded-xl bg-muted/20 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge>{relatedPlan.planCategory}</CategoryBadge>
            <StatusBadge status={relatedPlan.status} />
          </div>
          <p className="mt-2 text-sm text-foreground">{relatedPlan.planDescription}</p>
          {relatedPlan.targetDate ? <p className="mt-1 text-xs text-muted-foreground">Target {formatAdminDate(relatedPlan.targetDate)}</p> : null}
        </div>
      ) : null}
      <div className="space-y-2">
        {rows.length === 0 ? (
          <EmptyState title="No related records yet" />
        ) : (
          rows.map((row) => (
            <button key={row.key} type="button" onClick={row.onOpen} className="w-full rounded-xl border border-border/70 bg-background px-4 py-3 text-left hover:bg-muted/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{row.title}</span>
                <span className="text-xs text-muted-foreground">{row.meta}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.body}</p>
            </button>
          ))
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {goal === 'safety' ? <InlineActionButton onClick={onLogIncident}>Log incident</InlineActionButton> : null}
      </div>
    </div>
  )
}

function stripHealthStatusPrefix(text: string): string {
  return text.replace(/^\s*health\s*status\s*:\s*/i, '').trim()
}

function healthStatusCategory(notes: string | null | undefined): 'stable' | 'improving' | 'declining' | 'unknown' {
  const t = stripHealthStatusPrefix(notes ?? '').toLowerCase()
  if (/\bimproving\b/.test(t)) return 'improving'
  if (/\bdeclining\b/.test(t)) return 'declining'
  if (/\bstable\b/.test(t)) return 'stable'
  return 'unknown'
}

function appointmentStatusChipText(notes: string | null | undefined): string {
  const raw = stripHealthStatusPrefix((notes ?? '').trim())
  if (!raw) return 'No status'
  const firstLine = raw.split('\n')[0]?.trim() ?? ''
  return firstLine.length > 42 ? `${firstLine.slice(0, 42)}…` : firstLine
}

function appointmentStatusChipClass(category: ReturnType<typeof healthStatusCategory>): string {
  if (category === 'improving') return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
  if (category === 'declining') return 'bg-destructive/15 text-destructive'
  return 'bg-amber-500/15 text-amber-950 dark:text-amber-100'
}

function RecapScoreCell({ label, valueNum }: { label: string; valueNum: number | null }) {
  const tone =
    valueNum == null || !Number.isFinite(valueNum) ? 'neutral' : valueNum < 3 ? 'low' : valueNum > 4.2 ? 'high' : 'mid'
  return (
    <div className="rounded-lg border border-border/70 bg-background px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        {tone === 'low' ? <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" title="Below 3" /> : null}
        {tone === 'high' ? <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" title="Above 4.2" /> : null}
      </div>
      <p
        className={`mt-1 text-sm font-medium tabular-nums ${
          tone === 'low'
            ? 'text-destructive'
            : tone === 'high'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-foreground'
        }`}
      >
        {valueNum != null && Number.isFinite(valueNum) ? valueNum.toFixed(1) : '—'}
      </p>
    </div>
  )
}

function HealthGoalDrillIn({
  data,
  healthRows,
  relatedPlan,
  onReload,
  onAddHealth,
  onOpenHealth,
}: {
  data: GoalCardData
  healthRows: HealthRecord[]
  relatedPlan: InterventionPlan | null
  onReload: () => Promise<void>
  onAddHealth: () => void
  onOpenHealth: (id: number) => void
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [apptSearch, setApptSearch] = useState('')
  const [apptFilter, setApptFilter] = useState<'all' | 'stable' | 'improving' | 'declining'>('all')
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesErr, setNotesErr] = useState<string | null>(null)
  const [deleteHealthId, setDeleteHealthId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sortedRows = useMemo(() => byNewestDate(healthRows, (row) => row.recordDate), [healthRows])
  const latest = sortedRows[0] ?? null

  const chronological = useMemo(
    () => [...healthRows].sort((a, b) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime()),
    [healthRows],
  )

  const chartPack = useMemo(() => {
    if (chronological.length === 0) return null
    const labels = chronological.map((row) =>
      new Date(row.recordDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    )
    return {
      labels,
      series: [
        {
          key: 'gen',
          name: 'General health',
          strokeClass: 'stroke-primary',
          fillClass: 'fill-primary',
          legendClass: 'bg-primary',
          values: chronological.map((r) => r.healthScore),
        },
        {
          key: 'nut',
          name: 'Nutrition',
          strokeClass: 'stroke-amber-600',
          fillClass: 'fill-amber-600',
          legendClass: 'bg-amber-600',
          values: chronological.map((r) => r.nutritionScore),
        },
        {
          key: 'slp',
          name: 'Sleep quality',
          strokeClass: 'stroke-sky-600',
          fillClass: 'fill-sky-600',
          legendClass: 'bg-sky-600',
          values: chronological.map((r) => r.sleepQualityScore),
        },
        {
          key: 'en',
          name: 'Energy level',
          strokeClass: 'stroke-violet-600',
          fillClass: 'fill-violet-600',
          legendClass: 'bg-violet-600',
          values: chronological.map((r) => r.energyLevelScore),
        },
      ],
    }
  }, [chronological])

  const hasAnyChartPoint = useMemo(
    () =>
      chartPack?.series.some((s) => s.values.some((v) => v != null && Number.isFinite(v))) ?? false,
    [chartPack],
  )

  const latestDental = useMemo(
    () => sortedRows.find((r) => r.dentalCheckupDone === true) ?? null,
    [sortedRows],
  )
  const latestMedical = useMemo(
    () => sortedRows.find((r) => r.medicalCheckupDone === true) ?? null,
    [sortedRows],
  )
  const latestPsych = useMemo(
    () => sortedRows.find((r) => r.psychologicalCheckupDone === true) ?? null,
    [sortedRows],
  )

  const appointmentRowsFiltered = useMemo(() => {
    let list = sortedRows
    if (apptSearch.trim()) {
      const s = apptSearch.trim().toLowerCase()
      list = list.filter(
        (r) =>
          (r.notes ?? '').toLowerCase().includes(s) ||
          formatAdminDate(r.recordDate).toLowerCase().includes(s),
      )
    }
    if (apptFilter !== 'all') {
      list = list.filter((r) => {
        const c = healthStatusCategory(r.notes)
        if (apptFilter === 'stable') return c === 'stable' || c === 'unknown'
        return c === apptFilter
      })
    }
    if (selectedId != null && !list.some((r) => r.id === selectedId)) {
      const sel = sortedRows.find((r) => r.id === selectedId)
      if (sel) list = [sel, ...list]
    }
    return list
  }, [sortedRows, apptSearch, apptFilter, selectedId])

  useEffect(() => {
    if (selectedId == null) {
      setNotesDraft('')
      return
    }
    const r = sortedRows.find((x) => x.id === selectedId)
    setNotesDraft(r?.notes ?? '')
    setNotesErr(null)
  }, [selectedId, sortedRows])

  async function saveNotesForRow(id: number) {
    setNotesErr(null)
    setSavingNotes(true)
    try {
      await patchHealthRecord(id, { notes: notesDraft.trim() })
      await onReload()
    } catch (e) {
      setNotesErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingNotes(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-xl border border-border bg-background px-4 py-4">
          <p className="text-sm font-semibold text-foreground">Health</p>
          {chartPack && hasAnyChartPoint ? (
            <div className="mt-4">
              <SimpleMultiLineChart
                labels={chartPack.labels}
                series={chartPack.series}
                formatY={(n) => n.toFixed(1)}
                height={240}
                yMin={1}
                yMax={5}
                ariaLabel="Wellbeing scores over time"
              />
            </div>
          ) : (
            <EmptyState title="No wellbeing scores yet" />
          )}
        </div>

        <div className="rounded-xl border border-border bg-muted/20 px-4 py-4">
          <p className="text-sm font-semibold text-foreground">Latest recap</p>
          {latest ? (
            <div className="mt-3 space-y-3 text-sm">
              <p className="font-medium text-foreground">{formatAdminDate(latest.recordDate)}</p>
              <p className="text-muted-foreground">Overall score {data.currentLabel}</p>
              <div className="grid grid-cols-2 gap-2">
                <RecapScoreCell label="General health" valueNum={latest.healthScore} />
                <RecapScoreCell label="Nutrition score" valueNum={latest.nutritionScore} />
                <RecapScoreCell label="Sleep quality" valueNum={latest.sleepQualityScore} />
                <RecapScoreCell label="Energy level" valueNum={latest.energyLevelScore} />
              </div>
              <div className="grid gap-2 border-t border-border/60 pt-3">
                <MiniMetric label="Weight" value={latest.weightKg != null ? `${latest.weightKg} kg` : '—'} />
                <MiniMetric label="Height" value={latest.heightCm != null ? `${latest.heightCm} cm` : '—'} />
                <MiniMetric label="BMI" value={latest.bmi != null ? latest.bmi.toFixed(1) : '—'} />
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No health record yet.</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest dental</p>
          {latestDental ? (
            <p className="mt-2 text-sm font-medium text-foreground">{formatAdminDate(latestDental.recordDate)}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No checkup flagged yet</p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest medical</p>
          {latestMedical ? (
            <p className="mt-2 text-sm font-medium text-foreground">{formatAdminDate(latestMedical.recordDate)}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No checkup flagged yet</p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest psychological</p>
          {latestPsych ? (
            <p className="mt-2 text-sm font-medium text-foreground">{formatAdminDate(latestPsych.recordDate)}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No checkup flagged yet</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1">
            <label className={label} htmlFor="appt-notes-search">
              Search
            </label>
            <input
              id="appt-notes-search"
              type="search"
              className={input}
              value={apptSearch}
              onChange={(e) => setApptSearch(e.target.value)}
              placeholder="Notes or date…"
            />
          </div>
          <label className={label}>
            Filter
            <select
              className={input}
              value={apptFilter}
              onChange={(e) => setApptFilter(e.target.value as typeof apptFilter)}
            >
              <option value="all">All</option>
              <option value="stable">Stable / other</option>
              <option value="improving">Improving</option>
              <option value="declining">Declining</option>
            </select>
          </label>
          <InlineActionButton onClick={onAddHealth}>Add</InlineActionButton>
        </div>

        <p className="text-sm font-semibold text-foreground">Appointment notes</p>

        {relatedPlan ? (
          <div className="rounded-xl bg-muted/20 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge>{relatedPlan.planCategory}</CategoryBadge>
              <StatusBadge status={relatedPlan.status} />
            </div>
            <p className="mt-2 text-sm text-foreground">{relatedPlan.planDescription}</p>
          </div>
        ) : null}

        {notesErr ? <div className={alertError}>{notesErr}</div> : null}

        {sortedRows.length === 0 ? (
          <EmptyState title="No appointments yet" />
        ) : (
          appointmentRowsFiltered.map((row) => {
            const cat = healthStatusCategory(row.notes)
            return (
              <div
                key={row.id}
                className={`w-full rounded-xl border bg-card px-4 py-3 ${selectedId === row.id ? 'border-primary' : 'border-border'}`}
              >
                <button
                  type="button"
                  className="w-full text-left hover:opacity-95"
                  onClick={() => setSelectedId((value) => (value === row.id ? null : row.id))}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{formatAdminDate(row.recordDate)}</span>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        Score {row.healthScore != null ? row.healthScore.toFixed(1) : '—'}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${appointmentStatusChipClass(cat)}`}
                      >
                        {appointmentStatusChipText(row.notes)}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">{selectedId === row.id ? 'Hide' : 'Open'}</span>
                  </div>
                </button>
                {selectedId === row.id ? (
                  <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <MiniMetric label="Nutrition" value={row.nutritionScore != null ? row.nutritionScore.toFixed(1) : '—'} />
                      <MiniMetric label="Sleep" value={row.sleepQualityScore != null ? row.sleepQualityScore.toFixed(1) : '—'} />
                      <MiniMetric label="Energy" value={row.energyLevelScore != null ? row.energyLevelScore.toFixed(1) : '—'} />
                      <MiniMetric label="BMI" value={row.bmi != null ? row.bmi.toFixed(1) : '—'} />
                      <MiniMetric label="Dental" value={row.dentalCheckupDone ? 'Done' : '—'} />
                      <MiniMetric label="Medical" value={row.medicalCheckupDone ? 'Done' : '—'} />
                      <MiniMetric label="Psych" value={row.psychologicalCheckupDone ? 'Done' : '—'} />
                    </div>
                    <div>
                      <label className={label}>
                        Notes
                        <textarea
                          className={input}
                          rows={5}
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={savingNotes}
                          onClick={() => void saveNotesForRow(row.id)}
                        >
                          {savingNotes ? 'Saving…' : 'Save notes'}
                        </button>
                        <InlineActionButton onClick={() => onOpenHealth(row.id)}>Full record</InlineActionButton>
                        <button
                          type="button"
                          className="rounded-lg border border-destructive/50 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteHealthId(row.id)}
                        >
                          Delete…
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      <AdminDeleteModal
        open={deleteHealthId != null}
        title="Delete this health record?"
        body="This removes the wellbeing row from health_wellbeing_records. This cannot be undone."
        loading={deleting}
        onCancel={() => setDeleteHealthId(null)}
        onConfirm={async () => {
          if (deleteHealthId == null) return
          setDeleting(true)
          try {
            await deleteHealthRecord(deleteHealthId)
            setDeleteHealthId(null)
            setSelectedId(null)
            await onReload()
          } catch (e) {
            setNotesErr(e instanceof Error ? e.message : 'Delete failed')
          } finally {
            setDeleting(false)
          }
        }}
      />
    </div>
  )
}

function EducationGoalDrillIn({
  educationRows,
  relatedPlan,
  onAddEducation,
  onOpenEducation,
}: {
  educationRows: EducationRecord[]
  relatedPlan: InterventionPlan | null
  onAddEducation: () => void
  onOpenEducation: (id: number) => void
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const sortedRows = byNewestDate(educationRows, (row) => row.recordDate)
  const latest = sortedRows[0] ?? null
  const distinctCourses = new Set(
    sortedRows
      .map((row) => {
        const ext = parseEducationExtendedLite(row.extendedJson)
        return ext.courseName || row.schoolName || ''
      })
      .filter(Boolean),
  ).size
  const latestProgress = latest?.progressPercent ?? null
  const latestAttendance = latest?.attendanceRate ?? null

  const chartPoints = sortedRows
    .slice()
    .reverse()
    .filter((row) => row.attendanceRate != null)
    .map((row) => ({
      label: new Date(row.recordDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: (row.attendanceRate ?? 0) * 100,
    }))

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-background px-4 py-4">
        <p className="text-sm font-semibold text-foreground">Education</p>
        {chartPoints.length > 0 ? (
          <div className="mt-4">
            <SimpleLineChart
              points={chartPoints}
              formatY={(n) => `${Math.round(n)}%`}
              height={220}
              ariaLabel="Attendance trend"
            />
          </div>
        ) : (
          <EmptyState title="No attendance data yet" />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MiniMetric label="Total courses" value={String(distinctCourses || sortedRows.length || 0)} />
        <MiniMetric label="Progress" value={latestProgress != null ? `${latestProgress}%` : '—'} />
        <MiniMetric label="Attendance" value={latestAttendance != null ? `${Math.round(latestAttendance * 100)}%` : '—'} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">Records</p>
          <div className="flex flex-wrap gap-2">
            <InlineActionButton onClick={onAddEducation}>Add education record</InlineActionButton>
          </div>
        </div>
        {relatedPlan ? (
          <div className="rounded-xl bg-muted/20 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge>{relatedPlan.planCategory}</CategoryBadge>
              <StatusBadge status={relatedPlan.status} />
            </div>
            <p className="mt-2 text-sm text-foreground">{relatedPlan.planDescription}</p>
          </div>
        ) : null}
        {sortedRows.length === 0 ? (
          <EmptyState title="No education records yet" />
        ) : (
          sortedRows.map((row) => {
            const ext = parseEducationExtendedLite(row.extendedJson)
            const status = ext.attendanceStatus || row.enrollmentStatus || row.completionStatus || 'No status'
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId((value) => (value === row.id ? null : row.id))}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left hover:bg-muted/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{formatAdminDate(row.recordDate)}</span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      Attend {row.attendanceRate != null ? `${Math.round(row.attendanceRate * 100)}%` : '—'}
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      Progress {row.progressPercent != null ? `${Math.round(row.progressPercent)}%` : '—'}
                    </span>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{status}</span>
                </div>
                {selectedId === row.id ? (
                  <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <MiniMetric label="School" value={row.schoolName || '—'} />
                      <MiniMetric label="Level" value={row.educationLevel || '—'} />
                      <MiniMetric label="Program" value={ext.programName || '—'} />
                      <MiniMetric label="Course" value={ext.courseName || '—'} />
                      <MiniMetric label="Enrollment" value={row.enrollmentStatus || '—'} />
                      <MiniMetric label="Completion" value={row.completionStatus || '—'} />
                    </div>
                    <div className="rounded-lg bg-muted/20 px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{status}</span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{row.notes || 'No notes recorded.'}</p>
                      <div className="mt-4">
                        <InlineActionButton onClick={() => onOpenEducation(row.id)}>Open full record</InlineActionButton>
                      </div>
                    </div>
                  </div>
                ) : null}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function SafetyGoalDrillIn({
  visitRows,
  incidentRows,
  relatedPlan,
  onLogIncident,
  onOpenIncident,
  onOpenVisit,
}: {
  visitRows: HomeVisitation[]
  incidentRows: JsonTableRow[]
  relatedPlan: InterventionPlan | null
  onLogIncident: () => void
  onOpenIncident: (row: JsonTableRow) => void
  onOpenVisit: (row: HomeVisitation) => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'visit' | 'incident'>('all')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const latestVisit = byNewestDate(visitRows, (row) => row.visitDate)[0] ?? null

  const safetyRecords = useMemo(() => {
    const visitItems = visitRows
      .filter((row) => row.safetyConcernsNoted || row.followUpNeeded)
      .map((row) => ({
        key: `visit-${row.id}`,
        type: 'visit' as const,
        sort: new Date(row.visitDate).getTime(),
        date: row.visitDate,
        location: row.locationVisited || '—',
        chip: row.visitType || 'Visit',
        detail: {
          type: row.visitType || 'Visit',
          location: row.locationVisited || '—',
          status: row.safetyConcernsNoted ? 'Safety concern' : row.followUpNeeded ? 'Follow-up needed' : 'Stable',
          outcome: row.visitOutcome || '—',
          notes: row.followUpNotes || row.observations || row.purpose || 'No notes recorded.',
          worker: row.socialWorker,
        },
        onOpen: () => onOpenVisit(row),
      }))

    const incidentItems = incidentRows.map((row) => ({
      key: `incident-${row.id}`,
      type: 'incident' as const,
      sort: new Date(row.fields.incident_date ?? '').getTime(),
      date: row.fields.incident_date ?? '',
      location: row.fields.safehouse_id ? `Safehouse ${row.fields.safehouse_id}` : '—',
      chip: row.fields.incident_type || 'Incident',
      detail: {
        type: row.fields.incident_type || 'Incident',
        location: row.fields.safehouse_id ? `Safehouse ${row.fields.safehouse_id}` : '—',
        status: (row.fields.resolved ?? '').toLowerCase() === 'true' ? 'Resolved' : 'Open',
        outcome: row.fields.response_taken || row.fields.severity || '—',
        notes: row.fields.description || 'No notes recorded.',
        worker: row.fields.reported_by || '—',
      },
      onOpen: () => onOpenIncident(row),
    }))

    return [...visitItems, ...incidentItems]
      .sort((a, b) => b.sort - a.sort)
      .filter((row) => (filter === 'all' ? true : row.type === filter))
      .filter((row) => {
        const q = search.trim().toLowerCase()
        if (!q) return true
        return `${row.location} ${row.chip} ${row.detail.notes} ${row.detail.status}`.toLowerCase().includes(q)
      })
  }, [filter, incidentRows, onOpenIncident, onOpenVisit, search, visitRows])

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-background px-4 py-4">
        <p className="text-sm font-semibold text-foreground">Safety</p>
        {latestVisit ? (
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_0.8fr_1fr_1fr]">
            <MiniMetric label="Date" value={formatAdminDate(latestVisit.visitDate)} />
            <MiniMetric label="Location" value={latestVisit.locationVisited || '—'} />
            <MiniMetric label="Type" value={latestVisit.visitType || '—'} />
            <MiniMetric label="Safety concerns" value={latestVisit.safetyConcernsNoted ? 'Yes' : 'No'} />
            <MiniMetric label="Outcome" value={latestVisit.visitOutcome || '—'} />
          </div>
        ) : (
          <EmptyState title="No recent safety visit" />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">Records</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
            />
            <select
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'visit' | 'incident')}
            >
              <option value="all">All</option>
              <option value="visit">Visits</option>
              <option value="incident">Incidents</option>
            </select>
            <InlineActionButton onClick={onLogIncident}>Add</InlineActionButton>
          </div>
        </div>
        {relatedPlan ? (
          <div className="rounded-xl bg-muted/20 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge>{relatedPlan.planCategory}</CategoryBadge>
              <StatusBadge status={relatedPlan.status} />
            </div>
            <p className="mt-2 text-sm text-foreground">{relatedPlan.planDescription}</p>
          </div>
        ) : null}
        {safetyRecords.length === 0 ? (
          <EmptyState title="No safety records yet" />
        ) : (
          safetyRecords.map((row) => (
            <button
              key={row.key}
              type="button"
              onClick={() => setExpandedKey((value) => (value === row.key ? null : row.key))}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left hover:bg-muted/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
                    {formatAdminDate(row.date)}
                    {row.location !== '—' ? ` · ${row.location}` : ''}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{row.chip}</span>
                  {row.detail.outcome !== '—' ? (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{row.detail.outcome}</span>
                  ) : null}
                </div>
                <span className="text-sm text-muted-foreground">{expandedKey === row.key ? 'Hide' : 'Open'}</span>
              </div>
              {expandedKey === row.key ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <MiniMetric label="Date" value={formatAdminDate(row.date)} />
                    <MiniMetric label="Location" value={row.detail.location} />
                    <MiniMetric label="Type" value={row.detail.type} />
                    <MiniMetric label="Status" value={row.detail.status} />
                    <MiniMetric label="Outcome" value={row.detail.outcome} />
                    <MiniMetric label="Worker" value={row.detail.worker} />
                  </div>
                  <div className="rounded-lg bg-muted/20 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Details</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{row.detail.notes}</p>
                    <div className="mt-4">
                      <InlineActionButton onClick={row.onOpen}>Open full record</InlineActionButton>
                    </div>
                  </div>
                </div>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function TimelineRow({
  item,
  onOpen,
  onEdit,
  onDelete,
}: {
  item: TimelineItem
  onOpen: (item: TimelineItem) => void
  onEdit: (item: TimelineItem) => void
  onDelete: (item: TimelineItem) => void
}) {
  const canDelete = item.ref.kind === 'process' || item.ref.kind === 'visit' || item.ref.kind === 'incident'
  const editLabel = item.ref.kind === 'education' || item.ref.kind === 'health' || item.ref.kind === 'plan' ? 'Open' : 'Edit'
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-primary">{item.title}</span>
            <span className="text-sm text-muted-foreground">{formatAdminDate(item.dateIso)}</span>
            {item.worker ? <span className="text-sm text-muted-foreground">· {item.worker}</span> : null}
          </div>
          <p className="mt-2 text-sm text-foreground">{item.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {item.flags.map((flag) => (
              <span key={flag.label} className={`rounded-full px-2 py-1 text-xs font-medium ${toneClass(flag.tone)}`}>
                {flag.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <InlineActionButton onClick={() => onOpen(item)}>View</InlineActionButton>
          <InlineActionButton onClick={() => onEdit(item)}>{editLabel}</InlineActionButton>
          {canDelete ? <InlineActionButton onClick={() => onDelete(item)}>Delete</InlineActionButton> : null}
        </div>
      </div>
    </div>
  )
}

function SafetyBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function SafetyRow({
  title,
  subtitle,
  meta,
  onView,
  onEdit,
  onDelete,
}: {
  title: string
  subtitle: string
  meta: string[]
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.filter(Boolean).map((item) => (
              <span key={item} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <InlineActionButton onClick={onView}>View</InlineActionButton>
          <InlineActionButton onClick={onEdit}>Edit</InlineActionButton>
          <InlineActionButton onClick={onDelete}>Delete</InlineActionButton>
        </div>
      </div>
    </div>
  )
}

function ProfileSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-5 py-4 text-left">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? <div className="border-t border-border px-5 py-4">{children}</div> : null}
    </div>
  )
}

function ProfileGrid({ rows }: { rows: [string, string][] }) {
  const filtered = rows.filter(([, value]) => value)
  if (filtered.length === 0) {
    return <p className="text-sm text-muted-foreground">No fields in this section yet.</p>
  }
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {filtered.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{key}</dt>
          <dd className="mt-1 text-sm text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function IncidentDrawer({
  mode,
  residentId,
  safehouseId,
  initial,
  error,
  onError,
  onClose,
  onSaved,
  onEdit,
  onDeleteRequest,
}: {
  mode: 'view' | 'edit' | 'create'
  residentId: number
  safehouseId: number
  initial: JsonTableRow | null
  error: string | null
  onError: (value: string | null) => void
  onClose: () => void
  onSaved: () => Promise<void>
  onEdit: () => void
  onDeleteRequest: (id: number) => void
}) {
  const [saving, setSaving] = useState(false)
  const [incidentDate, setIncidentDate] = useState(initial?.fields.incident_date ?? new Date().toISOString().slice(0, 10))
  const [incidentType, setIncidentType] = useState(initial?.fields.incident_type ?? 'Medical')
  const [severity, setSeverity] = useState(initial?.fields.severity ?? 'Medium')
  const [description, setDescription] = useState(initial?.fields.description ?? '')
  const [responseTaken, setResponseTaken] = useState(initial?.fields.response_taken ?? '')
  const [reportedBy, setReportedBy] = useState(initial?.fields.reported_by ?? '')
  const [resolved, setResolved] = useState((initial?.fields.resolved ?? '').toLowerCase() === 'true')
  const [followUpRequired, setFollowUpRequired] = useState((initial?.fields.follow_up_required ?? '').toLowerCase() === 'true')
  const [resolutionDate, setResolutionDate] = useState(initial?.fields.resolution_date ?? '')
  const readOnly = mode === 'view'

  async function submit(e: FormEvent) {
    e.preventDefault()
    onError(null)
    setSaving(true)
    try {
      const payload = {
        safehouse_id: safehouseId > 0 ? String(safehouseId) : '',
        incident_date: incidentDate,
        incident_type: incidentType,
        severity,
        description,
        response_taken: responseTaken,
        reported_by: reportedBy,
        resolved: resolved ? 'true' : 'false',
        follow_up_required: followUpRequired ? 'true' : 'false',
        resolution_date: resolved ? resolutionDate || incidentDate : '',
      }
      if (mode === 'create') {
        await createIncidentReport(residentId, payload)
      } else if (initial && mode === 'edit') {
        await patchIncidentReport(initial.id, payload)
      }
      await onSaved()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save incident')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CaseDrawer
      title={mode === 'create' ? 'Add incident' : 'Incident'}
      onClose={onClose}
      footer={
        readOnly && initial ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              className="rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              onClick={() => onDeleteRequest(initial.id)}
            >
              Delete
            </button>
          </div>
        ) : null
      }
    >
      {error ? <div className={alertError}>{error}</div> : null}
      {readOnly && initial ? (
        <div className="space-y-3 text-sm">
          <p className="font-medium text-foreground">{initial.fields.incident_type || 'Incident'}</p>
          <p className="text-muted-foreground">{initial.fields.incident_date ? formatAdminDate(initial.fields.incident_date) : 'No date'}</p>
          <div className="flex flex-wrap gap-2">
            {initial.fields.severity ? <CategoryBadge>{initial.fields.severity}</CategoryBadge> : null}
            <BooleanBadge value={(initial.fields.resolved ?? '').toLowerCase() === 'true'} trueLabel="Resolved" falseLabel="Open" trueVariant="success" />
            {(initial.fields.follow_up_required ?? '').toLowerCase() === 'true' ? <BooleanBadge value={true} trueLabel="Follow-up required" trueVariant="warning" /> : null}
          </div>
          {initial.fields.description ? <p className="whitespace-pre-wrap text-foreground">{initial.fields.description}</p> : null}
          {initial.fields.response_taken ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Response</p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{initial.fields.response_taken}</p>
            </div>
          ) : null}
          {initial.fields.reported_by ? <p className="text-muted-foreground">Reported by {initial.fields.reported_by}</p> : null}
        </div>
      ) : (
        <form className="space-y-3" onSubmit={submit}>
          <label className={label}>
            Incident date
            <input type="date" className={input} value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} required />
          </label>
          <label className={label}>
            Incident type
            <select className={input} value={incidentType} onChange={(e) => setIncidentType(e.target.value)}>
              {['Medical', 'Security', 'Behavioral', 'SelfHarm', 'RunawayAttempt', 'ConflictWithPeer', 'PropertyDamage', 'Other'].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Severity
            <select className={input} value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {['Low', 'Medium', 'High'].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Description
            <textarea className={input} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className={label}>
            Response taken
            <textarea className={input} rows={3} value={responseTaken} onChange={(e) => setResponseTaken(e.target.value)} />
          </label>
          <label className={label}>
            Reported by
            <input className={input} value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} />
          </label>
          <ToggleField labelText="Resolved" value={resolved} onChange={setResolved} />
          {resolved ? (
            <label className={label}>
              Resolution date
              <input type="date" className={input} value={resolutionDate} onChange={(e) => setResolutionDate(e.target.value)} />
            </label>
          ) : null}
          <ToggleField labelText="Follow-up required" value={followUpRequired} onChange={setFollowUpRequired} />
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : mode === 'create' ? 'Save incident' : 'Save changes'}
            </button>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </CaseDrawer>
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
  setSaving: (value: boolean) => void
  onError: (value: string | null) => void
}) {
  const [caseStatus, setCaseStatus] = useState(gf(fields, 'case_status', 'caseStatus'))
  const [riskLevel, setRiskLevel] = useState(gf(fields, 'current_risk_level', 'currentRiskLevel'))
  const [reintegrationStatus, setReintegrationStatus] = useState(gf(fields, 'reintegration_status', 'reintegrationStatus'))
  const [reintegrationType, setReintegrationType] = useState(gf(fields, 'reintegration_type', 'reintegrationType'))
  const [assignedWorker, setAssignedWorker] = useState(gf(fields, 'assigned_social_worker', 'assignedSocialWorker'))
  const [presentAge, setPresentAge] = useState(gf(fields, 'present_age', 'presentAge'))
  const [sex, setSex] = useState(gf(fields, 'sex'))
  const [safehouseId, setSafehouseId] = useState(gf(fields, 'safehouse_id', 'safehouseId'))
  const [admissionDate, setAdmissionDate] = useState(gf(fields, 'date_of_admission', 'dateOfAdmission'))

  async function submit(e: FormEvent) {
    e.preventDefault()
    onError(null)
    setSaving(true)
    try {
      await patchResident(residentId, {
        case_status: caseStatus,
        current_risk_level: riskLevel,
        reintegration_status: reintegrationStatus,
        reintegration_type: reintegrationType,
        assigned_social_worker: assignedWorker,
        present_age: presentAge || null,
        sex,
        safehouse_id: safehouseId || null,
        date_of_admission: admissionDate || null,
      })
      await onSaved()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CaseDrawer title="Edit profile" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <label className={label}>
          Case status
          <select className={input} value={caseStatus} onChange={(e) => setCaseStatus(e.target.value)}>
            <option value="">—</option>
            {CASE_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Risk level
          <select className={input} value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
            <option value="">—</option>
            {RISK_LEVELS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Reintegration status
          <input className={input} value={reintegrationStatus} onChange={(e) => setReintegrationStatus(e.target.value)} />
        </label>
        <label className={label}>
          Reintegration type
          <input className={input} value={reintegrationType} onChange={(e) => setReintegrationType(e.target.value)} />
        </label>
        <label className={label}>
          Assigned social worker
          <input className={input} value={assignedWorker} onChange={(e) => setAssignedWorker(e.target.value)} />
        </label>
        <label className={label}>
          Present age
          <input className={input} inputMode="numeric" value={presentAge} onChange={(e) => setPresentAge(e.target.value)} />
        </label>
        <label className={label}>
          Sex
          <select className={input} value={sex} onChange={(e) => setSex(e.target.value)}>
            <option value="">—</option>
            {SEX_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Safehouse
          <select className={input} value={safehouseId} onChange={(e) => setSafehouseId(e.target.value)}>
            <option value="">—</option>
            {safehouses.map((option) => (
              <option key={option.id} value={String(option.id)}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Admission date
          <input type="date" className={input} value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </CaseDrawer>
  )
}
