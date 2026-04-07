import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  alertError,
  btnPrimary,
  card,
  emptyCell,
  input,
  label,
  pageDesc,
  pageTitle,
  tableBody,
  tableHead,
  tableRowHover,
  tableWrap,
} from './adminStyles'
import {
  createDonation,
  deleteDonation,
  getDonations,
  getSupporters,
  patchDonationFields,
  type Donation,
} from '../../api/admin'
import { useSupabaseForLighthouseData } from '../../lib/useSupabaseLighthouse'

const moneyPhp = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' })

export function ContributionsAdminPage() {
  const sbData = useSupabaseForLighthouseData()
  const [rows, setRows] = useState<Donation[]>([])
  const [supporters, setSupporters] = useState<Awaited<ReturnType<typeof getSupporters>>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [supFilter, setSupFilter] = useState<number>(0)
  const [edit, setEdit] = useState<Donation | null>(null)

  const [newSup, setNewSup] = useState(0)
  const [newType, setNewType] = useState('Monetary')
  const [newAmt, setNewAmt] = useState('')
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, s] = await Promise.all([getDonations(), getSupporters()])
      setRows(d)
      setSupporters(s)
      setNewSup((prev) => prev || s[0]?.id || 0)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = rows.filter((r) => {
    const hay = `${r.supporterDisplayName} ${r.donationType} ${r.notes ?? ''}`.toLowerCase()
    if (q && !hay.includes(q.toLowerCase())) return false
    if (supFilter > 0 && r.supporterId !== supFilter) return false
    return true
  })

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    const amt = parseFloat(newAmt)
    if (!newSup || !Number.isFinite(amt)) return
    setSaving(true)
    setError(null)
    try {
      await createDonation({
        supporterId: newSup,
        donationType: newType,
        amount: amt,
        currencyCode: 'PHP',
        donationDate: `${newDate}T12:00:00`,
      })
      setNewAmt('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit() {
    if (!edit || !sbData) return
    setSaving(true)
    try {
      await patchDonationFields(edit.id, {
        donation_type: edit.donationType,
        amount: edit.amount != null ? String(edit.amount) : '',
        notes: edit.notes ?? '',
        campaign_name: edit.campaignName ?? '',
      })
      setEdit(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(d: Donation) {
    if (!sbData || !confirm('Delete this contribution?')) return
    try {
      await deleteDonation(d.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Contributions</h2>
        <p className={pageDesc}>
          Search and filter donations. Edit and delete require Supabase data mode. Link opens the donor profile.
        </p>
      </div>
      {error && <div className={alertError}>{error}</div>}

      <div className={`${card} flex flex-wrap items-end gap-3`}>
        <label className={label}>
          Search
          <input className={input} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className={label}>
          Donor
          <select className={input} value={supFilter} onChange={(e) => setSupFilter(Number(e.target.value))}>
            <option value={0}>All</option>
            {supporters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form onSubmit={onCreate} className={`${card} flex flex-wrap items-end gap-3`}>
        <label className={label}>
          Supporter
          <select className={input} value={newSup} onChange={(e) => setNewSup(Number(e.target.value))}>
            {supporters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Type
          <select className={input} value={newType} onChange={(e) => setNewType(e.target.value)}>
            <option value="Monetary">Monetary</option>
            <option value="InKind">InKind</option>
            <option value="Time">Time</option>
            <option value="Skills">Skills</option>
            <option value="SocialMedia">SocialMedia</option>
          </select>
        </label>
        <label className={label}>
          Amount
          <input className={input} value={newAmt} onChange={(e) => setNewAmt(e.target.value)} />
        </label>
        <label className={label}>
          Date
          <input type="date" className={input} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
        </label>
        <button type="submit" disabled={saving} className={btnPrimary}>
          Add contribution
        </button>
      </form>

      <div className={tableWrap}>
        <table className="w-full text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="px-3 py-2">Donor</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className={tableBody}>
            {loading ? (
              <tr>
                <td colSpan={5} className={emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className={emptyCell}>
                  No rows.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className={tableRowHover}>
                  <td className="px-3 py-2">
                    <Link className="text-primary hover:underline" to={`/admin/donors/${r.supporterId}`}>
                      {r.supporterDisplayName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.donationType}</td>
                  <td className="px-3 py-2">{moneyPhp.format(r.amount ?? 0)}</td>
                  <td className="px-3 py-2 text-xs">{new Date(r.donationDate).toLocaleDateString()}</td>
                  <td className="space-x-2 px-3 py-2 text-right">
                    {sbData && (
                      <>
                        <button type="button" className="text-primary hover:underline" onClick={() => setEdit({ ...r })}>
                          Edit
                        </button>
                        <button type="button" className="text-destructive hover:underline" onClick={() => void onDelete(r)}>
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {edit && sbData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className={`${card} w-full max-w-md space-y-2`}>
            <label className={label}>
              Type
              <input className={input} value={edit.donationType} onChange={(e) => setEdit({ ...edit, donationType: e.target.value })} />
            </label>
            <label className={label}>
              Amount
              <input
                type="number"
                className={input}
                value={edit.amount ?? ''}
                onChange={(e) => setEdit({ ...edit, amount: parseFloat(e.target.value) || null })}
              />
            </label>
            <label className={label}>
              Notes
              <textarea className={input} rows={2} value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </label>
            <div className="flex gap-2">
              <button type="button" className={btnPrimary} disabled={saving} onClick={() => void saveEdit()}>
                Save
              </button>
              <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm" onClick={() => setEdit(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
