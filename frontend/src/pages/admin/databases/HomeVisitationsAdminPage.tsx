import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  alertError,
  btnPrimary,
  cardForm,
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
  createHomeVisitation,
  deleteHomeVisitation,
  getHomeVisitations,
  getResidents,
  type HomeVisitation,
  type ResidentSummary,
} from '../../../api/admin'
import { AdminListToolbar } from '../shared/AdminListToolbar'
import { nextSortState, sortRows, SortableTh, type SortDirection } from '../shared/SortableTh'
import { AdminBulkActionsBar } from '../shared/adminDataTable/AdminBulkActionsBar'
import { AdminDeleteModal } from '../shared/adminDataTable/AdminDeleteModal'
import { BooleanBadge, CategoryBadge, VisitOutcomeBadge } from '../shared/adminDataTable/AdminBadges'
import {
  FilterPanelCard,
  DateRangeFilter,
  MultiSelectFilter,
  SearchableEntityMultiFilter,
  TextSearchFilter,
  TriBoolFilter,
} from '../shared/adminDataTable/AdminFilterPrimitives'
import {
  formatAdminDate,
  inDateRange,
  matchesIdMulti,
  matchesStringMulti,
  matchesTriBool,
  type TriBool,
  uniqSortedStrings,
} from '../shared/adminDataTable/adminFormatters'

const visitTypes = [
  'Initial Assessment',
  'Routine Follow-Up',
  'Reintegration Assessment',
  'Post-Placement Monitoring',
  'Emergency',
] as const

const coopLevels = ['Highly Cooperative', 'Cooperative', 'Neutral', 'Uncooperative', ''] as const

function emptyFilters() {
  return {
    dateFrom: '',
    dateTo: '',
    residentIds: new Set<number>(),
    socialWorker: '',
    socialWorkers: new Set<string>(),
    visitTypes: new Set<string>(),
    location: '',
    cooperation: new Set<string>(),
    safety: 'all' as TriBool,
    outcomes: new Set<string>(),
  }
}

