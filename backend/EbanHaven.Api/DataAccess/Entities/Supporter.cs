using System.ComponentModel.DataAnnotations.Schema;

namespace EbanHaven.Api.DataAccess.Entities;

public sealed class Supporter
{
    [Column("supporter_id")] public int SupporterId { get; set; }
    [Column("supporter_type")] public string SupporterType { get; set; } = "";
    [Column("display_name")] public string DisplayName { get; set; } = "";
    [Column("organization_name")] public string? OrganizationName { get; set; }
    [Column("first_name")] public string? FirstName { get; set; }
    [Column("last_name")] public string? LastName { get; set; }
    [Column("region")] public string? Region { get; set; }
    [Column("country")] public string? Country { get; set; }
    [Column("email")] public string? Email { get; set; }
    [Column("phone")] public string? Phone { get; set; }
    [Column("status")] public string Status { get; set; } = "";
    [Column("first_donation_date")] public string? FirstDonationDate { get; set; }
    [Column("acquisition_channel")] public string? AcquisitionChannel { get; set; }
}

