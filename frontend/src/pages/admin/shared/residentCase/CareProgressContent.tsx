import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createProcessRecording,
  createHomeVisitation,
  deleteProcessRecording,
  deleteHomeVisitation,
  patchProcessRecording,
  patchHomeVisitation,
  createEducationRecord,
  patchEducationRecord,
  createHealthRecord,
  patchHealthRecord,
  type ProcessRecording,
  type HomeVisitation,
  type EducationRecord,
  type HealthRecord,
} from '../../../../api/admin'
import { alertError, btnPrimary, input, label } from '../adminStyles'
import { AdminDeleteModal } from '../adminDataTable/AdminDeleteModal'
import { BooleanBadge, CategoryBadge, VisitOutcomeBadge } from '../adminDataTable/AdminBadges'
import { formatAdminDate, inDateRange } from '../adminDataTable/adminFormatters'
import {
  COOPERATION_LEVELS,
  EMOTIONAL_STATES,
  SESSION_TYPES,
  VISIT_OUTCOMES,
  VISIT_TYPES,
} from './caseConstants'
import {
  CaseDrawer,
  EmptyState,
  QuickActionButton,
  RecordCardRow,
  SearchField,
  SectionHeader,
  ToggleField,
} from './caseUi'

type CareSub = 'counseling' | 'visits' | 'education' | 'health'

export function CareProgressContent({
  residentId,
  sub,
  recordings,
  visitations,
  education,
  health,
  onReload,
  createSignals,
}: {
  residentId: number
  sub: CareSub
  recordings: ProcessRecording[]
  visitations: HomeVisitation[]
  education: EducationRecord[]
  health: HealthRecord[]
  onReload: () => void
  /** Increment from parent (e.g. header quick action) to open the matching “add” drawer. */
  createSignals?: { counseling: number; visit: number; education: number; health: number }
}) {
  if (sub === 'counseling') {
    return (
      <CounselingSection
        residentId={residentId}
        rows={recordings}
        onReload={onReload}
        openCreateSignal={createSignals?.counseling ?? 0}
      />
    )
  }
  if (sub === 'visits') {
    return (
      <VisitsSection residentId={residentId} rows={visitations} onReload={onReload} openCreateSignal={createSignals?.visit ?? 0} />
    )
  }
  if (sub === 'education') {
    return (
      <EducationSection residentId={residentId} rows={education} onReload={onReload} openCreateSignal={createSignals?.education ?? 0} />
    )
  }
  return <HealthSection residentId={residentId} rows={health} onReload={onReload} openCreateSignal={createSignals?.health ?? 0} />
}

