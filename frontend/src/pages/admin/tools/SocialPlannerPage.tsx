import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Image,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  SendHorizonal,
  Sparkles,
  Square,
  Target,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import {
  createPlannedSocialPosts,
  deletePlannedSocialPost,
  getPlannedSocialPosts,
  patchPlannedSocialPostStatus,
  requestSchedulePlannedSocialPost,
  schedulePlannedSocialPostToFacebook,
  updatePlannedSocialPost,
  type PlannedSocialPost,
} from '../../../api/admin'
import { type SocialChatMessage, type SocialChatResponse, sendSocialChat } from '../../../api/socialChat'
import { apiFetch } from '../../../api/client'
import { alertError, btnPrimary, card, input, pageDesc, pageTitle } from '../shared/adminStyles'
import { Badge, CategoryBadge, StatusBadge } from '../shared/adminDataTable/AdminBadges'

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatBubble = {
  id: string
  role: 'assistant' | 'user'
  content: string
  response?: SocialChatResponse
}

type StartMode = 'pick' | 'quick' | 'brief' | 'chat'

type PexelsPhoto = {
  id: number
  src: { medium: string; large: string; small: string; original: string; tiny: string }
  alt: string
  photographer: string
  photographer_url: string
  url: string
  dataUrl: string | null
}

