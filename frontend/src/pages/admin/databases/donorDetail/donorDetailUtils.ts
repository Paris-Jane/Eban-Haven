import type { Donation } from '../../../../api/adminTypes'
import { formatUsd } from '../../../../utils/currency'

export const moneyPhp = { format: formatUsd }

export function formatDonationAmount(donation: Donation) {
  if (donation.amount == null) return '—'
  return formatUsd(donation.amount)
}

export function formatDonationDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
