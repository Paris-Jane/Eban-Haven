import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { AdminListToolbar } from './AdminListToolbar'
import { matchesColFilter, nextSortState, sortRows, SortableTh, type SortDirection } from './SortableTh'

const moneyPhp = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' })

type ColFilters = {
  id: string
  supporterDisplayName: string
  donationType: string
  amount: string
  donationDate: string
  isRecurring: string
  campaignName: string
  channelSource: string
  currencyCode: string
  estimatedValue: string
  impactUnit: string
  notes: string
}

const emptyFilters = (): ColFilters => ({
  id: '',
  supporterDisplayName: '',
  donationType: '',
  amount: '',
  donationDate: '',
  isRecurring: '',
  campaignName: '',
  channelSource: '',
  currencyCode: '',
  estimatedValue: '',
  impactUnit: '',
  notes: '',
})

const FILTER_LABELS: Record<keyof ColFilters, string> = {
  id: 'ID',
  supporterDisplayName: 'Donor name',
  donationType: 'Type',
  amount: 'Amount',
  donationDate: 'Date',
  isRecurring: 'Recurring (yes/no)',
  campaignName: 'Campaign',
  channelSource: 'Channel',
  currencyCode: 'Currency',
  estimatedValue: 'Est. value',
  impactUnit: 'Impact unit',
  notes: 'Notes',
}

export function ContributionsAdminPage() {
  const sbData = useSupabaseForLighthouseData()
  const navigate = useNavigate()
  const [rows, setRows] = useState<Donation[]>([])
  const [supporters, setSupporters] = useState<Awaited<ReturnType<typeof getSupporters>>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Donation | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [colFilters, setColFilters] = useState<ColFilters>(emptyFilters)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

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

  const filteredSorted = useMemo(() => {
    let list = rows.filter((r) => {
      const hay = `${r.supporterDisplayName} ${r.donationType} ${r.notes ?? ''} ${r.campaignName ?? ''} ${r.id} ${r.channelSource ?? ''}`.toLowerCase()
      if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false
      if (!matchesColFilter(r.id, colFilters.id)) return false
      if (!matchesColFilter(r.supporterDisplayName, colFilters.supporterDisplayName)) return false
      if (!matchesColFilter(r.donationType, colFilters.donationType)) return false
      if (!matchesColFilter(r.amount, colFilters.amount)) return false
      if (!matchesColFilter(r.donationDate, colFilters.donationDate)) return false
      if (!matchesColFilter(r.isRecurring, colFilters.isRecurring)) return false
      if (!matchesColFilter(r.campaignName, colFilters.campaignName)) return false
      if (!matchesColFilter(r.channelSource, colFilters.channelSource)) return false
      if (!matchesColFilter(r.currencyCode, colFilters.currencyCode)) return false
      if (!matchesColFilter(r.estimatedValue, colFilters.estimatedValue)) return false
      if (!matchesColFilter(r.impactUnit, colFilters.impactUnit)) return false
      if (!matchesColFilter(r.notes, colFilters.notes)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'id':
          return row.id
        case 'supporterDisplayName':
          return row.supporterDisplayName
        case 'donationType':
          return row.donationType
        case 'amount':
          return row.amount ?? 0
        case 'donationDate':
          return row.donationDate
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
    if (!confirm(`Delete ${selected.size} contribution(s)? This cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      for (const id of selected) {
        await deleteDonation(id)
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

  function openAdd() {
    setAddOpen(true)
    requestAnimationFrame(() => document.getElementById('admin-add-contribution')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const colCount = sbData ? 8 : 6

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Contributions</h2>
        <p className={pageDesc}>
          Filter by any field, sort from headers. Click a row to open the donor profile. Bulk delete requires Supabase.
        </p>
      </div>
      {error && <div className={alertError}>{error}</div>}

      <AdminListToolbar
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search all fields…"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        onAddClick={openAdd}
        addLabel="Add contribution"
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
              {FILTER_LABELS[k]}
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
        <form id="admin-add-contribution" onSubmit={onCreate} className={`${card} scroll-mt-28 flex flex-wrap items-end gap-3`}>
          <div className="flex w-full items-center justify-between">
            <span className="text-sm font-medium">New contribution</span>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setAddOpen(false)}>
              Close
            </button>
          </div>
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
              <SortableTh label="Donor" sortKey="supporterDisplayName" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Type" sortKey="donationType" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Amount" sortKey="amount" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Date" sortKey="donationDate" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <th className="px-3 py-2">Notes</th>
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
                  No rows.
                </td>
              </tr>
            ) : (
              filteredSorted.map((r) => (
                <tr
                  key={r.id}
                  className={`${tableRowHover} cursor-pointer`}
                  onClick={() => navigate(`/admin/donors/${r.supporterId}`)}
                >
                  {sbData && (
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Select ${r.id}`} />
                    </td>
                  )}
                  <td className="px-3 py-2 text-muted-foreground">{r.id}</td>
                  <td className="px-3 py-2 font-medium text-primary">{r.supporterDisplayName}</td>
                  <td className="px-3 py-2">{r.donationType}</td>
                  <td className="px-3 py-2">{moneyPhp.format(r.amount ?? 0)}</td>
                  <td className="px-3 py-2 text-xs">{new Date(r.donationDate).toLocaleDateString()}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-xs text-muted-foreground" title={r.notes ?? ''}>
                    {r.notes ?? '—'}
                  </td>
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
