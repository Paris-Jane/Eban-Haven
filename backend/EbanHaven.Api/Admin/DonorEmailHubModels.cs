using EbanHaven.Api.Lighthouse;

namespace EbanHaven.Api.Admin;

public sealed record DonorEmailProfileDto(
    SupporterDto Supporter,
    int DonationCount,
    decimal LifetimeMonetaryTotal,
    string PreferredCurrencyCode,
    decimal? LargestGiftAmount,
    DateTime? MostRecentDonationDate,
    bool HasRecurringGift,
    IReadOnlyList<string> RecentCampaigns,
    IReadOnlyList<string> ProgramAreas,
    IReadOnlyList<DonationDto> RecentDonations,
    IReadOnlyList<DonationAllocationDto> RecentAllocations,
    string RelationshipSummary);

public sealed record GenerateDonorEmailRequest(
    string? Goal,
    string? Tone,
    string? SenderName,
    string? SenderTitle,
    string? SenderOrganization,
    string? SenderContact,
    bool PreferAi = true);

public sealed record GeneratedDonorEmailDto(
    string Subject,
    string Preview,
    string Body,
    bool UsedAi,
    string Strategy);
