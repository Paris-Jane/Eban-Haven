using EbanHaven.Api.DataAccess.Entities;
using Microsoft.EntityFrameworkCore;

namespace EbanHaven.Api.DataAccess;

public sealed class HavenDbContext(DbContextOptions<HavenDbContext> options) : DbContext(options)
{
    public DbSet<Resident> Residents => Set<Resident>();
    public DbSet<Supporter> Supporters => Set<Supporter>();
    public DbSet<Donation> Donations => Set<Donation>();
    public DbSet<DonationAllocation> DonationAllocations => Set<DonationAllocation>();
    public DbSet<Safehouse> Safehouses => Set<Safehouse>();
    public DbSet<ProcessRecording> ProcessRecordings => Set<ProcessRecording>();
    public DbSet<HomeVisitation> HomeVisitations => Set<HomeVisitation>();
    public DbSet<InterventionPlan> InterventionPlans => Set<InterventionPlan>();
    public DbSet<EducationRecord> EducationRecords => Set<EducationRecord>();
    public DbSet<HealthWellbeingRecord> HealthWellbeingRecords => Set<HealthWellbeingRecord>();
    public DbSet<PublicImpactSnapshot> PublicImpactSnapshots => Set<PublicImpactSnapshot>();
    public DbSet<SafehouseMonthlyMetric> SafehouseMonthlyMetrics => Set<SafehouseMonthlyMetric>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("public");

        modelBuilder.Entity<Resident>().ToTable("residents").HasKey(x => x.ResidentId);
        modelBuilder.Entity<Supporter>().ToTable("supporters").HasKey(x => x.SupporterId);
        modelBuilder.Entity<Donation>().ToTable("donations").HasKey(x => x.DonationId);
        modelBuilder.Entity<DonationAllocation>().ToTable("donation_allocations").HasKey(x => x.AllocationId);
        modelBuilder.Entity<Safehouse>().ToTable("safehouses").HasKey(x => x.SafehouseId);
        modelBuilder.Entity<ProcessRecording>().ToTable("process_recordings").HasKey(x => x.RecordingId);
        modelBuilder.Entity<HomeVisitation>().ToTable("home_visitations").HasKey(x => x.VisitationId);
        modelBuilder.Entity<InterventionPlan>().ToTable("intervention_plans").HasKey(x => x.PlanId);
        modelBuilder.Entity<EducationRecord>().ToTable("education_records").HasKey(x => x.EducationRecordId);
        modelBuilder.Entity<HealthWellbeingRecord>().ToTable("health_wellbeing_records").HasKey(x => x.HealthRecordId);
        modelBuilder.Entity<PublicImpactSnapshot>().ToTable("public_impact_snapshots").HasKey(x => x.SnapshotId);
        modelBuilder.Entity<SafehouseMonthlyMetric>().ToTable("safehouse_monthly_metrics").HasKey(x => x.MetricId);
    }
}

