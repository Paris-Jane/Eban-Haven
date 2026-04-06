namespace EbanHaven.Api.Admin;

public static class AdminApiExtensions
{
    public static void MapAdminApi(this WebApplication app)
    {
        var admin = app.MapGroup("/api/admin");

        admin.MapGet("/dashboard", (AdminStore store) => Results.Ok(store.GetDashboard()));

        admin.MapGet("/donors", (AdminStore store) => Results.Ok(store.ListDonors()));
        admin.MapPost("/donors", (CreateDonorRequest body, AdminStore store) =>
        {
            if (string.IsNullOrWhiteSpace(body.DonorName))
                return Results.BadRequest(new { error = "DonorName is required." });
            if (body.Amount < 0)
                return Results.BadRequest(new { error = "Amount must be non-negative." });
            var date = body.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);
            var created = store.AddDonor(body.DonorName.Trim(), body.Amount, date, body.Note?.Trim());
            return Results.Created($"/api/admin/donors/{created.Id}", created);
        });

        admin.MapGet("/cases", (AdminStore store) => Results.Ok(store.ListCases()));
        admin.MapPost("/cases", (CreateCaseRequest body, AdminStore store) =>
        {
            if (string.IsNullOrWhiteSpace(body.ReferenceCode))
                return Results.BadRequest(new { error = "ReferenceCode is required." });
            if (string.IsNullOrWhiteSpace(body.Status))
                return Results.BadRequest(new { error = "Status is required." });
            var created = store.AddCase(body.ReferenceCode.Trim(), body.Status.Trim(), body.Summary?.Trim());
            return Results.Created($"/api/admin/cases/{created.Id}", created);
        });
        admin.MapPatch("/cases/{id:guid}/status", (Guid id, UpdateCaseStatusRequest body, AdminStore store) =>
        {
            if (string.IsNullOrWhiteSpace(body.Status))
                return Results.BadRequest(new { error = "Status is required." });
            var updated = store.UpdateCaseStatus(id, body.Status.Trim());
            return updated is null ? Results.NotFound() : Results.Ok(updated);
        });

        admin.MapGet("/visitations", (AdminStore store) => Results.Ok(store.ListVisitations()));
        admin.MapPost("/visitations", (CreateVisitationRequest body, AdminStore store) =>
        {
            if (string.IsNullOrWhiteSpace(body.VisitorName))
                return Results.BadRequest(new { error = "VisitorName is required." });
            if (string.IsNullOrWhiteSpace(body.Status))
                return Results.BadRequest(new { error = "Status is required." });
            var created = store.AddVisitation(body.CaseId, body.VisitorName.Trim(), body.ScheduledAt, body.Status.Trim());
            return Results.Created($"/api/admin/visitations/{created.Id}", created);
        });

        admin.MapGet("/process-recordings", (AdminStore store) => Results.Ok(store.ListRecordings()));
        admin.MapPost("/process-recordings", (CreateRecordingRequest body, AdminStore store) =>
        {
            if (string.IsNullOrWhiteSpace(body.Therapist))
                return Results.BadRequest(new { error = "Therapist is required." });
            if (string.IsNullOrWhiteSpace(body.Summary))
                return Results.BadRequest(new { error = "Summary is required." });
            var at = body.RecordedAt ?? DateTime.UtcNow;
            var created = store.AddRecording(body.CaseId, at, body.Therapist.Trim(), body.Summary.Trim());
            return Results.Created($"/api/admin/process-recordings/{created.Id}", created);
        });

        admin.MapGet("/reports/summary", (AdminStore store) => Results.Ok(store.GetReportsSummary()));
    }
}
