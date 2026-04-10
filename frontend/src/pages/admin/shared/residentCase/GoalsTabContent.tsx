import { useMemo, useState } from 'react'
import type { EducationRecord, HealthRecord, HomeVisitation, InterventionPlan, JsonTableRow } from '../../../../api/admin'
import { card } from '../adminStyles'
import { formatAdminDate } from '../adminDataTable/adminFormatters'
import { CategoryBadge, StatusBadge } from '../adminDataTable/AdminBadges'
import { EducationSection, HealthSection } from './CareProgressContent'
import { EmptyState, QuickActionButton, RecordCardRow, SearchField, SectionHeader } from './caseUi'

type GoalKey = 'health' | 'education' | 'safety'

type GoalMetric = {
  key: GoalKey
  label: string
  target: number
  current: number | null
  currentLabel: string
  targetLabel: string
  detail: string
  plan: InterventionPlan | null
  sourceNote: string
}

const DEFAULT_TARGETS: Record<GoalKey, number> = {
  health: 4.2,
  education: 0.85,
  safety: 4.2,
}

function byNewestDate<T>(rows: T[], pickDate: (row: T) => string | null | undefined): T[] {
  return [...rows].sort((a, b) => {
    const ta = pickDate(a) ? new Date(pickDate(a)!).getTime() : 0
    const tb = pickDate(b) ? new Date(pickDate(b)!).getTime() : 0
    return tb - ta
  })
}

function findLatestPlan(plans: InterventionPlan[], categories: string[]): InterventionPlan | null {
  const wanted = new Set(categories.map((value) => value.trim().toLowerCase()))
  return (
    byNewestDate(
      plans.filter((plan) => wanted.has(plan.planCategory.trim().toLowerCase())),
      (plan) => plan.updatedAt || plan.createdAt || plan.targetDate,
    )[0] ?? null
  )
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

function formatScale(value: number | null, digits = 1): string {
  return value == null ? 'No score yet' : value.toFixed(digits)
}

function formatAttendance(value: number | null): string {
  return value == null ? 'No attendance yet' : `${Math.round(value * 100)}%`
}

function severityPenalty(value: string): number {
  const s = value.trim().toLowerCase()
  if (s === 'high') return 0.95
  if (s === 'medium') return 0.55
  if (s === 'low') return 0.25
  return 0.4
}

function deriveSafetyScore(visitations: HomeVisitation[], incidents: JsonTableRow[]): number | null {
  if (visitations.length === 0 && incidents.length === 0) return null
  let score = 5

  for (const incident of byNewestDate(incidents, (row) => row.fields.incident_date).slice(0, 5)) {
    const fields = incident.fields
    const unresolved = (fields.resolved ?? '').toLowerCase() !== 'true'
    if (!unresolved) continue
    score -= severityPenalty(fields.severity ?? '')
  }

  for (const visit of byNewestDate(visitations, (row) => row.visitDate).slice(0, 3)) {
    if (visit.safetyConcernsNoted) score -= 0.55
    if (visit.followUpNeeded) score -= 0.25
    const outcome = (visit.visitOutcome ?? '').trim().toLowerCase()
    if (outcome === 'unfavorable') score -= 0.35
    else if (outcome === 'needs improvement') score -= 0.15
  }

  return clamp(Number(score.toFixed(2)), 1, 5)
}

function summarizeSafetySignal(row: { type: 'incident' | 'visit'; id: number; date: string; title: string; summary: string; detail: string[] }) {
  return row
}

function GoalCircle({
  metric,
  active,
  onClick,
}: {
  metric: GoalMetric
  active: boolean
  onClick: () => void
}) {
  const ratio = metric.current == null || metric.target <= 0 ? 0 : clamp(metric.current / metric.target, 0, 1)
  const size = 176
  const radius = 62
  const circumference = 2 * Math.PI * radius
  const dash = circumference * (1 - ratio)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-all ${
        active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:bg-muted/40'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="10" />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dash}
              className="text-primary"
            />
          </svg>
          <div className="-mt-[7.6rem] flex h-[9.25rem] w-[9.25rem] flex-col items-center justify-center text-center">
            <div className="text-3xl font-semibold tabular-nums text-foreground">
              {metric.key === 'education'
                ? metric.current != null
                  ? metric.current.toFixed(2)
                  : '—'
                : metric.current != null
                  ? metric.current.toFixed(1)
                  : '—'}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Current</div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{metric.detail}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Current: {metric.currentLabel}
            {' · '}
            Goal: {metric.targetLabel}
          </p>
          {metric.plan ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CategoryBadge>{metric.plan.planCategory}</CategoryBadge>
              <StatusBadge status={metric.plan.status} />
            </div>
          ) : null}
        </div>
      </div>
    </button>
  )
}

