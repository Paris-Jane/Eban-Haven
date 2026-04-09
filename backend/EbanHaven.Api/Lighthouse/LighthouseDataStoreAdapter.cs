namespace EbanHaven.Api.Lighthouse;

public sealed class LighthouseDataStoreAdapter(LighthouseDataStore inner) : ILighthouseRepository
{
    public AdminDashboardDto GetAdminDashboard() => inner.GetAdminDashboard();
    public IReadOnlyList<SafehouseOptionDto> ListSafehousesOptions() => inner.ListSafehousesOptions();
    public IReadOnlyList<SupporterDto> ListSupporters() => inner.ListSupporters();
    public SupporterDto CreateSupporter(string supporterType, string displayName, string? email, string? region, string status) =>
        inner.CreateSupporter(supporterType, displayName, email, region, status);
    public SupporterDto? UpdateSupporter(int id, string? status, string? supporterType) => inner.UpdateSupporter(id, status, supporterType);
    public IReadOnlyList<DonationDto> ListDonations(int? supporterId) => inner.ListDonations(supporterId);
    public DonationDto CreateDonation(int supporterId, string donationType, DateTime donationDate, decimal? amount, string? currencyCode,
        string? notes, string? campaignName) =>
        inner.CreateDonation(supporterId, donationType, donationDate, amount, currencyCode, notes, campaignName);
    public IReadOnlyList<DonationAllocationDto> ListAllocations(int? donationId, int? safehouseId) => inner.ListAllocations(donationId, safehouseId);
    public IReadOnlyList<ResidentSummaryDto> ListResidents(string? status, int? safehouseId, string? category, string? search) =>
        inner.ListResidents(status, safehouseId, category, search);
    public ResidentDetailDto? GetResident(int id) => inner.GetResident(id);
    public bool UpdateResident(int id, IReadOnlyDictionary<string, string?> patch) => inner.UpdateResident(id, patch);
    public ResidentSummaryDto? UpdateResidentStatus(int id, string caseStatus) => inner.UpdateResidentStatus(id, caseStatus);
    public ResidentSummaryDto CreateResident(string? internalCode, string caseStatus, string? caseCategory) =>
        inner.CreateResident(internalCode, caseStatus, caseCategory);
    public IReadOnlyList<ProcessRecordingDto> ListProcessRecordings(int? residentId) => inner.ListProcessRecordings(residentId);
    public ProcessRecordingDto CreateProcessRecording(int residentId, DateTime sessionDate, string socialWorker, string sessionType,
        int? durationMinutes, string? emotionalStart, string? emotionalEnd, string narrative, string? interventions, string? followUp,
        bool? progressNoted, bool? concernsFlagged, bool? referralMade) =>
        inner.CreateProcessRecording(residentId, sessionDate, socialWorker, sessionType, durationMinutes, emotionalStart, emotionalEnd,
            narrative, interventions, followUp, progressNoted, concernsFlagged, referralMade);
    public ProcessRecordingDto? PatchProcessRecording(int id, PatchProcessRecordingDto patch) => inner.PatchProcessRecording(id, patch);
    public IReadOnlyList<HomeVisitationDto> ListHomeVisitations(int? residentId) => inner.ListHomeVisitations(residentId);
    public HomeVisitationDto CreateHomeVisitation(int residentId, DateTime visitDate, string socialWorker, string visitType,
        string? locationVisited, string? observations, string? familyCooperation, bool safetyConcerns, bool followUpNeeded,
        string? followUpNotes, string? purpose, string? familyMembersPresent, string? visitOutcome) =>
        inner.CreateHomeVisitation(residentId, visitDate, socialWorker, visitType, locationVisited, observations, familyCooperation,
            safetyConcerns, followUpNeeded, followUpNotes, purpose, familyMembersPresent, visitOutcome);
    public HomeVisitationDto? PatchHomeVisitation(int id, PatchHomeVisitationDto patch) => inner.PatchHomeVisitation(id, patch);
    public IReadOnlyList<InterventionPlanDto> ListInterventionPlans(int? residentId) => inner.ListInterventionPlans(residentId);
    public InterventionPlanDto CreateInterventionPlan(int residentId, string planCategory, string planDescription, string? status,
        DateOnly? targetDate, DateOnly? caseConferenceDate, double? targetValue, string? servicesProvided) =>
        inner.CreateInterventionPlan(residentId, planCategory, planDescription, status, targetDate, caseConferenceDate, targetValue, servicesProvided);
    public InterventionPlanDto? PatchInterventionPlan(int id, PatchInterventionPlanDto patch) => inner.PatchInterventionPlan(id, patch);

    public bool DeleteSupporter(int id) => throw new NotImplementedException();
    public SupporterDto? PatchSupporterFields(int id, IReadOnlyDictionary<string, string?> fields) => throw new NotImplementedException();
    public bool DeleteDonation(int id) => throw new NotImplementedException();
    public DonationDto? PatchDonationFields(int id, IReadOnlyDictionary<string, string?> fields) => throw new NotImplementedException();
    public DonationAllocationDto CreateAllocation(int donationId, int safehouseId, decimal? amount, string? notes, string? programArea) => throw new NotImplementedException();
    public DonationAllocationDto? PatchAllocationFields(int id, IReadOnlyDictionary<string, string?> fields) => throw new NotImplementedException();
    public bool DeleteAllocation(int id) => throw new NotImplementedException();
    public bool DeleteInterventionPlan(int id) => throw new NotImplementedException();
    public bool DeleteResident(int id) => throw new NotImplementedException();
    public bool DeleteProcessRecording(int id) => throw new NotImplementedException();
    public bool DeleteHomeVisitation(int id) => throw new NotImplementedException();
    public IReadOnlyList<EducationRecordDto> ListEducationRecords(int? residentId) => throw new NotImplementedException();
    public EducationRecordDto CreateEducationRecord(int residentId, DateOnly recordDate, double? progressPercent, string? extendedJson = null) =>
        throw new NotImplementedException();
    public EducationRecordDto? PatchEducationRecord(int id, double? progressPercent, DateOnly? recordDate, string? extendedJson = null) =>
        throw new NotImplementedException();
    public IReadOnlyList<HealthRecordDto> ListHealthRecords(int? residentId) => throw new NotImplementedException();
    public HealthRecordDto CreateHealthRecord(int residentId, DateOnly recordDate, double? healthScore, string? extendedJson = null) =>
        throw new NotImplementedException();
    public HealthRecordDto? PatchHealthRecord(int id, double? healthScore, DateOnly? recordDate, string? extendedJson = null) =>
        throw new NotImplementedException();

    public IReadOnlyList<IncidentReportDto> ListIncidentReports(int? residentId) => throw new NotImplementedException();
    public IncidentReportDto CreateIncidentReport(int residentId, int? safehouseId, DateOnly incidentDate, string incidentType,
        string severity, string? description, string? responseTaken, bool resolved, DateOnly? resolutionDate,
        string? reportedBy, bool followUpRequired) => throw new NotImplementedException();
    public IncidentReportDto? PatchIncidentReport(int id, IReadOnlyDictionary<string, string?> fields) => throw new NotImplementedException();
    public bool DeleteIncidentReport(int id) => throw new NotImplementedException();

    public ReportsSummaryDto GetReportsSummary() => inner.GetReportsSummary();
    public PublicImpactSummaryDto GetPublicImpactSummary() => inner.GetPublicImpactSummary();
    public IReadOnlyList<PublicImpactSnapshotDto> GetPublishedSnapshots() => inner.GetPublishedSnapshots();
}
