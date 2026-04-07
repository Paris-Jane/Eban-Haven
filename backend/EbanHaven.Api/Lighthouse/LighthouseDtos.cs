namespace EbanHaven.Api.Lighthouse;

public sealed record AdminDashboardDto(
    int ActiveResidentsTotal,
    IReadOnlyList<SafehouseOccupancyDto> Safehouses,
    IReadOnlyList<RecentDonationRowDto> RecentDonations,
    IReadOnlyList<UpcomingConferenceDto> UpcomingCaseConferences,
    decimal MonetaryDonationsLast30DaysPhp,
    int ProcessRecordingsCount,
    int HomeVisitationsLast90Days,
    ReintegrationKpiDto Reintegration);

public sealed record SafehouseOccupancyDto(int Id, string Code, string Name, string Region, int Occupancy, int Capacity);

public sealed record RecentDonationRowDto(
    int DonationId,
    string SupporterDisplayName,
    string DonationType,
    decimal? Amount,
    string? CurrencyCode,
    DateTime DonationDate,
    string? CampaignName);

public sealed record UpcomingConferenceDto(
    int PlanId,
    int ResidentId,
    string ResidentInternalCode,
    string PlanCategory,
    DateTime? CaseConferenceDate,
    string Status,
    string? PlanDescription);

public sealed record ReintegrationKpiDto(int CompletedCount, int InProgressCount, double SuccessRatePercent);

public sealed record ResidentSummaryDto(
    int Id,
    string CaseControlNo,
    string InternalCode,
    int SafehouseId,
    string? SafehouseName,
    string CaseStatus,
    string CaseCategory,
    string Sex,
    string? AssignedSocialWorker,
    string? DateOfAdmission,
    string? ReintegrationStatus,
    string? ReintegrationType);

public sealed record ResidentDetailDto(
    int Id,
    IReadOnlyDictionary<string, string> Fields);

public sealed record SupporterDto(
    int Id,
    string SupporterType,
    string DisplayName,
    string? OrganizationName,
    string? FirstName,
    string? LastName,
    string? Region,
    string? Country,
    string? Email,
    string? Phone,
    string Status,
    string? FirstDonationDate,
    string? AcquisitionChannel);

public sealed record DonationDto(
    int Id,
    int SupporterId,
    string SupporterDisplayName,
    string DonationType,
    DateTime DonationDate,
    bool IsRecurring,
    string? CampaignName,
    string? ChannelSource,
    string? CurrencyCode,
    decimal? Amount,
    decimal? EstimatedValue,
    string? ImpactUnit,
    string? Notes);

public sealed record DonationAllocationDto(
    int Id,
    int DonationId,
    int SafehouseId,
    string? SafehouseName,
    string ProgramArea,
    decimal AmountAllocated,
    DateTime AllocationDate,
    string? Notes);

public sealed record ProcessRecordingDto(
    int Id,
    int ResidentId,
    string ResidentInternalCode,
    DateTime SessionDate,
    string SocialWorker,
    string SessionType,
    int? SessionDurationMinutes,
    string? EmotionalStateObserved,
    string? EmotionalStateEnd,
    string SessionNarrative,
    string? InterventionsApplied,
    string? FollowUpActions,
    bool ProgressNoted,
    bool ConcernsFlagged,
    bool ReferralMade);

public sealed record HomeVisitationDto(
    int Id,
    int ResidentId,
    string ResidentInternalCode,
    DateTime VisitDate,
    string SocialWorker,
    string VisitType,
    string? LocationVisited,
    string? FamilyMembersPresent,
    string? Purpose,
    string? Observations,
    string? FamilyCooperationLevel,
    bool SafetyConcernsNoted,
    bool FollowUpNeeded,
    string? FollowUpNotes,
    string? VisitOutcome);

public sealed record InterventionPlanDto(
    int Id,
    int ResidentId,
    string ResidentInternalCode,
    string PlanCategory,
    string PlanDescription,
    string? ServicesProvided,
    double? TargetValue,
    DateTime? TargetDate,
    string Status,
    DateTime? CaseConferenceDate,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record ReportsSummaryDto(
    int TotalResidents,
    int ActiveResidents,
    int ClosedResidents,
    decimal TotalMonetaryDonationsPhp,
    int ProcessRecordingsCount,
    IReadOnlyList<MonthlyDonationTrendDto> DonationTrends,
    IReadOnlyList<SafehousePerformanceDto> SafehousePerformance,
    ResidentOutcomeMetricsDto OutcomeMetrics,
    AarStyleReportDto AnnualAccomplishmentStyle);

public sealed record MonthlyDonationTrendDto(string Month, decimal MonetaryTotalPhp, int DonationCount);

public sealed record SafehousePerformanceDto(
    int SafehouseId,
    string Name,
    int ActiveResidents,
    int Capacity,
    double OccupancyRatePercent,
    double? AvgEducationProgress,
    double? AvgHealthScore);

public sealed record ResidentOutcomeMetricsDto(
    double AvgEducationProgressPercent,
    double AvgHealthScore,
    int EducationRecordsCount,
    int HealthRecordsCount);

public sealed record AarStyleReportDto(
    int BeneficiaryResidentsServed,
    ServicePillarCountsDto ServicesProvided,
    IReadOnlyList<string> ProgramOutcomeHighlights);

public sealed record ServicePillarCountsDto(int CaringSessions, int HealingSessions, int TeachingSessions);

public sealed record PublicImpactSummaryDto(
    int ActiveResidents,
    int SafehouseCount,
    double AvgEducationProgressPercent,
    double AvgHealthScore,
    decimal DonationsLastMonthPhp,
    int SupporterCount,
    double ReintegrationSuccessRatePercent);

public sealed record PublicImpactSnapshotDto(
    int Id,
    DateOnly SnapshotDate,
    string Headline,
    string SummaryText,
    IReadOnlyDictionary<string, string?> Metrics,
    bool IsPublished);

public sealed record SafehouseOptionDto(int Id, string Code, string Name, string Region);

// ── ML feature extraction DTOs ────────────────────────────────────────────────

/// <summary>Pre-computed feature vector for the Reintegration Readiness model.</summary>
public sealed record ReintegrationFeaturesDto(
    int    ResidentId,
    string SafehouseId,
    int    AgeAtEntry,
    int    DaysInProgram,
    string ReferralSource,
    double TotalSessions,
    double PctProgressNoted,
    double PctConcernsFlagged,
    double LatestAttendanceRate,
    double AvgProgressPercent,
    double AvgGeneralHealthScore,
    double PctPsychCheckupDone,
    double NumHealthRecords,
    double TotalIncidents,
    double NumSevereIncidents,
    double TotalPlans,
    double PctPlansAchieved
);

/// <summary>Pre-computed feature vector for the Donor Churn model.</summary>
public sealed record DonorChurnFeaturesDto(
    int    SupporterId,
    string SupporterType,
    double TotalDonations,
    double TotalAmountPhp,
    double MonthsSinceLastGift,
    double AvgGiftAmount,
    double DonationFrequency,
    double IsRecurring,
    double NumCampaigns,
    double ChannelDiversity
);
