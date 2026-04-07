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
    ResidentSummaryDto CreateResident(string internalCode, string caseStatus, string? caseCategory);

    IReadOnlyList<ProcessRecordingDto> ListProcessRecordings(int? residentId);
    ProcessRecordingDto CreateProcessRecording(int residentId, DateTime sessionDate, string socialWorker, string sessionType,
        int? durationMinutes, string? emotionalStart, string? emotionalEnd, string narrative, string? interventions, string? followUp);

    IReadOnlyList<HomeVisitationDto> ListHomeVisitations(int? residentId);
    HomeVisitationDto CreateHomeVisitation(int residentId, DateTime visitDate, string socialWorker, string visitType,
        string? locationVisited, string? observations, string? familyCooperation, bool safetyConcerns, bool followUpNeeded,
        string? followUpNotes);

    IReadOnlyList<InterventionPlanDto> ListInterventionPlans(int? residentId);

    ReportsSummaryDto GetReportsSummary();
    PublicImpactSummaryDto GetPublicImpactSummary();
    IReadOnlyList<PublicImpactSnapshotDto> GetPublishedSnapshots();
}

