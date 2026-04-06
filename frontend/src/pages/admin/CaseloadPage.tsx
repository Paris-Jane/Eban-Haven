import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createCase, getCases, updateCaseStatus, type Case } from '../../api/admin'

const statuses = ['Active', 'Reintegration', 'Closed'] as const

export function CaseloadPage() {
  const [rows, setRows] = useState<Case[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [referenceCode, setReferenceCode] = useState('')
  const [status, setStatus] = useState<string>('Active')
  const [summary, setSummary] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getCases())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cases')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!referenceCode.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createCase({
        referenceCode: referenceCode.trim(),
        status,
        summary: summary.trim() || undefined,
      })
      setReferenceCode('')
      setSummary('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function onStatusChange(id: string, next: string) {
    setUpdatingId(id)
    setError(null)
    try {
      await updateCaseStatus(id, next)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl font-bold text-white">Caseload inventory</h2>
        <p className="mt-1 text-sm text-slate-400">Open cases and update status as programs progress.</p>
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
        <p className="text-sm font-medium text-slate-300">New case</p>
        <label className="block text-xs text-slate-500">
          Reference code
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="EH-2026-####"
            value={referenceCode}
            onChange={(e) => setReferenceCode(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs text-slate-500">
          Status
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white sm:max-w-xs"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-500">
          Summary (optional)
          <textarea
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Add case'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/90 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Opened</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Summary</th>
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
                  No cases yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-900/80">
                  <td className="px-4 py-3 font-medium text-white">{r.referenceCode}</td>
                  <td className="px-4 py-3 text-slate-300">{r.opened}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                      value={r.status}
                      disabled={updatingId === r.id}
                      onChange={(e) => void onStatusChange(r.id, e.target.value)}
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-400" title={r.summary ?? ''}>
                    {r.summary ?? '—'}
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
