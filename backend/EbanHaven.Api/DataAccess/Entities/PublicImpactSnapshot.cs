using System.ComponentModel.DataAnnotations.Schema;

namespace EbanHaven.Api.DataAccess.Entities;

public sealed class PublicImpactSnapshot
{
    [Column("snapshot_id")] public int SnapshotId { get; set; }
    [Column("snapshot_date")] public DateOnly SnapshotDate { get; set; }
    [Column("headline")] public string Headline { get; set; } = "";
    [Column("summary_text")] public string SummaryText { get; set; } = "";
    [Column("metric_payload_json")] public string? MetricPayloadJson { get; set; }
    [Column("is_published")] public bool IsPublished { get; set; }
}

