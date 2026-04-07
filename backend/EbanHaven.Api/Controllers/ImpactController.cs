using EbanHaven.Api.Lighthouse;
using Microsoft.AspNetCore.Mvc;

namespace EbanHaven.Api.Controllers;

[ApiController]
[Route("api/impact")]
public sealed class ImpactController(ILighthouseRepository repo) : ControllerBase
{
    [HttpGet("summary")]
    public IActionResult Summary() => Ok(repo.GetPublicImpactSummary());

    [HttpGet("snapshots")]
    public IActionResult Snapshots() => Ok(repo.GetPublishedSnapshots());
}

