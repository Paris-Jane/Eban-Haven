using System.ComponentModel.DataAnnotations.Schema;

namespace EbanHaven.Api.DataAccess.Entities;

public sealed class SafehouseMonthlyMetric
{
    [Column("metric_id")] public int MetricId { get; set; }
    [Column("safehouse_id")] public int SafehouseId { get; set; }
    [Column("month_start")] public DateOnly MonthStart { get; set; }
    [Column("avg_education_progress")] public double? AvgEducationProgress { get; set; }
    [Column("avg_health_score")] public double? AvgHealthScore { get; set; }
}

