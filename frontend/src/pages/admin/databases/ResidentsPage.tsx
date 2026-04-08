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
} from '../shared/adminStyles'
import { createResident, deleteResident, getResidents, getSafehouses, type ResidentSummary } from '../../../api/admin'
import { AdminListToolbar } from '../shared/AdminListToolbar'
import { nextSortState, sortRows, SortableTh, type SortDirection } from '../shared/SortableTh'
import { AdminBulkActionsBar } from '../shared/adminDataTable/AdminBulkActionsBar'
import { AdminDeleteModal } from '../shared/adminDataTable/AdminDeleteModal'
import { CategoryBadge, ReintegrationBadge, RiskBadge, StatusBadge } from '../shared/adminDataTable/AdminBadges'
import {
  FilterPanelCard,
  DateRangeFilter,
  MinMaxFilter,
  MultiSelectFilter,
  SearchableEntityMultiFilter,
  TextSearchFilter,
} from '../shared/adminDataTable/AdminFilterPrimitives'
import {
  formatAdminDate,
  inDateRange,
  inPresentAgeRange,
  matchesIdMulti,
  matchesStringMulti,
  uniqSortedStrings,
} from '../shared/adminDataTable/adminFormatters'

function emptyFilters() {
  return {
    internalCode: '',
    safehouseIds: new Set<number>(),
    caseStatuses: new Set<string>(),
    sexes: new Set<string>(),
    presentAgeMin: '',
    presentAgeMax: '',
    caseCategories: new Set<string>(),
    admissionFrom: '',
    admissionTo: '',
    lengthOfStay: '',
    reintegrations: new Set<string>(),
    riskLevels: new Set<string>(),
    socialWorkers: new Set<string>(),
  }
}

