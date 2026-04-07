export type DashboardSummary = {
  activeResidentsTotal: number
  safehouses: SafehouseOccupancy[]
  recentDonations: RecentDonationRow[]
  upcomingCaseConferences: UpcomingConference[]
  monetaryDonationsLast30DaysPhp: number
  processRecordingsCount: number
  homeVisitationsLast90Days: number
  reintegration: { completedCount: number; inProgressCount: number; successRatePercent: number }
}

export type SafehouseOccupancy = {
  id: number
  code: string
  name: string
  region: string
  occupancy: number
  capacity: number
}

export type RecentDonationRow = {
  donationId: number
  supporterDisplayName: string
  donationType: string
  amount: number | null
  currencyCode: string | null
  donationDate: string
  campaignName: string | null
}

export type UpcomingConference = {
  planId: number
  residentId: number
  residentInternalCode: string
  planCategory: string
  caseConferenceDate: string | null
  status: string
  planDescription: string | null
}

export type Case = {
  id: string
  referenceCode: string
  status: string
  opened: string
  summary: string | null
}

export type ResidentSummary = {
  id: number
  caseControlNo: string
  internalCode: string
  safehouseId: number
  safehouseName: string | null
  caseStatus: string
  caseCategory: string
  sex: string
  assignedSocialWorker: string | null
  dateOfAdmission: string | null
  reintegrationStatus: string | null
  reintegrationType: string | null
}

export type ResidentDetail = { id: number; fields: Record<string, string> }

export type Supporter = {
  id: number
  supporterType: string
  displayName: string
  organizationName: string | null
  firstName: string | null
  lastName: string | null
  region: string | null
  country: string | null
  email: string | null
  phone: string | null
  status: string
  firstDonationDate: string | null
  acquisitionChannel: string | null
}

/** Create supporter (REST accepts a subset; Supabase can persist all optional fields). */
export type CreateSupporterBody = {
  supporterType: string
  displayName: string
  email?: string
  region?: string
  status?: string
  organizationName?: string
  firstName?: string
  lastName?: string
  relationshipType?: string
  country?: string
  phone?: string
  acquisitionChannel?: string
}

export type JsonTableRow = { id: number; fields: Record<string, string> }

export type Donation = {
  id: number
  supporterId: number
  supporterDisplayName: string
  donationType: string
  donationDate: string
  isRecurring: boolean
  campaignName: string | null
  channelSource: string | null
  currencyCode: string | null
  amount: number | null
  estimatedValue: number | null
  impactUnit: string | null
  notes: string | null
}

export type DonationAllocation = {
  id: number
  donationId: number
  safehouseId: number
  safehouseName: string | null
  programArea: string
  amountAllocated: number
  allocationDate: string
  notes: string | null
}

export type SafehouseOption = { id: number; code: string; name: string; region: string }

export type ProcessRecording = {
  id: number
  residentId: number
  residentInternalCode: string
  sessionDate: string
  socialWorker: string
  sessionType: string
  sessionDurationMinutes: number | null
  emotionalStateObserved: string | null
  emotionalStateEnd: string | null
  sessionNarrative: string
  interventionsApplied: string | null
  followUpActions: string | null
  progressNoted: boolean
  concernsFlagged: boolean
  referralMade: boolean
}

export type HomeVisitation = {
  id: number
  residentId: number
  residentInternalCode: string
  visitDate: string
  socialWorker: string
  visitType: string
  locationVisited: string | null
  familyMembersPresent: string | null
  purpose: string | null
  observations: string | null
  familyCooperationLevel: string | null
  safetyConcernsNoted: boolean
  followUpNeeded: boolean
  followUpNotes: string | null
  visitOutcome: string | null
}

export type InterventionPlan = {
  id: number
  residentId: number
  residentInternalCode: string
  planCategory: string
  planDescription: string
  servicesProvided: string | null
  targetValue: number | null
  targetDate: string | null
  status: string
  caseConferenceDate: string | null
  createdAt: string
  updatedAt: string
}

export type ReportsSummary = {
  totalResidents: number
  activeResidents: number
  closedResidents: number
  totalMonetaryDonationsPhp: number
  processRecordingsCount: number
  donationTrends: { month: string; monetaryTotalPhp: number; donationCount: number }[]
  safehousePerformance: SafehousePerformance[]
  outcomeMetrics: {
    avgEducationProgressPercent: number
    avgHealthScore: number
    educationRecordsCount: number
    healthRecordsCount: number
  }
  annualAccomplishmentStyle: {
    beneficiaryResidentsServed: number
    servicesProvided: { caringSessions: number; healingSessions: number; teachingSessions: number }
    programOutcomeHighlights: string[]
  }
}

export type SafehousePerformance = {
  safehouseId: number
  name: string
  activeResidents: number
  capacity: number
  occupancyRatePercent: number
  avgEducationProgress: number | null
  avgHealthScore: number | null
}
