import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  alertError,
  btnPrimary,
  card,
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
} from './adminStyles'
import {
  createProcessRecording,
  deleteProcessRecording,
  getProcessRecordings,
  getResidents,
  type ProcessRecording,
  type ResidentSummary,
} from '../../api/admin'
import { useSupabaseForLighthouseData } from '../../lib/useSupabaseLighthouse'
import { AdminListToolbar } from './AdminListToolbar'
import { matchesColFilter, nextSortState, sortRows, SortableTh, type SortDirection } from './SortableTh'

const sessionTypes = ['Individual', 'Group'] as const

type ColFilters = {
  id: string
  residentId: string
  residentInternalCode: string
  sessionDate: string
  socialWorker: string
  sessionType: string
  sessionDurationMinutes: string
  emotionalStateObserved: string
  emotionalStateEnd: string
  sessionNarrative: string
  interventionsApplied: string
  followUpActions: string
  progressNoted: string
  concernsFlagged: string
  referralMade: string
}

const emptyFilters = (): ColFilters => ({
  id: '',
  residentId: '',
  residentInternalCode: '',
  sessionDate: '',
  socialWorker: '',
  sessionType: '',
  sessionDurationMinutes: '',
  emotionalStateObserved: '',
  emotionalStateEnd: '',
  sessionNarrative: '',
  interventionsApplied: '',
  followUpActions: '',
  progressNoted: '',
  concernsFlagged: '',
  referralMade: '',
})

const FILTER_LABELS: Record<keyof ColFilters, string> = {
  id: 'Recording ID',
  residentId: 'Resident ID',
  residentInternalCode: 'Resident code',
  sessionDate: 'Session date',
  socialWorker: 'Social worker',
  sessionType: 'Session type',
  sessionDurationMinutes: 'Duration (min)',
  emotionalStateObserved: 'Emotion (start)',
  emotionalStateEnd: 'Emotion (end)',
  sessionNarrative: 'Narrative',
  interventionsApplied: 'Interventions',
  followUpActions: 'Follow-up',
  progressNoted: 'Progress noted (yes/no)',
  concernsFlagged: 'Concerns (yes/no)',
  referralMade: 'Referral (yes/no)',
}

export function ProcessRecordingsPage() {
  const sbData = useSupabaseForLighthouseData()
  const navigate = useNavigate()
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [rows, setRows] = useState<ProcessRecording[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [colFilters, setColFilters] = useState<ColFilters>(emptyFilters)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
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

  const filteredSorted = useMemo(() => {
    let list = rows.filter((r) => {
      const hay = `${r.residentInternalCode} ${r.sessionType} ${r.socialWorker} ${r.sessionNarrative} ${r.interventionsApplied ?? ''} ${r.followUpActions ?? ''} ${r.id}`.toLowerCase()
      if (search.trim() && !hay.includes(search.trim().toLowerCase())) return false
      if (!matchesColFilter(r.id, colFilters.id)) return false
      if (!matchesColFilter(r.residentId, colFilters.residentId)) return false
      if (!matchesColFilter(r.residentInternalCode, colFilters.residentInternalCode)) return false
      if (!matchesColFilter(r.sessionDate, colFilters.sessionDate)) return false
      if (!matchesColFilter(r.socialWorker, colFilters.socialWorker)) return false
      if (!matchesColFilter(r.sessionType, colFilters.sessionType)) return false
      if (!matchesColFilter(r.sessionDurationMinutes, colFilters.sessionDurationMinutes)) return false
      if (!matchesColFilter(r.emotionalStateObserved, colFilters.emotionalStateObserved)) return false
      if (!matchesColFilter(r.emotionalStateEnd, colFilters.emotionalStateEnd)) return false
      if (!matchesColFilter(r.sessionNarrative, colFilters.sessionNarrative)) return false
      if (!matchesColFilter(r.interventionsApplied, colFilters.interventionsApplied)) return false
      if (!matchesColFilter(r.followUpActions, colFilters.followUpActions)) return false
      if (!matchesColFilter(r.progressNoted, colFilters.progressNoted)) return false
      if (!matchesColFilter(r.concernsFlagged, colFilters.concernsFlagged)) return false
      if (!matchesColFilter(r.referralMade, colFilters.referralMade)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'id':
          return row.id
        case 'residentInternalCode':
          return row.residentInternalCode
        case 'sessionDate':
          return row.sessionDate
        case 'socialWorker':
          return row.socialWorker
        case 'sessionType':
          return row.sessionType
        case 'sessionDurationMinutes':
          return row.sessionDurationMinutes ?? 0
        default:
          return ''
      }
    })
    return list
  }, [rows, search, colFilters, sortKey, sortDir])

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
    if (!confirm(`Delete ${selected.size} recording(s)? This cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      for (const id of selected) {
        await deleteProcessRecording(id)
      }
      setSelected(new Set())
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

  const colCount = sbData ? 8 : 7

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Process recording</h2>
        <p className={pageDesc}>
          Filter by any column; sort from headers. Click a row to open the resident profile. Bulk delete requires
          Supabase.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <AdminListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search narrative, worker, type…"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        onAddClick={openAdd}
        addLabel="Add recording"
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

      {showNew && (
        <form id="admin-add-process" onSubmit={onSubmit} className={`${cardForm} scroll-mt-28`}>
          <div className="flex items-center justify-between">
            <p className={sectionFormTitle}>New process recording</p>
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
            {saving ? 'Saving…' : 'Save recording'}
          </button>
        </form>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Session history</h3>
        <div className={tableWrap}>
          <table className="w-full min-w-[640px] text-left text-sm">
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
                <SortableTh label="Resident" sortKey="residentInternalCode" activeKey={sortKey} direction={sortDir} onSort={onSort} />
                <SortableTh label="Date" sortKey="sessionDate" activeKey={sortKey} direction={sortDir} onSort={onSort} />
                <SortableTh label="Type" sortKey="sessionType" activeKey={sortKey} direction={sortDir} onSort={onSort} />
                <SortableTh label="Worker" sortKey="socialWorker" activeKey={sortKey} direction={sortDir} onSort={onSort} />
                <SortableTh label="Min" sortKey="sessionDurationMinutes" activeKey={sortKey} direction={sortDir} onSort={onSort} />
                <th className="px-3 py-2">Narrative</th>
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
                    No recordings for this view.
                  </td>
                </tr>
              ) : (
                filteredSorted.map((r) => (
                  <tr
                    key={r.id}
                    className={`${tableRowHover} cursor-pointer`}
                    onClick={() => navigate(`/admin/residents/${r.residentId}`)}
                  >
                    {sbData && (
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Select ${r.id}`} />
                      </td>
                    )}
                    <td className="px-3 py-2 text-muted-foreground">{r.id}</td>
                    <td className="px-3 py-2 font-medium text-primary">{r.residentInternalCode}</td>
                    <td className="px-3 py-2 text-xs">{new Date(r.sessionDate).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{r.sessionType}</td>
                    <td className="px-3 py-2 text-xs">{r.socialWorker}</td>
                    <td className="px-3 py-2 text-xs">{r.sessionDurationMinutes ?? '—'}</td>
                    <td className="max-w-[240px] truncate px-3 py-2 text-xs text-muted-foreground" title={r.sessionNarrative}>
                      {r.sessionNarrative}
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
