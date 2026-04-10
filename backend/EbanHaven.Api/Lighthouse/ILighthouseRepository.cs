namespace EbanHaven.Api.Lighthouse;

public interface ILighthouseRepository
{
    AdminDashboardDto GetAdminDashboard();

    IReadOnlyList<SafehouseOptionDto> ListSafehousesOptions();
    IReadOnlyList<SupporterDto> ListSupporters();
    SupporterDto CreateSupporter(string supporterType, string displayName, string? email, string? region, string status);
    SupporterDto? UpdateSupporter(int id, string? status, string? supporterType);

    IReadOnlyList<DonationDto> ListDonations(int? supporterId);
    DonationDto CreateDonation(int supporterId, string donationType, DateTime donationDate, decimal? amount, string? currencyCode,
        string? notes, string? campaignName);
    IReadOnlyList<DonationAllocationDto> ListAllocations(int? donationId, int? safehouseId);

    IReadOnlyList<ResidentSummaryDto> ListResidents(string? status, int? safehouseId, string? category, string? search);
    ResidentDetailDto? GetResident(int id);
    bool UpdateResident(int id, IReadOnlyDictionary<string, string?> patch);
    ResidentSummaryDto? UpdateResidentStatus(int id, string caseStatus);
    ResidentSummaryDto CreateResident(string? internalCode, string caseStatus, string? caseCategory);

    IReadOnlyList<ProcessRecordingDto> ListProcessRecordings(int? residentId);
    ProcessRecordingDto CreateProcessRecording(int residentId, DateTime sessionDate, string socialWorker, string sessionType,
        int? durationMinutes, string? emotionalStart, string? emotionalEnd, string narrative, string? interventions, string? followUp,
        bool? progressNoted, bool? concernsFlagged, bool? referralMade);
    ProcessRecordingDto? PatchProcessRecording(int id, PatchProcessRecordingDto patch);

    IReadOnlyList<HomeVisitationDto> ListHomeVisitations(int? residentId);
    HomeVisitationDto CreateHomeVisitation(int residentId, DateTime visitDate, string socialWorker, string visitType,
        string? locationVisited, string? observations, string? familyCooperation, bool safetyConcerns, bool followUpNeeded,
        string? followUpNotes, string? purpose, string? familyMembersPresent, string? visitOutcome);
    HomeVisitationDto? PatchHomeVisitation(int id, PatchHomeVisitationDto patch);

    IReadOnlyList<InterventionPlanDto> ListInterventionPlans(int? residentId);
    InterventionPlanDto CreateInterventionPlan(int residentId, string planCategory, string planDescription, string? status,
        DateOnly? targetDate, DateOnly? caseConferenceDate, double? targetValue, string? servicesProvided);
    InterventionPlanDto? PatchInterventionPlan(int id, PatchInterventionPlanDto patch);

    bool DeleteSupporter(int id);
    SupporterDto? PatchSupporterFields(int id, IReadOnlyDictionary<string, string?> fields);
    bool DeleteDonation(int id);
    DonationDto? PatchDonationFields(int id, IReadOnlyDictionary<string, string?> fields);
    DonationAllocationDto CreateAllocation(int donationId, int safehouseId, decimal? amount, string? notes, string? programArea);
    DonationAllocationDto? PatchAllocationFields(int id, IReadOnlyDictionary<string, string?> fields);
    bool DeleteAllocation(int id);
    bool DeleteInterventionPlan(int id);
    bool DeleteResident(int id);
    bool DeleteProcessRecording(int id);
    bool DeleteHomeVisitation(int id);
    IReadOnlyList<EducationRecordDto> ListEducationRecords(int? residentId);
    EducationRecordDto CreateEducationRecord(int residentId, DateOnly recordDate, string? educationLevel, string? schoolName,
        string? enrollmentStatus, double? attendanceRate, double? progressPercent, string? completionStatus, string? notes,
        string? extendedJson = null);
    EducationRecordDto? PatchEducationRecord(int id, string? educationLevel, string? schoolName, string? enrollmentStatus,
        double? attendanceRate, double? progressPercent, string? completionStatus, string? notes, DateOnly? recordDate,
        string? extendedJson = null);
    IReadOnlyList<HealthRecordDto> ListHealthRecords(int? residentId);
    HealthRecordDto CreateHealthRecord(int residentId, DateOnly recordDate, double? healthScore, double? nutritionScore,
        double? sleepQualityScore, double? energyLevelScore, double? heightCm, double? weightKg, double? bmi,
        bool? medicalCheckupDone, bool? dentalCheckupDone, bool? psychologicalCheckupDone, string? notes,
        string? extendedJson = null);
    HealthRecordDto? PatchHealthRecord(int id, double? healthScore, double? nutritionScore, double? sleepQualityScore,
        double? energyLevelScore, double? heightCm, double? weightKg, double? bmi, bool? medicalCheckupDone,
        bool? dentalCheckupDone, bool? psychologicalCheckupDone, string? notes, DateOnly? recordDate,
        string? extendedJson = null);
    bool DeleteHealthRecord(int id);

    IReadOnlyList<IncidentReportDto> ListIncidentReports(int? residentId);
    IncidentReportDto CreateIncidentReport(int residentId, int? safehouseId, DateOnly incidentDate, string incidentType,
        string severity, string? description, string? responseTaken, bool resolved, DateOnly? resolutionDate,
        string? reportedBy, bool followUpRequired);
    IncidentReportDto? PatchIncidentReport(int id, IReadOnlyDictionary<string, string?> fields);
    bool DeleteIncidentReport(int id);

    ReportsSummaryDto GetReportsSummary();
    PublicImpactSummaryDto GetPublicImpactSummary();
    IReadOnlyList<PublicImpactSnapshotDto> GetPublishedSnapshots();
    IReadOnlyList<EnrollmentGrowthPointDto> GetEnrollmentGrowthSeries();
}
