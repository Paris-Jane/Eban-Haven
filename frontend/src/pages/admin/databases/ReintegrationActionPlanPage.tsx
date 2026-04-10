import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  createEducationRecord,
  createHealthRecord,
  createHomeVisitation,
  createInterventionPlan,
  createProcessRecording,
  getHomeVisitations,
  getInterventionPlans,
  getProcessRecordings,
  getReintegrationReadinessCohort,
  getResident,
  listEducationRecords,
  listHealthRecords,
  listIncidentReports,
  type EducationRecord,
  type HealthRecord,
  type HomeVisitation,
  type IncidentReport,
  type InterventionPlan,
  type ProcessRecording,
  type ResidentDetail,
  type ResidentSummary,
} from '../../../api/admin'
import {
  alertError,
  btnPrimary,
  card,
  input,
  label,
  pageDesc,
  pageTitle,
} from '../shared/adminStyles'
import {
  deriveReadinessPrediction,
  deriveReadinessTier,
  formatFeatureValue,
  type ImprovementArea,
  type ReintegrationResult,
} from '../../../components/ml/reintegrationReadinessShared'

type CohortResident = ResidentSummary & {
  readiness: ReintegrationResult
}

type ResidentFieldMap = ResidentDetail['fields']

type SavedChecklistItem = {
  id: string
  text: string
  done: boolean
}

type SavedActionPlan = {
  lastReviewedAt: string | null
  checklist: SavedChecklistItem[]
}

type PlannerPreset = {
  category: string
  description: string
  targetDate: string
  caseConferenceDate: string
  servicesProvided: string
}

type SectionId =
  | 'plan-builder'
  | 'health-history'
  | 'health-form'
  | 'education-history'
  | 'education-form'
  | 'session-history'
  | 'session-form'
  | 'incident-history'
  | 'visit-history'
  | 'visit-form'

type SectionAction = {
  label: string
  section: SectionId
  preset?: Partial<PlannerPreset>
}

type HealthExtended = {
  weightKg?: string | null
  heightCm?: string | null
  bmi?: string | null
  nutritionScore?: string | null
  sleepScore?: string | null
  energyScore?: string | null
  medicalCheckupDone?: boolean
  dentalCheckupDone?: boolean
  psychologicalCheckupDone?: boolean
  notes?: string | null
}

type EducationExtended = {
  programName?: string | null
  courseName?: string | null
  educationLevel?: string | null
  attendanceStatus?: string | null
  attendanceRate?: string | null
  completionStatus?: string | null
  gpaLikeScore?: string | null
  notes?: string | null
}

const ACTION_PLAN_STORAGE_KEY = 'reintegration-readiness-action-plans:v1'

function loadSavedActionPlans(): Record<string, SavedActionPlan> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(ACTION_PLAN_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, SavedActionPlan>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveActionPlans(plans: Record<string, SavedActionPlan>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACTION_PLAN_STORAGE_KEY, JSON.stringify(plans))
}

