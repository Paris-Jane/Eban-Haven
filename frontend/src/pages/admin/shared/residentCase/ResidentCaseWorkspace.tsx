import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
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
  patchEducationRecord,
  deleteEducationRecord,
  patchHealthRecord,
  deleteHealthRecord,
  patchHomeVisitation,
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
import { alertError, btnPrimary, input, label } from '../adminStyles'
import { BooleanBadge, CategoryBadge } from '../adminDataTable/AdminBadges'
import { formatAdminDate } from '../adminDataTable/adminFormatters'
import { AdminDeleteModal } from '../adminDataTable/AdminDeleteModal'
import { CASE_STATUSES, isResidentReintegrated, RISK_LEVELS, SEX_OPTIONS } from './caseConstants'
import { SimpleMultiLineChart } from '../../dashboards/reports/ChartCard'
import { EducationSection, HealthSection, HomeVisitDrawer, ProcessRecordingDrawer } from './CareProgressContent'
import { PlansTabContent } from './PlansTabContent'
import { SessionWorkflowDrawer } from './SessionWorkflowDrawer'
import { ResidentCaseHeader } from './ResidentCaseHeader'
import {
  buildTimelineItems,
  filterTimeline,
  planIsOverdue,
  type MainWorkspaceTab,
  type TimelineItem,
  type TimelineKind,
  type WorkspaceQuickAction,
} from './caseWorkspaceModel'
import {
  ActivityActiveFilterChips,
  ActivityTabToolbar,
  ActivityTimelineRow,
  ALL_TIMELINE_KINDS,
  activityAdvFiltersAreDefault,
  draftFromApplied,
  emptyActivityAdvDraft,
  normalizeKindsForApply,
  typesFilterChipLabel,
  type ActivityFilterChip,
} from './activityTimelineUi'
import { CaseDrawer, EmptyState, SectionHeader, ToggleField } from './caseUi'
import { deriveReadinessPrediction, deriveReadinessTier } from '../../../../components/ml/reintegrationReadinessShared'
import { RESIDENT_GOAL_CHART, RESIDENT_GOAL_RING, RESIDENT_SEMANTIC } from '../residentSemanticPalette'

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
  { k: 'plans', label: 'Goals' },
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
  /** Shown under the progress ring on the Plans tab. */
  ringTitle: string
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
  if (tone === 'danger') return RESIDENT_SEMANTIC.danger.chip
  if (tone === 'warning') return RESIDENT_SEMANTIC.warning.chip
  if (tone === 'success') return RESIDENT_SEMANTIC.success.chip
  return 'border border-[#D1D5DB] bg-[#F3F4F6] text-[#4B5563]'
}

export type ResidentWorkspaceQuickAdd = 'education' | 'health' | 'incident' | 'plan'

