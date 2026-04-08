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
  createProcessRecording,
  deleteProcessRecording,
  getProcessRecordings,
  getResidents,
  type ProcessRecording,
  type ResidentSummary,
} from '../../../api/admin'
import { AdminListToolbar } from '../shared/AdminListToolbar'
import { nextSortState, sortRows, SortableTh, type SortDirection } from '../shared/SortableTh'
import { AdminBulkActionsBar } from '../shared/adminDataTable/AdminBulkActionsBar'
import { AdminDeleteModal } from '../shared/adminDataTable/AdminDeleteModal'
import { BooleanBadge, CategoryBadge } from '../shared/adminDataTable/AdminBadges'
import {
  FilterPanelCard,
  DateRangeFilter,
  MinMaxFilter,
  MultiSelectFilter,
  SearchableEntityMultiFilter,
  TextSearchFilter,
  TriBoolFilter,
} from '../shared/adminDataTable/AdminFilterPrimitives'
import {
  formatAdminDate,
  inAmountRange,
  inDateRange,
  matchesIdMulti,
  matchesStringMulti,
  matchesTriBool,
  type TriBool,
  uniqSortedStrings,
} from '../shared/adminDataTable/adminFormatters'

const sessionTypes = ['Individual', 'Group'] as const

function emptyFilters() {
  return {
    dateFrom: '',
    dateTo: '',
    residentIds: new Set<number>(),
    socialWorker: '',
    socialWorkers: new Set<string>(),
    sessionTypes: new Set<string>(),
    durationMin: '',
    durationMax: '',
    emotionalStates: new Set<string>(),
    progress: 'all' as TriBool,
    concerns: 'all' as TriBool,
  }
}

