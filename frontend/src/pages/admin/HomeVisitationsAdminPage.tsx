import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  alertError,
  btnPrimary,
  card,
  cardForm,
  input,
  label,
  pageDesc,
  pageTitle,
  sectionFormTitle,
  emptyCell,
  tableBody,
  tableHead,
  tableRowHover,
  tableWrap,
} from './adminStyles'
import { createHomeVisitation, getHomeVisitations, getResidents, type HomeVisitation, type ResidentSummary } from '../../api/admin'

const visitTypes = [
  'Initial Assessment',
  'Routine Follow-Up',
  'Reintegration Assessment',
  'Post-Placement Monitoring',
  'Emergency',
] as const

const coopLevels = ['Highly Cooperative', 'Cooperative', 'Neutral', 'Uncooperative', ''] as const

export function HomeVisitationsAdminPage() {
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [filterRes, setFilterRes] = useState<number>(0)
  const [q, setQ] = useState('')
  const [visits, setVisits] = useState<HomeVisitation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showNew, setShowNew] = useState(false)

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
      const rid = filterRes || undefined
      const v = await getHomeVisitations(rid)
      setVisits(v)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [filterRes])

  useEffect(() => {
    void load()
  }, [load])

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

  const needle = q.trim().toLowerCase()
  const filtered = visits.filter((v) => {
    if (needle) {
      const hay = `${v.residentInternalCode} ${v.visitType} ${v.socialWorker} ${v.locationVisited ?? ''} ${v.observations ?? ''} ${v.visitOutcome ?? ''}`.toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Home visitation</h2>
        <p className={pageDesc}>
          Log home and field visits: type, environment observations, family cooperation, safety concerns, and follow-up.
          Filter by resident or search the list; open a resident profile from the table.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <div className={`${card} flex flex-wrap items-end gap-3`}>
        <label className={label}>
          Filter by resident
          <select
            className={`${input} min-w-[12rem]`}
            value={filterRes || ''}
            onChange={(e) => setFilterRes(Number(e.target.value))}
          >
            <option value={0}>All residents</option>
            {residents.map((r) => (
              <option key={r.id} value={r.id}>
                {r.internalCode}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Search
          <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type, worker, notes…" />
        </label>
      </div>

      <div>
        <button type="button" className={btnPrimary} onClick={() => setShowNew((s) => !s)}>
          {showNew ? 'Close form' : 'New home visitation'}
        </button>
      </div>

      {showNew && (
        <form onSubmit={onSubmit} className={cardForm}>
          <p className={sectionFormTitle}>Log visitation</p>
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
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Resident</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">SW</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Cooperation</th>
              <th className="px-4 py-3">Outcome</th>
            </tr>
          </thead>
          <tbody className={tableBody}>
            {loading ? (
              <tr>
                <td colSpan={7} className={emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className={emptyCell}>
                  No visitations match.
                </td>
              </tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.id} className={tableRowHover}>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(v.visitDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link className="text-primary hover:underline" to={`/admin/residents/${v.residentId}`}>
                      {v.residentInternalCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{v.visitType}</td>
                  <td className="px-4 py-3">{v.socialWorker}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.locationVisited ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.familyCooperationLevel ?? '—'}</td>
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