export function ResidentCaseWorkspace({
  residentId,
  initialQuickAdd,
}: {
  residentId: number
  /** From `/admin/residents/:id?add=education` etc. Opens the matching create flow once. */
  initialQuickAdd?: ResidentWorkspaceQuickAdd | null
}) {
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
  const [sessionWorkflowOpen, setSessionWorkflowOpen] = useState(false)
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

  const [activityFilterMenuOpen, setActivityFilterMenuOpen] = useState(false)
  const [activityFilterDraft, setActivityFilterDraft] = useState(emptyActivityAdvDraft)
  const [activityAddMenuOpen, setActivityAddMenuOpen] = useState(false)

  const [createSig, setCreateSig] = useState({ education: 0, health: 0, plan: 0 })
  const [focusPlanId, setFocusPlanId] = useState<number | null>(null)
  const [expandedGoal, setExpandedGoal] = useState<GoalKey | null>(null)
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
  const caseControlNo = gf(fields, 'case_control_no', 'caseControlNo')
  const caseCategory = gf(fields, 'case_category', 'caseCategory')
  const presentAge = gf(fields, 'present_age', 'presentAge')
  const lengthOfStay = gf(fields, 'length_of_stay', 'lengthOfStay')
  const reintegrationStatusValue = gf(fields, 'reintegration_status', 'reintegrationStatus') || undefined
  const showReintegrationReadinessUi = !isResidentReintegrated(reintegrationStatusValue)

  const latestHealth = useMemo(() => byNewestDate(hl, (row) => row.recordDate)[0] ?? null, [hl])
  const previousHealth = useMemo(() => byNewestDate(hl, (row) => row.recordDate)[1] ?? null, [hl])
  const latestEducation = useMemo(() => byNewestDate(edu, (row) => row.recordDate)[0] ?? null, [edu])
  const previousEducation = useMemo(() => byNewestDate(edu, (row) => row.recordDate)[1] ?? null, [edu])
  const latestHealthPlan = useMemo(() => findLatestPlan(plans, ['health', 'physical health']), [plans])
  const latestEducationPlan = useMemo(() => findLatestPlan(plans, ['education']), [plans])
  const latestSafetyPlan = useMemo(() => findLatestPlan(plans, ['safety']), [plans])

  const safetyScore = useMemo(() => deriveSafetyScore(vis, inc), [vis, inc])
  const priorSafetyScore = useMemo(() => deriveSafetyScore(vis.slice(1), inc.slice(1)), [vis, inc])

  const goalCards = useMemo<Record<GoalKey, GoalCardData>>(
    () => ({
      health: {
        key: 'health',
        label: 'Health goal',
        ringTitle: 'Physical Health',
        target: latestHealthPlan?.targetValue ?? 4.2,
        current: latestHealth?.healthScore ?? null,
        currentLabel: scoreLabel(latestHealth?.healthScore ?? null),
        targetLabel: scoreLabel(latestHealthPlan?.targetValue ?? 4.2),
        detail: latestHealth ? `Latest wellbeing on ${formatAdminDate(latestHealth.recordDate)}` : 'No health record yet',
      },
      education: {
        key: 'education',
        label: 'Education goal',
        ringTitle: 'Education',
        target: latestEducationPlan?.targetValue ?? 0.85,
        current: latestEducation?.attendanceRate ?? null,
        currentLabel: attendanceLabel(latestEducation?.attendanceRate ?? null),
        targetLabel: attendanceLabel(latestEducationPlan?.targetValue ?? 0.85),
        detail: latestEducation ? `Latest attendance on ${formatAdminDate(latestEducation.recordDate)}` : 'No education record yet',
      },
      safety: {
        key: 'safety',
        label: 'Safety goal',
        ringTitle: 'Safety',
        target: latestSafetyPlan?.targetValue ?? 4.2,
        current: safetyScore,
        currentLabel: scoreLabel(safetyScore),
        targetLabel: scoreLabel(latestSafetyPlan?.targetValue ?? 4.2),
        detail: safetyScore != null ? 'Derived from recent incidents and safety-related home visits' : 'No recent safety activity',
      },
    }),
    [
      latestEducation,
      latestEducationPlan,
      latestHealth,
      latestHealthPlan,
      latestSafetyPlan,
      safetyScore,
    ],
  )

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

  const activityAdvAppliedSnapshot = useMemo(
    () => draftFromApplied(timelineFrom, timelineTo, timelineWorker, timelineKinds, tlFollow, tlConcerns),
    [timelineFrom, timelineTo, timelineWorker, timelineKinds, tlFollow, tlConcerns],
  )
  const activityToolbarFiltersActive = !activityAdvFiltersAreDefault(activityAdvAppliedSnapshot)

  const activityFilterChips = useMemo((): ActivityFilterChip[] => {
    const chips: ActivityFilterChip[] = []
    const q = timelineSearch.trim()
    if (q) {
      const short = q.length > 36 ? `${q.slice(0, 33)}…` : q
      chips.push({ id: 'search', label: `Search: ${short}` })
    }
    if (timelineFrom || timelineTo) {
      const fromL = timelineFrom ? formatAdminDate(timelineFrom) : '…'
      const toL = timelineTo ? formatAdminDate(timelineTo) : '…'
      chips.push({
        id: 'dates',
        label: timelineFrom && timelineTo ? `${fromL} – ${toL}` : timelineFrom ? `From ${fromL}` : `Until ${toL}`,
      })
    }
    if (timelineWorker.trim()) {
      chips.push({ id: 'worker', label: `Worker: ${timelineWorker.trim()}` })
    }
    const typeLabel = typesFilterChipLabel(timelineKinds)
    if (typeLabel) chips.push({ id: 'types', label: typeLabel })
    if (tlFollow) chips.push({ id: 'follow', label: 'Follow-up only' })
    if (tlConcerns) chips.push({ id: 'flagged', label: 'Flagged only' })
    return chips
  }, [timelineSearch, timelineFrom, timelineTo, timelineWorker, timelineKinds, tlFollow, tlConcerns])

  const openActivityFilterMenu = useCallback(() => {
    setActivityFilterDraft(draftFromApplied(timelineFrom, timelineTo, timelineWorker, timelineKinds, tlFollow, tlConcerns))
    setActivityFilterMenuOpen(true)
  }, [timelineFrom, timelineTo, timelineWorker, timelineKinds, tlFollow, tlConcerns])

  const applyActivityFilters = useCallback(() => {
    const d = activityFilterDraft
    const k = normalizeKindsForApply(d.kinds)
    setTimelineFrom(d.dateFrom)
    setTimelineTo(d.dateTo)
    setTimelineWorker(d.worker)
    setTimelineKinds(k)
    setTlFollow(d.followOnly)
    setTlConcerns(d.flaggedOnly)
    setActivityFilterMenuOpen(false)
  }, [activityFilterDraft])

  const clearActivityFilterDraft = useCallback(() => {
    setActivityFilterDraft(emptyActivityAdvDraft())
  }, [])

  const removeActivityFilterChip = useCallback((id: string) => {
    switch (id) {
      case 'search':
        setTimelineSearch('')
        break
      case 'dates':
        setTimelineFrom('')
        setTimelineTo('')
        break
      case 'worker':
        setTimelineWorker('')
        break
      case 'types':
        setTimelineKinds(new Set(ALL_TIMELINE_KINDS))
        break
      case 'follow':
        setTlFollow(false)
        break
      case 'flagged':
        setTlConcerns(false)
        break
      default:
        break
    }
  }, [])

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
        action: { kind: 'tab', tab: 'activity' },
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
          action: { kind: 'tab', tab: 'activity' },
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
    const label = percent >= 85 ? 'Ready' : percent >= 70 ? 'Approaching readiness' : percent >= 50 ? 'Needs support' : 'Not ready'
    return {
      percent,
      label,
      prediction: deriveReadinessPrediction(readiness.reintegration_probability),
      topImprovement: readiness.top_improvements[0]?.label ?? 'Maintain current support plan',
      tone: (tier === 'High Readiness' ? 'success' : tier === 'Moderate Readiness' ? 'warning' : 'danger') as
        | 'success'
        | 'warning'
        | 'danger',
    }
  }, [readiness])

  function bumpCreate(kind: (typeof ACTIVITY_TYPES)[number]['id']) {
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

  const quickAddAppliedRef = useRef(false)
  useEffect(() => {
    quickAddAppliedRef.current = false
  }, [residentId])

  useEffect(() => {
    if (!initialQuickAdd || quickAddAppliedRef.current) return
    quickAddAppliedRef.current = true
    if (initialQuickAdd === 'education') {
      setMainTab('activity')
      setCreateSig((s) => ({ ...s, education: s.education + 1 }))
      return
    }
    if (initialQuickAdd === 'health') {
      setMainTab('activity')
      setCreateSig((s) => ({ ...s, health: s.health + 1 }))
      return
    }
    if (initialQuickAdd === 'incident') {
      setIncidentDrawer({ mode: 'create', row: null })
      setMainTab('activity')
      return
    }
    if (initialQuickAdd === 'plan') {
      setMainTab('plans')
      setCreateSig((s) => ({ ...s, plan: s.plan + 1 }))
    }
  }, [initialQuickAdd, residentId])

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

  function bumpCreateFromActivityMenu(kind: (typeof ACTIVITY_TYPES)[number]['id']) {
    setActivityAddMenuOpen(false)
    bumpCreate(kind)
  }

  if (!Number.isFinite(residentId) || residentId <= 0) {
    return <p className={RESIDENT_SEMANTIC.danger.text}>Invalid resident.</p>
  }

  if (loading) return <p className="text-muted-foreground">Loading case…</p>
  if (error && !detail) {
    return (
      <div className="space-y-3">
        <p className={RESIDENT_SEMANTIC.danger.text}>{error}</p>
        <Link to="/admin/residents" className="text-sm text-primary hover:underline">
          ← Back to residents
        </Link>
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="space-y-3">
        <p className={RESIDENT_SEMANTIC.danger.text}>Resident not found.</p>
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

        <ResidentCaseHeader
          internalCode={internalCode}
          caseStatus={gf(fields, 'case_status', 'caseStatus') || undefined}
          currentRiskLevel={gf(fields, 'current_risk_level', 'currentRiskLevel') || undefined}
          reintegrationType={gf(fields, 'reintegration_type', 'reintegrationType') || undefined}
          reintegrationStatus={reintegrationStatusValue}
          safehouseName={safehouseName}
          assignedWorker={assignedWorker || undefined}
          admissionLabel={admissionDate ? formatAdminDate(admissionDate) : undefined}
          caseCategory={caseCategory || undefined}
          caseControlNo={caseControlNo || undefined}
          presentAge={presentAge || undefined}
          lengthOfStay={lengthOfStay || undefined}
          readiness={readinessSummary}
          showReintegrationPanel={showReintegrationReadinessUi}
          onOpenReadiness={() => navigate(`/admin/reintigration-readiness/${residentId}`)}
        />
      </div>

      {error ? <div className={alertError}>{error}</div> : null}

      <div className="flex border-b border-border">
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.k}
            type="button"
            onClick={() => setMainTab(tab.k)}
            className={`px-5 py-3 text-sm font-medium transition-colors sm:px-6 ${
              mainTab === tab.k
                ? 'border-b-2 border-primary text-foreground -mb-px'
                : 'border-b-2 border-transparent text-muted-foreground hover:border-border hover:text-foreground'
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
                      setMainTab('activity')
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

          {readinessSummary && showReintegrationReadinessUi ? (
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
          <ActivityTabToolbar
            search={timelineSearch}
            onSearchChange={setTimelineSearch}
            filtersOpen={activityFilterMenuOpen}
            onFiltersOpenChange={(open) => {
              if (open) openActivityFilterMenu()
              else setActivityFilterMenuOpen(false)
            }}
            filtersActive={activityToolbarFiltersActive}
            filterDraft={activityFilterDraft}
            setFilterDraft={setActivityFilterDraft}
            onApplyFilters={applyActivityFilters}
            onClearFilterDraft={clearActivityFilterDraft}
            keywordSearch={timelineSearch}
            onKeywordSearchChange={setTimelineSearch}
            addMenuOpen={activityAddMenuOpen}
            onToggleAddMenu={() => setActivityAddMenuOpen((open) => !open)}
            onAddPick={bumpCreateFromActivityMenu}
            addOptions={ACTIVITY_TYPES}
          />

          <ActivityActiveFilterChips chips={activityFilterChips} onRemove={removeActivityFilterChip} />

          <div className="space-y-2">
            {timelineFiltered.length === 0 ? (
              <EmptyState title="No activity matches these filters" />
            ) : (
              timelineFiltered.map((item) => (
                <ActivityTimelineRow
                  key={item.key}
                  item={item}
                  onOpen={onTimelineSelect}
                  onEdit={openTimelineEdit}
                  onDelete={requestDeleteFromTimeline}
                />
              ))
            )}
          </div>

          <div className="space-y-4 border-t border-border pt-8">
            <SectionHeader
              title="Education & health records"
              description="Open a row from the timeline above, or add and edit records here."
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
          </div>
        </div>
      ) : null}

      {mainTab === 'plans' ? (
        <PlansTabContent
          residentId={residentId}
          plans={plans}
          onReload={() => void load()}
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
                    <ProgressRing goalKey={goal.key} label={goal.label} progress={percentage(goal.current, goal.target)}>
                      <div className="text-xl font-semibold tabular-nums text-foreground">{goal.currentLabel}</div>
                    </ProgressRing>
                    <h3 className="mt-3 text-center text-base font-semibold text-foreground">{goal.ringTitle}</h3>
                  </button>
                ))}
              </div>

              {expandedGoal ? (
                <InlineDetailCard
                  title={`${goalCards[expandedGoal].label} details`}
                  titleClassName={
                    expandedGoal === 'safety'
                      ? 'font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl'
                      : 'font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl'
                  }
                >
                  <GoalDrillIn
                    goal={expandedGoal}
                    healthRows={hl}
                    educationRows={edu}
                    visitRows={vis}
                    incidentRows={inc}
                    relatedPlan={
                      expandedGoal === 'health'
                        ? latestHealthPlan
                        : expandedGoal === 'education'
                          ? latestEducationPlan
                          : latestSafetyPlan
                    }
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
                    onEditIncident={(row) => setIncidentDrawer({ mode: 'edit', row })}
                    onEditVisit={(row) => setVisitDrawer({ mode: 'edit', row })}
                    onRequestDeleteIncident={(id) => setDeleteIncidentId(id)}
                    onRequestDeleteVisit={(id) => setDeleteVisitId(id)}
                  />
                </InlineDetailCard>
              ) : null}
            </div>
          }
        />
      ) : null}

      {mainTab === 'profile' ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Profile</h3>
            </div>
            <button type="button" className={btnPrimary} onClick={() => setProfileOpen(true)}>
              Edit profile
            </button>
          </div>

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
      <p
        className={`text-sm font-semibold ${
          tone === 'success' ? RESIDENT_SEMANTIC.success.textBold : tone === 'warning' ? RESIDENT_SEMANTIC.warning.textBold : RESIDENT_SEMANTIC.danger.textBold
        }`}
      >
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

function ProgressRing({
  goalKey,
  label,
  progress,
  children,
}: {
  goalKey: GoalKey
  label: string
  progress: number
  children: ReactNode
}) {
  const normalized = Math.max(0, Math.min(progress, 100))
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - normalized / 100)
  const vb = 108
  const c = vb / 2
  const sw = 7
  const accentStroke = RESIDENT_GOAL_RING[goalKey]
  return (
    <div className="flex flex-col items-center text-center" aria-label={`${label}, ${Math.round(normalized)} percent of target`}>
      <div className="relative h-[9.25rem] w-[9.25rem] shrink-0">
        <svg viewBox={`0 0 ${vb} ${vb}`} className="h-full w-full -rotate-90">
          <circle cx={c} cy={c} r={radius} fill="none" className="stroke-[#CADBD9]/95 dark:stroke-border/55" strokeWidth={sw} />
          <circle
            cx={c}
            cy={c}
            r={radius}
            fill="none"
            className={accentStroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center px-2 text-center">{children}</div>
      </div>
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

function InlineDetailCard({
  title,
  titleClassName,
  children,
}: {
  title: string
  /** Defaults to the standard Goals drill-in title size. */
  titleClassName?: string
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <h4
        className={
          titleClassName ?? 'font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl'
        }
      >
        {title}
      </h4>
      <div className="mt-5">{children}</div>
    </div>
  )
}

/** Rule + history title — separates summary blocks from searchable lists. */
function DrillInHistoryHeading({ historyTitle }: { historyTitle: string }) {
  return (
    <div className="space-y-4 pt-1">
      <div className="h-px w-full bg-border" role="presentation" />
      <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">{historyTitle}</h3>
    </div>
  )
}

function DrillInStatCard({
  label,
  value,
  valueTone = 'hero',
  detail,
}: {
  label: string
  value: string
  /** `hero`: large metric. `body`: slightly smaller, wraps for longer text (e.g. location). */
  valueTone?: 'hero' | 'body'
  /** Secondary line under the value (centered). */
  detail?: string
}) {
  const valueClass =
    valueTone === 'hero'
      ? 'mt-3 text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl'
      : 'mt-3 max-w-full break-words px-1 text-center text-base font-semibold leading-snug text-foreground sm:text-lg'
  return (
    <div className="flex min-h-[9.5rem] flex-col items-center justify-center rounded-xl border border-border bg-card px-4 py-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={valueClass}>{value}</p>
      {detail ? (
        <p className="mt-2 max-w-[14rem] text-center text-xs leading-snug text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  )
}

/** Safety latest-visit stat: label + single value; optional danger emphasis for flags. */
function SafetyLatestVisitStatCard({
  title,
  value,
  valueEmphasis = 'default',
}: {
  title: string
  value: string
  valueEmphasis?: 'default' | 'danger'
}) {
  const valueClassName =
    valueEmphasis === 'danger'
      ? `mt-3 max-w-full break-words px-1 text-base font-semibold leading-snug ${RESIDENT_SEMANTIC.danger.textBold}`
      : 'mt-3 max-w-full break-words px-1 text-base font-semibold leading-snug text-foreground'
  return (
    <div className="flex min-h-[9.5rem] flex-col items-center justify-center rounded-xl border border-border bg-card px-4 py-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className={valueClassName}>{value}</p>
    </div>
  )
}

function TrendBadge({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <span className={RESIDENT_SEMANTIC.success.text}>Up</span>
  if (trend === 'down') return <span className={RESIDENT_SEMANTIC.danger.text}>Down</span>
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
  onEditIncident,
  onEditVisit,
  onRequestDeleteIncident,
  onRequestDeleteVisit,
}: {
  goal: GoalKey
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
  onEditIncident: (row: JsonTableRow) => void
  onEditVisit: (row: HomeVisitation) => void
  onRequestDeleteIncident: (id: number) => void
  onRequestDeleteVisit: (id: number) => void
}) {
  if (goal === 'health') {
    return (
      <HealthGoalDrillIn
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
        onReload={onReload}
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
        onReload={onReload}
        onLogIncident={onLogIncident}
        onOpenIncident={onOpenIncident}
        onOpenVisit={onOpenVisit}
        onEditIncident={onEditIncident}
        onEditVisit={onEditVisit}
        onRequestDeleteIncident={onRequestDeleteIncident}
        onRequestDeleteVisit={onRequestDeleteVisit}
      />
    )
  }

  return null
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
  if (category === 'improving') return RESIDENT_SEMANTIC.success.chip
  if (category === 'declining') return RESIDENT_SEMANTIC.danger.chip
  return RESIDENT_SEMANTIC.warning.chip
}

function parseOptionalHealthScore15(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = parseFloat(t.replace(',', '.'))
  if (!Number.isFinite(n) || n < 1 || n > 5) {
    throw new Error('Wellbeing scores must be between 1 and 5.')
  }
  return n
}

function parseOptionalNonNegativeNumber(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = parseFloat(t.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Enter a valid number (zero or greater).')
  }
  return n
}

function RecapScoreCell({ label, valueNum }: { label: string; valueNum: number | null }) {
  const tone =
    valueNum == null || !Number.isFinite(valueNum) ? 'neutral' : valueNum < 3 ? 'low' : valueNum > 4.2 ? 'high' : 'mid'
  return (
    <div className="rounded-lg border border-border/70 bg-background px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        {tone === 'low' ? <span className={`h-2 w-2 shrink-0 rounded-full ${RESIDENT_SEMANTIC.danger.dot}`} title="Below 3" /> : null}
        {tone === 'high' ? <span className={`h-2 w-2 shrink-0 rounded-full ${RESIDENT_SEMANTIC.success.dot}`} title="Above 4.2" /> : null}
      </div>
      <p
        className={`mt-1 text-sm font-medium tabular-nums ${
          tone === 'low' ? RESIDENT_SEMANTIC.danger.text : tone === 'high' ? RESIDENT_SEMANTIC.success.text : 'text-foreground'
        }`}
      >
        {valueNum != null && Number.isFinite(valueNum) ? valueNum.toFixed(1) : '—'}
      </p>
    </div>
  )
}

function HealthGoalDrillIn({
  healthRows,
  relatedPlan: _relatedPlan,
  onReload,
  onAddHealth,
  onOpenHealth,
}: {
  healthRows: HealthRecord[]
  relatedPlan: InterventionPlan | null
  onReload: () => Promise<void>
  onAddHealth: () => void
  onOpenHealth: (id: number) => void
}) {
  void _relatedPlan
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [apptSearch, setApptSearch] = useState('')
  const [apptFilter, setApptFilter] = useState<'all' | 'stable' | 'improving' | 'declining'>('all')
  const [healthScoreDraft, setHealthScoreDraft] = useState('')
  const [nutritionDraft, setNutritionDraft] = useState('')
  const [sleepDraft, setSleepDraft] = useState('')
  const [energyDraft, setEnergyDraft] = useState('')
  const [weightDraft, setWeightDraft] = useState('')
  const [heightDraft, setHeightDraft] = useState('')
  const [bmiDraft, setBmiDraft] = useState('')
  const [dentalCheckDraft, setDentalCheckDraft] = useState(false)
  const [medicalCheckDraft, setMedicalCheckDraft] = useState(false)
  const [psychCheckDraft, setPsychCheckDraft] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingRow, setSavingRow] = useState(false)
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
          ...RESIDENT_GOAL_CHART.teal,
          values: chronological.map((r) => r.healthScore),
        },
        {
          key: 'nut',
          name: 'Nutrition',
          ...RESIDENT_GOAL_CHART.ochre,
          values: chronological.map((r) => r.nutritionScore),
        },
        {
          key: 'slp',
          name: 'Sleep quality',
          ...RESIDENT_GOAL_CHART.navy,
          values: chronological.map((r) => r.sleepQualityScore),
        },
        {
          key: 'en',
          name: 'Energy level',
          ...RESIDENT_GOAL_CHART.peach,
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
      setHealthScoreDraft('')
      setNutritionDraft('')
      setSleepDraft('')
      setEnergyDraft('')
      setWeightDraft('')
      setHeightDraft('')
      setBmiDraft('')
      setDentalCheckDraft(false)
      setMedicalCheckDraft(false)
      setPsychCheckDraft(false)
      setNotesDraft('')
      return
    }
    const r = sortedRows.find((x) => x.id === selectedId)
    if (!r) return
    setHealthScoreDraft(r.healthScore != null && Number.isFinite(r.healthScore) ? String(r.healthScore) : '')
    setNutritionDraft(r.nutritionScore != null && Number.isFinite(r.nutritionScore) ? String(r.nutritionScore) : '')
    setSleepDraft(r.sleepQualityScore != null && Number.isFinite(r.sleepQualityScore) ? String(r.sleepQualityScore) : '')
    setEnergyDraft(r.energyLevelScore != null && Number.isFinite(r.energyLevelScore) ? String(r.energyLevelScore) : '')
    setWeightDraft(r.weightKg != null && Number.isFinite(r.weightKg) ? String(r.weightKg) : '')
    setHeightDraft(r.heightCm != null && Number.isFinite(r.heightCm) ? String(r.heightCm) : '')
    setBmiDraft(r.bmi != null && Number.isFinite(r.bmi) ? String(r.bmi) : '')
    setDentalCheckDraft(Boolean(r.dentalCheckupDone))
    setMedicalCheckDraft(Boolean(r.medicalCheckupDone))
    setPsychCheckDraft(Boolean(r.psychologicalCheckupDone))
    setNotesDraft(r.notes ?? '')
    setNotesErr(null)
  }, [selectedId, sortedRows])

  async function saveHealthRow(id: number) {
    setNotesErr(null)
    setSavingRow(true)
    try {
      let healthScore: number | undefined
      let nutritionScore: number | undefined
      let sleepQualityScore: number | undefined
      let energyLevelScore: number | undefined
      let weightKg: number | undefined
      let heightCm: number | undefined
      let bmi: number | undefined
      try {
        healthScore = parseOptionalHealthScore15(healthScoreDraft)
        nutritionScore = parseOptionalHealthScore15(nutritionDraft)
        sleepQualityScore = parseOptionalHealthScore15(sleepDraft)
        energyLevelScore = parseOptionalHealthScore15(energyDraft)
        weightKg = parseOptionalNonNegativeNumber(weightDraft)
        heightCm = parseOptionalNonNegativeNumber(heightDraft)
        bmi = parseOptionalNonNegativeNumber(bmiDraft)
      } catch (e) {
        setNotesErr(e instanceof Error ? e.message : 'Invalid values')
        return
      }
      await patchHealthRecord(id, {
        ...(healthScore !== undefined ? { healthScore } : {}),
        ...(nutritionScore !== undefined ? { nutritionScore } : {}),
        ...(sleepQualityScore !== undefined ? { sleepQualityScore } : {}),
        ...(energyLevelScore !== undefined ? { energyLevelScore } : {}),
        ...(weightKg !== undefined ? { weightKg } : {}),
        ...(heightCm !== undefined ? { heightCm } : {}),
        ...(bmi !== undefined ? { bmi } : {}),
        dentalCheckupDone: dentalCheckDraft,
        medicalCheckupDone: medicalCheckDraft,
        psychologicalCheckupDone: psychCheckDraft,
        notes: notesDraft.trim(),
      })
      await onReload()
    } catch (e) {
      setNotesErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingRow(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="rounded-lg border border-border/80 bg-white px-3 py-3 shadow-sm dark:bg-card">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-foreground">WELLBEING TREND</p>
          {chartPack && hasAnyChartPoint ? (
            <div className="mt-2 font-sans">
              <SimpleMultiLineChart
                labels={chartPack.labels}
                series={chartPack.series}
                formatY={(n) => n.toFixed(1)}
                height={200}
                yMin={1}
                yMax={5}
                variant="minimal"
                compactTypography
                ariaLabel="Wellbeing scores over time"
              />
            </div>
          ) : (
            <EmptyState title="No wellbeing scores yet" />
          )}
        </div>

        <div className="rounded-lg border border-border/80 bg-white px-3 py-3 shadow-sm dark:bg-card">
          {latest ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/55 pb-2">
                <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-foreground">LATEST RECAP</p>
                <span className="shrink-0 font-sans text-sm font-semibold tabular-nums text-foreground">
                  {formatAdminDate(latest.recordDate)}
                </span>
              </div>
              <div className="mt-2 space-y-2.5 text-sm">
                <div className="grid grid-cols-2 gap-1.5">
                  <RecapScoreCell label="General health" valueNum={latest.healthScore} />
                  <RecapScoreCell label="Nutrition score" valueNum={latest.nutritionScore} />
                  <RecapScoreCell label="Sleep quality" valueNum={latest.sleepQualityScore} />
                  <RecapScoreCell label="Energy level" valueNum={latest.energyLevelScore} />
                </div>
                <div className="grid gap-1.5 border-t border-border/60 pt-2">
                  <MiniMetric label="Weight" value={latest.weightKg != null ? `${latest.weightKg} kg` : '—'} />
                  <MiniMetric label="Height" value={latest.heightCm != null ? `${latest.heightCm} cm` : '—'} />
                  <MiniMetric label="BMI" value={latest.bmi != null ? latest.bmi.toFixed(1) : '—'} />
                </div>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No health record yet.</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex min-h-[8.5rem] flex-col items-center justify-center rounded-xl border border-border bg-card px-4 py-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Latest dental check</p>
          {latestDental ? (
            <p className="mt-3 text-lg font-semibold tabular-nums text-foreground">{formatAdminDate(latestDental.recordDate)}</p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No checkup flagged yet</p>
          )}
        </div>
        <div className="flex min-h-[8.5rem] flex-col items-center justify-center rounded-xl border border-border bg-card px-4 py-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Latest medical check</p>
          {latestMedical ? (
            <p className="mt-3 text-lg font-semibold tabular-nums text-foreground">{formatAdminDate(latestMedical.recordDate)}</p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No checkup flagged yet</p>
          )}
        </div>
        <div className="flex min-h-[8.5rem] flex-col items-center justify-center rounded-xl border border-border bg-card px-4 py-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Latest psychological check</p>
          {latestPsych ? (
            <p className="mt-3 text-lg font-semibold tabular-nums text-foreground">{formatAdminDate(latestPsych.recordDate)}</p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No checkup flagged yet</p>
          )}
        </div>
      </div>

      <DrillInHistoryHeading historyTitle="Appointment history" />

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

      <div className="space-y-2 pt-8">
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
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <label className={label}>
                        General health (1–5)
                        <input
                          className={input}
                          inputMode="decimal"
                          value={healthScoreDraft}
                          onChange={(e) => setHealthScoreDraft(e.target.value)}
                          placeholder="e.g. 4.2"
                        />
                      </label>
                      <label className={label}>
                        Nutrition (1–5)
                        <input
                          className={input}
                          inputMode="decimal"
                          value={nutritionDraft}
                          onChange={(e) => setNutritionDraft(e.target.value)}
                          placeholder="e.g. 3.5"
                        />
                      </label>
                      <label className={label}>
                        Sleep (1–5)
                        <input
                          className={input}
                          inputMode="decimal"
                          value={sleepDraft}
                          onChange={(e) => setSleepDraft(e.target.value)}
                          placeholder="e.g. 4"
                        />
                      </label>
                      <label className={label}>
                        Energy (1–5)
                        <input
                          className={input}
                          inputMode="decimal"
                          value={energyDraft}
                          onChange={(e) => setEnergyDraft(e.target.value)}
                          placeholder="e.g. 3.8"
                        />
                      </label>
                      <label className={label}>
                        Weight (kg)
                        <input
                          className={input}
                          inputMode="decimal"
                          value={weightDraft}
                          onChange={(e) => setWeightDraft(e.target.value)}
                          placeholder="e.g. 62"
                        />
                      </label>
                      <label className={label}>
                        Height (cm)
                        <input
                          className={input}
                          inputMode="decimal"
                          value={heightDraft}
                          onChange={(e) => setHeightDraft(e.target.value)}
                          placeholder="e.g. 165"
                        />
                      </label>
                      <label className={label}>
                        BMI
                        <input
                          className={input}
                          inputMode="decimal"
                          value={bmiDraft}
                          onChange={(e) => setBmiDraft(e.target.value)}
                          placeholder="e.g. 22.5"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={dentalCheckDraft}
                          onChange={(e) => setDentalCheckDraft(e.target.checked)}
                        />
                        <span>Dental checkup done</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={medicalCheckDraft}
                          onChange={(e) => setMedicalCheckDraft(e.target.checked)}
                        />
                        <span>Medical checkup done</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={psychCheckDraft}
                          onChange={(e) => setPsychCheckDraft(e.target.checked)}
                        />
                        <span>Psychological checkup done</span>
                      </label>
                    </div>
                    <div>
                      <label className={label}>
                        <span className="flex items-center justify-between gap-2">
                          <span>Notes</span>
                          <span className="text-[10px] font-normal normal-case text-muted-foreground">
                            Editing record — save or delete below
                          </span>
                        </span>
                        <textarea
                          key={`health-notes-${row.id}`}
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
                          disabled={savingRow}
                          onClick={() => void saveHealthRow(row.id)}
                        >
                          {savingRow ? 'Saving…' : 'Save changes'}
                        </button>
                        <InlineActionButton onClick={() => onOpenHealth(row.id)}>Full record</InlineActionButton>
                        <button
                          type="button"
                          className={RESIDENT_SEMANTIC.danger.outlineButton}
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
  relatedPlan: _relatedPlan,
  onReload,
  onAddEducation,
  onOpenEducation,
}: {
  educationRows: EducationRecord[]
  relatedPlan: InterventionPlan | null
  onReload: () => Promise<void>
  onAddEducation: () => void
  onOpenEducation: (id: number) => void
}) {
  void _relatedPlan
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [edSearch, setEdSearch] = useState('')
  const [edFilter, setEdFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [notesDraft, setNotesDraft] = useState('')
  const [schoolDraft, setSchoolDraft] = useState('')
  const [levelDraft, setLevelDraft] = useState('')
  const [enrollDraft, setEnrollDraft] = useState('')
  const [completeDraft, setCompleteDraft] = useState('')
  const [attendPctDraft, setAttendPctDraft] = useState('')
  const [progressDraft, setProgressDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sortedRows = useMemo(() => byNewestDate(educationRows, (row) => row.recordDate), [educationRows])
  const latest = sortedRows[0] ?? null
  const distinctCourses = useMemo(
    () =>
      new Set(
        sortedRows
          .map((row) => {
            const ext = parseEducationExtendedLite(row.extendedJson)
            return ext.courseName || row.schoolName || ''
          })
          .filter(Boolean),
      ).size,
    [sortedRows],
  )
  const latestProgress = latest?.progressPercent ?? null
  const latestAttendance = latest?.attendanceRate ?? null

  const chronologicalEdu = useMemo(
    () => [...educationRows].sort((a, b) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime()),
    [educationRows],
  )

  const eduChartPack = useMemo(() => {
    if (chronologicalEdu.length === 0) return null
    const labels = chronologicalEdu.map((row) =>
      new Date(row.recordDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    )
    return {
      labels,
      series: [
        {
          key: 'att',
          name: 'Attendance',
          ...RESIDENT_GOAL_CHART.teal,
          values: chronologicalEdu.map((r) =>
            r.attendanceRate != null && Number.isFinite(r.attendanceRate) ? r.attendanceRate * 100 : null,
          ),
        },
        {
          key: 'prg',
          name: 'Program progress',
          ...RESIDENT_GOAL_CHART.navy,
          values: chronologicalEdu.map((r) =>
            r.progressPercent != null && Number.isFinite(r.progressPercent) ? r.progressPercent : null,
          ),
        },
      ],
    }
  }, [chronologicalEdu])

  const hasEduChartPoint = useMemo(
    () => eduChartPack?.series.some((s) => s.values.some((v) => v != null && Number.isFinite(v))) ?? false,
    [eduChartPack],
  )

  const filteredRows = useMemo(() => {
    let list = sortedRows
    if (edSearch.trim()) {
      const s = edSearch.trim().toLowerCase()
      list = list.filter(
        (r) =>
          (r.schoolName ?? '').toLowerCase().includes(s) ||
          (r.notes ?? '').toLowerCase().includes(s) ||
          formatAdminDate(r.recordDate).toLowerCase().includes(s) ||
          (r.educationLevel ?? '').toLowerCase().includes(s),
      )
    }
    if (edFilter !== 'all') {
      list = list.filter((r) => {
        const c = (r.completionStatus ?? '').toLowerCase()
        if (edFilter === 'completed') return c.includes('complete') || c.includes('graduat')
        return !(c.includes('complete') || c.includes('graduat'))
      })
    }
    if (selectedId != null && !list.some((r) => r.id === selectedId)) {
      const sel = sortedRows.find((r) => r.id === selectedId)
      if (sel) list = [sel, ...list]
    }
    return list
  }, [sortedRows, edSearch, edFilter, selectedId])

  const selectedRow = sortedRows.find((r) => r.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedRow) {
      setNotesDraft('')
      setSchoolDraft('')
      setLevelDraft('')
      setEnrollDraft('')
      setCompleteDraft('')
      setAttendPctDraft('')
      setProgressDraft('')
      return
    }
    setNotesDraft(selectedRow.notes ?? '')
    setSchoolDraft(selectedRow.schoolName ?? '')
    setLevelDraft(selectedRow.educationLevel ?? '')
    setEnrollDraft(selectedRow.enrollmentStatus ?? '')
    setCompleteDraft(selectedRow.completionStatus ?? '')
    setAttendPctDraft(
      selectedRow.attendanceRate != null ? String(Math.round(selectedRow.attendanceRate * 100)) : '',
    )
    setProgressDraft(selectedRow.progressPercent != null ? String(Math.round(selectedRow.progressPercent)) : '')
    setErr(null)
  }, [
    selectedRow?.id,
    selectedRow?.notes,
    selectedRow?.schoolName,
    selectedRow?.educationLevel,
    selectedRow?.enrollmentStatus,
    selectedRow?.completionStatus,
    selectedRow?.attendanceRate,
    selectedRow?.progressPercent,
  ])

  async function saveEducation(id: number) {
    setErr(null)
    const att = attendPctDraft.trim()
    const pr = progressDraft.trim()
    let attendanceRate: number | null | undefined
    if (att !== '') {
      const n = parseFloat(att)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setErr('Attendance must be between 0 and 100%.')
        return
      }
      attendanceRate = n / 100
    }
    let progressPercent: number | null | undefined
    if (pr !== '') {
      const n = parseFloat(pr)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setErr('Progress must be between 0 and 100.')
        return
      }
      progressPercent = n
    }
    setSaving(true)
    try {
      await patchEducationRecord(id, {
        notes: notesDraft.trim(),
        schoolName: schoolDraft.trim() || null,
        educationLevel: levelDraft.trim() || null,
        enrollmentStatus: enrollDraft.trim() || null,
        completionStatus: completeDraft.trim() || null,
        ...(att !== '' ? { attendanceRate } : {}),
        ...(pr !== '' ? { progressPercent } : {}),
      })
      await onReload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border/80 bg-white px-3 py-3 shadow-sm dark:bg-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance & progress</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Percent attendance and program progress by record date (when captured).
        </p>
        {eduChartPack && hasEduChartPoint ? (
          <div className="mt-2 font-sans">
            <SimpleMultiLineChart
              labels={eduChartPack.labels}
              series={eduChartPack.series}
              formatY={(n) => `${Math.round(n)}%`}
              height={168}
              yMin={0}
              yMax={100}
              variant="minimal"
              compactTypography
              ariaLabel="Attendance and program progress over time"
            />
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState title="No attendance or progress points yet" />
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <DrillInStatCard label="Total courses" value={String(distinctCourses || sortedRows.length || 0)} />
        <DrillInStatCard
          label="Progress"
          value={latestProgress != null ? `${Math.round(latestProgress)}%` : '—'}
        />
        <DrillInStatCard
          label="Attendance"
          value={latestAttendance != null ? `${Math.round(latestAttendance * 100)}%` : '—'}
        />
      </div>

      <DrillInHistoryHeading historyTitle="Educational history" />

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1">
          <label className={label} htmlFor="ed-rec-search">
            Search
          </label>
          <input
            id="ed-rec-search"
            type="search"
            className={input}
            value={edSearch}
            onChange={(e) => setEdSearch(e.target.value)}
            placeholder="School, notes, date…"
          />
        </div>
        <label className={label}>
          Filter
          <select
            className={input}
            value={edFilter}
            onChange={(e) => setEdFilter(e.target.value as typeof edFilter)}
          >
            <option value="all">All</option>
            <option value="active">Active / in progress</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <InlineActionButton onClick={onAddEducation}>Add</InlineActionButton>
      </div>

      <div className="space-y-2 pt-8">
        {err ? <div className={alertError}>{err}</div> : null}

        {sortedRows.length === 0 ? (
          <EmptyState title="No education records yet" />
        ) : (
          filteredRows.map((row) => {
            const ext = parseEducationExtendedLite(row.extendedJson)
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
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        Attend {row.attendanceRate != null ? `${Math.round(row.attendanceRate * 100)}%` : '—'}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${RESIDENT_SEMANTIC.success.chip}`}>
                        Progress {row.progressPercent != null ? `${Math.round(row.progressPercent)}%` : '—'}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">{selectedId === row.id ? 'Hide' : 'Open'}</span>
                  </div>
                </button>
                {selectedId === row.id ? (
                  <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <MiniMetric label="Program" value={ext.programName || '—'} />
                      <MiniMetric label="Course" value={ext.courseName || '—'} />
                    </div>
                    <div>
                      <label className={label}>
                        <span className="flex items-center justify-between gap-2">
                          <span>Notes</span>
                          <span className="text-[10px] font-normal normal-case text-muted-foreground">Editing — save or delete below</span>
                        </span>
                        <textarea
                          key={`edu-notes-${row.id}`}
                          className={input}
                          rows={5}
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className={label}>
                        School
                        <input className={input} value={schoolDraft} onChange={(e) => setSchoolDraft(e.target.value)} />
                      </label>
                      <label className={label}>
                        Education level
                        <input className={input} value={levelDraft} onChange={(e) => setLevelDraft(e.target.value)} />
                      </label>
                      <label className={label}>
                        Enrollment status
                        <input className={input} value={enrollDraft} onChange={(e) => setEnrollDraft(e.target.value)} />
                      </label>
                      <label className={label}>
                        Completion status
                        <input className={input} value={completeDraft} onChange={(e) => setCompleteDraft(e.target.value)} />
                      </label>
                      <label className={label}>
                        Attendance (%)
                        <input
                          className={input}
                          inputMode="decimal"
                          value={attendPctDraft}
                          onChange={(e) => setAttendPctDraft(e.target.value)}
                          placeholder="e.g. 85"
                        />
                      </label>
                      <label className={label}>
                        Progress (%)
                        <input
                          className={input}
                          inputMode="decimal"
                          value={progressDraft}
                          onChange={(e) => setProgressDraft(e.target.value)}
                          placeholder="e.g. 72"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={btnPrimary} disabled={saving} onClick={() => void saveEducation(row.id)}>
                        {saving ? 'Saving…' : 'Save changes'}
                      </button>
                      <InlineActionButton onClick={() => onOpenEducation(row.id)}>Full record</InlineActionButton>
                      <button
                        type="button"
                        className={RESIDENT_SEMANTIC.danger.outlineButton}
                        onClick={() => setDeleteId(row.id)}
                      >
                        Delete…
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      <AdminDeleteModal
        open={deleteId != null}
        title="Delete this education record?"
        body="This removes the row from education_records. This cannot be undone."
        loading={deleting}
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId == null) return
          setDeleting(true)
          try {
            await deleteEducationRecord(deleteId)
            setDeleteId(null)
            setSelectedId(null)
            await onReload()
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'Delete failed')
          } finally {
            setDeleting(false)
          }
        }}
      />
    </div>
  )
}

