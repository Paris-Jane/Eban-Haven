import { useEffect, useState } from 'react'
import { getReportsSummary, type ReportsSummary } from '../../api/admin'

export function ReportsPage() {
  const [data, setData] = useState<ReportsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await getReportsSummary()
        if (!cancelled) {
          setData(d)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load reports')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <p className="text-slate-400">Loading reports…</p>
  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-red-200">
        {error ?? 'No data'}
      </div>
    )
  }

  const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
    data.totalContributions,
  )

  const maxBar = Math.max(data.totalCases, 1)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl font-bold text-white">Reports & analytics</h2>
        <p className="mt-1 text-sm text-slate-400">
          High-level aggregates from the in-memory demo dataset.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <p className="text-xs uppercase text-slate-500">Total cases</p>
          <p className="mt-2 font-serif text-3xl font-bold text-white">{data.totalCases}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <p className="text-xs uppercase text-slate-500">Contributions (logged)</p>
          <p className="mt-2 font-serif text-3xl font-bold text-teal-300">{money}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <p className="text-xs uppercase text-slate-500">Process recordings</p>
          <p className="mt-2 font-serif text-3xl font-bold text-white">
            {data.processRecordingsCount}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
        <h3 className="text-sm font-medium text-slate-300">Cases by phase</h3>
        <div className="mt-6 space-y-4">
          {[
            { label: 'Active', value: data.activeCases, color: 'bg-teal-500' },
            { label: 'Reintegration', value: data.reintegrationCases, color: 'bg-amber-500' },
            {
              label: 'Other / closed',
              value: Math.max(0, data.totalCases - data.activeCases - data.reintegrationCases),
              color: 'bg-slate-600',
            },
          ].map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>{row.label}</span>
                <span>{row.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${row.color}`}
                  style={{ width: `${(row.value / maxBar) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
