using System.ComponentModel.DataAnnotations.Schema;

namespace EbanHaven.Api.DataAccess.Entities;

public sealed class Resident
{
    [Column("resident_id")] public int ResidentId { get; set; }
    [Column("case_control_no")] public string CaseControlNo { get; set; } = "";
    [Column("internal_code")] public string InternalCode { get; set; } = "";
    [Column("safehouse_id")] public int SafehouseId { get; set; }
    [Column("case_status")] public string CaseStatus { get; set; } = "";
    [Column("case_category")] public string CaseCategory { get; set; } = "";
    [Column("sex")] public string Sex { get; set; } = "";
    [Column("assigned_social_worker")] public string? AssignedSocialWorker { get; set; }
    [Column("date_of_admission")] public string? DateOfAdmission { get; set; }
    [Column("reintegration_status")] public string? ReintegrationStatus { get; set; }
    [Column("reintegration_type")] public string? ReintegrationType { get; set; }
}

