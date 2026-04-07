import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  alertError,
  btnPrimary,
  card,
  emptyCell,
  input,
  label,
  pageDesc,
  pageTitle,
  tableBody,
  tableHead,
  tableRowHover,
  tableWrap,
} from './adminStyles'
import { getInterventionPlans, getResidents, type InterventionPlan, type ResidentSummary } from '../../api/admin'

export function CaseConferencesAdminPage() {
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [filterRes, setFilterRes] = useState<number>(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [q, setQ] = useState('')
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUpcoming, setShowUpcoming] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getResidents({})
      setResidents(res)
      const rid = filterRes || undefined
      const p = await getInterventionPlans(rid)
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

  const statusOptions = [...new Set(plans.map((p) => p.status).filter(Boolean))].sort()

  const needle = q.trim().toLowerCase()
  const filtered = plans.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false
    if (needle) {
      const hay = `${p.residentInternalCode} ${p.planCategory} ${p.planDescription} ${p.servicesProvided ?? ''} ${p.status}`.toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })

  const upcomingPlans = [...plans]
    .filter((p) => p.caseConferenceDate)
    .sort((a, b) => (a.caseConferenceDate ?? '').localeCompare(b.caseConferenceDate ?? ''))
    .slice(0, 40)

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Case conferences</h2>
        <p className={pageDesc}>
          Intervention plans and scheduled case conference dates. Filter and search; open a resident from the table.
          New plans are added from each resident&apos;s profile when that workflow is available.
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
          Status
          <select className={input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Search
          <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Category, services…" />
        </label>
      </div>

      <div>
        <button type="button" className={btnPrimary} onClick={() => setShowUpcoming((s) => !s)}>
          {showUpcoming ? 'Hide upcoming conferences' : 'Show upcoming / recent conferences'}
        </button>
      </div>

      {showUpcoming && (
        <div className={card}>
          <h3 className="text-sm font-semibold text-foreground">Upcoming / recent case conferences</h3>
          <p className="mt-1 text-xs text-muted-foreground">From intervention plans with a scheduled conference date.</p>
          <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto text-sm">
            {upcomingPlans.length === 0 ? (
              <li className="text-muted-foreground">No plans with conference dates in current filter.</li>
            ) : (
              upcomingPlans.map((p) => (
                <li key={p.id} className="border-b border-border/60 pb-2">
                  <Link className="font-medium text-primary hover:underline" to={`/admin/residents/${p.residentId}`}>
                    {p.residentInternalCode}
                  </Link>
                  <span className="text-foreground"> · {p.planCategory}</span>
                  <span className="ml-2 text-muted-foreground">
                    {p.caseConferenceDate ? new Date(p.caseConferenceDate).toLocaleDateString() : '—'} · {p.status}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

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
            {loading ? (
              <tr>
                <td colSpan={5} className={emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className={emptyCell}>
                  No plans match.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className={tableRowHover}>
                  <td className="px-4 py-3 font-medium">
                    <Link className="text-primary hover:underline" to={`/admin/residents/${p.residentId}`}>
                      {p.residentInternalCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{p.planCategory}</td>
                  <td className="px-4 py-3">{p.status}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.caseConferenceDate ? new Date(p.caseConferenceDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted-foreground" title={p.servicesProvided ?? ''}>
                    {p.servicesProvided ?? '—'}
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