export function ProcessRecordingsPage() {
  const navigate = useNavigate()
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [rows, setRows] = useState<ProcessRecording[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState(emptyFilters)
  const [resSearch, setResSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteModal, setDeleteModal] = useState<{ ids: number[]; labels: string[] } | null>(null)
  const [formResidentId, setFormResidentId] = useState<number>(0)
  const [saving, setSaving] = useState(false)

  const [socialWorker, setSocialWorker] = useState('')
  const [sessionType, setSessionType] = useState<string>('Individual')
  const [duration, setDuration] = useState('')
  const [emoStart, setEmoStart] = useState('')
  const [emoEnd, setEmoEnd] = useState('')
  const [narrative, setNarrative] = useState('')
  const [interventions, setInterventions] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10))

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [r, rec] = await Promise.all([getResidents({}), getProcessRecordings()])
      setResidents(r)
      setRows(rec)
      setFormResidentId((prev) => prev || r[0]?.id || 0)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    if (!showNew || residents.length === 0) return
    setFormResidentId((prev) => (prev && residents.some((r) => r.id === prev) ? prev : residents[0]?.id ?? 0))
  }, [showNew, residents])

  const residentOptions = useMemo(
    () => residents.map((r) => ({ id: r.id, label: `${r.internalCode} (#${r.id})` })),
    [residents],
  )

  const emoOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.emotionalStateObserved)), [rows])
  const swOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.socialWorker)), [rows])
  const typeOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.sessionType)), [rows])

  const filteredSorted = useMemo(() => {
    let list = rows.filter((r) => {
      const hay = `${r.residentInternalCode} ${r.sessionType} ${r.socialWorker} ${r.sessionNarrative}`.toLowerCase()
      if (search.trim() && !hay.includes(search.trim().toLowerCase())) return false
      if (filters.dateFrom || filters.dateTo) {
        if (!inDateRange(r.sessionDate, filters.dateFrom, filters.dateTo)) return false
      }
      if (!matchesIdMulti(r.residentId, filters.residentIds)) return false
      const swListOk = filters.socialWorkers.size === 0 || matchesStringMulti(r.socialWorker, filters.socialWorkers)
      const swTextOk =
        !filters.socialWorker.trim() ||
        r.socialWorker.toLowerCase().includes(filters.socialWorker.trim().toLowerCase())
      if (!swListOk || !swTextOk) return false
      if (!matchesStringMulti(r.sessionType, filters.sessionTypes)) return false
      if (!inAmountRange(r.sessionDurationMinutes, filters.durationMin, filters.durationMax)) return false
      if (!matchesStringMulti(r.emotionalStateObserved ?? '', filters.emotionalStates)) return false
      if (!matchesTriBool(r.progressNoted, filters.progress)) return false
      if (!matchesTriBool(r.concernsFlagged, filters.concerns)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'sessionDate':
          return row.sessionDate
        case 'residentInternalCode':
          return row.residentInternalCode
        case 'socialWorker':
          return row.socialWorker
        case 'sessionType':
          return row.sessionType
        case 'sessionDurationMinutes':
          return row.sessionDurationMinutes ?? 0
        case 'emotionalStateObserved':
          return row.emotionalStateObserved ?? ''
        case 'progressNoted':
          return row.progressNoted ? 1 : 0
        case 'concernsFlagged':
          return row.concernsFlagged ? 1 : 0
        default:
          return ''
      }
    })
    return list
  }, [rows, search, filters, sortKey, sortDir])

  const activeSummary = useMemo(() => {
    const p: string[] = []
    if (filters.dateFrom || filters.dateTo) p.push('Date')
    if (filters.residentIds.size) p.push(`Residents: ${filters.residentIds.size}`)
    if (filters.socialWorker.trim() || filters.socialWorkers.size) p.push('Social worker')
    if (filters.sessionTypes.size) p.push(`Type: ${filters.sessionTypes.size}`)
    if (filters.durationMin || filters.durationMax) p.push('Duration')
    if (filters.emotionalStates.size) p.push('Emotion')
    if (filters.progress !== 'all') p.push(`Progress: ${filters.progress}`)
    if (filters.concerns !== 'all') p.push(`Concerns: ${filters.concerns}`)
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
    const labels = filteredSorted
      .filter((r) => selected.has(r.id))
      .map((r) => `${formatAdminDate(r.sessionDate)} · ${r.residentInternalCode}`)
    setDeleteModal({ ids: [...selected], labels })
  }

  async function confirmDelete() {
    if (!deleteModal) return
    setSaving(true)
    setError(null)
    try {
      for (const id of deleteModal.ids) {
        await deleteProcessRecording(id)
      }
      setSelected(new Set())
      setDeleteModal(null)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formResidentId || !socialWorker.trim() || !narrative.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createProcessRecording({
        residentId: formResidentId,
        sessionDate: `${sessionDate}T12:00:00`,
        socialWorker: socialWorker.trim(),
        sessionType,
        sessionDurationMinutes: duration ? Number(duration) : undefined,
        emotionalStateObserved: emoStart.trim() || undefined,
        emotionalStateEnd: emoEnd.trim() || undefined,
        sessionNarrative: narrative.trim(),
        interventionsApplied: interventions.trim() || undefined,
        followUpActions: followUp.trim() || undefined,
      })
      setNarrative('')
      setInterventions('')
      setFollowUp('')
      setShowNew(false)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function openAdd() {
    setShowNew(true)
    requestAnimationFrame(() => document.getElementById('admin-add-process')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const colCount = 9

  return (
    <div className="space-y-6">
      <div>
        <h2 className={pageTitle}>Counseling sessions</h2>
        <p className={pageDesc}>
          Counseling session log — open a row for the resident case file. Filters support ranges and multi-select.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <AdminListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search narrative, worker, resident…"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        onAddClick={openAdd}
        addLabel="Add session"
      />

      <AdminBulkActionsBar
        count={selected.size}
        recordLabel="session"
        onDeleteClick={openDeleteModal}
        onClearSelection={() => setSelected(new Set())}
        disabled={saving}
      />

      {filterOpen && (
        <FilterPanelCard onClearAll={() => setFilters(emptyFilters())} activeSummary={activeSummary}>
          <DateRangeFilter
            labelText="Session date"
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
            labelText="Social worker (pick from list)"
            options={swOpts.length ? swOpts : ['—']}
            selected={filters.socialWorkers}
            onChange={(s) => setFilters((f) => ({ ...f, socialWorkers: s }))}
          />
          <MultiSelectFilter
            labelText="Session type"
            options={typeOpts.length ? typeOpts : [...sessionTypes]}
            selected={filters.sessionTypes}
            onChange={(s) => setFilters((f) => ({ ...f, sessionTypes: s }))}
          />
          <MinMaxFilter
            labelText="Duration (minutes)"
            min={filters.durationMin}
            max={filters.durationMax}
            onMin={(v) => setFilters((f) => ({ ...f, durationMin: v }))}
            onMax={(v) => setFilters((f) => ({ ...f, durationMax: v }))}
          />
          <MultiSelectFilter
            labelText="Emotional state"
            options={emoOpts.length ? emoOpts : ['—']}
            selected={filters.emotionalStates}
            onChange={(s) => setFilters((f) => ({ ...f, emotionalStates: s }))}
          />
          <TriBoolFilter labelText="Progress noted" value={filters.progress} onChange={(v) => setFilters((f) => ({ ...f, progress: v }))} />
          <TriBoolFilter labelText="Concerns flagged" value={filters.concerns} onChange={(v) => setFilters((f) => ({ ...f, concerns: v }))} />
        </FilterPanelCard>
      )}

      {showNew && (
        <form id="admin-add-process" onSubmit={onSubmit} className={`${cardForm} scroll-mt-28`}>
          <div className="flex items-center justify-between">
            <p className={sectionFormTitle}>New counseling session</p>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowNew(false)}>
              Close
            </button>
          </div>
          <label className={label}>
            Resident
            <select
              className={input}
              value={formResidentId || ''}
              onChange={(e) => setFormResidentId(Number(e.target.value))}
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
            Session date
            <input type="date" className={input} value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
          </label>
          <label className={label}>
            Social worker (ID or name)
            <input className={input} value={socialWorker} onChange={(e) => setSocialWorker(e.target.value)} required />
          </label>
          <label className={label}>
            Session type
            <select className={input} value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
              {sessionTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Duration (minutes)
            <input type="number" min={0} className={input} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
          <label className={label}>
            Emotional state (start)
            <input className={input} value={emoStart} onChange={(e) => setEmoStart(e.target.value)} placeholder="e.g. Anxious" />
          </label>
          <label className={label}>
            Emotional state (end)
            <input className={input} value={emoEnd} onChange={(e) => setEmoEnd(e.target.value)} placeholder="e.g. Hopeful" />
          </label>
          <label className={label}>
            Interventions applied
            <input className={input} value={interventions} onChange={(e) => setInterventions(e.target.value)} />
          </label>
          <label className={label}>
            Follow-up actions
            <input className={input} value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
          </label>
          <label className={label}>
            Narrative summary
            <textarea className={input} rows={4} value={narrative} onChange={(e) => setNarrative(e.target.value)} required />
          </label>
          <button type="submit" disabled={saving || residents.length === 0} className={btnPrimary}>
            {saving ? 'Saving…' : 'Save session'}
          </button>
        </form>
      )}

      <div className={tableWrap}>
        <table className="w-full min-w-[720px] text-left text-sm">
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
              <SortableTh label="Session date" sortKey="sessionDate" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Resident" sortKey="residentInternalCode" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Social worker" sortKey="socialWorker" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Type" sortKey="sessionType" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Minutes" sortKey="sessionDurationMinutes" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Emotion" sortKey="emotionalStateObserved" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Progress" sortKey="progressNoted" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Concerns" sortKey="concernsFlagged" activeKey={sortKey} direction={sortDir} onSort={onSort} />
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
                  No sessions for this view.
                </td>
              </tr>
            ) : (
              filteredSorted.map((r) => (
                <tr
                  key={r.id}
                  className={`${tableRowHover} cursor-pointer`}
                  onClick={() => navigate(`/admin/residents/${r.residentId}`)}
                >
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Select ${r.id}`} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{formatAdminDate(r.sessionDate)}</td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{r.residentInternalCode}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.socialWorker}</td>
                  <td className="px-3 py-2.5">
                    <CategoryBadge>{r.sessionType}</CategoryBadge>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                    {r.sessionDurationMinutes != null ? `${r.sessionDurationMinutes} min` : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.emotionalStateObserved ? <CategoryBadge>{r.emotionalStateObserved}</CategoryBadge> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <BooleanBadge value={r.progressNoted} />
                  </td>
                  <td className="px-3 py-2.5">
                    <BooleanBadge value={r.concernsFlagged} trueVariant="danger" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminDeleteModal
        open={deleteModal != null}
        title={deleteModal && deleteModal.ids.length === 1 ? 'Delete session?' : 'Delete sessions?'}
        body={
          deleteModal
            ? deleteModal.ids.length === 1
              ? 'You are about to delete one counseling session.'
              : `You are about to delete ${deleteModal.ids.length} counseling sessions.`
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
