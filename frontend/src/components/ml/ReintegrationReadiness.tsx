import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, getStaffToken, parseJson } from '../../api/client'
import {
  actionableImprovementAreas,
  deriveReadinessPrediction,
  deriveReadinessTier,
  formatFeatureValue,
  normalizeImprovementLabel,
  type ImprovementArea,
  type ReintegrationResult,
  READINESS_READY_THRESHOLD,
  TIER_CONFIG,
} from './reintegrationReadinessShared'
import { RESIDENT_SEMANTIC } from '../../pages/admin/shared/residentSemanticPalette'

// ── Sub-components ────────────────────────────────────────────────────────────

function ReadinessGauge({ probability, thresholdUsed, tier }: {
  probability:   number;
  thresholdUsed: number;
  tier:          ReintegrationResult["risk_tier"];
}) {
  const pct = Math.round(probability * 100)
  const threshold = Math.round(thresholdUsed * 100)
  const config = TIER_CONFIG[tier]
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Readiness score</span>
        <span className="text-2xl font-bold text-gray-800 tabular-nums">{pct}%</span>
      </div>
      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${config.bar} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>0%</span>
        <span className="text-gray-500 font-medium">Threshold {threshold}%</span>
        <span>100%</span>
      </div>
    </div>
  )
}

function ImprovementCard({ area, rank }: { area: ImprovementArea; rank: number }) {
  const residentFmt = formatFeatureValue(area.feature, area.resident_value)
  const benchmarkFmt = formatFeatureValue(area.feature, area.benchmark_value)
  const isLowerBetter =
    area.feature === 'total_incidents' ||
    area.feature === 'num_severe_incidents' ||
    area.feature === 'pct_concerns_flagged'

  return (
    <div className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-800">{normalizeImprovementLabel(area.label)}</span>
          <div className="flex items-center gap-1.5 text-[11px] shrink-0">
            <span className="text-red-600 font-medium">
              {isLowerBetter && area.resident_value > area.benchmark_value ? '▲ ' : '▼ '}
              {residentFmt}
            </span>
            <span className="text-gray-400">→</span>
            <span className="text-emerald-700 font-medium">{benchmarkFmt}</span>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{area.suggestion}</p>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-48" />
          <div className="h-3 bg-gray-100 rounded w-32" />
        </div>
        <div className="h-8 w-24 bg-gray-100 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-8 bg-gray-100 rounded-full" />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReintegrationReadiness({ residentId }: { residentId: number }) {
  const [result, setResult] = useState<ReintegrationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchResult = useCallback(() => {
    if (!getStaffToken()) {
      setResult(null)
      setError('Sign in to view reintegration readiness predictions.')
      setLoading(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    apiFetch(`/api/residents/${residentId}/reintegration-readiness`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Session expired. Sign in again to load this prediction.')
        }
        if (res.status === 404) {
          throw new Error('Resident record not found.')
        }
        if (!res.ok) {
          const text = await res.text()
          try {
            const j = JSON.parse(text) as { detail?: string; title?: string }
            throw new Error(j.detail ?? j.title ?? `HTTP ${res.status}: ${text.slice(0, 200)}`)
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
            throw parseErr
          }
        }
        return parseJson<ReintegrationResult>(res)
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult(data)
          setLastFetch(new Date())
        }
      })
      .catch((err: Error) => {
        if (!controller.signal.aborted) setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
  }, [residentId])

  useEffect(() => {
    fetchResult()
    return () => abortRef.current?.abort()
  }, [fetchResult])

  if (loading) return <SkeletonCard />

  if (error) {
    return (
      <div
        className={`rounded-2xl border shadow-sm p-5 ${RESIDENT_SEMANTIC.danger.border} ${RESIDENT_SEMANTIC.danger.bg}`}
      >
        <div className="flex items-start gap-3">
          <span className="text-lg mt-0.5">⚠️</span>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${RESIDENT_SEMANTIC.danger.textBold}`}>Reintegration readiness unavailable</p>
            <p className={`text-xs mt-1 ${RESIDENT_SEMANTIC.danger.text}`}>{error}</p>
          </div>
          <button
            onClick={fetchResult}
            type="button"
            className={`text-xs px-3 py-1.5 rounded-lg border bg-background transition hover:opacity-90 ${RESIDENT_SEMANTIC.danger.border} ${RESIDENT_SEMANTIC.danger.text}`}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!result) return null

  const tier = deriveReadinessTier(result.reintegration_probability)
  const prediction = deriveReadinessPrediction(result.reintegration_probability)
  const config = TIER_CONFIG[tier]
  const isReady = prediction === 'Ready'
  const visibleImprovements = actionableImprovementAreas(result)

  return (
    <div
      className={`rounded-2xl border shadow-sm overflow-hidden bg-white ${isReady ? `${RESIDENT_SEMANTIC.success.border}` : 'border-gray-200'}`}
    >
      {/* ── Header ── */}
      <div
        className={`px-5 py-4 border-b flex items-center justify-between ${isReady ? `${RESIDENT_SEMANTIC.success.border} ${RESIDENT_SEMANTIC.success.bgSoft}` : 'border-gray-100'}`}
      >
        <div>
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-lg">{config.icon}</span>
            Reintegration Readiness
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            GBM model · threshold {Math.round(READINESS_READY_THRESHOLD * 100)}%
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold ${config.badge}`}>
            <span className={`w-2 h-2 rounded-full ${config.dot}`} />
            {prediction}
          </span>
          <button
            onClick={fetchResult}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-5 py-4 space-y-4">
        <ReadinessGauge probability={result.reintegration_probability} thresholdUsed={READINESS_READY_THRESHOLD} tier={tier} />

        <div className={`rounded-xl px-4 py-3 ${config.bg} border ${config.border}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${config.text}`}>
            {tier}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {tier === 'High Readiness' && 'This resident shows strong indicators for successful reintegration.'}
            {tier === 'Moderate Readiness' && 'Some readiness indicators present — continued support recommended before transition.'}
            {tier === 'Low Readiness' && 'Key readiness factors are below threshold. Focused intervention advised before planning reintegration.'}
          </p>
        </div>

        {visibleImprovements.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">
              🎯 Top areas to address
            </p>
            {visibleImprovements.map((area, i) => (
              <ImprovementCard key={area.feature} area={area} rank={i + 1} />
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-400 leading-relaxed">
          This prediction is generated by a gradient boosting model trained on program outcomes.
          It is an advisory tool only and should be considered alongside direct professional assessment.
        </p>
      </div>

      {/* ── Footer ── */}
      {lastFetch && (
        <div className="px-5 py-2 border-t border-gray-100 text-right">
          <span className="text-[11px] text-gray-400">
            Last updated {lastFetch.toLocaleTimeString()} · Model v1.0 · GBM · ROC-AUC 0.829
          </span>
        </div>
      )}
    </div>
  )
}

export default ReintegrationReadiness
