import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Bot, LineChart, RefreshCw, TrendingUp, Users, Megaphone, Share2 } from 'lucide-react'
import { card, linkTile, pageDesc, pageTitle } from '../shared/adminStyles'
import { getMarketingAnalyticsSummary } from '../../../api/adminRest'
import type {
  MarketingAnalyticsSummary,
  CampaignPerformance,
  ChannelAttribution,
  CausalEstimate,
} from '../../../api/adminTypes'

// ── Helpers ───────────────────────────────────────────────────────────────────

function php(n: number) {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function pct(n: number) {
  return `${n.toFixed(1)}%`
}

function sigBadge(significant: boolean) {
  return significant ? (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      p &lt; 0.05
    </span>
  ) : (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      not sig.
    </span>
  )
}

// ── Coefficient Plot ───────────────────────────────────────────────────────────

type EffectRow = { label: string; pct_effect: number; ci_lower_pct: number; ci_upper_pct: number; p_value: number; significant: boolean }

function CoefficientPlot({
  rows,
  title,
  subtitle,
  nObs,
}: {
  rows: EffectRow[]
  title: string
  subtitle: string
  nObs: number
}) {
  const [tooltip, setTooltip] = useState<{ row: EffectRow; x: number; y: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const MARGIN  = { top: 20, right: 80, bottom: 36, left: 130 }
  const ROW_H   = 44
  const HEIGHT  = rows.length * ROW_H + MARGIN.top + MARGIN.bottom
  const WIDTH   = 560

  const innerW = WIDTH - MARGIN.left - MARGIN.right

  // Domain: symmetric around 0, padded to the widest CI
  const maxAbs = Math.max(...rows.flatMap(r => [Math.abs(r.ci_lower_pct), Math.abs(r.ci_upper_pct), 5]))
  const domainMax = Math.ceil(maxAbs / 10) * 10 + 5

  const xScale = (v: number) => ((v + domainMax) / (2 * domainMax)) * innerW
  const yCenter = (i: number) => MARGIN.top + i * ROW_H + ROW_H / 2

  const ticks = [-domainMax, -domainMax / 2, 0, domainMax / 2, domainMax]

  return (
    <div className="relative">
      <div className="mb-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          width={WIDTH}
          height={HEIGHT}
          className="block"
          onMouseLeave={() => setTooltip(null)}
        >
          <g transform={`translate(${MARGIN.left},0)`}>
            {/* Grid lines */}
            {ticks.map(t => (
              <line
                key={t}
                x1={xScale(t)} x2={xScale(t)}
                y1={MARGIN.top - 8} y2={HEIGHT - MARGIN.bottom}
                stroke={t === 0 ? '#6b7280' : '#e5e7eb'}
                strokeWidth={t === 0 ? 1.5 : 1}
                strokeDasharray={t === 0 ? undefined : '3 3'}
              />
            ))}

            {/* X-axis labels */}
            {ticks.map(t => (
              <text key={t} x={xScale(t)} y={HEIGHT - MARGIN.bottom + 16}
                textAnchor="middle" fontSize={10} fill="#9ca3af">
                {t > 0 ? `+${t}%` : `${t}%`}
              </text>
            ))}
            <text x={innerW / 2} y={HEIGHT - 4} textAnchor="middle" fontSize={10} fill="#9ca3af">
              % effect on donation amount vs. Direct channel
            </text>

            {/* Rows */}
            {rows.map((row, i) => {
              const cx   = xScale(row.pct_effect)
              const ciL  = xScale(row.ci_lower_pct)
              const ciR  = xScale(row.ci_upper_pct)
              const cy   = yCenter(i)
              const sig  = row.significant
              const dotColor  = sig ? (row.pct_effect >= 0 ? '#16a34a' : '#dc2626') : '#6b7280'
              const ciColor   = sig ? dotColor : '#d1d5db'
              const ciWidth   = Math.max(0, ciR - ciL)

              return (
                <g key={row.label}
                  onMouseEnter={e => {
                    const rect = svgRef.current?.getBoundingClientRect()
                    setTooltip({ row, x: e.clientX - (rect?.left ?? 0), y: cy })
                  }}
                  style={{ cursor: 'default' }}>

                  {/* Row background on hover */}
                  <rect x={-MARGIN.left} width={WIDTH} y={cy - ROW_H / 2} height={ROW_H}
                    fill="transparent" className="hover:fill-muted/40" />

                  {/* Label */}
                  <text x={-10} y={cy + 4} textAnchor="end" fontSize={12}
                    fill={sig ? '#111827' : '#6b7280'} fontWeight={sig ? 600 : 400}>
                    {row.label}
                  </text>

                  {/* CI bar */}
                  <motion.rect
                    x={ciL} y={cy - 3} height={6} rx={3}
                    fill={ciColor} opacity={0.35}
                    initial={{ width: 0, x: xScale(0) }}
                    animate={{ width: ciWidth, x: ciL }}
                    transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                  />

                  {/* CI whiskers */}
                  {[ciL, ciR].map((x, wi) => (
                    <motion.line key={wi} x1={x} x2={x} y1={cy - 6} y2={cy + 6}
                      stroke={ciColor} strokeWidth={1.5}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: i * 0.08 + 0.4 }} />
                  ))}

                  {/* Point estimate dot */}
                  <motion.circle
                    cy={cy} r={5} fill={dotColor}
                    initial={{ cx: xScale(0), opacity: 0 }}
                    animate={{ cx, opacity: 1 }}
                    transition={{ duration: 0.6, delay: i * 0.08 + 0.1, ease: 'easeOut' }}
                  />

                  {/* Effect label to the right */}
                  <motion.text
                    y={cy + 4} textAnchor="start" fontSize={11}
                    fill={dotColor} fontWeight={500}
                    initial={{ opacity: 0, x: xScale(0) + 8 }}
                    animate={{ opacity: 1, x: ciR + 8 }}
                    transition={{ duration: 0.6, delay: i * 0.08 + 0.2 }}>
                    {row.pct_effect >= 0 ? '+' : ''}{row.pct_effect.toFixed(1)}%
                  </motion.text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
          style={{ left: tooltip.x + 12, top: tooltip.y - 20 }}>
          <p className="font-semibold text-foreground">{tooltip.row.label}</p>
          <p className="text-muted-foreground">
            Effect: <span className="font-medium text-foreground">
              {tooltip.row.pct_effect >= 0 ? '+' : ''}{tooltip.row.pct_effect.toFixed(1)}%
            </span>
          </p>
          <p className="text-muted-foreground">
            95% CI: [{tooltip.row.ci_lower_pct >= 0 ? '+' : ''}{tooltip.row.ci_lower_pct.toFixed(1)}%,{' '}
            {tooltip.row.ci_upper_pct >= 0 ? '+' : ''}{tooltip.row.ci_upper_pct.toFixed(1)}%]
          </p>
          <p className="text-muted-foreground">p = {tooltip.row.p_value.toFixed(3)}</p>
          <p className={`mt-0.5 font-medium ${tooltip.row.significant ? 'text-green-700' : 'text-amber-600'}`}>
            {tooltip.row.significant ? 'Statistically significant' : 'Not significant yet'}
          </p>
        </div>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        OLS regression, HC3 robust standard errors, n={nObs}. Bars show 95% confidence intervals.
        Grey = p ≥ 0.05 (insufficient data to confirm effect). Green/red = p &lt; 0.05.
      </p>
    </div>
  )
}

function CausalAnalysisPanel({
  causal,
  nObs,
}: {
  causal: NonNullable<MarketingAnalyticsSummary['causalEstimates']>
  nObs: number
}) {
  const channelRows: EffectRow[] = causal.channel_effects.map(e => ({
    label:         e.channel,
    pct_effect:    e.pct_effect,
    ci_lower_pct:  e.ci_lower * 100,
    ci_upper_pct:  e.ci_upper * 100,
    p_value:       e.p_value,
    significant:   e.significant,
  })).sort((a, b) => b.pct_effect - a.pct_effect)

  const lift = causal.campaign_lift

  return (
    <div className={card}>
      <div className="mb-5 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Causal Analysis</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          Last run: {causal.last_run} · R² = {causal.r_squared.toFixed(3)}
        </span>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Channel coefficient plot */}
        <CoefficientPlot
          rows={channelRows}
          title="Channel Effects on Donation Amount"
          subtitle="vs. Direct channel (baseline), controlling for campaign, recurring status, and donor tenure"
          nObs={nObs}
        />

        {/* Campaign lift + interpretation */}
        <div className="space-y-4">
          {lift && (
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Campaign Lift</p>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${lift.significant ? 'text-green-700' : 'text-foreground'}`}>
                    {lift.pct_effect >= 0 ? '+' : ''}{lift.pct_effect.toFixed(1)}%
                  </span>
                  <span className="text-sm text-muted-foreground">avg donation amount</span>
                  {sigBadge(lift.significant)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Named campaigns vs. no-campaign donations. 95% CI: [{lift.ci_lower >= 0 ? '+' : ''}{(lift.ci_lower * 100).toFixed(1)}%,{' '}
                  {lift.ci_upper >= 0 ? '+' : ''}{(lift.ci_upper * 100).toFixed(1)}%]
                </p>
              </div>
            </div>
          )}

          <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50/60 px-4 py-3 text-xs text-amber-900 space-y-1.5">
            <p className="font-semibold">How to read this</p>
            <p>
              All channel effects are <span className="font-medium">positive</span> relative to Direct — social media, events, and partner referrals all trend toward higher average gifts. However, the confidence intervals are wide and cross zero, meaning the dataset is not yet large enough to confirm these effects with statistical certainty.
            </p>
            <p>
              This is an honest result, not a failure. As more donations accumulate, narrower intervals will emerge. <span className="font-medium">Social media shows the largest estimated effect (+{channelRows.find(r => r.label === 'SocialMedia')?.pct_effect.toFixed(1) ?? '—'}%)</span>, worth monitoring over time.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
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

// ── Channel Attribution Table ─────────────────────────────────────────────────

function ChannelTable({
  channels,
  channelEffects,
}: {
  channels: ChannelAttribution[]
  channelEffects?: Array<{ channel: string } & CausalEstimate>
}) {
  const effectMap = Object.fromEntries((channelEffects ?? []).map(e => [e.channel, e]))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-4">Channel</th>
            <th className="pb-2 pr-4 text-right">Donors</th>
            <th className="pb-2 pr-4 text-right">Donations</th>
            <th className="pb-2 pr-4 text-right">Avg LTV</th>
            <th className="pb-2 pr-4 text-right">Avg / Gift</th>
            <th className="pb-2 pr-4 text-right">Recurring</th>
            <th className="pb-2">vs. Direct (causal)</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {channels.map(ch => {
            const effect = effectMap[ch.channelSource]
            return (
              <tr key={ch.channelSource}>
                <td className="py-2.5 pr-4 font-medium text-foreground">{ch.channelSource}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{ch.uniqueDonors}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{ch.totalDonations}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums font-medium">{php(ch.avgDonorLtv)}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                  {php(ch.avgDonationAmount)}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums">
                  <span className={`font-medium ${ch.pctRecurringDonors >= 30 ? 'text-green-700' : ''}`}>
                    {pct(ch.pctRecurringDonors)}
                  </span>
                </td>
                <td className="py-2.5">
                  {effect ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`font-medium tabular-nums ${
                          effect.pct_effect >= 0 ? 'text-green-700' : 'text-red-600'
                        }`}
                      >
                        {effect.pct_effect >= 0 ? '+' : ''}
                        {effect.pct_effect.toFixed(1)}%
                      </span>
                      {sigBadge(effect.significant)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">baseline</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        "vs. Direct" shows estimated % difference in donation amount relative to the Direct channel,
        controlling for campaign exposure, recurring status, and donor tenure. Run the notebook to populate.
      </p>
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
          {/* Causal Analysis Panel */}
          {data.causalEstimates ? (
            <CausalAnalysisPanel causal={data.causalEstimates} nObs={data.causalEstimates.n_observations} />
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              Causal estimates not yet available. Run{' '}
              <code className="rounded bg-muted px-1 text-xs">marketing-campaign-analysis.ipynb</code>{' '}
              to populate campaign lift and channel effect estimates.
            </div>
          )}

          {/* Campaign Performance */}
          <div className={card}>
            <div className="mb-5 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Campaign Revenue</h3>
              <span className="ml-auto text-xs text-muted-foreground">total raised per campaign</span>
            </div>
            <CampaignRevenueChart campaigns={data.campaigns} />
          </div>

          {/* Channel Attribution */}
          <div className={card}>
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Channel Attribution</h3>
            </div>
            <ChannelTable
              channels={data.channels}
              channelEffects={data.causalEstimates?.channel_effects}
            />
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
              Platform-level breakdowns (impressions, reach, post-level attribution) will appear here once
              the social media posts table is added to the database.
            </p>
          </div>

          {/* Last updated */}
          {data.lastAnalysisRun && (
            <p className="text-right text-xs text-muted-foreground">
              Causal estimates last updated: {data.lastAnalysisRun}
            </p>
          )}
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