function CounselingSection({
  residentId,
  rows,
  onReload,
  openCreateSignal,
}: {
  residentId: number
  rows: ProcessRecording[]
  onReload: () => void
  openCreateSignal: number
}) {
  const [q, setQ] = useState('')
  const [df, setDf] = useState('')
  const [dt, setDt] = useState('')
  const [sel, setSel] = useState<ProcessRecording | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (openCreateSignal > 0) {
      setCreateOpen(true)
      setSel(null)
      setEditing(false)
    }
  }, [openCreateSignal])

  const filtered = useMemo(() => {
    let list = [...rows].sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
    if (df || dt) list = list.filter((r) => inDateRange(r.sessionDate, df, dt))
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      list = list.filter(
        (r) =>
          r.socialWorker.toLowerCase().includes(s) ||
          r.sessionType.toLowerCase().includes(s) ||
          (r.emotionalStateObserved ?? '').toLowerCase().includes(s),
      )
    }
    return list
  }, [rows, q, df, dt])

  const closeDrawer = () => {
    setSel(null)
    setCreateOpen(false)
    setEditing(false)
    setErr(null)
  }

  return (
    <div className="space-y-6">
      {err && <div className={alertError}>{err}</div>}
      <SectionHeader
        title="Counseling sessions"
        description="Counseling sessions for this resident — open a row for full notes and follow-up."
        actions={<QuickActionButton onClick={() => setCreateOpen(true)}>Add session</QuickActionButton>}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SearchField value={q} onChange={setQ} placeholder="Worker, type, emotional state…" />
        <label className={label}>
          From
          <input type="date" className={input} value={df} onChange={(e) => setDf(e.target.value)} />
        </label>
        <label className={label}>
          To
          <input type="date" className={input} value={dt} onChange={(e) => setDt(e.target.value)} />
        </label>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <EmptyState
            title="No counseling sessions yet"
            hint="Document sessions to track emotional state, interventions, and follow-up."
            action={<QuickActionButton onClick={() => setCreateOpen(true)}>Add session</QuickActionButton>}
          />
        ) : (
          filtered.map((r) => (
            <RecordCardRow key={r.id} onClick={() => { setSel(r); setEditing(false); setCreateOpen(false) }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{formatAdminDate(r.sessionDate)}</span>
                <CategoryBadge>{r.sessionType}</CategoryBadge>
                {r.emotionalStateObserved ? <CategoryBadge>{r.emotionalStateObserved}</CategoryBadge> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.socialWorker}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {r.sessionDurationMinutes != null ? <span>{r.sessionDurationMinutes} min</span> : null}
                <BooleanBadge value={r.progressNoted} />
                <span className="text-muted-foreground">Concerns</span>
                <BooleanBadge value={r.concernsFlagged} trueVariant="danger" />
              </div>
            </RecordCardRow>
          ))
        )}
      </div>

      {(sel || createOpen) && (
        <CounselingDrawer
          key={createOpen ? 'new' : String(sel?.id)}
          mode={createOpen ? 'create' : editing ? 'edit' : 'view'}
          residentId={residentId}
          initial={sel}
          error={err}
          onError={setErr}
          onClose={closeDrawer}
          onEdit={() => setEditing(true)}
          onSaved={async () => {
            closeDrawer()
            await onReload()
          }}
          onDeleteRequest={(id) => setDeleteId(id)}
        />
      )}

      <AdminDeleteModal
        open={deleteId != null}
        title="Delete counseling session?"
        body="This session record will be permanently removed."
        loading={saving}
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId == null) return
          setSaving(true)
          try {
            await deleteProcessRecording(deleteId)
            setDeleteId(null)
            closeDrawer()
            await onReload()
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'Delete failed')
          } finally {
            setSaving(false)
          }
        }}
      />
    </div>
  )
}

