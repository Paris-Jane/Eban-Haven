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
} from './adminStyles'
import {
  createProcessRecording,
  getProcessRecordings,
  getResidents,
  type ProcessRecording,
  type ResidentSummary,
} from '../../api/admin'

const sessionTypes = ['Individual', 'Group'] as const

export function ProcessRecordingsPage() {
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [rows, setRows] = useState<ProcessRecording[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  /** Table filter: 0 = all residents */
  const [filterResidentId, setFilterResidentId] = useState<number>(0)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
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

  const loadResidents = useCallback(async () => {
    try {
      const r = await getResidents({})
      setResidents(r)
    } catch {
      /* handled in load */
    }
  }, [])

  const loadRecordings = useCallback(async () => {
    setLoading(true)
    try {
      await loadResidents()
      const rec = await getProcessRecordings(filterResidentId || undefined)
      setRows(rec)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [filterResidentId, loadResidents])

  useEffect(() => {
    void loadRecordings()
  }, [loadRecordings])

  useEffect(() => {
    if (!showNew || residents.length === 0) return
    setFormResidentId((prev) => {
      if (prev && residents.some((r) => r.id === prev)) return prev
      if (filterResidentId && residents.some((r) => r.id === filterResidentId)) return filterResidentId
      return residents[0]?.id ?? 0
    })
  }, [showNew, residents, filterResidentId])

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
      await loadRecordings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const needle = search.trim().toLowerCase()
  const filtered = [...rows]
    .filter((r) => {
      if (!needle) return true
      const hay = `${r.residentInternalCode} ${r.sessionType} ${r.socialWorker} ${r.sessionNarrative} ${r.interventionsApplied ?? ''} ${r.followUpActions ?? ''}`.toLowerCase()
      return hay.includes(needle)
    })
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Process recording</h2>
        <p className={pageDesc}>
          Dated counseling session notes per resident: session type, emotional state, narrative, interventions, and
          follow-up. Filter and search the list; open a resident profile from each entry.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <div className={`${card} flex flex-wrap items-end gap-3`}>
        <label className={label}>
          Filter by resident
          <select
            className={`${input} min-w-[12rem]`}
            value={filterResidentId || ''}
            onChange={(e) => setFilterResidentId(Number(e.target.value))}
          >
            <option value={0}>All</option>
            {residents.map((r) => (
              <option key={r.id} value={r.id}>
                {r.internalCode} — {r.caseStatus}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Search
          <input
            className={input}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Worker, narrative, type…"
          />
        </label>
      </div>

      <div>
        <button type="button" className={btnPrimary} onClick={() => setShowNew((s) => !s)}>
          {showNew ? 'Close new recording' : 'New process recording'}
        </button>
      </div>

      {showNew && (
        <form onSubmit={onSubmit} className={cardForm}>
          <p className={sectionFormTitle}>New process recording</p>
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
            <input
              className={input}
              value={interventions}
              onChange={(e) => setInterventions(e.target.value)}
              placeholder="Caring, Healing, Legal Services…"
            />
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
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground">No recordings for this view.</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((r) => (
              <article key={r.id} className={card}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    <Link className="text-primary hover:underline" to={`/admin/residents/${r.residentId}`}>
                      {r.residentInternalCode}
                    </Link>
                    <span className="text-foreground"> · {r.sessionType}</span>
                  </span>
                  <time className="text-xs text-muted-foreground">
                    {new Date(r.sessionDate).toLocaleDateString()} · {r.socialWorker}
                  </time>
                </div>
                {r.sessionDurationMinutes != null && (
                  <p className="mt-1 text-xs text-muted-foreground">{r.sessionDurationMinutes} minutes</p>
                )}
                {(r.emotionalStateObserved || r.emotionalStateEnd) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mood: {r.emotionalStateObserved ?? '?'} → {r.emotionalStateEnd ?? '?'}
                  </p>
                )}
                {r.interventionsApplied && (
                  <p className="mt-2 text-xs font-medium text-foreground">Interventions: {r.interventionsApplied}</p>
                )}
                <p className="mt-2 text-sm leading-relaxed text-foreground">{r.sessionNarrative}</p>
                {r.followUpActions && (
                  <p className="mt-2 text-xs text-muted-foreground">Follow-up: {r.followUpActions}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Progress noted: {r.progressNoted ? 'Yes' : 'No'} · Concerns: {r.concernsFlagged ? 'Yes' : 'No'} ·
                  Referral: {r.referralMade ? 'Yes' : 'No'}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
