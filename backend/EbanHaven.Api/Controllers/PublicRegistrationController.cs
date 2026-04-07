using EbanHaven.Api.Lighthouse;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EbanHaven.Api.Controllers;

[ApiController]
[Route("api/public")]
public sealed class PublicRegistrationController(ILighthouseRepository repo) : ControllerBase
{
    [HttpPost("supporters")]
    [AllowAnonymous]
    public IActionResult RegisterSupporter([FromBody] PublicSupporterRegistration body)
    {
        if (string.IsNullOrWhiteSpace(body.DisplayName))
            return BadRequest(new { error = "DisplayName is required." });

        var supporterType = string.IsNullOrWhiteSpace(body.SupporterType) ? "MonetaryDonor" : body.SupporterType.Trim();
        var status = "Active";

        var created = repo.CreateSupporter(
            supporterType,
            body.DisplayName.Trim(),
            string.IsNullOrWhiteSpace(body.Email) ? null : body.Email.Trim().ToLowerInvariant(),
            string.IsNullOrWhiteSpace(body.Region) ? null : body.Region.Trim(),
            status);

        return Created($"/api/admin/supporters/{created.Id}", created);
    }
}

public sealed record PublicSupporterRegistration(
    string DisplayName,
    string? Email,
    string? Region,
    string? SupporterType);

