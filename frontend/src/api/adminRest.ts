import { apiFetch, parseJson } from './client'
import type * as T from './adminTypes'
import type { ReintegrationResult } from '../components/ml/reintegrationReadinessShared'

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

export async function getAtRiskDonors(threshold = 0.55, limit = 50): Promise<T.AtRiskDonorInfo[]> {
  return parseJson<T.AtRiskDonorInfo[]>(
    await apiFetch(`/api/donors/at-risk?threshold=${threshold}&limit=${limit}`),
  )
}

export async function getUpgradeCandidates(threshold = 0.6241, limit = 100): Promise<T.DonorUpgradeInfo[]> {
  return parseJson<T.DonorUpgradeInfo[]>(
    await apiFetch(`/api/donors/upgrade-candidates?threshold=${threshold}&limit=${limit}`),
  )
}

export type DonorChurnRiskResult = {
  prediction: T.AtRiskDonorInfo | null
  /** Set when the API or network fails so the UI can explain why insights are missing. */
  errorMessage: string | null
}

/** Single-donor churn pipeline (ML service). `errorMessage` is set when the call fails or ML is unreachable. */
export async function getDonorChurnRisk(supporterId: number): Promise<DonorChurnRiskResult> {
  try {
    const res = await apiFetch(`/api/donors/${supporterId}/churn-risk`)
    if (!res.ok) {
      let detail = `Request failed (${res.status}).`
      try {
        const text = await res.text()
        if (text) {
          const j = JSON.parse(text) as { detail?: string; message?: string; title?: string }
          if (typeof j.detail === 'string' && j.detail.trim()) detail = j.detail.trim()
          else if (typeof j.message === 'string' && j.message.trim()) detail = j.message.trim()
          else if (typeof j.title === 'string' && j.title.trim()) detail = j.title.trim()
        }
      } catch {
        /* keep detail */
      }
      return { prediction: null, errorMessage: detail }
    }
    return { prediction: await parseJson<T.AtRiskDonorInfo>(res), errorMessage: null }
  } catch (e) {
    return {
      prediction: null,
      errorMessage: e instanceof Error ? e.message : 'Network error while loading churn risk.',
    }
  }
}

export async function getDonorEmailProfile(supporterId: number): Promise<T.DonorEmailProfile> {
  return parseJson<T.DonorEmailProfile>(await apiFetch(`${base}/email-hub/supporters/${supporterId}`))
}

