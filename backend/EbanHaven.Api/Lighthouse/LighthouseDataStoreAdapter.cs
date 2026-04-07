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
    public ResidentSummaryDto CreateResident(string internalCode, string caseStatus, string? caseCategory) =>
        inner.CreateResident(internalCode, caseStatus, caseCategory);
    public IReadOnlyList<ProcessRecordingDto> ListProcessRecordings(int? residentId) => inner.ListProcessRecordings(residentId);
    public ProcessRecordingDto CreateProcessRecording(int residentId, DateTime sessionDate, string socialWorker, string sessionType,
        int? durationMinutes, string? emotionalStart, string? emotionalEnd, string narrative, string? interventions, string? followUp) =>
        inner.CreateProcessRecording(residentId, sessionDate, socialWorker, sessionType, durationMinutes, emotionalStart, emotionalEnd,
            narrative, interventions, followUp);
    public IReadOnlyList<HomeVisitationDto> ListHomeVisitations(int? residentId) => inner.ListHomeVisitations(residentId);
    public HomeVisitationDto CreateHomeVisitation(int residentId, DateTime visitDate, string socialWorker, string visitType,
        string? locationVisited, string? observations, string? familyCooperation, bool safetyConcerns, bool followUpNeeded,
        string? followUpNotes) =>
        inner.CreateHomeVisitation(residentId, visitDate, socialWorker, visitType, locationVisited, observations, familyCooperation,
            safetyConcerns, followUpNeeded, followUpNotes);
    public IReadOnlyList<InterventionPlanDto> ListInterventionPlans(int? residentId) => inner.ListInterventionPlans(residentId);
    public ReportsSummaryDto GetReportsSummary() => inner.GetReportsSummary();
    public PublicImpactSummaryDto GetPublicImpactSummary() => inner.GetPublicImpactSummary();
    public IReadOnlyList<PublicImpactSnapshotDto> GetPublishedSnapshots() => inner.GetPublishedSnapshots();
}