function CounselingDrawer({
  mode,
  residentId,
  initial,
  error,
  onError,
  onClose,
  onEdit,
  onSaved,
  onDeleteRequest,
}: {
  mode: 'view' | 'edit' | 'create'
  residentId: number
  initial: ProcessRecording | null
  error: string | null
  onError: (e: string | null) => void
  onClose: () => void
  onEdit: () => void
  onSaved: () => Promise<void>
  onDeleteRequest: (id: number) => void
}) {
  const [savingLocal, setSavingLocal] = useState(false)
  const [sessionDate, setSessionDate] = useState(() =>
    initial ? new Date(initial.sessionDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  )
  const [socialWorker, setSocialWorker] = useState(initial?.socialWorker ?? '')
  const [sessionType, setSessionType] = useState(initial?.sessionType ?? 'Individual')
  const [duration, setDuration] = useState(initial?.sessionDurationMinutes != null ? String(initial.sessionDurationMinutes) : '')
  const [emoObs, setEmoObs] = useState(initial?.emotionalStateObserved ?? '')
  const [emoEnd, setEmoEnd] = useState(initial?.emotionalStateEnd ?? '')
  const [narrative, setNarrative] = useState(initial?.sessionNarrative ?? '')
  const [interventions, setInterventions] = useState(initial?.interventionsApplied ?? '')
  const [followUp, setFollowUp] = useState(initial?.followUpActions ?? '')
  const [progressNoted, setProgressNoted] = useState(initial?.progressNoted ?? true)
  const [concerns, setConcerns] = useState(initial?.concernsFlagged ?? false)
  const [referral, setReferral] = useState(initial?.referralMade ?? false)

  const readOnly = mode === 'view'

  async function submit(e: FormEvent) {
    e.preventDefault()
    onError(null)
    const narr = narrative.trim() || '(No narrative)'
    const sw = socialWorker.trim()
    if (!sw) {
      onError('Social worker is required.')
      return
    }
    const dur = duration.trim() ? parseInt(duration, 10) : undefined
    if (duration.trim() && !Number.isFinite(dur)) {
      onError('Duration must be a number.')
      return
    }
    const at = `${sessionDate}T12:00:00`
    setSavingLocal(true)
    try {
      if (mode === 'create') {
        await createProcessRecording({
          residentId,
          sessionDate: at,
          socialWorker: sw,
          sessionType,
          sessionDurationMinutes: dur,
          emotionalStateObserved: emoObs.trim() || undefined,
          emotionalStateEnd: emoEnd.trim() || undefined,
          sessionNarrative: narr,
          interventionsApplied: interventions.trim() || undefined,
          followUpActions: followUp.trim() || undefined,
          progressNoted,
          concernsFlagged: concerns,
          referralMade: referral,
        })
      } else if (initial && mode === 'edit') {
        await patchProcessRecording(initial.id, {
          sessionDate: at,
          socialWorker: sw,
          sessionType,
          sessionDurationMinutes: dur,
          emotionalStateObserved: emoObs.trim() || undefined,
          emotionalStateEnd: emoEnd.trim() || undefined,
          sessionNarrative: narr,
          interventionsApplied: interventions.trim() || undefined,
          followUpActions: followUp.trim() || undefined,
          progressNoted,
          concernsFlagged: concerns,
          referralMade: referral,
        })
      }
      await onSaved()
    } catch (x) {
      onError(x instanceof Error ? x.message : 'Save failed')
    } finally {
      setSavingLocal(false)
    }
  }

  return (
    <CaseDrawer
      title={mode === 'create' ? 'New counseling session' : 'Counseling session'}
      onClose={onClose}
      footer={
        readOnly && initial ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              className="rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              onClick={() => initial && onDeleteRequest(initial.id)}
            >
              Delete…
            </button>
          </div>
        ) : null
      }
    >
      {error && <div className={alertError}>{error}</div>}
      {readOnly && initial ? (
        <div className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">Date</span>{' '}
            <span className="font-medium">{formatAdminDate(initial.sessionDate)}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Worker</span> {initial.socialWorker}
          </p>
          <p>
            <span className="text-muted-foreground">Type</span> <CategoryBadge>{initial.sessionType}</CategoryBadge>
          </p>
          {initial.sessionDurationMinutes != null ? <p>Duration: {initial.sessionDurationMinutes} min</p> : null}
          {initial.emotionalStateObserved ? (
            <p>
              Emotional (start → end): {initial.emotionalStateObserved} → {initial.emotionalStateEnd ?? '—'}
            </p>
          ) : null}
          <p className="whitespace-pre-wrap text-foreground">{initial.sessionNarrative}</p>
          {initial.interventionsApplied ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Interventions</p>
              <p className="whitespace-pre-wrap">{initial.interventionsApplied}</p>
            </div>
          ) : null}
          {initial.followUpActions ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Follow-up</p>
              <p className="whitespace-pre-wrap">{initial.followUpActions}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <BooleanBadge value={initial.progressNoted} /> progress
            <BooleanBadge value={initial.concernsFlagged} trueVariant="danger" /> concerns
            <BooleanBadge value={initial.referralMade} /> referral
          </div>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={submit}>
          <label className={label}>
            Session date
            <input type="date" className={input} value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required />
          </label>
          <label className={label}>
            Social worker
            <input className={input} value={socialWorker} onChange={(e) => setSocialWorker(e.target.value)} required />
          </label>
          <label className={label}>
            Session type
            <select className={input} value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
              {SESSION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Duration (minutes)
            <input className={input} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
          <label className={label}>
            Emotional state (observed)
            <select className={input} value={emoObs} onChange={(e) => setEmoObs(e.target.value)}>
              <option value="">—</option>
              {EMOTIONAL_STATES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Emotional state (end)
            <select className={input} value={emoEnd} onChange={(e) => setEmoEnd(e.target.value)}>
              <option value="">—</option>
              {EMOTIONAL_STATES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Session narrative
            <textarea className={input} rows={4} value={narrative} onChange={(e) => setNarrative(e.target.value)} required />
          </label>
          <label className={label}>
            Interventions applied
            <textarea className={input} rows={3} value={interventions} onChange={(e) => setInterventions(e.target.value)} />
          </label>
          <label className={label}>
            Follow-up actions
            <textarea className={input} rows={2} value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
          </label>
          <ToggleField labelText="Progress noted" value={progressNoted} onChange={setProgressNoted} />
          <ToggleField labelText="Concerns flagged" value={concerns} onChange={setConcerns} />
          <ToggleField labelText="Referral made" value={referral} onChange={setReferral} />
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <button type="submit" disabled={savingLocal} className={btnPrimary}>
              {savingLocal ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
            </button>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </CaseDrawer>
  )
}

function VisitsSection({
  residentId,
  rows,
  onReload,
  openCreateSignal,
}: {
  residentId: number
  rows: HomeVisitation[]
  onReload: () => void
  openCreateSignal: number
}) {
  const [q, setQ] = useState('')
  const [df, setDf] = useState('')
  const [dt, setDt] = useState('')
  const [sel, setSel] = useState<HomeVisitation | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (openCreateSignal > 0) {
      setCreateOpen(true)
      setSel(null)
      setEditing(false)
    }
  }, [openCreateSignal])

  const filtered = useMemo(() => {
    let list = [...rows].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
    if (df || dt) list = list.filter((r) => inDateRange(r.visitDate, df, dt))
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      list = list.filter(
        (r) =>
          r.socialWorker.toLowerCase().includes(s) ||
          r.visitType.toLowerCase().includes(s) ||
          (r.locationVisited ?? '').toLowerCase().includes(s),
      )
    }
    return list
  }, [rows, q, df, dt])

  const closeDrawer = () => {
    setSel(null)
    setCreateOpen(false)
    setEditing(false)
    setErr(null)
  }

  return (
    <div className="space-y-6">
      {err && <div className={alertError}>{err}</div>}
      <SectionHeader
        title="Home visitations"
        description="Family visits and follow-ups outside the safehouse."
        actions={<QuickActionButton onClick={() => setCreateOpen(true)}>Add visit</QuickActionButton>}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SearchField value={q} onChange={setQ} />
        <label className={label}>
          From
          <input type="date" className={input} value={df} onChange={(e) => setDf(e.target.value)} />
        </label>
        <label className={label}>
          To
          <input type="date" className={input} value={dt} onChange={(e) => setDt(e.target.value)} />
        </label>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <EmptyState
            title="No home visitations recorded"
            action={<QuickActionButton onClick={() => setCreateOpen(true)}>Add visit</QuickActionButton>}
          />
        ) : (
          filtered.map((v) => (
            <RecordCardRow key={v.id} onClick={() => { setSel(v); setEditing(false); setCreateOpen(false) }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{formatAdminDate(v.visitDate)}</span>
                <CategoryBadge>{v.visitType}</CategoryBadge>
                {v.familyCooperationLevel ? <CategoryBadge>{v.familyCooperationLevel}</CategoryBadge> : null}
                {v.visitOutcome ? <VisitOutcomeBadge outcome={v.visitOutcome} /> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{v.socialWorker}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <BooleanBadge value={v.safetyConcernsNoted} trueVariant="danger" /> safety concern
                {v.followUpNeeded ? <BooleanBadge value={true} trueLabel="Follow-up needed" trueVariant="warning" /> : null}
              </div>
            </RecordCardRow>
          ))
        )}
      </div>

      {(sel || createOpen) && (
        <VisitDrawer
          key={createOpen ? 'new' : String(sel?.id)}
          mode={createOpen ? 'create' : editing ? 'edit' : 'view'}
          residentId={residentId}
          initial={sel}
          error={err}
          onError={setErr}
          onClose={closeDrawer}
          onEdit={() => setEditing(true)}
          onSaved={async () => {
            closeDrawer()
            await onReload()
          }}
          onDeleteRequest={(id) => setDeleteId(id)}
        />
      )}

      <AdminDeleteModal
        open={deleteId != null}
        title="Delete home visitation?"
        body="This visitation record will be permanently removed."
        loading={saving}
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId == null) return
          setSaving(true)
          try {
            await deleteHomeVisitation(deleteId)
            setDeleteId(null)
            closeDrawer()
            await onReload()
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'Delete failed')
          } finally {
            setSaving(false)
          }
        }}
      />
    </div>
  )
}

