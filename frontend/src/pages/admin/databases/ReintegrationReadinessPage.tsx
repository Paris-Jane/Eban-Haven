import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getReintegrationReadinessCohort, type ResidentSummary } from '../../../api/admin'
import {
  deriveReadinessPrediction,
  deriveReadinessTier,
  formatFeatureValue,
  READINESS_READY_THRESHOLD,
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

function ReadinessTierCard({
  label,
  count,
  total,
  tone,
}: {
  label: string
  count: number
  total: number
  tone: string
}) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className={`${card} space-y-2`}>
      <p className={statCardInner}>{label}</p>
      <p className={statCardValue}>{count}</p>
      <p className={`${statCardSub} ${tone}`}>{percent}% of scored residents</p>
    </div>
  )
}

function ReadinessDistributionBar({
  counts,
  total,
}: {
  counts: Record<ReintegrationResult['risk_tier'], number>
  total: number
}) {
  const segments: ReintegrationResult['risk_tier'][] = ['High Readiness', 'Moderate Readiness', 'Low Readiness']
  return (
    <div className={`${card} space-y-4`}>
      <div>
        <h3 className="text-base font-semibold text-foreground">Cohort distribution</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Snapshot across residents with a current readiness prediction.
        </p>
      </div>
      <div className="flex h-4 overflow-hidden rounded-full bg-muted">
        {segments.map((tier) => {
          const width = total > 0 ? (counts[tier] / total) * 100 : 0
          return <div key={tier} className={`h-full ${TIER_CONFIG[tier].bar}`} style={{ width: `${width}%` }} />
        })}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {segments.map((tier) => (
          <div key={tier} className={`rounded-xl border px-4 py-3 ${TIER_CONFIG[tier].border} ${TIER_CONFIG[tier].bg}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${TIER_CONFIG[tier].text}`}>{tier}</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{counts[tier]}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PriorityCard({
  title,
  emptyMessage,
  residents,
}: {
  title: string
  emptyMessage: string
  residents: CohortResident[]
}) {
  return (
    <div className={`${card} space-y-4`}>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Quick shortlist for case review and planning.</p>
      </div>
      {residents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {residents.map((resident) => {
            const readinessPct = Math.round(resident.readiness.reintegration_probability * 100)
            const tier = deriveReadinessTier(resident.readiness.reintegration_probability)
            const prediction = deriveReadinessPrediction(resident.readiness.reintegration_probability)
            const tierConfig = TIER_CONFIG[tier]
            const topArea = resident.readiness.top_improvements[0]
            return (
              <div key={resident.id} className="rounded-xl border border-border bg-background px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link to={`/admin/residents/${resident.id}`} className="font-medium text-primary hover:underline">
                      {resident.internalCode}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {resident.safehouseName ?? 'No safehouse'} · {resident.assignedSocialWorker ?? 'No assigned worker'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">{readinessPct}%</p>
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${tierConfig.badge}`}>
                      {prediction}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm text-foreground">
                  {topArea ? (
                    <>
                      <span className="font-medium">{topArea.label}:</span> {formatFeatureValue(topArea.feature, topArea.resident_value)} vs{' '}
                      {formatFeatureValue(topArea.feature, topArea.benchmark_value)}
                    </>
                  ) : (
                    'No immediate improvement gaps surfaced by the current model run.'
                  )}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ReintegrationReadinessPage() {
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

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => {
        if (safehouseFilter !== 'all' && (row.safehouseName ?? '') !== safehouseFilter) return false
        if (tierFilter !== 'all' && deriveReadinessTier(row.readiness.reintegration_probability) !== tierFilter) return false
        if (workerFilter !== 'all' && (row.assignedSocialWorker ?? '') !== workerFilter) return false
        if (search.trim()) {
          const haystack = `${row.internalCode} ${row.safehouseName ?? ''} ${row.assignedSocialWorker ?? ''} ${topImprovementLabel(row.readiness)}`.toLowerCase()
          if (!haystack.includes(search.trim().toLowerCase())) return false
        }
        return true
      })
  }, [rows, safehouseFilter, tierFilter, workerFilter, search])

  const rankingsRows = useMemo(() => {
    return [...filteredRows].sort((a, b) =>
      rankingOrder === 'desc'
        ? b.readiness.reintegration_probability - a.readiness.reintegration_probability
        : a.readiness.reintegration_probability - b.readiness.reintegration_probability,
    )
  }, [filteredRows, rankingOrder])

  const tierCounts = useMemo(() => {
    return filteredRows.reduce<Record<ReintegrationResult['risk_tier'], number>>(
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
  }, [filteredRows])

  const readyToTransition = useMemo(
    () =>
      filteredRows
        .filter(
          (row) => deriveReadinessPrediction(row.readiness.reintegration_probability) === 'Ready',
        )
        .sort((a, b) => b.readiness.reintegration_probability - a.readiness.reintegration_probability)
        .slice(0, 5),
    [filteredRows],
  )

  const needsAttention = useMemo(
    () =>
      filteredRows
        .filter((row) => deriveReadinessTier(row.readiness.reintegration_probability) === 'Low Readiness')
        .sort((a, b) => a.readiness.reintegration_probability - b.readiness.reintegration_probability)
        .slice(0, 5),
    [filteredRows],
  )

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

      <div className={`${card} grid gap-4 lg:grid-cols-4`}>
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
        <label className={label}>
          Search
          <input
            className={input}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Resident code, worker, gap area…"
          />
        </label>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className={`${card} animate-pulse space-y-3`}>
                <div className="h-4 w-28 rounded bg-muted" />
                <div className="h-8 w-20 rounded bg-muted" />
                <div className="h-3 w-36 rounded bg-muted" />
              </div>
            ))}
          </div>
          <div className={`${card} animate-pulse space-y-4`}>
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 rounded-xl bg-muted" />
              ))}
            </div>
          </div>
          <div className={`${card} animate-pulse space-y-4`}>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-3 w-64 rounded bg-muted" />
              </div>
              <div className="h-10 w-44 rounded bg-muted" />
            </div>
            <div className="h-48 rounded-xl bg-muted" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <ReadinessTierCard label="High readiness" count={tierCounts['High Readiness']} total={filteredRows.length} tone="text-emerald-700" />
            <ReadinessTierCard label="Moderate readiness" count={tierCounts['Moderate Readiness']} total={filteredRows.length} tone="text-amber-700" />
            <ReadinessTierCard label="Low readiness" count={tierCounts['Low Readiness']} total={filteredRows.length} tone="text-red-700" />
          </div>

          <ReadinessDistributionBar counts={tierCounts} total={filteredRows.length} />

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-foreground">Readiness Rankings</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ranked active residents using these thresholds: high readiness at {Math.round(READINESS_READY_THRESHOLD * 100)}%+, medium at 50% to under 70%, and low below 50%.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className={`${label} min-w-[11rem]`}>
                  Ranking order
                  <select
                    className={input}
                    value={rankingOrder}
                    onChange={(event) => setRankingOrder(event.target.value as 'desc' | 'asc')}
                  >
                    <option value="desc">Highest readiness first</option>
                    <option value="asc">Lowest readiness first</option>
                  </select>
                </label>
                {lastUpdated && <p className="text-xs text-muted-foreground">Updated {lastUpdated.toLocaleTimeString()}</p>}
              </div>
            </div>

            <div className={tableWrap}>
              <table className="w-full text-left text-sm">
                <thead className={tableHead}>
                  <tr>
                    <th className="px-3 py-2">Resident</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Tier</th>
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
                        <tr key={row.id} className={tableRowHover}>
                          <td className="px-3 py-3 align-top">
                            <Link to={`/admin/residents/${row.id}`} className="font-medium text-primary hover:underline">
                              {row.internalCode}
                            </Link>
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

          <div className="grid gap-6 xl:grid-cols-2">
            <PriorityCard
              title="Ready to transition"
              emptyMessage="No residents in the current filtered cohort are over the readiness threshold yet."
              residents={readyToTransition}
            />
            <PriorityCard
              title="Needs attention"
              emptyMessage="No low-readiness residents matched the current filters."
              residents={needsAttention}
            />
          </div>
        </>
      )}
    </div>
  )
}
