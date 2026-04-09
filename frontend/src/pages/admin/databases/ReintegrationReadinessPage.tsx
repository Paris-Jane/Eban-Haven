import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { getReintegrationReadinessCohort, type ResidentSummary } from '../../../api/admin'
import {
  deriveReadinessPrediction,
  deriveReadinessTier,
  formatFeatureValue,
  type ReintegrationResult,
  TIER_CONFIG,
  topImprovementLabel,
} from '../../../components/ml/reintegrationReadinessShared'
import {
  alertError,
  btnPrimary,
  card,
  emptyCell,
  input,
  label,
  pageDesc,
  pageTitle,
  statCardInner,
  statCardSub,
  statCardValue,
  tableBody,
  tableHead,
  tableRowHover,
  tableWrap,
} from '../shared/adminStyles'

type TierFilter = 'all' | ReintegrationResult['risk_tier']

type CohortResident = ResidentSummary & {
  readiness: ReintegrationResult
}

function CohortOverviewCard({
  counts,
  total,
  activeTier,
  onSelectTier,
}: {
  counts: Record<ReintegrationResult['risk_tier'], number>
  total: number
  activeTier: TierFilter
  onSelectTier: (tier: TierFilter) => void
}) {
  const segments: ReintegrationResult['risk_tier'][] = ['High Readiness', 'Moderate Readiness', 'Low Readiness']
  return (
    <div className={`${card} space-y-4`}>
      <div>
        <h3 className="text-base font-semibold text-foreground">Cohort Overview</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Current readiness mix across residents with a live prediction score. Click a card to filter the worklist.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <button
          type="button"
          onClick={() => onSelectTier('all')}
          className={`rounded-xl border px-4 py-4 text-left transition ${
            activeTier === 'all' ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-border hover:bg-muted/40'
          }`}
        >
          <p className={statCardInner}>All scored</p>
          <p className={statCardValue}>{total}</p>
          <p className={statCardSub}>Reset tier filter</p>
        </button>
        {segments.map((tier) => {
          const percent = total > 0 ? Math.round((counts[tier] / total) * 100) : 0
          const tone =
            tier === 'High Readiness'
              ? 'text-emerald-700'
              : tier === 'Moderate Readiness'
                ? 'text-amber-700'
                : 'text-red-700'

          return (
            <button
              key={tier}
              type="button"
              onClick={() => onSelectTier(activeTier === tier ? 'all' : tier)}
              className={`rounded-xl border px-4 py-4 text-left transition ${TIER_CONFIG[tier].border} ${TIER_CONFIG[tier].bg} ${
                activeTier === tier ? 'ring-2 ring-primary/20' : 'hover:brightness-[0.99]'
              }`}
            >
              <p className={statCardInner}>{tier}</p>
              <p className={statCardValue}>{counts[tier]}</p>
              <p className={`${statCardSub} ${tone}`}>{percent}% of scored residents</p>
            </button>
          )
        })}
      </div>
      <div className="flex h-4 overflow-hidden rounded-full bg-muted">
        {segments.map((tier) => {
          const width = total > 0 ? (counts[tier] / total) * 100 : 0
          return <div key={tier} className={`h-full ${TIER_CONFIG[tier].bar}`} style={{ width: `${width}%` }} />
        })}
      </div>
      <p className="text-xs text-muted-foreground">{total} residents currently scored.</p>
    </div>
  )
}

