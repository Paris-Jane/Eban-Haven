import { apiFetch, parseJson } from './client'
import type * as T from './adminTypes'

const base = '/api/admin'

export async function getDashboard(): Promise<T.DashboardSummary> {
  return parseJson<T.DashboardSummary>(await apiFetch(`${base}/dashboard`))
}

export async function getSafehouses(): Promise<T.SafehouseOption[]> {
  return parseJson<T.SafehouseOption[]>(await apiFetch(`${base}/safehouses`))
}

export async function getSupporters(): Promise<T.Supporter[]> {
  return parseJson<T.Supporter[]>(await apiFetch(`${base}/supporters`))
}

export async function createSupporter(body: T.CreateSupporterBody): Promise<T.Supporter> {
  const payload = {
    supporterType: body.supporterType,
    displayName: body.displayName,
    email: body.email,
    region: body.region,
    status: body.status,
  }
  return parseJson<T.Supporter>(
    await apiFetch(`${base}/supporters`, { method: 'POST', body: JSON.stringify(payload) }),
  )
}

export async function patchSupporter(
  id: number,
  body: { status?: string; supporterType?: string },
): Promise<T.Supporter> {
  return parseJson<T.Supporter>(
    await apiFetch(`${base}/supporters/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  )
}

export async function getDonations(supporterId?: number): Promise<T.Donation[]> {
  const q = supporterId != null ? `?supporterId=${supporterId}` : ''
  return parseJson<T.Donation[]>(await apiFetch(`${base}/donations${q}`))
}

export async function createDonation(body: {
  supporterId: number
  donationType: string
  donationDate?: string
  amount?: number
  currencyCode?: string
  notes?: string
  campaignName?: string
}): Promise<T.Donation> {
  return parseJson<T.Donation>(
    await apiFetch(`${base}/donations`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export async function getAllocations(params?: {
  donationId?: number
  safehouseId?: number
}): Promise<T.DonationAllocation[]> {
  const sp = new URLSearchParams()
  if (params?.donationId != null) sp.set('donationId', String(params.donationId))
  if (params?.safehouseId != null) sp.set('safehouseId', String(params.safehouseId))
  const q = sp.toString() ? `?${sp}` : ''
  return parseJson<T.DonationAllocation[]>(await apiFetch(`${base}/donation-allocations${q}`))
}

export async function getResidents(params: {
  status?: string
  safehouseId?: number
  category?: string
  q?: string
}): Promise<T.ResidentSummary[]> {
  const sp = new URLSearchParams()
  if (params.status) sp.set('status', params.status)
  if (params.safehouseId != null) sp.set('safehouseId', String(params.safehouseId))
  if (params.category) sp.set('category', params.category)
  if (params.q) sp.set('q', params.q)
  const q = sp.toString() ? `?${sp}` : ''
  return parseJson<T.ResidentSummary[]>(await apiFetch(`${base}/residents${q}`))
}

export async function getResident(id: number): Promise<T.ResidentDetail> {
  return parseJson<T.ResidentDetail>(await apiFetch(`${base}/residents/${id}`))
}

export async function patchResident(
  id: number,
  fields: Record<string, string | null>,
): Promise<T.ResidentDetail> {
  return parseJson<T.ResidentDetail>(
    await apiFetch(`${base}/residents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    }),
  )
}

export async function createResident(body: {
  internalCode: string
  caseStatus: string
  caseCategory?: string
}): Promise<T.ResidentSummary> {
  return parseJson<T.ResidentSummary>(
    await apiFetch(`${base}/residents`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export async function getCases(): Promise<T.Case[]> {
  return parseJson<T.Case[]>(await apiFetch(`${base}/cases`))
}

export async function updateCaseStatus(caseId: string, status: string): Promise<T.Case> {
  return parseJson<T.Case>(
    await apiFetch(`${base}/cases/${caseId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  )
}

export async function getProcessRecordings(residentId?: number): Promise<T.ProcessRecording[]> {
  const q = residentId != null ? `?residentId=${residentId}` : ''
  return parseJson<T.ProcessRecording[]>(await apiFetch(`${base}/process-recordings${q}`))
}

export async function createProcessRecording(body: {
  residentId: number
  sessionDate?: string
  socialWorker: string
  sessionType: string
  sessionDurationMinutes?: number
  emotionalStateObserved?: string
  emotionalStateEnd?: string
  sessionNarrative: string
  interventionsApplied?: string
  followUpActions?: string
}): Promise<T.ProcessRecording> {
  return parseJson<T.ProcessRecording>(
    await apiFetch(`${base}/process-recordings`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export async function getHomeVisitations(residentId?: number): Promise<T.HomeVisitation[]> {
  const q = residentId != null ? `?residentId=${residentId}` : ''
  return parseJson<T.HomeVisitation[]>(await apiFetch(`${base}/home-visitations${q}`))
}

export async function createHomeVisitation(body: {
  residentId: number
  visitDate?: string
  socialWorker: string
  visitType: string
  locationVisited?: string
  observations?: string
  familyCooperationLevel?: string
  safetyConcernsNoted: boolean
  followUpNeeded: boolean
  followUpNotes?: string
}): Promise<T.HomeVisitation> {
  return parseJson<T.HomeVisitation>(
    await apiFetch(`${base}/home-visitations`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export async function getInterventionPlans(residentId?: number): Promise<T.InterventionPlan[]> {
  const q = residentId != null ? `?residentId=${residentId}` : ''
  return parseJson<T.InterventionPlan[]>(await apiFetch(`${base}/intervention-plans${q}`))
}

export async function getReportsSummary(): Promise<T.ReportsSummary> {
  return parseJson<T.ReportsSummary>(await apiFetch(`${base}/reports/summary`))
}
