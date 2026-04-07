using EbanHaven.Api.Configuration;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace EbanHaven.Api.Controllers;

[ApiController]
[Route("api/site")]
public sealed class SiteController(IOptions<SiteOptions> options) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(SiteInfo), StatusCodes.Status200OK)]
    public ActionResult<SiteInfo> Get()
    {
        var o = options.Value;
        return Ok(new SiteInfo(o.Name, o.Description));
    }
}

public sealed record SiteInfo(string Name, string? Description);