function visitNotesEditableSource(v: HomeVisitation): string {
  const follow = (v.followUpNotes ?? '').trim()
  if (follow) return v.followUpNotes ?? ''
  const obs = (v.observations ?? '').trim()
  if (obs) return v.observations ?? ''
  const purpose = (v.purpose ?? '').trim()
  return purpose ? (v.purpose ?? '') : ''
}

function SafetyGoalDrillIn({
  visitRows,
  incidentRows,
  relatedPlan: _relatedPlan,
  onReload,
  onLogIncident,
  onOpenIncident,
  onOpenVisit,
  onEditIncident: _onEditIncident,
  onEditVisit: _onEditVisit,
  onRequestDeleteIncident,
  onRequestDeleteVisit,
}: {
  visitRows: HomeVisitation[]
  incidentRows: JsonTableRow[]
  relatedPlan: InterventionPlan | null
  onReload: () => Promise<void>
  onLogIncident: () => void
  onOpenIncident: (row: JsonTableRow) => void
  onOpenVisit: (row: HomeVisitation) => void
  onEditIncident: (row: JsonTableRow) => void
  onEditVisit: (row: HomeVisitation) => void
  onRequestDeleteIncident: (id: number) => void
  onRequestDeleteVisit: (id: number) => void
}) {
  void _relatedPlan
  void _onEditIncident
  void _onEditVisit
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'visit' | 'incident'>('all')
  const [locationFilter, setLocationFilter] = useState('')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesErr, setNotesErr] = useState<string | null>(null)

  const latestVisit = byNewestDate(visitRows, (row) => row.visitDate)[0] ?? null

  const locationOptions = useMemo(() => {
    const s = new Set<string>()
    visitRows.forEach((v) => {
      const loc = (v.locationVisited ?? '').trim()
      if (loc) s.add(loc)
    })
    incidentRows.forEach((r) => {
      const id = (r.fields.safehouse_id ?? '').trim()
      if (id) s.add(`Safehouse ${id}`)
    })
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [visitRows, incidentRows])

  type SafetyRow = {
    key: string
    type: 'visit' | 'incident'
    visitRow: HomeVisitation | null
    incidentRow: JsonTableRow | null
    sort: number
    date: string
    location: string
    chip: string
    detail: {
      type: string
      location: string
      status: string
      outcome: string
      notes: string
      worker: string
    }
  }

  const allSafetyRows = useMemo((): SafetyRow[] => {
    const visitItems: SafetyRow[] = visitRows
      .filter((row) => row.safetyConcernsNoted || row.followUpNeeded)
      .map((row) => ({
        key: `visit-${row.id}`,
        type: 'visit' as const,
        visitRow: row,
        incidentRow: null,
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
      }))

    const incidentItems: SafetyRow[] = incidentRows.map((row) => ({
      key: `incident-${row.id}`,
      type: 'incident' as const,
      visitRow: null,
      incidentRow: row,
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
    }))

    return [...visitItems, ...incidentItems].sort((a, b) => b.sort - a.sort)
  }, [incidentRows, visitRows])

  const safetyRecords = useMemo(() => {
    let list = allSafetyRows.filter((row) => (filter === 'all' ? true : row.type === filter))
    if (locationFilter.trim()) {
      list = list.filter((row) => row.location === locationFilter)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((row) =>
        `${row.location} ${row.chip} ${row.detail.notes} ${row.detail.status}`.toLowerCase().includes(q),
      )
    }
    if (expandedKey != null && !list.some((r) => r.key === expandedKey)) {
      const sel = allSafetyRows.find((r) => r.key === expandedKey)
      if (sel) list = [sel, ...list]
    }
    return list
  }, [allSafetyRows, expandedKey, filter, locationFilter, search])

  useEffect(() => {
    if (expandedKey == null) {
      setNotesDraft('')
      return
    }
    const row = allSafetyRows.find((r) => r.key === expandedKey)
    if (!row) {
      setNotesDraft('')
      return
    }
    if (row.type === 'visit' && row.visitRow) {
      setNotesDraft(visitNotesEditableSource(row.visitRow))
    } else if (row.type === 'incident' && row.incidentRow) {
      setNotesDraft(row.incidentRow.fields.description ?? '')
    } else {
      setNotesDraft('')
    }
    setNotesErr(null)
  }, [allSafetyRows, expandedKey])

  async function saveNotesForExpanded() {
    if (expandedKey == null) return
    const row = allSafetyRows.find((r) => r.key === expandedKey)
    if (!row) return
    setNotesErr(null)
    setSavingNotes(true)
    try {
      if (row.type === 'visit' && row.visitRow) {
        const trimmed = notesDraft.trim()
        await patchHomeVisitation(row.visitRow.id, { followUpNotes: trimmed ? trimmed : undefined })
      } else if (row.type === 'incident' && row.incidentRow) {
        await patchIncidentReport(row.incidentRow.id, { description: notesDraft })
      }
      await onReload()
    } catch (e) {
      setNotesErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingNotes(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest safety visit</p>
        {latestVisit ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SafetyLatestVisitStatCard title="Date" value={formatAdminDate(latestVisit.visitDate)} />
            <SafetyLatestVisitStatCard title="Location" value={latestVisit.locationVisited || '—'} />
            <SafetyLatestVisitStatCard title="Visit type" value={latestVisit.visitType || '—'} />
            <SafetyLatestVisitStatCard
              title="Safety concerns"
              value={latestVisit.safetyConcernsNoted ? 'Yes' : 'No'}
              valueEmphasis={latestVisit.safetyConcernsNoted ? 'danger' : 'default'}
            />
            <SafetyLatestVisitStatCard
              title="Outcome"
              value={latestVisit.visitOutcome || '—'}
              valueEmphasis={
                (latestVisit.visitOutcome ?? '').trim().toLowerCase() === 'unfavorable' ? 'danger' : 'default'
              }
            />
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState title="No recent safety visit" />
          </div>
        )}
      </div>

      <DrillInHistoryHeading historyTitle="Safety history" />

      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notes & record list</p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1">
            <label className={label} htmlFor="safety-rec-search">
              Search
            </label>
            <input
              id="safety-rec-search"
              type="search"
              className={input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Notes, location, type…"
            />
          </div>
          <label className={label}>
            Type
            <select
              className={input}
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
            >
              <option value="all">All</option>
              <option value="visit">Visits</option>
              <option value="incident">Incidents</option>
            </select>
          </label>
          <label className={label}>
            Location
            <select
              className={input}
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">All locations</option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </label>
          <InlineActionButton onClick={onLogIncident}>Add</InlineActionButton>
        </div>

        <div className="space-y-2 pt-8">
          {notesErr ? <div className={alertError}>{notesErr}</div> : null}

          {safetyRecords.length === 0 ? (
            <EmptyState title="No safety records yet" />
          ) : (
            safetyRecords.map((row) => (
              <div
                key={row.key}
                className={`w-full rounded-xl border bg-card px-4 py-3 ${expandedKey === row.key ? 'border-primary' : 'border-border'}`}
              >
                <button
                  type="button"
                  className="w-full text-left hover:opacity-95"
                  onClick={() => setExpandedKey((value) => (value === row.key ? null : row.key))}
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
                </button>
                {expandedKey === row.key ? (
                  <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <MiniMetric label="Date" value={formatAdminDate(row.date)} align="center" />
                      <MiniMetric label="Location" value={row.detail.location} align="center" />
                      <MiniMetric label="Type" value={row.detail.type} align="center" />
                      <MiniMetric label="Status" value={row.detail.status} align="center" />
                      <MiniMetric label="Outcome" value={row.detail.outcome} align="center" />
                      <MiniMetric label="Worker" value={row.detail.worker} align="center" />
                    </div>
                    <div>
                      <label className={label}>
                        <span className="flex items-center justify-between gap-2">
                          <span>Notes</span>
                          <span className="text-[10px] font-normal normal-case text-muted-foreground">Editing — save or delete below</span>
                        </span>
                        <textarea
                          key={`safety-notes-${row.key}`}
                          className={input}
                          rows={5}
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={savingNotes}
                          onClick={() => void saveNotesForExpanded()}
                        >
                          {savingNotes ? 'Saving…' : 'Save notes'}
                        </button>
                        {row.type === 'visit' && row.visitRow ? (
                          <>
                            <InlineActionButton onClick={() => onOpenVisit(row.visitRow!)}>Full record</InlineActionButton>
                            <button
                              type="button"
                              className={RESIDENT_SEMANTIC.danger.outlineButton}
                              onClick={() => onRequestDeleteVisit(row.visitRow!.id)}
                            >
                              Delete…
                            </button>
                          </>
                        ) : null}
                        {row.type === 'incident' && row.incidentRow ? (
                          <>
                            <InlineActionButton onClick={() => onOpenIncident(row.incidentRow!)}>Full record</InlineActionButton>
                            <button
                              type="button"
                              className={RESIDENT_SEMANTIC.danger.outlineButton}
                              onClick={() => onRequestDeleteIncident(row.incidentRow!.id)}
                            >
                              Delete…
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function MiniMetric({
  label,
  value,
  align = 'start',
}: {
  label: string
  value: string
  align?: 'start' | 'center'
}) {
  const alignCls = align === 'center' ? 'text-center' : ''
  return (
    <div className={`rounded-lg border border-border/70 bg-background px-3 py-3 ${alignCls}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-base font-semibold text-foreground">{value}</p>
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
              className={RESIDENT_SEMANTIC.danger.outlineButtonWide}
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
