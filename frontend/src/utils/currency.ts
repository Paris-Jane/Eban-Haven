// Fixed display rate: 1 USD ≈ 56 PHP
// Amounts are stored in PHP in the database; this converts for display only.
const PHP_TO_USD_RATE = 1 / 56

export function phpToUsd(phpAmount: number): number {
  return phpAmount * PHP_TO_USD_RATE
}

const _moneyUsd = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
})

/** Format a PHP-stored amount as USD for display. */
export function formatUsd(phpAmount: number): string {
  return _moneyUsd.format(phpToUsd(phpAmount))
}

/** Compact USD format (e.g. $1.2K) for dashboard hero stats. */
export function formatUsdCompact(phpAmount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(phpToUsd(phpAmount))
}
