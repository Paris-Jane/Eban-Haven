import type { ReactNode } from 'react'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'category'

const badgeBase =
  'inline-flex max-w-full items-center whitespace-nowrap rounded-full border px-2.5 py-[3px] text-xs font-semibold leading-[1.2] tracking-normal'

const badgeStyles: Record<BadgeVariant, string> = {
  success: 'border-[#B7E4C7] bg-[#E8F7EE] text-[#166534]',
  warning: 'border-[#F3D19C] bg-[#FFF4E5] text-[#9A5B00]',
  danger: 'border-[#F5B5B2] bg-[#FDECEC] text-[#B42318]',
  neutral: 'border-[#D1D5DB] bg-[#F3F4F6] text-[#4B5563]',
  info: 'border-[#BDD3FF] bg-[#EAF2FF] text-[#1D4ED8]',
  category: 'border-[#CBD5E1] bg-[#F1F5F9] text-[#334155]',
}

const statusVariantMap: Record<string, BadgeVariant> = {
  active: 'success',
  achieved: 'success',
  completed: 'success',
  open: 'info',
  'in progress': 'warning',
  'on hold': 'neutral',
  closed: 'neutral',
  'not started': 'neutral',
  inactive: 'neutral',
  transferred: 'neutral',
  'not achieved': 'neutral',
}

const riskVariantMap: Record<string, BadgeVariant> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
}

const categoryLikeReintegrationValues = new Set([
  'foster care',
  'family reunification',
  'independent living',
  'adoption',
  'kinship care',
  'guardianship',
  'transitional living',
  'supported independent living',
  'vocational placement',
])

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function variantFromStatus(status: string): BadgeVariant {
  return statusVariantMap[normalize(status)] ?? 'neutral'
}

function variantFromRisk(level: string): BadgeVariant {
  return riskVariantMap[normalize(level)] ?? 'neutral'
}

function variantFromVisitOutcome(outcome: string): BadgeVariant {
  const normalized = normalize(outcome)
  if (normalized === 'favorable') return 'success'
  if (normalized === 'needs improvement') return 'warning'
  if (normalized === 'unfavorable') return 'danger'
  if (normalized === 'inconclusive') return 'neutral'
  return 'category'
}

function variantFromReintegration(value: string): BadgeVariant {
  const normalized = normalize(value)
  if (categoryLikeReintegrationValues.has(normalized)) return 'category'
  return statusVariantMap[normalized] ?? 'category'
}

export function Badge({
  children,
  variant = 'neutral',
  className,
}: {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}) {
  return <span className={classNames(badgeBase, badgeStyles[variant], className)}>{children}</span>
}

export function CategoryBadge({ children }: { children: ReactNode }) {
  return <Badge variant="category">{children}</Badge>
}

export function NeutralBadge({ children }: { children: ReactNode }) {
  return <Badge variant="neutral">{children}</Badge>
}

export function StatusBadge({ status }: { status: string }) {
  const value = status.trim()
  return <Badge variant={variantFromStatus(value)}>{value}</Badge>
}

export function RiskBadge({ level }: { level: string }) {
  const value = level.trim()
  return <Badge variant={variantFromRisk(value)}>{value}</Badge>
}

export function ReintegrationBadge({ value }: { value: string }) {
  const label = value.trim()
  return <Badge variant={variantFromReintegration(label)}>{label}</Badge>
}

export function BooleanBadge({
  value,
  trueLabel = 'Yes',
  falseLabel = 'No',
  trueVariant = 'success',
  falseVariant = 'neutral',
}: {
  value: boolean
  trueLabel?: string
  falseLabel?: string
  trueVariant?: BadgeVariant
  falseVariant?: BadgeVariant
}) {
  return <Badge variant={value ? trueVariant : falseVariant}>{value ? trueLabel : falseLabel}</Badge>
}

export function VisitOutcomeBadge({ outcome }: { outcome: string }) {
  const value = outcome.trim()
  if (!value) return <span className="text-muted-foreground">—</span>
  return <Badge variant={variantFromVisitOutcome(value)}>{value}</Badge>
}
