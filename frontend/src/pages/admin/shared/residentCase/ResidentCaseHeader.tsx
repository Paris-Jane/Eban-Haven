import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { card } from '../adminStyles'
import { RESIDENT_SEMANTIC } from '../residentSemanticPalette'
import { CategoryBadge, ReintegrationBadge, RiskBadge, StatusBadge } from '../adminDataTable/AdminBadges'

type ReadinessSummary = {
  percent: number
  label: string
  prediction: 'Ready' | 'Not Ready'
  topImprovement: string
  tone: 'success' | 'warning' | 'danger'
}

type Props = {
  internalCode: string
  caseStatus?: string
  currentRiskLevel?: string
  reintegrationType?: string
  reintegrationStatus?: string
  safehouseName: string
  assignedWorker?: string
  admissionLabel?: string
  caseCategory?: string
  caseControlNo?: string
  presentAge?: string
  lengthOfStay?: string
  readiness: ReadinessSummary | null
  /** When false, hide readiness % and navigation (e.g. resident already reintegrated). */
  showReintegrationPanel: boolean
  onOpenReadiness: () => void
}

export function ResidentCaseHeader({
  internalCode,
  caseStatus,
  currentRiskLevel,
  reintegrationType,
  reintegrationStatus,
  safehouseName,
  assignedWorker,
  admissionLabel,
  caseCategory,
  caseControlNo,
  presentAge,
  lengthOfStay,
  readiness,
  showReintegrationPanel,
  onOpenReadiness,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  const metadata = useMemo(
    () =>
      [
        safehouseName,
        assignedWorker || 'No worker assigned',
        admissionLabel ? `Admitted ${admissionLabel}` : '',
      ].filter(Boolean),
    [admissionLabel, assignedWorker, safehouseName],
  )

  const detailItems = useMemo(
    () =>
      [
        { label: 'Case category', value: caseCategory },
        { label: 'Case control no.', value: caseControlNo },
        { label: 'Present age', value: presentAge },
        { label: 'Length of stay', value: lengthOfStay },
        { label: 'Reintegration type', value: reintegrationType },
        { label: 'Reintegration status', value: reintegrationStatus },
      ].filter((item) => item.value?.trim()),
    [caseCategory, caseControlNo, lengthOfStay, presentAge, reintegrationStatus, reintegrationType],
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] lg:items-stretch">
      <div className={`${card} flex min-h-0 min-w-0 flex-col`}>
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 sm:min-h-[7.5rem]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
                  {internalCode}
                </h1>
                {currentRiskLevel ? <RiskBadge level={currentRiskLevel} /> : null}
                {reintegrationType ? <CategoryBadge>{reintegrationType}</CategoryBadge> : null}
                {reintegrationStatus ? <ReintegrationBadge value={reintegrationStatus} /> : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                {metadata.length > 0 ? (
                  metadata.map((item, index) => (
                    <span key={item}>
                      {index > 0 ? <span className="text-muted-foreground/60"> · </span> : null}
                      {item}
                    </span>
                  ))
                ) : (
                  <span>No placement details on file</span>
                )}
              </p>
            </div>
            {detailItems.length ? (
              <button
                type="button"
                onClick={() => setDetailsOpen((open) => !open)}
                className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted/60"
                aria-expanded={detailsOpen}
                title={detailsOpen ? 'Hide case details' : 'Show more case details'}
              >
                <span className="hidden sm:inline">{detailsOpen ? 'Less' : 'More'}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
              </button>
            ) : null}
          </div>
        </div>

        {detailsOpen ? (
          <div className="border-t border-border pt-4">
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
              {detailItems.map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
                  <dd className="mt-0.5 truncate text-foreground" title={item.value}>
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>

      <div className={`${card} flex h-full min-h-0 min-w-0 flex-col gap-4`}>
        <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
          <span className="font-medium text-muted-foreground">Case status:</span>
          {caseStatus ? <StatusBadge status={caseStatus} /> : <span className="text-muted-foreground">—</span>}
        </div>

        {showReintegrationPanel ? (
          <>
            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reintegration readiness</p>
              <button
                type="button"
                onClick={onOpenReadiness}
                className={`group mt-3 w-full rounded-lg border px-4 py-4 text-left transition-colors hover:bg-muted/30 ${readinessPanelClass(readiness?.tone)}`}
                title={readiness?.topImprovement ? `Top focus: ${readiness.topImprovement}` : 'Open reintegration readiness'}
              >
                <p className="text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
                  {readiness != null ? `${readiness.percent}%` : '—'}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {readiness != null ? `${readiness.label} · ${readiness.prediction}` : 'Open the readiness page to view the full assessment.'}
                </p>
                {readiness?.topImprovement ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">Top focus: {readiness.topImprovement}</p>
                ) : null}
                <p className="mt-3 text-sm font-medium text-primary group-hover:underline">Open reintegration readiness →</p>
              </button>
            </div>
          </>
        ) : (
          <div className="border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">
              Reintegration readiness scores are hidden for residents who have already completed reintegration.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function readinessPanelClass(tone: ReadinessSummary['tone'] | undefined) {
  if (tone === 'success') return `${RESIDENT_SEMANTIC.success.border} bg-[#E8F7EE]/80`
  if (tone === 'warning') return `${RESIDENT_SEMANTIC.warning.border} bg-[#FFF4E5]/80`
  if (tone === 'danger') return `${RESIDENT_SEMANTIC.danger.border} bg-[#FDECEC]/70`
  return 'border-border bg-muted/25'
}
