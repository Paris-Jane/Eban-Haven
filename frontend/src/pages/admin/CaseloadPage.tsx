import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ReintegrationReadiness } from '../../components/ml/ReintegrationReadiness'
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
import {
  createResident,
  getResident,
  getResidents,
  getSafehouses,
  patchResident,
  type ResidentDetail,
  type ResidentSummary,
  type SafehouseOption,
} from '../../api/admin'

const statusOptions = ['Active', 'Closed', 'Transferred', ''] as const

export function CaseloadPage() {
  const [rows, setRows] = useState<ResidentSummary[]>([])
  const [safehouses, setSafehouses] = useState<SafehouseOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSh, setFilterSh] = useState<number | ''>('')
  const [filterCat, setFilterCat] = useState('')
  const [search, setSearch] = useState('')
  const [searchApplied, setSearchApplied] = useState('')

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ResidentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [newCode, setNewCode] = useState('')
  const [newStatus, setNewStatus] = useState('Active')
  const [newCat, setNewCat] = useState('')
  const [saving, setSaving] = useState(false)

  const [patchStatus, setPatchStatus] = useState('')
  const [patchSw, setPatchSw] = useState('')

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

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    void getResident(selectedId)
      .then((d) => {
        if (!cancelled) {
          setDetail(d)
          setPatchStatus(d.fields.case_status ?? '')
          setPatchSw(d.fields.assigned_social_worker ?? '')
        }
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

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

  async function onPatch(e: FormEvent) {
    e.preventDefault()
    if (selectedId == null) return
    setError(null)
    try {
      await patchResident(selectedId, {
        case_status: patchStatus || null,
        assigned_social_worker: patchSw || null,
      })
      await load()
      const d = await getResident(selectedId)
      setDetail(d)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Caseload inventory</h2>
        <p className={pageDesc}>
          Resident records aligned with Philippine social welfare case structure: demographics, case category and
          sub-categories, disability and family socio-demographic flags, admission and referral, assigned social
          workers, and reintegration. Filter by status, safehouse, category, or search internal / control numbers.
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
            placeholder="e.g. Neglected"
          />
        </label>
        <label className={label}>
          Search
          <input
            className={`${input} w-48`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Code, SW…"
          />
        </label>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            setSearchApplied(search)
          }}
        >
          Apply filters
        </button>
      </div>

      <form onSubmit={onCreate} className={`${card} space-y-4 max-w-xl`}>
        <p className={sectionFormTitle}>New resident (minimal intake)</p>
        <label className={label}>
          Internal code
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
          Case category (optional)
          <input className={input} value={newCat} onChange={(e) => setNewCat(e.target.value)} />
        </label>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? 'Saving…' : 'Add resident'}
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Residents</h3>
          <div className={tableWrap}>
            <table className="w-full text-left text-sm">
              <thead className={tableHead}>
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">House</th>
                </tr>
              </thead>
              <tbody className={tableBody}>
                {loading ? (
                  <tr>
                    <td colSpan={3} className={emptyCell}>
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={emptyCell}>
                      No rows match filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className={`${tableRowHover} cursor-pointer ${selectedId === r.id ? 'bg-primary/5' : ''}`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <td className="px-3 py-2 font-medium">{r.internalCode}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.caseStatus}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.safehouseName ?? r.safehouseId}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="lg:col-span-3">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Case file</h3>
          {selectedId == null ? (
            <p className="text-sm text-muted-foreground">Select a resident to view the full case record.</p>
          ) : detailLoading ? (
            <p className="text-sm text-muted-foreground">Loading record…</p>
          ) : detail ? (
            <div className="space-y-4">
              {/* ── ML: Reintegration Readiness ── */}
              <ReintegrationReadiness residentId={selectedId} />

              <form onSubmit={onPatch} className={`${card} space-y-3`}>
                <p className="text-sm font-medium text-foreground">Quick update</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>
                    Case status
                    <input className={input} value={patchStatus} onChange={(e) => setPatchStatus(e.target.value)} />
                  </label>
                  <label className={label}>
                    Assigned social worker
                    <input className={input} value={patchSw} onChange={(e) => setPatchSw(e.target.value)} />
                  </label>
                </div>
                <button type="submit" className={btnPrimary}>
                  Save updates
                </button>
              </form>
              <div className={`${card} max-h-[480px] overflow-auto`}>
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  All CSV fields (staff view)
                </p>
                <dl className="grid gap-2 text-xs sm:grid-cols-2">
                  {Object.entries(detail.fields)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([k, v]) => (
                      <div key={k} className="border-b border-border/50 pb-1">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="font-mono text-foreground break-all">{v || '—'}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive">Could not load resident.</p>
          )}
        </div>
      </div>
    </div>
  )
}
