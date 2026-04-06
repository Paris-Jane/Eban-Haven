import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createProcessRecording, getCases, getProcessRecordings, type Case, type ProcessRecording } from '../../api/admin'

export function ProcessRecordingsPage() {
  const [rows, setRows] = useState<ProcessRecording[]>([])
  const [cases, setCases] = useState<Case[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [caseId, setCaseId] = useState('')
  const [therapist, setTherapist] = useState('')
  const [summary, setSummary] = useState('')
  const [recordedAt, setRecordedAt] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rec, c] = await Promise.all([getProcessRecordings(), getCases()])
      setRows(rec)
      setCases(c)
      setCaseId((prev) => prev || c[0]?.id || '')
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!caseId || !therapist.trim() || !summary.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createProcessRecording({
        caseId,
        recordedAt: new Date(recordedAt).toISOString(),
        therapist: therapist.trim(),
        summary: summary.trim(),
      })
      setSummary('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function caseLabel(id: string) {
    const c = cases.find((x) => x.id === id)
    return c?.referenceCode ?? id.slice(0, 8)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl font-bold text-white">Process recordings</h2>
        <p className="mt-1 text-sm text-slate-400">
          Clinical / social-work session notes tied to a case (demo — not HIPAA-ready).
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 max-w-xl"
      >
        <p className="text-sm font-medium text-slate-300">New recording</p>
        <label className="block text-xs text-slate-500">
          Case
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            required
          >
            {cases.length === 0 ? (
              <option value="">No cases — add one in Caseload first</option>
            ) : (
              cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.referenceCode}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="block text-xs text-slate-500">
          Staff / therapist
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={therapist}
            onChange={(e) => setTherapist(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs text-slate-500">
          Recorded at
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white sm:max-w-xs"
            value={recordedAt}
            onChange={(e) => setRecordedAt(e.target.value)}
          />
        </label>
        <label className="block text-xs text-slate-500">
          Summary
          <textarea
            rows={4}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          disabled={saving || cases.length === 0}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save recording'}
        </button>
      </form>

      <div className="space-y-4">
        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-500">No recordings yet.</p>
        ) : (
          rows.map((r) => (
            <article
              key={r.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-teal-300">{caseLabel(r.caseId)}</span>
                <time className="text-xs text-slate-500">
                  {new Date(r.recordedAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-xs text-slate-400">By {r.therapist}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{r.summary}</p>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
