import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, LoaderCircle, MailPlus, RefreshCw, Sparkles } from 'lucide-react'
import {
  generateDonorEmail,
  getAtRiskDonors,
  getDonorEmailProfile,
  sendDonorEmail,
  getSupporters,
  type AtRiskDonorInfo,
  type DonorEmailProfile,
  type GeneratedDonorEmail,
  type SentDonorEmail,
  type Supporter,
} from '../../../api/admin'
import { PUBLIC_CONTACT, SITE_DISPLAY_NAME } from '../../../site'
import { alertError, btnPrimary, card, input, label, pageDesc, pageTitle, sectionFormTitle } from '../shared/adminStyles'

const toneOptions = ['Warm', 'Direct', 'Celebratory', 'Re-engagement'] as const
const signatureStorageKey = 'email_hub_signature_v1'
const sentEmailLogStorageKey = 'email_hub_sent_log_v1'

const goalPresets = [
  'Thank the donor and encourage their next step.',
  'Re-engage a donor who has not given recently.',
  'Invite the donor to become a monthly giver.',
  'Share a tailored impact update and open a conversation.',
] as const

type SignatureFields = {
  senderName: string
  senderOrganization: string
  senderContact: string
}

type SentEmailLogEntry = {
  supporterId: number
  toEmail: string
  subject: string
  sentAtUtc: string
}

function defaultSignature(): SignatureFields {
  return {
    senderName: '',
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
      senderOrganization: parsed.senderOrganization ?? SITE_DISPLAY_NAME,
      senderContact: parsed.senderContact ?? PUBLIC_CONTACT.infoEmail,
    }
  } catch {
    return defaultSignature()
  }
}

