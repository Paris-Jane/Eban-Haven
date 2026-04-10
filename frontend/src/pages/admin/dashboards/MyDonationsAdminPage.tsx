import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Heart } from 'lucide-react'
import { getAllocations, getDonations, type Donation, type DonationAllocation } from '../../../api/admin'
import { alertError, card, pageDesc, pageTitle } from '../shared/adminStyles'
import { formatUsd } from '../../../utils/currency'

const impactDescriptions: Record<string, string> = {
  general: 'Helped cover urgent day-to-day needs across the program, giving the team flexibility to respond where support was most needed.',
  education: 'Supported learning needs such as school access, supplies, tutoring, and educational stability.',
  health: 'Helped fund healthcare, checkups, medicines, and other health-related support for residents.',
  counseling: 'Supported counseling, case management, and emotional recovery services for girls in care.',
  shelter: 'Helped provide safe shelter, daily care, and a stable living environment for residents.',
  nutrition: 'Contributed to meals, nutritional support, and everyday wellbeing.',
  reintegration: 'Supported reintegration planning, family preparation, and transition support toward long-term stability.',
}

function describeImpact(programArea: string) {
  return impactDescriptions[programArea.trim().toLowerCase()] ?? 'Supported direct care and practical program needs for residents.'
}

export function MyDonationsAdminPage() {
  const [donations, setDonations] = useState<Donation[]>([])
  const [allocations, setAllocations] = useState<DonationAllocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [impactOpen, setImpactOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [allDonations, allAllocations] = await Promise.all([getDonations(), getAllocations()])
        if (cancelled) return
        setDonations(allDonations)
        setAllocations(allAllocations)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load donation data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const totalDonated = useMemo(
    () =>
      donations
        .filter((donation) => donation.donationType.toLowerCase() === 'monetary')
        .reduce((sum, donation) => sum + (donation.amount ?? 0), 0),
    [donations],
  )

  const mostRecentDonation = donations[0]
  const mostRecentAllocation = allocations[0]

  const allocationsByProgram = useMemo(() => {
    const grouped = new Map<string, { programArea: string; total: number; safehouses: Set<string>; count: number }>()
    for (const allocation of allocations) {
      const key = allocation.programArea?.trim() || 'General'
      const entry = grouped.get(key) ?? {
        programArea: key,
        total: 0,
        safehouses: new Set<string>(),
        count: 0,
      }
      entry.total += allocation.amountAllocated ?? 0
      entry.count += 1
      if (allocation.safehouseName?.trim()) entry.safehouses.add(allocation.safehouseName.trim())
      grouped.set(key, entry)
    }
    return [...grouped.values()].sort((a, b) => b.total - a.total)
  }, [allocations])

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>My Donations</h2>
        <p className={pageDesc}>
          A donor-style view of the admin donation records, including giving totals, allocation impact, and donation history.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      {loading ? (
        <div className={card}>
          <p className="text-sm text-muted-foreground">Loading donation overview…</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total donated</p>
              <p className="mt-1 font-heading text-2xl font-bold text-primary">{formatUsd(totalDonated)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Donations made</p>
              <p className="mt-1 font-heading text-2xl font-bold text-foreground">{donations.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Most recent</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {mostRecentDonation
                  ? `${formatUsd(mostRecentDonation.amount ?? 0)} · ${new Date(mostRecentDonation.donationDate).toLocaleDateString()}`
                  : '—'}
              </p>
            </div>
          </div>

          {allocations.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                      <Heart className="h-5 w-5 fill-current text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-heading text-lg font-semibold text-foreground">Your impact</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        This view summarizes how recorded donations have been directed across the organization.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImpactOpen((open) => !open)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-muted/40 hover:text-primary"
                  aria-expanded={impactOpen}
                >
                  {impactOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {impactOpen ? 'Hide details' : 'Show details'}
                </button>
              </div>

              {impactOpen && (
                <>
                  <div className="mt-5 rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Latest recorded allocation</p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {mostRecentAllocation
                        ? `${formatUsd(mostRecentAllocation.amountAllocated)} to ${mostRecentAllocation.programArea}${
                            mostRecentAllocation.safehouseName ? ` at ${mostRecentAllocation.safehouseName}` : ''
                          }`
                        : 'No allocations recorded yet.'}
                    </p>
                    {mostRecentAllocation && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        This allocation {describeImpact(mostRecentAllocation.programArea)}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    {allocationsByProgram.slice(0, 3).map((entry) => (
                      <div key={entry.programArea} className="rounded-xl border border-border bg-background p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{entry.programArea}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{describeImpact(entry.programArea)}</p>
                          </div>
                          <p className="text-sm font-semibold text-primary">{formatUsd(entry.total)}</p>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">
                          {entry.safehouses.size > 0
                            ? `Recorded support reached ${[...entry.safehouses].join(', ')} through ${entry.count} allocation${entry.count === 1 ? '' : 's'}.`
                            : `Recorded across ${entry.count} allocation${entry.count === 1 ? '' : 's'} in this area.`}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          <section className="space-y-3">
            <h3 className="font-heading text-lg font-semibold text-foreground">Donation history</h3>
            {donations.length === 0 ? (
              <div className={card}>
                <p className="text-sm text-muted-foreground">No donations recorded yet.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {donations.map((donation) => (
                  <li
                    key={donation.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{donation.supporterDisplayName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {donation.donationType}
                        {donation.campaignName ? ` · ${donation.campaignName}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">{formatUsd(donation.amount ?? 0)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(donation.donationDate).toLocaleString()}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
