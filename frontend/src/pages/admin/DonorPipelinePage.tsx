import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GitBranch } from 'lucide-react'
import { getSupporters, type Supporter } from '../../api/admin'
import { alertError, btnPrimary, card, input, label, pageDesc, pageTitle } from './adminStyles'

type Stage = 'prospect' | 'donor' | 'inactive'

function pipelineStage(s: Supporter): Stage {
  const st = (s.status ?? '').toLowerCase()
  if (st === 'inactive' || st === 'lapsed' || st === 'paused') return 'inactive'
  if (s.firstDonationDate && String(s.firstDonationDate).trim() !== '') return 'donor'
  return 'prospect'
}

const stages: { id: Stage; title: string; description: string }[] = [
  {
    id: 'prospect',
    title: 'Prospects',
    description: 'Active supporters with no first gift on file — cultivate and convert.',
  },
  {
    id: 'donor',
    title: 'Active donors',
    description: 'At least one recorded gift; steward and deepen engagement.',
  },
  {
    id: 'inactive',
    title: 'Inactive / paused',
    description: 'Lapsed or paused relationships — re-engage when appropriate.',
  },
]

export function DonorPipelinePage() {
  const [rows, setRows] = useState<Supporter[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await getSupporters()
      setRows(r)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load supporters')
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
    return rows.filter((s) => {
      const hay = `${s.displayName} ${s.email ?? ''} ${s.organizationName ?? ''} ${s.region ?? ''} ${s.acquisitionChannel ?? ''} ${s.supporterType}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [rows, needle])

  const byStage = useMemo(() => {
    const m: Record<Stage, Supporter[]> = { prospect: [], donor: [], inactive: [] }
    for (const s of filtered) {
      m[pipelineStage(s)].push(s)
    }
    for (const k of Object.keys(m) as Stage[]) {
      m[k].sort((a, b) => a.displayName.localeCompare(b.displayName))
    }
    return m
  }, [filtered])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className={`${pageTitle} flex items-center gap-2`}>
            <GitBranch className="h-7 w-7 text-primary" />
            Donor pipeline
          </h2>
          <p className={pageDesc}>
            Move supporters from prospect to active donor using your dataset (status + first gift date). Open a card
            to edit profile, log gifts, and view history on the donor page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/donors" className={btnPrimary}>
            Donor directory
          </Link>
          <Link
            to="/admin/contributions"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            Contributions
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
            placeholder="Name, email, channel, type…"
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
                <p className="mt-2 text-xs font-medium text-primary">{byStage[col.id].length} people</p>
              </div>
              <ul className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                {byStage[col.id].length === 0 ? (
                  <li className="py-6 text-center text-xs text-muted-foreground">No one in this stage.</li>
                ) : (
                  byStage[col.id].map((s) => (
                    <li key={s.id}>
                      <Link
                        to={`/admin/donors/${s.id}`}
                        className="block rounded-lg border border-border bg-card p-3 text-sm shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
                      >
                        <span className="font-medium text-foreground">{s.displayName}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{s.supporterType}</span>
                        {s.email && <span className="mt-1 block truncate text-xs text-muted-foreground">{s.email}</span>}
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
