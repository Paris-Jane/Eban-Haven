import { Link } from 'react-router-dom'
import type { ReportsSummary, DonationAllocation } from '../../../../../api/adminTypes'
import type { PublicImpactSnapshot } from '../../../../../api/impact'
import { ChartCard, SimpleHorizontalBarChart } from '../ChartCard'
import { ReportEmptyState } from '../ReportEmptyState'
import { card } from '../../../shared/adminStyles'

type Props = {
  reports: ReportsSummary
  allocationsFiltered: DonationAllocation[]
  impactSnapshots: PublicImpactSnapshot[]
}

export function ImpactReportingTab({ reports, allocationsFiltered, impactSnapshots }: Props) {
  const aar = reports.annualAccomplishmentStyle
  const pillars = aar.servicesProvided
  const pillarTotal = pillars.caringSessions + pillars.healingSessions + pillars.teachingSessions
  const pillarRows = [
    { key: 'c', label: 'Caring sessions', value: pillars.caringSessions },
    { key: 'h', label: 'Healing sessions', value: pillars.healingSessions },
    { key: 't', label: 'Teaching sessions', value: pillars.teachingSessions },
  ]

  const byProgram = new Map<string, number>()
  for (const a of allocationsFiltered) {
    const k = a.programArea || 'General'
    byProgram.set(k, (byProgram.get(k) ?? 0) + a.amountAllocated)
  }
  const programRows = [...byProgram.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ key: label, label, value }))

  const published = impactSnapshots.filter((s) => s.isPublished).sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))

  return (
    <div className="space-y-6">
      <div className={`${card} bg-gradient-to-br from-emerald-50/40 to-card dark:from-emerald-950/20`}>
        <h2 className="text-lg font-semibold text-foreground">How support is making a difference</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Use this section for board packets and donor-facing narratives. Figures combine program services (caring,
          healing, teaching), beneficiary counts, and allocation storytelling. Always anonymize resident details in
          external materials.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xs font-medium uppercase text-muted-foreground">Beneficiaries</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{aar.beneficiaryResidentsServed}</p>
            <p className="text-xs text-muted-foreground">Residents in accomplishment framing</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xs font-medium uppercase text-muted-foreground">Service touchpoints</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{pillarTotal}</p>
            <p className="text-xs text-muted-foreground">Caring + healing + teaching</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xs font-medium uppercase text-muted-foreground">Active residents (reports)</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{reports.activeResidents}</p>
            <p className="text-xs text-muted-foreground">From reports summary API</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Annual accomplishment pillars"
          description="Session counts aligned to caring, healing, and teaching framing."
        >
          <SimpleHorizontalBarChart
            rows={pillarRows}
            formatValue={(n) => String(Math.round(n))}
            ariaLabel="Service pillars"
          />
        </ChartCard>

        <ChartCard
          title="Donations allocated by program area"
          description="Shows how monetary support maps to program areas (filtered allocations)."
        >
          {programRows.length === 0 ? (
            <ReportEmptyState title="No allocations" />
          ) : (
            <SimpleHorizontalBarChart
              rows={programRows}
              formatValue={(n) => `₱${Math.round(n).toLocaleString()}`}
              ariaLabel="Program allocation"
            />
          )}
        </ChartCard>
      </div>

      <div className={`${card}`}>
        <h3 className="text-sm font-semibold text-foreground">Program outcome highlights</h3>
        <ul className="mt-3 space-y-2">
          {aar.programOutcomeHighlights.map((h) => (
            <li key={h} className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              {h}
            </li>
          ))}
        </ul>
      </div>

      <div className={`${card}`}>
        <h3 className="text-sm font-semibold text-foreground">Published impact snapshots</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          From public_impact_snapshots via impact API — TODO: add admin publish workflow link if needed.
        </p>
        {published.length === 0 ? (
          <ReportEmptyState
            className="mt-4"
            title="No published snapshots"
            description="Publish snapshots from your data pipeline to build a timeline here."
          />
        ) : (
          <ul className="mt-4 space-y-3">
            {published.slice(0, 8).map((s) => (
              <li key={s.id} className="rounded-xl border border-border bg-background/80 px-4 py-3">
                <p className="text-xs text-muted-foreground">{s.snapshotDate}</p>
                <p className="font-medium text-foreground">{s.headline}</p>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{s.summaryText}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Public page:{' '}
        <Link to="/impact" className="text-primary hover:underline">
          /impact
        </Link>
      </p>
    </div>
  )
}
