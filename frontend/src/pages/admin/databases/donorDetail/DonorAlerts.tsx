import { Link } from 'react-router-dom'
import { AlertTriangle, TrendingUp } from 'lucide-react'
import type { AtRiskDonorInfo } from '../../../../api/adminTypes'

type Props = {
  supporterId: number
  atRisk: AtRiskDonorInfo | null | undefined
  /** Reserved for a future pipeline field (e.g. upgrade propensity). When null, no upgrade bar is shown. */
  upgradeInsight: { title: string; description: string } | null
}

/**
 * Slim alert bars for pipeline-style insights. At-risk uses existing churn API data.
 * Upgrade slot is structured for future wiring without layout churn.
 */
export function DonorAlerts({ supporterId, atRisk, upgradeInsight }: Props) {
  const outreachHref = `/admin/email-hub?supporterId=${supporterId}`

  const showLapse =
    atRisk != null &&
    atRisk.supporter_id === supporterId &&
    (atRisk.risk_tier === 'High Risk' ||
      atRisk.risk_tier === 'Moderate Risk' ||
      atRisk.prediction === 'At Risk')

  if (!showLapse && !upgradeInsight) return null

  return (
    <div className="space-y-2">
      {showLapse ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-950">May be at risk of lapsing</p>
              <p className="mt-0.5 text-sm text-amber-900/90">
                Model estimate: {Math.round(atRisk.churn_probability * 100)}% churn probability ({atRisk.risk_tier}
                ). Reach out while the relationship is still warm.
              </p>
            </div>
          </div>
          <Link
            to={outreachHref}
            className="shrink-0 rounded-lg bg-amber-800 px-4 py-2 text-center text-sm font-medium text-white hover:bg-amber-900"
          >
            Start outreach
          </Link>
        </div>
      ) : null}

      {upgradeInsight ? (
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-950">{upgradeInsight.title}</p>
              <p className="mt-0.5 text-sm text-emerald-900/90">{upgradeInsight.description}</p>
            </div>
          </div>
          <Link
            to={outreachHref}
            className="shrink-0 rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 text-center text-sm font-medium text-white hover:bg-emerald-800"
          >
            Start outreach
          </Link>
        </div>
      ) : null}
    </div>
  )
}
