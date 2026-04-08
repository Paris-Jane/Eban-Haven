import { apiFetch, parseJson } from './client'
import type { Donation, Supporter } from './adminTypes'

export async function getDonorMe(): Promise<{ email: string; supporter: Supporter | null }> {
  return parseJson(await apiFetch('/api/donor/me'))
}

export async function getMyDonations(): Promise<Donation[]> {
  return parseJson(await apiFetch('/api/donor/donations'))
}

export async function createMyDonation(body: {
  donationType: string
  donationDate?: string
  amount?: number
  currencyCode?: string
  notes?: string
  campaignName?: string
}): Promise<Donation> {
  return parseJson(
    await apiFetch('/api/donor/donations', {
      method: 'POST',
      body: JSON.stringify({
        donationType: body.donationType,
        donationDate: body.donationDate,
        amount: body.amount,
        currencyCode: body.currencyCode,
        notes: body.notes,
        campaignName: body.campaignName,
      }),
    }),
  )
}

