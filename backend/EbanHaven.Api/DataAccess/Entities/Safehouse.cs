using System.ComponentModel.DataAnnotations.Schema;

namespace EbanHaven.Api.DataAccess.Entities;

public sealed class Safehouse
{
    [Column("safehouse_id")] public int SafehouseId { get; set; }
    [Column("safehouse_code")] public string SafehouseCode { get; set; } = "";
    [Column("name")] public string Name { get; set; } = "";
    [Column("region")] public string Region { get; set; } = "";
    [Column("status")] public string Status { get; set; } = "";
    [Column("capacity_girls")] public int CapacityGirls { get; set; }
    [Column("current_occupancy")] public int CurrentOccupancy { get; set; }
}