export function GoalsTabContent({
  residentId,
  plans,
  education,
  health,
  visitations,
  incidents,
  onReload,
  openCreateSignals,
  onOpenIncident,
}: {
  residentId: number
  plans: InterventionPlan[]
  education: EducationRecord[]
  health: HealthRecord[]
  visitations: HomeVisitation[]
  incidents: JsonTableRow[]
  onReload: () => void
  openCreateSignals: { education: number; health: number; plan: number }
  onOpenIncident: () => void
}) {
  const [activeGoal, setActiveGoal] = useState<GoalKey>('health')
  const [safetySearch, setSafetySearch] = useState('')
  const [expandedSafetyKey, setExpandedSafetyKey] = useState<string | null>(null)

  const latestHealth = useMemo(() => byNewestDate(health, (row) => row.recordDate)[0] ?? null, [health])
  const latestEducation = useMemo(() => byNewestDate(education, (row) => row.recordDate)[0] ?? null, [education])

  const healthPlan = useMemo(() => findLatestPlan(plans, ['Physical Health', 'Health']), [plans])
  const educationPlan = useMemo(() => findLatestPlan(plans, ['Education']), [plans])
  const safetyPlan = useMemo(() => findLatestPlan(plans, ['Safety']), [plans])

  const safetyScore = useMemo(() => deriveSafetyScore(visitations, incidents), [visitations, incidents])

  const metrics = useMemo<Record<GoalKey, GoalMetric>>(
    () => ({
      health: {
        key: 'health',
        label: 'Health goal',
        target: healthPlan?.targetValue ?? DEFAULT_TARGETS.health,
        current: latestHealth?.healthScore ?? null,
        currentLabel: formatScale(latestHealth?.healthScore ?? null),
        targetLabel: formatScale(healthPlan?.targetValue ?? DEFAULT_TARGETS.health),
        detail: latestHealth ? `Latest wellbeing on ${formatAdminDate(latestHealth.recordDate)}` : 'Waiting on the first wellbeing record',
        plan: healthPlan,
        sourceNote: 'Goal comes from the latest physical-health intervention plan; progress uses the newest overall wellbeing score.',
      },
      education: {
        key: 'education',
        label: 'Education goal',
        target: educationPlan?.targetValue ?? DEFAULT_TARGETS.education,
        current: latestEducation?.attendanceRate ?? null,
        currentLabel: formatAttendance(latestEducation?.attendanceRate ?? null),
        targetLabel: formatAttendance(educationPlan?.targetValue ?? DEFAULT_TARGETS.education),
        detail: latestEducation ? `Latest attendance on ${formatAdminDate(latestEducation.recordDate)}` : 'Waiting on the first education record',
        plan: educationPlan,
        sourceNote: 'Goal comes from the latest education intervention plan; progress uses the newest attendance-rate value.',
      },
      safety: {
        key: 'safety',
        label: 'Safety goal',
        target: safetyPlan?.targetValue ?? DEFAULT_TARGETS.safety,
        current: safetyScore,
        currentLabel: formatScale(safetyScore),
        targetLabel: formatScale(safetyPlan?.targetValue ?? DEFAULT_TARGETS.safety),
        detail: safetyScore != null ? 'Derived from recent incidents and safety-related home visits' : 'Waiting on safety activity',
        plan: safetyPlan,
        sourceNote: 'No dedicated safety score exists in the current schema, so this view derives a safety score from the latest unresolved incidents and home-visit safety flags.',
      },
    }),
    [educationPlan, healthPlan, latestEducation, latestHealth, safetyPlan, safetyScore],
  )

  const safetyRows = useMemo(() => {
    const incidentRows = incidents.map((row) =>
      summarizeSafetySignal({
        type: 'incident',
        id: row.id,
        date: row.fields.incident_date ?? '',
        title: row.fields.incident_type ? `${row.fields.incident_type} incident` : 'Incident report',
        summary: [row.fields.severity, row.fields.reported_by].filter(Boolean).join(' · '),
        detail: [
          row.fields.description ? `Description: ${row.fields.description}` : '',
          row.fields.response_taken ? `Response: ${row.fields.response_taken}` : '',
          row.fields.follow_up_required === 'True' || row.fields.follow_up_required === 'true' ? 'Follow-up required' : '',
          row.fields.resolved === 'True' || row.fields.resolved === 'true' ? 'Resolved' : 'Open',
        ].filter(Boolean),
      }),
    )
    const visitRows = visitations.map((row) =>
      summarizeSafetySignal({
        type: 'visit',
        id: row.id,
        date: row.visitDate,
        title: row.visitType,
        summary: [
          row.safetyConcernsNoted ? 'Safety concerns noted' : 'No safety concerns noted',
          row.followUpNeeded ? 'Follow-up needed' : null,
        ]
          .filter(Boolean)
          .join(' · '),
        detail: [
          row.locationVisited ? `Location: ${row.locationVisited}` : '',
          row.observations ? `Observations: ${row.observations}` : '',
          row.followUpNotes ? `Follow-up: ${row.followUpNotes}` : '',
          row.visitOutcome ? `Outcome: ${row.visitOutcome}` : '',
        ].filter(Boolean),
      }),
    )
    return byNewestDate([...incidentRows, ...visitRows], (row) => row.date)
  }, [incidents, visitations])

  const filteredSafetyRows = useMemo(() => {
    if (!safetySearch.trim()) return safetyRows
    const s = safetySearch.trim().toLowerCase()
    return safetyRows.filter((row) =>
      [row.title, row.summary, ...row.detail].some((value) => value.toLowerCase().includes(s)),
    )
  }, [safetyRows, safetySearch])

  const activeMetric = metrics[activeGoal]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Goals"
        description="Use the latest intervention-plan targets against the newest health, education, and safety information for this resident."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {(['health', 'education', 'safety'] as GoalKey[]).map((goal) => (
          <GoalCircle key={goal} metric={metrics[goal]} active={activeGoal === goal} onClick={() => setActiveGoal(goal)} />
        ))}
      </div>

      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">{activeMetric.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{activeMetric.sourceNote}</p>
          </div>
          {activeMetric.plan ? (
            <div className="text-sm text-muted-foreground">
              {activeMetric.plan.targetDate ? `Target date ${formatAdminDate(activeMetric.plan.targetDate)}` : 'No target date'}
            </div>
          ) : null}
        </div>
        {activeMetric.plan ? (
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge>{activeMetric.plan.planCategory}</CategoryBadge>
              <StatusBadge status={activeMetric.plan.status} />
            </div>
            <p className="mt-2 text-sm text-foreground">{activeMetric.plan.planDescription}</p>
            {activeMetric.plan.servicesProvided ? (
              <p className="mt-2 text-sm text-muted-foreground">{activeMetric.plan.servicesProvided}</p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground">
            No matching intervention-plan target was found for this goal, so the default target value is being shown.
          </div>
        )}
      </div>

      {activeGoal === 'health' ? (
        <HealthSection residentId={residentId} rows={health} onReload={onReload} openCreateSignal={openCreateSignals.health} />
      ) : null}

      {activeGoal === 'education' ? (
        <EducationSection
          residentId={residentId}
          rows={education}
          onReload={onReload}
          openCreateSignal={openCreateSignals.education}
        />
      ) : null}

      {activeGoal === 'safety' ? (
        <div className="space-y-6">
          <div className={`${card} space-y-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">Safety signals</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Recent incident reports and home-visit safety notes feed the safety goal summary.
                </p>
              </div>
              <QuickActionButton onClick={onOpenIncident}>Log incident</QuickActionButton>
            </div>
            <div className="max-w-sm">
              <SearchField value={safetySearch} onChange={setSafetySearch} placeholder="Search incidents, visits, notes…" />
            </div>
            {filteredSafetyRows.length === 0 ? (
              <EmptyState
                title={safetyRows.length === 0 ? 'No safety activity yet' : 'No safety activity matches search'}
                hint="Incident reports and home visits with safety flags will appear here."
              />
            ) : (
              <div className="space-y-2">
                {filteredSafetyRows.map((row) => {
                  const key = `${row.type}-${row.id}`
                  const expanded = expandedSafetyKey === key
                  return (
                    <RecordCardRow
                      key={key}
                      onClick={() => setExpandedSafetyKey((current) => (current === key ? null : key))}
                      highlight={row.type === 'incident'}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{row.title}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {row.date ? formatAdminDate(row.date) : 'Unknown date'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{row.summary || 'Open to view details.'}</p>
                      {expanded ? (
                        <div className="mt-3 space-y-1 text-sm text-foreground">
                          {row.detail.map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                        </div>
                      ) : null}
                    </RecordCardRow>
                  )
                })}
              </div>
            )}
          </div>


        </div>
      ) : null}
    </div>
  )
}
