// ReintegrationReadiness.tsx
// Drop this component onto the Caseload Inventory dashboard.
// It accepts a residentId prop and renders a readiness score card.
//
// Dependencies: React 18+, Tailwind CSS
// API base URL: set VITE_API_BASE_URL (or equivalent) in your .env

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReadinessPrediction {
  resident_id: number | null;
  reintegration_probability: number;
  prediction: "Ready" | "Not Ready";
  risk_tier: "High Readiness" | "Moderate Readiness" | "Low Readiness";
  threshold_used: number;
}

interface Props {
  residentId: number;
  /** Override API base URL; falls back to VITE_API_BASE_URL or '' */
  apiBase?: string;
}

// ── Risk tier config ──────────────────────────────────────────────────────────

const TIER_CONFIG = {
  "High Readiness": {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
    bar:   "bg-emerald-500",
    icon:  "✓",
  },
  "Moderate Readiness": {
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    bar:   "bg-amber-400",
    icon:  "~",
  },
  "Low Readiness": {
    badge: "bg-red-100 text-red-800 border-red-300",
    bar:   "bg-red-400",
    icon:  "✗",
  },
} as const;

// ── Circular gauge ────────────────────────────────────────────────────────────

function ProbabilityGauge({ probability }: { probability: number }) {
  const pct     = Math.round(probability * 100);
  const radius  = 40;
  const circ    = 2 * Math.PI * radius;
  const dash    = (probability * circ).toFixed(2);
  const color   =
    probability >= 0.7 ? "#10b981"   // emerald-500
    : probability >= 0.45 ? "#f59e0b" // amber-400
    : "#ef4444";                       // red-400

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* Background ring */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke="#e5e7eb" strokeWidth="10"
        />
        {/* Progress arc */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        <text
          x="50" y="55"
          textAnchor="middle"
          fontSize="18"
          fontWeight="700"
          fill={color}
        >
          {pct}%
        </text>
      </svg>
      <p className="text-xs text-gray-500">Readiness Probability</p>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="flex justify-center">
        <div className="w-24 h-24 bg-gray-200 rounded-full" />
      </div>
      <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
      <div className="h-3 bg-gray-200 rounded w-full" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReintegrationReadiness({ residentId, apiBase }: Props) {
  const [data,    setData]    = useState<ReadinessPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const base = apiBase ?? (import.meta as any).env?.VITE_API_BASE_URL ?? "";

  useEffect(() => {
    if (!residentId) return;

    setLoading(true);
    setError(null);
    setData(null);

    const controller = new AbortController();

    fetch(`${base}/api/residents/${residentId}/reintegration-readiness`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
        return res.json() as Promise<ReadinessPrediction>;
      })
      .then(setData)
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [residentId, base]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 w-full max-w-sm">
      {/* Header */}
      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <span className="text-base">🏠</span>
        Reintegration Readiness
      </h3>

      {loading && <Skeleton />}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <p className="font-medium">Prediction unavailable</p>
          <p className="text-xs mt-1 text-red-500">{error}</p>
        </div>
      )}

      {data && (() => {
        const tier   = TIER_CONFIG[data.risk_tier];
        const pct    = Math.round(data.reintegration_probability * 100);
        const barPct = `${pct}%`;

        return (
          <div className="space-y-4">
            {/* Circular gauge */}
            <div className="flex justify-center">
              <ProbabilityGauge probability={data.reintegration_probability} />
            </div>

            {/* Risk tier badge */}
            <div className="flex justify-center">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-semibold ${tier.badge}`}
              >
                <span>{tier.icon}</span>
                {data.risk_tier}
              </span>
            </div>

            {/* Prediction label */}
            <p className="text-center text-sm font-medium text-gray-700">
              Prediction:{" "}
              <span
                className={
                  data.prediction === "Ready"
                    ? "text-emerald-600 font-bold"
                    : "text-red-600 font-bold"
                }
              >
                {data.prediction}
              </span>
            </p>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Readiness score</span>
                <span>{barPct}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${tier.bar} transition-all duration-700`}
                  style={{ width: barPct }}
                />
              </div>
            </div>

            {/* Threshold note */}
            <p className="text-xs text-gray-400 text-center">
              Decision threshold: {Math.round(data.threshold_used * 100)}% · Model v1.0
            </p>
          </div>
        );
      })()}
    </div>
  );
}

export default ReintegrationReadiness;