function loadSentEmailLog(): SentEmailLogEntry[] {
  try {
    const raw = localStorage.getItem(sentEmailLogStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(Boolean) as SentEmailLogEntry[] : []
  } catch {
    return []
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
  const [searchParams] = useSearchParams()
  const urlSupporterId = useMemo(() => {
    const raw = searchParams.get('supporterId')
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [searchParams])

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
  const [showComposerSettings, setShowComposerSettings] = useState(false)
  const [previewMode, setPreviewMode] = useState<'rich' | 'plain'>('rich')
  const [signature, setSignature] = useState<SignatureFields>(() => loadStoredSignature())
  const [recipientEmail, setRecipientEmail] = useState('')
  const [atRiskMap, setAtRiskMap] = useState<Map<number, AtRiskDonorInfo>>(new Map())
  const [sentEmailLog, setSentEmailLog] = useState<SentEmailLogEntry[]>(() => loadSentEmailLog())

  useEffect(() => {
    try {
      localStorage.setItem(signatureStorageKey, JSON.stringify(signature))
    } catch {
      /* ignore */
    }
  }, [signature])

  useEffect(() => {
    try {
      localStorage.setItem(sentEmailLogStorageKey, JSON.stringify(sentEmailLog))
    } catch {
      /* ignore */
    }
  }, [sentEmailLog])

  const loadSupporters = useCallback(async () => {
    setLoadingList(true)
    try {
      const rows = await getSupporters()
      setSupporters(rows)
      setSelectedId((current) => {
        if (current != null) return current
        if (urlSupporterId != null && rows.some((r) => r.id === urlSupporterId)) return urlSupporterId
        return rows[0]?.id ?? null
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load donors.')
    } finally {
      setLoadingList(false)
    }
  }, [urlSupporterId])

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
    if (urlSupporterId == null || supporters.length === 0) return
    if (supporters.some((r) => r.id === urlSupporterId)) setSelectedId(urlSupporterId)
  }, [urlSupporterId, supporters])

  useEffect(() => {
    if (selectedId != null) void loadProfile(selectedId)
  }, [selectedId, loadProfile])

  // Load churn predictions silently — failures just mean no risk indicators shown
  useEffect(() => {
    getAtRiskDonors(0.55, 100)
      .then((rows) => {
        setAtRiskMap(new Map(
          rows
            .filter((r) => r.supporter_id != null)
            .map((r) => [r.supporter_id!, r])
        ))
      })
      .catch(() => { /* non-critical — sidebar still works without risk data */ })
  }, [])

  const filteredSupporters = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const matches = needle
      ? supporters.filter((s) =>
          `${s.displayName} ${s.email ?? ''} ${s.organizationName ?? ''} ${s.region ?? ''}`
            .toLowerCase()
            .includes(needle),
        )
      : supporters
    // Sort: high-risk first, then moderate, then the rest (by churn probability desc within tier)
    return [...matches].sort((a, b) => {
      const ra = atRiskMap.get(a.id)
      const rb = atRiskMap.get(b.id)
      if (ra && !rb) return -1
      if (!ra && rb) return 1
      if (ra && rb) return rb.churn_probability - ra.churn_probability
      return 0
    })
  }, [supporters, search, atRiskMap])

  const sentEmailMeta = useMemo(() => {
    const map = new Map<number, { lastSentAt: string; count: number; lastRecipient: string }>()
    for (const entry of sentEmailLog) {
      const current = map.get(entry.supporterId)
      if (!current) {
        map.set(entry.supporterId, {
          lastSentAt: entry.sentAtUtc,
          count: 1,
          lastRecipient: entry.toEmail,
        })
        continue
      }
      if (new Date(entry.sentAtUtc).getTime() > new Date(current.lastSentAt).getTime()) {
        current.lastSentAt = entry.sentAtUtc
        current.lastRecipient = entry.toEmail
      }
      current.count += 1
    }
    return map
  }, [sentEmailLog])

  const currentEmailMeta = selectedId != null ? sentEmailMeta.get(selectedId) ?? null : null

  async function onGenerateEmail() {
    if (selectedId == null) return
    setGenerating(true)
    try {
      const result = await generateDonorEmail(selectedId, {
        goal,
        tone,
        preferAi,
        senderName: signature.senderName,
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
      setSentEmailLog((current) => [
        {
          supporterId: selectedId,
          toEmail: result.toEmail,
          subject: generated.subject,
          sentAtUtc: result.sentAtUtc,
        },
        ...current,
      ].slice(0, 250))
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className={`${pageTitle} flex items-center gap-2`}>
          <MailPlus className="h-7 w-7 text-primary" />
          Donor Outreach
        </h2>
        <p className={pageDesc}>
          Review donor history, generate a tailored outreach email, and open a ready-to-send draft from the admin tools area.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
        <aside className={`${card} space-y-4 self-start`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={sectionFormTitle}>Donors</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {atRiskMap.size > 0 ? (
                  <span>
                    <span className="font-medium text-red-600">{atRiskMap.size} at risk</span>
                    {' · sorted to top'}
                  </span>
                ) : 'Pick a donor to build a custom email.'}
              </p>
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
                const risk = atRiskMap.get(supporter.id)
                const isHigh = risk?.risk_tier === 'High Risk'
                const isMod = risk?.risk_tier === 'Moderate Risk'
                const emailMeta = sentEmailMeta.get(supporter.id)
                return (
                  <div
                    key={supporter.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      selected
                        ? 'border-primary/50 bg-primary/10'
                        : isHigh
                          ? 'border-red-200 bg-red-50/60 hover:bg-red-50'
                          : isMod
                            ? 'border-amber-200 bg-amber-50/60 hover:bg-amber-50'
                            : 'border-border bg-background hover:border-primary/30 hover:bg-muted/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(supporter.id)}
                      className="block w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-medium ${isHigh ? 'text-red-800' : isMod ? 'text-amber-800' : 'text-foreground'}`}>
                          {supporter.displayName}
                        </p>
                        {risk && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isHigh
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {Math.round(risk.churn_probability * 100)}% churn risk
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{supporter.email ?? 'No email on file'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {supporter.supporterType}
                        {supporter.region ? ` · ${supporter.region}` : ''}
                      </p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Last emailed:{' '}
                        <span className="font-medium text-foreground">
                          {emailMeta ? new Date(emailMeta.lastSentAt).toLocaleString() : 'Not yet recorded'}
                        </span>
                      </p>
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </aside>

        <section className="min-w-0 space-y-6">
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
                    <div className="hidden text-right md:block">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last emailed</p>
                      <p className="mt-1 text-base font-semibold text-foreground">
                        {currentEmailMeta ? new Date(currentEmailMeta.lastSentAt).toLocaleDateString() : 'Not yet'}
                      </p>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {showHistory && (
                  <div className="border-t border-border bg-muted/20 px-5 py-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                      <div className="rounded-xl border border-border bg-background p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email activity</p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {currentEmailMeta
                            ? `${currentEmailMeta.count} sent · ${new Date(currentEmailMeta.lastSentAt).toLocaleDateString()}`
                            : 'No sends recorded yet'}
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
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        goal === preset
                          ? 'border-primary/60 bg-primary/15 text-foreground shadow-sm'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                      }`}
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

                  <label className={label}>
                    Send to
                    <input
                      className={input}
                      value={recipientEmail}
                      onChange={(event) => setRecipientEmail(event.target.value)}
                      placeholder="donor@example.org"
                    />
                  </label>
                </div>

                <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
                  <button
                    type="button"
                    onClick={() => setShowComposerSettings((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">Signature & AI settings</p>
                      <p className="mt-1 text-xs text-muted-foreground">Sender details and generation fallback behavior.</p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${showComposerSettings ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {showComposerSettings && (
                    <div className="border-t border-border bg-background px-4 py-4">
                      <div className="grid gap-4 md:grid-cols-2">
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
                          Organization
                          <input
                            className={input}
                            value={signature.senderOrganization}
                            onChange={(event) => updateSignature('senderOrganization', event.target.value)}
                          />
                        </label>
                        <label className={`${label} md:col-span-2`}>
                          Contact line
                          <input
                            className={input}
                            value={signature.senderContact}
                            onChange={(event) => updateSignature('senderContact', event.target.value)}
                            placeholder="Email or phone"
                          />
                        </label>
                      </div>

                      <label className={`${label} mt-4 flex items-center gap-3 text-sm text-foreground`}>
                        <input
                          type="checkbox"
                          checked={preferAi}
                          onChange={(event) => setPreferAi(event.target.checked)}
                          className="h-4 w-4 rounded border-border"
                        />
                        Try AI first, then fall back to template
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className={btnPrimary} onClick={() => void onGenerateEmail()} disabled={generating}>
                    {generating ? 'Generating email…' : 'Generate email'}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    One donor is handled at a time so each message can stay personalized and easy to review.
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
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              previewMode === 'rich' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={() => setPreviewMode('rich')}
                          >
                            Rich preview
                          </button>
                          <button
                            type="button"
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              previewMode === 'plain' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={() => setPreviewMode('plain')}
                          >
                            Plain text
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50"
                            onClick={() => void handleCopy('body', generated.body)}
                          >
                            {copyState === 'body' ? 'Copied' : 'Copy text'}
                          </button>
                          {generated.htmlBody && (
                            <button
                              type="button"
                              className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50"
                              onClick={() => void handleCopy('html', generated.htmlBody)}
                            >
                              {copyState === 'html' ? 'Copied' : 'Copy HTML'}
                            </button>
                          )}
                        </div>
                      </div>
                      {previewMode === 'plain' ? (
                        <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-card p-4 font-sans text-sm leading-relaxed text-foreground">
                          {generated.body}
                        </pre>
                      ) : (
                        <div className="mt-2 overflow-hidden rounded-xl border border-border bg-[#f4efe8]">
                          {generated.htmlBody
                            ? <div className="max-h-[56rem] overflow-auto" dangerouslySetInnerHTML={{ __html: generated.htmlBody }} />
                            : <p className="p-4 text-sm text-muted-foreground">No HTML preview available — plain text only.</p>
                          }
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
