import { moneyPhp } from './donorDetailUtils'

type Props = {
  lifetimeTotal: number
  donationCount: number
  averageGift: number
  lastDonationLabel: string
  lastDonationType: string
}

export function DonorMetricsRow({
  lifetimeTotal,
  donationCount,
  averageGift,
  lastDonationLabel,
  lastDonationType,
}: Props) {
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
