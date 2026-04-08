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
} from '../shared/adminStyles'
import {
  createInterventionPlan,
  deleteInterventionPlan,
  getInterventionPlans,
  getResidents,
  type InterventionPlan,
  type ResidentSummary,
} from '../../../api/admin'
import { AdminListToolbar } from '../shared/AdminListToolbar'
import { nextSortState, sortRows, SortableTh, type SortDirection } from '../shared/SortableTh'
import { AdminBulkActionsBar } from '../shared/adminDataTable/AdminBulkActionsBar'
import { AdminDeleteModal } from '../shared/adminDataTable/AdminDeleteModal'
import { CategoryBadge, StatusBadge } from '../shared/adminDataTable/AdminBadges'
import {
  FilterPanelCard,
  DateRangeFilter,
  MultiSelectFilter,
  SearchableEntityMultiFilter,
  TextSearchFilter,
} from '../shared/adminDataTable/AdminFilterPrimitives'
import { formatAdminDate, inDateRange, matchesIdMulti, matchesStringMulti, uniqSortedStrings } from '../shared/adminDataTable/adminFormatters'

const PLAN_STATUSES = ['Open', 'In Progress', 'Achieved', 'On Hold', 'Closed'] as const

function emptyFilters() {
  return {
    confFrom: '',
    confTo: '',
    residentIds: new Set<number>(),
    planCategories: new Set<string>(),
    servicesSearch: '',
    targetFrom: '',
    targetTo: '',
    statuses: new Set<string>(),
  }
}

