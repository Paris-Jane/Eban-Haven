import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { createMyDonation, getDonorDashboard } from '../../api/donor'
import type { Donation, DonationAllocation, Supporter } from '../../api/adminTypes'
import { SITE_DISPLAY_NAME } from '../../site'

const moneyPhp = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' })

export function DonorDashboardPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [supporter, setSupporter] = useState<Supporter | null>(null)
  const [donations, setDonations] = useState<Donation[]>([])
  const [allocations, setAllocations] = useState<DonationAllocation[]>([])
  const [designationOptions, setDesignationOptions] = useState<string[]>(['General Fund'])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAmt, setSelectedAmt] = useState<number | null>(500)
  const [customAmt, setCustomAmt] = useState('')
  const [designate, setDesignate] = useState('General Fund')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const amounts = [500, 1000, 2500, 5000] as const

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getDonorDashboard()
      setEmail(data.email?.toLowerCase() ?? null)
      setSupporter(data.supporter)
      setDonations(data.donations)
      setAllocations(data.allocations)
      setDesignationOptions(data.designationOptions)
      setDesignate((current) => (data.designationOptions.includes(current) ? current : data.designationOptions[0] ?? 'General Fund'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const totalDonated = useMemo(() => {
    return donations
      .filter((d) => d.donationType.toLowerCase() === 'monetary')
      .reduce((acc, d) => acc + (d.amount ?? 0), 0)
  }, [donations])

  const mostRecent = donations[0]
  const impactedPrograms = useMemo(() => {
    return Array.from(
      new Set(allocations.map((allocation) => allocation.programArea?.trim()).filter(Boolean)),
    ) as string[]
  }, [allocations])
  const totalAllocated = useMemo(
    () => allocations.reduce((sum, allocation) => sum + (allocation.amountAllocated ?? 0), 0),
    [allocations],
  )
  const mostRecentAllocation = allocations[0]

  async function onDonate(e: React.FormEvent) {
    e.preventDefault()
    if (!supporter) {
      setError('Your account is not yet linked to a supporter profile. Contact the team or register with the same email you use to give.')
      return
    }
    const amt =
      customAmt.trim() !== ''
        ? parseFloat(customAmt)
        : selectedAmt != null
          ? selectedAmt
          : 0
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await createMyDonation({
        donationType: 'Monetary',
        amount: amt,
        currencyCode: 'PHP',
        notes: message.trim() || `${designate}${message ? ` · ${message}` : ''}`,
        campaignName: designate || undefined,
      })
      setCustomAmt('')
      setMessage('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Donation could not be recorded.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-muted/30 py-16 lg:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-8 shadow-sm"
        >
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary">
              <Heart className="h-5 w-5 fill-current text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">Donor dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Welcome. Thank you for your generosity to {SITE_DISPLAY_NAME}.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="mb-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total donated</p>
                  <p className="mt-1 font-heading text-2xl font-bold text-primary">{moneyPhp.format(totalDonated)}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Donations made</p>
                  <p className="mt-1 font-heading text-2xl font-bold text-foreground">{donations.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Most recent</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {mostRecent
                      ? `${moneyPhp.format(mostRecent.amount ?? 0)} · ${new Date(mostRecent.donationDate).toLocaleDateString()}`
                      : '—'}
                  </p>
                </div>
              </div>

              {!supporter && email && (
                <p className="mb-6 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                  No supporter profile matches <span className="font-medium text-foreground">{email}</span>. Staff can
                  create one in the admin Donors page, or register via Login → Register using this email.
                </p>
              )}

              <section className="rounded-xl border border-border bg-background p-6">
                <h2 className="font-heading text-lg font-semibold text-foreground">Your impact</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Here is where your giving has been directed so far, based on the allocations currently recorded by the team.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Total allocated
                    </p>
                    <p className="mt-2 font-heading text-2xl font-bold text-primary">
                      {allocations.length > 0 ? moneyPhp.format(totalAllocated) : '—'}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {allocations.length > 0
                        ? 'Amount linked to specific program allocations in your record.'
                        : 'No allocation details have been recorded yet.'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Supported program areas
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {impactedPrograms.length > 0 ? impactedPrograms.join(', ') : 'Awaiting allocation details'}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {impactedPrograms.length > 0
                        ? `${impactedPrograms.length} program area${impactedPrograms.length === 1 ? '' : 's'} represented so far.`
                        : 'Once staff assigns your donations, those areas will appear here.'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Latest allocation activity
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {mostRecentAllocation
                        ? `${mostRecentAllocation.programArea} · ${new Date(mostRecentAllocation.allocationDate).toLocaleDateString()}`
                        : 'No allocations recorded yet.'}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {allocations.length > 0 ? `${allocations.length} recorded allocation(s)` : 'Your donation history is available below.'}
                    </p>
                  </div>
                </div>
              </section>

              <h2 className="mb-4 mt-10 font-heading text-lg font-semibold text-foreground">Make a donation</h2>
              <form onSubmit={onDonate} className="space-y-4 rounded-xl border border-border bg-background p-6">
                <p className="text-sm text-muted-foreground">Select an amount (₱)</p>
                <div className="flex flex-wrap gap-2">
                  {amounts.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => {
                        setSelectedAmt(a)
                        setCustomAmt('')
                      }}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        selectedAmt === a && !customAmt
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      ₱{a.toLocaleString()}
                    </button>
                  ))}
                </div>
                <label className="block text-sm">
                  <span className="text-muted-foreground">Or enter a custom amount</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                    value={customAmt}
                    onChange={(e) => {
                      setCustomAmt(e.target.value)
                      setSelectedAmt(null)
                    }}
                    placeholder="0"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-muted-foreground">Designate to</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={designate}
                    onChange={(e) => setDesignate(e.target.value)}
                  >
                    {designationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-muted-foreground">Message (optional)</span>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  disabled={submitting || !supporter}
                  className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {submitting
                    ? 'Saving…'
                    : `Donate ${moneyPhp.format(customAmt ? parseFloat(customAmt) || 0 : selectedAmt ?? 0)}`}
                </button>
              </form>

              <h2 className="mb-3 mt-10 font-heading text-lg font-semibold text-foreground">Your donation history</h2>
              {donations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No donations recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {donations.map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 text-sm"
                    >
                      <span className="font-medium text-foreground">{moneyPhp.format(d.amount ?? 0)}</span>
                      <span className="text-muted-foreground">{d.donationType}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(d.donationDate).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
