// AtRiskDonors.tsx
// "At-Risk Donors Alert" component for the Admin Portal → Donors & Contributions page.
//
// Dependencies: React 18+, Tailwind CSS
// API base URL: set VITE_API_BASE_URL (or equivalent) in your .env

import { useCallback, useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AtRiskDonor {
  supporter_id: number | null;
  churn_probability: number;
  prediction: "At Risk" | "Stable";
  risk_tier: "High Risk" | "Moderate Risk" | "Low Risk";
  threshold_used: number;
  top_risk_signals: string[];
}

interface Props {
  /** Max donors to show per page */
  limit?: number;
  /** Churn probability threshold (0–1). Passed to API. */
  threshold?: number;
  /** Override API base URL; falls back to VITE_API_BASE_URL */
  apiBase?: string;
  /** Called when user clicks "Outreach" on a donor row */
  onScheduleOutreach?: (supporterId: number) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SIGNAL_LABELS: Record<string, string> = {
  high_recency:     "Lapsed 12+ mo",
  zero_recurring:   "No recurring",
  negative_trend:   "Declining gifts",
  one_time_only:    "One-time donor",
};

const TIER_STYLES: Record<AtRiskDonor["risk_tier"], { badge: string; dot: string }> = {
  "High Risk":     { badge: "bg-red-100 text-red-800 border-red-300",    dot: "bg-red-500" },
  "Moderate Risk": { badge: "bg-amber-100 text-amber-800 border-amber-300", dot: "bg-amber-400" },
  "Low Risk":      { badge: "bg-sky-100 text-sky-800 border-sky-300",    dot: "bg-sky-400" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ProbabilityBar({ probability }: { probability: number }) {
  const pct   = Math.round(probability * 100);
  const color = probability >= 0.75 ? "bg-red-500"
               : probability >= 0.55 ? "bg-amber-400"
               : "bg-sky-400";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-9 text-right">{pct}%</span>
    </div>
  );
}

function SignalPills({ signals }: { signals: string[] }) {
  if (signals.length === 0) return <span className="text-xs text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {signals.map((s) => (
        <span
          key={s}
          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200"
        >
          {SIGNAL_LABELS[s] ?? s}
        </span>
      ))}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AtRiskDonors({
  limit = 25,
  threshold = 0.55,
  apiBase,
  onScheduleOutreach,
}: Props) {
  const [donors,    setDonors]    = useState<AtRiskDonor[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const base = apiBase ?? (import.meta as any).env?.VITE_API_BASE_URL ?? "";

  const fetchDonors = useCallback(() => {
    setLoading(true);
    setError(null);

    const url = `${base}/api/donors/at-risk?threshold=${threshold}&limit=${limit}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
        return res.json() as Promise<AtRiskDonor[]>;
      })
      .then((data) => {
        setDonors(data);
        setLastFetch(new Date());
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [base, threshold, limit]);

  useEffect(() => { fetchDonors(); }, [fetchDonors]);

  const highCount = donors.filter((d) => d.risk_tier === "High Risk").length;
  const modCount  = donors.filter((d) => d.risk_tier === "Moderate Risk").length;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            At-Risk Donors Alert
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Ranked by churn probability · threshold {Math.round(threshold * 100)}% · top {limit}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Summary pills */}
          {!loading && !error && (
            <div className="flex gap-2 text-xs">
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                {highCount} High
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                {modCount} Moderate
              </span>
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={fetchDonors}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="px-5 py-4 bg-red-50 border-b border-red-100">
          <p className="text-sm text-red-700 font-medium">Failed to load at-risk donors</p>
          <p className="text-xs text-red-500 mt-1">{error}</p>
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 w-20">Donor ID</th>
              <th className="px-4 py-3">Risk Tier</th>
              <th className="px-4 py-3 w-36">Churn Probability</th>
              <th className="px-4 py-3">Risk Signals</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              : donors.length === 0 && !error
              ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No donors above the {Math.round(threshold * 100)}% churn threshold.
                  </td>
                </tr>
              )
              : donors.map((donor) => {
                  const tier   = TIER_STYLES[donor.risk_tier];
                  const donorId = donor.supporter_id ?? 0;
                  return (
                    <tr
                      key={donorId}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* ID */}
                      <td className="px-4 py-3 font-mono text-gray-700 text-xs">
                        #{donorId}
                      </td>

                      {/* Risk tier badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${tier.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
                          {donor.risk_tier}
                        </span>
                      </td>

                      {/* Probability bar */}
                      <td className="px-4 py-3">
                        <ProbabilityBar probability={donor.churn_probability} />
                      </td>

                      {/* Risk signals */}
                      <td className="px-4 py-3">
                        <SignalPills signals={donor.top_risk_signals} />
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onScheduleOutreach?.(donorId)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 active:scale-95 transition"
                        >
                          Outreach
                        </button>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      {lastFetch && !loading && (
        <div className="px-5 py-2 border-t border-gray-100 text-right">
          <span className="text-[11px] text-gray-400">
            Last updated {lastFetch.toLocaleTimeString()} · Model v1.0 · GBM
          </span>
        </div>
      )}
    </div>
  );
}

export default AtRiskDonors;
