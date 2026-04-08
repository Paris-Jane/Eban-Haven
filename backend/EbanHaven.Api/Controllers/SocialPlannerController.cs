using EbanHaven.Api.Auth;
using EbanHaven.Api.SocialChat;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EbanHaven.Api.Controllers;

[ApiController]
[Route("api/admin/social-planner")]
[Authorize(Policy = AdminOnlyPolicy.Name)]
public sealed class SocialPlannerController(
    IPlannedSocialPostStore store,
    IMetaSchedulingService metaSchedulingService) : ControllerBase
{
    [HttpGet("posts")]
    [ProducesResponseType(typeof(IReadOnlyList<PlannedSocialPostDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListPosts(CancellationToken cancellationToken) =>
        Ok(await store.ListAsync(cancellationToken));

    [HttpPost("posts/bulk")]
    [ProducesResponseType(typeof(IReadOnlyList<PlannedSocialPostDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreatePosts([FromBody] CreatePlannedSocialPostsRequest request, CancellationToken cancellationToken)
    {
        if (request.Posts is null || request.Posts.Count == 0)
            return BadRequest(new { error = "At least one planned post is required." });

        var created = await store.CreateAsync(
            request.Posts.Select(post => new CreatePlannedSocialPostCommand(
                Title: post.Title,
                Platform: post.Platform,
                ContentType: post.ContentType,
                Format: post.Format,
                ImageIdea: post.ImageIdea,
                Caption: post.Caption,
                Hashtags: post.Hashtags,
                Cta: post.Cta,
                SuggestedTime: post.SuggestedTime,
                ScheduledForUtc: post.ScheduledForUtc,
                WhyItFits: post.WhyItFits,
                Notes: post.Notes,
                SourcePrompt: request.SourcePrompt))
            .ToArray(),
            cancellationToken);

        return Created("/api/admin/social-planner/posts", created);
    }

    [HttpPost("posts/{id:int}/schedule-request")]
    [ProducesResponseType(typeof(PlannedSocialPostDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ScheduleRequest(int id, CancellationToken cancellationToken)
    {
        var updated = await store.UpdateStatusAsync(id, "Schedule Requested", cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPost("posts/{id:int}/schedule-facebook")]
    [ProducesResponseType(typeof(PlannedSocialPostDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ScheduleFacebook(int id, CancellationToken cancellationToken)
    {
        var post = await store.GetAsync(id, cancellationToken);
        if (post is null)
            return NotFound();

        var result = await metaSchedulingService.ScheduleAsync(post, cancellationToken);
        var updated = await store.UpdateSchedulingAsync(id, result, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPatch("posts/{id:int}/status")]
    [ProducesResponseType(typeof(PlannedSocialPostDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdatePlannedSocialPostStatusRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Status))
            return BadRequest(new { error = "Status is required." });

        var updated = await store.UpdateStatusAsync(id, request.Status.Trim(), cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    public sealed record CreatePlannedSocialPostsRequest(
        IReadOnlyList<CreatePlannedSocialPostItem> Posts,
        string? SourcePrompt);

    public sealed record CreatePlannedSocialPostItem(
        string Title,
        string Platform,
        string ContentType,
        string Format,
        string? ImageIdea,
        string Caption,
        IReadOnlyList<string>? Hashtags,
        string? Cta,
        string? SuggestedTime,
        DateTimeOffset? ScheduledForUtc,
        string? WhyItFits,
        string? Notes);

    public sealed record UpdatePlannedSocialPostStatusRequest(string Status);
}
