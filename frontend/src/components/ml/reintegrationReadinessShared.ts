import { RESIDENT_SEMANTIC } from '../../pages/admin/shared/residentSemanticPalette'

export interface ImprovementArea {
  feature: string
  label: string
  resident_value: number
  benchmark_value: number
  gap_score: number
  suggestion: string
}

export interface ReintegrationResult {
  resident_id: number | null
  reintegration_probability: number
  prediction: 'Ready' | 'Not Ready'
  risk_tier: 'High Readiness' | 'Moderate Readiness' | 'Low Readiness'
  threshold_used: number
  top_improvements: ImprovementArea[]
}

export const READINESS_READY_THRESHOLD = 0.7
export const READINESS_MODERATE_THRESHOLD = 0.5

export const TIER_CONFIG: Record<
  ReintegrationResult['risk_tier'],
  {
    badge: string
    text: string
    border: string
    dot: string
    bar: string
    bg: string
    icon: string
  }
> = {
  'High Readiness': {
    badge: `${RESIDENT_SEMANTIC.success.border} ${RESIDENT_SEMANTIC.success.bg} ${RESIDENT_SEMANTIC.success.text}`,
    text: RESIDENT_SEMANTIC.success.text,
    border: RESIDENT_SEMANTIC.success.border,
    dot: RESIDENT_SEMANTIC.success.dot,
    bar: RESIDENT_SEMANTIC.success.bar,
    bg: RESIDENT_SEMANTIC.success.bgSoft,
    icon: '✅',
  },
  'Moderate Readiness': {
    badge: `${RESIDENT_SEMANTIC.warning.border} ${RESIDENT_SEMANTIC.warning.bg} ${RESIDENT_SEMANTIC.warning.text}`,
    text: RESIDENT_SEMANTIC.warning.text,
    border: RESIDENT_SEMANTIC.warning.border,
    dot: RESIDENT_SEMANTIC.warning.dot,
    bar: RESIDENT_SEMANTIC.warning.bar,
    bg: RESIDENT_SEMANTIC.warning.bgSoft,
    icon: '⏳',
  },
  'Low Readiness': {
    badge: `${RESIDENT_SEMANTIC.danger.border} ${RESIDENT_SEMANTIC.danger.bg} ${RESIDENT_SEMANTIC.danger.text}`,
    text: RESIDENT_SEMANTIC.danger.text,
    border: RESIDENT_SEMANTIC.danger.border,
    dot: RESIDENT_SEMANTIC.danger.dot,
    bar: RESIDENT_SEMANTIC.danger.bar,
    bg: RESIDENT_SEMANTIC.danger.bgSoft,
    icon: '⚠️',
  },
}

const PERCENT_FEATURES = new Set([
  'pct_progress_noted',
  'pct_concerns_flagged',
  'latest_attendance_rate',
  'pct_psych_checkup_done',
  'pct_plans_achieved',
])

const PCT100_FEATURES = new Set(['avg_progress_percent'])

export function formatFeatureValue(feature: string, value: number): string {
  if (PERCENT_FEATURES.has(feature)) return `${Math.round(value * 100)}%`
  if (PCT100_FEATURES.has(feature)) return `${Math.round(value)}%`
  if (feature === 'avg_general_health_score') return `${value.toFixed(1)} / 10`
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function normalizeImprovementLabel(label: string): string {
  return label.replace(/\bProgramme\b/g, 'Program')
}

export function actionableImprovementAreas(result: ReintegrationResult): ImprovementArea[] {
  return (result.top_improvements ?? []).filter((area) => area.feature !== 'days_in_program')
}

export function displayTopImprovementArea(result: ReintegrationResult): ImprovementArea | null {
  const improvements = result.top_improvements ?? []
  if (improvements.length === 0) return null

  const actionableArea = actionableImprovementAreas(result)[0]
  return actionableArea ?? improvements[0]
}

export function topImprovementLabel(result: ReintegrationResult): string {
  return normalizeImprovementLabel(displayTopImprovementArea(result)?.label ?? 'Maintain current support plan')
}

export function deriveReadinessTier(probability: number): ReintegrationResult['risk_tier'] {
  if (probability >= READINESS_READY_THRESHOLD) return 'High Readiness'
  if (probability >= READINESS_MODERATE_THRESHOLD) return 'Moderate Readiness'
  return 'Low Readiness'
}

export function deriveReadinessPrediction(probability: number): ReintegrationResult['prediction'] {
  return probability >= READINESS_READY_THRESHOLD ? 'Ready' : 'Not Ready'
}
