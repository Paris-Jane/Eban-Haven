import { useCallback, useEffect, useState, type FormEvent } from 'react'
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
  sectionFormTitle,
  tableBody,
  tableHead,
  tableRowHover,
  tableWrap,
} from './adminStyles'
import { createResident, getResidents, getSafehouses, type ResidentSummary, type SafehouseOption } from '../../api/admin'

const statusOptions = ['Active', 'Closed', 'Transferred', ''] as const

export function ResidentsPage() {
  const [rows, setRows] = useState<ResidentSummary[]>([])
  const [safehouses, setSafehouses] = useState<SafehouseOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSh, setFilterSh] = useState<number | ''>('')
  const [filterCat, setFilterCat] = useState('')
  const [search, setSearch] = useState('')
  const [searchApplied, setSearchApplied] = useState('')

  const [newCode, setNewCode] = useState('')
  const [newStatus, setNewStatus] = useState('Active')
  const [newCat, setNewCat] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, sh] = await Promise.all([
        getResidents({
          status: filterStatus || undefined,
          safehouseId: filterSh === '' ? undefined : filterSh,
          category: filterCat || undefined,
          q: searchApplied || undefined,
        }),
        getSafehouses(),
      ])
      setRows(r)
      setSafehouses(sh)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterSh, filterCat, searchApplied])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!newCode.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createResident({
        internalCode: newCode.trim(),
        caseStatus: newStatus,
        caseCategory: newCat.trim() || undefined,
      })
      setNewCode('')
      setNewCat('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Residents</h2>
        <p className={pageDesc}>
          Search and filter by case status, safehouse, category, or internal / control / social worker text. Open a
          resident to view and edit the full case file, related visits, education, health, incidents, and plans.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <div className={`${card} flex flex-wrap items-end gap-3`}>
        <label className={label}>
          Case status
          <select
            className={`${input} w-40`}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All</option>
            {statusOptions.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Safehouse
          <select
            className={`${input} min-w-[10rem]`}
            value={filterSh === '' ? '' : String(filterSh)}
            onChange={(e) => setFilterSh(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">All</option>
            {safehouses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Category contains
          <input
            className={`${input} w-44`}
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            placeholder="e.g. Trafficked"
          />
        </label>
        <label className={label}>
          Search
          <input
            className={`${input} w-48`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Code, SW, control no…"
          />
        </label>
        <button type="button" className={btnPrimary} onClick={() => setSearchApplied(search)}>
          Apply filters
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Add resident</h3>
      </div>
      <form onSubmit={onCreate} className={`${card} grid max-w-xl gap-3 sm:grid-cols-2`}>
        <p className={`${sectionFormTitle} sm:col-span-2`}>Minimal intake (edit full profile on the resident page)</p>
        <label className={`${label} sm:col-span-2`}>
          Internal code *
          <input className={input} value={newCode} onChange={(e) => setNewCode(e.target.value)} required />
        </label>
        <label className={label}>
          Status
          <select className={input} value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
            <option value="Active">Active</option>
            <option value="Closed">Closed</option>
            <option value="Transferred">Transferred</option>
          </select>
        </label>
        <label className={label}>
          Case category
          <input className={input} value={newCat} onChange={(e) => setNewCat(e.target.value)} />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Saving…' : 'Add resident'}
          </button>
        </div>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Directory</h3>
        <div className={tableWrap}>
          <table className="w-full text-left text-sm">
            <thead className={tableHead}>
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">House</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className={tableBody}>
              {loading ? (
                <tr>
                  <td colSpan={5} className={emptyCell}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className={emptyCell}>
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className={tableRowHover}>
                    <td className="px-3 py-2 font-medium">{r.internalCode}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.caseStatus}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.caseCategory}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.safehouseName ?? r.safehouseId}</td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={`/admin/residents/${r.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
