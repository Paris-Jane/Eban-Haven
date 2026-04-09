import { Link } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import type { AtRiskDonorInfo, DonorUpgradeInfo, Supporter } from '../../../../api/adminTypes'
import { btnPrimary, card } from '../../shared/adminStyles'
import { StatusBadge } from '../../shared/adminDataTable/AdminBadges'

type Props = {
  supporter: Supporter
  donationCount: number
  churn: AtRiskDonorInfo | null
  churnLoading: boolean
  /** API / ML error detail when churn prediction could not be loaded */
  churnError: string | null
  /** Present when this donor appears in the upgrade-candidates batch (ML propensity). */
  upgrade: DonorUpgradeInfo | null
}

function isLapseRisk(c: AtRiskDonorInfo) {
  return (
    c.prediction === 'At Risk' || c.risk_tier === 'High Risk' || c.risk_tier === 'Moderate Risk'
  )
}

/** Uses churn pipeline output: stable / low tier + low probability + giving history. */
function isDonateMorePotential(c: AtRiskDonorInfo, donationCount: number) {
  return (
    donationCount > 0 &&
    c.prediction === 'Stable' &&
    c.risk_tier === 'Low Risk' &&
    c.churn_probability < 0.45
  )
}

const chipBase =
  'inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-medium leading-tight'

export function DonorStatusCard({
  supporter,
  donationCount,
  churn,
  churnLoading,
  churnError,
  upgrade,
}: Props) {
  const outreachHref = `/admin/email-hub?supporterId=${supporter.id}`
  const showLapse = churn != null && isLapseRisk(churn)
  const showPotential = churn != null && isDonateMorePotential(churn, donationCount)
  const showUpgradeChip = upgrade != null && upgrade.prediction === 'Likely to Upgrade'

  const hasInsightChips = showLapse || showUpgradeChip || showPotential

  return (
    <div className={`${card} flex h-full min-h-0 flex-col gap-4`}>
      <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
        <span className="font-medium text-muted-foreground">Status:</span>
        <StatusBadge status={supporter.status} />
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Donor insights</p>
        {churnLoading ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            Loading insights…
          </p>
        ) : churn == null ? (
          <div className="mt-2 space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Insights unavailable</p>
            {churnError ? (
              <p className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs leading-relaxed text-foreground">
                {churnError}
              </p>
            ) : null}
            {upgrade && showUpgradeChip ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <span
                  className={`${chipBase} border-emerald-200/90 bg-emerald-50 text-emerald-950 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-100`}
                >
                  Upgrade propensity · {Math.round(upgrade.upgrade_probability * 100)}%
                  {upgrade.propensity_tier ? ` · ${upgrade.propensity_tier}` : ''}
                </span>
              </div>
            ) : null}
            <p className="text-xs leading-relaxed">
              Churn scores come from the ML prediction service. If you are running locally, start the ML API and ensure
              the backend can reach it. A 502 usually means the model service is down or misconfigured.
            </p>
          </div>
        ) : (
          <div className="mt-2 space-y-3">
            <div className="flex flex-wrap gap-2">
              {showLapse ? (
                <span
                  className={`${chipBase} border-amber-200/90 bg-amber-50 text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-100`}
                  title={churn.top_risk_signals?.length ? churn.top_risk_signals.join(' · ') : undefined}
                >
                  Lapse risk · {Math.round(churn.churn_probability * 100)}% · {churn.risk_tier}
                </span>
              ) : null}
              {showUpgradeChip && upgrade ? (
                <span
                  className={`${chipBase} border-emerald-200/90 bg-emerald-50 text-emerald-950 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-100`}
                >
                  Upgrade propensity · {Math.round(upgrade.upgrade_probability * 100)}%
                  {upgrade.propensity_tier ? ` · ${upgrade.propensity_tier}` : ''}
                </span>
              ) : null}
              {showPotential ? (
                <span
                  className={`${chipBase} border-sky-200/90 bg-sky-50 text-sky-950 dark:border-sky-800/80 dark:bg-sky-950/40 dark:text-sky-100`}
                >
                  Stable engagement · growth opportunity
                </span>
              ) : null}
            </div>
            {!hasInsightChips ? (
              <p className="text-sm text-muted-foreground">No standout pipeline flags for this donor right now.</p>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-border pt-3">
        <Link to={outreachHref} className={`${btnPrimary} block w-full text-center`}>
          Donor outreach
        </Link>
      </div>
    </div>
  )
}
