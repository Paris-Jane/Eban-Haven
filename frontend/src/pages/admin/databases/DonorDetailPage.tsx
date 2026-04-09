import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  alertError,
  btnPrimary,
  card,
  input,
  label,
  pageDesc,
  pageTitle,
  sectionFormTitle,
  statCardInner,
  statCardSub,
  statCardValue,
} from '../shared/adminStyles'
import { createDonation, getDonations, getSupporters, type Donation, type Supporter } from '../../../api/admin'
import { BooleanBadge, CategoryBadge, StatusBadge } from '../shared/adminDataTable/AdminBadges'

const moneyPhp = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' })

function formatDonationAmount(donation: Donation) {
  if (donation.amount == null) return '—'
  const currency = donation.currencyCode?.trim() || 'PHP'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(donation.amount)
  } catch {
    return `${donation.amount} ${currency}`
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

export function DonorDetailPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const [supporter, setSupporter] = useState<Supporter | null>(null)
  const [donations, setDonations] = useState<Donation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dType, setDType] = useState('Monetary')
  const [dAmount, setDAmount] = useState('')
  const [dDate, setDDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dNotes, setDNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) return
    setLoading(true)
    try {
      const sup = await getSupporters()
      const s = sup.find((x) => x.id === id) ?? null
      setSupporter(s)
      if (s) {
        const d = await getDonations(id)
        setDonations(d)
      } else setDonations([])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function onAddContribution(e: FormEvent) {
    e.preventDefault()
    if (!Number.isFinite(id)) return
    const amt = parseFloat(dAmount)
    if (!Number.isFinite(amt) || amt <= 0) return
    setSaving(true)
    setError(null)
    try {
      await createDonation({
        supporterId: id,
        donationType: dType,
        amount: amt,
        currencyCode: 'PHP',
        donationDate: `${dDate}T12:00:00`,
        notes: dNotes.trim() || undefined,
      })
      setDAmount('')
      setDNotes('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  if (!Number.isFinite(id) || id <= 0) return <p className="text-destructive">Invalid donor.</p>

  const totalMonetary = donations.reduce((sum, donation) => sum + (donation.amount ?? 0), 0)
  const donationCount = donations.length
  const averageGift = donationCount > 0 ? totalMonetary / donationCount : 0
  const lastDonation = donations[0] ?? null
  const hasRecurringDonation = donations.some((donation) => donation.isRecurring)

  return (
    <div className="space-y-8">
      <button
        type="button"
        className="text-sm text-primary hover:underline"
        onClick={() => {
          if (window.history.length > 1) navigate(-1)
          else navigate('/admin/donors')
        }}
      >
        ← Back
      </button>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !supporter ? (
        <p className="text-destructive">Supporter not found.</p>
      ) : (
        <>
          <div className={`${card} flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className={pageTitle}>{supporter.displayName}</h2>
                <CategoryBadge>{supporter.supporterType}</CategoryBadge>
                <StatusBadge status={supporter.status} />
              </div>
              <p className={pageDesc}>
                {supporter.email ?? 'No email on file'}
                {supporter.phone ? ` · ${supporter.phone}` : ''}
                {supporter.region ? ` · ${supporter.region}` : ''}
                {supporter.country ? ` · ${supporter.country}` : ''}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">Acquisition:</span> {supporter.acquisitionChannel ?? '—'}
                </span>
                <span>
                  <span className="font-medium text-foreground">Relationship:</span> {supporter.relationshipType ?? '—'}
                </span>
                <span>
                  <span className="font-medium text-foreground">Organization:</span> {supporter.organizationName ?? '—'}
                </span>
              </div>
            </div>
            <div className="grid min-w-[220px] gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <p className={statCardInner}>Last Donation</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {lastDonation ? formatDonationAmount(lastDonation) : 'No donations yet'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lastDonation ? formatDateTime(lastDonation.donationDate) : 'Add the first donation below'}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <p className={statCardInner}>Recurring</p>
                <div className="mt-2">
                  <BooleanBadge value={hasRecurringDonation} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Based on recorded donation history</p>
              </div>
            </div>
          </div>

          {error && <div className={alertError}>{error}</div>}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className={card}>
              <p className={statCardInner}>Lifetime Total</p>
              <p className={statCardValue}>{moneyPhp.format(totalMonetary)}</p>
              <p className={statCardSub}>Recorded across all contribution types with amounts</p>
            </div>
            <div className={card}>
              <p className={statCardInner}>Donations</p>
              <p className={statCardValue}>{donationCount}</p>
              <p className={statCardSub}>Contribution records linked to this donor</p>
            </div>
            <div className={card}>
              <p className={statCardInner}>Average Gift</p>
              <p className={statCardValue}>{donationCount ? moneyPhp.format(averageGift) : '—'}</p>
              <p className={statCardSub}>Average amount across recorded donations</p>
            </div>
            <div className={card}>
              <p className={statCardInner}>Most Recent</p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {lastDonation ? new Date(lastDonation.donationDate).toLocaleDateString() : '—'}
              </p>
              <p className={statCardSub}>{lastDonation ? lastDonation.donationType : 'No donation history yet'}</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.95fr)]">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Donation history</h3>
                  <p className="text-sm text-muted-foreground">A chronological view of contributions from this donor.</p>
                </div>
              </div>
              {donations.length === 0 ? (
                <div className={`${card} text-sm text-muted-foreground`}>
                  No donations recorded yet. Add the first contribution using the panel on the right.
                </div>
              ) : (
                <ul className="space-y-3">
                  {donations.map((d) => (
                    <li key={d.id} className={card}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-semibold text-foreground">{formatDonationAmount(d)}</span>
                            <CategoryBadge>{d.donationType}</CategoryBadge>
                            <BooleanBadge value={d.isRecurring} />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>{formatDateTime(d.donationDate)}</span>
                            {d.channelSource ? <span>Channel: {d.channelSource}</span> : null}
                            {d.campaignName ? <span>Campaign: {d.campaignName}</span> : null}
                          </div>
                          {d.notes ? <p className="mt-3 text-sm text-muted-foreground">{d.notes}</p> : null}
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground">#{d.id}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <aside className="space-y-6">
              <div className={`${card} space-y-4`}>
                <div>
                  <p className={sectionFormTitle}>Donor details</p>
                  <p className="mt-1 text-sm text-muted-foreground">Core contact and profile information.</p>
                </div>
                <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-1">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Phone</dt>
                    <dd className="mt-1 text-foreground">{supporter.phone ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Email</dt>
                    <dd className="mt-1 break-all text-foreground">{supporter.email ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Organization</dt>
                    <dd className="mt-1 text-foreground">{supporter.organizationName ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Acquisition</dt>
                    <dd className="mt-1 text-foreground">{supporter.acquisitionChannel ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Region</dt>
                    <dd className="mt-1 text-foreground">{supporter.region ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Country</dt>
                    <dd className="mt-1 text-foreground">{supporter.country ?? '—'}</dd>
                  </div>
                </dl>
              </div>

              <form onSubmit={onAddContribution} className={`${card} space-y-4`}>
                <div>
                  <p className={sectionFormTitle}>Add donation</p>
                  <p className="mt-1 text-sm text-muted-foreground">Record a new contribution for this donor.</p>
                </div>
                <label className={label}>
                  Type
                  <select className={input} value={dType} onChange={(e) => setDType(e.target.value)}>
                    <option value="Monetary">Monetary</option>
                    <option value="InKind">InKind</option>
                    <option value="Time">Time</option>
                    <option value="Skills">Skills</option>
                    <option value="SocialMedia">SocialMedia</option>
                  </select>
                </label>
                <label className={label}>
                  Amount
                  <input
                    type="number"
                    className={input}
                    value={dAmount}
                    placeholder="0.00"
                    onChange={(e) => setDAmount(e.target.value)}
                  />
                </label>
                <label className={label}>
                  Date
                  <input type="date" className={input} value={dDate} onChange={(e) => setDDate(e.target.value)} />
                </label>
                <label className={label}>
                  Notes
                  <textarea
                    className={input}
                    rows={3}
                    placeholder="Optional context about this contribution"
                    value={dNotes}
                    onChange={(e) => setDNotes(e.target.value)}
                  />
                </label>
                <button type="submit" disabled={saving} className={btnPrimary}>
                  {saving ? 'Saving…' : 'Add donation'}
                </button>
              </form>
            </aside>
          </div>
        </>
      )}
    </div>
  )
}
