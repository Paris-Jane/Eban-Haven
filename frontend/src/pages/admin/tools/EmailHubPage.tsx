import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, LoaderCircle, Mail, RefreshCw, Sparkles } from 'lucide-react'
import {
  generateDonorEmail,
  getDonorEmailProfile,
  sendDonorEmail,
  getSupporters,
  type DonorEmailProfile,
  type GeneratedDonorEmail,
  type SentDonorEmail,
  type Supporter,
} from '../../../api/admin'
import { PUBLIC_CONTACT, SITE_DISPLAY_NAME } from '../../../site'
import { alertError, btnPrimary, card, input, label, pageDesc, pageTitle, sectionFormTitle } from '../shared/adminStyles'

const toneOptions = ['Warm', 'Direct', 'Celebratory', 'Re-engagement'] as const
const signatureStorageKey = 'email_hub_signature_v1'

const goalPresets = [
  'Thank the donor and encourage their next step.',
  'Re-engage a donor who has not given recently.',
  'Invite the donor to become a monthly giver.',
  'Share a tailored impact update and open a conversation.',
] as const

type SignatureFields = {
  senderName: string
  senderTitle: string
  senderOrganization: string
  senderContact: string
}

function defaultSignature(): SignatureFields {
  return {
    senderName: '',
    senderTitle: 'Development Team',
    senderOrganization: SITE_DISPLAY_NAME,
    senderContact: PUBLIC_CONTACT.infoEmail,
  }
}

function loadStoredSignature(): SignatureFields {
  try {
    const raw = localStorage.getItem(signatureStorageKey)
    if (!raw) return defaultSignature()
    const parsed = JSON.parse(raw) as Partial<SignatureFields>
    return {
      senderName: parsed.senderName ?? '',
      senderTitle: parsed.senderTitle ?? 'Development Team',
      senderOrganization: parsed.senderOrganization ?? SITE_DISPLAY_NAME,
      senderContact: parsed.senderContact ?? PUBLIC_CONTACT.infoEmail,
    }
  } catch {
    return defaultSignature()
  }
}

function formatMoney(amount: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode || 'PHP' }).format(amount)
  } catch {
    return `${amount} ${currencyCode || 'PHP'}`
  }
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

function encodeMailtoValue(value: string) {
  return encodeURIComponent(value).replace(/%20/g, '%20')
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value)
}

