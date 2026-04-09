import type { Donation } from '../../../../api/adminTypes'

export const moneyPhp = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' })

export function formatDonationAmount(donation: Donation) {
  if (donation.amount == null) return '—'
  const currency = donation.currencyCode?.trim() || 'PHP'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(donation.amount)
  } catch {
    return `${donation.amount} ${currency}`
  }
}

export function formatDonationDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
