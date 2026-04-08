import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
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
import { AdminListToolbar } from './AdminListToolbar'
import { matchesColFilter, nextSortState, sortRows, SortableTh, type SortDirection } from './SortableTh'

const moneyPhp = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' })

type ColFilters = {
  id: string
  donationId: string
  safehouseId: string
  safehouseName: string
  programArea: string
  amountAllocated: string
  allocationDate: string
  notes: string
}

const emptyFilters = (): ColFilters => ({
  id: '',
  donationId: '',
  safehouseId: '',
  safehouseName: '',
  programArea: '',
  amountAllocated: '',
  allocationDate: '',
  notes: '',
})

export function AllocationsAdminPage() {
  const sbData = useSupabaseForLighthouseData()
  const [rows, setRows] = useState<DonationAllocation[]>([])
  const [donations, setDonations] = useState<Awaited<ReturnType<typeof getDonations>>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<DonationAllocation | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [colFilters, setColFilters] = useState<ColFilters>(emptyFilters)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

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

  const donationSupporter = useMemo(() => {
    const m = new Map<number, number>()
    for (const d of donations) m.set(d.id, d.supporterId)
    return m
  }, [donations])

  const filteredSorted = useMemo(() => {
    let list = rows.filter((r) => {
      const hay = `${r.safehouseName ?? ''} ${r.programArea} ${r.notes ?? ''} ${r.donationId} ${r.safehouseId} ${r.id}`.toLowerCase()
      if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false
      if (!matchesColFilter(r.id, colFilters.id)) return false
      if (!matchesColFilter(r.donationId, colFilters.donationId)) return false
      if (!matchesColFilter(r.safehouseId, colFilters.safehouseId)) return false
      if (!matchesColFilter(r.safehouseName, colFilters.safehouseName)) return false
      if (!matchesColFilter(r.programArea, colFilters.programArea)) return false
      if (!matchesColFilter(r.amountAllocated, colFilters.amountAllocated)) return false
      if (!matchesColFilter(r.allocationDate, colFilters.allocationDate)) return false
      if (!matchesColFilter(r.notes, colFilters.notes)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'id':
          return row.id
        case 'donationId':
          return row.donationId
        case 'safehouseName':
          return row.safehouseName ?? ''
        case 'programArea':
          return row.programArea
        case 'amountAllocated':
          return row.amountAllocated
        case 'allocationDate':
          return row.allocationDate
        default:
          return ''
      }
    })
    return list
  }, [rows, q, colFilters, sortKey, sortDir])

  function onSort(key: string) {
    const next = nextSortState(key, sortKey, sortDir)
    setSortKey(next.key)
    setSortDir(next.dir)
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    const ids = filteredSorted.map((r) => r.id)
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const n = new Set(prev)
      if (allOn) for (const id of ids) n.delete(id)
      else for (const id of ids) n.add(id)
      return n
    })
  }

  async function bulkDelete() {
    if (!sbData || selected.size === 0) return
    if (!confirm(`Delete ${selected.size} allocation(s)? This cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      for (const id of selected) {
        await deleteAllocation(id)
      }
      setSelected(new Set())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

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
      setAddOpen(false)
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

  function openAdd() {
    setAddOpen(true)
    requestAnimationFrame(() => document.getElementById('admin-add-allocation')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const colCount = sbData ? 8 : 6

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Allocations</h2>
        <p className={pageDesc}>
          Filter by any column; click a row to edit. Donation ID links to the contributions list. Bulk delete requires
          Supabase.
        </p>
      </div>
      {error && <div className={alertError}>{error}</div>}

      <AdminListToolbar
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search…"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        onAddClick={openAdd}
        addLabel="Add allocation"
      />

      {selected.size > 0 && sbData && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          <span className="text-muted-foreground">{selected.size} selected</span>
          <button type="button" className={btnPrimary} disabled={saving} onClick={() => void bulkDelete()}>
            Delete selected…
          </button>
          <button type="button" className="text-sm text-primary hover:underline" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      {filterOpen && (
        <div className={`${card} grid gap-3 sm:grid-cols-2 lg:grid-cols-3`}>
          <p className="text-sm font-medium sm:col-span-2 lg:col-span-3">Filter by column (contains)</p>
          {(Object.keys(colFilters) as (keyof ColFilters)[]).map((k) => (
            <label key={k} className={label}>
              {k === 'donationId' ? 'Donation ID' : k === 'safehouseId' ? 'Safehouse ID' : k === 'amountAllocated' ? 'Amount' : k === 'allocationDate' ? 'Date' : k === 'programArea' ? 'Program' : k.charAt(0).toUpperCase() + k.slice(1)}
              <input
                className={input}
                value={colFilters[k]}
                onChange={(e) => setColFilters((f) => ({ ...f, [k]: e.target.value }))}
                placeholder="Contains…"
              />
            </label>
          ))}
          <button type="button" className="text-sm text-primary hover:underline sm:col-span-2 lg:col-span-3" onClick={() => setColFilters(emptyFilters())}>
            Clear column filters
          </button>
        </div>
      )}

      {addOpen && (
        <div id="admin-add-allocation" className={`${card} scroll-mt-28 space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">New allocation</span>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setAddOpen(false)}>
              Close
            </button>
          </div>
          {!sbData ? (
            <p className="text-sm text-muted-foreground">
              Adding allocations requires Supabase program data. Set <code className="rounded bg-muted px-1">VITE_USE_SUPABASE_DATA=true</code> and apply
              lighthouse migrations.
            </p>
          ) : (
            <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
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
        </div>
      )}

      <div className={tableWrap}>
        <table className="w-full text-left text-sm">
          <thead className={tableHead}>
            <tr>
              {sbData && (
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={filteredSorted.length > 0 && filteredSorted.every((r) => selected.has(r.id))}
                    onChange={() => toggleSelectAll()}
                  />
                </th>
              )}
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <th className="px-3 py-2">Donation</th>
              <SortableTh label="Safehouse" sortKey="safehouseName" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Program" sortKey="programArea" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Amount" sortKey="amountAllocated" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Date" sortKey="allocationDate" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              {sbData && <th className="w-24 px-3 py-2">Edit</th>}
            </tr>
          </thead>
          <tbody className={tableBody}>
            {loading ? (
              <tr>
                <td colSpan={colCount} className={emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : filteredSorted.length === 0 ? (
              <tr>
                <td colSpan={colCount} className={emptyCell}>
                  No allocations.
                </td>
              </tr>
            ) : (
              filteredSorted.map((r) => (
                <tr
                  key={r.id}
                  className={`${tableRowHover} ${sbData ? 'cursor-pointer' : ''}`}
                  onClick={() => sbData && setEdit({ ...r })}
                >
                  {sbData && (
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Select ${r.id}`} />
                    </td>
                  )}
                  <td className="px-3 py-2 text-muted-foreground">{r.id}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <Link className="text-primary hover:underline" to="/admin/contributions">
                      #{r.donationId}
                    </Link>
                    {donationSupporter.get(r.donationId) != null && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (
                        <Link className="hover:underline" to={`/admin/donors/${donationSupporter.get(r.donationId)!}`}>
                          donor
                        </Link>
                        )
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.safehouseName ?? r.safehouseId}</td>
                  <td className="px-3 py-2">{r.programArea}</td>
                  <td className="px-3 py-2">{moneyPhp.format(r.amountAllocated)}</td>
                  <td className="px-3 py-2 text-xs">{new Date(r.allocationDate).toLocaleDateString()}</td>
                  {sbData && (
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="text-primary hover:underline" onClick={() => setEdit({ ...r })}>
                        Edit
                      </button>
                    </td>
                  )}
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
