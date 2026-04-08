import { useCallback, useEffect, useState, type FormEvent } from 'react'
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
} from '../shared/adminStyles'
import {
  createHomeVisitation,
  getHomeVisitations,
  getInterventionPlans,
  getResidents,
  type HomeVisitation,
  type InterventionPlan,
  type ResidentSummary,
} from '../../../api/admin'

const visitTypes = [
  'Initial Assessment',
  'Routine Follow-Up',
  'Reintegration Assessment',
  'Post-Placement Monitoring',
  'Emergency',
] as const

const coopLevels = ['Highly Cooperative', 'Cooperative', 'Neutral', 'Uncooperative', ''] as const

export function VisitationsPage() {
  const [tab, setTab] = useState<'visits' | 'conferences'>('visits')
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [filterRes, setFilterRes] = useState<number>(0)
  const [visits, setVisits] = useState<HomeVisitation[]>([])
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
      setResId((prev) => prev || res[0]?.id || 0)
      const rid = filterRes || undefined
      const [v, p] = await Promise.all([getHomeVisitations(rid), getInterventionPlans(rid)])
      setVisits(v)
      setPlans(p)
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
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const upcomingPlans = [...plans]
    .filter((p) => p.caseConferenceDate)
    .sort((a, b) => (a.caseConferenceDate ?? '').localeCompare(b.caseConferenceDate ?? ''))
    .slice(0, 40)

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Home visitation & case conferences</h2>
        <p className={pageDesc}>
          Log home and field visits with type (initial assessment, routine follow-up, reintegration assessment,
          post-placement monitoring, emergency), environment observations, family cooperation, safety concerns, and
          follow-up. Review intervention plans and case conference dates for each resident.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'visits' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          onClick={() => setTab('visits')}
        >
          Home & field visits
        </button>
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'conferences'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          onClick={() => setTab('conferences')}
        >
          Case conferences & plans
        </button>
      </div>

      <div className={`${card} flex flex-wrap items-end gap-3`}>
        <label className={label}>
          Filter list by resident
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
      </div>

      {tab === 'visits' && (
        <>
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
                ) : (
                  visits.map((v) => (
                    <tr key={v.id} className={tableRowHover}>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(v.visitDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-medium">{v.residentInternalCode}</td>
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
        </>
      )}

      {tab === 'conferences' && (
        <div className="space-y-6">
          <div className={card}>
            <h3 className="text-sm font-semibold text-foreground">Upcoming / recent case conferences</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Pulled from intervention plans with a scheduled conference date (dataset snapshot).
            </p>
            <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto text-sm">
              {upcomingPlans.length === 0 ? (
                <li className="text-muted-foreground">No plans with conference dates in current filter.</li>
              ) : (
                upcomingPlans.map((p) => (
                  <li key={p.id} className="border-b border-border/60 pb-2">
                    <span className="font-medium text-foreground">
                      {p.residentInternalCode} · {p.planCategory}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {p.caseConferenceDate ? new Date(p.caseConferenceDate).toLocaleDateString() : '—'} · {p.status}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className={tableWrap}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className={tableHead}>
                <tr>
                  <th className="px-4 py-3">Resident</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Conference</th>
                  <th className="px-4 py-3">Services</th>
                </tr>
              </thead>
              <tbody className={tableBody}>
                {plans.map((p) => (
                  <tr key={p.id} className={tableRowHover}>
                    <td className="px-4 py-3 font-medium">{p.residentInternalCode}</td>
                    <td className="px-4 py-3">{p.planCategory}</td>
                    <td className="px-4 py-3">{p.status}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.caseConferenceDate ? new Date(p.caseConferenceDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted-foreground" title={p.servicesProvided ?? ''}>
                      {p.servicesProvided ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
