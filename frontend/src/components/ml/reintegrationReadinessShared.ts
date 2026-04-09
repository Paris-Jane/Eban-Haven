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
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    bg: 'bg-emerald-50',
    icon: '✅',
  },
  'Moderate Readiness': {
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    text: 'text-amber-800',
    border: 'border-amber-300',
    dot: 'bg-amber-400',
    bar: 'bg-amber-400',
    bg: 'bg-amber-50',
    icon: '⏳',
  },
  'Low Readiness': {
    badge: 'bg-red-100 text-red-800 border-red-300',
    text: 'text-red-800',
    border: 'border-red-300',
    dot: 'bg-red-500',
    bar: 'bg-red-400',
    bg: 'bg-red-50',
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

export function topImprovementLabel(result: ReintegrationResult): string {
  return result.top_improvements[0]?.label ?? 'Maintain current support plan'
}
