import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createDonor, getDonors, type Donor } from '../../api/admin'

export function DonorsPage() {
  const [rows, setRows] = useState<Donor[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [donorName, setDonorName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getDonors())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load donors')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const amt = Number.parseFloat(amount)
    if (!donorName.trim() || Number.isNaN(amt) || amt < 0) return
    setSaving(true)
    setError(null)
    try {
      await createDonor({
        donorName: donorName.trim(),
        amount: amt,
        date,
        note: note.trim() || undefined,
      })
      setDonorName('')
      setAmount('')
      setNote('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl font-bold text-white">Donors & Contributions</h2>
        <p className="mt-1 text-sm text-slate-400">Log gifts and pledges (demo store resets on API restart).</p>
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
        <p className="text-sm font-medium text-slate-300">Add contribution</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-500">
            Donor name
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs text-slate-500">
            Amount (USD)
            <input
              type="number"
              step="0.01"
              min={0}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
        </div>
        <label className="block text-xs text-slate-500">
          Date
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white sm:max-w-xs"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="block text-xs text-slate-500">
          Note (optional)
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Add contribution'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/90 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Donor</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Note</th>
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
                  No contributions yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-900/80">
                  <td className="px-4 py-3 text-slate-300">{r.date}</td>
                  <td className="px-4 py-3 text-white">{r.donorName}</td>
                  <td className="px-4 py-3 text-teal-300">{fmt.format(r.amount)}</td>
                  <td className="px-4 py-3 text-slate-400">{r.note ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