export function CaseConferencesAdminPage() {
  const navigate = useNavigate()
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [q, setQ] = useState('')
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUpcoming, setShowUpcoming] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState(emptyFilters)
  const [resSearch, setResSearch] = useState('')
  const [showAddPlan, setShowAddPlan] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteModal, setDeleteModal] = useState<{ ids: number[]; labels: string[] } | null>(null)

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

  const residentOptions = useMemo(
    () => residents.map((r) => ({ id: r.id, label: `${r.internalCode} (#${r.id})` })),
    [residents],
  )

  const catOpts = useMemo(() => uniqSortedStrings(plans.map((p) => p.planCategory)), [plans])
  const statusOpts = useMemo(() => uniqSortedStrings(plans.map((p) => p.status)), [plans])

  const filteredSorted = useMemo(() => {
    let list = plans.filter((p) => {
      const hay = `${p.residentInternalCode} ${p.planCategory} ${p.planDescription} ${p.servicesProvided ?? ''} ${p.status}`.toLowerCase()
      if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false
      if (filters.confFrom || filters.confTo) {
        if (!inDateRange(p.caseConferenceDate, filters.confFrom, filters.confTo)) return false
      }
      if (!matchesIdMulti(p.residentId, filters.residentIds)) return false
      if (!matchesStringMulti(p.planCategory, filters.planCategories)) return false
      if (
        filters.servicesSearch.trim() &&
        !(p.servicesProvided ?? '').toLowerCase().includes(filters.servicesSearch.trim().toLowerCase())
      ) {
        return false
      }
      if (filters.targetFrom || filters.targetTo) {
        if (!inDateRange(p.targetDate, filters.targetFrom, filters.targetTo)) return false
      }
      if (!matchesStringMulti(p.status, filters.statuses)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'caseConferenceDate':
          return row.caseConferenceDate ?? ''
        case 'residentInternalCode':
          return row.residentInternalCode
        case 'planCategory':
          return row.planCategory
        case 'servicesProvided':
          return row.servicesProvided ?? ''
        case 'targetDate':
          return row.targetDate ?? ''
        case 'status':
          return row.status
        default:
          return ''
      }
    })
    return list
  }, [plans, q, filters, sortKey, sortDir])

  const activeSummary = useMemo(() => {
    const p: string[] = []
    if (filters.confFrom || filters.confTo) p.push('Conference date')
    if (filters.residentIds.size) p.push(`Residents: ${filters.residentIds.size}`)
    if (filters.planCategories.size) p.push(`Category: ${filters.planCategories.size}`)
    if (filters.servicesSearch.trim()) p.push('Services')
    if (filters.targetFrom || filters.targetTo) p.push('Target date')
    if (filters.statuses.size) p.push(`Status: ${filters.statuses.size}`)
    return p
  }, [filters])

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

  function openDeleteModal() {
    if (selected.size === 0) return
    const labels = filteredSorted
      .filter((p) => selected.has(p.id))
      .map((p) => `${p.residentInternalCode} · ${p.planCategory}`)
    setDeleteModal({ ids: [...selected], labels })
  }

  async function confirmDelete() {
    if (!deleteModal) return
    setSaving(true)
    setError(null)
    try {
      for (const id of deleteModal.ids) {
        await deleteInterventionPlan(id)
      }
      setSelected(new Set())
      setDeleteModal(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  async function onCreatePlan(e: FormEvent) {
    e.preventDefault()
    if (!newResidentId || !newCategory.trim() || !newDescription.trim()) return
    const targetValue = newTargetVal.trim() ? parseFloat(newTargetVal) : null
    setSaving(true)
    setError(null)
    try {
      await createInterventionPlan({
        residentId: newResidentId,
        planCategory: newCategory.trim(),
        planDescription: newDescription.trim(),
        targetDate: newTargetDate.trim() || null,
        targetValue,
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

  const colCount = 7

  return (
    <div className="space-y-6">
      <div>
        <h2 className={pageTitle}>Case conferences</h2>
        <p className={pageDesc}>
          Intervention plans — open a row for the resident case file. Conference and target dates support range filters.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

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
                      {p.caseConferenceDate ? formatAdminDate(p.caseConferenceDate) : '—'} · {p.status}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      <AdminListToolbar
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search plans…"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        onAddClick={openAddPlan}
        addLabel="Add plan"
      />

      <AdminBulkActionsBar
        count={selected.size}
        recordLabel="plan"
        onDeleteClick={openDeleteModal}
        onClearSelection={() => setSelected(new Set())}
        disabled={saving}
      />

      {filterOpen && (
        <FilterPanelCard onClearAll={() => setFilters(emptyFilters())} activeSummary={activeSummary}>
          <DateRangeFilter
            labelText="Case conference date"
            from={filters.confFrom}
            to={filters.confTo}
            onFrom={(v) => setFilters((f) => ({ ...f, confFrom: v }))}
            onTo={(v) => setFilters((f) => ({ ...f, confTo: v }))}
          />
          <SearchableEntityMultiFilter
            labelText="Resident"
            options={residentOptions}
            selectedIds={filters.residentIds}
            onChange={(s) => setFilters((f) => ({ ...f, residentIds: s }))}
            search={resSearch}
            onSearchChange={setResSearch}
          />
          <MultiSelectFilter
            labelText="Plan category"
            options={catOpts}
            selected={filters.planCategories}
            onChange={(s) => setFilters((f) => ({ ...f, planCategories: s }))}
          />
          <TextSearchFilter
            labelText="Services provided"
            value={filters.servicesSearch}
            onChange={(v) => setFilters((f) => ({ ...f, servicesSearch: v }))}
            placeholder="Contains…"
          />
          <DateRangeFilter
            labelText="Target date"
            from={filters.targetFrom}
            to={filters.targetTo}
            onFrom={(v) => setFilters((f) => ({ ...f, targetFrom: v }))}
            onTo={(v) => setFilters((f) => ({ ...f, targetTo: v }))}
          />
          <MultiSelectFilter
            labelText="Status"
            options={statusOpts.length ? statusOpts : [...PLAN_STATUSES]}
            selected={filters.statuses}
            onChange={(s) => setFilters((f) => ({ ...f, statuses: s }))}
          />
        </FilterPanelCard>
      )}

      {showAddPlan && (
        <div id="admin-add-intervention-plan" className={`${card} scroll-mt-28 space-y-4`}>
          <div className="flex items-center justify-between">
            <p className={sectionFormTitle}>New intervention plan</p>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowAddPlan(false)}>
              Close
            </button>
          </div>
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
        </div>
      )}

      <div className={tableWrap}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="w-10 px-2 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={filteredSorted.length > 0 && filteredSorted.every((p) => selected.has(p.id))}
                  onChange={toggleSelectAll}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <SortableTh label="Conference" sortKey="caseConferenceDate" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Resident" sortKey="residentInternalCode" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Category" sortKey="planCategory" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Services" sortKey="servicesProvided" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Target" sortKey="targetDate" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Status" sortKey="status" activeKey={sortKey} direction={sortDir} onSort={onSort} />
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
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} aria-label={`Select plan ${p.id}`} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{formatAdminDate(p.caseConferenceDate)}</td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{p.residentInternalCode}</td>
                  <td className="px-3 py-2.5">
                    <CategoryBadge>{p.planCategory}</CategoryBadge>
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2.5 text-muted-foreground" title={p.servicesProvided ?? ''}>
                    {p.servicesProvided ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{formatAdminDate(p.targetDate)}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminDeleteModal
        open={deleteModal != null}
        title={deleteModal && deleteModal.ids.length === 1 ? 'Delete intervention plan?' : 'Delete intervention plans?'}
        body={
          deleteModal
            ? deleteModal.ids.length === 1
              ? 'You are about to delete one intervention plan / case conference record.'
              : `You are about to delete ${deleteModal.ids.length} intervention plans.`
            : ''
        }
        previewLines={deleteModal ? deleteModal.labels.slice(0, 12) : undefined}
        loading={saving}
        onCancel={() => setDeleteModal(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