export function ReintegrationReadinessPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<CohortResident[]>([])
  const [safehouseFilter, setSafehouseFilter] = useState('all')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [workerFilter, setWorkerFilter] = useState('all')
  const [rankingOrder, setRankingOrder] = useState<'desc' | 'asc'>('desc')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [partialError, setPartialError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setPartialError(null)

    try {
      const response = await getReintegrationReadinessCohort(controller.signal)
      if (controller.signal.aborted) return

      setRows(response.residents)
      setLastUpdated(new Date())

      if (response.failed_count > 0) {
        setPartialError(
          `Loaded ${response.residents.length} residents, but ${response.failed_count} readiness prediction${response.failed_count === 1 ? '' : 's'} failed.`,
        )
      }
    } catch (loadError) {
      if (!controller.signal.aborted) {
        setRows([])
        setError(loadError instanceof Error ? loadError.message : 'Failed to load reintegration readiness data.')
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void load()
    return () => abortRef.current?.abort()
  }, [load])

  const safehouseOptions = useMemo(
    () => ['all', ...Array.from(new Set(rows.map((row) => row.safehouseName).filter((value): value is string => Boolean(value)))).sort()],
    [rows],
  )

  const workerOptions = useMemo(
    () => ['all', ...Array.from(new Set(rows.map((row) => row.assignedSocialWorker).filter((value): value is string => Boolean(value)))).sort()],
    [rows],
  )

  const baseFilteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (safehouseFilter !== 'all' && (row.safehouseName ?? '') !== safehouseFilter) return false
      if (workerFilter !== 'all' && (row.assignedSocialWorker ?? '') !== workerFilter) return false
      if (search.trim()) {
        const haystack = `${row.internalCode} ${row.safehouseName ?? ''} ${row.assignedSocialWorker ?? ''} ${topImprovementLabel(row.readiness)}`.toLowerCase()
        if (!haystack.includes(search.trim().toLowerCase())) return false
      }
      return true
    })
  }, [rows, safehouseFilter, workerFilter, search])

  const filteredRows = useMemo(() => {
    if (tierFilter === 'all') return baseFilteredRows
    return baseFilteredRows.filter((row) => deriveReadinessTier(row.readiness.reintegration_probability) === tierFilter)
  }, [baseFilteredRows, tierFilter])

  const rankingsRows = useMemo(() => {
    return [...filteredRows].sort((a, b) =>
      rankingOrder === 'desc'
        ? b.readiness.reintegration_probability - a.readiness.reintegration_probability
        : a.readiness.reintegration_probability - b.readiness.reintegration_probability,
    )
  }, [filteredRows, rankingOrder])

  const tierCounts = useMemo(() => {
    return baseFilteredRows.reduce<Record<ReintegrationResult['risk_tier'], number>>(
      (counts, row) => {
        counts[deriveReadinessTier(row.readiness.reintegration_probability)] += 1
        return counts
      },
      {
        'High Readiness': 0,
        'Moderate Readiness': 0,
        'Low Readiness': 0,
      },
    )
  }, [baseFilteredRows])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={pageTitle}>Reintigration Readiness</h2>
          <p className={pageDesc}>
            Population view of resident readiness predictions using the 70% / 50% cohort thresholds for quick triage and transition planning.
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={() => void load()}>
          Refresh readiness
        </button>
      </div>

      {error && <div className={alertError}>{error}</div>}
      {partialError && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">{partialError}</div>}

      {loading ? (
        <div className="space-y-6">
          <div className={`${card} animate-pulse space-y-4`}>
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 rounded-xl bg-muted" />
              ))}
            </div>
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-3 w-36 rounded bg-muted" />
          </div>
          <div className={`${card} animate-pulse space-y-4`}>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-3 w-64 rounded bg-muted" />
              </div>
              <div className="h-6 w-24 rounded bg-muted" />
            </div>
            <div className="h-48 rounded-xl bg-muted" />
          </div>
        </div>
      ) : (
        <>
          <CohortOverviewCard
            counts={tierCounts}
            total={baseFilteredRows.length}
            activeTier={tierFilter}
            onSelectTier={setTierFilter}
          />

          <div className={`${card} grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]`}>
            <label className={label}>
              Search
              <input
                className={input}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Resident code, worker, gap area…"
              />
            </label>
            <label className={label}>
              Safehouse
              <select className={input} value={safehouseFilter} onChange={(event) => setSafehouseFilter(event.target.value)}>
                {safehouseOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All safehouses' : option}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Risk tier
              <select className={input} value={tierFilter} onChange={(event) => setTierFilter(event.target.value as TierFilter)}>
                <option value="all">All tiers</option>
                <option value="High Readiness">High Readiness</option>
                <option value="Moderate Readiness">Moderate Readiness</option>
                <option value="Low Readiness">Low Readiness</option>
              </select>
            </label>
            <label className={label}>
              Assigned worker
              <select className={input} value={workerFilter} onChange={(event) => setWorkerFilter(event.target.value)}>
                {workerOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All workers' : option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-foreground">Readiness Rankings</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Click any resident to open a full action-plan page with blocker-specific tools and on-page workflows.
                </p>
              </div>
              {lastUpdated && <p className="text-xs text-muted-foreground">Updated {lastUpdated.toLocaleTimeString()}</p>}
            </div>

            <div className={tableWrap}>
              <table className="w-full text-left text-sm">
                <thead className={tableHead}>
                  <tr>
                    <th className="px-3 py-2">Resident</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span>Tier</span>
                        <button
                          type="button"
                          onClick={() => setRankingOrder((current) => (current === 'desc' ? 'asc' : 'desc'))}
                          className="inline-flex items-center rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium normal-case tracking-normal text-foreground transition-colors hover:bg-muted"
                          title={rankingOrder === 'desc' ? 'Switch to lowest readiness first' : 'Switch to highest readiness first'}
                          aria-label={rankingOrder === 'desc' ? 'Switch to lowest readiness first' : 'Switch to highest readiness first'}
                        >
                          <ArrowUpDown className="mr-1 h-3.5 w-3.5" />
                          {rankingOrder === 'desc' ? 'Desc' : 'Asc'}
                        </button>
                      </div>
                    </th>
                    <th className="px-3 py-2">Prediction</th>
                    <th className="px-3 py-2">Top improvement area</th>
                  </tr>
                </thead>
                <tbody className={tableBody}>
                  {rankingsRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={emptyCell}>
                        No residents matched the current readiness filters.
                      </td>
                    </tr>
                  ) : (
                    rankingsRows.map((row) => {
                      const tier = deriveReadinessTier(row.readiness.reintegration_probability)
                      const prediction = deriveReadinessPrediction(row.readiness.reintegration_probability)
                      const tierConfig = TIER_CONFIG[tier]
                      const topArea = row.readiness.top_improvements[0]
                      return (
                        <tr
                          key={row.id}
                          className={`${tableRowHover} cursor-pointer`}
                          onClick={() => navigate(`/admin/reintigration-readiness/${row.id}`)}
                        >
                          <td className="px-3 py-3 align-top">
                            <button
                              type="button"
                              className="font-medium text-primary hover:underline"
                              onClick={(event) => {
                                event.stopPropagation()
                                navigate(`/admin/reintigration-readiness/${row.id}`)
                              }}
                            >
                              {row.internalCode}
                            </button>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {row.safehouseName ?? 'No safehouse'} · {row.assignedSocialWorker ?? 'No assigned worker'}
                            </p>
                          </td>
                          <td className="px-3 py-3 align-top font-semibold text-foreground">
                            {Math.round(row.readiness.reintegration_probability * 100)}%
                          </td>
                          <td className="px-3 py-3 align-top">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${tierConfig.badge}`}>
                              {tier}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-top text-foreground">{prediction}</td>
                          <td className="px-3 py-3 align-top">
                            {topArea ? (
                              <div>
                                <p className="font-medium text-foreground">{topArea.label}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {formatFeatureValue(topArea.feature, topArea.resident_value)} vs benchmark{' '}
                                  {formatFeatureValue(topArea.feature, topArea.benchmark_value)}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Maintain current support plan</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <h3 className="text-base font-semibold text-foreground">Resident case workspace</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Need the full case file instead of the action-plan workflow? Open the resident record directly.
              </p>
            </div>
            <Link to="/admin/residents" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
              Open residents database
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
