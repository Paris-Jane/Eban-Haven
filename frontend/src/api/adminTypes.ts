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
  /** Present age label from program data (e.g. CSV `present_age`). */
  presentAge?: string | null
  lengthOfStay?: string | null
  currentRiskLevel?: string | null
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
  relationshipType?: string | null
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

export type DonorEmailProfile = {
  supporter: Supporter
  donationCount: number
  lifetimeMonetaryTotal: number
  preferredCurrencyCode: string
  largestGiftAmount: number | null
  mostRecentDonationDate: string | null
  hasRecurringGift: boolean
  recentCampaigns: string[]
  programAreas: string[]
  recentDonations: Donation[]
  recentAllocations: DonationAllocation[]
  relationshipSummary: string
}

export type GeneratedDonorEmail = {
  subject: string
  preview: string
  body: string
  htmlBody: string
  usedAi: boolean
  strategy: string
}

export type SentDonorEmail = {
  providerMessageId: string
  toEmail: string
  sentAtUtc: string
}

export type SafehouseOption = { id: number; code: string; name: string; region: string }

export type EducationRecord = {
  id: number
  residentId: number
  recordDate: string
  educationLevel: string | null
  schoolName: string | null
  enrollmentStatus: string | null
  attendanceRate: number | null
  progressPercent: number | null
  completionStatus: string | null
  notes: string | null
  /** JSON string: program/course/attendance/completion metadata */
  extendedJson?: string | null
}

export type HealthRecord = {
  id: number
  residentId: number
  recordDate: string
  healthScore: number | null
  nutritionScore: number | null
  sleepQualityScore: number | null
  energyLevelScore: number | null
  heightCm: number | null
  weightKg: number | null
  bmi: number | null
  medicalCheckupDone: boolean | null
  dentalCheckupDone: boolean | null
  psychologicalCheckupDone: boolean | null
  notes: string | null
  /** JSON string: vitals, sub-scores, checkup flags */
  extendedJson?: string | null
}

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

export type IncidentReport = {
  id: number
  residentId: number
  safehouseId: number | null
  incidentDate: string
  incidentType: string
  severity: string
  description: string | null
  responseTaken: string | null
  resolved: boolean
  resolutionDate: string | null
  reportedBy: string | null
  followUpRequired: boolean
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

export type PlannedSocialPost = {
  id: number
  title: string
  platform: string
  contentType: string
  format: string
  imageIdea: string | null
  caption: string
  hashtags: string[]
  cta: string | null
  suggestedTime: string | null
  scheduledForUtc: string | null
  whyItFits: string | null
  notes: string | null
  sourcePrompt: string | null
  status: string
  facebookPageId: string | null
  facebookPostId: string | null
  facebookMediaUrl: string | null
  schedulingError: string | null
  createdAtUtc: string
  updatedAtUtc: string
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

export type AtRiskDonorInfo = {
  supporter_id: number | null
  churn_probability: number
  prediction: string
  risk_tier: 'High Risk' | 'Moderate Risk' | 'Low Risk'
  threshold_used: number
  top_risk_signals: string[]
}

export type DonorUpgradeInfo = {
  supporter_id: number | null
  upgrade_probability: number
  prediction: string           // "Likely to Upgrade" | "Unlikely"
  propensity_tier: string      // "High" | "Moderate" | "Low"
  threshold_used: number
  top_upgrade_signals: string[]
}

// ── Marketing Analytics ───────────────────────────────────────────────────────

export type CampaignPerformance = {
  campaignName: string
  donationCount: number
  uniqueDonors: number
  totalPhp: number
  avgAmount: number
  maxAmount: number
  recurringPct: number
  firstDonation: string
  lastDonation: string
}

export type ChannelAttribution = {
  channelSource: string
  uniqueDonors: number
  totalDonations: number
  totalPhp: number
  avgDonorLtv: number
  avgDonationAmount: number
  avgDonationsPerDonor: number
  pctRecurringDonors: number
}

export type SocialMediaSpotlight = {
  donationCount: number
  totalPhp: number
  avgAmount: number
  recurringPct: number
  uniqueDonors: number
  acquiredDonors: number
  avgLtvAcquiredPhp: number | null
  avgLtvAllDonorsPhp: number
}

export type EffectivenessRanking = {
  label: string
  postCount: number
  medianRevenuePerPostPhp: number
  medianDonationReferrals: number
  medianRevenuePerThousandReachPhp: number
  medianClickThroughRatePct: number
}

export type CausalEstimate = {
  coefficient: number
  ci_lower: number
  ci_upper: number
  p_value: number
  pct_effect: number
  significant: boolean
}

export type MarketingAnalyticsSummary = {
  campaigns: CampaignPerformance[]
  channels: ChannelAttribution[]
  socialMediaSpotlight: SocialMediaSpotlight
  effectiveness: {
    platforms: EffectivenessRanking[]
    daysOfWeek: EffectivenessRanking[]
    contentTopics: EffectivenessRanking[]
    recurringHashtags: EffectivenessRanking[]
    campaignHashtags: EffectivenessRanking[]
  }
  causalEstimates: {
    pipeline_version: string
    last_run: string
    n_observations: number
    r_squared: number
    campaign_lift: CausalEstimate | null
    channel_effects: Array<{ channel: string } & CausalEstimate>
    social_media_spotlight: Record<string, number | null>
  } | null
  lastAnalysisRun: string | null
}
