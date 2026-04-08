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
  createHomeVisitation,
  deleteHomeVisitation,
  getHomeVisitations,
  getResidents,
  type HomeVisitation,
  type ResidentSummary,
} from '../../api/admin'
import { useSupabaseForLighthouseData } from '../../lib/useSupabaseLighthouse'
import { AdminListToolbar } from './AdminListToolbar'
import { matchesColFilter, nextSortState, sortRows, SortableTh, type SortDirection } from './SortableTh'

const visitTypes = [
  'Initial Assessment',
  'Routine Follow-Up',
  'Reintegration Assessment',
  'Post-Placement Monitoring',
  'Emergency',
] as const

const coopLevels = ['Highly Cooperative', 'Cooperative', 'Neutral', 'Uncooperative', ''] as const

type ColFilters = {
  id: string
  residentId: string
  residentInternalCode: string
  visitDate: string
  socialWorker: string
  visitType: string
  locationVisited: string
  familyMembersPresent: string
  purpose: string
  observations: string
  familyCooperationLevel: string
  safetyConcernsNoted: string
  followUpNeeded: string
  followUpNotes: string
  visitOutcome: string
}

const emptyFilters = (): ColFilters => ({
  id: '',
  residentId: '',
  residentInternalCode: '',
  visitDate: '',
  socialWorker: '',
  visitType: '',
  locationVisited: '',
  familyMembersPresent: '',
  purpose: '',
  observations: '',
  familyCooperationLevel: '',
  safetyConcernsNoted: '',
  followUpNeeded: '',
  followUpNotes: '',
  visitOutcome: '',
})

const FILTER_LABELS: Record<keyof ColFilters, string> = {
  id: 'Visit ID',
  residentId: 'Resident ID',
  residentInternalCode: 'Resident code',
  visitDate: 'Visit date',
  socialWorker: 'Social worker',
  visitType: 'Visit type',
  locationVisited: 'Location',
  familyMembersPresent: 'Family present',
  purpose: 'Purpose',
  observations: 'Observations',
  familyCooperationLevel: 'Cooperation',
  safetyConcernsNoted: 'Safety concern (yes/no)',
  followUpNeeded: 'Follow-up needed (yes/no)',
  followUpNotes: 'Follow-up notes',
  visitOutcome: 'Outcome',
}

export function HomeVisitationsAdminPage() {
  const sbData = useSupabaseForLighthouseData()
  const navigate = useNavigate()
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [q, setQ] = useState('')
  const [visits, setVisits] = useState<HomeVisitation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [colFilters, setColFilters] = useState<ColFilters>(emptyFilters)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

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

  const filteredSorted = useMemo(() => {
    let list = visits.filter((v) => {
      const hay = `${v.residentInternalCode} ${v.visitType} ${v.socialWorker} ${v.locationVisited ?? ''} ${v.observations ?? ''} ${v.visitOutcome ?? ''} ${v.id}`.toLowerCase()
      if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false
      if (!matchesColFilter(v.id, colFilters.id)) return false
      if (!matchesColFilter(v.residentId, colFilters.residentId)) return false
      if (!matchesColFilter(v.residentInternalCode, colFilters.residentInternalCode)) return false
      if (!matchesColFilter(v.visitDate, colFilters.visitDate)) return false
      if (!matchesColFilter(v.socialWorker, colFilters.socialWorker)) return false
      if (!matchesColFilter(v.visitType, colFilters.visitType)) return false
      if (!matchesColFilter(v.locationVisited, colFilters.locationVisited)) return false
      if (!matchesColFilter(v.familyMembersPresent, colFilters.familyMembersPresent)) return false
      if (!matchesColFilter(v.purpose, colFilters.purpose)) return false
      if (!matchesColFilter(v.observations, colFilters.observations)) return false
      if (!matchesColFilter(v.familyCooperationLevel, colFilters.familyCooperationLevel)) return false
      if (!matchesColFilter(v.safetyConcernsNoted, colFilters.safetyConcernsNoted)) return false
      if (!matchesColFilter(v.followUpNeeded, colFilters.followUpNeeded)) return false
      if (!matchesColFilter(v.followUpNotes, colFilters.followUpNotes)) return false
      if (!matchesColFilter(v.visitOutcome, colFilters.visitOutcome)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'id':
          return row.id
        case 'visitDate':
          return row.visitDate
        case 'residentInternalCode':
          return row.residentInternalCode
        case 'visitType':
          return row.visitType
        case 'socialWorker':
          return row.socialWorker
        case 'locationVisited':
          return row.locationVisited ?? ''
        case 'visitOutcome':
          return row.visitOutcome ?? ''
        default:
          return ''
      }
    })
    return list
  }, [visits, q, colFilters, sortKey, sortDir])

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

  async function bulkDelete() {
    if (!sbData || selected.size === 0) return
    if (!confirm(`Delete ${selected.size} visitation record(s)? This cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      for (const id of selected) {
        await deleteHomeVisitation(id)
      }
      setSelected(new Set())
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

  const colCount = sbData ? 8 : 7

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Home visitation</h2>
        <p className={pageDesc}>
          Filter by any column; sort from headers. Click a row to open the resident profile. Bulk delete requires
          Supabase.
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
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className={tableHead}>
            <tr>
              {sbData && (
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={filteredSorted.length > 0 && filteredSorted.every((v) => selected.has(v.id))}
                    onChange={() => toggleSelectAll()}
                  />
                </th>
              )}
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Date" sortKey="visitDate" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Resident" sortKey="residentInternalCode" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Type" sortKey="visitType" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="SW" sortKey="socialWorker" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Location" sortKey="locationVisited" activeKey={sortKey} direction={sortDir} onSort={onSort} />
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
                  {sbData && (
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggleSelect(v.id)} aria-label={`Select ${v.id}`} />
                    </td>
                  )}
                  <td className="px-4 py-3 text-muted-foreground">{v.id}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(v.visitDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium text-primary">{v.residentInternalCode}</td>
                  <td className="px-4 py-3">{v.visitType}</td>
                  <td className="px-4 py-3">{v.socialWorker}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.locationVisited ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.visitOutcome ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