function parseExtendedJson<T>(raw?: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function checklistItems(resident: CohortResident) {
  const actions = resident.readiness.top_improvements.slice(0, 3).map((area) => area.suggestion)
  return [...actions, 'Review reintegration status and set the next follow-up date.'].slice(0, 4)
}

function defaultSavedPlan(resident: CohortResident): SavedActionPlan {
  return {
    lastReviewedAt: null,
    checklist: checklistItems(resident).map((text, index) => ({
      id: `${resident.id}-${index}-${text}`,
      text,
      done: false,
    })),
  }
}

function readinessNarrative(resident: CohortResident) {
  const topAreas = resident.readiness.top_improvements.slice(0, 2).map((area) => area.label.toLowerCase())
  const list = topAreas.length > 0 ? topAreas.join(' and ') : 'consistent case review'
  const prediction = deriveReadinessPrediction(resident.readiness.reintegration_probability)

  if (prediction === 'Ready') {
    return `This resident is above the readiness threshold. Use this page to confirm transition details and keep ${list} stable before reintegration moves ahead.`
  }
  if (deriveReadinessTier(resident.readiness.reintegration_probability) === 'Moderate Readiness') {
    return `This resident is close to readiness, but ${list} still need follow-through before reintegration planning is fully safe.`
  }
  return `This resident is not yet ready for reintegration. The clearest blockers are ${list}, and the next actions on this page should focus there first.`
}

function residentField(fields: ResidentFieldMap | null, ...keys: string[]) {
  if (!fields) return null
  for (const key of keys) {
    const value = fields[key]
    if (value != null && value !== '') return value
  }
  return null
}

function displayValue(value: string | number | boolean | null | undefined) {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function hasMeaningfulValue(value: string | number | boolean | null | undefined) {
  return !(value == null || value === '')
}

function compactFieldRows(
  fields: Array<{ label: string; value: string | number | boolean | null | undefined }>,
) {
  return fields.filter((field) => hasMeaningfulValue(field.value))
}

function numberOrNull(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function actionConfig(area: ImprovementArea): SectionAction[] {
  switch (area.feature) {
    case 'avg_general_health_score':
    case 'pct_psych_checkup_done':
    case 'num_health_records':
      return [
        { label: 'Review health history', section: 'health-history' },
        {
          label: 'Schedule health assessment',
          section: 'plan-builder',
          preset: {
            category: 'Physical Health',
            description: `Schedule a health assessment to address ${area.label.toLowerCase()}.`,
            servicesProvided: 'Health assessment follow-up',
          },
        },
        { label: 'Create health assessment', section: 'health-form' },
      ]
    case 'avg_progress_percent':
    case 'latest_attendance_rate':
      return [
        { label: 'Review education history', section: 'education-history' },
        {
          label: 'Create education support plan',
          section: 'plan-builder',
          preset: {
            category: 'Education',
            description: `Create an education support plan to improve ${area.label.toLowerCase()}.`,
            servicesProvided: 'Education support and follow-up',
          },
        },
        { label: 'Log education update', section: 'education-form' },
      ]
    case 'total_incidents':
    case 'num_severe_incidents':
      return [
        { label: 'Review incident history', section: 'incident-history' },
        {
          label: 'Create behaviour support plan',
          section: 'plan-builder',
          preset: {
            category: 'Safety',
            description: `Create a behaviour support plan to address ${area.label.toLowerCase()}.`,
            servicesProvided: 'Behaviour support and incident review',
          },
        },
        { label: 'Review visit history', section: 'visit-history' },
      ]
    case 'pct_progress_noted':
    case 'pct_concerns_flagged':
    case 'total_sessions':
      return [
        { label: 'Review session history', section: 'session-history' },
        { label: 'Add counseling session', section: 'session-form' },
        {
          label: 'Create support plan',
          section: 'plan-builder',
          preset: {
            category: 'Psychosocial',
            description: `Create a support plan to improve ${area.label.toLowerCase()}.`,
            servicesProvided: 'Counselling and progress monitoring',
          },
        },
      ]
    case 'total_plans':
    case 'pct_plans_achieved':
      return [
        { label: 'Review current plans', section: 'plan-builder' },
        {
          label: 'Create reintegration goal',
          section: 'plan-builder',
          preset: {
            category: 'Reintegration',
            description: `Create a reintegration goal to improve ${area.label.toLowerCase()}.`,
            servicesProvided: 'Reintegration planning and follow-up',
          },
        },
        { label: 'Review visit history', section: 'visit-history' },
      ]
    case 'days_in_program':
      return [
        {
          label: 'Create transition readiness plan',
          section: 'plan-builder',
          preset: {
            category: 'Reintegration',
            description: 'Create a transition readiness plan to build stability before reintegration.',
            servicesProvided: 'Transition planning and supervision',
          },
        },
        { label: 'Schedule home visit', section: 'visit-form' },
        { label: 'Review session history', section: 'session-history' },
      ]
    default:
      return [
        { label: 'Create support plan', section: 'plan-builder' },
        { label: 'Review visit history', section: 'visit-history' },
        { label: 'Review session history', section: 'session-history' },
      ]
  }
}

function SectionPanel({
  title,
  description,
  tone = 'default',
  children,
}: {
  title: string
  description: string
  tone?: 'default' | 'health' | 'education' | 'risk'
  children: ReactNode
}) {
  const toneClass =
    tone === 'health'
      ? 'border-l-4 border-l-emerald-400 border-border bg-card'
      : tone === 'education'
        ? 'border-l-4 border-l-sky-400 border-border bg-card'
        : tone === 'risk'
          ? 'border-l-4 border-l-amber-400 border-border bg-card'
          : 'border-border bg-card'
  return (
    <div className={`mt-4 rounded-xl border p-4 ${toneClass}`}>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

export function ReintegrationActionPlanPage() {
  const { id: idParam } = useParams()
  const residentId = Number(idParam)

  const [resident, setResident] = useState<CohortResident | null>(null)
  const [residentDetail, setResidentDetail] = useState<ResidentDetail | null>(null)
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([])
  const [educationRecords, setEducationRecords] = useState<EducationRecord[]>([])
  const [incidentReports, setIncidentReports] = useState<IncidentReport[]>([])
  const [processRecordings, setProcessRecordings] = useState<ProcessRecording[]>([])
  const [homeVisits, setHomeVisits] = useState<HomeVisitation[]>([])
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [savedPlans, setSavedPlans] = useState<Record<string, SavedActionPlan>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [expandedBlocker, setExpandedBlocker] = useState<string>('')
  const [expandedSection, setExpandedSection] = useState<SectionId>('plan-builder')

  const [plannerPreset, setPlannerPreset] = useState<PlannerPreset>({
    category: 'Reintegration',
    description: '',
    targetDate: '',
    caseConferenceDate: '',
    servicesProvided: '',
  })

  const [healthForm, setHealthForm] = useState({
    recordDate: isoToday(),
    generalHealthScore: '',
    weightKg: '',
    heightCm: '',
    bmi: '',
    nutritionScore: '',
    sleepScore: '',
    energyScore: '',
    medicalCheckupDone: false,
    dentalCheckupDone: false,
    psychologicalCheckupDone: false,
    notes: '',
  })
  const [educationForm, setEducationForm] = useState({
    recordDate: isoToday(),
    programName: 'Bridge Program',
    courseName: 'Life Skills',
    educationLevel: 'Secondary',
    attendanceStatus: 'Present',
    attendanceRate: '',
    progressPercent: '',
    completionStatus: 'InProgress',
    gpaLikeScore: '',
    notes: '',
  })
  const [sessionForm, setSessionForm] = useState({
    sessionDate: isoToday(),
    socialWorker: '',
    sessionType: 'Individual',
    sessionDurationMinutes: '',
    emotionalStateObserved: 'Hopeful',
    emotionalStateEnd: 'Hopeful',
    narrative: '',
    interventionsApplied: '',
    followUpActions: '',
    progressNoted: true,
    concernsFlagged: false,
    referralMade: false,
  })
  const [visitForm, setVisitForm] = useState({
    visitDate: isoToday(),
    socialWorker: '',
    visitType: 'Reintegration Assessment',
    locationVisited: '',
    familyMembersPresent: '',
    purpose: '',
    observations: '',
    familyCooperationLevel: 'Cooperative',
    safetyConcernsNoted: false,
    followUpNeeded: true,
    followUpNotes: '',
    visitOutcome: 'Needs Improvement',
  })
  const [plannerForm, setPlannerForm] = useState({
    category: 'Reintegration',
    description: '',
    targetDate: '',
    caseConferenceDate: '',
    servicesProvided: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cohort, detail, health, education, incidents, recordings, visits, interventionPlans] = await Promise.all([
        getReintegrationReadinessCohort(),
        getResident(residentId),
        listHealthRecords(residentId),
        listEducationRecords(residentId),
        listIncidentReports(residentId),
        getProcessRecordings(residentId),
        getHomeVisitations(residentId),
        getInterventionPlans(residentId),
      ])

      const row = cohort.residents.find((item) => item.id === residentId) ?? null
      if (!row) throw new Error('Resident not found in the active reintegration readiness cohort.')

      setResident(row)
      setResidentDetail(detail)
      setHealthRecords(health)
      setEducationRecords(education)
      setIncidentReports(incidents)
      setProcessRecordings(recordings)
      setHomeVisits(visits)
      setPlans(interventionPlans)
      setSessionForm((current) => ({ ...current, socialWorker: current.socialWorker || (row.assignedSocialWorker ?? '') }))
      setVisitForm((current) => ({ ...current, socialWorker: current.socialWorker || (row.assignedSocialWorker ?? '') }))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load reintegration action plan.')
    } finally {
      setLoading(false)
    }
  }, [residentId])

  useEffect(() => {
    setSavedPlans(loadSavedActionPlans())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!plannerPreset.description && !plannerPreset.servicesProvided && !plannerPreset.category) return
    setPlannerForm((current) => ({
      category: plannerPreset.category || current.category,
      description: plannerPreset.description || current.description,
      targetDate: plannerPreset.targetDate || current.targetDate,
      caseConferenceDate: plannerPreset.caseConferenceDate || current.caseConferenceDate,
      servicesProvided: plannerPreset.servicesProvided || current.servicesProvided,
    }))
  }, [plannerPreset])

  const actionPlan = useMemo(() => {
    if (!resident) return null
    return savedPlans[String(resident.id)] ?? defaultSavedPlan(resident)
  }, [resident, savedPlans])

  const updateActionPlan = useCallback((nextPlan: SavedActionPlan) => {
    if (!resident) return
    setSavedPlans((current) => {
      const next = { ...current, [String(resident.id)]: nextPlan }
      saveActionPlans(next)
      return next
    })
  }, [resident])

  const handlePriorityAction = (blockerId: string, action: SectionAction) => {
    if (expandedBlocker === blockerId && expandedSection === action.section) {
      setExpandedBlocker('')
      return
    }
    if (action.preset) setPlannerPreset((current) => ({ ...current, ...action.preset }))
    setExpandedBlocker(blockerId)
    setExpandedSection(action.section)
  }

  const handleCreateHealthRecord = async () => {
    if (!resident) return
    const score = Number(healthForm.generalHealthScore)
    if (!Number.isFinite(score)) {
      setNotice('Enter a valid general health score before creating the assessment.')
      return
    }
    await createHealthRecord({
      residentId: resident.id,
      recordDate: healthForm.recordDate,
      healthScore: score,
      nutritionScore: numberOrNull(healthForm.nutritionScore),
      sleepQualityScore: numberOrNull(healthForm.sleepScore),
      energyLevelScore: numberOrNull(healthForm.energyScore),
      heightCm: numberOrNull(healthForm.heightCm),
      weightKg: numberOrNull(healthForm.weightKg),
      bmi: numberOrNull(healthForm.bmi),
      medicalCheckupDone: healthForm.medicalCheckupDone,
      dentalCheckupDone: healthForm.dentalCheckupDone,
      psychologicalCheckupDone: healthForm.psychologicalCheckupDone,
      notes: healthForm.notes || null,
      extendedJson: JSON.stringify({
        source: 'reintegration-action-plan',
        weightKg: healthForm.weightKg || null,
        heightCm: healthForm.heightCm || null,
        bmi: healthForm.bmi || null,
        nutritionScore: healthForm.nutritionScore || null,
        sleepScore: healthForm.sleepScore || null,
        energyScore: healthForm.energyScore || null,
        medicalCheckupDone: healthForm.medicalCheckupDone,
        dentalCheckupDone: healthForm.dentalCheckupDone,
        psychologicalCheckupDone: healthForm.psychologicalCheckupDone,
        notes: healthForm.notes || null,
      }),
    })
    setHealthForm({
      recordDate: isoToday(),
      generalHealthScore: '',
      weightKg: '',
      heightCm: '',
      bmi: '',
      nutritionScore: '',
      sleepScore: '',
      energyScore: '',
      medicalCheckupDone: false,
      dentalCheckupDone: false,
      psychologicalCheckupDone: false,
      notes: '',
    })
    setNotice('Health assessment created.')
    await load()
  }

  const handleCreateEducationRecord = async () => {
    if (!resident) return
    const progress = Number(educationForm.progressPercent)
    if (!Number.isFinite(progress)) {
      setNotice('Enter a valid progress percent before creating the education update.')
      return
    }
    await createEducationRecord({
      residentId: resident.id,
      recordDate: educationForm.recordDate,
      educationLevel: educationForm.educationLevel,
      attendanceRate: numberOrNull(educationForm.attendanceRate),
      progressPercent: progress,
      completionStatus: educationForm.completionStatus,
      notes: educationForm.notes || null,
      extendedJson: JSON.stringify({
        source: 'reintegration-action-plan',
        programName: educationForm.programName,
        courseName: educationForm.courseName,
        educationLevel: educationForm.educationLevel,
        attendanceStatus: educationForm.attendanceStatus,
        attendanceRate: educationForm.attendanceRate || null,
        completionStatus: educationForm.completionStatus,
        gpaLikeScore: educationForm.gpaLikeScore || null,
        notes: educationForm.notes || null,
      }),
    })
    setEducationForm({
      recordDate: isoToday(),
      programName: 'Bridge Program',
      courseName: 'Life Skills',
      educationLevel: 'Secondary',
      attendanceStatus: 'Present',
      attendanceRate: '',
      progressPercent: '',
      completionStatus: 'InProgress',
      gpaLikeScore: '',
      notes: '',
    })
    setNotice('Education update created.')
    await load()
  }

  const handleCreateProcessRecording = async () => {
    if (!resident) return
    if (!sessionForm.socialWorker.trim() || !sessionForm.narrative.trim()) {
      setNotice('Add both a social worker and session narrative before saving the process note.')
      return
    }
    await createProcessRecording({
      residentId: resident.id,
      sessionDate: sessionForm.sessionDate,
      socialWorker: sessionForm.socialWorker.trim(),
      sessionType: sessionForm.sessionType,
      sessionDurationMinutes: sessionForm.sessionDurationMinutes ? Number(sessionForm.sessionDurationMinutes) : undefined,
      emotionalStateObserved: sessionForm.emotionalStateObserved,
      emotionalStateEnd: sessionForm.emotionalStateEnd,
      sessionNarrative: sessionForm.narrative.trim(),
      interventionsApplied: sessionForm.interventionsApplied.trim(),
      followUpActions: sessionForm.followUpActions.trim(),
      progressNoted: sessionForm.progressNoted,
      concernsFlagged: sessionForm.concernsFlagged,
      referralMade: sessionForm.referralMade,
    })
    setSessionForm((current) => ({
      ...current,
      sessionDate: isoToday(),
      sessionDurationMinutes: '',
      emotionalStateObserved: 'Hopeful',
      emotionalStateEnd: 'Hopeful',
      narrative: '',
      interventionsApplied: '',
      followUpActions: '',
      progressNoted: true,
      concernsFlagged: false,
      referralMade: false,
    }))
    setNotice('Process note created.')
    await load()
  }

  const handleCreateVisit = async () => {
    if (!resident) return
    if (!visitForm.socialWorker.trim()) {
      setNotice('Add a social worker before scheduling the visit.')
      return
    }
    await createHomeVisitation({
      residentId: resident.id,
      visitDate: visitForm.visitDate,
      socialWorker: visitForm.socialWorker.trim(),
      visitType: visitForm.visitType,
      locationVisited: visitForm.locationVisited.trim(),
      familyMembersPresent: visitForm.familyMembersPresent.trim(),
      purpose: visitForm.purpose.trim(),
      observations: visitForm.observations.trim(),
      familyCooperationLevel: visitForm.familyCooperationLevel,
      safetyConcernsNoted: visitForm.safetyConcernsNoted,
      followUpNeeded: visitForm.followUpNeeded,
      followUpNotes: visitForm.followUpNotes.trim(),
      visitOutcome: visitForm.visitOutcome,
    })
    setVisitForm((current) => ({
      ...current,
      visitDate: isoToday(),
      locationVisited: '',
      familyMembersPresent: '',
      purpose: '',
      observations: '',
      familyCooperationLevel: 'Cooperative',
      safetyConcernsNoted: false,
      followUpNeeded: true,
      followUpNotes: '',
      visitOutcome: 'Needs Improvement',
    }))
    setNotice('Home visit scheduled.')
    await load()
  }

  const handleCreatePlan = async () => {
    if (!resident) return
    if (!plannerForm.description.trim()) {
      setNotice('Add a plan description before creating the plan.')
      return
    }
    await createInterventionPlan({
      residentId: resident.id,
      planCategory: plannerForm.category,
      planDescription: plannerForm.description.trim(),
      status: 'In Progress',
      targetDate: plannerForm.targetDate || null,
      caseConferenceDate: plannerForm.caseConferenceDate || null,
      servicesProvided: plannerForm.servicesProvided.trim() || null,
    })
    setPlannerForm({
      category: 'Reintegration',
      description: '',
      targetDate: '',
      caseConferenceDate: '',
      servicesProvided: '',
    })
    setPlannerPreset({
      category: 'Reintegration',
      description: '',
      targetDate: '',
      caseConferenceDate: '',
      servicesProvided: '',
    })
    setNotice('Intervention plan created.')
    await load()
  }

  const sortedHealth = [...healthRecords].sort((a, b) => b.recordDate.localeCompare(a.recordDate))
  const sortedEducation = [...educationRecords].sort((a, b) => b.recordDate.localeCompare(a.recordDate))
  const sortedIncidents = [...incidentReports].sort((a, b) => b.incidentDate.localeCompare(a.incidentDate))
  const sortedSessions = [...processRecordings].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
  const sortedVisits = [...homeVisits].sort((a, b) => b.visitDate.localeCompare(a.visitDate))
  const sortedPlans = [...plans].sort((a, b) => (b.targetDate ?? '').localeCompare(a.targetDate ?? ''))

  const renderExpandedSection = (section: SectionId) => {
    if (section === 'health-history') {
      return (
        <SectionPanel title="Health history" description="Fuller view of recorded health and wellbeing details." tone="health">
          {sortedHealth.length === 0 ? <p className="text-sm text-muted-foreground">No health records yet.</p> : (
            <div className="space-y-3">
              {sortedHealth.slice(0, 8).map((record) => {
                const extra = parseExtendedJson<HealthExtended>(record.extendedJson)
                const detailRows = compactFieldRows([
                  { label: 'Weight', value: record.weightKg ?? extra?.weightKg },
                  { label: 'Height', value: record.heightCm ?? extra?.heightCm },
                  { label: 'BMI', value: record.bmi ?? extra?.bmi },
                  { label: 'Nutrition', value: record.nutritionScore ?? extra?.nutritionScore },
                  { label: 'Sleep', value: record.sleepQualityScore ?? extra?.sleepScore },
                  { label: 'Energy', value: record.energyLevelScore ?? extra?.energyScore },
                  { label: 'Medical check', value: record.medicalCheckupDone ?? extra?.medicalCheckupDone },
                  { label: 'Dental check', value: record.dentalCheckupDone ?? extra?.dentalCheckupDone },
                  { label: 'Psych check', value: record.psychologicalCheckupDone ?? extra?.psychologicalCheckupDone },
                ])
                return (
                  <div key={record.id} className="rounded-lg border border-border bg-background px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{record.recordDate.slice(0, 10)} · General health {record.healthScore?.toFixed(2) ?? '—'}</p>
                    {detailRows.length > 0 ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
                        {detailRows.map((field) => (
                          <span key={field.label}>{field.label}: {displayValue(field.value)}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">Older health records only include the summary general health score.</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">{record.notes?.trim() || extra?.notes?.trim() || 'No additional notes recorded.'}</p>
                  </div>
                )
              })}
            </div>
          )}
        </SectionPanel>
      )
    }
    if (section === 'health-form') {
      return (
        <SectionPanel title="Create health assessment" description="Capture the relevant health and wellbeing fields in one place." tone="health">
          <div className="grid gap-3 md:grid-cols-2">
            <label className={label}>
              Assessment date
              <input type="date" className={input} value={healthForm.recordDate} onChange={(e) => setHealthForm((c) => ({ ...c, recordDate: e.target.value }))} />
            </label>
            <label className={label}>
              General health score
              <input className={input} value={healthForm.generalHealthScore} onChange={(e) => setHealthForm((c) => ({ ...c, generalHealthScore: e.target.value }))} placeholder="1.0 - 5.0" />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className={label}>
              Weight (kg)
              <input className={input} value={healthForm.weightKg} onChange={(e) => setHealthForm((c) => ({ ...c, weightKg: e.target.value }))} />
            </label>
            <label className={label}>
              Height (cm)
              <input className={input} value={healthForm.heightCm} onChange={(e) => setHealthForm((c) => ({ ...c, heightCm: e.target.value }))} />
            </label>
            <label className={label}>
              BMI
              <input className={input} value={healthForm.bmi} onChange={(e) => setHealthForm((c) => ({ ...c, bmi: e.target.value }))} />
            </label>
            <label className={label}>
              Nutrition score
              <input className={input} value={healthForm.nutritionScore} onChange={(e) => setHealthForm((c) => ({ ...c, nutritionScore: e.target.value }))} placeholder="1.0 - 5.0" />
            </label>
            <label className={label}>
              Sleep score
              <input className={input} value={healthForm.sleepScore} onChange={(e) => setHealthForm((c) => ({ ...c, sleepScore: e.target.value }))} placeholder="1.0 - 5.0" />
            </label>
            <label className={label}>
              Energy score
              <input className={input} value={healthForm.energyScore} onChange={(e) => setHealthForm((c) => ({ ...c, energyScore: e.target.value }))} placeholder="1.0 - 5.0" />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-foreground">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={healthForm.medicalCheckupDone} onChange={(e) => setHealthForm((c) => ({ ...c, medicalCheckupDone: e.target.checked }))} />
              Medical check-up done
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={healthForm.dentalCheckupDone} onChange={(e) => setHealthForm((c) => ({ ...c, dentalCheckupDone: e.target.checked }))} />
              Dental check-up done
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={healthForm.psychologicalCheckupDone} onChange={(e) => setHealthForm((c) => ({ ...c, psychologicalCheckupDone: e.target.checked }))} />
              Psychological check-up done
            </label>
          </div>
          <label className={label}>
            Notes
            <textarea className={input} rows={4} value={healthForm.notes} onChange={(e) => setHealthForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Assessment findings, restrictions, referrals, follow-up care…" />
          </label>
          <button type="button" className={btnPrimary} onClick={() => void handleCreateHealthRecord()}>
            Save health assessment
          </button>
        </SectionPanel>
      )
    }
    if (section === 'education-history') {
      return (
        <SectionPanel title="Education history" description="Current and past education records with fuller details." tone="education">
          {sortedEducation.length === 0 ? <p className="text-sm text-muted-foreground">No education records yet.</p> : (
            <div className="space-y-3">
              {sortedEducation.slice(0, 8).map((record) => {
                const extra = parseExtendedJson<EducationExtended>(record.extendedJson)
                const detailRows = compactFieldRows([
                  { label: 'School / program', value: record.schoolName ?? extra?.programName },
                  { label: 'Course', value: extra?.courseName },
                  { label: 'Level', value: record.educationLevel ?? extra?.educationLevel },
                  { label: 'Enrollment status', value: record.enrollmentStatus ?? extra?.attendanceStatus },
                  { label: 'Attendance rate', value: record.attendanceRate ?? extra?.attendanceRate },
                  { label: 'Completion', value: record.completionStatus ?? extra?.completionStatus },
                  { label: 'GPA-like score', value: extra?.gpaLikeScore },
                ])
                return (
                  <div key={record.id} className="rounded-lg border border-border bg-background px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{record.recordDate.slice(0, 10)} · Progress {record.progressPercent?.toFixed(1) ?? '—'}%</p>
                    {detailRows.length > 0 ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
                        {detailRows.map((field) => (
                          <span key={field.label}>{field.label}: {displayValue(field.value)}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">Older education records only include the summary progress percent.</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">{record.notes?.trim() || extra?.notes?.trim() || 'No additional notes recorded.'}</p>
                  </div>
                )
              })}
            </div>
          )}
        </SectionPanel>
      )
    }
    if (section === 'education-form') {
      return (
        <SectionPanel title="Log education update" description="Use the education fields relevant to attendance, progress, and completion." tone="education">
          <div className="grid gap-3 md:grid-cols-3">
            <label className={label}>
              Record date
              <input type="date" className={input} value={educationForm.recordDate} onChange={(e) => setEducationForm((c) => ({ ...c, recordDate: e.target.value }))} />
            </label>
            <label className={label}>
              Program
              <select className={input} value={educationForm.programName} onChange={(e) => setEducationForm((c) => ({ ...c, programName: e.target.value }))}>
                {['Bridge Program', 'Secondary Support', 'Vocational Skills', 'Literacy Boost'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={label}>
              Course
              <select className={input} value={educationForm.courseName} onChange={(e) => setEducationForm((c) => ({ ...c, courseName: e.target.value }))}>
                {['Math', 'English', 'Science', 'Life Skills', 'Computer Basics', 'Livelihood'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={label}>
              Education level
              <select className={input} value={educationForm.educationLevel} onChange={(e) => setEducationForm((c) => ({ ...c, educationLevel: e.target.value }))}>
                {['Primary', 'Secondary', 'Vocational', 'CollegePrep'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={label}>
              Attendance status
              <select className={input} value={educationForm.attendanceStatus} onChange={(e) => setEducationForm((c) => ({ ...c, attendanceStatus: e.target.value }))}>
                {['Present', 'Late', 'Absent'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={label}>
              Attendance rate
              <input className={input} value={educationForm.attendanceRate} onChange={(e) => setEducationForm((c) => ({ ...c, attendanceRate: e.target.value }))} placeholder="0.0 - 1.0" />
            </label>
            <label className={label}>
              Progress percent
              <input className={input} value={educationForm.progressPercent} onChange={(e) => setEducationForm((c) => ({ ...c, progressPercent: e.target.value }))} placeholder="0 - 100" />
            </label>
            <label className={label}>
              Completion status
              <select className={input} value={educationForm.completionStatus} onChange={(e) => setEducationForm((c) => ({ ...c, completionStatus: e.target.value }))}>
                {['NotStarted', 'InProgress', 'Completed'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={label}>
              GPA-like score
              <input className={input} value={educationForm.gpaLikeScore} onChange={(e) => setEducationForm((c) => ({ ...c, gpaLikeScore: e.target.value }))} placeholder="1.0 - 5.0" />
            </label>
          </div>
          <label className={label}>
            Notes
            <textarea className={input} rows={4} value={educationForm.notes} onChange={(e) => setEducationForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Program notes, tutoring actions, school concerns, teacher feedback…" />
          </label>
          <button type="button" className={btnPrimary} onClick={() => void handleCreateEducationRecord()}>
            Save education update
          </button>
        </SectionPanel>
      )
    }
    if (section === 'session-history') {
      return (
        <SectionPanel title="Session history" description="Fuller counseling session details." tone="default">
          {sortedSessions.length === 0 ? <p className="text-sm text-muted-foreground">No counseling sessions yet.</p> : (
            <div className="space-y-3">
              {sortedSessions.slice(0, 8).map((record) => (
                <div key={record.id} className="rounded-lg border border-border bg-background px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{record.sessionDate.slice(0, 10)} · {record.sessionType}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
                    <span>Worker: {record.socialWorker}</span>
                    <span>Duration: {displayValue(record.sessionDurationMinutes)}</span>
                    <span>Referral: {displayValue(record.referralMade)}</span>
                    <span>Start state: {displayValue(record.emotionalStateObserved)}</span>
                    <span>End state: {displayValue(record.emotionalStateEnd)}</span>
                    <span>Concerns: {displayValue(record.concernsFlagged)}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{record.sessionNarrative}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Interventions: {record.interventionsApplied ?? '—'} · Follow-up: {record.followUpActions ?? '—'}</p>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      )
    }
    if (section === 'session-form') {
      return (
        <SectionPanel title="Add counseling session" description="Capture the counseling session fields used by the program.">
          <div className="grid gap-3 md:grid-cols-3">
            <label className={label}>
              Session date
              <input type="date" className={input} value={sessionForm.sessionDate} onChange={(e) => setSessionForm((c) => ({ ...c, sessionDate: e.target.value }))} />
            </label>
            <label className={label}>
              Social worker
              <input className={input} value={sessionForm.socialWorker} onChange={(e) => setSessionForm((c) => ({ ...c, socialWorker: e.target.value }))} />
            </label>
            <label className={label}>
              Duration (minutes)
              <input className={input} value={sessionForm.sessionDurationMinutes} onChange={(e) => setSessionForm((c) => ({ ...c, sessionDurationMinutes: e.target.value }))} />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className={label}>
              Session type
              <select className={input} value={sessionForm.sessionType} onChange={(e) => setSessionForm((c) => ({ ...c, sessionType: e.target.value }))}>
                {['Individual', 'Group'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={label}>
              Emotional state observed
              <select className={input} value={sessionForm.emotionalStateObserved} onChange={(e) => setSessionForm((c) => ({ ...c, emotionalStateObserved: e.target.value }))}>
                {['Calm', 'Anxious', 'Sad', 'Angry', 'Hopeful', 'Withdrawn', 'Happy', 'Distressed'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={label}>
              Emotional state end
              <select className={input} value={sessionForm.emotionalStateEnd} onChange={(e) => setSessionForm((c) => ({ ...c, emotionalStateEnd: e.target.value }))}>
                {['Calm', 'Anxious', 'Sad', 'Angry', 'Hopeful', 'Withdrawn', 'Happy', 'Distressed'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <label className={label}>
            Session narrative
            <textarea className={input} rows={4} value={sessionForm.narrative} onChange={(e) => setSessionForm((c) => ({ ...c, narrative: e.target.value }))} />
          </label>
          <label className={label}>
            Interventions applied
            <textarea className={input} rows={3} value={sessionForm.interventionsApplied} onChange={(e) => setSessionForm((c) => ({ ...c, interventionsApplied: e.target.value }))} />
          </label>
          <label className={label}>
            Follow-up actions
            <textarea className={input} rows={3} value={sessionForm.followUpActions} onChange={(e) => setSessionForm((c) => ({ ...c, followUpActions: e.target.value }))} />
          </label>
          <div className="flex flex-wrap gap-4 text-sm text-foreground">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sessionForm.progressNoted} onChange={(e) => setSessionForm((c) => ({ ...c, progressNoted: e.target.checked }))} />
              Progress noted
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sessionForm.concernsFlagged} onChange={(e) => setSessionForm((c) => ({ ...c, concernsFlagged: e.target.checked }))} />
              Concerns flagged
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sessionForm.referralMade} onChange={(e) => setSessionForm((c) => ({ ...c, referralMade: e.target.checked }))} />
              Referral made
            </label>
          </div>
          <button type="button" className={btnPrimary} onClick={() => void handleCreateProcessRecording()}>
            Save process note
          </button>
        </SectionPanel>
      )
    }
    if (section === 'incident-history') {
      return (
        <SectionPanel title="Incident history" description="Granular incident details that matter for readiness review." tone="risk">
          {sortedIncidents.length === 0 ? <p className="text-sm text-muted-foreground">No incident reports yet.</p> : (
            <div className="space-y-3">
              {sortedIncidents.slice(0, 8).map((incident) => (
                <div key={incident.id} className="rounded-lg border border-border bg-background px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{incident.incidentDate.slice(0, 10)} · {incident.incidentType} · {incident.severity}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
                    <span>Status: {incident.resolved ? 'Resolved' : 'Open'}</span>
                    <span>Follow-up: {incident.followUpRequired ? 'Required' : 'Not required'}</span>
                    <span>Reported by: {incident.reportedBy ?? '—'}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{incident.description ?? 'No description recorded.'}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Response: {incident.responseTaken ?? '—'} · Resolution date: {incident.resolutionDate?.slice(0, 10) ?? '—'}</p>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      )
    }
    if (section === 'visit-history') {
      return (
        <SectionPanel title="Visit history" description="Home and field visit details tied to reintegration planning.">
          {sortedVisits.length === 0 ? <p className="text-sm text-muted-foreground">No home visits yet.</p> : (
            <div className="space-y-3">
              {sortedVisits.slice(0, 8).map((visit) => (
                <div key={visit.id} className="rounded-lg border border-border bg-background px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{visit.visitDate.slice(0, 10)} · {visit.visitType}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
                    <span>Worker: {visit.socialWorker}</span>
                    <span>Cooperation: {visit.familyCooperationLevel ?? '—'}</span>
                    <span>Outcome: {visit.visitOutcome ?? '—'}</span>
                    <span>Location: {visit.locationVisited ?? '—'}</span>
                    <span>Present: {visit.familyMembersPresent ?? '—'}</span>
                    <span>Safety concerns: {visit.safetyConcernsNoted ? 'Yes' : 'No'}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{visit.observations ?? visit.purpose ?? 'No observations recorded.'}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Follow-up notes: {visit.followUpNotes ?? '—'}</p>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      )
    }
    if (section === 'visit-form') {
      return (
        <SectionPanel title="Schedule home visit" description="Use the core home visitation fields without leaving this page.">
          <div className="grid gap-3 md:grid-cols-2">
            <label className={label}>
              Visit date
              <input type="date" className={input} value={visitForm.visitDate} onChange={(e) => setVisitForm((c) => ({ ...c, visitDate: e.target.value }))} />
            </label>
            <label className={label}>
              Social worker
              <input className={input} value={visitForm.socialWorker} onChange={(e) => setVisitForm((c) => ({ ...c, socialWorker: e.target.value }))} />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className={label}>
              Visit type
              <select className={input} value={visitForm.visitType} onChange={(e) => setVisitForm((c) => ({ ...c, visitType: e.target.value }))}>
                {['Initial Assessment', 'Routine Follow-Up', 'Reintegration Assessment', 'Post-Placement Monitoring', 'Emergency'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={label}>
              Location visited
              <input className={input} value={visitForm.locationVisited} onChange={(e) => setVisitForm((c) => ({ ...c, locationVisited: e.target.value }))} />
            </label>
            <label className={label}>
              Family members present
              <input className={input} value={visitForm.familyMembersPresent} onChange={(e) => setVisitForm((c) => ({ ...c, familyMembersPresent: e.target.value }))} />
            </label>
          </div>
          <label className={label}>
            Purpose
            <textarea className={input} rows={3} value={visitForm.purpose} onChange={(e) => setVisitForm((c) => ({ ...c, purpose: e.target.value }))} />
          </label>
          <label className={label}>
            Observations
            <textarea className={input} rows={3} value={visitForm.observations} onChange={(e) => setVisitForm((c) => ({ ...c, observations: e.target.value }))} />
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className={label}>
              Family cooperation
              <select className={input} value={visitForm.familyCooperationLevel} onChange={(e) => setVisitForm((c) => ({ ...c, familyCooperationLevel: e.target.value }))}>
                {['Highly Cooperative', 'Cooperative', 'Neutral', 'Uncooperative'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={label}>
              Visit outcome
              <select className={input} value={visitForm.visitOutcome} onChange={(e) => setVisitForm((c) => ({ ...c, visitOutcome: e.target.value }))}>
                {['Favorable', 'Needs Improvement', 'Unfavorable', 'Inconclusive'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={label}>
              Follow-up notes
              <input className={input} value={visitForm.followUpNotes} onChange={(e) => setVisitForm((c) => ({ ...c, followUpNotes: e.target.value }))} />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-foreground">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={visitForm.followUpNeeded} onChange={(e) => setVisitForm((c) => ({ ...c, followUpNeeded: e.target.checked }))} />
              Follow-up needed
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={visitForm.safetyConcernsNoted} onChange={(e) => setVisitForm((c) => ({ ...c, safetyConcernsNoted: e.target.checked }))} />
              Safety concerns noted
            </label>
          </div>
          <button type="button" className={btnPrimary} onClick={() => void handleCreateVisit()}>
            Save home visit
          </button>
        </SectionPanel>
      )
    }

    return (
      <SectionPanel title="Plan builder" description="Build a targeted intervention plan using the current blocker as context.">
        <div className="grid gap-3 md:grid-cols-2">
          <label className={label}>
            Plan category
            <select className={input} value={plannerForm.category} onChange={(e) => setPlannerForm((c) => ({ ...c, category: e.target.value }))}>
              {['Safety', 'Psychosocial', 'Education', 'Physical Health', 'Legal', 'Reintegration'].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className={label}>
            Target date
            <input type="date" className={input} value={plannerForm.targetDate} onChange={(e) => setPlannerForm((c) => ({ ...c, targetDate: e.target.value }))} />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className={label}>
            Case conference date
            <input type="date" className={input} value={plannerForm.caseConferenceDate} onChange={(e) => setPlannerForm((c) => ({ ...c, caseConferenceDate: e.target.value }))} />
          </label>
          <label className={label}>
            Services provided
            <input className={input} value={plannerForm.servicesProvided} onChange={(e) => setPlannerForm((c) => ({ ...c, servicesProvided: e.target.value }))} />
          </label>
        </div>
        <label className={label}>
          Plan description
          <textarea className={input} rows={4} value={plannerForm.description} onChange={(e) => setPlannerForm((c) => ({ ...c, description: e.target.value }))} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} onClick={() => void handleCreatePlan()}>
            Create intervention plan
          </button>
          <button
            type="button"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            onClick={() => {
              setPlannerForm({
                category: 'Reintegration',
                description: '',
                targetDate: '',
                caseConferenceDate: '',
                servicesProvided: '',
              })
              setPlannerPreset({
                category: 'Reintegration',
                description: '',
                targetDate: '',
                caseConferenceDate: '',
                servicesProvided: '',
              })
            }}
          >
            Clear template
          </button>
        </div>
        <div className="rounded-xl border border-border bg-background px-4 py-4">
          <h3 className="text-sm font-semibold text-foreground">Existing plans</h3>
          {sortedPlans.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No intervention plans yet.</p> : (
            <div className="mt-3 space-y-2">
              {sortedPlans.slice(0, 8).map((plan) => (
                <div key={plan.id} className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                  <p className="text-sm font-medium text-foreground">{plan.planCategory} · {plan.status}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.planDescription}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Services: {plan.servicesProvided ?? '—'} · Target value: {plan.targetValue ?? '—'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Target {plan.targetDate ? plan.targetDate.slice(0, 10) : '—'} · Conference {plan.caseConferenceDate ? plan.caseConferenceDate.slice(0, 10) : '—'} · Updated {plan.updatedAt.slice(0, 10)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionPanel>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className={`${card} animate-pulse h-28`} />
        <div className={`${card} animate-pulse h-96`} />
      </div>
    )
  }

  if (error || !resident || !actionPlan) {
    return <div className={alertError}>{error ?? 'Unable to load reintegration action plan.'}</div>
  }

  const detailFields = residentDetail?.fields ?? null
  const prediction = deriveReadinessPrediction(resident.readiness.reintegration_probability)
  const completedChecklist = actionPlan.checklist.filter((item) => item.done).length

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reintegration</p>
          <h1 className={pageTitle}>Action Plan for {resident.internalCode}</h1>
          <p className={pageDesc}>A fuller case workspace that uses the underlying records to support reintegration decisions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted" onClick={() => void load()}>
            Refresh
          </button>
          <Link to="/admin/reintigration-readiness" className={btnPrimary}>
            Back to readiness list
          </Link>
        </div>
      </div>

      {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}

      <section className={`${card} space-y-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Resident action plan</p>
            <div>
              <h2 className="font-heading text-3xl font-bold text-foreground">{resident.internalCode}</h2>
              <p className="mt-2 text-base text-muted-foreground">
                {resident.safehouseName ?? 'No safehouse'}{resident.assignedSocialWorker ? ` • ${resident.assignedSocialWorker}` : ''}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Case {resident.caseControlNo} • {prediction} readiness
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/admin/residents/${resident.id}`} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
              Open full resident page
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-primary/20 bg-card px-4 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Readiness score</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{Math.round(resident.readiness.reintegration_probability * 100)}%</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Safehouse</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{resident.safehouseName ?? 'Not assigned'}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Length of stay</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{displayValue(residentField(detailFields, 'length_of_stay', 'lengthOfStay'))}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reintegration risk</p>
            <p className="mt-2 text-sm font-medium text-foreground">{resident.currentRiskLevel ?? 'No current risk label'}</p>
          </div>
        </div>

        <p className="rounded-xl border border-border bg-muted/30 px-4 py-4 text-sm leading-relaxed text-muted-foreground">
          {readinessNarrative(resident)}
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_20rem]">
        <div className="space-y-4">
          <div className={`${card} space-y-4`}>
            <div>
              <h2 className="text-base font-semibold text-foreground">Priority blockers</h2>
              <p className="mt-1 text-sm text-muted-foreground">Each blocker opens richer history or form details inline, using the relevant fields from the program records.</p>
            </div>
            {resident.readiness.top_improvements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No major blockers surfaced in the latest model run.</p>
            ) : (
              resident.readiness.top_improvements.map((area, index) => {
                const themeClass =
                  area.feature.includes('health') || area.feature.includes('psych')
                    ? 'border-border bg-card'
                    : area.feature.includes('progress') || area.feature.includes('attendance')
                      ? 'border-border bg-card'
                      : area.feature.includes('incident')
                        ? 'border-border bg-card'
                        : 'border-border bg-card'
                const priorityAccent =
                  area.feature.includes('health') || area.feature.includes('psych')
                    ? 'bg-emerald-500'
                    : area.feature.includes('progress') || area.feature.includes('attendance')
                      ? 'bg-sky-500'
                      : area.feature.includes('incident')
                        ? 'bg-amber-500'
                        : 'bg-primary'
                return (
                  <div key={area.feature} className={`rounded-xl border px-4 py-4 shadow-sm ${themeClass}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${priorityAccent}`} />
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Priority {index + 1}</p>
                          <h3 className="mt-1 text-base font-semibold text-foreground">{area.label}</h3>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>{formatFeatureValue(area.feature, area.resident_value)} current</div>
                        <div>{formatFeatureValue(area.feature, area.benchmark_value)} target</div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-foreground">{area.suggestion}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {actionConfig(area).map((action) => {
                        const isActive = expandedBlocker === area.feature && expandedSection === action.section
                        return (
                          <button
                            key={`${area.feature}-${action.label}`}
                            type="button"
                            className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                              isActive
                                ? 'border-primary/30 bg-muted text-foreground'
                                : 'border-border bg-background text-foreground hover:bg-muted'
                            }`}
                            onClick={() => handlePriorityAction(area.feature, action)}
                          >
                            {action.label}
                          </button>
                        )
                      })}
                    </div>
                    {expandedBlocker === area.feature ? renderExpandedSection(expandedSection) : null}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className={`${card} sticky top-24 h-fit space-y-4`}>
          <div>
            <h2 className="text-base font-semibold text-foreground">Action checklist</h2>
            <p className="mt-1 text-sm text-muted-foreground">Keep the immediate reintegration steps visible while you work through the blockers.</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Checklist progress</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{completedChecklist}/{actionPlan.checklist.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Actions completed</p>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {actionPlan.lastReviewedAt ? `Last reviewed ${new Date(actionPlan.lastReviewedAt).toLocaleString()}` : 'No review has been logged yet.'}
            </p>
            <button type="button" className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50" onClick={() => updateActionPlan({ ...actionPlan, lastReviewedAt: new Date().toISOString() })}>
              Mark reviewed today
            </button>
          </div>
          <ul className="space-y-2">
            {actionPlan.checklist.map((item) => (
              <li key={item.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition ${item.done ? 'border-primary/20 bg-muted/20' : 'border-border bg-background'}`}>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) =>
                    updateActionPlan({
                      ...actionPlan,
                      checklist: actionPlan.checklist.map((entry) => entry.id === item.id ? { ...entry, done: e.target.checked } : entry),
                    })
                  }
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <span className={item.done ? 'text-muted-foreground line-through' : 'text-foreground'}>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