export function ResidentsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ResidentSummary[]>([])
  const [safehouses, setSafehouses] = useState<Awaited<ReturnType<typeof getSafehouses>>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState(emptyFilters)
  const [shSearch, setShSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteModal, setDeleteModal] = useState<{ ids: number[]; labels: string[] } | null>(null)

  const [newCode, setNewCode] = useState('')
  const [newStatus, setNewStatus] = useState('Active')
  const [newCat, setNewCat] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, sh] = await Promise.all([getResidents({}), getSafehouses()])
      setRows(r)
      setSafehouses(sh)
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

  const safehouseOptions = useMemo(
    () => safehouses.map((s) => ({ id: s.id, label: `${s.name} (${s.code})` })),
    [safehouses],
  )

  const safehouseNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of safehouses) m.set(s.id, s.name)
    return m
  }, [safehouses])

  const caseStatusOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.caseStatus)), [rows])
  const sexOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.sex)), [rows])
  const catOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.caseCategory)), [rows])
  const reintOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.reintegrationStatus)), [rows])
  const riskOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.currentRiskLevel)), [rows])
  const swOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.assignedSocialWorker)), [rows])

  const filteredSorted = useMemo(() => {
    let list = rows.filter((r) => {
      const hay = `${r.internalCode} ${r.caseCategory} ${r.caseStatus} ${r.safehouseName ?? ''} ${r.assignedSocialWorker ?? ''} ${r.presentAge ?? ''}`.toLowerCase()
      if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false
      if (filters.internalCode.trim() && !r.internalCode.toLowerCase().includes(filters.internalCode.trim().toLowerCase())) {
        return false
      }
      if (!matchesIdMulti(r.safehouseId, filters.safehouseIds)) return false
      if (!matchesStringMulti(r.caseStatus, filters.caseStatuses)) return false
      if (!matchesStringMulti(r.sex, filters.sexes)) return false
      if (!inPresentAgeRange(r.presentAge, filters.presentAgeMin, filters.presentAgeMax)) return false
      if (!matchesStringMulti(r.caseCategory, filters.caseCategories)) return false
      if (filters.admissionFrom || filters.admissionTo) {
        if (!inDateRange(r.dateOfAdmission, filters.admissionFrom, filters.admissionTo)) return false
      }
      if (
        filters.lengthOfStay.trim() &&
        !(r.lengthOfStay ?? '').toLowerCase().includes(filters.lengthOfStay.trim().toLowerCase())
      ) {
        return false
      }
      if (!matchesStringMulti(r.reintegrationStatus ?? '', filters.reintegrations)) return false
      if (!matchesStringMulti(r.currentRiskLevel ?? '', filters.riskLevels)) return false
      if (!matchesStringMulti(r.assignedSocialWorker ?? '', filters.socialWorkers)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'internalCode':
          return row.internalCode
        case 'safehouseId':
          return row.safehouseId
        case 'caseStatus':
          return row.caseStatus
        case 'sex':
          return row.sex
        case 'presentAge':
          return row.presentAge ?? ''
        case 'caseCategory':
          return row.caseCategory
        case 'dateOfAdmission':
          return row.dateOfAdmission ?? ''
        case 'lengthOfStay':
          return row.lengthOfStay ?? ''
        case 'reintegrationStatus':
          return row.reintegrationStatus ?? ''
        case 'currentRiskLevel':
          return row.currentRiskLevel ?? ''
        case 'assignedSocialWorker':
          return row.assignedSocialWorker ?? ''
        default:
          return ''
      }
    })
    return list
  }, [rows, q, filters, sortKey, sortDir])

  const activeSummary = useMemo(() => {
    const p: string[] = []
    if (filters.internalCode.trim()) p.push('Code')
    if (filters.safehouseIds.size) p.push(`Safehouse: ${filters.safehouseIds.size}`)
    if (filters.caseStatuses.size) p.push(`Status: ${filters.caseStatuses.size}`)
    if (filters.sexes.size) p.push(`Sex: ${filters.sexes.size}`)
    if (filters.presentAgeMin || filters.presentAgeMax) p.push('Age range')
    if (filters.caseCategories.size) p.push(`Category: ${filters.caseCategories.size}`)
    if (filters.admissionFrom || filters.admissionTo) p.push('Admission range')
    if (filters.lengthOfStay.trim()) p.push('Stay')
    if (filters.reintegrations.size) p.push(`Reintegration: ${filters.reintegrations.size}`)
    if (filters.riskLevels.size) p.push(`Risk: ${filters.riskLevels.size}`)
    if (filters.socialWorkers.size) p.push(`SW: ${filters.socialWorkers.size}`)
    return p
  }, [filters])

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

  function openDeleteModal() {
    if (selected.size === 0) return
    const labels = filteredSorted.filter((r) => selected.has(r.id)).map((r) => r.internalCode)
    setDeleteModal({ ids: [...selected], labels })
  }

  async function confirmDelete() {
    if (!deleteModal) return
    setSaving(true)
    setError(null)
    try {
      for (const id of deleteModal.ids) {
        await deleteResident(id)
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

  const colCount = 12

  return (
    <div className="space-y-6">
      <div>
        <h2 className={pageTitle}>Residents</h2>
        <p className={pageDesc}>
          Case directory — open a row for the full case file. Structured filters and safe delete confirmation.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <AdminListToolbar
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Quick search…"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        onAddClick={openAdd}
        addLabel="Add resident"
      />

      <AdminBulkActionsBar
        count={selected.size}
        recordLabel="resident"
        onDeleteClick={openDeleteModal}
        onClearSelection={() => setSelected(new Set())}
        disabled={saving}
      />

      {filterOpen && (
        <FilterPanelCard onClearAll={() => setFilters(emptyFilters())} activeSummary={activeSummary}>
          <TextSearchFilter
            labelText="Internal code"
            value={filters.internalCode}
            onChange={(v) => setFilters((f) => ({ ...f, internalCode: v }))}
          />
          <SearchableEntityMultiFilter
            labelText="Safehouse"
            options={safehouseOptions}
            selectedIds={filters.safehouseIds}
            onChange={(s) => setFilters((f) => ({ ...f, safehouseIds: s }))}
            search={shSearch}
            onSearchChange={setShSearch}
          />
          <MultiSelectFilter
            labelText="Case status"
            options={caseStatusOpts.length ? caseStatusOpts : ['Active', 'Closed']}
            selected={filters.caseStatuses}
            onChange={(s) => setFilters((f) => ({ ...f, caseStatuses: s }))}
          />
          <MultiSelectFilter
            labelText="Sex"
            options={sexOpts.length ? sexOpts : ['F', 'M']}
            selected={filters.sexes}
            onChange={(s) => setFilters((f) => ({ ...f, sexes: s }))}
          />
          <MinMaxFilter
            labelText="Present age (leading number)"
            min={filters.presentAgeMin}
            max={filters.presentAgeMax}
            onMin={(v) => setFilters((f) => ({ ...f, presentAgeMin: v }))}
            onMax={(v) => setFilters((f) => ({ ...f, presentAgeMax: v }))}
          />
          <MultiSelectFilter
            labelText="Case category"
            options={catOpts.length ? catOpts : ['Surrendered']}
            selected={filters.caseCategories}
            onChange={(s) => setFilters((f) => ({ ...f, caseCategories: s }))}
          />
          <DateRangeFilter
            labelText="Date of admission"
            from={filters.admissionFrom}
            to={filters.admissionTo}
            onFrom={(v) => setFilters((f) => ({ ...f, admissionFrom: v }))}
            onTo={(v) => setFilters((f) => ({ ...f, admissionTo: v }))}
          />
          <TextSearchFilter
            labelText="Length of stay"
            value={filters.lengthOfStay}
            onChange={(v) => setFilters((f) => ({ ...f, lengthOfStay: v }))}
            placeholder="Contains…"
          />
          <MultiSelectFilter
            labelText="Reintegration status"
            options={reintOpts.length ? reintOpts : ['In Progress', 'Completed']}
            selected={filters.reintegrations}
            onChange={(s) => setFilters((f) => ({ ...f, reintegrations: s }))}
          />
          <MultiSelectFilter
            labelText="Current risk level"
            options={riskOpts.length ? riskOpts : ['Low', 'Medium', 'High']}
            selected={filters.riskLevels}
            onChange={(s) => setFilters((f) => ({ ...f, riskLevels: s }))}
          />
          <MultiSelectFilter
            labelText="Assigned social worker"
            options={swOpts.length ? swOpts : ['—']}
            selected={filters.socialWorkers}
            onChange={(s) => setFilters((f) => ({ ...f, socialWorkers: s }))}
          />
        </FilterPanelCard>
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

      <div className={tableWrap}>
        <table className="w-full text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="w-10 px-2 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={filteredSorted.length > 0 && filteredSorted.every((r) => selected.has(r.id))}
                  onChange={toggleSelectAll}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <SortableTh label="Internal code" sortKey="internalCode" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Safehouse" sortKey="safehouseId" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Case status" sortKey="caseStatus" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Sex" sortKey="sex" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Present age" sortKey="presentAge" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Category" sortKey="caseCategory" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Admission" sortKey="dateOfAdmission" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Length of stay" sortKey="lengthOfStay" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Reintegration" sortKey="reintegrationStatus" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Risk" sortKey="currentRiskLevel" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Social worker" sortKey="assignedSocialWorker" activeKey={sortKey} direction={sortDir} onSort={onSort} />
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
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Select ${r.internalCode}`} />
                  </td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{r.internalCode}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.safehouseName ?? safehouseNameById.get(r.safehouseId) ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.caseStatus} />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.sex}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.presentAge ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <CategoryBadge>{r.caseCategory}</CategoryBadge>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{formatAdminDate(r.dateOfAdmission)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.lengthOfStay ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    {r.reintegrationStatus ? <ReintegrationBadge value={r.reintegrationStatus} /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.currentRiskLevel ? <RiskBadge level={r.currentRiskLevel} /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.assignedSocialWorker ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminDeleteModal
        open={deleteModal != null}
        title={deleteModal && deleteModal.ids.length === 1 ? 'Delete resident?' : 'Delete residents?'}
        body={
          deleteModal
            ? deleteModal.ids.length === 1
              ? `You are about to delete resident “${deleteModal.labels[0] ?? deleteModal.ids[0]}”. Related records may block this.`
              : `You are about to delete ${deleteModal.ids.length} resident records. Related data may block some deletes.`
            : ''
        }
        previewLines={deleteModal && deleteModal.ids.length > 1 ? deleteModal.labels : undefined}
        loading={saving}
        onCancel={() => setDeleteModal(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
