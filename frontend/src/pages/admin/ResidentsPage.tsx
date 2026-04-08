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
  sectionFormTitle,
  tableBody,
  tableHead,
  tableRowHover,
  tableWrap,
} from './adminStyles'
import { createResident, deleteResident, getResidents, type ResidentSummary } from '../../api/admin'
import { useSupabaseForLighthouseData } from '../../lib/useSupabaseLighthouse'
import { AdminListToolbar } from './AdminListToolbar'
import { matchesColFilter, nextSortState, sortRows, SortableTh, type SortDirection } from './SortableTh'

type ColFilters = {
  internalCode: string
  caseControlNo: string
  caseStatus: string
  caseCategory: string
  safehouseId: string
  safehouseName: string
  sex: string
  assignedSocialWorker: string
  dateOfAdmission: string
  reintegrationStatus: string
  reintegrationType: string
}

const emptyFilters = (): ColFilters => ({
  internalCode: '',
  caseControlNo: '',
  caseStatus: '',
  caseCategory: '',
  safehouseId: '',
  safehouseName: '',
  sex: '',
  assignedSocialWorker: '',
  dateOfAdmission: '',
  reintegrationStatus: '',
  reintegrationType: '',
})

const FILTER_LABELS: Record<keyof ColFilters, string> = {
  internalCode: 'Internal code',
  caseControlNo: 'Control no.',
  caseStatus: 'Status',
  caseCategory: 'Category',
  safehouseId: 'Safehouse ID',
  safehouseName: 'Safehouse',
  sex: 'Sex',
  assignedSocialWorker: 'Social worker',
  dateOfAdmission: 'Admission date',
  reintegrationStatus: 'Reintegration status',
  reintegrationType: 'Reintegration type',
}

export function ResidentsPage() {
  const sbData = useSupabaseForLighthouseData()
  const navigate = useNavigate()
  const [rows, setRows] = useState<ResidentSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [colFilters, setColFilters] = useState<ColFilters>(emptyFilters)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [newCode, setNewCode] = useState('')
  const [newStatus, setNewStatus] = useState('Active')
  const [newCat, setNewCat] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await getResidents({})
      setRows(r)
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

  const filteredSorted = useMemo(() => {
    let list = rows.filter((r) => {
      const hay = `${r.internalCode} ${r.caseControlNo} ${r.caseCategory} ${r.caseStatus} ${r.safehouseName ?? ''} ${r.assignedSocialWorker ?? ''} ${r.reintegrationStatus ?? ''} ${r.reintegrationType ?? ''} ${r.sex} ${r.id} ${r.safehouseId} ${r.dateOfAdmission ?? ''}`.toLowerCase()
      if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false
      if (!matchesColFilter(r.internalCode, colFilters.internalCode)) return false
      if (!matchesColFilter(r.caseControlNo, colFilters.caseControlNo)) return false
      if (!matchesColFilter(r.caseStatus, colFilters.caseStatus)) return false
      if (!matchesColFilter(r.caseCategory, colFilters.caseCategory)) return false
      if (!matchesColFilter(r.safehouseId, colFilters.safehouseId)) return false
      if (!matchesColFilter(r.safehouseName, colFilters.safehouseName)) return false
      if (!matchesColFilter(r.sex, colFilters.sex)) return false
      if (!matchesColFilter(r.assignedSocialWorker, colFilters.assignedSocialWorker)) return false
      if (!matchesColFilter(r.dateOfAdmission, colFilters.dateOfAdmission)) return false
      if (!matchesColFilter(r.reintegrationStatus, colFilters.reintegrationStatus)) return false
      if (!matchesColFilter(r.reintegrationType, colFilters.reintegrationType)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'internalCode':
          return row.internalCode
        case 'caseStatus':
          return row.caseStatus
        case 'caseCategory':
          return row.caseCategory
        case 'safehouseName':
          return row.safehouseName ?? ''
        case 'assignedSocialWorker':
          return row.assignedSocialWorker ?? ''
        case 'dateOfAdmission':
          return row.dateOfAdmission ?? ''
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
    if (!confirm(`Delete ${selected.size} resident record(s)? Related data may block deletes. This cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      for (const id of selected) {
        await deleteResident(id)
      }
      setSelected(new Set())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!newCode.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createResident({
        internalCode: newCode.trim(),
        caseStatus: newStatus,
        caseCategory: newCat.trim() || undefined,
      })
      setNewCode('')
      setNewCat('')
      setAddOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function openAdd() {
    setAddOpen(true)
    requestAnimationFrame(() => document.getElementById('admin-add-resident')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const colCount = sbData ? 7 : 6

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Residents</h2>
        <p className={pageDesc}>
          Filter and sort locally across all columns. Click a row to open the case file. Bulk delete requires Supabase.
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
        addLabel="Add resident"
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
        <form
          id="admin-add-resident"
          onSubmit={onCreate}
          className={`${card} scroll-mt-28 grid max-w-xl gap-3 sm:grid-cols-2`}
        >
          <div className="flex items-center justify-between sm:col-span-2">
            <p className={sectionFormTitle}>Minimal intake (edit full profile on the resident page)</p>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setAddOpen(false)}>
              Close
            </button>
          </div>
          <label className={`${label} sm:col-span-2`}>
            Internal code *
            <input className={input} value={newCode} onChange={(e) => setNewCode(e.target.value)} required />
          </label>
          <label className={label}>
            Status
            <select className={input} value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              <option value="Active">Active</option>
              <option value="Closed">Closed</option>
              <option value="Transferred">Transferred</option>
            </select>
          </label>
          <label className={label}>
            Case category
            <input className={input} value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? 'Saving…' : 'Add resident'}
            </button>
          </div>
        </form>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Directory</h3>
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
                <SortableTh label="Code" sortKey="internalCode" activeKey={sortKey} direction={sortDir} onSort={onSort} />
                <SortableTh label="Status" sortKey="caseStatus" activeKey={sortKey} direction={sortDir} onSort={onSort} />
                <SortableTh label="Category" sortKey="caseCategory" activeKey={sortKey} direction={sortDir} onSort={onSort} />
                <SortableTh label="House" sortKey="safehouseName" activeKey={sortKey} direction={sortDir} onSort={onSort} />
                <SortableTh label="Social worker" sortKey="assignedSocialWorker" activeKey={sortKey} direction={sortDir} onSort={onSort} />
                <SortableTh label="Admission" sortKey="dateOfAdmission" activeKey={sortKey} direction={sortDir} onSort={onSort} />
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
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filteredSorted.map((r) => (
                  <tr
                    key={r.id}
                    className={`${tableRowHover} cursor-pointer`}
                    onClick={() => navigate(`/admin/residents/${r.id}`)}
                  >
                    {sbData && (
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Select ${r.internalCode}`} />
                      </td>
                    )}
                    <td className="px-3 py-2 font-medium">{r.internalCode}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.caseStatus}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.caseCategory}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.safehouseName ?? r.safehouseId}</td>
                    <td className="px-3 py-2 text-xs">{r.assignedSocialWorker ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.dateOfAdmission ? new Date(r.dateOfAdmission).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
