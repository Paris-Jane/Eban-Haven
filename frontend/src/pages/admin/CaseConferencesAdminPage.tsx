import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  createInterventionPlan,
  deleteInterventionPlan,
  getInterventionPlans,
  getResidents,
  type InterventionPlan,
  type ResidentSummary,
} from '../../api/admin'
import { useSupabaseForLighthouseData } from '../../lib/useSupabaseLighthouse'
import { AdminListToolbar } from './AdminListToolbar'
import { matchesColFilter, nextSortState, sortRows, SortableTh, type SortDirection } from './SortableTh'

const PLAN_STATUSES = ['In Progress', 'On Hold', 'Achieved', 'Not Achieved'] as const

type ColFilters = {
  id: string
  residentId: string
  residentInternalCode: string
  planCategory: string
  planDescription: string
  servicesProvided: string
  targetValue: string
  targetDate: string
  status: string
  caseConferenceDate: string
  createdAt: string
  updatedAt: string
}

const emptyFilters = (): ColFilters => ({
  id: '',
  residentId: '',
  residentInternalCode: '',
  planCategory: '',
  planDescription: '',
  servicesProvided: '',
  targetValue: '',
  targetDate: '',
  status: '',
  caseConferenceDate: '',
  createdAt: '',
  updatedAt: '',
})

const FILTER_LABELS: Record<keyof ColFilters, string> = {
  id: 'Plan ID',
  residentId: 'Resident ID',
  residentInternalCode: 'Resident code',
  planCategory: 'Category',
  planDescription: 'Description',
  servicesProvided: 'Services',
  targetValue: 'Target value',
  targetDate: 'Target date',
  status: 'Status',
  caseConferenceDate: 'Conference date',
  createdAt: 'Created',
  updatedAt: 'Updated',
}

