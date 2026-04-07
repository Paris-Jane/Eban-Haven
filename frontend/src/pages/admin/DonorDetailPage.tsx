import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { alertError, btnPrimary, card, input, label, pageDesc, pageTitle, sectionFormTitle } from './adminStyles'
import { createDonation, getDonations, getSupporters, type Donation, type Supporter } from '../../api/admin'

const moneyPhp = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' })

export function DonorDetailPage() {
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

  return (
    <div className="space-y-8">
      <Link to="/admin/donors" className="text-sm text-primary hover:underline">
        ← Donors
      </Link>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !supporter ? (
        <p className="text-destructive">Supporter not found.</p>
      ) : (
        <>
          <div>
            <h2 className={pageTitle}>{supporter.displayName}</h2>
            <p className={pageDesc}>
              {supporter.supporterType} · {supporter.email ?? 'No email'} · {supporter.region ?? '—'} ·{' '}
              {supporter.country ?? '—'}
            </p>
          </div>
          {error && <div className={alertError}>{error}</div>}
          <div className={`${card} grid gap-2 text-sm sm:grid-cols-2`}>
            <div>
              <span className="text-muted-foreground">Phone</span>
              <p>{supporter.phone ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Organization</span>
              <p>{supporter.organizationName ?? '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p>{supporter.status}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Acquisition</span>
              <p>{supporter.acquisitionChannel ?? '—'}</p>
            </div>
          </div>

          <form onSubmit={onAddContribution} className={`${card} space-y-3 max-w-xl`}>
            <p className={sectionFormTitle}>Add contribution</p>
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
              Amount (Monetary)
              <input type="number" className={input} value={dAmount} onChange={(e) => setDAmount(e.target.value)} />
            </label>
            <label className={label}>
              Date
              <input type="date" className={input} value={dDate} onChange={(e) => setDDate(e.target.value)} />
            </label>
            <label className={label}>
              Notes
              <textarea className={input} rows={2} value={dNotes} onChange={(e) => setDNotes(e.target.value)} />
            </label>
            <button type="submit" disabled={saving} className={btnPrimary}>
              Save contribution
            </button>
          </form>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Donation history</h3>
            <ul className="space-y-2">
              {donations.map((d) => (
                <li key={d.id} className={card}>
                  <span className="font-medium">{moneyPhp.format(d.amount ?? 0)}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{d.donationType}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {new Date(d.donationDate).toLocaleString()}
                  </span>
                  {d.notes && <p className="mt-1 text-xs text-muted-foreground">{d.notes}</p>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
