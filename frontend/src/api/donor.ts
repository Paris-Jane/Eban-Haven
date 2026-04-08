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
