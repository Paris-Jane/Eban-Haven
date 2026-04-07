using System.ComponentModel.DataAnnotations.Schema;

namespace EbanHaven.Api.DataAccess.Entities;

public sealed class HealthWellbeingRecord
{
    [Column("health_record_id")] public int HealthRecordId { get; set; }
    [Column("resident_id")] public int ResidentId { get; set; }
    [Column("record_date")] public DateOnly RecordDate { get; set; }
    [Column("general_health_score")] public double? GeneralHealthScore { get; set; }
}