export function CaseConferencesAdminPage() {
  const sbData = useSupabaseForLighthouseData()
  const navigate = useNavigate()
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [q, setQ] = useState('')
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUpcoming, setShowUpcoming] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [colFilters, setColFilters] = useState<ColFilters>(emptyFilters)
  const [showAddPlan, setShowAddPlan] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [newResidentId, setNewResidentId] = useState(0)
  const [newCategory, setNewCategory] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newServices, setNewServices] = useState('')
  const [newTargetVal, setNewTargetVal] = useState('')
  const [newTargetDate, setNewTargetDate] = useState('')
  const [newStatus, setNewStatus] = useState<string>(PLAN_STATUSES[0])
  const [newConfDate, setNewConfDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getResidents({})
      setResidents(res)
      const p = await getInterventionPlans()
      setPlans(p)
      setNewResidentId((prev) => prev || res[0]?.id || 0)
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

  useEffect(() => {
    if (!showAddPlan) return
    setNewResidentId((prev) => (prev && residents.some((r) => r.id === prev) ? prev : residents[0]?.id ?? 0))
  }, [showAddPlan, residents])

  const filteredSorted = useMemo(() => {
    let list = plans.filter((p) => {
      const hay = `${p.residentInternalCode} ${p.planCategory} ${p.planDescription} ${p.servicesProvided ?? ''} ${p.status} ${p.id}`.toLowerCase()
      if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false
      if (!matchesColFilter(p.id, colFilters.id)) return false
      if (!matchesColFilter(p.residentId, colFilters.residentId)) return false
      if (!matchesColFilter(p.residentInternalCode, colFilters.residentInternalCode)) return false
      if (!matchesColFilter(p.planCategory, colFilters.planCategory)) return false
      if (!matchesColFilter(p.planDescription, colFilters.planDescription)) return false
      if (!matchesColFilter(p.servicesProvided, colFilters.servicesProvided)) return false
      if (!matchesColFilter(p.targetValue, colFilters.targetValue)) return false
      if (!matchesColFilter(p.targetDate, colFilters.targetDate)) return false
      if (!matchesColFilter(p.status, colFilters.status)) return false
      if (!matchesColFilter(p.caseConferenceDate, colFilters.caseConferenceDate)) return false
      if (!matchesColFilter(p.createdAt, colFilters.createdAt)) return false
      if (!matchesColFilter(p.updatedAt, colFilters.updatedAt)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'id':
          return row.id
        case 'residentInternalCode':
          return row.residentInternalCode
        case 'planCategory':
          return row.planCategory
        case 'status':
          return row.status
        case 'caseConferenceDate':
          return row.caseConferenceDate ?? ''
        case 'targetDate':
          return row.targetDate ?? ''
        default:
          return ''
      }
    })
    return list
  }, [plans, q, colFilters, sortKey, sortDir])

  const upcomingPlans = useMemo(
    () =>
      [...plans]
        .filter((p) => p.caseConferenceDate)
        .sort((a, b) => (a.caseConferenceDate ?? '').localeCompare(b.caseConferenceDate ?? ''))
        .slice(0, 40),
    [plans],
  )

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
    const ids = filteredSorted.map((p) => p.id)
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
    if (!confirm(`Delete ${selected.size} plan(s)? This cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      for (const id of selected) {
        await deleteInterventionPlan(id)
      }
      setSelected(new Set())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  async function onCreatePlan(e: FormEvent) {
    e.preventDefault()
    if (!sbData || !newResidentId || !newCategory.trim() || !newDescription.trim()) return
    const tv = newTargetVal.trim() ? parseFloat(newTargetVal) : null
    setSaving(true)
    setError(null)
    try {
      await createInterventionPlan({
        residentId: newResidentId,
        planCategory: newCategory.trim(),
        planDescription: newDescription.trim(),
        servicesProvided: newServices.trim() || undefined,
        targetValue: tv != null && Number.isFinite(tv) ? tv : null,
        targetDate: newTargetDate.trim() || null,
        status: newStatus,
        caseConferenceDate: newConfDate.trim() || null,
      })
      setNewCategory('')
      setNewDescription('')
      setNewServices('')
      setNewTargetVal('')
      setNewTargetDate('')
      setNewConfDate('')
      setNewStatus(PLAN_STATUSES[0])
      setShowAddPlan(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan')
    } finally {
      setSaving(false)
    }
  }

  function openAddPlan() {
    setShowAddPlan(true)
    requestAnimationFrame(() => document.getElementById('admin-add-intervention-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const colCount = sbData ? 7 : 6

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Case conferences</h2>
        <p className={pageDesc}>
          Intervention plans and conference dates. Filter by any column; click a row to open the resident. Bulk delete
          requires Supabase.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <AdminListToolbar
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search plans…"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        onAddClick={openAddPlan}
        addLabel="Add plan"
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
        <div className={`${card} grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3`}>
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

      {showAddPlan && (
        <div id="admin-add-intervention-plan" className={`${card} scroll-mt-28 space-y-4`}>
          <div className="flex items-center justify-between">
            <p className={sectionFormTitle}>New intervention plan</p>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowAddPlan(false)}>
              Close
            </button>
          </div>
          {!sbData ? (
            <p className="text-sm text-muted-foreground">
              Creating plans requires Supabase program data. Set <code className="rounded bg-muted px-1">VITE_USE_SUPABASE_DATA=true</code> and apply
              lighthouse migrations.
            </p>
          ) : (
            <form onSubmit={onCreatePlan} className="grid gap-3 sm:grid-cols-2">
              <label className={label}>
                Resident *
                <select
                  className={input}
                  value={newResidentId || ''}
                  onChange={(e) => setNewResidentId(Number(e.target.value))}
                  required
                >
                  {residents.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.internalCode}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Plan status *
                <select className={input} value={newStatus} onChange={(e) => setNewStatus(e.target.value)} required>
                  {PLAN_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${label} sm:col-span-2`}>
                Plan category *
                <input className={input} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} required />
              </label>
              <label className={`${label} sm:col-span-2`}>
                Plan description *
                <textarea className={input} rows={3} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} required />
              </label>
              <label className={`${label} sm:col-span-2`}>
                Services provided
                <input className={input} value={newServices} onChange={(e) => setNewServices(e.target.value)} />
              </label>
              <label className={label}>
                Case conference date
                <input type="date" className={input} value={newConfDate} onChange={(e) => setNewConfDate(e.target.value)} />
              </label>
              <label className={label}>
                Target date
                <input type="date" className={input} value={newTargetDate} onChange={(e) => setNewTargetDate(e.target.value)} />
              </label>
              <label className={label}>
                Target value (numeric)
                <input className={input} value={newTargetVal} onChange={(e) => setNewTargetVal(e.target.value)} />
              </label>
              <div className="flex items-end">
                <button type="submit" disabled={saving} className={btnPrimary}>
                  {saving ? 'Saving…' : 'Save plan'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className={tableWrap}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className={tableHead}>
            <tr>
              {sbData && (
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={filteredSorted.length > 0 && filteredSorted.every((p) => selected.has(p.id))}
                    onChange={() => toggleSelectAll()}
                  />
                </th>
              )}
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Resident" sortKey="residentInternalCode" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Category" sortKey="planCategory" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Status" sortKey="status" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Conference" sortKey="caseConferenceDate" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <th className="px-4 py-3">Services</th>
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
                  No plans match.
                </td>
              </tr>
            ) : (
              filteredSorted.map((p) => (
                <tr
                  key={p.id}
                  className={`${tableRowHover} cursor-pointer`}
                  onClick={() => navigate(`/admin/residents/${p.residentId}`)}
                >
                  {sbData && (
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} aria-label={`Select ${p.id}`} />
                    </td>
                  )}
                  <td className="px-4 py-3 text-muted-foreground">{p.id}</td>
                  <td className="px-4 py-3 font-medium text-primary">{p.residentInternalCode}</td>
                  <td className="px-4 py-3">{p.planCategory}</td>
                  <td className="px-4 py-3">{p.status}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.caseConferenceDate ? new Date(p.caseConferenceDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted-foreground" title={p.servicesProvided ?? ''}>
                    {p.servicesProvided ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={card}>
        <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setShowUpcoming((s) => !s)}>
          {showUpcoming ? 'Hide scheduled conferences' : 'Show scheduled conferences'}
        </button>
        {showUpcoming && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-foreground">Upcoming / recent case conferences</h3>
            <p className="mt-1 text-xs text-muted-foreground">Plans with a scheduled conference date.</p>
            <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto text-sm">
              {upcomingPlans.length === 0 ? (
                <li className="text-muted-foreground">None in dataset.</li>
              ) : (
                upcomingPlans.map((p) => (
                  <li key={p.id} className="border-b border-border/60 pb-2">
                    <Link className="font-medium text-primary hover:underline" to={`/admin/residents/${p.residentId}`}>
                      {p.residentInternalCode}
                    </Link>
                    <span className="text-foreground"> · {p.planCategory}</span>
                    <span className="ml-2 text-muted-foreground">
                      {p.caseConferenceDate ? new Date(p.caseConferenceDate).toLocaleDateString() : '—'} · {p.status}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
