import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, LoaderCircle, SendHorizonal, Sparkles } from 'lucide-react'
import {
  type SocialChatMessage,
  type SocialChatResponse,
  sendSocialChat,
} from '../../api/socialChat'
import { alertError, btnPrimary, card, input, pageDesc, pageTitle } from './adminStyles'

type ChatBubble = {
  id: string
  role: 'assistant' | 'user'
  content: string
  response?: SocialChatResponse
}

const starterPrompts = [
  'Give me 3 social post ideas for Sexual Assault Awareness Month that stay trauma-informed and specific to our mission.',
  'Draft Instagram caption options for a post about safe shelter and reintegration support in Ghana.',
  'Suggest a one-week content plan with formats, posting times, CTAs, and confidence notes.',
] as const

const initialAssistantMessage =
  'Ask for post ideas, captions, content calendars, or CTA recommendations. I’ll keep suggestions trauma-informed, nonprofit-safe, and explicit about what is evidence-based versus still hypothetical.'

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
          <div
            key={`${title}-${item.recommendation}`}
            className="rounded-lg border border-border/70 bg-background p-3"
          >
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
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const conversation = useMemo<SocialChatMessage[]>(
    () =>
      messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    [messages],
  )

  async function submitPrompt(rawPrompt?: string) {
    const content = (rawPrompt ?? draft).trim()
    if (!content || loading) return

    const userMessage: ChatBubble = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    }

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className={pageTitle}>Marketing tools</h2>
          <p className={pageDesc}>
            Admin-only AI assistant for captions, post ideas, timing, CTAs, and reasoning grounded in approved
            nonprofit context. The MVP uses server-side placeholders for brand, metrics, and causal inputs so we
            can plug in live sources later without changing the UI contract.
          </p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground lg:max-w-sm">
          Uses the backend only. No OpenAI key is exposed to the browser.
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.95fr)]">
        <section className={`${card} flex min-h-[38rem] flex-col p-0`}>
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Admin social media copilot</h3>
              <p className="text-xs text-muted-foreground">
                Respectful, trauma-informed recommendations with confidence notes.
              </p>
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
                    {message.response.structured.postIdeas.length > 0 && (
                      <section>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Post ideas
                        </h4>
                        <div className="mt-2 space-y-3">
                          {message.response.structured.postIdeas.map((idea) => (
                            <article
                              key={`${idea.title}-${idea.format}`}
                              className="rounded-xl border border-border/70 bg-background p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">{idea.title}</p>
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                  {idea.format}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">{idea.whyItFits}</p>
                              <dl className="mt-3 grid gap-3 text-xs text-muted-foreground md:grid-cols-3">
                                <div>
                                  <dt className="font-semibold uppercase tracking-wide text-foreground">Caption</dt>
                                  <dd className="mt-1 leading-relaxed">{idea.caption}</dd>
                                </div>
                                <div>
                                  <dt className="font-semibold uppercase tracking-wide text-foreground">CTA</dt>
                                  <dd className="mt-1 leading-relaxed">{idea.cta}</dd>
                                </div>
                                <div>
                                  <dt className="font-semibold uppercase tracking-wide text-foreground">Best time</dt>
                                  <dd className="mt-1 leading-relaxed">{idea.bestTime}</dd>
                                </div>
                              </dl>
                            </article>
                          ))}
                        </div>
                      </section>
                    )}

                    {message.response.structured.captions.length > 0 && (
                      <section>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Extra captions
                        </h4>
                        <div className="mt-2 space-y-2">
                          {message.response.structured.captions.map((caption) => (
                            <div
                              key={caption}
                              className="rounded-lg border border-border/70 bg-background p-3 text-sm"
                            >
                              {caption}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {renderRecommendationList(
                      'Timing recommendations',
                      message.response.structured.timingRecommendations,
                    )}

                    {renderRecommendationList(
                      'CTA recommendations',
                      message.response.structured.ctaRecommendations,
                    )}

                    {message.response.structured.confidenceNotes.length > 0 && (
                      <section>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Confidence notes
                        </h4>
                        <div className="mt-2 space-y-2">
                          {message.response.structured.confidenceNotes.map((note) => (
                            <div
                              key={`${note.label}-${note.detail}`}
                              className="rounded-lg border border-border/70 bg-background p-3"
                            >
                              <p className="text-sm font-medium text-foreground">{note.label}</p>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note.detail}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {message.response.structured.reasoning.length > 0 && (
                      <section>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Why these recommendations
                        </h4>
                        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                          {message.response.structured.reasoning.map((reason) => (
                            <li key={reason} className="rounded-lg border border-border/70 bg-background p-3">
                              {reason}
                            </li>
                          ))}
                        </ul>
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
            {error && <div className={`${alertError} mb-3`}>{error}</div>}
            <div className="flex flex-col gap-3">
              <label
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                htmlFor="social-planner-input"
              >
                Your prompt
              </label>
              <textarea
                id="social-planner-input"
                className={`${input} min-h-32 resize-y`}
                placeholder="Example: Create a 5-post Instagram mini-campaign about safe shelter, education, and reintegration. Include captions, best format, CTA, and confidence notes."
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

        <aside className="space-y-6">
          <section className={card}>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Starter prompts
            </div>
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
            <h3 className="text-sm font-semibold text-foreground">Current MVP context</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>Website summary and brand guidance are supplied by the backend.</li>
              <li>Social metrics and causal insights are placeholders for now.</li>
              <li>The assistant is instructed not to invent statistics, stories, or identifying details.</li>
              <li>The response contract is structured so we can later render richer recommendation cards.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
