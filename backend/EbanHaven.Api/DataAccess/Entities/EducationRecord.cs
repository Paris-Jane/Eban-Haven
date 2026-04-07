using System.ComponentModel.DataAnnotations.Schema;

namespace EbanHaven.Api.DataAccess.Entities;

public sealed class EducationRecord
{
    [Column("education_record_id")] public int EducationRecordId { get; set; }
    [Column("resident_id")] public int ResidentId { get; set; }
    [Column("record_date")] public DateOnly RecordDate { get; set; }
    [Column("progress_percent")] public double? ProgressPercent { get; set; }
}

