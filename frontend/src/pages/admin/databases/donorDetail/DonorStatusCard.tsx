import { Link } from 'react-router-dom'
import { AlertTriangle, LoaderCircle, TrendingUp } from 'lucide-react'
import type { AtRiskDonorInfo, Supporter } from '../../../../api/adminTypes'
import { btnPrimary, card } from '../../shared/adminStyles'
import { StatusBadge } from '../../shared/adminDataTable/AdminBadges'

type Props = {
  supporter: Supporter
  donationCount: number
  churn: AtRiskDonorInfo | null
  churnLoading: boolean
  /** API / ML error detail when churn prediction could not be loaded */
  churnError: string | null
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

export function DonorStatusCard({ supporter, donationCount, churn, churnLoading, churnError }: Props) {
  const outreachHref = `/admin/email-hub?supporterId=${supporter.id}`
  const showLapse = churn != null && isLapseRisk(churn)
  const showPotential = churn != null && isDonateMorePotential(churn, donationCount)

  return (
    <div className={`${card} flex h-full flex-col gap-4`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={supporter.status} />
          <span className="text-sm text-muted-foreground">Supporter record status</span>
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Donor insights</p>
        {churnLoading ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            Running churn model…
          </p>
        ) : churn == null ? (
          <div className="mt-2 space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Insights unavailable</p>
            {churnError ? (
              <p className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs leading-relaxed text-foreground">
                {churnError}
              </p>
            ) : null}
            <p className="text-xs leading-relaxed">
              Churn scores are produced by the ML prediction service. If you are running locally, start the ML API and
              ensure the backend can reach it (for example the <code className="rounded bg-muted px-1">MlService</code>{' '}
              HTTP client). A 502 from the API usually means the model service is down or misconfigured.
            </p>
          </div>
        ) : (
          <ul className="mt-2 space-y-3 text-sm">
            {showLapse ? (
              <li className="flex gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                <div>
                  <p className="font-medium text-amber-950">Lapse risk</p>
                  <p className="mt-0.5 text-amber-900/90">
                    ~{Math.round(churn.churn_probability * 100)}% churn probability · {churn.risk_tier}
                  </p>
                </div>
              </li>
            ) : null}
            {showPotential ? (
              <li className="flex gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/80 p-3">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                <div>
                  <p className="font-medium text-emerald-950">Donate-more potential</p>
                  <p className="mt-0.5 text-emerald-900/90">
                    Model shows stable engagement — a timely ask may increase giving.
                  </p>
                </div>
              </li>
            ) : null}
            {!showLapse && !showPotential ? (
              <li className="text-muted-foreground">No standout pipeline flags for this donor right now.</li>
            ) : null}
          </ul>
        )}
      </div>

      <div className="mt-auto border-t border-border pt-3">
        <Link to={outreachHref} className={`${btnPrimary} block w-full text-center`}>
          Donor outreach
        </Link>
        <p className="mt-2 text-center text-xs text-muted-foreground">Open email workspace for this donor</p>
      </div>
    </div>
  )
}