export async function generateDonorEmail(
  supporterId: number,
  body: {
    goal?: string
    tone?: string
    senderName?: string
    senderOrganization?: string
    senderContact?: string
    preferAi?: boolean
  },
): Promise<T.GeneratedDonorEmail> {
  return parseJson<T.GeneratedDonorEmail>(
    await apiFetch(`${base}/email-hub/supporters/${supporterId}/compose`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
}

export async function sendDonorEmail(
  supporterId: number,
  body: { toEmail: string; subject: string; body: string; htmlBody: string },
): Promise<T.SentDonorEmail> {
  return parseJson<T.SentDonorEmail>(
    await apiFetch(`${base}/email-hub/supporters/${supporterId}/send`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
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

export async function getReintegrationReadinessCohort(signal?: AbortSignal): Promise<{
  residents: Array<T.ResidentSummary & { readiness: ReintegrationResult }>
  failed_count: number
}> {
  return parseJson(await apiFetch('/api/residents/reintegration-readiness/cohort', { signal }))
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
  internalCode?: string
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
  progressNoted?: boolean
  concernsFlagged?: boolean
  referralMade?: boolean
}): Promise<T.ProcessRecording> {
  return parseJson<T.ProcessRecording>(
    await apiFetch(`${base}/process-recordings`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export type PatchProcessRecordingBody = Partial<{
  sessionDate: string
  socialWorker: string
  sessionType: string
  sessionDurationMinutes: number
  emotionalStateObserved: string
  emotionalStateEnd: string
  sessionNarrative: string
  interventionsApplied: string
  followUpActions: string
  progressNoted: boolean
  concernsFlagged: boolean
  referralMade: boolean
}>

export async function patchProcessRecording(id: number, body: PatchProcessRecordingBody): Promise<T.ProcessRecording> {
  return parseJson<T.ProcessRecording>(
    await apiFetch(`${base}/process-recordings/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
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
  purpose?: string
  familyMembersPresent?: string
  visitOutcome?: string
}): Promise<T.HomeVisitation> {
  return parseJson<T.HomeVisitation>(
    await apiFetch(`${base}/home-visitations`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export type PatchHomeVisitationBody = Partial<{
  visitDate: string
  socialWorker: string
  visitType: string
  locationVisited: string
  familyMembersPresent: string
  purpose: string
  observations: string
  familyCooperationLevel: string
  safetyConcernsNoted: boolean
  followUpNeeded: boolean
  followUpNotes: string
  visitOutcome: string
}>

export async function patchHomeVisitation(id: number, body: PatchHomeVisitationBody): Promise<T.HomeVisitation> {
  return parseJson<T.HomeVisitation>(
    await apiFetch(`${base}/home-visitations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  )
}

export async function getInterventionPlans(residentId?: number): Promise<T.InterventionPlan[]> {
  const q = residentId != null ? `?residentId=${residentId}` : ''
  return parseJson<T.InterventionPlan[]>(await apiFetch(`${base}/intervention-plans${q}`))
}

export async function getReportsSummary(): Promise<T.ReportsSummary> {
  return parseJson<T.ReportsSummary>(await apiFetch(`${base}/reports/summary`))
}

export async function getPlannedSocialPosts(): Promise<T.PlannedSocialPost[]> {
  return parseJson<T.PlannedSocialPost[]>(await apiFetch(`${base}/social-planner/posts`))
}

export async function createPlannedSocialPosts(body: {
  sourcePrompt?: string
  posts: Array<{
    title: string
    platform: string
    contentType: string
    format: string
    imageIdea?: string
    caption: string
    hashtags?: string[]
    cta?: string
    suggestedTime?: string
    scheduledForUtc?: string
    whyItFits?: string
    notes?: string
  }>
}): Promise<T.PlannedSocialPost[]> {
  const payload = {
    sourcePrompt: body.sourcePrompt,
    posts: body.posts.map((post) => ({
      ...post,
      scheduledForUtc: post.scheduledForUtc ? new Date(post.scheduledForUtc).toISOString() : undefined,
    })),
  }
  return parseJson<T.PlannedSocialPost[]>(
    await apiFetch(`${base}/social-planner/posts/bulk`, { method: 'POST', body: JSON.stringify(payload) }),
  )
}

export async function requestSchedulePlannedSocialPost(id: number): Promise<T.PlannedSocialPost> {
  return parseJson<T.PlannedSocialPost>(
    await apiFetch(`${base}/social-planner/posts/${id}/schedule-request`, { method: 'POST' }),
  )
}

export async function schedulePlannedSocialPostToFacebook(id: number): Promise<T.PlannedSocialPost> {
  return parseJson<T.PlannedSocialPost>(
    await apiFetch(`${base}/social-planner/posts/${id}/schedule-facebook`, { method: 'POST' }),
  )
}

export async function patchPlannedSocialPostStatus(id: number, status: string): Promise<T.PlannedSocialPost> {
  return parseJson<T.PlannedSocialPost>(
    await apiFetch(`${base}/social-planner/posts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  )
}

export async function deleteSupporter(id: number): Promise<void> {
  const res = await apiFetch(`${base}/supporters/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete supporter failed: ${res.status}`)
}

export async function patchSupporterFields(
  id: number,
  fields: Record<string, string | null | undefined>,
): Promise<T.Supporter> {
  return parseJson<T.Supporter>(
    await apiFetch(`${base}/supporters/${id}/fields`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    }),
  )
}

export async function deleteDonation(id: number): Promise<void> {
  const res = await apiFetch(`${base}/donations/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete donation failed: ${res.status}`)
}

export async function patchDonationFields(
  id: number,
  fields: Record<string, string | null | undefined>,
): Promise<T.Donation> {
  return parseJson<T.Donation>(
    await apiFetch(`${base}/donations/${id}/fields`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    }),
  )
}

export async function createAllocation(body: {
  donationId: number
  safehouseId: number
  amount?: number | null
  notes?: string | null
  programArea?: string | null
}): Promise<T.DonationAllocation> {
  return parseJson<T.DonationAllocation>(
    await apiFetch(`${base}/donation-allocations`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export async function patchAllocationFields(
  id: number,
  fields: Record<string, string | null | undefined>,
): Promise<T.DonationAllocation> {
  return parseJson<T.DonationAllocation>(
    await apiFetch(`${base}/donation-allocations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    }),
  )
}

export async function deleteAllocation(id: number): Promise<void> {
  const res = await apiFetch(`${base}/donation-allocations/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete allocation failed: ${res.status}`)
}

export async function createInterventionPlan(body: {
  residentId: number
  planCategory: string
  planDescription: string
  status?: string | null
  targetDate?: string | null
  targetValue?: number | null
  caseConferenceDate?: string | null
  servicesProvided?: string | null
}): Promise<T.InterventionPlan> {
  return parseJson<T.InterventionPlan>(
    await apiFetch(`${base}/intervention-plans`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export type PatchInterventionPlanBody = Partial<{
  planCategory: string
  planDescription: string
  servicesProvided: string
  targetValue: number
  targetDate: string
  status: string
  caseConferenceDate: string
}>

export async function patchInterventionPlan(id: number, body: PatchInterventionPlanBody): Promise<T.InterventionPlan> {
  return parseJson<T.InterventionPlan>(
    await apiFetch(`${base}/intervention-plans/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  )
}

export async function deleteInterventionPlan(id: number): Promise<void> {
  const res = await apiFetch(`${base}/intervention-plans/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete intervention plan failed: ${res.status}`)
}

export async function deleteResident(id: number): Promise<void> {
  const res = await apiFetch(`${base}/residents/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete resident failed: ${res.status}`)
}

export async function deleteProcessRecording(id: number): Promise<void> {
  const res = await apiFetch(`${base}/process-recordings/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete process recording failed: ${res.status}`)
}

export async function deleteHomeVisitation(id: number): Promise<void> {
  const res = await apiFetch(`${base}/home-visitations/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete home visitation failed: ${res.status}`)
}

export async function deletePlannedSocialPost(id: number): Promise<void> {
  const res = await apiFetch(`${base}/social-planner/posts/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete planned post failed: ${res.status}`)
}

export async function updatePlannedSocialPost(
  id: number,
  body: {
    title?: string
    caption?: string
    hashtags?: string
    notes?: string
    imageIdea?: string
    cta?: string
    suggestedTime?: string
  },
): Promise<T.PlannedSocialPost> {
  return parseJson<T.PlannedSocialPost>(
    await apiFetch(`${base}/social-planner/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  )
}

export async function listEducationRecords(residentId?: number): Promise<T.EducationRecord[]> {
  const q = residentId != null ? `?residentId=${residentId}` : ''
  return parseJson<T.EducationRecord[]>(await apiFetch(`${base}/education-records${q}`))
}

export async function createEducationRecord(opts: {
  residentId: number
  recordDate?: string
  progressPercent?: number | null
  extendedJson?: string | null
}): Promise<T.EducationRecord> {
  const body = {
    residentId: opts.residentId,
    recordDate: opts.recordDate ? new Date(opts.recordDate) : undefined,
    progressPercent: opts.progressPercent ?? undefined,
    extendedJson: opts.extendedJson ?? undefined,
  }
  return parseJson<T.EducationRecord>(
    await apiFetch(`${base}/education-records`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export async function patchEducationRecord(
  id: number,
  patch: {
    progressPercent?: number | null
    recordDate?: string
    extendedJson?: string | null
  },
): Promise<T.EducationRecord> {
  const body = {
    progressPercent: patch.progressPercent ?? undefined,
    recordDate: patch.recordDate ?? undefined,
    extendedJson: patch.extendedJson,
  }
  return parseJson<T.EducationRecord>(
    await apiFetch(`${base}/education-records/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  )
}

export async function listHealthRecords(residentId?: number): Promise<T.HealthRecord[]> {
  const q = residentId != null ? `?residentId=${residentId}` : ''
  return parseJson<T.HealthRecord[]>(await apiFetch(`${base}/health-records${q}`))
}

export async function createHealthRecord(opts: {
  residentId: number
  recordDate?: string
  healthScore?: number | null
  extendedJson?: string | null
}): Promise<T.HealthRecord> {
  const body = {
    residentId: opts.residentId,
    recordDate: opts.recordDate ? new Date(opts.recordDate) : undefined,
    healthScore: opts.healthScore ?? undefined,
    extendedJson: opts.extendedJson ?? undefined,
  }
  return parseJson<T.HealthRecord>(
    await apiFetch(`${base}/health-records`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export async function patchHealthRecord(
  id: number,
  patch: {
    healthScore?: number | null
    recordDate?: string
    extendedJson?: string | null
  },
): Promise<T.HealthRecord> {
  const body = {
    healthScore: patch.healthScore ?? undefined,
    recordDate: patch.recordDate ?? undefined,
    extendedJson: patch.extendedJson,
  }
  return parseJson<T.HealthRecord>(
    await apiFetch(`${base}/health-records/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  )
}

export async function listIncidentReports(residentId?: number): Promise<T.IncidentReport[]> {
  const qs = residentId ? `?residentId=${residentId}` : ''
  return parseJson<T.IncidentReport[]>(await apiFetch(`${base}/incident-reports${qs}`))
}

export async function createIncidentReport(
  residentId: number,
  fields: Record<string, string>,
): Promise<T.IncidentReport> {
  const body = {
    residentId,
    safehouseId: fields.safehouse_id ? parseInt(fields.safehouse_id, 10) : null,
    incidentDate: fields.incident_date ?? null,
    incidentType: fields.incident_type ?? 'Medical',
    severity: fields.severity ?? 'Medium',
    description: fields.description ?? null,
    responseTaken: fields.response_taken ?? null,
    resolved: fields.resolved === 'true' || fields.resolved === '1',
    resolutionDate: fields.resolution_date ?? null,
    reportedBy: fields.reported_by ?? null,
    followUpRequired: fields.follow_up_required === 'true' || fields.follow_up_required === '1',
  }
  return parseJson<T.IncidentReport>(
    await apiFetch(`${base}/incident-reports`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export async function patchIncidentReport(
  id: number,
  fields: Record<string, string | null | undefined>,
): Promise<T.IncidentReport> {
  return parseJson<T.IncidentReport>(
    await apiFetch(`${base}/incident-reports/${id}`, { method: 'PATCH', body: JSON.stringify(fields) }),
  )
}

export async function getMarketingAnalyticsSummary(): Promise<T.MarketingAnalyticsSummary> {
  return parseJson<T.MarketingAnalyticsSummary>(await apiFetch('/api/marketing/summary'))
}