function VisitDrawer({
  mode,
  residentId,
  initial,
  error,
  onError,
  onClose,
  onEdit,
  onSaved,
  onDeleteRequest,
}: {
  mode: 'view' | 'edit' | 'create'
  residentId: number
  initial: HomeVisitation | null
  error: string | null
  onError: (e: string | null) => void
  onClose: () => void
  onEdit: () => void
  onSaved: () => Promise<void>
  onDeleteRequest: (id: number) => void
}) {
  const [savingLocal, setSavingLocal] = useState(false)
  const [visitDate, setVisitDate] = useState(() =>
    initial ? new Date(initial.visitDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  )
  const [socialWorker, setSocialWorker] = useState(initial?.socialWorker ?? '')
  const [visitType, setVisitType] = useState(initial?.visitType ?? 'Routine Follow-Up')
  const [location, setLocation] = useState(initial?.locationVisited ?? '')
  const [familyPresent, setFamilyPresent] = useState(initial?.familyMembersPresent ?? '')
  const [purpose, setPurpose] = useState(initial?.purpose ?? '')
  const [observations, setObservations] = useState(initial?.observations ?? '')
  const [coop, setCoop] = useState(initial?.familyCooperationLevel ?? '')
  const [safety, setSafety] = useState(initial?.safetyConcernsNoted ?? false)
  const [followNeeded, setFollowNeeded] = useState(initial?.followUpNeeded ?? false)
  const [followNotes, setFollowNotes] = useState(initial?.followUpNotes ?? '')
  const [outcome, setOutcome] = useState(initial?.visitOutcome ?? 'Favorable')

  const readOnly = mode === 'view'

  async function submit(e: FormEvent) {
    e.preventDefault()
    onError(null)
    const sw = socialWorker.trim()
    if (!sw) {
      onError('Social worker is required.')
      return
    }
    const at = `${visitDate}T12:00:00`
    setSavingLocal(true)
    try {
      if (mode === 'create') {
        await createHomeVisitation({
          residentId,
          visitDate: at,
          socialWorker: sw,
          visitType,
          locationVisited: location.trim() || undefined,
          observations: observations.trim() || undefined,
          familyCooperationLevel: coop.trim() || undefined,
          safetyConcernsNoted: safety,
          followUpNeeded: followNeeded,
          followUpNotes: followNeeded ? followNotes.trim() || undefined : undefined,
          purpose: purpose.trim() || undefined,
          familyMembersPresent: familyPresent.trim() || undefined,
          visitOutcome: outcome,
        })
      } else if (initial && mode === 'edit') {
        await patchHomeVisitation(initial.id, {
          visitDate: at,
          socialWorker: sw,
          visitType,
          locationVisited: location.trim() || undefined,
          familyMembersPresent: familyPresent.trim() || undefined,
          purpose: purpose.trim() || undefined,
          observations: observations.trim() || undefined,
          familyCooperationLevel: coop.trim() || undefined,
          safetyConcernsNoted: safety,
          followUpNeeded: followNeeded,
          followUpNotes: followNeeded ? followNotes.trim() || undefined : '',
          visitOutcome: outcome,
        })
      }
      await onSaved()
    } catch (x) {
      onError(x instanceof Error ? x.message : 'Save failed')
    } finally {
      setSavingLocal(false)
    }
  }

  return (
    <CaseDrawer
      title={mode === 'create' ? 'New home visit' : 'Home visit'}
      onClose={onClose}
      footer={
        readOnly && initial ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              className="rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              onClick={() => initial && onDeleteRequest(initial.id)}
            >
              Delete…
            </button>
          </div>
        ) : null
      }
    >
      {error && <div className={alertError}>{error}</div>}
      {readOnly && initial ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium">{formatAdminDate(initial.visitDate)}</p>
          <p>{initial.socialWorker}</p>
          <CategoryBadge>{initial.visitType}</CategoryBadge>
          {initial.locationVisited ? <p>Location: {initial.locationVisited}</p> : null}
          {initial.familyMembersPresent ? <p className="whitespace-pre-wrap">Family present: {initial.familyMembersPresent}</p> : null}
          {initial.purpose ? <p className="whitespace-pre-wrap">{initial.purpose}</p> : null}
          {initial.observations ? <p className="whitespace-pre-wrap text-muted-foreground">{initial.observations}</p> : null}
          {initial.familyCooperationLevel ? <CategoryBadge>{initial.familyCooperationLevel}</CategoryBadge> : null}
          <div className="flex flex-wrap gap-2">
            <BooleanBadge value={initial.safetyConcernsNoted} trueVariant="danger" /> safety concerns
            <BooleanBadge value={initial.followUpNeeded} trueVariant="warning" /> follow-up
          </div>
          {initial.followUpNotes ? <p className="whitespace-pre-wrap">{initial.followUpNotes}</p> : null}
          {initial.visitOutcome ? <VisitOutcomeBadge outcome={initial.visitOutcome} /> : null}
        </div>
      ) : (
        <form className="space-y-3" onSubmit={submit}>
          <label className={label}>
            Visit date
            <input type="date" className={input} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} required />
          </label>
          <label className={label}>
            Social worker
            <input className={input} value={socialWorker} onChange={(e) => setSocialWorker(e.target.value)} required />
          </label>
          <label className={label}>
            Visit type
            <select className={input} value={visitType} onChange={(e) => setVisitType(e.target.value)}>
              {VISIT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Location visited
            <input className={input} value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          <label className={label}>
            Family members present
            <textarea className={input} rows={2} value={familyPresent} onChange={(e) => setFamilyPresent(e.target.value)} />
          </label>
          <label className={label}>
            Purpose
            <textarea className={input} rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </label>
          <label className={label}>
            Observations
            <textarea className={input} rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} />
          </label>
          <label className={label}>
            Family cooperation
            <select className={input} value={coop} onChange={(e) => setCoop(e.target.value)}>
              <option value="">—</option>
              {COOPERATION_LEVELS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <ToggleField labelText="Safety concerns noted" value={safety} onChange={setSafety} />
          <ToggleField labelText="Follow-up needed" value={followNeeded} onChange={setFollowNeeded} />
          {followNeeded ? (
            <label className={label}>
              Follow-up notes
              <textarea className={input} rows={2} value={followNotes} onChange={(e) => setFollowNotes(e.target.value)} />
            </label>
          ) : null}
          <label className={label}>
            Visit outcome
            <select className={input} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              {VISIT_OUTCOMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <button type="submit" disabled={savingLocal} className={btnPrimary}>
              {savingLocal ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
            </button>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </CaseDrawer>
  )
}

function EducationSection({
  residentId,
  rows,
  onReload,
  openCreateSignal,
}: {
  residentId: number
  rows: EducationRecord[]
  onReload: () => void
  openCreateSignal: number
}) {
  const [sel, setSel] = useState<EducationRecord | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [progress, setProgress] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (openCreateSignal > 0) {
      setCreateOpen(true)
      setSel(null)
      setRecordDate(new Date().toISOString().slice(0, 10))
      setProgress('')
    }
  }, [openCreateSignal])

  const sorted = useMemo(
    () => [...rows].sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime()),
    [rows],
  )

  async function save(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    const p = progress.trim() ? parseFloat(progress) : undefined
    if (progress.trim() && (p == null || p < 0 || p > 100)) {
      setErr('Progress must be between 0 and 100.')
      return
    }
    setSaving(true)
    try {
      if (sel && !createOpen) {
        await patchEducationRecord(sel.id, { record_date: recordDate, progress_percent: p != null ? String(p) : '' })
      } else {
        await createEducationRecord(residentId, { record_date: recordDate, progress_percent: p != null ? String(p) : '' })
      }
      setSel(null)
      setCreateOpen(false)
      await onReload()
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {err && <div className={alertError}>{err}</div>}
      <SectionHeader
        title="Education records"
        description="The API currently stores record date and progress percent. Extended program metadata can be added when the schema expands."
        actions={<QuickActionButton onClick={() => { setCreateOpen(true); setSel(null); setProgress(''); setRecordDate(new Date().toISOString().slice(0, 10)) }}>Add record</QuickActionButton>}
      />
      <div className="space-y-2">
        {sorted.length === 0 ? (
          <EmptyState
            title="No education records"
            action={
              <QuickActionButton
                onClick={() => {
                  setCreateOpen(true)
                  setSel(null)
                  setProgress('')
                  setRecordDate(new Date().toISOString().slice(0, 10))
                }}
              >
                Add record
              </QuickActionButton>
            }
          />
        ) : (
          sorted.map((r) => (
            <RecordCardRow key={r.id} onClick={() => { setSel(r); setCreateOpen(false); setRecordDate(r.recordDate.slice(0, 10)); setProgress(r.progressPercent != null ? String(r.progressPercent) : '') }}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{formatAdminDate(r.recordDate)}</span>
                {r.progressPercent != null ? (
                  <span className="text-sm tabular-nums text-muted-foreground">{r.progressPercent}%</span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/80"
                  style={{ width: `${Math.min(100, Math.max(0, r.progressPercent ?? 0))}%` }}
                />
              </div>
            </RecordCardRow>
          ))
        )}
      </div>
      {(createOpen || sel) && (
        <CaseDrawer
          title={createOpen ? 'New education record' : 'Education record'}
          onClose={() => { setSel(null); setCreateOpen(false); setErr(null) }}
          footer={
            <form onSubmit={save} className="flex gap-2">
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </form>
          }
        >
          <label className={label}>
            Record date
            <input type="date" className={input} value={recordDate} onChange={(e) => setRecordDate(e.target.value)} required />
          </label>
          <label className={label}>
            Progress (%)
            <input className={input} inputMode="decimal" value={progress} onChange={(e) => setProgress(e.target.value)} placeholder="0–100" />
          </label>
        </CaseDrawer>
      )}
    </div>
  )
}

function HealthSection({
  residentId,
  rows,
  onReload,
  openCreateSignal,
}: {
  residentId: number
  rows: HealthRecord[]
  onReload: () => void
  openCreateSignal: number
}) {
  const [sel, setSel] = useState<HealthRecord | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [score, setScore] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (openCreateSignal > 0) {
      setCreateOpen(true)
      setSel(null)
      setRecordDate(new Date().toISOString().slice(0, 10))
      setScore('')
    }
  }, [openCreateSignal])

  const sorted = useMemo(
    () => [...rows].sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime()),
    [rows],
  )

  async function save(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    const v = score.trim() ? parseFloat(score) : undefined
    if (score.trim() && (v == null || v < 1 || v > 5)) {
      setErr('Health score is typically 1–5.')
      return
    }
    setSaving(true)
    try {
      if (sel && !createOpen) {
        await patchHealthRecord(sel.id, { record_date: recordDate, general_health_score: v != null ? String(v) : '' })
      } else {
        await createHealthRecord(residentId, { record_date: recordDate, general_health_score: v != null ? String(v) : '' })
      }
      setSel(null)
      setCreateOpen(false)
      await onReload()
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {err && <div className={alertError}>{err}</div>}
      <SectionHeader
        title="Health & wellbeing"
        description="General wellbeing scores by date (stored fields only)."
        actions={<QuickActionButton onClick={() => { setCreateOpen(true); setSel(null); setScore(''); setRecordDate(new Date().toISOString().slice(0, 10)) }}>Add record</QuickActionButton>}
      />
      <div className="space-y-2">
        {sorted.length === 0 ? (
          <EmptyState
            title="No health records"
            action={
              <QuickActionButton
                onClick={() => {
                  setCreateOpen(true)
                  setSel(null)
                  setScore('')
                  setRecordDate(new Date().toISOString().slice(0, 10))
                }}
              >
                Add record
              </QuickActionButton>
            }
          />
        ) : (
          sorted.map((r) => (
            <RecordCardRow key={r.id} onClick={() => { setSel(r); setCreateOpen(false); setRecordDate(r.recordDate.slice(0, 10)); setScore(r.healthScore != null ? String(r.healthScore) : '') }}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{formatAdminDate(r.recordDate)}</span>
                <span className="text-lg font-semibold tabular-nums text-foreground">{r.healthScore ?? '—'}</span>
              </div>
            </RecordCardRow>
          ))
        )}
      </div>
      {(createOpen || sel) && (
        <CaseDrawer
          title={createOpen ? 'New health record' : 'Health record'}
          onClose={() => { setSel(null); setCreateOpen(false); setErr(null) }}
          footer={
            <form onSubmit={save} className="flex gap-2">
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </form>
          }
        >
          <label className={label}>
            Record date
            <input type="date" className={input} value={recordDate} onChange={(e) => setRecordDate(e.target.value)} required />
          </label>
          <label className={label}>
            General health score (1–5)
            <input className={input} inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} />
          </label>
        </CaseDrawer>
      )}
    </div>
  )
}
