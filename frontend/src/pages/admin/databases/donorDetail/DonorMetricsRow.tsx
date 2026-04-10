import { moneyPhp } from './donorDetailUtils'

type Props = {
  lifetimeTotal: number
  donationCount: number
  averageGift: number
  lastDonationLabel: string
  lastDonationType: string
  variant?: 'line' | 'cards'
}

export function DonorMetricsRow({
  lifetimeTotal,
  donationCount,
  averageGift,
  lastDonationLabel,
  lastDonationType,
  variant = 'line',
}: Props) {
  if (variant === 'cards') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Lifetime total"
          value={moneyPhp.format(lifetimeTotal)}
          subtext="Recorded across all contribution types with amounts"
        />
        <MetricCard label="Donations" value={donationCount} subtext="Contribution records linked to this donor" />
        <MetricCard
          label="Average gift"
          value={donationCount ? moneyPhp.format(averageGift) : '—'}
          subtext="Average amount across recorded donations"
        />
        <MetricCard label="Most recent" value={lastDonationLabel} subtext={lastDonationType || 'No donation history yet'} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 border-y border-border/80 py-4 sm:grid-cols-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lifetime total</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{moneyPhp.format(lifetimeTotal)}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Donations</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{donationCount}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average gift</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
          {donationCount ? moneyPhp.format(averageGift) : '—'}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last donation</p>
        <p className="mt-1 text-lg font-semibold text-foreground">{lastDonationLabel}</p>
        {lastDonationType ? <p className="mt-0.5 text-xs text-muted-foreground">{lastDonationType}</p> : null}
      </div>
    </div>
  )
}

function MetricCard({ label, value, subtext }: { label: string; value: string | number; subtext: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{subtext}</p>
    </div>
  )
}
