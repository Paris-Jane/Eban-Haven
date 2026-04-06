import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createVisitation, getCases, getVisitations, type Case, type Visitation } from '../../api/admin'

const statusOptions = ['Scheduled', 'Completed', 'Cancelled'] as const

export function VisitationsPage() {
  const [rows, setRows] = useState<Visitation[]>([])
  const [cases, setCases] = useState<Case[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [caseId, setCaseId] = useState('')
  const [visitorName, setVisitorName] = useState('')
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [status, setStatus] = useState<string>('Scheduled')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [v, c] = await Promise.all([getVisitations(), getCases()])
      setRows(v)
      setCases(c)
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
    if (!visitorName.trim()) return
    const iso = new Date(scheduledAt).toISOString()
    setSaving(true)
    setError(null)
    try {
      await createVisitation({
        caseId: caseId || null,
        visitorName: visitorName.trim(),
        scheduledAt: iso,
        status,
      })
      setVisitorName('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function caseLabel(id: string | null) {
    if (!id) return '—'
    const c = cases.find((x) => x.id === id)
    return c?.referenceCode ?? id.slice(0, 8)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl font-bold text-white">Visitations</h2>
        <p className="mt-1 text-sm text-slate-400">Schedule and track visits linked to cases.</p>
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
        <p className="text-sm font-medium text-slate-300">Schedule visitation</p>
        <label className="block text-xs text-slate-500">
          Case (optional)
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
          >
            <option value="">No case linked</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.referenceCode} — {c.status}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-500">
          Visitor / role
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={visitorName}
            onChange={(e) => setVisitorName(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs text-slate-500">
          Scheduled time
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white sm:max-w-xs"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </label>
        <label className="block text-xs text-slate-500">
          Status
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white sm:max-w-xs"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Add visitation'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/90 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Visitor</th>
              <th className="px-4 py-3 font-medium">Case</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/50">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No visitations yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-900/80">
                  <td className="px-4 py-3 text-slate-300">
                    {new Date(r.scheduledAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-white">{r.visitorName}</td>
                  <td className="px-4 py-3 text-slate-400">{caseLabel(r.caseId)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-teal-300">
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