export function EmailHubPage() {
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [profile, setProfile] = useState<DonorEmailProfile | null>(null)
  const [generated, setGenerated] = useState<GeneratedDonorEmail | null>(null)
  const [search, setSearch] = useState('')
  const [goal, setGoal] = useState<string>(goalPresets[0])
  const [tone, setTone] = useState<(typeof toneOptions)[number]>('Warm')
  const [preferAi, setPreferAi] = useState(true)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<SentDonorEmail | null>(null)
  const [copyState, setCopyState] = useState<'subject' | 'body' | 'html' | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [previewMode, setPreviewMode] = useState<'plain' | 'rich'>('rich')
  const [signature, setSignature] = useState<SignatureFields>(() => loadStoredSignature())
  const [recipientEmail, setRecipientEmail] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(signatureStorageKey, JSON.stringify(signature))
    } catch {
      /* ignore */
    }
  }, [signature])

  const loadSupporters = useCallback(async () => {
    setLoadingList(true)
    try {
      const rows = await getSupporters()
      setSupporters(rows)
      setSelectedId((current) => current ?? rows[0]?.id ?? null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load donors.')
    } finally {
      setLoadingList(false)
    }
  }, [])

  const loadProfile = useCallback(async (supporterId: number) => {
    setLoadingProfile(true)
    try {
      const nextProfile = await getDonorEmailProfile(supporterId)
      setProfile(nextProfile)
      setGenerated(null)
      setSendResult(null)
      setRecipientEmail(nextProfile.supporter.email ?? '')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load donor history.')
    } finally {
      setLoadingProfile(false)
    }
  }, [])

  useEffect(() => {
    void loadSupporters()
  }, [loadSupporters])

  useEffect(() => {
    if (selectedId != null) void loadProfile(selectedId)
  }, [selectedId, loadProfile])

  const filteredSupporters = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return supporters
    return supporters.filter((supporter) =>
      `${supporter.displayName} ${supporter.email ?? ''} ${supporter.organizationName ?? ''} ${supporter.region ?? ''}`
        .toLowerCase()
        .includes(needle),
    )
  }, [supporters, search])

  async function onGenerateEmail() {
    if (selectedId == null) return
    setGenerating(true)
    try {
      const result = await generateDonorEmail(selectedId, {
        goal,
        tone,
        preferAi,
        senderName: signature.senderName,
        senderTitle: signature.senderTitle,
        senderOrganization: signature.senderOrganization,
        senderContact: signature.senderContact,
      })
      setGenerated(result)
      setSendResult(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate email.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy(kind: 'subject' | 'body' | 'html', value: string) {
    try {
      await copyText(value)
      setCopyState(kind)
      window.setTimeout(() => setCopyState((current) => (current === kind ? null : current)), 1600)
    } catch {
      setError('Clipboard access failed on this browser.')
    }
  }

  const mailtoHref = useMemo(() => {
    if (!profile?.supporter.email || !generated) return null
    return `mailto:${profile.supporter.email}?subject=${encodeMailtoValue(generated.subject)}&body=${encodeMailtoValue(generated.body)}`
  }, [generated, profile])

  async function onSendEmail() {
    if (selectedId == null || !generated) return
    setSending(true)
    try {
      const result = await sendDonorEmail(selectedId, {
        toEmail: recipientEmail.trim(),
        subject: generated.subject,
        body: generated.body,
        htmlBody: generated.htmlBody,
      })
      setSendResult(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email.')
    } finally {
      setSending(false)
    }
  }

  function updateSignature<K extends keyof SignatureFields>(key: K, value: SignatureFields[K]) {
    setSignature((current) => ({ ...current, [key]: value }))
  }

  function createMarkup(html: string) {
    return { __html: html }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className={`${pageTitle} flex items-center gap-2`}>
            <Mail className="h-7 w-7 text-primary" />
            Email hub
          </h2>
          <p className={pageDesc}>
            Review donor history, generate a tailored outreach email, and open a ready-to-send draft from the admin tools area.
          </p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground lg:max-w-sm">
          Drafts now use cleaner plain-text formatting and your own sender signature details.
        </div>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
        <aside className={`${card} space-y-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={sectionFormTitle}>Donors</p>
              <p className="mt-1 text-sm text-muted-foreground">Pick a donor to build a custom email.</p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:bg-muted/50"
              onClick={() => void loadSupporters()}
              aria-label="Refresh donors"
            >
              <RefreshCw className={`h-4 w-4 ${loadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <label className={label}>
            Search donors
            <input
              className={input}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email, organization..."
            />
          </label>

          <div className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
            {loadingList ? (
              <p className="text-sm text-muted-foreground">Loading donors…</p>
            ) : filteredSupporters.length === 0 ? (
              <p className="text-sm text-muted-foreground">No donors match this search.</p>
            ) : (
              filteredSupporters.map((supporter) => {
                const selected = supporter.id === selectedId
                return (
                  <button
                    key={supporter.id}
                    type="button"
                    onClick={() => setSelectedId(supporter.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border bg-background hover:border-primary/30 hover:bg-muted/40'
                    }`}
                  >
                    <p className="font-medium text-foreground">{supporter.displayName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{supporter.email ?? 'No email on file'}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {supporter.supporterType}
                      {supporter.region ? ` · ${supporter.region}` : ''}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <section className="space-y-6">
          {loadingProfile ? (
            <div className={`${card} flex items-center gap-3 text-sm text-muted-foreground`}>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading donor history…
            </div>
          ) : !profile ? (
            <div className={`${card} text-sm text-muted-foreground`}>Select a donor to open their email workspace.</div>
          ) : (
            <>
              <div className={`${card} p-0 overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => setShowHistory((current) => !current)}
                  className="flex w-full items-center justify-between gap-4 bg-card px-5 py-4 text-left hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-foreground">{profile.supporter.displayName}</h3>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {profile.supporter.supporterType}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {profile.supporter.email ?? 'No email on file'}
                      {profile.supporter.organizationName ? ` · ${profile.supporter.organizationName}` : ''}
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">{profile.relationshipSummary}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-5">
                    <div className="hidden text-right md:block">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lifetime total</p>
                      <p className="mt-1 text-base font-semibold text-foreground">
                        {formatMoney(profile.lifetimeMonetaryTotal, profile.preferredCurrencyCode)}
                      </p>
                    </div>
                    <div className="hidden text-right md:block">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Most recent gift</p>
                      <p className="mt-1 text-base font-semibold text-foreground">{formatDate(profile.mostRecentDonationDate)}</p>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {showHistory && (
                  <div className="border-t border-border bg-muted/20 px-5 py-5">
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-xl border border-border bg-background p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recorded gifts</p>
                        <p className="mt-2 text-lg font-semibold text-foreground">{profile.donationCount}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Largest gift</p>
                        <p className="mt-2 text-lg font-semibold text-foreground">
                          {profile.largestGiftAmount != null
                            ? formatMoney(profile.largestGiftAmount, profile.preferredCurrencyCode)
                            : '—'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-background p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recurring</p>
                        <p className="mt-2 text-lg font-semibold text-foreground">{profile.hasRecurringGift ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Program areas</p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {profile.programAreas.length > 0 ? profile.programAreas.slice(0, 2).join(', ') : 'No allocations yet'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 xl:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Recent donor activity</p>
                        <div className="mt-3 space-y-3">
                          {profile.recentDonations.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No donations recorded yet.</p>
                          ) : (
                            profile.recentDonations.map((donation) => (
                              <div key={donation.id} className="rounded-xl border border-border bg-background p-3">
                                <p className="text-sm font-medium text-foreground">
                                  {donation.amount != null
                                    ? formatMoney(donation.amount, donation.currencyCode ?? profile.preferredCurrencyCode)
                                    : donation.donationType}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {formatDate(donation.donationDate)} · {donation.donationType}
                                  {donation.campaignName ? ` · ${donation.campaignName}` : ''}
                                </p>
                                {donation.notes ? <p className="mt-2 text-xs text-muted-foreground">{donation.notes}</p> : null}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-foreground">Recent allocations</p>
                        <div className="mt-3 space-y-3">
                          {profile.recentAllocations.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No linked allocations recorded yet.</p>
                          ) : (
                            profile.recentAllocations.map((allocation) => (
                              <div key={allocation.id} className="rounded-xl border border-border bg-background p-3">
                                <p className="text-sm font-medium text-foreground">{allocation.programArea}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {allocation.safehouseName ?? 'Unassigned safehouse'} ·{' '}
                                  {formatMoney(allocation.amountAllocated, profile.preferredCurrencyCode)}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={`${card} space-y-5`}>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className={sectionFormTitle}>Email composer</p>
                </div>

                <label className={label}>
                  Email goal
                  <textarea
                    className={`${input} min-h-24`}
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                    placeholder="What should this email try to accomplish?"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  {goalPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
                      onClick={() => setGoal(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className={label}>
                    Tone
                    <select
                      className={input}
                      value={tone}
                      onChange={(event) => setTone(event.target.value as (typeof toneOptions)[number])}
                    >
                      {toneOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={`${label} flex items-center gap-3 pt-6 text-sm text-foreground`}>
                    <input
                      type="checkbox"
                      checked={preferAi}
                      onChange={(event) => setPreferAi(event.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    Try AI first, then fall back to template
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className={label}>
                    Send to
                    <input
                      className={input}
                      value={recipientEmail}
                      onChange={(event) => setRecipientEmail(event.target.value)}
                      placeholder="donor@example.org"
                    />
                  </label>
                  <label className={label}>
                    Sender name
                    <input
                      className={input}
                      value={signature.senderName}
                      onChange={(event) => updateSignature('senderName', event.target.value)}
                      placeholder="Your name"
                    />
                  </label>
                  <label className={label}>
                    Sender title
                    <input
                      className={input}
                      value={signature.senderTitle}
                      onChange={(event) => updateSignature('senderTitle', event.target.value)}
                      placeholder="Development Director"
                    />
                  </label>
                  <label className={label}>
                    Organization
                    <input
                      className={input}
                      value={signature.senderOrganization}
                      onChange={(event) => updateSignature('senderOrganization', event.target.value)}
                    />
                  </label>
                  <label className={label}>
                    Contact line
                    <input
                      className={input}
                      value={signature.senderContact}
                      onChange={(event) => updateSignature('senderContact', event.target.value)}
                      placeholder="Email or phone"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className={btnPrimary} onClick={() => void onGenerateEmail()} disabled={generating}>
                    {generating ? 'Generating email…' : 'Generate email'}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    `Open email draft` uses plain text. The rich preview below shows the styled HTML version.
                  </p>
                </div>

                {generated ? (
                  <div className="space-y-4 rounded-xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject</p>
                        <p className="mt-1 text-base font-semibold text-foreground">{generated.subject}</p>
                        {generated.preview ? <p className="mt-1 text-sm text-muted-foreground">{generated.preview}</p> : null}
                      </div>
                      <button
                        type="button"
                        className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50"
                        onClick={() => void handleCopy('subject', generated.subject)}
                      >
                        {copyState === 'subject' ? 'Copied' : 'Copy subject'}
                      </button>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 rounded-full border border-border bg-card p-1">
                          <button
                            type="button"
                            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                              previewMode === 'rich' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                            }`}
                            onClick={() => setPreviewMode('rich')}
                          >
                            Rich preview
                          </button>
                          <button
                            type="button"
                            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                              previewMode === 'plain' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                            }`}
                            onClick={() => setPreviewMode('plain')}
                          >
                            Plain text
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50"
                            onClick={() => void handleCopy('body', generated.body)}
                          >
                            {copyState === 'body' ? 'Copied' : 'Copy text'}
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50"
                            onClick={() => void handleCopy('html', generated.htmlBody)}
                          >
                            {copyState === 'html' ? 'Copied' : 'Copy HTML'}
                          </button>
                        </div>
                      </div>
                      {previewMode === 'plain' ? (
                        <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-card p-4 font-sans text-sm leading-relaxed text-foreground">
                          {generated.body}
                        </pre>
                      ) : (
                        <div className="mt-2 overflow-hidden rounded-xl border border-border bg-[#f4efe8]">
                          <div className="max-h-[48rem] overflow-auto" dangerouslySetInnerHTML={createMarkup(generated.htmlBody)} />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {mailtoHref ? (
                        <a href={mailtoHref} className={btnPrimary}>
                          Open email draft
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">Add an email address to this donor to open a draft.</span>
                      )}
                      <button
                        type="button"
                        className={btnPrimary}
                        onClick={() => void onSendEmail()}
                        disabled={sending || !generated || !recipientEmail.trim()}
                      >
                        {sending ? 'Sending styled email…' : 'Send styled email'}
                      </button>
                      <p className="text-xs text-muted-foreground">{generated.strategy}</p>
                    </div>
                    {sendResult ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        Sent to {sendResult.toEmail} at {new Date(sendResult.sentAtUtc).toLocaleString()}.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
