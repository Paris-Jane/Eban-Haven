import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AtRiskDonors } from '../../components/ml/AtRiskDonors'
import {
  alertError,
  btnPrimary,
  card,
  emptyCell,
  input,
  label,
  pageDesc,
  pageTitle,
  sectionFormTitle,
  tableBody,
  tableHead,
  tableRowHover,
  tableWrap,
} from './adminStyles'
import {
  createDonation,
  createSupporter,
  getAllocations,
  getDonations,
  getSupporters,
  patchSupporter,
  type Donation,
  type DonationAllocation,
  type Supporter,
} from '../../api/admin'

const supporterTypes = [
  'MonetaryDonor',
  'Volunteer',
  'InKindDonor',
  'SkillsContributor',
  'SocialMediaAdvocate',
  'PartnerOrganization',
] as const

const donationTypes = ['Monetary', 'InKind', 'Time', 'Skills', 'SocialMedia'] as const

export function DonorsPage() {
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [donations, setDonations] = useState<Donation[]>([])
  const [allocations, setAllocations] = useState<DonationAllocation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [sType, setSType] = useState<string>('MonetaryDonor')
  const [sName, setSName] = useState('')
  const [sEmail, setSEmail] = useState('')
  const [sRegion, setSRegion] = useState('')
  const [savingS, setSavingS] = useState(false)

  const [dSupporterId, setDSupporterId] = useState<number>(0)
  const [dType, setDType] = useState<string>('Monetary')
  const [dAmount, setDAmount] = useState('')
  const [dDate, setDDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dNotes, setDNotes] = useState('')
  const [savingD, setSavingD] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sup, don, all] = await Promise.all([
        getSupporters(),
        getDonations(),
        getAllocations(),
      ])
      setSupporters(sup)
      setDonations(don)
      setAllocations(all.slice(0, 200))
      setDSupporterId((prev) => prev || sup[0]?.id || 0)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreateSupporter(e: FormEvent) {
    e.preventDefault()
    if (!sName.trim()) return
    setSavingS(true)
    setError(null)
    try {
      await createSupporter({
        supporterType: sType,
        displayName: sName.trim(),
        email: sEmail.trim() || undefined,
        region: sRegion.trim() || undefined,
        status: 'Active',
      })
      setSName('')
      setSEmail('')
      setSRegion('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingS(false)
    }
  }

  async function onCreateDonation(e: FormEvent) {
    e.preventDefault()
    if (!dSupporterId) return
    let amt: number | undefined
    if (dType === 'Monetary') {
      const parsed = Number.parseFloat(dAmount)
      if (Number.isNaN(parsed) || parsed < 0) return
      amt = parsed
    }
    setSavingD(true)
    setError(null)
    try {
      await createDonation({
        supporterId: dSupporterId,
        donationType: dType,
        donationDate: dDate,
        amount: amt,
        currencyCode: dType === 'Monetary' ? 'PHP' : undefined,
        notes: dNotes.trim() || undefined,
      })
      setDAmount('')
      setDNotes('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingD(false)
    }
  }

  async function toggleSupporterStatus(s: Supporter) {
    const next = s.status === 'Active' ? 'Inactive' : 'Active'
    setError(null)
    try {
      await patchSupporter(s.id, { status: next })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' })

  return (
    <div className="space-y-10">
      <div>
        <h2 className={pageTitle}>Donors & contributions</h2>
        <p className={pageDesc}>
          Supporter profiles by type (monetary, volunteer, in-kind, skills, social media, partner) and status.
          Log monetary, in-kind, time, skills, and social advocacy contributions; review allocations to safehouses
          and program areas.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <section className={`${card} space-y-4`}>
        <h3 className={sectionFormTitle}>Add supporter profile</h3>
        <form onSubmit={onCreateSupporter} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className={label}>
            Type
            <select className={input} value={sType} onChange={(e) => setSType(e.target.value)}>
              {supporterTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Display name
            <input className={input} value={sName} onChange={(e) => setSName(e.target.value)} required />
          </label>
          <label className={label}>
            Email (optional)
            <input className={input} type="email" value={sEmail} onChange={(e) => setSEmail(e.target.value)} />
          </label>
          <label className={label}>
            Region (optional)
            <input className={input} value={sRegion} onChange={(e) => setSRegion(e.target.value)} />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={savingS} className={btnPrimary}>
              {savingS ? 'Saving…' : 'Save supporter'}
            </button>
          </div>
        </form>
      </section>

      <section className={`${card} space-y-4`}>
        <h3 className={sectionFormTitle}>Record contribution</h3>
        <form onSubmit={onCreateDonation} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className={label}>
            Supporter
            <select
              className={input}
              value={dSupporterId || ''}
              onChange={(e) => setDSupporterId(Number(e.target.value))}
            >
              {supporters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} ({s.supporterType})
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Contribution type
            <select className={input} value={dType} onChange={(e) => setDType(e.target.value)}>
              {donationTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Date
            <input type="date" className={input} value={dDate} onChange={(e) => setDDate(e.target.value)} />
          </label>
          {dType === 'Monetary' && (
            <label className={label}>
              Amount (PHP)
              <input
                type="number"
                step="0.01"
                min={0}
                className={input}
                value={dAmount}
                onChange={(e) => setDAmount(e.target.value)}
                required
              />
            </label>
          )}
          <label className={`${label} md:col-span-2`}>
            Notes
            <input className={input} value={dNotes} onChange={(e) => setDNotes(e.target.value)} />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={savingD || !dSupporterId} className={btnPrimary}>
              {savingD ? 'Saving…' : 'Log contribution'}
            </button>
          </div>
        </form>
      </section>

      {/* ── ML: At-Risk Donors ── */}
      <AtRiskDonors />

      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Supporters</h3>
        <div className={tableWrap}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className={tableHead}>
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className={tableBody}>
              {loading ? (
                <tr>
                  <td colSpan={6} className={emptyCell}>
                    Loading…
                  </td>
                </tr>
              ) : (
                supporters.map((s) => (
                  <tr key={s.id} className={tableRowHover}>
                    <td className="px-4 py-3 font-medium">{s.displayName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.supporterType}</td>
                    <td className="px-4 py-3">{s.status}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.region ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.acquisitionChannel ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => void toggleSupporterStatus(s)}
                      >
                        Mark {s.status === 'Active' ? 'inactive' : 'active'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Contribution log</h3>
        <div className={tableWrap}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className={tableHead}>
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Supporter</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount / units</th>
                <th className="px-4 py-3">Campaign</th>
              </tr>
            </thead>
            <tbody className={tableBody}>
              {loading ? (
                <tr>
                  <td colSpan={5} className={emptyCell}>
                    Loading…
                  </td>
                </tr>
              ) : (
                donations.slice(0, 100).map((d) => (
                  <tr key={d.id} className={tableRowHover}>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(d.donationDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium">{d.supporterDisplayName}</td>
                    <td className="px-4 py-3">{d.donationType}</td>
                    <td className="px-4 py-3">
                      {d.amount != null && d.currencyCode === 'PHP'
                        ? money.format(d.amount)
                        : d.estimatedValue != null
                          ? `${d.estimatedValue} ${d.impactUnit ?? ''}`
                          : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.campaignName ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Donation allocations (safehouses & program areas)
        </h3>
        <div className={tableWrap}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className={tableHead}>
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Donation #</th>
                <th className="px-4 py-3">Safehouse</th>
                <th className="px-4 py-3">Program area</th>
                <th className="px-4 py-3">Allocated</th>
              </tr>
            </thead>
            <tbody className={tableBody}>
              {allocations.map((a) => (
                <tr key={a.id} className={tableRowHover}>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(a.allocationDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">{a.donationId}</td>
                  <td className="px-4 py-3">{a.safehouseName ?? `#${a.safehouseId}`}</td>
                  <td className="px-4 py-3">{a.programArea}</td>
                  <td className="px-4 py-3 font-medium text-primary">{money.format(a.amountAllocated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