type EditDraft = {
  title: string
  caption: string
  hashtags: string
  notes: string
  imageIdea: string
  cta: string
  suggestedTime: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const starterPrompts = [
  {
    title: 'Shelter awareness',
    description: 'Create 3 Facebook posts about safe shelter and reintegration support this week.',
    icon: '🏠',
  },
  {
    title: 'Awareness campaign',
    description: 'Plan 4 Facebook content ideas for Sexual Assault Awareness Month with captions and best posting times.',
    icon: '📣',
  },
  {
    title: 'Donor education',
    description: 'Draft a short Facebook campaign for donor education with post, story, and video options.',
    icon: '❤️',
  },
] as const

const contentTypeOptions = ['Post', 'Story', 'Video'] as const
const platformOptions = ['Facebook', 'Instagram'] as const

const initialAssistantMessage =
  "Hi! Tell me your goal, which platform you're targeting, and how many posts you need. I'll keep follow-up questions brief and generate a ready-to-save content plan."

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function fetchPexelsImages(query: string): Promise<PexelsPhoto[]> {
  const res = await apiFetch(`/api/admin/social-planner/image-search?query=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Image search failed')
  const data = (await res.json()) as { photos: PexelsPhoto[] }
  return data.photos ?? []
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepBadge({ n, label, active }: { n: number; label: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs font-medium transition-colors ${active ? 'text-foreground' : 'text-muted-foreground/60'}`}>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-1 transition-all ${active ? 'bg-primary text-primary-foreground ring-primary/30 shadow-sm' : 'bg-background text-muted-foreground ring-border'}`}>
        {n}
      </span>
      <span className={active ? 'font-semibold' : ''}>{label}</span>
    </div>
  )
}

// ── Image search panel ────────────────────────────────────────────────────────

function ImageSearchPanel({ query, onClose }: { query: string; onClose: () => void }) {
  const [photos, setPhotos] = useState<PexelsPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(query)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    try {
      setPhotos(await fetchPexelsImages(q))
    } catch {
      setError('Image search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void search(query) }, [query, search])

  function copyUrl(url: string, id: number) {
    void navigator.clipboard.writeText(url)
    setCopied(String(id))
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">Image suggestions</p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className={`${input} flex-1 text-xs`}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search(searchInput) } }}
          placeholder="Search term…"
        />
        <button
          type="button"
          className={`${btnPrimary} px-3 py-1.5 text-xs`}
          onClick={() => void search(searchInput)}
          disabled={loading}
        >
          {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      {loading && photos.length === 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex h-24 items-center justify-center rounded-lg bg-muted">
              <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground/40" />
            </div>
          ))}
        </div>
      )}
      {photos.length > 0 && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={p.id} className="group relative h-24 overflow-hidden rounded-lg bg-muted">
                {p.dataUrl ? (
                  <img
                    src={p.dataUrl}
                    alt={p.alt || 'Pexels photo'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Image className="h-5 w-5 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => copyUrl(p.src.large, p.id)}
                    className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-black"
                  >
                    {copied === String(p.id) ? '✓ Copied!' : 'Copy URL'}
                  </button>
                </div>
                <p className="absolute bottom-0 left-0 right-0 truncate bg-black/40 px-1.5 py-0.5 text-[9px] text-white/80">
                  {p.photographer}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground/60">
            Photos from Pexels. Hover to copy URL.
          </p>
        </>
      )}
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditPostModal({
  post,
  onSave,
  onClose,
  saving,
}: {
  post: PlannedSocialPost
  onSave: (draft: EditDraft) => void
  onClose: () => void
  saving: boolean
}) {
  const [draft, setDraft] = useState<EditDraft>({
    title: post.title,
    caption: post.caption ?? '',
    hashtags: post.hashtags.join(' '),
    notes: post.notes ?? '',
    imageIdea: post.imageIdea ?? '',
    cta: post.cta ?? '',
    suggestedTime: post.suggestedTime ?? '',
  })

  function field(key: keyof EditDraft) {
    return {
      value: draft[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft((c) => ({ ...c, [key]: e.target.value })),
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`${card} w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Edit post</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block text-xs font-medium text-muted-foreground">
          Title *
          <input className={`${input} mt-1`} {...field('title')} placeholder="Post title" />
        </label>

        <label className="block text-xs font-medium text-muted-foreground">
          Caption
          <textarea className={`${input} mt-1 min-h-24 resize-y`} {...field('caption')} placeholder="Post caption…" />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Hashtags
            <input className={`${input} mt-1`} {...field('hashtags')} placeholder="#nonprofit #shelter" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            CTA
            <input className={`${input} mt-1`} {...field('cta')} placeholder="Donate now" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Image idea
            <input className={`${input} mt-1`} {...field('imageIdea')} placeholder="Describe the image…" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Suggested time
            <input className={`${input} mt-1`} {...field('suggestedTime')} placeholder="e.g. Tuesday 10am" />
          </label>
        </div>

        <label className="block text-xs font-medium text-muted-foreground">
          Notes
          <textarea className={`${input} mt-1 min-h-16 resize-y`} {...field('notes')} placeholder="Internal notes…" />
        </label>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50"
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${btnPrimary} inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-50`}
            onClick={() => onSave(draft)}
            disabled={saving || !draft.title.trim()}
          >
            {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

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
  const [briefOpen, setBriefOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [startMode, setStartMode] = useState<StartMode>('pick')
  const [editingPost, setEditingPost] = useState<PlannedSocialPost | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [imageSearchKey, setImageSearchKey] = useState<string | null>(null)
  const [brief, setBrief] = useState({
    goal: '',
    platforms: ['Facebook'] as string[],
    contentTypes: ['Post'] as string[],
    postCount: '3',
    timeframe: '',
    audience: '',
    notes: '',
  })

  const abortCtrlRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  // Chat is "active" if a message has been sent, or mode is chat (to show input bar before first send)
  const showChatView = messages.length > 1 || startMode === 'chat'

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

  useEffect(() => { void loadPlannedPosts() }, [loadPlannedPosts])

  const conversation = useMemo<SocialChatMessage[]>(
    () => messages.map((m) => ({ role: m.role, content: m.content })),
    [messages],
  )

  // ── Actions ──

  async function submitPrompt(rawPrompt?: string) {
    const content = (rawPrompt ?? draft).trim()
    if (!content || loading) return

    const ctrl = new AbortController()
    abortCtrlRef.current = ctrl

    const userMessage: ChatBubble = { id: crypto.randomUUID(), role: 'user', content }
    const nextConversation = [...conversation, { role: 'user' as const, content }]

    setMessages((c) => [...c, userMessage])
    setDraft('')
    setBriefOpen(false)
    setError(null)
    setLoading(true)

    try {
      const response = await sendSocialChat(nextConversation, ctrl.signal)
      setMessages((c) => [
        ...c,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.message || 'Structured recommendations generated.',
          response,
        },
      ])
    } catch (err) {
      if ((err as Error).name === 'AbortError') return // user stopped — no error
      setError(err instanceof Error ? err.message : 'Failed to generate social plan.')
    } finally {
      abortCtrlRef.current = null
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function stopGeneration() {
    abortCtrlRef.current?.abort()
    abortCtrlRef.current = null
    setLoading(false)
  }

  async function saveIdeasFromResponse(response: SocialChatResponse) {
    if (response.structured.postIdeas.length === 0) return
    const key = `bulk-${response.generatedAtUtc}`
    setSavingIds((c) => new Set(c).add(key))
    setError(null)
    try {
      await createPlannedSocialPosts({
        sourcePrompt: conversation
          .filter((m) => m.role === 'user')
          .map((m) => m.content)
          .join('\n\n'),
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
      setSavingIds((c) => { const n = new Set(c); n.delete(key); return n })
    }
  }

  async function requestSchedule(post: PlannedSocialPost) {
    const key = `schedule-${post.id}`
    setSavingIds((c) => new Set(c).add(key))
    try {
      const updated = await requestSchedulePlannedSocialPost(post.id)
      setPlannedPosts((c) => c.map((p) => (p.id === updated.id ? updated : p)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request scheduling.')
    } finally {
      setSavingIds((c) => { const n = new Set(c); n.delete(key); return n })
    }
  }

  async function sendToFacebook(post: PlannedSocialPost) {
    const key = `facebook-${post.id}`
    setSavingIds((c) => new Set(c).add(key))
    try {
      const updated = await schedulePlannedSocialPostToFacebook(post.id)
      setPlannedPosts((c) => c.map((p) => (p.id === updated.id ? updated : p)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule to Facebook.')
    } finally {
      setSavingIds((c) => { const n = new Set(c); n.delete(key); return n })
    }
  }

  async function markReady(post: PlannedSocialPost) {
    const key = `ready-${post.id}`
    setSavingIds((c) => new Set(c).add(key))
    try {
      const updated = await patchPlannedSocialPostStatus(post.id, 'Ready')
      setPlannedPosts((c) => c.map((p) => (p.id === updated.id ? updated : p)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.')
    } finally {
      setSavingIds((c) => { const n = new Set(c); n.delete(key); return n })
    }
  }

  async function deletePost(id: number) {
    const key = `delete-${id}`
    setSavingIds((c) => new Set(c).add(key))
    setError(null)
    try {
      await deletePlannedSocialPost(id)
      setPlannedPosts((c) => c.filter((p) => p.id !== id))
      setDeletingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post.')
    } finally {
      setSavingIds((c) => { const n = new Set(c); n.delete(key); return n })
    }
  }

  async function saveEditedPost(draft: EditDraft) {
    if (!editingPost) return
    const key = `edit-${editingPost.id}`
    setSavingIds((c) => new Set(c).add(key))
    setError(null)
    try {
      const updated = await updatePlannedSocialPost(editingPost.id, {
        title: draft.title,
        caption: draft.caption,
        hashtags: draft.hashtags,
        notes: draft.notes,
        imageIdea: draft.imageIdea,
        cta: draft.cta,
        suggestedTime: draft.suggestedTime,
      })
      setPlannedPosts((c) => c.map((p) => (p.id === updated.id ? updated : p)))
      setEditingPost(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.')
    } finally {
      setSavingIds((c) => { const n = new Set(c); n.delete(key); return n })
    }
  }

  function toggleBriefArray(field: 'platforms' | 'contentTypes', value: string) {
    setBrief((c) => {
      const exists = c[field].includes(value)
      const next = exists ? c[field].filter((v) => v !== value) : [...c[field], value]
      return { ...c, [field]: next.length > 0 ? next : [value] }
    })
  }

  function resetConversation() {
    setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: initialAssistantMessage }])
    setDraft('')
    setError(null)
    setBriefOpen(false)
    setStartMode('pick')
    setImageSearchKey(null)
  }

  function returnToModePicker() {
    setStartMode('pick')
    setDraft('')
    setError(null)
  }

  const statusOptions = ['All', ...Array.from(new Set(plannedPosts.map((p) => p.status)))]
  const filteredPosts = statusFilter === 'All'
    ? plannedPosts
    : plannedPosts.filter((p) => p.status === statusFilter)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Edit modal */}
      {editingPost && (
        <EditPostModal
          post={editingPost}
          saving={savingIds.has(`edit-${editingPost.id}`)}
          onSave={(d) => void saveEditedPost(d)}
          onClose={() => setEditingPost(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="border-l-4 border-primary pl-4">
          <h2 className={pageTitle}>Marketing Support</h2>
          <p className={pageDesc}>Use the AI copilot to plan social media content, then save and schedule posts.</p>
        </div>
        {/* Step strip */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-5 py-3.5 shadow-sm">
          <StepBadge n={1} label="Describe your goal" active={!showChatView} />
          <div className="h-px w-6 bg-border" />
          <StepBadge n={2} label="Review AI-generated posts" active={showChatView && !loading} />
          <div className="h-px w-6 bg-border" />
          <StepBadge n={3} label="Save & schedule" active={plannedPosts.length > 0} />
        </div>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(22rem,1fr)]">
        {/* ── Left: AI Planner ── */}
        <div className="space-y-4">
          <div className={`${card} flex min-h-[36rem] flex-col p-0`}>
            {/* Card header */}
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">AI Content Planner</h3>
                  <p className="text-xs text-muted-foreground">Describe your goal and get a ready-to-post content plan.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {startMode === 'chat' && messages.length === 1 && (
                  <button
                    type="button"
                    onClick={returnToModePicker}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                )}
                {loading && (
                  <button
                    type="button"
                    onClick={stopGeneration}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    Stop
                  </button>
                )}
                {showChatView && (
                  <button
                    type="button"
                    onClick={resetConversation}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    New session
                  </button>
                )}
              </div>
            </div>

            {/* ── Landing: pick a mode ── */}
            {!showChatView && (
              <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6">

                {/* Mode selector cards */}
                {startMode === 'pick' && (
                  <div className="space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      How would you like to start?
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {/* Quick prompt */}
                      <button
                        type="button"
                        onClick={() => setStartMode('quick')}
                        className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                          <Zap className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Quick Prompt</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            Pick a starter template and get a content plan in seconds.
                          </p>
                        </div>
                      </button>

                      {/* Targeted brief */}
                      <button
                        type="button"
                        onClick={() => { setStartMode('brief'); setBriefOpen(true) }}
                        className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-5 text-left transition-colors hover:border-primary/50 hover:bg-primary/10 hover:shadow-sm"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                          <Target className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Targeted Plan</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            Fill a short brief — platforms, goals, audience — for more focused results.
                          </p>
                        </div>
                      </button>

                      {/* Just chatbot */}
                      <button
                        type="button"
                        onClick={() => setStartMode('chat')}
                        className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <MessageCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Just Chat</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            Open-ended conversation — describe anything and the AI will guide you.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick prompts mode */}
                {startMode === 'quick' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStartMode('pick')}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        ← Back
                      </button>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Choose a starter
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {starterPrompts.map((p) => (
                        <button
                          key={p.title}
                          type="button"
                          disabled={loading}
                          onClick={() => void submitPrompt(p.description)}
                          className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                        >
                          <span className="text-xl">{p.icon}</span>
                          <span className="text-sm font-semibold text-foreground">{p.title}</span>
                          <span className="text-xs leading-relaxed text-muted-foreground">{p.description}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs text-muted-foreground">or type your own below</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  </div>
                )}

                {/* Brief form mode */}
                {startMode === 'brief' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStartMode('pick')}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        ← Back
                      </button>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Targeted brief
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
                        onClick={() => setBriefOpen((o) => !o)}
                      >
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          Fill brief for a more targeted plan
                        </span>
                        {briefOpen
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </button>

                      {briefOpen && (
                        <div className="space-y-4 border-t border-border px-4 pb-4 pt-4">
                          <label className="block text-xs font-medium text-muted-foreground">
                            Goal *
                            <textarea
                              className={`${input} mt-1 min-h-20 resize-y`}
                              placeholder="e.g. raise awareness about our safe shelter programme and invite supporters to donate."
                              value={brief.goal}
                              onChange={(e) => setBrief((c) => ({ ...c, goal: e.target.value }))}
                            />
                          </label>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Platforms</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {platformOptions.map((pl) => (
                                  <button
                                    key={pl}
                                    type="button"
                                    onClick={() => toggleBriefArray('platforms', pl)}
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                      brief.platforms.includes(pl)
                                        ? 'border-primary/40 bg-primary/10 text-primary'
                                        : 'border-border bg-card text-foreground hover:bg-muted/50'
                                    }`}
                                  >
                                    {pl}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Content types</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {contentTypeOptions.map((ct) => (
                                  <button
                                    key={ct}
                                    type="button"
                                    onClick={() => toggleBriefArray('contentTypes', ct)}
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                      brief.contentTypes.includes(ct)
                                        ? 'border-primary/40 bg-primary/10 text-primary'
                                        : 'border-border bg-card text-foreground hover:bg-muted/50'
                                    }`}
                                  >
                                    {ct}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-3">
                            <label className="block text-xs font-medium text-muted-foreground">
                              # of posts
                              <input className={`${input} mt-1`} value={brief.postCount} placeholder="3"
                                onChange={(e) => setBrief((c) => ({ ...c, postCount: e.target.value }))} />
                            </label>
                            <label className="block text-xs font-medium text-muted-foreground">
                              Timeframe
                              <input className={`${input} mt-1`} value={brief.timeframe} placeholder="This week"
                                onChange={(e) => setBrief((c) => ({ ...c, timeframe: e.target.value }))} />
                            </label>
                            <label className="block text-xs font-medium text-muted-foreground">
                              Audience
                              <input className={`${input} mt-1`} value={brief.audience} placeholder="Donors, volunteers"
                                onChange={(e) => setBrief((c) => ({ ...c, audience: e.target.value }))} />
                            </label>
                          </div>

                          <label className="block text-xs font-medium text-muted-foreground">
                            Extra context
                            <textarea className={`${input} mt-1 min-h-16 resize-y`} value={brief.notes}
                              placeholder="Photos available, themes to avoid, key message…"
                              onChange={(e) => setBrief((c) => ({ ...c, notes: e.target.value }))} />
                          </label>

                          <button
                            type="button"
                            className={`${btnPrimary} inline-flex w-full items-center justify-center gap-2`}
                            disabled={loading || !brief.goal.trim()}
                            onClick={() => void submitPrompt(composePromptFromBrief(brief))}
                          >
                            {loading
                              ? <LoaderCircle className="h-4 w-4 animate-spin" />
                              : <Sparkles className="h-4 w-4" />}
                            Generate content plan
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Active conversation (or "just chat" mode) ── */}
            {showChatView && (
              <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`max-w-3xl rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'ml-auto bg-primary text-primary-foreground'
                        : 'border border-border bg-muted/40 text-foreground'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground
                        [&_strong]:font-semibold [&_strong]:text-foreground
                        [&_em]:italic
                        [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
                        [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
                        [&_li]:text-sm [&_li]:leading-relaxed
                        [&_p]:mb-2 last:[&_p]:mb-0
                        [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1
                        [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1
                        [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
                        [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground
                        [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}

                    {msg.role === 'assistant' && msg.response && (
                      <div className="mt-4 space-y-4 border-t border-border/70 pt-4">
                        {/* Clarifying questions */}
                        {msg.response.structured.clarifyingQuestions.length > 0 && (
                          <section>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick questions</h4>
                            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                              {msg.response.structured.clarifyingQuestions.map((q) => (
                                <li key={q} className="rounded-lg border border-border/70 bg-background p-3">{q}</li>
                              ))}
                            </ul>
                          </section>
                        )}

                        {/* Post ideas */}
                        {msg.response.structured.postIdeas.length > 0 && (
                          <section>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Generated posts ({msg.response.structured.postIdeas.length})
                              </h4>
                              <button
                                type="button"
                                className={`${btnPrimary} inline-flex items-center gap-2 px-3 py-2 text-xs`}
                                onClick={() => void saveIdeasFromResponse(msg.response!)}
                                disabled={savingIds.has(`bulk-${msg.response.generatedAtUtc}`)}
                              >
                                {savingIds.has(`bulk-${msg.response.generatedAtUtc}`)
                                  ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                  : <Save className="h-3.5 w-3.5" />}
                                Save all to queue
                              </button>
                            </div>
                            <div className="mt-3 space-y-3">
                              {msg.response.structured.postIdeas.map((idea) => {
                                const ideaKey = `${idea.title}-${idea.platform}-${idea.contentType}`
                                return (
                                  <article
                                    key={ideaKey}
                                    className="rounded-xl border border-border/70 bg-background p-4"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold text-foreground">{idea.title}</p>
                                      <CategoryBadge>{idea.platform}</CategoryBadge>
                                      <Badge variant="info">{idea.contentType}</Badge>
                                      {idea.format && <Badge variant="category">{idea.format}</Badge>}
                                    </div>
                                    {idea.imageIdea && (
                                      <div className="mt-2 flex items-center gap-2">
                                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Image className="h-3 w-3 shrink-0 text-muted-foreground/60" />{idea.imageIdea}</p>
                                        <button
                                            type="button"
                                            onClick={() => setImageSearchKey(imageSearchKey === ideaKey ? null : ideaKey)}
                                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                          >
                                            <Image className="h-3 w-3" />
                                            {imageSearchKey === ideaKey ? 'Hide images' : 'Find images'}
                                          </button>
                                      </div>
                                    )}
                                    {imageSearchKey === ideaKey && (
                                      <ImageSearchPanel
                                        query={idea.imageIdea ?? idea.title}
                                        onClose={() => setImageSearchKey(null)}
                                      />
                                    )}
                                    {idea.caption && (
                                      <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                                        {idea.caption}
                                      </p>
                                    )}
                                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                                      {idea.bestTime && (
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3 shrink-0" />
                                          {idea.bestTime}
                                        </span>
                                      )}
                                      {idea.cta && (
                                        <span className="flex items-center gap-1">
                                          <span className="font-medium text-foreground/70">CTA:</span> {idea.cta}
                                        </span>
                                      )}
                                      {idea.hashtags.length > 0 && (
                                        <span className="truncate text-muted-foreground/70">
                                          {idea.hashtags.map(normalizeHashtag).slice(0, 4).join(' ')}
                                          {idea.hashtags.length > 4 ? ' …' : ''}
                                        </span>
                                      )}
                                    </div>
                                  </article>
                                )
                              })}
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
                    Generating your content plan…
                  </div>
                )}
              </div>
            )}

            {/* Input bar — shown in chat mode or once conversation started */}
            {showChatView && (
              <div className="border-t border-border px-5 py-4">
                <div className="flex gap-3">
                  <textarea
                    ref={inputRef}
                    className={`${input} min-h-[2.75rem] flex-1 resize-none`}
                    rows={2}
                    placeholder="Ask a follow-up, refine the plan, or request more posts… (Ctrl/Cmd + Enter to send)"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault()
                        void submitPrompt()
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={`${btnPrimary} self-end inline-flex items-center gap-2 px-3 py-2.5`}
                    onClick={() => void submitPrompt()}
                    disabled={loading || draft.trim().length === 0}
                  >
                    {loading
                      ? <LoaderCircle className="h-4 w-4 animate-spin" />
                      : <SendHorizonal className="h-4 w-4" />}
                    Send
                  </button>
                </div>
              </div>
            )}

            {/* Input bar for landing quick/brief modes (for typing custom prompt) */}
            {!showChatView && (startMode === 'quick') && (
              <div className="border-t border-border px-5 py-4">
                <div className="flex gap-3">
                  <textarea
                    ref={inputRef}
                    className={`${input} min-h-[2.75rem] flex-1 resize-none`}
                    rows={2}
                    placeholder="Or type your own goal… (Ctrl/Cmd + Enter to send)"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault()
                        void submitPrompt()
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={`${btnPrimary} self-end inline-flex items-center gap-2 px-3 py-2.5`}
                    onClick={() => void submitPrompt()}
                    disabled={loading || draft.trim().length === 0}
                  >
                    {loading
                      ? <LoaderCircle className="h-4 w-4 animate-spin" />
                      : <SendHorizonal className="h-4 w-4" />}
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Saved queue ── */}
        <aside>
          <div className={`${card} space-y-4`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Saved queue
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Generated posts saved here. Mark ready, then schedule to Facebook.
                </p>
              </div>
              {plannedPosts.length > 0 && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {plannedPosts.length}
                </span>
              )}
            </div>

            {/* Status filter pills */}
            {statusOptions.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {statusOptions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      statusFilter === s
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Post list */}
            {loadingPlanned ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading saved posts…
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-center">
                <Plus className="h-7 w-7 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium text-foreground">No saved posts yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Generate a content plan and click <strong>Save all to queue</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPosts.map((post) => (
                  <article key={post.id} className="rounded-xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug text-foreground">{post.title}</p>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={post.status} />
                        {/* Edit button */}
                        <button
                          type="button"
                          title="Edit post"
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          onClick={() => setEditingPost(post)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {/* Delete button / confirm */}
                        {deletingId === post.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void deletePost(post.id)}
                              disabled={savingIds.has(`delete-${post.id}`)}
                              className="rounded-md bg-destructive px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-50"
                            >
                              {savingIds.has(`delete-${post.id}`) ? '…' : 'Delete'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted/50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            title="Delete post"
                            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeletingId(post.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <CategoryBadge>{post.platform}</CategoryBadge>
                      <Badge variant="info">{post.contentType}</Badge>
                    </div>

                    {post.caption && (
                      <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {post.caption}
                      </p>
                    )}

                    {post.imageIdea && (
                      <div className="mt-2 flex items-center gap-2">
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground/70"><Image className="h-3 w-3 shrink-0" />{post.imageIdea}</p>
                        <button
                            type="button"
                            onClick={() => {
                              const k = `queue-${post.id}`
                              setImageSearchKey(imageSearchKey === k ? null : k)
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          >
                            <Image className="h-3 w-3" />
                            {imageSearchKey === `queue-${post.id}` ? 'Hide images' : 'Find images'}
                          </button>
                      </div>
                    )}

                    {imageSearchKey === `queue-${post.id}` && post.imageIdea && (
                      <ImageSearchPanel
                        query={post.imageIdea}
                        onClose={() => setImageSearchKey(null)}
                      />
                    )}

                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {post.suggestedTime && (
                        <p className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                          Suggested: {post.suggestedTime}
                        </p>
                      )}
                      {post.scheduledForUtc && (
                        <p className="flex items-center gap-1.5">
                          <CalendarClock className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                          Scheduled: {toUserFacingDate(post.scheduledForUtc)}
                        </p>
                      )}
                    </div>

                    {post.hashtags.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground/70">{post.hashtags.join(' ')}</p>
                    )}

                    {post.schedulingError && (
                      <p className="mt-2 rounded-lg bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                        ⚠ {post.schedulingError}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 border-t border-border/50 pt-3">
                      <button
                        type="button"
                        title="Mark as ready to publish"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                        onClick={() => void markReady(post)}
                        disabled={savingIds.has(`ready-${post.id}`) || post.status === 'Ready'}
                      >
                        {savingIds.has(`ready-${post.id}`)
                          ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          : <CheckCheck className="h-3.5 w-3.5" />}
                        Mark ready
                      </button>
                      <button
                        type="button"
                        title="Add to schedule queue"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                        onClick={() => void requestSchedule(post)}
                        disabled={savingIds.has(`schedule-${post.id}`)}
                      >
                        {savingIds.has(`schedule-${post.id}`)
                          ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          : <CalendarClock className="h-3.5 w-3.5" />}
                        Queue
                      </button>
                      <button
                        type="button"
                        title="Publish to Facebook now"
                        className={`${btnPrimary} inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs disabled:opacity-50`}
                        onClick={() => void sendToFacebook(post)}
                        disabled={savingIds.has(`facebook-${post.id}`)}
                      >
                        {savingIds.has(`facebook-${post.id}`)
                          ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          : <SendHorizonal className="h-3.5 w-3.5" />}
                        Publish
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
