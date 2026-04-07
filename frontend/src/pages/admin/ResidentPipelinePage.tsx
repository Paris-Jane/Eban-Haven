import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Waypoints } from 'lucide-react'
import { getResidents, type ResidentSummary } from '../../api/admin'
import { alertError, btnPrimary, card, input, label, pageDesc, pageTitle } from './adminStyles'

type Stage = 'inProgram' | 'reintegration' | 'exited'

/**
 * Maps case + reintegration fields into pipeline columns (aligned with Lighthouse resident CSV).
 */
function pipelineStage(r: ResidentSummary): Stage {
  const cs = (r.caseStatus ?? '').trim().toLowerCase()
  const rs = (r.reintegrationStatus ?? '').trim().toLowerCase()

  if (cs === 'closed' || cs === 'transferred') return 'exited'
  if (rs.includes('completed')) return 'exited'
  if (rs.includes('in progress')) return 'reintegration'
  return 'inProgram'
}

const stages: { id: Stage; title: string; description: string }[] = [
  {
    id: 'inProgram',
    title: 'In program',
    description: 'Active cases focused on care, assessment, and stabilization (reintegration not yet in motion or on hold / not started).',
  },
  {
    id: 'reintegration',
    title: 'Reintegration in progress',
    description: 'Active cases with reintegration actively underway — home visits, family work, and discharge planning.',
  },
  {
    id: 'exited',
    title: 'Exited / completed',
    description: 'Closed or transferred files, or reintegration marked completed.',
  },
]

export function ResidentPipelinePage() {
  const [rows, setRows] = useState<ResidentSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await getResidents({})
      setRows(r)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load residents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const needle = q.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!needle) return rows
    return rows.filter((r) => {
      const hay = `${r.internalCode} ${r.caseControlNo} ${r.caseCategory} ${r.caseStatus} ${r.safehouseName ?? ''} ${r.assignedSocialWorker ?? ''} ${r.reintegrationStatus ?? ''} ${r.reintegrationType ?? ''}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [rows, needle])

  const byStage = useMemo(() => {
    const m: Record<Stage, ResidentSummary[]> = { inProgram: [], reintegration: [], exited: [] }
    for (const r of filtered) {
      m[pipelineStage(r)].push(r)
    }
    for (const k of Object.keys(m) as Stage[]) {
      m[k].sort((a, b) => a.internalCode.localeCompare(b.internalCode))
    }
    return m
  }, [filtered])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className={`${pageTitle} flex items-center gap-2`}>
            <Waypoints className="h-7 w-7 text-primary" />
            Resident pipeline
          </h2>
          <p className={pageDesc}>
            Board view by case and reintegration status. Open a card for the full resident record, visits, process
            notes, and plans.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/residents" className={btnPrimary}>
            Resident directory
          </Link>
          <Link
            to="/admin/home-visitations"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            Home visitations
          </Link>
          <Link
            to="/admin/case-conferences"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            Case conferences
          </Link>
        </div>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <div className={`${card} max-w-md`}>
        <label className={label}>
          Search pipeline
          <input
            className={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Code, category, SW, safehouse…"
          />
        </label>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading pipeline…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {stages.map((col) => (
            <div key={col.id} className="flex min-h-[12rem] flex-col rounded-xl border border-border bg-muted/20">
              <div className="border-b border-border bg-card px-4 py-3">
                <h3 className="font-heading text-sm font-semibold text-foreground">{col.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{col.description}</p>
                <p className="mt-2 text-xs font-medium text-primary">{byStage[col.id].length} residents</p>
              </div>
              <ul className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                {byStage[col.id].length === 0 ? (
                  <li className="py-6 text-center text-xs text-muted-foreground">No one in this stage.</li>
                ) : (
                  byStage[col.id].map((r) => (
                    <li key={r.id}>
                      <Link
                        to={`/admin/residents/${r.id}`}
                        className="block rounded-lg border border-border bg-card p-3 text-sm shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
                      >
                        <span className="font-medium text-foreground">{r.internalCode}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{r.caseCategory}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {r.caseStatus}
                          {r.reintegrationStatus ? ` · ${r.reintegrationStatus}` : ''}
                        </span>
                        {r.safehouseName && (
                          <span className="mt-1 block truncate text-xs text-muted-foreground">{r.safehouseName}</span>
                        )}
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
