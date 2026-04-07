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
  createAllocation,
  deleteAllocation,
  getAllocations,
  getDonations,
  patchAllocationFields,
  type DonationAllocation,
} from '../../api/admin'
import { useSupabaseForLighthouseData } from '../../lib/useSupabaseLighthouse'

const moneyPhp = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' })

export function AllocationsAdminPage() {
  const sbData = useSupabaseForLighthouseData()
  const [rows, setRows] = useState<DonationAllocation[]>([])
  const [donations, setDonations] = useState<Awaited<ReturnType<typeof getDonations>>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<DonationAllocation | null>(null)

  const [donId, setDonId] = useState(0)
  const [shId, setShId] = useState(1)
  const [prog, setProg] = useState('Education')
  const [amt, setAmt] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, d] = await Promise.all([getAllocations(), getDonations()])
      setRows(a)
      setDonations(d)
      setDonId((prev) => prev || d[0]?.id || 0)
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
    const hay = `${r.safehouseName ?? ''} ${r.programArea} ${r.notes ?? ''}`.toLowerCase()
    return !q || hay.includes(q.toLowerCase())
  })

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    const n = parseFloat(amt)
    if (!donId || !Number.isFinite(n)) return
    if (!sbData) {
      setError('Allocations require Supabase data mode.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createAllocation({
        donationId: donId,
        safehouseId: shId,
        programArea: prog,
        amountAllocated: n,
      })
      setAmt('')
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
      await patchAllocationFields(edit.id, {
        program_area: edit.programArea,
        amount_allocated: String(edit.amountAllocated),
        allocation_notes: edit.notes ?? '',
      })
      setEdit(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(r: DonationAllocation) {
    if (!sbData || !confirm('Delete allocation?')) return
    try {
      await deleteAllocation(r.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Allocations</h2>
        <p className={pageDesc}>
          Link contributions to safehouses and program areas. Full CRUD requires Supabase data mode.
        </p>
      </div>
      {error && <div className={alertError}>{error}</div>}

      <div className={`${card} flex flex-wrap items-end gap-3`}>
        <label className={label}>
          Search
          <input className={input} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {sbData && (
        <form onSubmit={onCreate} className={`${card} flex flex-wrap items-end gap-3`}>
          <label className={label}>
            Donation id
            <select className={input} value={donId} onChange={(e) => setDonId(Number(e.target.value))}>
              {donations.map((d) => (
                <option key={d.id} value={d.id}>
                  #{d.id} — {d.supporterDisplayName}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Safehouse id
            <input type="number" className={input} value={shId} onChange={(e) => setShId(Number(e.target.value))} />
          </label>
          <label className={label}>
            Program area
            <input className={input} value={prog} onChange={(e) => setProg(e.target.value)} />
          </label>
          <label className={label}>
            Amount
            <input className={input} value={amt} onChange={(e) => setAmt(e.target.value)} />
          </label>
          <button type="submit" disabled={saving} className={btnPrimary}>
            Add allocation
          </button>
        </form>
      )}

      <div className={tableWrap}>
        <table className="w-full text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="px-3 py-2">Donation</th>
              <th className="px-3 py-2">Safehouse</th>
              <th className="px-3 py-2">Program</th>
              <th className="px-3 py-2">Amount</th>
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
                  No allocations.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className={tableRowHover}>
                  <td className="px-3 py-2">
                    <Link to={`/admin/contributions`} className="text-primary hover:underline">
                      #{r.donationId}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.safehouseName ?? r.safehouseId}</td>
                  <td className="px-3 py-2">{r.programArea}</td>
                  <td className="px-3 py-2">{moneyPhp.format(r.amountAllocated)}</td>
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
              Program area
              <input className={input} value={edit.programArea} onChange={(e) => setEdit({ ...edit, programArea: e.target.value })} />
            </label>
            <label className={label}>
              Amount
              <input
                type="number"
                className={input}
                value={edit.amountAllocated}
                onChange={(e) => setEdit({ ...edit, amountAllocated: parseFloat(e.target.value) || 0 })}
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
