import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  alertError,
  btnPrimary,
  card,
  input,
  label,
  pageDesc,
  pageTitle,
  sectionFormTitle,
} from './adminStyles'
import {
  createEducationRecord,
  createHealthRecord,
  createIncidentReport,
  createProcessRecording,
  createHomeVisitation,
  getInterventionPlans,
  getHomeVisitations,
  getProcessRecordings,
  getResident,
  listEducationRecords,
  listHealthRecords,
  listIncidentReports,
  patchEducationRecord,
  patchHealthRecord,
  patchIncidentReport,
  patchResident,
  type JsonTableRow,
  type ResidentDetail,
} from '../../api/admin'
import { useSupabaseForLighthouseData } from '../../lib/useSupabaseLighthouse'

type Tab = 'overview' | 'process' | 'visits' | 'education' | 'health' | 'plans' | 'incidents'

export function ResidentDetailPage() {
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const sbData = useSupabaseForLighthouseData()

  const [tab, setTab] = useState<Tab>('overview')
  const [detail, setDetail] = useState<ResidentDetail | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [proc, setProc] = useState<Awaited<ReturnType<typeof getProcessRecordings>>>([])
  const [vis, setVis] = useState<Awaited<ReturnType<typeof getHomeVisitations>>>([])
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof getInterventionPlans>>>([])
  const [edu, setEdu] = useState<JsonTableRow[]>([])
  const [hl, setHl] = useState<JsonTableRow[]>([])
  const [inc, setInc] = useState<JsonTableRow[]>([])

  const load = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) return
    setLoading(true)
    setError(null)
    try {
      const d = await getResident(id)
      setDetail(d)
      setFields({ ...d.fields })
      const [p, v, pl, e, h, i] = await Promise.all([
        getProcessRecordings(id),
        getHomeVisitations(id),
        getInterventionPlans(id),
        listEducationRecords(id),
        listHealthRecords(id),
        listIncidentReports(id),
      ])
      setProc(p)
      setVis(v)
      setPlans(pl)
      setEdu(e)
      setHl(h)
      setInc(i)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function onSaveOverview(e: FormEvent) {
    e.preventDefault()
    if (!Number.isFinite(id)) return
    setSaving(true)
    setError(null)
    try {
      const patch: Record<string, string | null> = {}
      for (const [k, v] of Object.entries(fields)) {
        const orig = detail?.fields[k] ?? ''
        if (v !== orig) patch[k] = v
      }
      await patchResident(id, patch)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!Number.isFinite(id) || id <= 0) {
    return <p className="text-destructive">Invalid resident.</p>
  }

  const tabs: { k: Tab; label: string }[] = [
    { k: 'overview', label: 'Overview' },
    { k: 'process', label: 'Process recordings' },
    { k: 'visits', label: 'Home visitations' },
    { k: 'education', label: 'Education' },
    { k: 'health', label: 'Health & wellbeing' },
    { k: 'plans', label: 'Intervention plans' },
    { k: 'incidents', label: 'Incident reports' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/residents" className="text-sm text-primary hover:underline">
            ← Residents
          </Link>
          <h2 className={pageTitle}>{detail?.fields.internal_code ?? `Resident #${id}`}</h2>
          <p className={pageDesc}>Full case file and related activity. Save changes on the overview tab.</p>
        </div>
      </div>

      {!sbData && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
          Education, health, and incident lists and edits require Supabase data mode (VITE_USE_SUPABASE_DATA=true).
        </p>
      )}

      {error && <div className={alertError}>{error}</div>}

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !detail ? (
        <p className="text-destructive">Resident not found.</p>
      ) : tab === 'overview' ? (
        <form onSubmit={onSaveOverview} className="space-y-4">
          <div className={`${card} max-h-[70vh] overflow-auto`}>
            <p className={sectionFormTitle}>All case fields</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.keys(fields)
                .sort((a, b) => a.localeCompare(b))
                .map((k) => (
                  <label key={k} className={label}>
                    <span className="text-xs text-muted-foreground">{k}</span>
                    <input
                      className={input}
                      value={fields[k] ?? ''}
                      onChange={(e) => setFields((f) => ({ ...f, [k]: e.target.value }))}
                    />
                  </label>
                ))}
            </div>
          </div>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      ) : tab === 'process' ? (
        <ProcessTab residentId={id} rows={proc} onReload={load} />
      ) : tab === 'visits' ? (
        <VisitsTab residentId={id} rows={vis} onReload={load} />
      ) : tab === 'education' ? (
        <JsonRowsTab
          title="Education records"
          rows={edu}
          sbData={sbData}
          onPatch={async (rowId, f) => {
            await patchEducationRecord(rowId, f)
            await load()
          }}
          onAdd={async (f) => {
            await createEducationRecord(id, f)
            await load()
          }}
          defaults={{ record_date: new Date().toISOString().slice(0, 10), progress_percent: '', education_level: '' }}
        />
      ) : tab === 'health' ? (
        <JsonRowsTab
          title="Health & wellbeing"
          rows={hl}
          sbData={sbData}
          onPatch={async (rowId, f) => {
            await patchHealthRecord(rowId, f)
            await load()
          }}
          onAdd={async (f) => {
            await createHealthRecord(id, f)
            await load()
          }}
          defaults={{
            record_date: new Date().toISOString().slice(0, 10),
            general_health_score: '',
            notes: '',
          }}
        />
      ) : tab === 'plans' ? (
        <div className="space-y-3">
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No intervention plans. (Create via data import or future API.)</p>
          ) : (
            plans.map((p) => (
              <div key={p.id} className={card}>
                <p className="text-sm font-medium text-foreground">
                  {p.planCategory} · {p.status}
                </p>
                <p className="text-xs text-muted-foreground">
                  Conference: {p.caseConferenceDate ?? '—'} · SW: {p.residentInternalCode}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{p.planDescription}</p>
              </div>
            ))
          )}
        </div>
      ) : tab === 'incidents' ? (
        <JsonRowsTab
          title="Incident reports"
          rows={inc}
          sbData={sbData}
          onPatch={async (rowId, f) => {
            await patchIncidentReport(rowId, f)
            await load()
          }}
          onAdd={async (f) => {
            await createIncidentReport(id, f)
            await load()
          }}
          defaults={{
            incident_date: new Date().toISOString().slice(0, 10),
            incident_type: 'Medical',
            severity: 'Medium',
            description: '',
            resolved: 'False',
          }}
        />
      ) : null}
    </div>
  )
}

