import { ChevronDown, Pencil } from 'lucide-react'
import type { Supporter } from '../../../../api/adminTypes'
import { card } from '../../shared/adminStyles'
import { CategoryBadge } from '../../shared/adminDataTable/AdminBadges'

type Props = {
  supporter: Supporter
  detailsOpen: boolean
  onToggleDetails: () => void
  onEditClick: () => void
}

function contactSummary(s: Supporter) {
  const parts: string[] = []
  if (s.email) parts.push(s.email)
  if (s.phone) parts.push(s.phone)
  const loc = [s.region, s.country].filter(Boolean).join(', ')
  if (loc) parts.push(loc)
  return parts.length ? parts.join(' · ') : 'No contact on file'
}

export function DonorProfileCard({ supporter, detailsOpen, onToggleDetails, onEditClick }: Props) {
  return (
    <div className={`${card} flex h-full min-h-0 flex-col space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-foreground">{supporter.displayName}</h1>
            <CategoryBadge>{supporter.supporterType}</CategoryBadge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{contactSummary(supporter)}</p>
        </div>
        <button
          type="button"
          onClick={onToggleDetails}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted/60"
          aria-expanded={detailsOpen}
          title={detailsOpen ? 'Hide details' : 'Show more profile details'}
        >
          <span className="hidden sm:inline">{detailsOpen ? 'Less' : 'More'}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {detailsOpen ? (
        <div className="border-t border-border pt-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Organization" value={supporter.organizationName} />
            <DetailItem label="First name" value={supporter.firstName} />
            <DetailItem label="Last name" value={supporter.lastName} />
            <DetailItem label="Acquisition source" value={supporter.acquisitionChannel} />
            <DetailItem label="Relationship" value={supporter.relationshipType} />
            <DetailItem label="Region" value={supporter.region} />
            <DetailItem label="Country" value={supporter.country} />
            <DetailItem label="Email" value={supporter.email} />
            <DetailItem label="Phone" value={supporter.phone} />
            <DetailItem label="First donation (recorded)" value={formatMaybeDate(supporter.firstDonationDate)} />
          </dl>
          <button
            type="button"
            onClick={onEditClick}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-foreground hover:bg-primary/15"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Edit profile
          </button>
        </div>
      ) : null}
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value?.trim() ? value : '—'}</dd>
    </div>
  )
}

function formatMaybeDate(v: string | null | undefined) {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleDateString()
  } catch {
    return v
  }
}
