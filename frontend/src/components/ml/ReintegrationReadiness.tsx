import { useCallback, useEffect, useState } from "react";
import { apiFetch, getStaffToken, parseJson } from "../../api/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReintegrationResult {
  resident_id:               number | null;
  reintegration_probability: number;
  prediction:                "Ready" | "Not Ready";
  risk_tier:                 "High Readiness" | "Moderate Readiness" | "Low Readiness";
  threshold_used:            number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER_STYLES: Record<ReintegrationResult["risk_tier"], {
  badge: string; dot: string; bar: string; bg: string;
}> = {
  "High Readiness":     { badge: "bg-emerald-100 text-emerald-800 border-emerald-300", dot: "bg-emerald-500", bar: "bg-emerald-500", bg: "bg-emerald-50" },
  "Moderate Readiness": { badge: "bg-amber-100 text-amber-800 border-amber-300",       dot: "bg-amber-400",   bar: "bg-amber-400",   bg: "bg-amber-50"   },
  "Low Readiness":      { badge: "bg-red-100 text-red-800 border-red-300",             dot: "bg-red-500",     bar: "bg-red-400",     bg: "bg-red-50"     },
};

const TIER_ICONS: Record<ReintegrationResult["risk_tier"], string> = {
  "High Readiness":     "✅",
  "Moderate Readiness": "⏳",
  "Low Readiness":      "⚠️",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ReadinessGauge({ probability, tier }: { probability: number; tier: ReintegrationResult["risk_tier"] }) {
  const pct    = Math.round(probability * 100);
  const styles = TIER_STYLES[tier];
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Readiness score</span>
        <span className="text-2xl font-bold text-gray-800 tabular-nums">{pct}%</span>
      </div>
      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${styles.bar} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>0%</span>
        <span className="text-gray-500 font-medium">Threshold {Math.round(probability >= 0 ? 70 : 0)}%</span>
        <span>100%</span>
      </div>
    </div>
  );
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
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReintegrationReadiness({ residentId }: { residentId: number }) {
  const [result,    setResult]    = useState<ReintegrationResult | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchResult = useCallback(() => {
    if (!getStaffToken()) {
      setResult(null);
      setError("Sign in to view reintegration readiness predictions.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    apiFetch(`/api/residents/${residentId}/reintegration-readiness`)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Session expired. Sign in again to load this prediction.");
        }
        if (res.status === 404) {
          throw new Error("Resident record not found.");
        }
        // For all other non-2xx: extract the detail field from ASP.NET ProblemDetails if present
        if (!res.ok) {
          const text = await res.text();
          try {
            const j = JSON.parse(text) as { detail?: string; title?: string };
            throw new Error(j.detail ?? j.title ?? `HTTP ${res.status}: ${text.slice(0, 200)}`);
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
            throw parseErr;
          }
        }
        return parseJson<ReintegrationResult>(res);
      })
      .then((data) => {
        setResult(data);
        setLastFetch(new Date());
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [residentId]);

  useEffect(() => { fetchResult(); }, [fetchResult]);

  if (loading) return <SkeletonCard />;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 shadow-sm p-5">
        <div className="flex items-start gap-3">
          <span className="text-lg mt-0.5">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Reintegration readiness unavailable</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
          <button
            onClick={fetchResult}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-100 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const tier    = result.risk_tier;
  const styles  = TIER_STYLES[tier];
  const icon    = TIER_ICONS[tier];
  const isReady = result.prediction === "Ready";

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${isReady ? "border-emerald-200" : "border-gray-200"} bg-white`}>
      {/* ── Header ── */}
      <div className={`px-5 py-4 border-b flex items-center justify-between ${isReady ? "border-emerald-100 bg-emerald-50/40" : "border-gray-100"}`}>
        <div>
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            Reintegration Readiness
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            GBM model · threshold {Math.round(result.threshold_used * 100)}%
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold ${styles.badge}`}>
            <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
            {result.prediction}
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
        {/* Gauge */}
        <ReadinessGauge probability={result.reintegration_probability} tier={tier} />

        {/* Risk tier card */}
        <div className={`rounded-xl px-4 py-3 ${styles.bg} border ${styles.badge.split(" ")[2]}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${styles.badge.split(" ")[1]}`}>
                {tier}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {tier === "High Readiness" && "This resident shows strong indicators for successful reintegration."}
                {tier === "Moderate Readiness" && "Some readiness indicators present — continued support recommended before transition."}
                {tier === "Low Readiness" && "Key readiness factors are below threshold. Focused intervention advised before planning reintegration."}
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
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
  );
}

export default ReintegrationReadiness;
