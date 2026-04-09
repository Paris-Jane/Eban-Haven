import { ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Supporter } from '../../../../api/adminTypes'
import { btnPrimary, card } from '../../shared/adminStyles'
import { CategoryBadge, StatusBadge } from '../../shared/adminDataTable/AdminBadges'

type Props = {
  supporter: Supporter
  detailsOpen: boolean
  onToggleDetails: () => void
  onEditClick: () => void
  onAddDonationClick: () => void
}

function contactSummary(s: Supporter) {
  const parts: string[] = []
  if (s.email) parts.push(s.email)
  if (s.phone) parts.push(s.phone)
  const loc = [s.region, s.country].filter(Boolean).join(', ')
  if (loc) parts.push(loc)
  return parts.length ? parts.join(' · ') : 'No contact on file'
}

export function DonorHeader({
  supporter,
  detailsOpen,
  onToggleDetails,
  onEditClick,
  onAddDonationClick,
}: Props) {
  const mailto = supporter.email ? `mailto:${encodeURIComponent(supporter.email)}` : null
  const outreachHref = `/admin/email-hub?supporterId=${supporter.id}`

  return (
    <div className={`${card} space-y-4`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-foreground">{supporter.displayName}</h1>
            <CategoryBadge>{supporter.supporterType}</CategoryBadge>
            <StatusBadge status={supporter.status} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{contactSummary(supporter)}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          <button type="button" className={btnPrimary} onClick={onAddDonationClick}>
            Add donation
          </button>
          <button
            type="button"
            onClick={onEditClick}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            Edit donor
          </button>
          {mailto ? (
            <a
              href={mailto}
              className="rounded-lg border border-border bg-background px-4 py-2 text-center text-sm font-medium text-foreground hover:bg-muted/50"
            >
              Email donor
            </a>
          ) : (
            <span className="rounded-lg border border-dashed border-border px-4 py-2 text-center text-sm text-muted-foreground">
              No email for mailto
            </span>
          )}
          <Link
            to={outreachHref}
            className="rounded-lg border border-border bg-background px-4 py-2 text-center text-sm font-medium text-primary hover:bg-muted/50"
          >
            Donor outreach
          </Link>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleDetails}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted/50"
        aria-expanded={detailsOpen}
      >
        {detailsOpen ? 'Hide profile details' : 'Show profile details'}
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
      </button>

      {detailsOpen ? (
        <div className="border-t border-border pt-4">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <p className="mt-4 text-xs text-muted-foreground">
            Editing uses fields supported by the admin API (name, type, status, email, region, country).
          </p>
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
