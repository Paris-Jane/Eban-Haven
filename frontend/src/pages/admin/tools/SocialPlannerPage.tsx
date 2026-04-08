import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, CalendarClock, CheckCheck, LoaderCircle, Save, SendHorizonal, Sparkles } from 'lucide-react'
import {
  createPlannedSocialPosts,
  getPlannedSocialPosts,
  patchPlannedSocialPostStatus,
  requestSchedulePlannedSocialPost,
  type PlannedSocialPost,
} from '../../../api/admin'
import { type SocialChatMessage, type SocialChatResponse, sendSocialChat } from '../../../api/socialChat'
import { alertError, btnPrimary, card, input, pageDesc, pageTitle, sectionFormTitle } from '../shared/adminStyles'
import { Badge, BooleanBadge, CategoryBadge, StatusBadge } from '../shared/adminDataTable/AdminBadges'

type ChatBubble = {
  id: string
  role: 'assistant' | 'user'
  content: string
  response?: SocialChatResponse
}

const starterPrompts = [
  'Create 3 Facebook posts about safe shelter and reintegration support this week.',
  'Plan 4 Facebook content ideas for Sexual Assault Awareness Month with captions and best posting times.',
  'Draft a short Facebook campaign for donor education with post, story, and video options.',
] as const

const contentTypeOptions = ['Post', 'Story', 'Video'] as const
const platformOptions = ['Facebook', 'Instagram'] as const

const initialAssistantMessage =
  'Tell me the goal, platform, and how many posts you want. I will keep questions brief, make reasonable assumptions when possible, and turn the result into saveable planned posts.'

function composePromptFromBrief(brief: {
  goal: string
  platforms: string[]
  contentTypes: string[]
  postCount: string
  timeframe: string
  audience: string
  notes: string
}) {
  const lines = [
    `Goal: ${brief.goal || 'Plan trauma-informed nonprofit social content.'}`,
    `Platforms: ${brief.platforms.length > 0 ? brief.platforms.join(', ') : 'Facebook'}`,
    `Content types: ${brief.contentTypes.length > 0 ? brief.contentTypes.join(', ') : 'Post'}`,
    `Number of posts: ${brief.postCount || '3'}`,
  ]

  if (brief.timeframe.trim()) lines.push(`Timeframe: ${brief.timeframe.trim()}`)
  if (brief.audience.trim()) lines.push(`Audience: ${brief.audience.trim()}`)
  if (brief.notes.trim()) lines.push(`Context: ${brief.notes.trim()}`)

  lines.push('Please keep questions to only what is necessary, and if enough info is present, generate the post plan now.')
  return lines.join('\n')
}

function toUserFacingDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function normalizeHashtag(tag: string) {
  const trimmed = tag.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

function renderRecommendationList(
  title: string,
  items: { recommendation: string; rationale: string }[],
) {
  if (items.length === 0) return null
  return (
    <section>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={`${title}-${item.recommendation}`} className="rounded-lg border border-border/70 bg-background p-3">
            <p className="text-sm font-medium text-foreground">{item.recommendation}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.rationale}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function SocialPlannerPage() {
  const [messages, setMessages] = useState<ChatBubble[]>([
    { id: crypto.randomUUID(), role: 'assistant', content: initialAssistantMessage },
  ])
  const [plannedPosts, setPlannedPosts] = useState<PlannedSocialPost[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [loadingPlanned, setLoadingPlanned] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [brief, setBrief] = useState({
    goal: '',
    platforms: ['Facebook'],
    contentTypes: ['Post'],
    postCount: '3',
    timeframe: '',
    audience: '',
    notes: '',
  })
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const loadPlannedPosts = useCallback(async () => {
    setLoadingPlanned(true)
    try {
      setPlannedPosts(await getPlannedSocialPosts())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load planned posts.')
    } finally {
      setLoadingPlanned(false)
    }
  }, [])

  useEffect(() => {
    void loadPlannedPosts()
  }, [loadPlannedPosts])

  const conversation = useMemo<SocialChatMessage[]>(
    () => messages.map((message) => ({ role: message.role, content: message.content })),
    [messages],
  )

  const latestStructured = [...messages].reverse().find((message) => message.response)?.response?.structured

  async function submitPrompt(rawPrompt?: string) {
    const content = (rawPrompt ?? draft).trim()
    if (!content || loading) return

    const userMessage: ChatBubble = { id: crypto.randomUUID(), role: 'user', content }
    const nextConversation = [...conversation, { role: 'user' as const, content }]

    setMessages((current) => [...current, userMessage])
    setDraft('')
    setError(null)
    setLoading(true)

    try {
      const response = await sendSocialChat(nextConversation)
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.message || 'Structured recommendations generated.',
          response,
        },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate social plan.')
    } finally {
      setLoading(false)
    }
  }

  async function saveIdeasFromResponse(response: SocialChatResponse) {
    if (response.structured.postIdeas.length === 0) return
    const key = `bulk-${response.generatedAtUtc}`
    setSavingIds((current) => new Set(current).add(key))
    setError(null)
    try {
      await createPlannedSocialPosts({
        sourcePrompt: conversation.filter((message) => message.role === 'user').map((message) => message.content).join('\n\n'),
        posts: response.structured.postIdeas.map((idea) => ({
          title: idea.title,
          platform: idea.platform || 'Facebook',
          contentType: idea.contentType || 'Post',
          format: idea.format,
          imageIdea: idea.imageIdea,
          caption: idea.caption,
          hashtags: idea.hashtags?.map(normalizeHashtag).filter(Boolean),
          cta: idea.cta,
          suggestedTime: idea.bestTime,
          whyItFits: idea.whyItFits,
          notes: idea.notes,
        })),
      })
      await loadPlannedPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save planned posts.')
    } finally {
      setSavingIds((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  async function requestSchedule(post: PlannedSocialPost) {
    const key = `schedule-${post.id}`
    setSavingIds((current) => new Set(current).add(key))
    setError(null)
    try {
      const updated = await requestSchedulePlannedSocialPost(post.id)
      setPlannedPosts((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request scheduling.')
    } finally {
      setSavingIds((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  async function markReady(post: PlannedSocialPost) {
    const key = `ready-${post.id}`
    setSavingIds((current) => new Set(current).add(key))
    setError(null)
    try {
      const updated = await patchPlannedSocialPostStatus(post.id, 'Ready')
      setPlannedPosts((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update post status.')
    } finally {
      setSavingIds((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  function toggleBriefArray(field: 'platforms' | 'contentTypes', value: string) {
    setBrief((current) => {
      const exists = current[field].includes(value)
      const nextValues = exists ? current[field].filter((item) => item !== value) : [...current[field], value]
      return {
        ...current,
        [field]: nextValues.length > 0 ? nextValues : [value],
      }
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className={pageTitle}>Marketing tools</h2>
          <p className={pageDesc}>
            Plan Facebook-first social content with a lightweight AI copilot, save each plan, and queue posts for manual
            Facebook scheduling integration.
          </p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground lg:max-w-sm">
          Current MVP: plans and saves posts internally, then marks them as schedule requests for the future Facebook connector.
        </div>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(22rem,1fr)]">
        <section className="space-y-6">
          <section className={`${card} flex min-h-[34rem] flex-col p-0`}>
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Social planning copilot</h3>
                <p className="text-xs text-muted-foreground">Brief questions, trauma-informed recommendations, saveable plans.</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-3xl rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'ml-auto bg-primary text-primary-foreground'
                      : 'border border-border bg-muted/40 text-foreground'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>

                  {message.role === 'assistant' && message.response && (
                    <div className="mt-4 space-y-4 border-t border-border/70 pt-4">
                      {message.response.structured.clarifyingQuestions.length > 0 && (
                        <section>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick questions</h4>
                          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                            {message.response.structured.clarifyingQuestions.map((question) => (
                              <li key={question} className="rounded-lg border border-border/70 bg-background p-3">
                                {question}
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}

                      {message.response.structured.planningSummary && (
                        <section className="rounded-xl border border-border/70 bg-background p-4">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Planning summary</h4>
                          <p className="mt-2 text-sm text-muted-foreground">{message.response.structured.planningSummary}</p>
                        </section>
                      )}

                      {message.response.structured.postIdeas.length > 0 && (
                        <section>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Generated post plans</h4>
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50"
                              onClick={() => void saveIdeasFromResponse(message.response!)}
                              disabled={savingIds.has(`bulk-${message.response.generatedAtUtc}`)}
                            >
                              {savingIds.has(`bulk-${message.response.generatedAtUtc}`) ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                              Save all plans
                            </button>
                          </div>
                          <div className="mt-2 space-y-3">
                            {message.response.structured.postIdeas.map((idea) => (
                              <article key={`${idea.title}-${idea.platform}-${idea.contentType}`} className="rounded-xl border border-border/70 bg-background p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-foreground">{idea.title}</p>
                                  <CategoryBadge>{idea.platform}</CategoryBadge>
                                  <Badge variant="info">{idea.contentType}</Badge>
                                  <Badge variant="category">{idea.format}</Badge>
                                </div>
                                {idea.imageIdea ? <p className="mt-2 text-sm text-muted-foreground">Visual: {idea.imageIdea}</p> : null}
                                <div className="mt-3 grid gap-3 text-xs text-muted-foreground md:grid-cols-2">
                                  <div>
                                    <dt className="font-semibold uppercase tracking-wide text-foreground">Caption</dt>
                                    <dd className="mt-1 whitespace-pre-wrap leading-relaxed">{idea.caption}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-semibold uppercase tracking-wide text-foreground">Best time</dt>
                                    <dd className="mt-1 leading-relaxed">{idea.bestTime || '—'}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-semibold uppercase tracking-wide text-foreground">CTA</dt>
                                    <dd className="mt-1 leading-relaxed">{idea.cta || '—'}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-semibold uppercase tracking-wide text-foreground">Hashtags</dt>
                                    <dd className="mt-1 leading-relaxed">
                                      {idea.hashtags.length > 0 ? idea.hashtags.map(normalizeHashtag).join(' ') : '—'}
                                    </dd>
                                  </div>
                                </div>
                                {idea.notes ? <p className="mt-3 text-xs text-muted-foreground">Notes: {idea.notes}</p> : null}
                                {idea.whyItFits ? <p className="mt-2 text-sm text-muted-foreground">{idea.whyItFits}</p> : null}
                              </article>
                            ))}
                          </div>
                        </section>
                      )}

                      {message.response.structured.captions.length > 0 && (
                        <section>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Extra captions</h4>
                          <div className="mt-2 space-y-2">
                            {message.response.structured.captions.map((caption) => (
                              <div key={caption} className="rounded-lg border border-border/70 bg-background p-3 text-sm">
                                {caption}
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {renderRecommendationList('Timing recommendations', message.response.structured.timingRecommendations)}
                      {renderRecommendationList('CTA recommendations', message.response.structured.ctaRecommendations)}

                      {message.response.structured.confidenceNotes.length > 0 && (
                        <section>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confidence notes</h4>
                          <div className="mt-2 space-y-2">
                            {message.response.structured.confidenceNotes.map((note) => (
                              <div key={`${note.label}-${note.detail}`} className="rounded-lg border border-border/70 bg-background p-3">
                                <p className="text-sm font-medium text-foreground">{note.label}</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note.detail}</p>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Generating a social plan…
                </div>
              )}
            </div>

            <div className="border-t border-border px-5 py-4">
              <div className="flex flex-col gap-3">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="social-planner-input">
                  Additional prompt
                </label>
                <textarea
                  id="social-planner-input"
                  className={`${input} min-h-28 resize-y`}
                  placeholder="Add any extra instructions or answer the assistant's quick questions."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault()
                      void submitPrompt()
                    }
                  }}
                />
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs text-muted-foreground">Press Ctrl/Cmd + Enter to send.</p>
                  <button
                    type="button"
                    className={`${btnPrimary} inline-flex items-center gap-2`}
                    onClick={() => void submitPrompt()}
                    disabled={loading || draft.trim().length === 0}
                  >
                    <SendHorizonal className="h-4 w-4" />
                    Send
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className={card}>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarClock className="h-4 w-4 text-primary" />
              Planned posts
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Saved plans that can be reviewed, marked ready, or queued for Facebook scheduling.</p>
            <div className="mt-4 space-y-3">
              {loadingPlanned ? (
                <div className="text-sm text-muted-foreground">Loading planned posts…</div>
              ) : plannedPosts.length === 0 ? (
                <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                  No planned posts saved yet.
                </div>
              ) : (
                plannedPosts.map((post) => (
                  <article key={post.id} className="rounded-xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{post.title}</p>
                      <CategoryBadge>{post.platform}</CategoryBadge>
                      <Badge variant="info">{post.contentType}</Badge>
                      <Badge variant="category">{post.format}</Badge>
                      <StatusBadge status={post.status} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{post.caption}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Suggested time: {post.suggestedTime ?? '—'}</span>
                      <span>Scheduled for: {toUserFacingDate(post.scheduledForUtc)}</span>
                    </div>
                    {post.hashtags.length > 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">{post.hashtags.join(' ')}</p>
                    ) : null}
                    {post.schedulingError ? (
                      <p className="mt-2 text-xs text-destructive">Scheduling error: {post.schedulingError}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50"
                        onClick={() => void markReady(post)}
                        disabled={savingIds.has(`ready-${post.id}`)}
                      >
                        {savingIds.has(`ready-${post.id}`) ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                        Mark ready
                      </button>
                      <button
                        type="button"
                        className={`${btnPrimary} inline-flex items-center gap-2 px-3 py-2 text-xs`}
                        onClick={() => void requestSchedule(post)}
                        disabled={savingIds.has(`schedule-${post.id}`)}
                      >
                        {savingIds.has(`schedule-${post.id}`) ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                        Plan post
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>

        <aside className="space-y-6">
          <section className={card}>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Quick planner
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Set the essentials and generate a plan without lots of back-and-forth.</p>

            <div className="mt-4 space-y-4">
              <label className="block text-xs font-medium text-muted-foreground">
                Goal
                <textarea
                  className={`${input} min-h-24 resize-y`}
                  placeholder="Example: raise awareness about safe shelter and invite supporters to learn more."
                  value={brief.goal}
                  onChange={(event) => setBrief((current) => ({ ...current, goal: event.target.value }))}
                />
              </label>

              <div>
                <p className="text-xs font-medium text-muted-foreground">Platforms</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {platformOptions.map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                        brief.platforms.includes(platform)
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border bg-background text-foreground hover:bg-muted/50'
                      }`}
                      onClick={() => toggleBriefArray('platforms', platform)}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground">Content types</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {contentTypeOptions.map((contentType) => (
                    <button
                      key={contentType}
                      type="button"
                      className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                        brief.contentTypes.includes(contentType)
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border bg-background text-foreground hover:bg-muted/50'
                      }`}
                      onClick={() => toggleBriefArray('contentTypes', contentType)}
                    >
                      {contentType}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-xs font-medium text-muted-foreground">
                Number of posts
                <input
                  className={input}
                  value={brief.postCount}
                  onChange={(event) => setBrief((current) => ({ ...current, postCount: event.target.value }))}
                  placeholder="3"
                />
              </label>

              <label className="block text-xs font-medium text-muted-foreground">
                Timeframe
                <input
                  className={input}
                  value={brief.timeframe}
                  onChange={(event) => setBrief((current) => ({ ...current, timeframe: event.target.value }))}
                  placeholder="This week, next month, Giving Tuesday, etc."
                />
              </label>

              <label className="block text-xs font-medium text-muted-foreground">
                Audience
                <input
                  className={input}
                  value={brief.audience}
                  onChange={(event) => setBrief((current) => ({ ...current, audience: event.target.value }))}
                  placeholder="Donors, volunteers, local supporters, general public"
                />
              </label>

              <label className="block text-xs font-medium text-muted-foreground">
                Optional notes or asset ideas
                <textarea
                  className={`${input} min-h-24 resize-y`}
                  value={brief.notes}
                  onChange={(event) => setBrief((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Photos available, campaign context, themes to avoid, key message, etc."
                />
              </label>

              <button
                type="button"
                className={`${btnPrimary} inline-flex w-full items-center justify-center gap-2`}
                disabled={loading}
                onClick={() => void submitPrompt(composePromptFromBrief(brief))}
              >
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate plan
              </button>
            </div>
          </section>

          <section className={card}>
            <p className={sectionFormTitle}>Starter prompts</p>
            <div className="mt-4 space-y-3">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                  onClick={() => void submitPrompt(prompt)}
                  disabled={loading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </section>

          <section className={card}>
            <p className={sectionFormTitle}>Current workflow</p>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>The copilot should ask only a few clarifying questions when details are missing.</li>
              <li>Generated ideas include platform and content type like Facebook post, story, or video.</li>
              <li>Saved plans appear in the queue and can be marked ready or submitted as schedule requests.</li>
              <li>The Facebook publish connector can later promote `Schedule Requested` items into live scheduled posts.</li>
            </ul>
            {latestStructured ? (
              <div className="mt-4 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Latest plan at a glance</p>
                <p className="mt-1">Ideas: {latestStructured.postIdeas.length}</p>
                <p>Needs follow-up questions: <BooleanBadge value={latestStructured.clarifyingQuestions.length > 0} /></p>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  )
}
