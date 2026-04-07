using EbanHaven.Api.Auth;
using EbanHaven.Api.SocialChat;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EbanHaven.Api.Controllers;

[ApiController]
[Route("api/social-chat")]
[Authorize(Policy = AdminOnlyPolicy.Name)]
public sealed class SocialChatController(ISocialChatService socialChatService) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(SocialChatResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Post([FromBody] SocialChatRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await socialChatService.GetReplyAsync(request, cancellationToken);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = ex.Message });
        }
    }
}
