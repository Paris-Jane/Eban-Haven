import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Bot, CalendarDays, Hash, LineChart, Megaphone, RefreshCw, Share2, Target, TrendingUp, Users } from 'lucide-react'
import { card, linkTile, pageDesc, pageTitle } from '../shared/adminStyles'
import { getMarketingAnalyticsSummary } from '../../../api/adminRest'
import type {
  CampaignPerformance,
  ChannelAttribution,
  EffectivenessRanking,
  MarketingAnalyticsSummary,
} from '../../../api/adminTypes'

// ── Helpers ───────────────────────────────────────────────────────────────────

function php(n: number) {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function pct(n: number) {
  return `${n.toFixed(1)}%`
}

// ── Campaign Revenue Bar Chart ────────────────────────────────────────────────

function CampaignRevenueChart({ campaigns }: { campaigns: CampaignPerformance[] }) {
  const named   = campaigns
    .filter(c => c.campaignName !== 'No Campaign')
    .sort((a, b) => b.totalPhp - a.totalPhp)
  const organic = campaigns.find(c => c.campaignName === 'No Campaign')
  const maxTotal = named[0]?.totalPhp ?? 1

  return (
    <div className="space-y-2">
      {named.map((c, i) => (
        <div key={c.campaignName} className="group flex items-center gap-4">
          {/* Label */}
          <div className="w-36 shrink-0 text-right">
            <span className="text-sm text-foreground">{c.campaignName}</span>
            <span className="block text-xs text-muted-foreground">{c.donationCount} gifts</span>
          </div>

          {/* Bar + value */}
          <div className="relative flex flex-1 items-center gap-3">
            <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-primary/10">
              <motion.div
                className="h-full rounded-md bg-primary/80 group-hover:bg-primary"
                style={{ originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: c.totalPhp / maxTotal }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
              />
            </div>
            <motion.span
              className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.08 + 0.3 }}
            >
              {php(c.totalPhp)}
            </motion.span>
          </div>
        </div>
      ))}

      {/* Organic revenue note */}
      {organic && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5">
          <div className="h-3 w-3 shrink-0 rounded-sm bg-muted-foreground/25" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{php(organic.totalPhp)}</span> raised
            organically across {organic.donationCount} unattributed donations — not tied to any
            named campaign.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Channel Attribution Bar Chart ────────────────────────────────────────────

function ChannelRevenueChart({ channels }: { channels: ChannelAttribution[] }) {
  const sorted   = [...channels].sort((a, b) => b.totalPhp - a.totalPhp)
  const maxTotal = sorted[0]?.totalPhp ?? 1

  return (
    <div className="space-y-2">
      {sorted.map((ch, i) => (
        <div key={ch.channelSource} className="group flex items-center gap-4">
          {/* Label */}
          <div className="w-36 shrink-0 text-right">
            <span className="text-sm text-foreground">{ch.channelSource}</span>
            <span className="block text-xs text-muted-foreground">{ch.uniqueDonors} donors</span>
          </div>

          {/* Bar + value */}
          <div className="flex flex-1 items-center gap-3">
            <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-primary/10">
              <motion.div
                className="h-full rounded-md bg-primary/80 group-hover:bg-primary"
                style={{ originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: ch.totalPhp / maxTotal }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
              />
            </div>
            <motion.span
              className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.08 + 0.3 }}
            >
              {php(ch.totalPhp)}
            </motion.span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Social Media Spotlight ────────────────────────────────────────────────────

function SocialSpotlight({ data }: { data: MarketingAnalyticsSummary['socialMediaSpotlight'] }) {
  const ltvDiff =
    data.avgLtvAcquiredPhp != null
      ? ((data.avgLtvAcquiredPhp - data.avgLtvAllDonorsPhp) / data.avgLtvAllDonorsPhp) * 100
      : null

  const stats = [
    { label: 'Donations via Social', value: data.donationCount.toString(), sub: php(data.totalPhp) + ' total' },
    { label: 'Avg Gift Amount', value: php(data.avgAmount), sub: `${pct(data.recurringPct)} recurring` },
    { label: 'Unique Donors (channel)', value: data.uniqueDonors.toString(), sub: 'via social media posts' },
    {
      label: 'Donors Acquired via Social',
      value: data.acquiredDonors.toString(),
      sub:
        ltvDiff != null
          ? `Avg LTV ${php(data.avgLtvAcquiredPhp!)} (${ltvDiff >= 0 ? '+' : ''}${ltvDiff.toFixed(1)}% vs all)`
          : 'LTV data pending',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map(s => (
        <div key={s.label} className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{s.value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{s.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ── Effectiveness Rankings ────────────────────────────────────────────────────

function EffectivenessChart({
  rows,
  emptyLabel,
}: {
  rows: EffectivenessRanking[]
  emptyLabel: string
}) {
  const maxRevenue = rows[0]?.medianRevenuePerPostPhp ?? 1

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={row.label} className="group flex items-center gap-4">
          <div className="w-36 shrink-0 text-right">
            <span className="text-sm text-foreground">{row.label}</span>
            <span className="block text-xs text-muted-foreground">{row.postCount} posts</span>
          </div>

          <div className="flex flex-1 items-center gap-3">
            <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-primary/10">
              <motion.div
                className="h-full rounded-md bg-primary/80 group-hover:bg-primary"
                style={{ originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: row.medianRevenuePerPostPhp / maxRevenue }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
              />
            </div>
            <motion.span
              className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.08 + 0.3 }}
            >
              {php(row.medianRevenuePerPostPhp)}
            </motion.span>
          </div>
        </div>
      ))}
    </div>
  )
}

function EffectivenessCard({
  title,
  subtitle,
  rows,
  icon,
}: {
  title: string
  subtitle: string
  rows: EffectivenessRanking[]
  icon: ReactNode
}) {
  const leader = rows[0]

  return (
    <div className={card}>
      <div className="mb-5 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <EffectivenessChart rows={rows} emptyLabel="No ranking data available yet." />
      {leader && (
        <p className="mt-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{leader.label}</span> currently leads, with a typical post generating{' '}
          <span className="font-medium text-foreground">{php(leader.medianRevenuePerPostPhp)}</span> and{' '}
          <span className="font-medium text-foreground">{leader.medianDonationReferrals.toFixed(1)}</span> donation referrals.
        </p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function MarketingAnalyticsPage() {
  const [data, setData]       = useState<MarketingAnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getMarketingAnalyticsSummary())
    } catch {
      setError('Failed to load marketing analytics.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const effectiveness = data?.effectiveness ?? {
    platforms: [],
    daysOfWeek: [],
    contentTopics: [],
    recurringHashtags: [],
    campaignHashtags: [],
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className={`${pageTitle} flex items-center gap-2`}>
            <LineChart className="h-6 w-6 text-primary" />
            Marketing Analytics
          </h2>
          <p className={pageDesc}>
            Track campaign performance, channel attribution, and social media outreach effectiveness.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className={`${card} flex items-center justify-center py-16`}>
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <>
          {/* Channel Attribution */}
          <div className={card}>
            <div className="mb-5 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Channel Attribution</h3>
              <span className="ml-auto text-xs text-muted-foreground">total raised per channel</span>
            </div>
            <ChannelRevenueChart channels={data.channels} />
          </div>

          {/* Campaign Performance */}
          <div className={card}>
            <div className="mb-5 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Campaign Revenue</h3>
              <span className="ml-auto text-xs text-muted-foreground">total raised per campaign</span>
            </div>
            <CampaignRevenueChart campaigns={data.campaigns} />
          </div>

          {/* Social Media Spotlight */}
          <div className={card}>
            <div className="mb-4 flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Social Media Spotlight</h3>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                channel_source = SocialMedia
              </span>
            </div>
            <SocialSpotlight data={data.socialMediaSpotlight} />
            <p className="mt-4 text-xs text-muted-foreground">
              Rankings below use the live `social_media_posts` table and are ordered by median donation value per post,
              with median donation referrals shown as supporting context.
            </p>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Effectiveness Rankings</h3>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <EffectivenessCard
                title="Top Platforms"
                subtitle="ranked by median revenue/post"
                rows={effectiveness.platforms}
                icon={<TrendingUp className="h-4 w-4 text-primary" />}
              />
              <EffectivenessCard
                title="Best Days To Post"
                subtitle="ranked by median revenue/post"
                rows={effectiveness.daysOfWeek}
                icon={<CalendarDays className="h-4 w-4 text-primary" />}
              />
              <EffectivenessCard
                title="Top Content Topics"
                subtitle="ranked by median revenue/post"
                rows={effectiveness.contentTopics}
                icon={<Megaphone className="h-4 w-4 text-primary" />}
              />
              <EffectivenessCard
                title="Best Recurring Hashtags"
                subtitle="non-campaign posts, min 20"
                rows={effectiveness.recurringHashtags}
                icon={<Hash className="h-4 w-4 text-primary" />}
              />
              <EffectivenessCard
                title="Best Campaign Hashtags"
                subtitle="campaign-tagged posts, min 15"
                rows={effectiveness.campaignHashtags}
                icon={<Hash className="h-4 w-4 text-primary" />}
              />
            </div>
            {!data.effectiveness && (
              <p className="mt-3 text-xs text-muted-foreground">
                Detailed post rankings are temporarily unavailable while the backend catches up with the latest analytics schema.
              </p>
            )}
          </div>

        </>
      )}

      {/* Related tools */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Related Tools</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/admin/social-planner" className={linkTile}>
            <span className="flex items-center gap-2">
              <Bot className="h-4 w-4" /> Marketing Support
            </span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
          <Link to="/admin/reports" className={linkTile}>
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Reports &amp; Analytics
            </span>
            <ArrowRight className="h-4 w-4 opacity-70" />
          </Link>
        </div>
      </div>
    </div>
  )
}