export function HomeVisitationsAdminPage() {
  const navigate = useNavigate()
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [visits, setVisits] = useState<HomeVisitation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState(emptyFilters)
  const [resSearch, setResSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteModal, setDeleteModal] = useState<{ ids: number[]; labels: string[] } | null>(null)

  const [socialWorker, setSocialWorker] = useState('')
  const [visitType, setVisitType] = useState<string>('Routine Follow-Up')
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [locationVisited, setLocationVisited] = useState('')
  const [observations, setObservations] = useState('')
  const [coop, setCoop] = useState('')
  const [safety, setSafety] = useState(false)
  const [followUp, setFollowUp] = useState(false)
  const [followNotes, setFollowNotes] = useState('')
  const [resId, setResId] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getResidents({})
      setResidents(res)
      setResId((prev) => (prev && res.some((r) => r.id === prev) ? prev : res[0]?.id || 0))
      const v = await getHomeVisitations()
      setVisits(v)
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

  const residentOptions = useMemo(
    () => residents.map((r) => ({ id: r.id, label: `${r.internalCode} (#${r.id})` })),
    [residents],
  )

  const typeOpts = useMemo(() => uniqSortedStrings(visits.map((v) => v.visitType)), [visits])
  const coopOpts = useMemo(() => uniqSortedStrings(visits.map((v) => v.familyCooperationLevel)), [visits])
  const outOpts = useMemo(() => uniqSortedStrings(visits.map((v) => v.visitOutcome)), [visits])
  const swOpts = useMemo(() => uniqSortedStrings(visits.map((v) => v.socialWorker)), [visits])

  const filteredSorted = useMemo(() => {
    let list = visits.filter((v) => {
      const hay = `${v.residentInternalCode} ${v.visitType} ${v.socialWorker} ${v.locationVisited ?? ''} ${v.visitOutcome ?? ''}`.toLowerCase()
      if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false
      if (filters.dateFrom || filters.dateTo) {
        if (!inDateRange(v.visitDate, filters.dateFrom, filters.dateTo)) return false
      }
      if (!matchesIdMulti(v.residentId, filters.residentIds)) return false
      const swListOk = filters.socialWorkers.size === 0 || matchesStringMulti(v.socialWorker, filters.socialWorkers)
      const swTextOk =
        !filters.socialWorker.trim() ||
        v.socialWorker.toLowerCase().includes(filters.socialWorker.trim().toLowerCase())
      if (!swListOk || !swTextOk) return false
      if (!matchesStringMulti(v.visitType, filters.visitTypes)) return false
      if (
        filters.location.trim() &&
        !(v.locationVisited ?? '').toLowerCase().includes(filters.location.trim().toLowerCase())
      ) {
        return false
      }
      if (!matchesStringMulti(v.familyCooperationLevel ?? '', filters.cooperation)) return false
      if (!matchesTriBool(v.safetyConcernsNoted, filters.safety)) return false
      if (!matchesStringMulti(v.visitOutcome ?? '', filters.outcomes)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'visitDate':
          return row.visitDate
        case 'residentInternalCode':
          return row.residentInternalCode
        case 'socialWorker':
          return row.socialWorker
        case 'visitType':
          return row.visitType
        case 'locationVisited':
          return row.locationVisited ?? ''
        case 'familyCooperationLevel':
          return row.familyCooperationLevel ?? ''
        case 'visitOutcome':
          return row.visitOutcome ?? ''
        case 'safetyConcernsNoted':
          return row.safetyConcernsNoted ? 1 : 0
        default:
          return ''
      }
    })
    return list
  }, [visits, q, filters, sortKey, sortDir])

  const activeSummary = useMemo(() => {
    const p: string[] = []
    if (filters.dateFrom || filters.dateTo) p.push('Date')
    if (filters.residentIds.size) p.push(`Residents: ${filters.residentIds.size}`)
    if (filters.socialWorker.trim() || filters.socialWorkers.size) p.push('Worker')
    if (filters.visitTypes.size) p.push(`Type: ${filters.visitTypes.size}`)
    if (filters.location.trim()) p.push('Location')
    if (filters.cooperation.size) p.push('Cooperation')
    if (filters.safety !== 'all') p.push(`Safety: ${filters.safety}`)
    if (filters.outcomes.size) p.push(`Outcome: ${filters.outcomes.size}`)
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
    const ids = filteredSorted.map((v) => v.id)
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
      .filter((v) => selected.has(v.id))
      .map((v) => `${formatAdminDate(v.visitDate)} · ${v.residentInternalCode}`)
    setDeleteModal({ ids: [...selected], labels })
  }

  async function confirmDelete() {
    if (!deleteModal) return
    setSaving(true)
    setError(null)
    try {
      for (const id of deleteModal.ids) {
        await deleteHomeVisitation(id)
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!resId || !socialWorker.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createHomeVisitation({
        residentId: resId,
        visitDate: `${visitDate}T12:00:00`,
        socialWorker: socialWorker.trim(),
        visitType,
        locationVisited: locationVisited.trim() || undefined,
        observations: observations.trim() || undefined,
        familyCooperationLevel: coop || undefined,
        safetyConcernsNoted: safety,
        followUpNeeded: followUp,
        followUpNotes: followNotes.trim() || undefined,
      })
      setObservations('')
      setFollowNotes('')
      setShowNew(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function openAdd() {
    setShowNew(true)
    requestAnimationFrame(() => document.getElementById('admin-add-visitation')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const colCount = 9

  return (
    <div className="space-y-6">
      <div>
        <h2 className={pageTitle}>Home visitation</h2>
        <p className={pageDesc}>
          Field visit log — open a row for the resident profile. Confirm before deleting.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <AdminListToolbar
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search visits…"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        onAddClick={openAdd}
        addLabel="Add visitation"
      />

      <AdminBulkActionsBar
        count={selected.size}
        recordLabel="visitation"
        onDeleteClick={openDeleteModal}
        onClearSelection={() => setSelected(new Set())}
        disabled={saving}
      />

      {filterOpen && (
        <FilterPanelCard onClearAll={() => setFilters(emptyFilters())} activeSummary={activeSummary}>
          <DateRangeFilter
            labelText="Visit date"
            from={filters.dateFrom}
            to={filters.dateTo}
            onFrom={(v) => setFilters((f) => ({ ...f, dateFrom: v }))}
            onTo={(v) => setFilters((f) => ({ ...f, dateTo: v }))}
          />
          <SearchableEntityMultiFilter
            labelText="Resident"
            options={residentOptions}
            selectedIds={filters.residentIds}
            onChange={(s) => setFilters((f) => ({ ...f, residentIds: s }))}
            search={resSearch}
            onSearchChange={setResSearch}
          />
          <TextSearchFilter
            labelText="Social worker (text)"
            value={filters.socialWorker}
            onChange={(v) => setFilters((f) => ({ ...f, socialWorker: v }))}
          />
          <MultiSelectFilter
            labelText="Social worker (list)"
            options={swOpts.length ? swOpts : ['—']}
            selected={filters.socialWorkers}
            onChange={(s) => setFilters((f) => ({ ...f, socialWorkers: s }))}
          />
          <MultiSelectFilter
            labelText="Visit type"
            options={typeOpts.length ? typeOpts : [...visitTypes]}
            selected={filters.visitTypes}
            onChange={(s) => setFilters((f) => ({ ...f, visitTypes: s }))}
          />
          <TextSearchFilter
            labelText="Location visited"
            value={filters.location}
            onChange={(v) => setFilters((f) => ({ ...f, location: v }))}
          />
          <MultiSelectFilter
            labelText="Family cooperation"
            options={coopOpts.length ? coopOpts : coopLevels.filter(Boolean) as string[]}
            selected={filters.cooperation}
            onChange={(s) => setFilters((f) => ({ ...f, cooperation: s }))}
          />
          <TriBoolFilter
            labelText="Safety concerns noted"
            value={filters.safety}
            onChange={(v) => setFilters((f) => ({ ...f, safety: v }))}
          />
          <MultiSelectFilter
            labelText="Visit outcome"
            options={outOpts.length ? outOpts : ['—']}
            selected={filters.outcomes}
            onChange={(s) => setFilters((f) => ({ ...f, outcomes: s }))}
          />
        </FilterPanelCard>
      )}

      {showNew && (
        <form id="admin-add-visitation" onSubmit={onSubmit} className={`${cardForm} scroll-mt-28`}>
          <div className="flex items-center justify-between">
            <p className={sectionFormTitle}>Log visitation</p>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowNew(false)}>
              Close
            </button>
          </div>
          <label className={label}>
            Resident
            <select className={input} value={resId || ''} onChange={(e) => setResId(Number(e.target.value))} required>
              {residents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.internalCode}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Visit date
            <input type="date" className={input} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
          </label>
          <label className={label}>
            Social worker
            <input className={input} value={socialWorker} onChange={(e) => setSocialWorker(e.target.value)} required />
          </label>
          <label className={label}>
            Visit type
            <select className={input} value={visitType} onChange={(e) => setVisitType(e.target.value)}>
              {visitTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Location visited
            <input className={input} value={locationVisited} onChange={(e) => setLocationVisited(e.target.value)} />
          </label>
          <label className={label}>
            Observations (home environment)
            <textarea className={input} rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} />
          </label>
          <label className={label}>
            Family cooperation
            <select className={input} value={coop} onChange={(e) => setCoop(e.target.value)}>
              <option value="">—</option>
              {coopLevels.filter(Boolean).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={safety} onChange={(e) => setSafety(e.target.checked)} />
            Safety concerns noted
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />
            Follow-up needed
          </label>
          <label className={label}>
            Follow-up notes
            <input className={input} value={followNotes} onChange={(e) => setFollowNotes(e.target.value)} />
          </label>
          <button type="submit" disabled={saving || !resId} className={btnPrimary}>
            {saving ? 'Saving…' : 'Save visitation'}
          </button>
        </form>
      )}

      <div className={tableWrap}>
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="w-10 px-2 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={filteredSorted.length > 0 && filteredSorted.every((v) => selected.has(v.id))}
                  onChange={toggleSelectAll}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <SortableTh label="Visit date" sortKey="visitDate" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Resident" sortKey="residentInternalCode" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Social worker" sortKey="socialWorker" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Type" sortKey="visitType" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Location" sortKey="locationVisited" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Cooperation" sortKey="familyCooperationLevel" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh
                label="Safety concerns"
                sortKey="safetyConcernsNoted"
                activeKey={sortKey}
                direction={sortDir}
                onSort={onSort}
              />
              <SortableTh label="Outcome" sortKey="visitOutcome" activeKey={sortKey} direction={sortDir} onSort={onSort} />
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
                  No visitations match.
                </td>
              </tr>
            ) : (
              filteredSorted.map((v) => (
                <tr
                  key={v.id}
                  className={`${tableRowHover} cursor-pointer`}
                  onClick={() => navigate(`/admin/residents/${v.residentId}`)}
                >
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggleSelect(v.id)} aria-label={`Select ${v.id}`} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{formatAdminDate(v.visitDate)}</td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{v.residentInternalCode}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{v.socialWorker}</td>
                  <td className="px-3 py-2.5">
                    <CategoryBadge>{v.visitType}</CategoryBadge>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{v.locationVisited ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    {v.familyCooperationLevel ? <CategoryBadge>{v.familyCooperationLevel}</CategoryBadge> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <BooleanBadge value={v.safetyConcernsNoted} trueVariant="danger" />
                  </td>
                  <td className="max-w-[200px] px-3 py-2.5">
                    {v.visitOutcome ? <VisitOutcomeBadge outcome={v.visitOutcome} /> : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminDeleteModal
        open={deleteModal != null}
        title={deleteModal && deleteModal.ids.length === 1 ? 'Delete visitation?' : 'Delete visitations?'}
        body={
          deleteModal
            ? deleteModal.ids.length === 1
              ? 'You are about to delete one home visitation record.'
              : `You are about to delete ${deleteModal.ids.length} home visitation records.`
            : ''
        }
        previewLines={deleteModal && deleteModal.labels.length > 1 ? deleteModal.labels : deleteModal?.labels.slice(0, 1)}
        loading={saving}
        onCancel={() => setDeleteModal(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