function ProcessTab({
  residentId,
  rows,
  onReload,
}: {
  residentId: number
  rows: Awaited<ReturnType<typeof getProcessRecordings>>
  onReload: () => void
}) {
  const [open, setOpen] = useState(false)
  const [socialWorker, setSocialWorker] = useState('')
  const [sessionType, setSessionType] = useState('Individual')
  const [narrative, setNarrative] = useState('')
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!socialWorker.trim() || !narrative.trim()) return
    setSaving(true)
    setErr(null)
    try {
      await createProcessRecording({
        residentId,
        sessionDate: `${sessionDate}T12:00:00`,
        socialWorker: socialWorker.trim(),
        sessionType,
        sessionNarrative: narrative.trim(),
      })
      setNarrative('')
      setOpen(false)
      onReload()
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {err && <div className={alertError}>{err}</div>}
      <button type="button" className={btnPrimary} onClick={() => setOpen((o) => !o)}>
        {open ? 'Cancel new recording' : 'New process recording'}
      </button>
      {open && (
        <form onSubmit={onSubmit} className={`${card} space-y-3 max-w-xl`}>
          <label className={label}>
            Session date
            <input type="date" className={input} value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
          </label>
          <label className={label}>
            Social worker
            <input className={input} value={socialWorker} onChange={(e) => setSocialWorker(e.target.value)} required />
          </label>
          <label className={label}>
            Session type
            <select className={input} value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
              <option value="Individual">Individual</option>
              <option value="Group">Group</option>
            </select>
          </label>
          <label className={label}>
            Narrative
            <textarea className={input} rows={4} value={narrative} onChange={(e) => setNarrative(e.target.value)} required />
          </label>
          <button type="submit" disabled={saving} className={btnPrimary}>
            Save
          </button>
        </form>
      )}
      <div className="space-y-3">
        {rows.map((r) => (
          <article key={r.id} className={card}>
            <p className="text-sm font-medium text-primary">
              {r.sessionType} · {new Date(r.sessionDate).toLocaleDateString()}
            </p>
            <p className="text-xs text-muted-foreground">{r.socialWorker}</p>
            <p className="mt-2 text-sm">{r.sessionNarrative}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

function VisitsTab({
  residentId,
  rows,
  onReload,
}: {
  residentId: number
  rows: Awaited<ReturnType<typeof getHomeVisitations>>
  onReload: () => void
}) {
  const [open, setOpen] = useState(false)
  const [socialWorker, setSocialWorker] = useState('')
  const [visitType, setVisitType] = useState('Routine Follow-Up')
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!socialWorker.trim()) return
    setSaving(true)
    try {
      await createHomeVisitation({
        residentId,
        visitDate: `${visitDate}T12:00:00`,
        socialWorker: socialWorker.trim(),
        visitType,
        safetyConcernsNoted: false,
        followUpNeeded: false,
      })
      setOpen(false)
      onReload()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <button type="button" className={btnPrimary} onClick={() => setOpen((o) => !o)}>
        {open ? 'Cancel new visit' : 'New home visitation'}
      </button>
      {open && (
        <form onSubmit={onSubmit} className={`${card} grid max-w-xl gap-3`}>
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
            <input className={input} value={visitType} onChange={(e) => setVisitType(e.target.value)} />
          </label>
          <button type="submit" disabled={saving} className={btnPrimary}>
            Save
          </button>
        </form>
      )}
      <div className="space-y-3">
        {rows.map((v) => (
          <article key={v.id} className={card}>
            <p className="text-sm font-medium">{v.visitType}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(v.visitDate).toLocaleDateString()} · {v.socialWorker}
            </p>
            {v.observations && <p className="mt-2 text-sm text-muted-foreground">{v.observations}</p>}
          </article>
        ))}
      </div>
    </div>
  )
}

function JsonRowsTab({
  title,
  rows,
  sbData,
  onPatch,
  onAdd,
  defaults,
}: {
  title: string
  rows: JsonTableRow[]
  sbData: boolean
  onPatch: (id: number, f: Record<string, string | null | undefined>) => Promise<void>
  onAdd: (f: Record<string, string>) => Promise<void>
  defaults: Record<string, string>
}) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(defaults)

  if (!sbData) {
    return <p className="text-sm text-muted-foreground">No rows (enable Supabase data mode to manage {title}).</p>
  }

  return (
    <div className="space-y-4">
      <button type="button" className={btnPrimary} onClick={() => setAdding((a) => !a)}>
        {adding ? 'Cancel' : `Add ${title.slice(0, -1)}`}
      </button>
      {adding && (
        <div className={`${card} space-y-2`}>
          {Object.keys(defaults).map((k) => (
            <label key={k} className={label}>
              {k}
              <input
                className={input}
                value={form[k] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              />
            </label>
          ))}
          <button
            type="button"
            className={btnPrimary}
            onClick={() => void onAdd({ ...form }).then(() => setAdding(false))}
          >
            Save new
          </button>
        </div>
      )}
      {rows.map((r) => (
        <JsonRowEditor key={r.id} row={r} onSave={(f) => onPatch(r.id, f)} />
      ))}
    </div>
  )
}

function JsonRowEditor({ row, onSave }: { row: JsonTableRow; onSave: (f: Record<string, string | null>) => void }) {
  const [local, setLocal] = useState(row.fields)
  return (
    <div className={card}>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.keys(local).map((k) => (
          <label key={k} className={label}>
            <span className="text-xs text-muted-foreground">{k}</span>
            <input className={input} value={local[k] ?? ''} onChange={(e) => setLocal((x) => ({ ...x, [k]: e.target.value }))} />
          </label>
        ))}
      </div>
      <button type="button" className={`${btnPrimary} mt-3`} onClick={() => onSave(local)}>
        Save row
      </button>
    </div>
  )
}
