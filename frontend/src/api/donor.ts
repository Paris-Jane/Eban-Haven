import { apiFetch, parseJson } from './client'
import type { Donation, DonationAllocation, Supporter } from './adminTypes'

export type DonorDashboardData = {
  email: string
  supporter: Supporter | null
  donations: Donation[]
  allocations: DonationAllocation[]
}

export async function getDonorDashboard(): Promise<DonorDashboardData> {
  return parseJson<DonorDashboardData>(await apiFetch('/api/donor/dashboard'))
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
